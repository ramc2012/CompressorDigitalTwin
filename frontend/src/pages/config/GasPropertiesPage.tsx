import { useState, useMemo } from 'react';
import { ConfigHeader } from '../../components/ConfigHeader';

interface GasComposition {
  Methane: number;
  Ethane: number;
  Propane: number;
  iButane: number;
  nButane: number;
  iPentane: number;
  nPentane: number;
  HexanePlus: number;
  Nitrogen: number;
  CarbonDioxide: number;
  Oxygen: number;
  HydrogenSulfide: number;
  Water: number;
  Helium: number;
  Other: number;
}

interface GasProperties {
  inputMethod: 'Manual' | 'Chromatograph' | 'AGA-8';
  specificGravity: number;
  molecularWeight: number;
  kSuction: number;
  kDischarge: number;
  zSuction: number;
  zDischarge: number;
  gasConstantR: number;
  composition: GasComposition;
  chromoModbusAddress: string;
}

const defaultComposition: GasComposition = {
  Methane: 92.5, Ethane: 3.5, Propane: 1.0, iButane: 0.2, nButane: 0.3,
  iPentane: 0.1, nPentane: 0.1, HexanePlus: 0.05, Nitrogen: 1.5,
  CarbonDioxide: 0.7, Oxygen: 0, HydrogenSulfide: 0.0004, Water: 0.05,
  Helium: 0, Other: 0
};

export function GasPropertiesPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [properties, setProperties] = useState<GasProperties>({
    inputMethod: 'Manual',
    specificGravity: 0.65,
    molecularWeight: 18.85,
    kSuction: 1.28,
    kDischarge: 1.25,
    zSuction: 0.98,
    zDischarge: 0.95,
    gasConstantR: 0, // Will be calculated
    composition: defaultComposition,
    chromoModbusAddress: '40001'
  });

  const totalComposition = useMemo(() => {
    return Object.values(properties.composition).reduce((a, b) => a + b, 0);
  }, [properties.composition]);

  const updateComposition = (component: keyof GasComposition, value: number) => {
    setProperties(prev => ({
      ...prev,
      composition: { ...prev.composition, [component]: value }
    }));
  };

  const calculateR = () => {
    if (properties.molecularWeight > 0) {
      const R = 1545.35 / properties.molecularWeight;
      setProperties(prev => ({ ...prev, gasConstantR: parseFloat(R.toFixed(3)) }));
    }
  };

  const InputField = ({ label, value, onChange, unit = '', type = 'number', step = 0.01, readOnly = false }: any) => (
    <div className="flex flex-col gap-1">
      <label className="text-slate-400 text-xs">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type={type}
          step={step}
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
        title="Gas Properties" 
        description="Configure gas inputs, thermodynamics, and composition"
        isEditing={isEditing}
        onEditToggle={() => setIsEditing(!isEditing)}
        onSave={() => setIsEditing(false)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Properties */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Input Method</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-slate-400 text-xs">Source Method</label>
                <select
                  value={properties.inputMethod}
                  disabled={!isEditing}
                  onChange={(e) => setProperties({...properties, inputMethod: e.target.value as any})}
                  className={`px-3 py-2 border rounded text-sm focus:outline-none focus:border-cyan-500/50 ${
                    !isEditing
                      ? 'bg-slate-700/30 border-slate-700/50 text-slate-400' 
                      : 'bg-slate-800/50 border-slate-600/50 text-white'
                  }`}
                >
                  <option value="Manual">Manual Entry</option>
                  <option value="Chromatograph">Online Chromatograph (Modbus)</option>
                  <option value="AGA-8">AGA-8 Calculation</option>
                </select>
              </div>

              {properties.inputMethod === 'Chromatograph' && (
                <InputField 
                  label="Modbus Start Address" 
                  value={properties.chromoModbusAddress} 
                  type="text"
                  onChange={(v: string) => setProperties({...properties, chromoModbusAddress: v})} 
                />
              )}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Thermodynamic Properties</h2>
            <div className="grid grid-cols-2 gap-4">
              <InputField 
                label="Specific Gravity (SG)" 
                value={properties.specificGravity} 
                onChange={(v: number) => setProperties({...properties, specificGravity: v})} 
              />
              <InputField 
                label="Molecular Weight (MW)" 
                value={properties.molecularWeight} 
                onChange={(v: number) => setProperties({...properties, molecularWeight: v})} 
              />
              <InputField 
                label="k (Cp/Cv) @ Suction" 
                value={properties.kSuction} 
                onChange={(v: number) => setProperties({...properties, kSuction: v})} 
              />
              <InputField 
                label="k (Cp/Cv) @ Discharge" 
                value={properties.kDischarge} 
                onChange={(v: number) => setProperties({...properties, kDischarge: v})} 
              />
              <InputField 
                label="Z (Compressibility) @ Suction" 
                value={properties.zSuction} 
                onChange={(v: number) => setProperties({...properties, zSuction: v})} 
              />
              <InputField 
                label="Z (Compressibility) @ Discharge" 
                value={properties.zDischarge} 
                onChange={(v: number) => setProperties({...properties, zDischarge: v})} 
              />
            </div>
            
            <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-300 text-sm">Gas Constant (R)</span>
                {isEditing && (
                  <button 
                    onClick={calculateR}
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Auto-Calculate
                  </button>
                )}
              </div>
              <div className="text-2xl font-mono font-bold text-white">
                {properties.gasConstantR || '---'}
                <span className="text-xs text-slate-500 font-sans ml-2">ft·lbf/(lb·°R)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Composition */}
        <div className="glass-card p-6 h-fit">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Gas Composition</h2>
            <div className={`text-sm font-medium px-3 py-1 rounded-full ${
              Math.abs(totalComposition - 100) < 0.01 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              Total: {totalComposition.toFixed(3)}%
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {Object.entries(properties.composition).map(([component, value]) => (
              <div key={component} className="flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                <label className="text-slate-300 text-sm w-32">{component}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.001"
                    value={value}
                    disabled={!isEditing}
                    onChange={(e) => updateComposition(component as keyof GasComposition, parseFloat(e.target.value) || 0)}
                    className={`w-24 px-2 py-1 text-right text-sm border rounded focus:outline-none focus:border-cyan-500/50 ${
                      !isEditing
                        ? 'bg-transparent border-transparent text-slate-400' 
                        : 'bg-slate-800/80 border-slate-600/50 text-white'
                    }`}
                  />
                  <span className="text-slate-500 text-xs w-4">%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700/50">
            <p className="text-xs text-slate-400 text-center">
              Enter individual gas components in mole percent. 
              The total must sum to exactly 100%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
