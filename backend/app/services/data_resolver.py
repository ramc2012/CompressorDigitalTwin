"""
Data Resolver Service
Implements the fallback chain: Modbus → Calculated → Manual → Default
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from enum import Enum

from app.config import get_settings
from app.core.constants import DataQuality

logger = logging.getLogger(__name__)


class DataSource(Enum):
    """Data source types in priority order."""
    MODBUS = "modbus"
    CALCULATED = "calculated"
    MANUAL = "manual"
    DEFAULT = "default"


class DataResolver:
    """
    Resolves parameter values using a fallback chain.
    Priority: Modbus (live) → Calculated → Manual Entry → Default Value
    """
    
    def __init__(self):
        self.settings = get_settings()
        
        # Cache for resolved values
        self.resolved_cache: Dict[str, Dict] = {}
        
        # Staleness timeout (seconds)
        self.stale_timeout = 30
        
        # Parameter configuration - loaded from database
        self.parameter_config: Dict[str, Dict] = {}
        
        # Calculation formulas for derived parameters
        self.calculations: Dict[str, callable] = {}
        
        # Manual overrides
        self.manual_values: Dict[str, Dict] = {}
        
        # Default values
        self.defaults: Dict[str, float] = {}
        
        self._setup_calculations()
    
    def _setup_calculations(self):
        """Set up calculation functions for derived parameters."""
        
        # Example: Calculate isentropic efficiency from pressures and temps
        def calc_isentropic_eff(data: Dict) -> Optional[float]:
            try:
                p1 = data.get('stg1_suction_pressure')
                p2 = data.get('stg1_discharge_pressure')
                t1 = data.get('stg1_suction_temp')
                t2 = data.get('stg1_discharge_temp')
                k = 1.28  # Specific heat ratio
                
                if all([p1, p2, t1, t2]):
                    # Convert to absolute
                    t1_abs = t1 + 459.67
                    t2_abs = t2 + 459.67
                    p1_abs = p1 + 14.696
                    p2_abs = p2 + 14.696
                    
                    # Ideal discharge temp
                    t2_ideal = t1_abs * (p2_abs / p1_abs) ** ((k - 1) / k)
                    
                    # Isentropic efficiency
                    eff = (t2_ideal - t1_abs) / (t2_abs - t1_abs) * 100
                    return max(0, min(100, eff))
                return None
            except:
                return None
        
        self.calculations['stg1_isentropic_eff'] = calc_isentropic_eff
        
        # Calculate exhaust spread
        def calc_exhaust_spread(data: Dict) -> Optional[float]:
            temps = []
            for i in range(1, 7):
                for side in ['left', 'right']:
                    key = f'exh_cyl{i}_{side}'
                    if key in data and data[key]:
                        temps.append(data[key])
            if temps:
                return max(temps) - min(temps)
            return None
        
        self.calculations['exhaust_spread'] = calc_exhaust_spread
        
        # Calculate overall compression ratio
        def calc_overall_ratio(data: Dict) -> Optional[float]:
            p_suct = data.get('stg1_suction_pressure')
            p_disc = data.get('stg3_discharge_pressure')
            if p_suct and p_disc and p_suct > 0:
                return (p_disc + 14.696) / (p_suct + 14.696)
            return None
        
        self.calculations['overall_ratio'] = calc_overall_ratio
    
    def set_manual_value(self, parameter: str, value: float, expires_at: datetime = None):
        """Set a manual override value for a parameter."""
        self.manual_values[parameter] = {
            'value': value,
            'set_at': datetime.now(),
            'expires_at': expires_at,
            'source': DataSource.MANUAL.value
        }
        logger.info(f"Manual value set: {parameter} = {value}")
    
    def clear_manual_value(self, parameter: str):
        """Remove manual override for a parameter."""
        if parameter in self.manual_values:
            del self.manual_values[parameter]
            logger.info(f"Manual value cleared: {parameter}")
    
    def set_default(self, parameter: str, value: float):
        """Set default value for a parameter."""
        self.defaults[parameter] = value
    
    def resolve(
        self,
        parameter: str,
        modbus_data: Dict[str, float] = None,
        calculated_data: Dict[str, float] = None
    ) -> Dict[str, Any]:
        """
        Resolve a parameter value using the fallback chain.
        Returns dict with value, source, quality, and timestamp.
        """
        
        result = {
            'parameter': parameter,
            'value': None,
            'source': None,
            'quality': DataQuality.BAD,
            'timestamp': datetime.now().isoformat()
        }
        
        # 1. Try Modbus (live data)
        if modbus_data and parameter in modbus_data:
            value = modbus_data[parameter]
            if value is not None:
                result['value'] = value
                result['source'] = DataSource.MODBUS.value
                result['quality'] = DataQuality.LIVE
                return result
        
        # 2. Try calculated value
        if parameter in self.calculations:
            all_data = {**(modbus_data or {}), **(calculated_data or {})}
            calc_value = self.calculations[parameter](all_data)
            if calc_value is not None:
                result['value'] = calc_value
                result['source'] = DataSource.CALCULATED.value
                result['quality'] = DataQuality.CALCULATED
                return result
        
        if calculated_data and parameter in calculated_data:
            value = calculated_data[parameter]
            if value is not None:
                result['value'] = value
                result['source'] = DataSource.CALCULATED.value
                result['quality'] = DataQuality.CALCULATED
                return result
        
        # 3. Try manual override (if not expired)
        if parameter in self.manual_values:
            manual = self.manual_values[parameter]
            expires = manual.get('expires_at')
            if expires is None or expires > datetime.now():
                result['value'] = manual['value']
                result['source'] = DataSource.MANUAL.value
                result['quality'] = DataQuality.CALCULATED  # Manual counts as calculated
                return result
            else:
                # Expired, remove it
                del self.manual_values[parameter]
        
        # 4. Use default value
        if parameter in self.defaults:
            result['value'] = self.defaults[parameter]
            result['source'] = DataSource.DEFAULT.value
            result['quality'] = DataQuality.BAD
            return result
        
        return result
    
    def resolve_all(
        self,
        parameters: List[str],
        modbus_data: Dict[str, float] = None,
        calculated_data: Dict[str, float] = None
    ) -> Dict[str, Dict]:
        """Resolve multiple parameters at once."""
        results = {}
        for param in parameters:
            results[param] = self.resolve(param, modbus_data, calculated_data)
        return results


# Global singleton
_resolver: Optional[DataResolver] = None


def get_data_resolver() -> DataResolver:
    """Get or create the global data resolver instance."""
    global _resolver
    if _resolver is None:
        _resolver = DataResolver()
    return _resolver
