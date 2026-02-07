import { useState, useEffect } from 'react';
import { ConfigHeader } from '../../components/ConfigHeader';
import { initialRegisters } from '../../data/initialRegisters';
import { fetchModbusConfig, updateModbusConfig } from '../../lib/api';
import { useAuthStore } from '../../store/useAuthStore';
import type { RegisterDef } from '../../data/initialRegisters';

// Redefining locally to include UI state fields
interface ExtendedRegisterState extends RegisterDef {
    sourcePriority: 'Modbus' | 'Manual';
    manualValue: number;
    fallbackStrategy: 'HoldLastGood' | 'Manual';
    liveValue: number;
    quality: 'Good' | 'Bad' | 'Manual';
    isActive: boolean;
}

export function ModbusMappingPage() {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'All' | 'Analog' | 'Discrete'>('All');
    const token = useAuthStore((state) => state.token);

    // Initialize state with imported registers + default operational fields
    const [registers, setRegisters] = useState<ExtendedRegisterState[]>(() =>
        initialRegisters.map(reg => ({
            ...reg,
            sourcePriority: 'Modbus',
            manualValue: 0,
            fallbackStrategy: 'HoldLastGood',
            liveValue: 0,
            quality: 'Bad',
            isActive: true
        }))
    );

    const [globalSettings, setGlobalSettings] = useState({
        ipAddress: '192.168.1.100',
        port: 502,
        slaveId: 1,
        timeoutMs: 1000,
        scanRateMs: 500
    });

    // Load config from backend on mount
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const config = await fetchModbusConfig();
                if (config.server) {
                    setGlobalSettings(prev => ({
                        ...prev,
                        ipAddress: config.server?.host || prev.ipAddress,
                        port: config.server?.port || prev.port,
                        slaveId: config.server?.slave_id || prev.slaveId
                    }));
                }
                // Could also merge registers here if needed
            } catch (err) {
                console.error('Failed to load config:', err);
            }
        };
        loadConfig();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveError(null);
        setSaveSuccess(false);

        try {
            // Build config payload
            const configPayload = {
                server: {
                    host: globalSettings.ipAddress,
                    port: globalSettings.port,
                    slave_id: globalSettings.slaveId
                }
                // registers can be added here if needed
            };

            await updateModbusConfig(configPayload, token || undefined);
            setSaveSuccess(true);
            setIsEditing(false);

            // Clear success message after 3 seconds
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            setSaveError(err.message || 'Failed to save configuration');
        } finally {
            setIsSaving(false);
        }
    };

    const updateRegister = (address: number, field: keyof ExtendedRegisterState, value: any) => {
        setRegisters(prev => prev.map(reg =>
            reg.address === address ? { ...reg, [field]: value } : reg
        ));
    };

    const getStatusColor = (quality: string) => {
        switch (quality) {
            case 'Good': return 'text-green-400';
            case 'Bad': return 'text-red-400';
            case 'Manual': return 'text-blue-400';
            default: return 'text-slate-400';
        }
    };

    // Filter Logic
    const filteredRegisters = registers.filter(reg => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = reg.name.toLowerCase().includes(term) ||
            reg.address.toString().includes(term);
        const matchesType = typeFilter === 'All' || reg.type === typeFilter;
        return matchesSearch && matchesType;
    });

    return (
        <div className="min-h-screen p-6">
            <ConfigHeader
                title="Modbus Register Mapping"
                description="Configure Modbus TCP connection and register mapping"
                isEditing={isEditing}
                onEditToggle={() => setIsEditing(!isEditing)}
                onSave={handleSave}
                isSaving={isSaving}
            />

            {/* Save Feedback */}
            {saveError && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
                    ❌ Error: {saveError}
                </div>
            )}
            {saveSuccess && (
                <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-300 text-sm">
                    ✅ Configuration saved successfully! Both Backend and Simulator will reload.
                </div>
            )}

            {/* Global Settings Panel */}
            <div className="glass-card p-6 mb-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-cyan-400">⚡</span> Global Connection Settings
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div>
                        <label className="text-slate-400 text-xs block mb-1">Target IP Address</label>
                        <input
                            type="text"
                            value={globalSettings.ipAddress}
                            disabled={!isEditing}
                            onChange={e => setGlobalSettings({ ...globalSettings, ipAddress: e.target.value })}
                            className="w-full bg-slate-800/50 border border-slate-600/50 rounded px-3 py-2 text-white font-mono disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="text-slate-400 text-xs block mb-1">Port</label>
                        <input
                            type="number"
                            value={globalSettings.port}
                            disabled={!isEditing}
                            onChange={e => setGlobalSettings({ ...globalSettings, port: parseInt(e.target.value) })}
                            className="w-full bg-slate-800/50 border border-slate-600/50 rounded px-3 py-2 text-white font-mono disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="text-slate-400 text-xs block mb-1">Slave ID (Unit Address)</label>
                        <input
                            type="number"
                            value={globalSettings.slaveId}
                            min={1}
                            max={247}
                            disabled={!isEditing}
                            onChange={e => setGlobalSettings({ ...globalSettings, slaveId: parseInt(e.target.value) })}
                            className="w-full bg-slate-800/50 border border-slate-600/50 rounded px-3 py-2 text-white font-mono disabled:opacity-50"
                        />
                        <span className="text-slate-500 text-[10px]">Range: 1-247</span>
                    </div>
                    <div>
                        <label className="text-slate-400 text-xs block mb-1">Timeout (ms)</label>
                        <input
                            type="number"
                            value={globalSettings.timeoutMs}
                            disabled={!isEditing}
                            onChange={e => setGlobalSettings({ ...globalSettings, timeoutMs: parseInt(e.target.value) })}
                            className="w-full bg-slate-800/50 border border-slate-600/50 rounded px-3 py-2 text-white font-mono disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="text-slate-400 text-xs block mb-1">Scan Rate (ms)</label>
                        <input
                            type="number"
                            value={globalSettings.scanRateMs}
                            disabled={!isEditing}
                            onChange={e => setGlobalSettings({ ...globalSettings, scanRateMs: parseInt(e.target.value) })}
                            className="w-full bg-slate-800/50 border border-slate-600/50 rounded px-3 py-2 text-white font-mono disabled:opacity-50"
                        />
                    </div>
                </div>
            </div>

            {/* Register Table Controls */}
            <div className="flex gap-4 mb-4">
                <input
                    type="text"
                    placeholder="🔍 Search by Name or Address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-slate-800/50 border border-slate-600/50 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-cyan-500/50 outline-none"
                />
                <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-600/50">
                    {['All', 'Analog', 'Discrete'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setTypeFilter(type as any)}
                            className={`px-4 py-1 rounded-md text-sm transition-colors ${typeFilter === type
                                    ? 'bg-cyan-500 text-white font-bold'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Register Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-slate-800/50 border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="p-4 w-16">Active</th>
                                <th className="p-4 w-48">Parameter Name</th>
                                <th className="p-4 w-32">Source Priority</th>
                                <th className="p-4 w-24">Modbus Addr</th>
                                <th className="p-4 w-32">Fallback Mode</th>
                                <th className="p-4 w-24 text-right">Manual Val</th>
                                <th className="p-4 w-20">Unit</th>
                                <th className="p-4 w-32 text-right">Live Value</th>
                                <th className="p-4 w-24 text-center">Quality</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredRegisters.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-slate-500">
                                        No registers found matching your search.
                                    </td>
                                </tr>
                            ) : (
                                filteredRegisters.map((reg) => (
                                    <tr key={reg.address} className={`hover:bg-white/5 transition-colors group ${!reg.isActive ? 'opacity-50' : ''}`}>
                                        {/* Active Toggle */}
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={reg.isActive}
                                                disabled={!isEditing}
                                                onChange={(e) => updateRegister(reg.address, 'isActive', e.target.checked)}
                                                className="rounded border-slate-600 bg-slate-700/50 text-cyan-500 focus:ring-offset-0 focus:ring-cyan-500/50"
                                            />
                                        </td>

                                        {/* Name & Desc */}
                                        <td className="p-4 font-medium text-white">
                                            <div className="flex flex-col">
                                                <span>{reg.name}</span>
                                                <span className="text-xs text-slate-500">{reg.description}</span>
                                            </div>
                                        </td>

                                        {/* Source Priority - Strict: Modbus | Manual */}
                                        <td className="p-4">
                                            {isEditing ? (
                                                <select
                                                    value={reg.sourcePriority}
                                                    onChange={(e) => updateRegister(reg.address, 'sourcePriority', e.target.value)}
                                                    className="w-full bg-slate-800/50 border border-slate-600/50 rounded px-2 py-1 text-white text-sm"
                                                >
                                                    <option value="Modbus">Modbus (Live)</option>
                                                    <option value="Manual">Manual Override</option>
                                                </select>
                                            ) : (
                                                <span className={`px-2 py-1 rounded text-xs font-medium border ${reg.sourcePriority === 'Modbus' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                    }`}>
                                                    {reg.sourcePriority}
                                                </span>
                                            )}
                                        </td>

                                        {/* Modbus Address */}
                                        <td className="p-4 font-mono text-cyan-400 text-sm">
                                            {reg.address}
                                        </td>

                                        {/* Fallback Strategy */}
                                        <td className="p-4 text-sm text-slate-300">
                                            {isEditing ? (
                                                <select
                                                    value={reg.fallbackStrategy}
                                                    onChange={(e) => updateRegister(reg.address, 'fallbackStrategy', e.target.value)}
                                                    className="w-full bg-slate-800/50 border border-slate-600/50 rounded px-2 py-1 text-white text-sm"
                                                >
                                                    <option value="HoldLastGood">Hold Last Good</option>
                                                    <option value="Manual">Switch to Manual</option>
                                                </select>
                                            ) : (
                                                <span className="text-xs text-slate-400">{reg.fallbackStrategy.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            )}
                                        </td>

                                        {/* Manual Value */}
                                        <td className="p-4 text-right">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={reg.manualValue}
                                                    onChange={(e) => updateRegister(reg.address, 'manualValue', parseFloat(e.target.value))}
                                                    className="w-24 bg-slate-800/50 border border-slate-600/50 rounded px-2 py-1 text-white text-right"
                                                />
                                            ) : (
                                                <span className="text-slate-400">{reg.manualValue}</span>
                                            )}
                                        </td>

                                        {/* Unit */}
                                        <td className="p-4 text-sm text-slate-400">{reg.unit}</td>

                                        {/* Live Value */}
                                        <td className="p-4 text-right font-mono text-white text-lg font-semibold">
                                            {reg.type === 'Discrete' ? (reg.liveValue ? 'ON' : 'OFF') : reg.liveValue}
                                        </td>

                                        {/* Quality */}
                                        <td className="p-4 text-center">
                                            <span className={`text-xs font-bold ${getStatusColor(reg.quality)} flex items-center justify-center gap-1`}>
                                                <span className={`w-2 h-2 rounded-full ${reg.quality === 'Good' ? 'bg-green-400' : reg.quality === 'Bad' ? 'bg-red-400' : 'bg-blue-400'}`}></span>
                                                {reg.quality.toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                )))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
