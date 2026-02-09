/**
 * ConfigPage - System configuration hub
 * Updated: Added Alarm Configuration tile
 */
import { Link } from 'react-router-dom';
import { useUnit } from '../contexts/UnitContext';

const CONFIG_SECTIONS = [
    {
        id: 'equipment',
        title: 'Equipment Specs',
        description: 'Compressor & Engine mechanical specifications',
        icon: '⚙️',
        path: '/config/equipment',
        color: 'from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30'
    },
    {
        id: 'gas',
        title: 'Gas Properties',
        description: 'Gas composition and properties configuration',
        icon: '🧪',
        path: '/config/gas',
        color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30'
    },
    {
        id: 'site',
        title: 'Site Conditions',
        description: 'Atmospheric conditions and cooling parameters',
        icon: '🌍',
        path: '/config/site',
        color: 'from-amber-500/20 to-orange-500/20 text-orange-400 border-orange-500/30'
    },
    {
        id: 'alarms',
        title: 'Alarm Setpoints',
        description: 'Configure alarm thresholds and delays',
        icon: '🚨',
        path: '/config/alarms',
        color: 'from-red-500/20 to-rose-500/20 text-red-400 border-red-500/30'
    },
    {
        id: 'modbus',
        title: 'Modbus Mapping',
        description: 'Map Modbus registers to system parameters',
        icon: '🔌',
        path: '/config/modbus',
        color: 'from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30'
    },
    {
        id: 'users',
        title: 'User Management',
        description: 'Manage users, roles and access permissions',
        icon: '👥',
        path: '/config/users',
        color: 'from-slate-500/20 to-gray-500/20 text-slate-400 border-slate-500/30'
    }
];

export function ConfigPage() {
    const { unitId } = useUnit();

    return (
        <div className="min-h-screen p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">⚙️ System Configuration</h1>
                <p className="text-slate-400 mt-1">Configure parameters for {unitId}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {CONFIG_SECTIONS.map(section => (
                    <Link 
                        key={section.id} 
                        to={section.path}
                        className={`block p-6 rounded-xl border transition-all hover:-translate-y-1 hover:shadow-lg bg-gradient-to-br ${section.color}`}
                    >
                        <div className="text-4xl mb-4">{section.icon}</div>
                        <h2 className="text-xl font-bold mb-2 text-white">{section.title}</h2>
                        <p className="text-sm opacity-80">{section.description}</p>
                    </Link>
                ))}
            </div>
            
            <div className="mt-8 p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">ℹ️</span>
                    <div>
                        <h3 className="text-white font-medium">Configuration Note</h3>
                        <p className="text-sm text-slate-400">
                            Changes to configuration may require a service restart to take full effect.
                            Verify all parameters before saving.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
