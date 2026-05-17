import { useState } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { useAppStore } from '../store/useAppStore';
import { msalInstance } from '../msalInstance';
import { loginRequest } from '../authConfig';

export const Login = () => {
  const { register, handleSubmit, formState: { errors } } = useForm({ mode: 'onBlur' });
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSsoLoading, setIsSsoLoading] = useState(false);
  const { setAuth } = useAppStore();

  // ── Password Login (Phase 1 — always available for demo) ──────────────────
  const onSubmit = async (data: any) => {
    setServerError(null);
    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', data.email);
      formData.append('password', data.password);

      const loginResponse = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/auth/login`,
        formData,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const token = loginResponse.data.access_token;
      const meResponse = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAuth(meResponse.data, token);
    } catch (error: any) {
      if (error.response?.status === 401) {
        setServerError('Invalid email or password.');
      } else {
        setServerError('Cannot connect to server. Is the backend running?');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Phase 10: Azure AD SSO Login ──────────────────────────────────────────
  const handleSsoLogin = async () => {
    setServerError(null);
    setIsSsoLoading(true);
    try {
      // loginRedirect navigates the browser to Microsoft login.
      // After authentication, Microsoft redirects back to our app (redirectUri).
      // App.tsx listens for the LOGIN_SUCCESS event and exchanges the token.
      await msalInstance.loginRedirect(loginRequest);
      // Note: code after this line won't run — browser navigates away
    } catch (error: any) {
      console.error('[SSO] loginRedirect error:', error);
      setServerError(`SSO failed: ${error.message || error.name}`);
      setIsSsoLoading(false);
    }
    // Don't call setIsSsoLoading(false) here — page navigates away
  };

  const azureConfigured = !!(
    import.meta.env.VITE_AZURE_CLIENT_ID && import.meta.env.VITE_AZURE_TENANT_ID
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
      <div className="max-w-md w-full p-8 bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg border border-gray-200 dark:border-gray-800">

        <div className="w-16 h-16 mx-auto bg-primary-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold mb-6 shadow-md">
          A
        </div>
        <h2 className="text-3xl font-bold text-center text-primary-900 dark:text-primary-100 mb-2">
          AtomQuest Portal
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
          Sign in to access your goal workspace.
        </p>

        {/* Phase 10: Azure AD SSO Button */}
        {azureConfigured && (
          <>
            <button
              onClick={handleSsoLogin}
              disabled={isSsoLoading}
              className="w-full py-3 px-4 flex items-center justify-center gap-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-60"
            >
              {/* Microsoft "M" logo SVG */}
              <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              {isSsoLoading ? 'Signing in with Microsoft...' : 'Continue with Microsoft'}
            </button>

            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">or use demo account</span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>
          </>
        )}

        {serverError && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm border border-red-200 text-center">
            {serverError}
          </div>
        )}

        {/* Password Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email Address</label>
            <input
              type="email"
              {...register('email', { required: 'Email is required' })}
              className={`w-full p-2.5 rounded-lg bg-background-light dark:bg-background-dark border outline-none focus:ring-2 focus:ring-primary-500 transition-shadow ${errors.email ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300 dark:border-gray-700'}`}
              placeholder="employee@atomquest.com"
            />
            {errors.email && <span className="text-xs text-red-500 mt-1 block">{errors.email.message as string}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
            <input
              type="password"
              {...register('password', { required: 'Password is required' })}
              className={`w-full p-2.5 rounded-lg bg-background-light dark:bg-background-dark border outline-none focus:ring-2 focus:ring-primary-500 transition-shadow ${errors.password ? 'border-red-400 ring-1 ring-red-400' : 'border-gray-300 dark:border-gray-700'}`}
              placeholder="••••••••"
            />
            {errors.password && <span className="text-xs text-red-500 mt-1 block">{errors.password.message as string}</span>}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-lg shadow-md transition-colors"
          >
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-400">
          Demo accounts: employee@ / manager@ / admin@atomquest.com · Password: test1234
        </div>
      </div>
    </div>
  );
};