import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
// import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { Login } from './components/Login';
import { GoalForm } from './components/GoalForm'; // <--- Import the form

function App() {
  const { theme, toggleTheme } = useAppStore();
  const isAuthenticated = true; // DEV MODE: Hardcoded
  const { accounts, instance } = useMsal();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleLogout = () => {
    // In dev mode, this won't do much, but keep it wired up
    instance.logoutPopup({ postLogoutRedirectUri: "/", mainWindowRedirectUri: "/" });
  };

  if (!isAuthenticated) return <Login />;

  const userName = accounts.length > 0 ? accounts[0].name : "Dev User";

  return (
    <div className="min-h-screen transition-colors duration-300 bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100 font-sans">
      
      {/* Top Nav (Same as before) */}
      <nav className="w-full h-16 bg-surface-light dark:bg-surface-dark shadow-md flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary-600 flex items-center justify-center text-white font-bold">A</div>
          <h1 className="text-xl font-bold tracking-tight text-primary-900 dark:text-primary-100">AtomQuest Portal</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Welcome, {userName}</span>
          <button onClick={toggleTheme} className="p-2 rounded-md bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-100">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button onClick={handleLogout} className="px-4 py-2 text-sm text-red-600 border border-red-200 dark:border-red-900/50 rounded-md">
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="p-8 rounded-xl bg-surface-light dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-800">
          <h2 className="text-2xl font-semibold text-primary-600 dark:text-primary-500">Employee Workspace</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage your quarterly goals and track achievements.</p>
          
          
          <GoalForm />
          
        </div>
      </main>

    </div>
  );
}

export default App;