/**
 * Layout Component - Main app shell with sidebar navigation
 */
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/compressor', label: 'Compressor', icon: '🔄' },
    { path: '/engine', label: 'Engine', icon: '🔧' },
    { path: '/diagrams', label: 'Diagrams', icon: '📈' },
    { path: '/alarms', label: 'Alarms', icon: '🔔' },
    { path: '/config', label: 'Configuration', icon: '⚙️' },
    { path: '/simulator', label: 'Simulator', icon: '🎮' },
  ];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/80 backdrop-blur-lg border-r border-slate-700/50 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="text-3xl">⚡</div>
            <div>
              <h1 className="text-xl font-bold text-white">GCS Digital Twin</h1>
              <p className="text-xs text-slate-400">Universal Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    }`
                  }
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Unit Status */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Unit</span>
              <span className="text-green-400 text-xs flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Running
              </span>
            </div>
            <div className="text-white font-semibold">GCS-001</div>
            <div className="text-slate-400 text-xs">Ariel JGK/4 + CAT G3516</div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-t border-slate-700/50">
          {user ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white text-sm font-medium">{user.full_name}</div>
                <div className="text-slate-400 text-xs capitalize">{user.role}</div>
              </div>
              <button
                onClick={logout}
                className="text-slate-400 hover:text-white text-sm"
              >
                Logout
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="block text-center py-2 px-4 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
            >
              Sign In
            </NavLink>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
