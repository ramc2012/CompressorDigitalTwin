"""
Configuration API Routes
Equipment specs, register mapping, alarm setpoints, gas properties, and templates.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import yaml
import logging
from pathlib import Path

from app.services.auth_service import get_auth_service
from app.api.routes.auth import get_current_user, require_engineer
from app.services.modbus_poller import get_modbus_poller

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/config", tags=["Configuration"])

SHARED_CONFIG_PATH = Path("/app/shared_config/registers.yaml")
REGISTER_CONFIG_PATH = Path("app/core/registers.yaml")
TEMPLATES_PATH = Path("app/core/config_templates/templates.yaml")


def get_config_path() -> Path:
    return SHARED_CONFIG_PATH if SHARED_CONFIG_PATH.exists() else REGISTER_CONFIG_PATH


class EquipmentSpec(BaseModel):
    unit_id: str
    spec_type: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    num_stages: Optional[int] = 3
    rated_speed_rpm: Optional[float] = 1200
    rated_bhp: Optional[float] = 1500
    cylinder_data: Optional[Dict] = None


class RegisterMapping(BaseModel):
    address: int
    name: str
    description: Optional[str] = None
    data_type: str = "UINT16"
    scale_factor: float = 1.0
    engineering_unit: Optional[str] = None
    category: Optional[str] = None
    is_active: bool = True


class ModbusServerConfig(BaseModel):
    host: str
    port: int
    slave_id: int


class AlarmSetpoint(BaseModel):
    parameter_name: str
    ll_value: Optional[float] = None
    l_value: Optional[float] = None
    h_value: Optional[float] = None
    hh_value: Optional[float] = None
    deadband: float = 0
    delay_seconds: int = 0
    is_shutdown: bool = False
    is_enabled: bool = True


class GasProperties(BaseModel):
    name: str = "Natural Gas"
    specific_gravity: float = 0.65
    molecular_weight: float = 18.85
    k_suction: float = 1.28
    k_discharge: float = 1.25
    z_suction: float = 0.98
    z_discharge: float = 0.95


# In-memory storage
_equipment_specs: Dict[str, EquipmentSpec] = {
    "GCS-001": EquipmentSpec(
        unit_id="GCS-001", spec_type="compressor", manufacturer="Ariel",
        model="JGK/4", serial_number="F-12345", num_stages=3,
        rated_speed_rpm=1200, rated_bhp=1500,
        cylinder_data={
            "stage1": {"bore": 9.5, "stroke": 5.0, "clearance_pct": 18},
            "stage2": {"bore": 5.5, "stroke": 5.0, "clearance_pct": 20},
            "stage3": {"bore": 3.5, "stroke": 5.0, "clearance_pct": 22}
        }
    )
}

_alarm_setpoints: Dict[str, AlarmSetpoint] = {
    "engine_oil_pressure": AlarmSetpoint(parameter_name="engine_oil_pressure", ll_value=30, l_value=40, h_value=80, hh_value=90, is_shutdown=True),
    "engine_oil_temp": AlarmSetpoint(parameter_name="engine_oil_temp", l_value=100, h_value=200, hh_value=220),
    "jacket_water_temp": AlarmSetpoint(parameter_name="jacket_water_temp", l_value=140, h_value=190, hh_value=200),
    "exhaust_spread": AlarmSetpoint(parameter_name="exhaust_spread", h_value=75, hh_value=100, is_shutdown=True),
}

_gas_properties: Dict[str, GasProperties] = {"GCS-001": GasProperties()}


def load_yaml_config() -> Dict[str, Any]:
    path = get_config_path()
    try:
        with open(path, 'r') as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        logger.error(f"Failed to load config: {e}")
        return {}


def save_yaml_config(data: Dict[str, Any]):
    path = get_config_path()
    try:
        with open(path, 'w') as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)
        return True
    except Exception as e:
        logger.error(f"Failed to save config: {e}")
        return False


def load_templates() -> List[Dict[str, Any]]:
    """Load pre-built configuration templates."""
    try:
        if TEMPLATES_PATH.exists():
            with open(TEMPLATES_PATH, 'r') as f:
                data = yaml.safe_load(f) or {}
                return data.get('templates', [])
    except Exception as e:
        logger.error(f"Failed to load templates: {e}")
    return []


# Template Routes
@router.get("/templates")
async def list_templates():
    """List all available configuration templates."""
    templates = load_templates()
    # Return summary without full register details
    return [{
        "id": t.get("id"),
        "name": t.get("name"),
        "category": t.get("category"),
        "manufacturer": t.get("manufacturer"),
        "description": t.get("description")
    } for t in templates]


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    """Get full template details."""
    templates = load_templates()
    for t in templates:
        if t.get("id") == template_id:
            return t
    raise HTTPException(status_code=404, detail="Template not found")


@router.post("/templates/{template_id}/apply")
async def apply_template(template_id: str, current_user: dict = Depends(require_engineer)):
    """Apply a template to the current configuration."""
    templates = load_templates()
    template = next((t for t in templates if t.get("id") == template_id), None)
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Merge template registers with existing config
    current_config = load_yaml_config()
    
    # Get registers from template
    new_registers = template.get("registers", [])
    if not new_registers:
        new_registers = template.get("exhaust_temp_registers", [])
    
    if new_registers:
        existing_registers = current_config.get("registers", [])
        existing_addresses = {r.get("address") for r in existing_registers}
        
        # Add only new registers
        for reg in new_registers:
            if reg.get("address") not in existing_addresses:
                existing_registers.append(reg)
        
        current_config["registers"] = existing_registers
        
        # Apply modbus settings if present
        if "modbus_settings" in template:
            modbus = template["modbus_settings"]
            if "slave_id" in modbus:
                current_config["server"] = current_config.get("server", {})
                current_config["server"]["slave_id"] = modbus["slave_id"]
        
        if save_yaml_config(current_config):
            poller = get_modbus_poller()
            await poller.reload_config()
            return {"status": "applied", "template": template_id, "registers_added": len(new_registers)}
    
    raise HTTPException(status_code=500, detail="Failed to apply template")


# Modbus Routes
@router.get("/modbus")
async def get_modbus_config():
    return load_yaml_config()


@router.put("/modbus")
async def update_modbus_config(config: Dict[str, Any], current_user: dict = Depends(require_engineer)):
    current_data = load_yaml_config()
    current_data.update(config)
    if save_yaml_config(current_data):
        try:
            poller = get_modbus_poller()
            await poller.reload_config()
            return {"status": "updated", "message": "Configuration saved and reloaded"}
        except Exception as e:
            return {"status": "saved_but_reload_failed", "message": str(e)}
    raise HTTPException(status_code=500, detail="Failed to save configuration")


# Equipment Routes
@router.get("/equipment/{unit_id}")
async def get_equipment_spec(unit_id: str):
    if unit_id not in _equipment_specs:
        raise HTTPException(status_code=404, detail="Unit not found")
    return _equipment_specs[unit_id]


@router.put("/equipment/{unit_id}")
async def update_equipment_spec(unit_id: str, spec: EquipmentSpec, current_user: dict = Depends(require_engineer)):
    _equipment_specs[unit_id] = spec
    return {"status": "updated", "unit_id": unit_id}


# Alarm Routes
@router.get("/alarms/{unit_id}")
async def get_alarm_setpoints(unit_id: str):
    return list(_alarm_setpoints.values())


@router.put("/alarms/{unit_id}/{parameter}")
async def update_alarm_setpoint(unit_id: str, parameter: str, setpoint: AlarmSetpoint, current_user: dict = Depends(require_engineer)):
    _alarm_setpoints[parameter] = setpoint
    return {"status": "updated", "parameter": parameter}


@router.post("/alarms/{unit_id}")
async def add_alarm_setpoint(unit_id: str, setpoint: AlarmSetpoint, current_user: dict = Depends(require_engineer)):
    _alarm_setpoints[setpoint.parameter_name] = setpoint
    return {"status": "created", "parameter": setpoint.parameter_name}


# Gas Routes
@router.get("/gas/{unit_id}")
async def get_gas_properties(unit_id: str):
    if unit_id not in _gas_properties:
        _gas_properties[unit_id] = GasProperties()
    return _gas_properties[unit_id]


@router.put("/gas/{unit_id}")
async def update_gas_properties(unit_id: str, properties: GasProperties, current_user: dict = Depends(require_engineer)):
    _gas_properties[unit_id] = properties
    return {"status": "updated", "unit_id": unit_id}


# Register Routes
@router.get("/registers/{unit_id}")
async def get_register_map(unit_id: str):
    config = load_yaml_config()
    registers = config.get('registers', [])
    return [RegisterMapping(
        address=reg.get('address'), name=reg.get('name'), description=reg.get('description'),
        data_type=reg.get('data_type', 'UINT16'), scale_factor=reg.get('scale', 1.0),
        engineering_unit=reg.get('unit'), category=reg.get('category'), is_active=True
    ) for reg in registers]


# System Status
@router.get("/system/status")
async def get_system_status():
    from app.config import get_settings
    settings = get_settings()
    return {
        "app_name": settings.APP_NAME,
        "modbus_enabled": settings.MODBUS_ENABLED,
        "modbus_host": settings.MODBUS_HOST if settings.MODBUS_ENABLED else None,
        "version": "1.0.0",
        "mode": "simulator" if not settings.MODBUS_ENABLED else "live"
    }
