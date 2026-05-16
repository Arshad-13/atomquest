import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';

function App() {
  const { theme, toggleTheme } = useAppStore();

  // Ensure the document class matches the store on initial load
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="min-h-screen transition-colors duration-300 bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100 font-sans">
      
      {/* Top Navigation Bar */}
      <nav className="w-full h-16 bg-surface-light dark:bg-surface-dark shadow-md flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {/* Mock Logo */}
          <div className="w-8 h-8 rounded bg-primary-600 flex items-center justify-center text-white font-bold">
            A
          </div>
          <h1 className="text-xl font-bold tracking-tight text-primary-900 dark:text-primary-100">
            AtomQuest Portal
          </h1>
        </div>

        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-md bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-100 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors"
        >
          {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="p-8 rounded-xl bg-surface-light dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-800">
          <h2 className="text-2xl font-semibold text-primary-600 dark:text-primary-500 mb-4">
            Welcome to the Workspace
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            This is your styled corporate material container. UI components will render here.
          </p>
        </div>
      </main>

    </div>
  );
}

export default App;