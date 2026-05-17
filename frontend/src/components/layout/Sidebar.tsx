import { NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';

export const Sidebar = () => {
  const { user, logout } = useAppStore();
  const role = user?.role || 'employee';
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Base navigation for everyone (Paths updated to match new App.tsx router)
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', roles: ['employee', 'manager', 'admin'] },
    { label: 'My Goals', path: '/goals', roles: ['employee', 'manager', 'admin'] },
    { label: 'Check-ins', path: '/checkins', roles: ['employee', 'manager', 'admin'] },
  ];

  // Manager-specific navigation
  if (role === 'manager' || role === 'admin') {
    navItems.push(
      { label: 'Team Goals', path: '/team', roles: ['manager', 'admin'] },
      { label: 'Approvals', path: '/approvals', roles: ['manager', 'admin'] }
    );
  }

  // Admin-specific navigation layout mapping
  if (role === 'admin') {
    navItems.push(
      { label: 'Cycle Config', path: '/admin/cycles', roles: ['admin'] },
      { label: 'System Analytics', path: '/admin/analytics', roles: ['admin'] },
      { label: 'Reports', path: '/admin/reports', roles: ['admin'] },
      { label: 'Escalation Rules', path: '/admin/escalation', roles: ['admin'] },
      { label: 'Overrides', path: '/admin/overrides', roles: ['admin'] },
      { label: 'Audit Log', path: '/admin/audit', roles: ['admin'] },
      { label: 'Employee Directory', path: '/admin/users', roles: ['admin'] }
    );
  }

  return (
    <aside className="w-64 h-screen bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-gray-800 flex flex-col transition-colors duration-300 flex-shrink-0">
      {/* Brand Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
        <div className="w-8 h-8 rounded bg-primary-600 flex items-center justify-center text-white font-bold mr-3 shadow-md">
          A
        </div>
        <h1 className="text-xl font-bold tracking-tight text-primary-900 dark:text-primary-100">
          AtomQuest
        </h1>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        <p className="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Menu
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom User Role Badge */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">Current Role</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
            {role}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
};