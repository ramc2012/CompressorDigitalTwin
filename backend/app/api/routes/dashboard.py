"""Dashboard API routes - Live data endpoints"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict
import asyncio
import json
import logging
from datetime import datetime

from ...services.modbus_poller import get_modbus_poller
from ...services.physics_engine import PhysicsEngine, StageInput
from ...core.constants import ENGINE_STATES
from ...config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/units", tags=["dashboard"])

# Store connected WebSocket clients
connected_clients: List[WebSocket] = []


@router.get("/{unit_id}/live")
async def get_live_data(unit_id: str) -> Dict:
    """
    Get current live data snapshot for the unit.
    Includes sensor values and calculated physics.
    """
    settings = get_settings()
    data = {}

    if settings.MODBUS_ENABLED:
        poller = get_modbus_poller()
        data = poller.get_data()
    else:
        # Fallback to empty/default if modbus disabled but simulator requested to be stopped
        pass

    # Basic defaults to prevent crash if data missing
    def get_val(key, default=0.0):
        return data.get(key, default)

    # Run physics calculations
    physics = PhysicsEngine()
    
    # Stage 1
    s1_suction = get_val("stg1_suction_pressure", 85.0)
    s1_discharge = get_val("stg1_discharge_pressure", 330.0)
    s1_suction_t = get_val("stg1_suction_temp", 80.0)
    s1_discharge_t = get_val("stg1_discharge_temp", 285.0)

    stg1 = physics.calculate_stage(StageInput(
        suction_pressure_psig=s1_suction,
        discharge_pressure_psig=s1_discharge,
        suction_temp_f=s1_suction_t,
        discharge_temp_f=s1_discharge_t
    ))
    
    stages = []
    stages.append({
        "stage": 1,
        "suction_press": s1_suction,
        "discharge_press": s1_discharge,
        "suction_temp": s1_suction_t,
        "discharge_temp": s1_discharge_t,
        "ratio": stg1.compression_ratio,
        "isentropic_eff": stg1.isentropic_efficiency,
        "volumetric_eff": stg1.volumetric_efficiency,
        "ideal_temp": stg1.isentropic_temp_f
    })
    
    # Stage 2
    s2_suction = get_val("stg2_suction_pressure", 320.0)
    s2_discharge = get_val("stg2_discharge_pressure", 510.0)
    s2_suction_t = get_val("stg2_suction_temp", 270.0)
    s2_discharge_t = get_val("stg2_discharge_temp", 360.0)

    stg2 = physics.calculate_stage(StageInput(
        suction_pressure_psig=s2_suction,
        discharge_pressure_psig=s2_discharge,
        suction_temp_f=s2_suction_t,
        discharge_temp_f=s2_discharge_t
    ))
    stages.append({
        "stage": 2,
        "suction_press": s2_suction,
        "discharge_press": s2_discharge,
        "suction_temp": s2_suction_t,
        "discharge_temp": s2_discharge_t,
        "ratio": stg2.compression_ratio,
        "isentropic_eff": stg2.isentropic_efficiency,
        "volumetric_eff": stg2.volumetric_efficiency,
        "ideal_temp": stg2.isentropic_temp_f
    })
    
    # Stage 3
    s3_suction = get_val("stg3_suction_pressure", 505.0)
    s3_discharge = get_val("stg3_discharge_pressure", 1050.0)
    s3_suction_t = get_val("stg3_suction_temp", 345.0)
    s3_discharge_t = get_val("stg3_discharge_temp", 520.0)

    stg3 = physics.calculate_stage(StageInput(
        suction_pressure_psig=s3_suction,
        discharge_pressure_psig=s3_discharge,
        suction_temp_f=s3_suction_t,
        discharge_temp_f=s3_discharge_t
    ))
    stages.append({
        "stage": 3,
        "suction_press": s3_suction,
        "discharge_press": s3_discharge,
        "suction_temp": s3_suction_t,
        "discharge_temp": s3_discharge_t,
        "ratio": stg3.compression_ratio,
        "isentropic_eff": stg3.isentropic_efficiency,
        "volumetric_eff": stg3.volumetric_efficiency,
        "ideal_temp": stg3.isentropic_temp_f
    })
    
    # Calculate overall ratio
    overall_ratio = stg1.compression_ratio * stg2.compression_ratio * stg3.compression_ratio
    
    # Engine state
    state_code = int(get_val("engine_state", 8))
    
    return {
        "unit_id": unit_id,
        "timestamp": datetime.now().isoformat(),
        
        # Engine state
        "engine_state": state_code,
        "engine_state_label": ENGINE_STATES.get(state_code, "UNKNOWN"),
        "hour_meter": get_val("hour_meter_low", 145230) / 10.0,
        "fault_code": int(get_val("fault_code", 255)),
        
        # Engine vitals
        "engine_rpm": get_val("engine_rpm", 0),
        "engine_oil_press": get_val("engine_oil_pressure", 0),
        "engine_oil_temp": get_val("engine_oil_temp", 0),
        "jacket_water_temp": get_val("jacket_water_temp", 0),
        
        # Compressor vitals
        "comp_oil_press": get_val("comp_oil_pressure", 0),
        "comp_oil_temp": get_val("comp_oil_temp", 0),
        
        # Stages with physics
        "stages": stages,
        
        # Overall metrics
        "overall_ratio": round(overall_ratio, 2),
        "total_bhp": round(1247.5, 1),  # Placeholder
        
        # Cylinder temps (placeholders)
        "cylinder_temps": [0, 0, 0, 0],
        
        # Exhaust
        "exhaust_temps": {
            "cyl1_left": get_val("exh_cyl1_left", 0),
            "cyl1_right": get_val("exh_cyl1_right", 0),
            "cyl2_left": get_val("exh_cyl2_left", 0),
            "cyl2_right": get_val("exh_cyl2_right", 0),
            "cyl3_left": get_val("exh_cyl3_left", 0),
            "cyl3_right": get_val("exh_cyl3_right", 0),
            "cyl4_left": get_val("exh_cyl4_left", 0),
            "cyl4_right": get_val("exh_cyl4_right", 0),
            "cyl5_left": get_val("exh_cyl5_left", 0), 
            "cyl5_right": get_val("exh_cyl5_right", 0),
            "cyl6_left": get_val("exh_cyl6_left", 0),
            "cyl6_right": get_val("exh_cyl6_right", 0),
        },
        "exhaust_spread": 0,
        "exhaust_avg": 0,
        "pre_turbo_left": get_val("pre_turbo_left", 0),
        "pre_turbo_right": get_val("pre_turbo_right", 0),
        "post_turbo_left": get_val("post_turbo_left", 0),
        "post_turbo_right": get_val("post_turbo_right", 0),
        
        # Bearings
        "bearing_temps": [
            get_val("main_bearing_1", 0),
            get_val("main_bearing_2", 0),
            get_val("main_bearing_3", 0),
            get_val("main_bearing_4", 0),
            get_val("main_bearing_5", 0),
            get_val("main_bearing_6", 0),
            get_val("main_bearing_7", 0),
            get_val("main_bearing_8", 0),
            get_val("main_bearing_9", 0),
        ],
        
        # Gas detectors
        "gas_detector_comp": get_val("gas_detector_compressor", 0),
        "gas_detector_engine": get_val("gas_detector_engine", 0),
        
        # Control outputs
        "suction_valve_pct": get_val("suction_valve_position", 0),
        "speed_control_pct": get_val("speed_control_output", 0),
        "recycle_valve_pct": get_val("recycle_valve_position", 0),
        
        # Active alarms
        "active_alarms": []
    }


@router.get("/{unit_id}/state")
async def get_engine_state(unit_id: str) -> Dict:
    """Get engine state and hour meter"""
    settings = get_settings()
    data = {}
    if settings.MODBUS_ENABLED:
        poller = get_modbus_poller()
        data = poller.get_data()
        
    state = int(data.get("engine_state", 0))
    
    return {
        "unit_id": unit_id,
        "state": state,
        "state_label": ENGINE_STATES.get(state, "UNKNOWN"),
        "hour_meter": data.get("hour_meter_low", 0) / 10.0,
        "fault_code": int(data.get("fault_code", 255))
    }


@router.websocket("/ws/{unit_id}")
async def websocket_endpoint(websocket: WebSocket, unit_id: str):
    """
    WebSocket endpoint for real-time data streaming.
    Sends live data snapshot every second.
    """
    await websocket.accept()
    connected_clients.append(websocket)
    
    try:
        while True:
            # Get live data
            data = await get_live_data(unit_id)
            
            # Send to client
            await websocket.send_json({
                "type": "LIVE_DATA",
                "unit_id": unit_id,
                "data": data
            })
            
            # Wait 1 second
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
    except Exception as e:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
        logger.error(f"WebSocket error: {e}")
