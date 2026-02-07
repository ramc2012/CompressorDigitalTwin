/**
 * Dashboard - Main overview page with live data from compressor system
 */
import { useEffect, useState } from 'react';
import { useDataStore } from '../store/useDataStore';
import { fetchLiveData, createWebSocket } from '../lib/api';
import { MetricCard } from '../components/MetricCard';
import { StageCard } from '../components/StageCard';

const ENGINE_STATES: Record<number, { label: string; color: string }> = {
  0: { label: 'STOPPED', color: 'bg-slate-500' },
  1: { label: 'READY', color: 'bg-yellow-500' },
  2: { label: 'PRELUBE', color: 'bg-blue-500' },
  3: { label: 'CRANK', color: 'bg-blue-500' },
  4: { label: 'IGNITION', color: 'bg-amber-500' },
  5: { label: 'WARMUP', color: 'bg-orange-500' },
  6: { label: 'LOADING', color: 'bg-cyan-500' },
  7: { label: 'LOADED', color: 'bg-emerald-500' },
  8: { label: 'RUNNING', color: 'bg-emerald-500 animate-pulse' },
  9: { label: 'COOLDOWN', color: 'bg-orange-500' },
  10: { label: 'SHUTDOWN', color: 'bg-red-500' },
  255: { label: 'FAULT', color: 'bg-red-600 animate-pulse' },
};

export function Dashboard() {
  const { liveData, isLoading, error, setLiveData, setError } = useDataStore();
  const [wsConnected, setWsConnected] = useState(false);
  
  useEffect(() => {
    // Initial fetch
    const fetchData = async () => {
      try {
        const data = await fetchLiveData('GCS-001');
        setLiveData(data as any);
      } catch (e) {
        setError(`Failed to fetch data: ${e}`);
      }
    };
    
    fetchData();
    
    // Set up polling as fallback (every second)
    const interval = setInterval(fetchData, 1000);
    
    // Try WebSocket connection
    const ws = createWebSocket('GCS-001', 
      (msg) => {
        if (msg.type === 'LIVE_DATA') {
          setLiveData(msg.data);
          setWsConnected(true);
        }
      },
      () => {
        setWsConnected(false);
      }
    );
    
    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);
  
  if (isLoading && !liveData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl text-slate-400">
          <span className="animate-spin inline-block mr-3">⟳</span>
          Loading live data...
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-400 mb-2">Connection Error</h2>
          <p className="text-slate-400">{error}</p>
          <p className="text-sm text-slate-500 mt-4">Make sure the backend is running on port 8000</p>
        </div>
      </div>
    );
  }
  
  if (!liveData) return null;
  
  const engineState = ENGINE_STATES[liveData.engine_state] || { label: 'UNKNOWN', color: 'bg-slate-500' };

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              GCS Digital Twin
            </h1>
            <p className="text-slate-400 mt-1">Unit: {liveData.unit_id}</p>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Connection status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-sm text-slate-400">
                {wsConnected ? 'WebSocket' : 'Polling'}
              </span>
            </div>
            
            {/* Engine state badge */}
            <div className={`px-4 py-2 rounded-full ${engineState.color} text-white font-semibold shadow-lg`}>
              {engineState.label}
            </div>
            
            {/* Hour meter */}
            <div className="text-right">
              <span className="text-xs text-slate-400">Hour Meter</span>
              <div className="text-xl font-mono text-white">{liveData.hour_meter.toFixed(1)}</div>
            </div>
            
            {/* Timestamp */}
            <div className="text-right">
              <span className="text-xs text-slate-400">Last Update</span>
              <div className="text-sm text-slate-300">
                {new Date(liveData.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Engine & Compressor Vitals Row */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-slate-300 mb-4">Engine & Compressor Vitals</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <MetricCard 
            title="Engine RPM" 
            value={liveData.engine_rpm} 
            unit="RPM" 
            icon="⚙️"
            status="normal"
          />
          <MetricCard 
            title="Engine Oil Pressure" 
            value={liveData.engine_oil_press} 
            unit="PSIG" 
            icon="🛢️"
            status={liveData.engine_oil_press < 40 ? 'warning' : 'normal'}
          />
          <MetricCard 
            title="Engine Oil Temp" 
            value={liveData.engine_oil_temp} 
            unit="°F" 
            icon="🌡️"
            status={liveData.engine_oil_temp > 200 ? 'warning' : 'normal'}
          />
          <MetricCard 
            title="Jacket Water" 
            value={liveData.jacket_water_temp} 
            unit="°F" 
            icon="💧"
            status={liveData.jacket_water_temp > 200 ? 'warning' : 'normal'}
          />
          <MetricCard 
            title="Comp Oil Pressure" 
            value={liveData.comp_oil_press} 
            unit="PSIG" 
            icon="🛢️"
          />
          <MetricCard 
            title="Comp Oil Temp" 
            value={liveData.comp_oil_temp} 
            unit="°F" 
            icon="🌡️"
          />
        </div>
      </section>
      
      {/* Compression Stages */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-300">Compression Stages</h2>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-slate-400">Overall Ratio</span>
              <div className="text-2xl font-bold text-purple-400">{liveData.overall_ratio}</div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Total BHP</span>
              <div className="text-2xl font-bold text-cyan-400">{liveData.total_bhp}</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {liveData.stages.map((stage) => (
            <StageCard key={stage.stage} data={stage} />
          ))}
        </div>
      </section>
      
      {/* Exhaust Temperatures */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-300">Exhaust Temperatures</h2>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-slate-400">Spread</span>
              <div className={`text-xl font-bold ${liveData.exhaust_spread > 75 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {liveData.exhaust_spread.toFixed(1)}°F
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Average</span>
              <div className="text-xl font-bold text-slate-300">{liveData.exhaust_avg.toFixed(1)}°F</div>
            </div>
          </div>
        </div>
        
        <div className="glass-card p-4">
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(liveData.exhaust_temps).map(([cyl, temp]) => (
              <div key={cyl} className="text-center p-2 rounded-lg bg-slate-800/50">
                <div className="text-xs text-slate-500 mb-1">{cyl.replace('_', ' ')}</div>
                <div className={`text-lg font-semibold ${
                  temp > 1000 ? 'text-red-400' : 
                  temp > 975 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {temp.toFixed(0)}°
                </div>
              </div>
            ))}
          </div>
          
          {/* Turbo temps */}
          <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-700/50">
            <div className="text-center">
              <span className="text-xs text-slate-400">Pre-Turbo L</span>
              <div className="text-lg font-semibold text-orange-400">{liveData.pre_turbo_left.toFixed(0)}°F</div>
            </div>
            <div className="text-center">
              <span className="text-xs text-slate-400">Pre-Turbo R</span>
              <div className="text-lg font-semibold text-orange-400">{liveData.pre_turbo_right.toFixed(0)}°F</div>
            </div>
            <div className="text-center">
              <span className="text-xs text-slate-400">Post-Turbo L</span>
              <div className="text-lg font-semibold text-cyan-400">{liveData.post_turbo_left.toFixed(0)}°F</div>
            </div>
            <div className="text-center">
              <span className="text-xs text-slate-400">Post-Turbo R</span>
              <div className="text-lg font-semibold text-cyan-400">{liveData.post_turbo_right.toFixed(0)}°F</div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Bearings & Controls Row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bearing Temps */}
        <div className="glass-card p-4">
          <h3 className="text-lg font-semibold text-slate-300 mb-4">Bearing Temperatures</h3>
          <div className="grid grid-cols-3 gap-2">
            {liveData.bearing_temps.map((temp, idx) => (
              <div key={idx} className="text-center p-3 rounded-lg bg-slate-800/50">
                <div className="text-xs text-slate-500 mb-1">Bearing {idx + 1}</div>
                <div className={`text-xl font-semibold ${
                  temp > 190 ? 'text-red-400' : 
                  temp > 180 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {temp.toFixed(1)}°
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Control Outputs & Gas Detectors */}
        <div className="glass-card p-4">
          <h3 className="text-lg font-semibold text-slate-300 mb-4">Control Outputs & Safety</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-400">Suction Valve</span>
              <div className="mt-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" 
                  style={{ width: `${liveData.suction_valve_pct}%` }} 
                />
              </div>
              <div className="text-right text-sm text-slate-300 mt-1">{liveData.suction_valve_pct.toFixed(1)}%</div>
            </div>
            <div>
              <span className="text-xs text-slate-400">Speed Control</span>
              <div className="mt-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-500" 
                  style={{ width: `${liveData.speed_control_pct}%` }} 
                />
              </div>
              <div className="text-right text-sm text-slate-300 mt-1">{liveData.speed_control_pct.toFixed(1)}%</div>
            </div>
            <div>
              <span className="text-xs text-slate-400">Recycle Valve</span>
              <div className="mt-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500" 
                  style={{ width: `${liveData.recycle_valve_pct}%` }} 
                />
              </div>
              <div className="text-right text-sm text-slate-300 mt-1">{liveData.recycle_valve_pct.toFixed(1)}%</div>
            </div>
            <div>
              <span className="text-xs text-slate-400">Gas Detectors (%LEL)</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-center p-2 rounded bg-slate-800/50">
                  <div className="text-xs text-slate-500">Comp</div>
                  <div className={`text-lg font-semibold ${
                    liveData.gas_detector_comp > 10 ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {liveData.gas_detector_comp.toFixed(1)}
                  </div>
                </div>
                <div className="text-center p-2 rounded bg-slate-800/50">
                  <div className="text-xs text-slate-500">Engine</div>
                  <div className={`text-lg font-semibold ${
                    liveData.gas_detector_engine > 10 ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {liveData.gas_detector_engine.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
