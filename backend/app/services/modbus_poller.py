"""
Modbus Polling Service
Connects to Modbus TCP/RTU devices and polls registers according to configuration.
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from pymodbus.client import AsyncModbusTcpClient
from pymodbus.exceptions import ModbusException
import yaml
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)


class ModbusPoller:
    """
    Modbus polling service that reads registers from PLC/RTU devices.
    Supports TCP connection with automatic reconnection.
    """
    
    def __init__(
        self,
        host: str = None,
        port: int = None,
        slave_id: int = 1,
        poll_interval_ms: int = 1000,
        timeout: float = 3.0
    ):
        settings = get_settings()
        self.host = host or settings.MODBUS_HOST
        self.port = port or settings.MODBUS_PORT
        self.slave_id = slave_id or settings.MODBUS_SLAVE_ID
        self.poll_interval = poll_interval_ms / 1000.0
        self.timeout = timeout
        
        self.client: Optional[AsyncModbusTcpClient] = None
        self.connected = False
        self.last_poll_time: Optional[datetime] = None
        self.last_values: Dict[int, int] = {}
        self.poll_count = 0
        self.error_count = 0
        
        # Load register map
        self.register_config = self._load_register_config()
        self.name_to_register = {r['name']: r for r in self.register_config}
        
        logger.info(f"ModbusPoller initialized: {self.host}:{self.port} (slave {self.slave_id})")
        logger.info(f"Loaded {len(self.register_config)} registers from config")

    def _load_register_config(self) -> List[Dict[str, Any]]:
        """Load register configuration from YAML file."""
        try:
            # Check shared volume first, then local fallback
            paths = [
                Path("/app/shared_config/registers.yaml"),
                Path("app/core/registers.yaml")
            ]
            
            config_path = None
            for p in paths:
                if p.exists():
                    config_path = p
                    break
            
            if not config_path:
                logger.warning("Register config not found in standard locations")
                return []
                
            logger.info(f"Loading register config from {config_path}")
            with open(config_path, 'r') as f:
                data = yaml.safe_load(f)
                
                # Also reload connection settings if present? 
                # Ideally, yes, but for now let's stick to registers to avoid complex re-init logic mid-flight
                # unless explicitly requested.
                
                return data.get('registers', [])
        except Exception as e:
            logger.error(f"Error loading register config: {e}")
            return []

    async def reload_config(self):
        """Reload configuration from file."""
        logger.info("Reloading Modbus configuration...")
        self.register_config = self._load_register_config()
        self.name_to_register = {r['name']: r for r in self.register_config}
        logger.info(f"Reloaded {len(self.register_config)} registers")
        # In a real app we might also need to reconnect if host/port changed in the YAML
        # But for this scope, let's assume those remain via ENV or require restart for major changes.
    
    async def connect(self) -> bool:
        """Establish connection to Modbus device."""
        try:
            self.client = AsyncModbusTcpClient(
                host=self.host,
                port=self.port,
                timeout=self.timeout
            )
            await self.client.connect()
            self.connected = self.client.connected
            
            if self.connected:
                logger.info(f"Connected to Modbus device at {self.host}:{self.port}")
            else:
                logger.warning(f"Failed to connect to {self.host}:{self.port}")
            
            return self.connected
        except Exception as e:
            logger.error(f"Connection error: {e}")
            self.connected = False
            return False
    
    async def disconnect(self):
        """Close Modbus connection."""
        if self.client:
            self.client.close()
            self.connected = False
            logger.info("Disconnected from Modbus device")
    
    async def read_registers(self, start_address: int, count: int) -> Optional[List[int]]:
        """Read holding registers from device."""
        if not self.connected:
            if not await self.connect():
                return None
        
        try:
            # Use 'device_id' for pymodbus>=3.6.0
            try:
                result = await self.client.read_holding_registers(
                    address=start_address,
                    count=count,
                    device_id=self.slave_id
                )
            except TypeError:
                result = await self.client.read_holding_registers(
                    address=start_address,
                    count=count,
                    slave=self.slave_id
                )
            
            if result.isError():
                logger.warning(f"Modbus error reading {start_address}: {result}")
                self.error_count += 1
                return None
            
            return list(result.registers)
            
        except ModbusException as e:
            logger.error(f"Modbus exception: {e}")
            self.error_count += 1
            self.connected = False
            return None
        except Exception as e:
            logger.error(f"Read error: {e}")
            self.error_count += 1
            return None
    
    async def poll_all_registers(self) -> Dict[str, float]:
        """
        Poll all configured register groups and return combined SCALED results.
        Returns dict of parameter_name -> value
        """
        all_raw_values = {}
        
        # Dynamically determine contiguous blocks to read based on loaded config
        # Simple algorithm: sort addresses, group into blocks
        if not self.register_config:
            return {}
            
        addresses = sorted([r['address'] for r in self.register_config])
        if not addresses:
            return {}
            
        blocks = []
        if addresses:
            start = addresses[0]
            prev = addresses[0]
            count = 1
            
            for addr in addresses[1:]:
                if addr == prev + 1:
                    count += 1
                    prev = addr
                else:
                    blocks.append((start, count))
                    start = addr
                    prev = addr
                    count = 1
            blocks.append((start, count))
        
        # Read blocks
        for start, count in blocks:
            # Max Modbus read is usually 125 registers
            # If block > 100, split it (simple safety)
            current_start = start
            remaining = count
            while remaining > 0:
                chunk = min(remaining, 100)
                values = await self.read_registers(current_start, chunk)
                if values:
                    for i, val in enumerate(values):
                        all_raw_values[current_start + i] = val
                current_start += chunk
                remaining -= chunk
        
        self.last_values = all_raw_values
        self.last_poll_time = datetime.now()
        self.poll_count += 1
        
        # Convert to scaled values mapped by name
        return self._scale_values(all_raw_values)

    def _scale_values(self, raw_data: Dict[int, int]) -> Dict[str, float]:
        """Convert raw register values to scaled engineering units."""
        scaled_results = {}
        
        for reg in self.register_config:
            addr = reg.get('address')
            name = reg.get('name')
            scale = reg.get('scale', 1.0)
            
            if addr in raw_data:
                # Handle signed 16-bit if needed, simulators usually unsigned
                val = raw_data[addr]
                scaled_val = val * scale
                
                # Round to reasonable decimals
                if scale < 1:
                    scaled_val = round(scaled_val, 2)
                    
                scaled_results[name] = scaled_val
                
        return scaled_results
    
    def get_data(self) -> Dict[str, float]:
        """Get the latest scaled data."""
        return self._scale_values(self.last_values)
    
    async def start_polling(self, callback=None):
        """
        Start continuous polling loop.
        Optionally calls callback with each poll result.
        """
        logger.info(f"Starting polling loop (interval: {self.poll_interval}s)")
        
        while True:
            try:
                values = await self.poll_all_registers()
                
                if values and callback:
                    await callback(values)
                
                await asyncio.sleep(self.poll_interval)
                
            except asyncio.CancelledError:
                logger.info("Polling cancelled")
                break
            except Exception as e:
                logger.error(f"Polling error: {e}")
                await asyncio.sleep(self.poll_interval)
    
    def get_status(self) -> Dict[str, Any]:
        """Get poller status information."""
        return {
            "host": self.host,
            "port": self.port,
            "connected": self.connected,
            "poll_count": self.poll_count,
            "error_count": self.error_count,
            "last_poll": self.last_poll_time.isoformat() if self.last_poll_time else None,
            "registers_cached": len(self.last_values),
        }


# Global singleton for the poller
_poller_instance: Optional[ModbusPoller] = None


def get_modbus_poller() -> ModbusPoller:
    """Get or create the global Modbus poller instance."""
    global _poller_instance
    if _poller_instance is None:
        _poller_instance = ModbusPoller()
    return _poller_instance


async def init_modbus_poller():
    """Initialize and connect the Modbus poller."""
    settings = get_settings()
    if settings.MODBUS_ENABLED:
        poller = get_modbus_poller()
        await poller.connect()
        # Start background polling
        asyncio.create_task(poller.start_polling())
        return poller
    return None
