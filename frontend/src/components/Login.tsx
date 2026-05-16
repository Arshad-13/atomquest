import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";
import { useAppStore } from "../store/useAppStore";

export const Login = () => {
  const { instance } = useMsal();
  const { toggleTheme, theme } = useAppStore();

  const handleLogin = () => {
    instance.loginPopup(loginRequest).catch(e => {
      console.error("Login failed:", e);
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100 transition-colors duration-300 relative">
      
      {/* Theme Toggle for Login Screen */}
      <button 
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-md bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-100"
      >
        {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
      </button>

      <div className="max-w-md w-full p-8 bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 text-center">
        <div className="w-16 h-16 mx-auto bg-primary-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold mb-6">
          A
        </div>
        <h2 className="text-3xl font-bold text-primary-900 dark:text-primary-100 mb-2">
          AtomQuest Portal
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Sign in with your corporate account to access your goal sheets and check-ins.
        </p>

        <button
          onClick={handleLogin}
          className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg shadow-md transition-colors"
        >
          Sign in with Microsoft
        </button>
      </div>
    </div>
  );
};