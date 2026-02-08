/**
 * AlarmsPage - Real-time alarms with backend integration
 */
import { useState, useEffect } from 'react';
import { useUnit } from '../contexts/UnitContext';
import { fetchActiveAlarms, fetchAlarmsSummary, acknowledgeAlarm, type AlarmActive } from '../lib/api';

export function AlarmsPage() {
    const { unitId } = useUnit();
    const [activeAlarms, setActiveAlarms] = useState<AlarmActive[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'active' | 'history' | 'config'>('active');

    const loadAlarms = async () => {
        try {
            const [alarmsData, summaryData] = await Promise.all([
                fetchActiveAlarms(unitId),
                fetchAlarmsSummary(unitId)
            ]);
            setActiveAlarms(alarmsData.alarms || []);
            setSummary(summaryData);
        } catch (e) {
            console.error('Failed to load alarms:', e);
            // Use demo data
            setActiveAlarms([]);
            setSummary({ total_active: 0, by_level: { LL: 0, L: 0, H: 0, HH: 0 }, shutdown_active: false });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAlarms();
        const interval = setInterval(loadAlarms, 5000);
        return () => clearInterval(interval);
    }, [unitId]);

    const handleAcknowledge = async (alarmId: string) => {
        try {
            await acknowledgeAlarm(alarmId);
            await loadAlarms();
        } catch (e) {
            console.error('Failed to acknowledge:', e);
        }
    };

    const getLevelColor = (level: string) => {
        switch (level) {
            case 'HH': return 'bg-red-500/20 text-red-400 border-red-500/50';
            case 'H': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
            case 'L': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
            case 'LL': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/50';
        }
    };

    return (
        <div className="min-h-screen p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">🚨 Alarms & Safety</h1>
                <p className="text-slate-400 mt-1">Monitor and manage alarms for {unitId}</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <SummaryCard label="Total Active" value={summary?.total_active || 0} color="cyan" />
                <SummaryCard label="HH (Critical)" value={summary?.by_level?.HH || 0} color="red" />
                <SummaryCard label="H (High)" value={summary?.by_level?.H || 0} color="orange" />
                <SummaryCard label="L (Low)" value={summary?.by_level?.L || 0} color="yellow" />
                <SummaryCard label="LL (Low-Low)" value={summary?.by_level?.LL || 0} color="blue" />
            </div>

            {summary?.shutdown_active && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
                    <span className="text-2xl">⛔</span>
                    <div>
                        <div className="text-red-400 font-semibold">SHUTDOWN ACTIVE</div>
                        <div className="text-red-300 text-sm">Critical safety condition detected</div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {(['active', 'history', 'config'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' : 'bg-slate-800/50 text-slate-400'
                            }`}>
                        {t === 'active' ? '🔴 Active' : t === 'history' ? '📋 History' : '⚙️ Configuration'}
                    </button>
                ))}
            </div>

            {/* Active Alarms Tab */}
            {tab === 'active' && (
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Active Alarms</h2>
                    {loading ? (
                        <div className="text-slate-400 py-8 text-center">Loading alarms...</div>
                    ) : activeAlarms.length === 0 ? (
                        <div className="text-green-400 py-8 text-center flex flex-col items-center gap-2">
                            <span className="text-4xl">✓</span>
                            <span>No active alarms</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeAlarms.map(alarm => (
                                <div key={alarm.id} className={`p-4 rounded-lg border ${getLevelColor(alarm.level)} flex items-center justify-between`}>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${getLevelColor(alarm.level)}`}>
                                            {alarm.level}
                                        </span>
                                        <div>
                                            <div className="font-medium">{alarm.parameter}</div>
                                            <div className="text-sm opacity-75">
                                                Value: {alarm.value.toFixed(1)} | Setpoint: {alarm.setpoint.toFixed(1)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs opacity-75">
                                            {new Date(alarm.timestamp).toLocaleTimeString()}
                                        </span>
                                        {!alarm.acknowledged && (
                                            <button onClick={() => handleAcknowledge(alarm.id)}
                                                className="px-3 py-1 bg-slate-700/50 hover:bg-slate-600/50 rounded text-xs">
                                                Acknowledge
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* History Tab */}
            {tab === 'history' && (
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Alarm History (Last 24h)</h2>
                    <div className="text-slate-400 py-8 text-center">
                        Alarm history will be populated from PostgreSQL database
                    </div>
                </div>
            )}

            {/* Config Tab */}
            {tab === 'config' && (
                <div className="glass-card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Alarm Setpoints</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-700/50 text-slate-400 text-left">
                                    <th className="py-2 px-3">Parameter</th>
                                    <th className="py-2 px-3">LL</th>
                                    <th className="py-2 px-3">L</th>
                                    <th className="py-2 px-3">H</th>
                                    <th className="py-2 px-3">HH</th>
                                    <th className="py-2 px-3">Delay (s)</th>
                                    <th className="py-2 px-3">Shutdown</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-300">
                                <SetpointRow param="stg1_discharge_temp" hh={350} h={300} />
                                <SetpointRow param="stg2_discharge_temp" hh={350} h={300} />
                                <SetpointRow param="stg3_discharge_temp" hh={350} h={300} />
                                <SetpointRow param="oil_pressure" ll={20} l={30} shutdown />
                                <SetpointRow param="coolant_temp" hh={220} h={200} shutdown />
                                <SetpointRow param="engine_rpm" hh={1200} h={1100} />
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
    const colors: Record<string, string> = {
        cyan: 'text-cyan-400',
        red: 'text-red-400',
        orange: 'text-orange-400',
        yellow: 'text-yellow-400',
        blue: 'text-blue-400'
    };
    return (
        <div className="glass-card p-4">
            <div className="text-slate-400 text-xs">{label}</div>
            <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
        </div>
    );
}

function SetpointRow({ param, ll, l, h, hh, delay = 10, shutdown = false }: any) {
    return (
        <tr className="border-b border-slate-700/30">
            <td className="py-2 px-3">{param}</td>
            <td className="py-2 px-3">{ll || '-'}</td>
            <td className="py-2 px-3">{l || '-'}</td>
            <td className="py-2 px-3">{h || '-'}</td>
            <td className="py-2 px-3">{hh || '-'}</td>
            <td className="py-2 px-3">{delay}</td>
            <td className="py-2 px-3">{shutdown ? '⚠️ Yes' : 'No'}</td>
        </tr>
    );
}
