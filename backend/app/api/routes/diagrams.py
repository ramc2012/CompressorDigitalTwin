"""PV and PT diagram API routes"""
from fastapi import APIRouter
from typing import Dict, List

from ...services.physics_engine import PhysicsEngine
from ...services.data_simulator import get_simulator
from ...core.unit_conversion import psig_to_psia

router = APIRouter(prefix="/api/units", tags=["diagrams"])


@router.get("/{unit_id}/diagrams/pv")
async def get_pv_diagram(unit_id: str, stage: int = 1) -> Dict:
    """
    Get PV diagram data points for a specific stage.
    Synthesizes ideal PV curve from current operating conditions.
    """
    simulator = get_simulator()
    data = simulator.generate_snapshot()
    physics = PhysicsEngine()
    
    # Get stage pressures
    if stage == 1:
        p_suction = data["stg1_suction_press"]
        p_discharge = data["stg1_discharge_press"]
    elif stage == 2:
        p_suction = data["stg2_suction_press"]
        p_discharge = data["stg2_discharge_press"]
    else:
        p_suction = data["stg3_suction_press"]
        p_discharge = data["stg3_discharge_press"]
    
    # Convert to absolute
    p_s_psia = psig_to_psia(p_suction)
    p_d_psia = psig_to_psia(p_discharge)
    
    # Typical cylinder geometry
    bore = 8.0  # inches
    stroke = 5.0  # inches
    clearance_pct = 12.0
    
    swept_volume = (3.14159 / 4) * (bore ** 2) * stroke
    
    # Synthesize PV diagram
    volumes, pressures = physics.synthesize_pv_diagram(
        p_suction_psia=p_s_psia,
        p_discharge_psia=p_d_psia,
        clearance_vol_pct=clearance_pct,
        swept_volume=swept_volume,
        n=1.25,
        num_points=100
    )
    
    return {
        "unit_id": unit_id,
        "stage": stage,
        "timestamp": data["timestamp"],
        "volumes": volumes,
        "pressures": pressures,
        "suction_pressure_psia": p_s_psia,
        "discharge_pressure_psia": p_d_psia,
        "swept_volume_cuin": round(swept_volume, 2)
    }


@router.get("/{unit_id}/diagrams/pt")
async def get_pt_diagram(unit_id: str) -> Dict:
    """
    Get PT (Pressure-Temperature) path through all stages.
    Shows thermodynamic state path including interstage cooling.
    """
    simulator = get_simulator()
    data = simulator.generate_snapshot()
    
    # Build PT path: Suction → Stage 1 → Cooler 1 → Stage 2 → Cooler 2 → Stage 3 → Discharge
    path_points = []
    
    # Stage 1 suction
    path_points.append({
        "label": "Stage 1 Suction",
        "pressure_psig": data["stg1_suction_press"],
        "temperature_f": data["stg1_suction_temp"],
        "type": "suction"
    })
    
    # Stage 1 discharge
    path_points.append({
        "label": "Stage 1 Discharge",
        "pressure_psig": data["stg1_discharge_press"],
        "temperature_f": data["stg1_discharge_temp"],
        "type": "discharge"
    })
    
    # After interstage cooler 1
    path_points.append({
        "label": "After Cooler 1",
        "pressure_psig": data["stg2_suction_press"],
        "temperature_f": data["stg2_suction_temp"],
        "type": "cooler"
    })
    
    # Stage 2 discharge
    path_points.append({
        "label": "Stage 2 Discharge",
        "pressure_psig": data["stg2_discharge_press"],
        "temperature_f": data["stg2_discharge_temp"],
        "type": "discharge"
    })
    
    # After interstage cooler 2
    path_points.append({
        "label": "After Cooler 2",
        "pressure_psig": data["stg3_suction_press"],
        "temperature_f": data["stg3_suction_temp"],
        "type": "cooler"
    })
    
    # Stage 3 discharge
    path_points.append({
        "label": "Stage 3 Discharge",
        "pressure_psig": data["stg3_discharge_press"],
        "temperature_f": data["stg3_discharge_temp"],
        "type": "discharge"
    })
    
    return {
        "unit_id": unit_id,
        "timestamp": data["timestamp"],
        "path": path_points
    }
