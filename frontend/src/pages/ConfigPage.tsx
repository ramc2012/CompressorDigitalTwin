/**
 * ConfigPage - Main configuration hub with navigation to sub-pages
 */
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export function ConfigPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canEdit = user?.role === 'admin' || user?.role === 'engineer';

  const configSections = [
    {
      id: 'equipment',
      title: 'Equipment Specifications',
      description: 'Compressor cylinders, engine specs, coupling configuration',
      icon: '⚙️',
      path: '/config/equipment',
      color: 'cyan'
    },
    {
      id: 'gas',
      title: 'Gas Properties',
      description: 'Specific gravity, molecular weight, k-values, Z-factors, composition',
      icon: '⛽',
      path: '/config/gas',
      color: 'green'
    },
    {
      id: 'site',
      title: 'Site Conditions',
      description: 'Elevation, barometric pressure, ambient temperatures, cooler approach',
      icon: '🏭',
      path: '/config/site',
      color: 'blue'
    },
    {
      id: 'alarms',
      title: 'Alarm Setpoints',
      description: 'High/Low limits, shutdown values, deadbands, delays',
      icon: '🔔',
      path: '/alarms',
      color: 'amber'
    },
    {
      id: 'modbus',
      title: 'Modbus Register Mapping',
      description: 'Data source configuration, register addresses, scaling factors',
      icon: '📋',
      path: '/config/modbus',
      color: 'purple'
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'Operator, engineer, and admin roles and permissions',
      icon: '👤',
      path: '/config/users',
      color: 'slate'
    }
  ];

  return (
    <div className="min-h-screen p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Configuration</h1>
        <p className="text-slate-400">System settings and equipment parameters</p>
      </header>

      {/* Config Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {configSections.map((section) => (
          <button
            key={section.id}
            onClick={() => navigate(section.path)}
            className={`glass-card p-6 text-left transition-all hover:scale-[1.02] hover:border-${section.color}-500/50 group`}
          >
            <div className="flex items-start gap-4">
              <div className={`text-4xl`}>{section.icon}</div>
              <div className="flex-1">
                <h3 className={`text-xl font-semibold text-white group-hover:text-${section.color}-400 transition-colors`}>
                  {section.title}
                </h3>
                <p className="text-slate-400 text-sm mt-1">{section.description}</p>
              </div>
              <div className="text-slate-500 group-hover:text-white transition-colors">
                →
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick Access - Simulator Dashboard */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-white mb-4">Development Tools</h2>
        <button
          onClick={() => navigate('/simulator')}
          className="glass-card p-6 w-full text-left transition-all hover:scale-[1.01] hover:border-orange-500/50 group bg-gradient-to-r from-slate-800/80 to-orange-900/20"
        >
          <div className="flex items-center gap-4">
            <div className="text-4xl">🎮</div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white group-hover:text-orange-400 transition-colors">
                Modbus Simulator Dashboard
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                Manually control register values to test the Digital Twin application. 
                Includes presets, auto-simulation, and real-time value adjustment.
              </p>
            </div>
            <div className="text-slate-500 group-hover:text-white transition-colors text-2xl">
              →
            </div>
          </div>
        </button>
      </div>

      {/* Permission Notice */}
      {!canEdit && user && (
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm">
          ⚠️ Your role ({user.role}) has read-only access. Engineer or Admin access required to modify settings.
        </div>
      )}

      {/* System Status Summary */}
      <div className="glass-card p-6 mt-8 bg-gradient-to-r from-slate-800/50 to-slate-700/30">
        <h2 className="text-lg font-semibold text-white mb-4">Current Configuration Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-slate-800/50 p-3 rounded-lg">
            <div className="text-slate-400">Compressor</div>
            <div className="text-white font-medium">Ariel JGK/4</div>
            <div className="text-slate-500 text-xs">3 Stages</div>
          </div>
          <div className="bg-slate-800/50 p-3 rounded-lg">
            <div className="text-slate-400">Engine</div>
            <div className="text-white font-medium">CAT G3516</div>
            <div className="text-slate-500 text-xs">1500 HP</div>
          </div>
          <div className="bg-slate-800/50 p-3 rounded-lg">
            <div className="text-slate-400">Gas</div>
            <div className="text-white font-medium">Natural Gas</div>
            <div className="text-slate-500 text-xs">SG: 0.65</div>
          </div>
          <div className="bg-slate-800/50 p-3 rounded-lg">
            <div className="text-slate-400">Data Source</div>
            <div className="text-green-400 font-medium">Simulator Mode</div>
            <div className="text-slate-500 text-xs">Modbus Disabled</div>
          </div>
        </div>
      </div>
    </div>
  );
}
