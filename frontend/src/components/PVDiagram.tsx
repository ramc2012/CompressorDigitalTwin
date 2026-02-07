/**
 * PVDiagram - Pressure-Volume diagram visualization using Recharts
 */
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { fetchPVDiagram } from '../lib/api';

interface PVDiagramProps {
  unitId: string;
  stage?: number;
}

export function PVDiagram({ unitId, stage = 1 }: PVDiagramProps) {
  const [data, setData] = useState<{ volume: number; pressure: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [suctionP, setSuctionP] = useState(0);
  const [dischargeP, setDischargeP] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await fetchPVDiagram(unitId, stage);
        const points = result.volumes.map((v: number, i: number) => ({
          volume: v,
          pressure: result.pressures[i]
        }));
        setData(points);
        setSuctionP(result.suction_pressure_psia);
        setDischargeP(result.discharge_pressure_psia);
        setLoading(false);
      } catch (e) {
        console.error('Failed to load PV diagram:', e);
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [unitId, stage]);

  if (loading) {
    return (
      <div className="glass-card p-6 h-80 flex items-center justify-center">
        <span className="text-slate-400">Loading PV diagram...</span>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">PV Diagram - Stage {stage}</h3>
        <div className="flex gap-4 text-sm">
          <span className="text-cyan-400">P_suction: {suctionP.toFixed(1)} PSIA</span>
          <span className="text-blue-400">P_discharge: {dischargeP.toFixed(1)} PSIA</span>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis 
            dataKey="volume" 
            stroke="#94a3b8" 
            label={{ value: 'Volume (cu.in)', position: 'bottom', fill: '#94a3b8' }}
            tickFormatter={(v) => v.toFixed(0)}
          />
          <YAxis 
            stroke="#94a3b8" 
            label={{ value: 'Pressure (PSIA)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
            tickFormatter={(v) => v.toFixed(0)}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #334155',
              borderRadius: '8px'
            }}
            formatter={(value: any) => [value.toFixed(2), '']}
            labelFormatter={(label) => `Volume: ${label.toFixed(2)} cu.in`}
          />
          <ReferenceLine y={suctionP} stroke="#22d3ee" strokeDasharray="5 5" label={{ value: 'Ps', fill: '#22d3ee' }} />
          <ReferenceLine y={dischargeP} stroke="#3b82f6" strokeDasharray="5 5" label={{ value: 'Pd', fill: '#3b82f6' }} />
          <Line 
            type="monotone" 
            dataKey="pressure" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            dot={false}
            animationDuration={500}
          />
        </LineChart>
      </ResponsiveContainer>
      
      <div className="mt-4 text-xs text-slate-500 text-center">
        Synthesized from current operating conditions • Updates every 5 seconds
      </div>
    </div>
  );
}
