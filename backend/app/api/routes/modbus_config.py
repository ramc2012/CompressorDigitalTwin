"""
Modbus Config API - Manage register mappings in the database.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional, Dict
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.db.models import RegisterMapping
from ..routes.auth import require_engineer

router = APIRouter(prefix="/config/modbus", tags=["Modbus Configuration"])


class RegisterMappingCreate(BaseModel):
    register_address: int
    register_name: str
    parameter_name: str
    data_type: str = "uint16"
    scale_factor: float = 1.0
    offset: float = 0.0
    unit: Optional[str] = None
    description: Optional[str] = None


class RegisterMappingUpdate(BaseModel):
    register_name: Optional[str] = None
    parameter_name: Optional[str] = None
    data_type: Optional[str] = None
    scale_factor: Optional[float] = None
    offset: Optional[float] = None
    unit: Optional[str] = None
    description: Optional[str] = None


@router.get("/")
async def list_register_mappings(
    unit_id: str = "GCS-001",
    db: AsyncSession = Depends(get_db)
) -> Dict:
    """Get all register mappings for a unit."""
    result = await db.execute(
        select(RegisterMapping).where(RegisterMapping.unit_id == unit_id)
    )
    mappings = result.scalars().all()
    
    return {
        "unit_id": unit_id,
        "mappings": [
            {
                "id": m.id,
                "register_address": m.register_address,
                "register_name": m.register_name,
                "parameter_name": m.parameter_name,
                "data_type": m.data_type,
                "scale_factor": m.scale_factor,
                "offset": m.offset,
                "unit": m.unit,
                "description": m.description
            }
            for m in mappings
        ],
        "count": len(mappings)
    }


@router.post("/")
async def create_register_mapping(
    mapping: RegisterMappingCreate,
    unit_id: str = "GCS-001",
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_engineer)
) -> Dict:
    """Create a new register mapping."""
    new_mapping = RegisterMapping(
        unit_id=unit_id,
        register_address=mapping.register_address,
        register_name=mapping.register_name,
        parameter_name=mapping.parameter_name,
        data_type=mapping.data_type,
        scale_factor=mapping.scale_factor,
        offset=mapping.offset,
        unit=mapping.unit,
        description=mapping.description
    )
    
    db.add(new_mapping)
    await db.commit()
    await db.refresh(new_mapping)
    
    # Trigger poller reload
    await _reload_modbus_poller(unit_id)
    
    return {
        "status": "created",
        "id": new_mapping.id,
        "register_address": new_mapping.register_address
    }


@router.put("/{mapping_id}")
async def update_register_mapping(
    mapping_id: int,
    updates: RegisterMappingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_engineer)
) -> Dict:
    """Update an existing register mapping."""
    result = await db.execute(
        select(RegisterMapping).where(RegisterMapping.id == mapping_id)
    )
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    for field, value in updates.dict(exclude_unset=True).items():
        setattr(mapping, field, value)
    
    await db.commit()
    
    # Trigger poller reload
    await _reload_modbus_poller(mapping.unit_id)
    
    return {"status": "updated", "id": mapping_id}


@router.delete("/{mapping_id}")
async def delete_register_mapping(
    mapping_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_engineer)
) -> Dict:
    """Delete a register mapping."""
    result = await db.execute(
        select(RegisterMapping).where(RegisterMapping.id == mapping_id)
    )
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    unit_id = mapping.unit_id
    await db.delete(mapping)
    await db.commit()
    
    # Trigger poller reload
    await _reload_modbus_poller(unit_id)
    
    return {"status": "deleted", "id": mapping_id}


@router.post("/reload")
async def reload_modbus_poller(
    unit_id: str = "GCS-001",
    current_user: dict = Depends(require_engineer)
) -> Dict:
    """Manually trigger a Modbus poller reload."""
    await _reload_modbus_poller(unit_id)
    return {"status": "reloaded", "unit_id": unit_id}


@router.post("/bulk")
async def bulk_update_mappings(
    mappings: List[RegisterMappingCreate],
    unit_id: str = "GCS-001",
    replace: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_engineer)
) -> Dict:
    """
    Bulk create/update register mappings.
    If replace=True, deletes all existing mappings first.
    """
    if replace:
        await db.execute(
            delete(RegisterMapping).where(RegisterMapping.unit_id == unit_id)
        )
    
    created = 0
    for m in mappings:
        new_mapping = RegisterMapping(
            unit_id=unit_id,
            register_address=m.register_address,
            register_name=m.register_name,
            parameter_name=m.parameter_name,
            data_type=m.data_type,
            scale_factor=m.scale_factor,
            offset=m.offset,
            unit=m.unit,
            description=m.description
        )
        db.add(new_mapping)
        created += 1
    
    await db.commit()
    await _reload_modbus_poller(unit_id)
    
    return {"status": "success", "created": created, "replaced": replace}


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
