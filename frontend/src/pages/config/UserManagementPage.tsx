import { useState } from 'react';
import { ConfigHeader } from '../../components/ConfigHeader';

interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'engineer' | 'operator';
  lastActive: string;
  status: 'active' | 'disabled';
}

const initialUsers: User[] = [
  { id: 1, username: 'admin', fullName: 'System Administrator', email: 'admin@gcs.com', role: 'admin', lastActive: '2 min ago', status: 'active' },
  { id: 2, username: 'engineer', fullName: 'Lead Engineer', email: 'eng@gcs.com', role: 'engineer', lastActive: '3 hours ago', status: 'active' },
  { id: 3, username: 'operator1', fullName: 'Shift Operator A', email: 'ops1@gcs.com', role: 'operator', lastActive: '1 day ago', status: 'active' },
];

export function UserManagementPage() {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', fullName: '', email: '', role: 'operator', password: '' });

  const handleAddUser = () => {
    const user: User = {
      id: Math.max(...users.map(u => u.id)) + 1,
      username: newUser.username,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role as any,
      lastActive: 'Never',
      status: 'active'
    };
    setUsers([...users, user]);
    setShowAddModal(false);
    setNewUser({ username: '', fullName: '', email: '', role: 'operator', password: '' });
  };

  const deleteUser = (id: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  return (
    <div className="min-h-screen p-6 relative">
      <ConfigHeader 
        title="User Management" 
        description="Manage system access, roles, and permissions"
        isEditing={false}
        canEdit={false}
        onEditToggle={() => {}}
      />

      {/* Action Bar */}
      <div className="mb-6 flex justify-end">
        <button 
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/20 flex items-center gap-2"
        >
          <span>👤+</span> Add User
        </button>
      </div>

      {/* User Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <div key={user.id} className="glass-card p-6 flex flex-col gap-4 group hover:border-blue-500/30 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                  ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 
                    user.role === 'engineer' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>
                  {user.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-white font-medium">{user.username}</h3>
                  <div className="text-xs text-slate-400">{user.email}</div>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border capitalize
                ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                  user.role === 'engineer' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                {user.role}
              </span>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Full Name</span>
                <span className="text-slate-300">{user.fullName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Last Active</span>
                <span className="text-slate-300">{user.lastActive}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Status</span>
                <span className={user.status === 'active' ? 'text-green-400' : 'text-red-400'}>
                  {user.status === 'active' ? '● Active' : '○ Disabled'}
                </span>
              </div>
            </div>

            <div className="mt-auto pt-4 flex gap-2">
              <button className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-sm transition-colors">
                Reset Pass
              </button>
              <button 
                onClick={() => deleteUser(user.id)}
                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                title="Delete User"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Add New User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs mb-1">Username</label>
                <input 
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Full Name</label>
                <input 
                  value={newUser.fullName}
                  onChange={e => setNewUser({...newUser, fullName: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Email</label>
                <input 
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Role</label>
                <select 
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                >
                  <option value="operator">Operator</option>
                  <option value="engineer">Engineer</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Temporary Password</label>
                <input 
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddUser}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
