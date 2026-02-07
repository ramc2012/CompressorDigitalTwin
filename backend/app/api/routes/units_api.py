"""
Units API - Multi-unit management endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Optional
from pydantic import BaseModel
from datetime import datetime

from ..routes.auth import get_current_user, require_engineer

router = APIRouter(prefix="/api/units", tags=["units"])


class UnitCreate(BaseModel):
    unit_id: str
    name: str
    stage_count: int = 3
    modbus_host: Optional[str] = None
    modbus_port: int = 502
    modbus_slave_id: int = 1
    description: Optional[str] = None
    location: Optional[str] = None


class UnitUpdate(BaseModel):
    name: Optional[str] = None
    stage_count: Optional[int] = None
    modbus_host: Optional[str] = None
    modbus_port: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/")
async def list_units(current_user: dict = Depends(get_current_user)) -> Dict:
    """List all registered units."""
    from app.services.unit_manager import get_unit_manager
    
    manager = get_unit_manager()
    units = manager.get_all_units()
    
    return {
        "units": units,
        "count": len(units),
        "timestamp": datetime.now().isoformat()
    }


@router.get("/{unit_id}")
async def get_unit(unit_id: str, current_user: dict = Depends(get_current_user)) -> Dict:
    """Get detailed information for a specific unit."""
    from app.services.unit_manager import get_unit_manager
    
    manager = get_unit_manager()
    unit = manager.get_unit(unit_id)
    
    if not unit:
        raise HTTPException(status_code=404, detail=f"Unit {unit_id} not found")
    
    return {
        "unit_id": unit.unit_id,
        "name": unit.name,
        "stage_count": unit.stage_count,
        "modbus_host": unit.modbus_host,
        "modbus_port": unit.modbus_port,
        "modbus_slave_id": unit.modbus_slave_id,
        "is_active": unit.is_active,
        "equipment_spec": unit.equipment_spec,
        "gas_properties": unit.gas_properties
    }


@router.post("/")
async def create_unit(
    unit: UnitCreate,
    current_user: dict = Depends(require_engineer)
) -> Dict:
    """Register a new compressor unit."""
    from app.services.unit_manager import get_unit_manager, UnitConfig
    
    manager = get_unit_manager()
    
    # Check if unit already exists
    if manager.get_unit(unit.unit_id):
        raise HTTPException(status_code=400, detail=f"Unit {unit.unit_id} already exists")
    
    config = UnitConfig(
        unit_id=unit.unit_id,
        name=unit.name,
        stage_count=unit.stage_count,
        modbus_host=unit.modbus_host,
        modbus_port=unit.modbus_port,
        modbus_slave_id=unit.modbus_slave_id
    )
    
    manager.register_unit(config)
    
    return {
        "status": "created",
        "unit_id": unit.unit_id,
        "message": f"Unit {unit.unit_id} registered successfully"
    }


@router.delete("/{unit_id}")
async def delete_unit(
    unit_id: str,
    current_user: dict = Depends(require_engineer)
) -> Dict:
    """Unregister a compressor unit."""
    from app.services.unit_manager import get_unit_manager
    
    manager = get_unit_manager()
    
    if not manager.get_unit(unit_id):
        raise HTTPException(status_code=404, detail=f"Unit {unit_id} not found")
    
    manager.unregister_unit(unit_id)
    
    return {
        "status": "deleted",
        "unit_id": unit_id
    }


@router.get("/{unit_id}/physics")
async def get_unit_physics(unit_id: str) -> Dict:
    """Get extended physics calculations for a unit."""
    from app.services.unit_manager import get_unit_manager
    
    manager = get_unit_manager()
    
    if not manager.get_unit(unit_id):
        raise HTTPException(status_code=404, detail=f"Unit {unit_id} not found")
    
    results = manager.get_physics_results(unit_id)
    
    return {
        "unit_id": unit_id,
        "timestamp": datetime.now().isoformat(),
        "physics": results
    }


@router.get("/{unit_id}/stages")
async def get_unit_stages(unit_id: str) -> Dict:
    """Get stage configuration for a unit."""
    from app.services.unit_manager import get_unit_manager
    
    manager = get_unit_manager()
    unit = manager.get_unit(unit_id)
    
    if not unit:
        raise HTTPException(status_code=404, detail=f"Unit {unit_id} not found")
    
    # Return stage configurations
    stages = []
    for i in range(1, unit.stage_count + 1):
        stages.append({
            "stage": i,
            "config": unit.stage_configs[i - 1] if unit.stage_configs and len(unit.stage_configs) >= i else None
        })
    
    return {
        "unit_id": unit_id,
        "stage_count": unit.stage_count,
        "stages": stages
    }


@router.get("/{unit_id}/summary")
async def get_unit_summary(unit_id: str) -> Dict:
    """Get quick summary of unit status including live data and alarms."""
    from app.services.unit_manager import get_unit_manager
    from app.services.alarm_engine import get_alarm_engine
    
    manager = get_unit_manager()
    unit = manager.get_unit(unit_id)
    
    if not unit:
        raise HTTPException(status_code=404, detail=f"Unit {unit_id} not found")
    
    live_data = manager.get_live_data(unit_id)
    alarm_engine = get_alarm_engine()
    
    return {
        "unit_id": unit_id,
        "name": unit.name,
        "is_active": unit.is_active,
        "stage_count": unit.stage_count,
        "has_modbus": unit.modbus_host is not None,
        "engine_rpm": live_data.get("engine_rpm", 0),
        "active_alarms": len(alarm_engine.active_alarms),
        "shutdown_active": alarm_engine.get_shutdown_active(),
        "timestamp": datetime.now().isoformat()
    }
