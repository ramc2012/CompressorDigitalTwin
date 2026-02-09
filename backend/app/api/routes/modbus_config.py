"""
Modbus Config API - Manage register mappings and server configuration.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional, Dict
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.db.models import RegisterMapping, ModbusServerConfig
from ..routes.auth import require_engineer

router = APIRouter(prefix="/api/config/modbus", tags=["Modbus Configuration"])


class RegisterMappingCreate(BaseModel):
    address: int
    name: str
    description: Optional[str] = None
    unit: Optional[str] = None
    scale: float = 1.0
    offset: float = 0.0
    dataType: str = "uint16" 
    pollGroup: str = "A"
    category: str = "general"


class RegisterMappingUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    unit: Optional[str] = None
    scale: Optional[float] = None
    offset: Optional[float] = None
    dataType: Optional[str] = None
    pollGroup: Optional[str] = None
    category: Optional[str] = None

class ModbusGlobalConfig(BaseModel):
    host: str = "0.0.0.0"
    port: int = 502
    slave_id: int = 1
    timeout_ms: int = 1000
    scan_rate_ms: int = 1000

class ModbusConfigFull(BaseModel):
    server: Optional[ModbusGlobalConfig] = None
    registers: Optional[List[Dict]] = None


@router.get("")
async def get_modbus_config(
    unit_id: str = "GCS-001",
    db: AsyncSession = Depends(get_db)
) -> Dict:
    """Get full Modbus configuration (registers + server settings)."""
    # Get Registers
    result_regs = await db.execute(
        select(RegisterMapping).where(RegisterMapping.unit_id == unit_id)
    )
    mappings = result_regs.scalars().all()
    
    # Get Server Config
    result_conf = await db.execute(
        select(ModbusServerConfig).where(ModbusServerConfig.unit_id == unit_id)
    )
    server_conf = result_conf.scalar_one_or_none()
    
    server_data = {
        "host": server_conf.host if server_conf else "0.0.0.0",
        "port": server_conf.port if server_conf else 502,
        "slave_id": server_conf.slave_id if server_conf else 1,
        "timeout_ms": server_conf.timeout_ms if server_conf else 1000,
        "scan_rate_ms": server_conf.scan_rate_ms if server_conf else 1000
    }

    return {
        "unit_id": unit_id,
        "server": server_data,
        "registers": [
            {
                "id": m.id,
                "address": m.address, 
                "name": m.name,
                "description": m.description,
                "unit": m.unit,
                "scale": m.scale,
                "offset": m.offset,
                "dataType": m.data_type,
                "pollGroup": m.poll_group,
                "category": m.category
            }
            for m in mappings
        ],
        "count": len(mappings)
    }


@router.put("")
async def update_modbus_config(
    config: ModbusConfigFull,
    unit_id: str = "GCS-001",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_engineer)
) -> Dict:
    """
    Update global Modbus configuration and optionally bulk update registers.
    Frontend sends { server: {...}, registers: [...] }
    """
    
    # 1. Update Server Config
    if config.server:
        result = await db.execute(
            select(ModbusServerConfig).where(ModbusServerConfig.unit_id == unit_id)
        )
        server_conf = result.scalar_one_or_none()
        
        if not server_conf:
            server_conf = ModbusServerConfig(unit_id=unit_id)
            db.add(server_conf)
        
        server_conf.host = config.server.host
        server_conf.port = config.server.port
        server_conf.slave_id = config.server.slave_id
        server_conf.timeout_ms = config.server.timeout_ms
        server_conf.scan_rate_ms = config.server.scan_rate_ms
    
    # 2. Update Registers if provided (Sync approach: delete all and recreate is safest for this UI)
    if config.registers is not None:
        # Delete existing
        await db.execute(
            delete(RegisterMapping).where(RegisterMapping.unit_id == unit_id)
        )
        
        # Create new
        for r in config.registers:
            new_reg = RegisterMapping(
                unit_id=unit_id,
                address=r.get('address'),
                name=r.get('name'),
                description=r.get('description'),
                unit=r.get('unit'),
                scale=r.get('scale', 1.0),
                offset=r.get('offset', 0.0),
                data_type=r.get('dataType', 'uint16'),
                poll_group=r.get('pollGroup', 'A'),
                category=r.get('category', 'general')
            )
            db.add(new_reg)
            
    await db.commit()
    
    # Reload poller
    await _reload_modbus_poller(unit_id)

    return {"status": "updated", "unit_id": unit_id}

@router.post("")
async def create_register_mapping(
    mapping: RegisterMappingCreate,
    unit_id: str = "GCS-001",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_engineer)
) -> Dict:
    """Create a new register mapping."""
    new_mapping = RegisterMapping(
        unit_id=unit_id,
        address=mapping.address,
        name=mapping.name,
        description=mapping.description,
        unit=mapping.unit,
        scale=mapping.scale,
        offset=mapping.offset,
        data_type=mapping.dataType,
        poll_group=mapping.pollGroup,
        category=mapping.category
    )
    
    db.add(new_mapping)
    await db.commit()
    await db.refresh(new_mapping)
    
    # Trigger poller reload
    await _reload_modbus_poller(unit_id)
    
    return {
        "status": "created",
        "id": new_mapping.id,
        "address": new_mapping.address
    }

async def _reload_modbus_poller(unit_id: str):
    """Internal function to reload the Modbus poller configuration."""
    try:
        from app.services.modbus_poller import get_modbus_poller
        poller = get_modbus_poller()
        if poller and hasattr(poller, 'reload_config'):
            await poller.reload_config(unit_id)
    except Exception as e:
        # Log but don't fail the request
        import logging
        logging.getLogger(__name__).warning(f"Failed to reload Modbus poller: {e}")
