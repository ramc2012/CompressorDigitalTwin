import { useState } from 'react';
import { ConfigHeader } from '../../components/ConfigHeader';

interface SiteConditions {
  elevation: number;
  baroPressure: number;
  ambientTempSource: 'Modbus' | 'Manual';
  ambientTempValue: number;
  ambientTempModbus: string;
  coolingWaterTempSource: 'Modbus' | 'Manual';
  coolingWaterTempValue: number;
  coolingWaterTempModbus: string;
  interstageCoolerApproach: number;
  aftercoolerApproach: number;
}

export function SiteConditionsPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [conditions, setConditions] = useState<SiteConditions>({
    elevation: 3200,
    baroPressure: 13.1,
    ambientTempSource: 'Modbus',
    ambientTempValue: 75,
    ambientTempModbus: '40010',
    coolingWaterTempSource: 'Manual',
    coolingWaterTempValue: 85,
    coolingWaterTempModbus: '40011',
    interstageCoolerApproach: 20,
    aftercoolerApproach: 15
  });

  const calculateBaro = (elev: number) => {
    // Simplified formula: P = 14.696 * (1 - 6.8754e-6 * h)^5.2561
    const p = 14.696 * Math.pow(1 - 6.8754e-6 * elev, 5.2561);
    setConditions(prev => ({ ...prev, elevation: elev, baroPressure: parseFloat(p.toFixed(2)) }));
  };

  const InputField = ({ label, value, onChange, unit = '', type = 'number', readOnly = false }: any) => (
    <div className="flex flex-col gap-1">
      <label className="text-slate-400 text-xs">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={value}
          disabled={!isEditing && !readOnly}
          readOnly={readOnly}
          onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
          className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-500/50 ${
            !isEditing || readOnly
              ? 'bg-slate-700/30 border-slate-700/50 text-slate-400' 
              : 'bg-slate-800/50 border-slate-600/50 text-white'
          }`}
        />
        {unit && <span className="text-slate-400 text-xs whitespace-nowrap">{unit}</span>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-6">
      <ConfigHeader 
        title="Site Conditions" 
        description="Configure location parameters and environmental conditions"
        isEditing={isEditing}
        onEditToggle={() => setIsEditing(!isEditing)}
        onSave={() => setIsEditing(false)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Atmospheric Conditions */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Atmospheric Conditions</h2>
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-slate-400 text-xs">Site Elevation</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={conditions.elevation}
                  disabled={!isEditing}
                  onChange={(e) => calculateBaro(parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-500/50 ${
                    !isEditing
                      ? 'bg-slate-700/30 border-slate-700/50 text-slate-400' 
                      : 'bg-slate-800/50 border-slate-600/50 text-white'
                  }`}
                />
                <span className="text-slate-400 text-xs">ft</span>
              </div>
            </div>

            <InputField 
              label="Barometric Pressure" 
              value={conditions.baroPressure} 
              onChange={(v: number) => setConditions({...conditions, baroPressure: v})} 
              unit="PSIA" 
            />

            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="text-xs text-blue-300 mb-1">Impact</div>
              <p className="text-sm text-slate-300">
                Barometric pressure affects engine derating and compressor volumetric efficiency.
                Calculated value assumes standard atmosphere.
              </p>
            </div>
          </div>
        </div>

        {/* Temperature Sources */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Temperature Settings</h2>
          <div className="space-y-6">
            {/* Ambient Temp */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <h3 className="text-sm font-medium text-white mb-3">Ambient Air Temperature</h3>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 text-xs">Source</label>
                  <select
                    value={conditions.ambientTempSource}
                    disabled={!isEditing}
                    onChange={(e) => setConditions({...conditions, ambientTempSource: e.target.value as any})}
                    className={`px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-500/50 ${
                      !isEditing
                        ? 'bg-slate-700/30 border-slate-700/50 text-slate-400' 
                        : 'bg-slate-800/50 border-slate-600/50 text-white'
                    }`}
                  >
                    <option value="Manual">Manual</option>
                    <option value="Modbus">Modbus</option>
                  </select>
                </div>
                {conditions.ambientTempSource === 'Manual' ? (
                  <InputField 
                    label="Value" 
                    value={conditions.ambientTempValue} 
                    onChange={(v: number) => setConditions({...conditions, ambientTempValue: v})} 
                    unit="°F" 
                  />
                ) : (
                  <InputField 
                    label="Modbus Address" 
                    value={conditions.ambientTempModbus} 
                    type="text"
                    onChange={(v: string) => setConditions({...conditions, ambientTempModbus: v})} 
                  />
                )}
              </div>
            </div>

            {/* Cooling Water Temp */}
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <h3 className="text-sm font-medium text-white mb-3">Cooling Water Temperature</h3>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 text-xs">Source</label>
                  <select
                    value={conditions.coolingWaterTempSource}
                    disabled={!isEditing}
                    onChange={(e) => setConditions({...conditions, coolingWaterTempSource: e.target.value as any})}
                    className={`px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-500/50 ${
                      !isEditing
                        ? 'bg-slate-700/30 border-slate-700/50 text-slate-400' 
                        : 'bg-slate-800/50 border-slate-600/50 text-white'
                    }`}
                  >
                    <option value="Manual">Manual</option>
                    <option value="Modbus">Modbus</option>
                  </select>
                </div>
                {conditions.coolingWaterTempSource === 'Manual' ? (
                  <InputField 
                    label="Value" 
                    value={conditions.coolingWaterTempValue} 
                    onChange={(v: number) => setConditions({...conditions, coolingWaterTempValue: v})} 
                    unit="°F" 
                  />
                ) : (
                  <InputField 
                    label="Modbus Address" 
                    value={conditions.coolingWaterTempModbus} 
                    type="text"
                    onChange={(v: string) => setConditions({...conditions, coolingWaterTempModbus: v})} 
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cooler Configuration */}
        <div className="glass-card p-6 md:col-span-2">
          <h2 className="text-xl font-semibold text-white mb-4">Cooler Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div>
                <h3 className="text-white font-medium">Interstage Cooler Approach</h3>
                <p className="text-xs text-slate-400">Target ΔT above cooling medium</p>
              </div>
              <div className="w-32">
                <InputField 
                  label="" 
                  value={conditions.interstageCoolerApproach} 
                  onChange={(v: number) => setConditions({...conditions, interstageCoolerApproach: v})} 
                  unit="°F" 
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
              <div>
                <h3 className="text-white font-medium">Aftercooler Approach</h3>
                <p className="text-xs text-slate-400">Target ΔT above cooling medium</p>
              </div>
              <div className="w-32">
                <InputField 
                  label="" 
                  value={conditions.aftercoolerApproach} 
                  onChange={(v: number) => setConditions({...conditions, aftercoolerApproach: v})} 
                  unit="°F" 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
