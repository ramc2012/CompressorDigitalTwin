/**
 * Modbus Mapping Page
 * Configure Modbus registers for the unit.
 */
import { useState, useEffect } from 'react';
import { ConfigHeader } from '../../components/ConfigHeader';
import { useUnit } from '../../contexts/UnitContext';
import { fetchModbusConfig, updateModbusConfig } from '../../lib/api';

interface RegisterMapping {
    address: number;
    name: string;
    description: string;
    unit: string;
    scale: number;
    offset: number;
    dataType: string;
    category: string;
    pollGroup: string;
}

export function ModbusMappingPage() {
    const { unitId } = useUnit();
    const [isEditing, setIsEditing] = useState(false);
    const [config, setConfig] = useState<any>({ registers: [] });
    const [registers, setRegisters] = useState<RegisterMapping[]>([]);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [filter, setFilter] = useState('');

    useEffect(() => {
        loadConfig();
    }, [unitId]);

    const loadConfig = async () => {
        try {
            const data = await fetchModbusConfig();
            setConfig(data);
            setRegisters(data.registers || []);
        } catch (e) {
            console.error('Failed to load Modbus config:', e);
        }
    };

    const handleSave = async () => {
        setSaveStatus('idle');
        try {
            await updateModbusConfig({ ...config, registers });
            setSaveStatus('success');
            setIsEditing(false);
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) {
            setSaveStatus('error');
            console.error('Save failed:', e);
        }
    };

    const updateRegister = (index: number, field: keyof RegisterMapping, value: any) => {
        const newRegs = [...registers];
        newRegs[index] = { ...newRegs[index], [field]: value };
        setRegisters(newRegs);
    };

    const filteredRegisters = registers.filter(r =>
        r.name.toLowerCase().includes(filter.toLowerCase()) ||
        r.description.toLowerCase().includes(filter.toLowerCase()) ||
        r.address.toString().includes(filter)
    );

    return (
        <div className="min-h-screen p-6">
            <ConfigHeader
                title="Modbus Register Mapping"
                description={`Configure Modbus registers for ${unitId}`}
                isEditing={isEditing}
                onEditToggle={() => setIsEditing(!isEditing)}
                onSave={handleSave}
            />

            {saveStatus === 'success' && (
                <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
                    ✓ Configuration saved
                </div>
            )}
            {saveStatus === 'error' && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    ✗ Failed to save configuration
                </div>
            )}

            <div className="glass-card p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-white">Registers ({registers.length})</h2>
                    <input
                        type="text"
                        placeholder="Search registers..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-700/50 text-left">
                                <th className="p-2">Addr</th>
                                <th className="p-2">Name</th>
                                <th className="p-2">Description</th>
                                <th className="p-2">Unit</th>
                                <th className="p-2">Scale</th>
                                <th className="p-2">Offset</th>
                                <th className="p-2">Type</th>
                                <th className="p-2">Group</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-300">
                            {filteredRegisters.length === 0 ? (
                                <tr><td colSpan={8} className="p-4 text-center text-slate-500">No registers found</td></tr>
                            ) : filteredRegisters.map((reg, originalIndex) => {
                                // Find actual index in main array for editing
                                const index = registers.indexOf(reg);
                                return (
                                    <tr key={index} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                value={reg.address}
                                                disabled={!isEditing}
                                                onChange={(e) => updateRegister(index, 'address', parseInt(e.target.value))}
                                                className="w-16 bg-transparent border-none focus:ring-1 focus:ring-cyan-500 rounded px-1"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                value={reg.name}
                                                disabled={!isEditing}
                                                onChange={(e) => updateRegister(index, 'name', e.target.value)}
                                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-cyan-500 rounded px-1"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                value={reg.description || ''}
                                                disabled={!isEditing}
                                                onChange={(e) => updateRegister(index, 'description', e.target.value)}
                                                className="w-full bg-transparent border-none focus:ring-1 focus:ring-cyan-500 rounded px-1"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                value={reg.unit || ''}
                                                disabled={!isEditing}
                                                onChange={(e) => updateRegister(index, 'unit', e.target.value)}
                                                className="w-16 bg-transparent border-none focus:ring-1 focus:ring-cyan-500 rounded px-1"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                value={reg.scale}
                                                disabled={!isEditing}
                                                onChange={(e) => updateRegister(index, 'scale', parseFloat(e.target.value))}
                                                className="w-16 bg-transparent border-none focus:ring-1 focus:ring-cyan-500 rounded px-1"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                type="number"
                                                value={reg.offset}
                                                disabled={!isEditing}
                                                onChange={(e) => updateRegister(index, 'offset', parseFloat(e.target.value))}
                                                className="w-16 bg-transparent border-none focus:ring-1 focus:ring-cyan-500 rounded px-1"
                                            />
                                        </td>
                                        <td className="p-2">
                                            <select
                                                value={reg.dataType}
                                                disabled={!isEditing}
                                                onChange={(e) => updateRegister(index, 'dataType', e.target.value)}
                                                className="bg-transparent border-none focus:ring-1 focus:ring-cyan-500 rounded px-1 text-xs"
                                            >
                                                <option value="uint16">UINT16</option>
                                                <option value="int16">INT16</option>
                                                <option value="uint32">UINT32</option>
                                                <option value="float32">FLOAT32</option>
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input
                                                value={reg.pollGroup}
                                                disabled={!isEditing}
                                                onChange={(e) => updateRegister(index, 'pollGroup', e.target.value)}
                                                className="w-10 bg-transparent border-none focus:ring-1 focus:ring-cyan-500 rounded px-1 text-center"
                                            />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
