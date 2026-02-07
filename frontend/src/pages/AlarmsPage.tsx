import { useState, useEffect, useMemo } from 'react';
import { initialRegisters } from '../data/initialRegisters';

interface AlarmEvent {
  id: string;
  timestamp: string;
  registerId: number;
  parameterName: string;
  value: number;
  threshold: number;
  type: 'High' | 'Low';
  severity: 'Warning' | 'Critical';
  status: 'Active' | 'Ack';
}

export function AlarmsPage() {
  // Simulate active alarms based on registers that have "limits" defined
  // In a real app, this would come from a store or backend
  const [alarms, setAlarms] = useState<AlarmEvent[]>([]);
  const [filter, setFilter] = useState<'All' | 'Active' | 'Ack'>('All');

  // Hardcoded simulation of some alarms for demonstration
  useEffect(() => {
    // Generate some mock alarms based on the register list's "analogs"
    const analogs = initialRegisters.filter(r => r.type === 'Analog');
    
    // Create a few initial alarms if empty
    if (alarms.length === 0 && analogs.length > 0) {
      const newAlarms: AlarmEvent[] = [
        {
          id: 'evt-001',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
          registerId: 40001,
          parameterName: 'Compressor Suction Pressure',
          value: 14.2,
          threshold: 15.0,
          type: 'Low',
          severity: 'Critical',
          status: 'Active'
        },
        {
          id: 'evt-002',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          registerId: 40005,
          parameterName: 'Oil Pressure',
          value: 85.5,
          threshold: 80.0,
          type: 'High',
          severity: 'Warning',
          status: 'Ack' // Acknowledged
        }
      ];
      setAlarms(newAlarms);
    }
  }, []);

  const acknowledgeAlarm = (id: string) => {
    setAlarms(prev => prev.map(a => 
      a.id === id ? { ...a, status: 'Ack' } : a
    ));
  };

  const filteredAlarms = useMemo(() => {
    if (filter === 'All') return alarms;
    return alarms.filter(a => a.status === filter);
  }, [alarms, filter]);

  return (
    <div className="min-h-screen p-6">
      <header className="mb-6 flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-bold text-white mb-2">Alarms & Events</h1>
           <p className="text-slate-400">System alerts and limit violations</p>
        </div>
        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
           {['All', 'Active', 'Ack'].map(f => (
             <button
               key={f}
               onClick={() => setFilter(f as any)}
               className={`px-4 py-1 rounded text-sm transition-colors ${
                 filter === f ? 'bg-red-500 text-white font-bold' : 'text-slate-400 hover:text-white'
               }`}
             >
               {f}
             </button>
           ))}
        </div>
      </header>

      {/* Alarms Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
               <th className="p-4">Time</th>
               <th className="p-4">Severity</th>
               <th className="p-4">Parameter</th>
               <th className="p-4">Type</th>
               <th className="p-4 text-right">Value</th>
               <th className="p-4 text-right">Limit</th>
               <th className="p-4 text-center">Status</th>
               <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredAlarms.length === 0 ? (
               <tr><td colSpan={8} className="p-8 text-center text-slate-500">No alarms found.</td></tr>
            ) : (
              filteredAlarms.map(alarm => (
                <tr key={alarm.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 text-sm font-mono text-slate-300">
                    {new Date(alarm.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-4">
                     <span className={`px-2 py-1 rounded text-xs font-bold border ${
                       alarm.severity === 'Critical' 
                         ? 'bg-red-500/20 text-red-500 border-red-500/30' 
                         : 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
                     }`}>
                       {alarm.severity}
                     </span>
                  </td>
                  <td className="p-4 font-medium text-white">{alarm.parameterName}</td>
                  <td className="p-4 text-sm text-slate-400">{alarm.type} Violation</td>
                  <td className="p-4 text-right font-mono text-white">{alarm.value}</td>
                  <td className="p-4 text-right font-mono text-slate-400">{alarm.threshold}</td>
                  <td className="p-4 text-center">
                    <span className={`text-xs ${alarm.status === 'Active' ? 'text-white animate-pulse' : 'text-slate-500'}`}>
                      {alarm.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {alarm.status === 'Active' && (
                      <button 
                        onClick={() => acknowledgeAlarm(alarm.id)}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded border border-slate-600"
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
