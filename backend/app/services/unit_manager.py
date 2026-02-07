"""
Multi-Unit Manager
Manages configurations, pollers, and physics engines per unit.
"""
from typing import Dict, Optional, List, Any
from dataclasses import dataclass
import logging
import asyncio

logger = logging.getLogger(__name__)


@dataclass
class UnitConfig:
    """Configuration for a single unit."""
    unit_id: str
    name: str
    stage_count: int = 3
    modbus_host: Optional[str] = None
    modbus_port: int = 502
    modbus_slave_id: int = 1
    is_active: bool = True
    
    # Unit-specific data
    equipment_spec: Optional[Dict] = None
    stage_configs: Optional[List[Dict]] = None
    gas_properties: Optional[Dict] = None


class MultiUnitManager:
    """
    Manages multiple compressor units.
    Each unit can have its own Modbus connection, physics engine, and config.
    """
    
    def __init__(self):
        self.units: Dict[str, UnitConfig] = {}
        self._pollers: Dict[str, Any] = {}
        self._physics_engines: Dict[str, Any] = {}
        self._alarm_engines: Dict[str, Any] = {}
        self._live_data: Dict[str, Dict] = {}
    
    def register_unit(self, config: UnitConfig) -> bool:
        """Register a new unit."""
        if config.unit_id in self.units:
            logger.warning(f"Unit {config.unit_id} already registered, updating config")
        
        self.units[config.unit_id] = config
        self._live_data[config.unit_id] = {}
        logger.info(f"Registered unit: {config.unit_id} ({config.name})")
        return True
    
    def unregister_unit(self, unit_id: str) -> bool:
        """Unregister a unit."""
        if unit_id not in self.units:
            return False
        
        # Stop poller if running
        if unit_id in self._pollers:
            # Would call poller.stop() here
            del self._pollers[unit_id]
        
        del self.units[unit_id]
        if unit_id in self._live_data:
            del self._live_data[unit_id]
        
        logger.info(f"Unregistered unit: {unit_id}")
        return True
    
    def get_unit(self, unit_id: str) -> Optional[UnitConfig]:
        """Get unit configuration."""
        return self.units.get(unit_id)
    
    def get_all_units(self) -> List[Dict]:
        """Get summary of all units."""
        return [
            {
                "unit_id": u.unit_id,
                "name": u.name,
                "stage_count": u.stage_count,
                "is_active": u.is_active,
                "has_modbus": u.modbus_host is not None
            }
            for u in self.units.values()
        ]
    
    def update_live_data(self, unit_id: str, data: Dict):
        """Update live data for a unit."""
        if unit_id not in self._live_data:
            self._live_data[unit_id] = {}
        self._live_data[unit_id].update(data)
    
    def get_live_data(self, unit_id: str) -> Dict:
        """Get current live data for a unit."""
        return self._live_data.get(unit_id, {})
    
    def get_stage_count(self, unit_id: str) -> int:
        """Get number of stages for a unit."""
        if unit_id in self.units:
            return self.units[unit_id].stage_count
        return 3  # Default
    
    async def start_all_pollers(self):
        """Start Modbus polling for all units with Modbus connections."""
        for unit_id, config in self.units.items():
            if config.modbus_host and config.is_active:
                await self._start_poller(unit_id)
    
    async def _start_poller(self, unit_id: str):
        """Start poller for a specific unit."""
        config = self.units.get(unit_id)
        if not config:
            return
        
        logger.info(f"Starting poller for unit {unit_id} at {config.modbus_host}:{config.modbus_port}")
        # In real implementation, would create and start a ModbusPoller here
    
    def get_physics_results(self, unit_id: str, live_data: Dict = None) -> Dict:
        """
        Get physics calculation results for a unit.
        Uses unit's stage configuration and current live data.
        """
        config = self.units.get(unit_id)
        if not config:
            return {"error": "Unit not found"}
        
        data = live_data or self.get_live_data(unit_id)
        stage_count = config.stage_count
        
        # Build stage data from live values
        stages_data = []
        for i in range(1, stage_count + 1):
            prefix = f"stg{i}"
            stages_data.append({
                "p_suction_psia": data.get(f"{prefix}_suction_pressure", 50) + 14.7,
                "p_discharge_psia": data.get(f"{prefix}_discharge_pressure", 200) + 14.7,
                "t_suction_f": data.get(f"{prefix}_suction_temp", 80),
                "t_discharge_f": data.get(f"{prefix}_discharge_temp", 200),
                "rpm": data.get("engine_rpm", 1000)
            })
        
        # Import here to avoid circular dependency
        from .extended_physics import get_extended_physics_engine
        
        engine = get_extended_physics_engine()
        return engine.calculate_all_stages(stages_data)


# Singleton instance
_unit_manager: Optional[MultiUnitManager] = None


def get_unit_manager() -> MultiUnitManager:
    """Get or create multi-unit manager."""
    global _unit_manager
    if _unit_manager is None:
        _unit_manager = MultiUnitManager()
        # Register default unit
        _unit_manager.register_unit(UnitConfig(
            unit_id="GCS-001",
            name="Gas Compressor Station 001",
            stage_count=3,
            modbus_host="simulator",
            modbus_port=5020
        ))
    return _unit_manager
