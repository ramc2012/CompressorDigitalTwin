"""
Data Resolver Service
Implements the fallback chain: Modbus → Calculated → Manual → Default
With stale/zombie data detection for frozen sensor values.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from enum import Enum

from app.config import get_settings
from app.core.constants import DataQuality

logger = logging.getLogger(__name__)


class DataSource(Enum):
    MODBUS = "modbus"
    CALCULATED = "calculated"
    MANUAL = "manual"
    DEFAULT = "default"


DYNAMIC_KEYWORDS = ["temp", "pressure", "pres", "flow", "rpm", "speed", "vibration", "vib", "amp", "current", "power", "load"]


class StaleDataTracker:
    """Tracks value changes to detect frozen/zombie sensors."""
    
    def __init__(self, staleness_minutes: float = 5.0, change_threshold: float = 0.01):
        self.staleness_minutes = staleness_minutes
        self.change_threshold = change_threshold
        self.last_values: Dict[str, float] = {}
        self.last_change_times: Dict[str, datetime] = {}
    
    def is_dynamic(self, parameter: str) -> bool:
        return any(kw in parameter.lower() for kw in DYNAMIC_KEYWORDS)
    
    def update_value(self, parameter: str, value: float) -> Optional[str]:
        if not self.is_dynamic(parameter):
            return None
        now = datetime.now()
        if parameter not in self.last_values:
            self.last_values[parameter] = value
            self.last_change_times[parameter] = now
            return "GOOD"
        if abs(value - self.last_values[parameter]) >= self.change_threshold:
            self.last_values[parameter] = value
            self.last_change_times[parameter] = now
            return "GOOD"
        elapsed = (now - self.last_change_times[parameter]).total_seconds() / 60.0
        return "STALE" if elapsed >= self.staleness_minutes else "GOOD"
    
    def get_stale_duration(self, parameter: str) -> Optional[float]:
        if parameter not in self.last_change_times:
            return None
        return (datetime.now() - self.last_change_times[parameter]).total_seconds() / 60.0
    
    def get_all_stale(self) -> Dict[str, float]:
        stale = {}
        now = datetime.now()
        for param in set(self.last_values.keys()):
            if not self.is_dynamic(param) or param not in self.last_change_times:
                continue
            elapsed = (now - self.last_change_times[param]).total_seconds() / 60.0
            if elapsed >= self.staleness_minutes:
                stale[param] = elapsed
        return stale


class DataResolver:
    def __init__(self):
        self.settings = get_settings()
        self.resolved_cache: Dict[str, Dict] = {}
        self.stale_timeout = 30
        self.stale_tracker = StaleDataTracker(staleness_minutes=5.0, change_threshold=0.01)
        self.parameter_config: Dict[str, Dict] = {}
        self.calculations: Dict[str, callable] = {}
        self.manual_values: Dict[str, Dict] = {}
        self.defaults: Dict[str, float] = {}
        self._setup_calculations()
    
    def _setup_calculations(self):
        def calc_isentropic_eff(data: Dict) -> Optional[float]:
            try:
                p1, p2 = data.get('stg1_suction_pressure'), data.get('stg1_discharge_pressure')
                t1, t2 = data.get('stg1_suction_temp'), data.get('stg1_discharge_temp')
                k = 1.28
                if all([p1, p2, t1, t2]):
                    t1_abs, t2_abs = t1 + 459.67, t2 + 459.67
                    p1_abs, p2_abs = p1 + 14.696, p2 + 14.696
                    t2_ideal = t1_abs * (p2_abs / p1_abs) ** ((k - 1) / k)
                    eff = (t2_ideal - t1_abs) / (t2_abs - t1_abs) * 100
                    return max(0, min(100, eff))
                return None
            except:
                return None
        self.calculations['stg1_isentropic_eff'] = calc_isentropic_eff
        
        def calc_exhaust_spread(data: Dict) -> Optional[float]:
            temps = [data[f'exh_cyl{i}_{s}'] for i in range(1, 7) for s in ['left', 'right'] if f'exh_cyl{i}_{s}' in data and data[f'exh_cyl{i}_{s}']]
            return max(temps) - min(temps) if temps else None
        self.calculations['exhaust_spread'] = calc_exhaust_spread
        
        def calc_overall_ratio(data: Dict) -> Optional[float]:
            p_suct, p_disc = data.get('stg1_suction_pressure'), data.get('stg3_discharge_pressure')
            if p_suct and p_disc and p_suct > 0:
                return (p_disc + 14.696) / (p_suct + 14.696)
            return None
        self.calculations['overall_ratio'] = calc_overall_ratio
    
    def set_manual_value(self, parameter: str, value: float, expires_at: datetime = None):
        self.manual_values[parameter] = {'value': value, 'set_at': datetime.now(), 'expires_at': expires_at, 'source': DataSource.MANUAL.value}
        logger.info(f"Manual value set: {parameter} = {value}")
    
    def clear_manual_value(self, parameter: str):
        if parameter in self.manual_values:
            del self.manual_values[parameter]
    
    def set_default(self, parameter: str, value: float):
        self.defaults[parameter] = value
    
    def resolve(self, parameter: str, modbus_data: Dict[str, float] = None, calculated_data: Dict[str, float] = None) -> Dict[str, Any]:
        result = {'parameter': parameter, 'value': None, 'source': None, 'quality': DataQuality.BAD, 
                  'timestamp': datetime.now().isoformat(), 'stale': False, 'stale_minutes': None}
        
        if modbus_data and parameter in modbus_data:
            value = modbus_data[parameter]
            if value is not None:
                result['value'] = value
                result['source'] = DataSource.MODBUS.value
                staleness = self.stale_tracker.update_value(parameter, value)
                if staleness == "STALE":
                    result['quality'] = DataQuality.STALE
                    result['stale'] = True
                    result['stale_minutes'] = self.stale_tracker.get_stale_duration(parameter)
                    logger.warning(f"STALE: {parameter}={value} (unchanged {result['stale_minutes']:.1f}min)")
                else:
                    result['quality'] = DataQuality.LIVE
                return result
        
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
        
        if parameter in self.manual_values:
            manual = self.manual_values[parameter]
            expires = manual.get('expires_at')
            if expires is None or expires > datetime.now():
                result['value'] = manual['value']
                result['source'] = DataSource.MANUAL.value
                result['quality'] = DataQuality.CALCULATED
                return result
            else:
                del self.manual_values[parameter]
        
        if parameter in self.defaults:
            result['value'] = self.defaults[parameter]
            result['source'] = DataSource.DEFAULT.value
            result['quality'] = DataQuality.BAD
        
        return result
    
    def resolve_all(self, parameters: List[str], modbus_data: Dict[str, float] = None, calculated_data: Dict[str, float] = None) -> Dict[str, Dict]:
        return {param: self.resolve(param, modbus_data, calculated_data) for param in parameters}
    
    def get_stale_parameters(self) -> Dict[str, float]:
        return self.stale_tracker.get_all_stale()


_resolver: Optional[DataResolver] = None

def get_data_resolver() -> DataResolver:
    global _resolver
    if _resolver is None:
        _resolver = DataResolver()
    return _resolver
