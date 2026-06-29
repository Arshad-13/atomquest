import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAppStore } from '../store/useAppStore';
import { msalInstance } from '../msalInstance';
import { loginRequest } from '../authConfig';
import { apiClient } from '../api/client';
import { AlertCircle } from 'lucide-react';

export const Login = () => {
  const { register, handleSubmit, setValue, formState: { errors } } = useForm({ mode: 'onBlur' });
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSsoLoading, setIsSsoLoading] = useState(false);
  const { setAuth } = useAppStore();

  const handleDemoFill = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'test1234', { shouldValidate: true });
  };

  async function onSubmit(data: any) {
    setServerError(null);
    setIsLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', data.email);
      formData.append('password', data.password);

      const res = await apiClient.post(
        '/auth/login',
        formData,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const token = res.data.access_token;
      const meResponse = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
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
  }

  async function handleSsoLogin() {
    setServerError(null);
    setIsSsoLoading(true);
    try {
      await msalInstance.loginRedirect(loginRequest);
    } catch (error: any) {
      console.error('[SSO] loginRedirect error:', error);
      setServerError(`SSO failed: ${error.message || error.name}`);
      setIsSsoLoading(false);
    }
  }

  const azureConfigured = !!(
    import.meta.env.VITE_AZURE_CLIENT_ID && import.meta.env.VITE_AZURE_TENANT_ID
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-500/30">
      {/* Left Column: Authentic Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 xl:p-16 animate-in fade-in slide-in-from-left duration-500">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-display text-xl font-bold shadow-md shadow-indigo-600/30">
            Z
          </div>
          <span className="font-display font-bold text-lg text-slate-800 dark:text-slate-100">ZenithOKR</span>
        </div>

        {/* Form Container */}
        <div className="max-w-md w-full mx-auto my-auto py-12">
          <div className="space-y-2 mb-8">
            <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign in to manage goals, align check-ins, and track team performance.
            </p>
          </div>

          {/* Microsoft SSO Button */}
          {azureConfigured && (
            <>
              <button
                onClick={handleSsoLogin}
                disabled={isSsoLoading}
                className="w-full py-3 px-4 flex items-center justify-center gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-xl shadow-sm transition-all hover:shadow-md disabled:opacity-60"
              >
                <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                {isSsoLoading ? 'Authenticating with Microsoft...' : 'Continue with Microsoft SSO'}
              </button>

              <div className="my-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-widest scale-95">or use demo login</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>
            </>
          )}

          {serverError && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 dark:bg-rose-950/10 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-medium flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4" />
              {serverError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                Email Address
              </label>
              <input
                type="email"
                {...register('email', { required: 'Email is required' })}
                className={`w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                  errors.email ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-800'
                }`}
                placeholder="employee@example.com"
              />
              {errors.email && <span className="text-xs text-rose-500 mt-1 block">{errors.email.message as string}</span>}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                Password
              </label>
              <input
                type="password"
                {...register('password', { required: 'Password is required' })}
                className={`w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                  errors.password ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-800'
                }`}
                placeholder="••••••••"
              />
              {errors.password && <span className="text-xs text-rose-500 mt-1 block">{errors.password.message as string}</span>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none active:scale-[0.99]"
            >
              {isLoading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* Quick Demo Helper */}
          <div className="mt-8 space-y-3">
            <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest text-center">Quick Demo Login</h4>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { role: 'Admin', email: 'admin@example.com', color: 'hover:border-purple-500 hover:ring-purple-500/10 hover:bg-purple-50/50 dark:hover:bg-purple-950/10' },
                { role: 'Manager', email: 'manager@example.com', color: 'hover:border-green-500 hover:ring-green-500/10 hover:bg-green-50/50 dark:hover:bg-green-950/10' },
                { role: 'Employee', email: 'employee@example.com', color: 'hover:border-blue-500 hover:ring-blue-500/10 hover:bg-blue-50/50 dark:hover:bg-blue-950/10' }
              ].map(d => (
                <button
                  key={d.role}
                  type="button"
                  onClick={() => handleDemoFill(d.email)}
                  className={`p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-left transition-all hover:shadow-md hover:ring-4 active:scale-[0.98] outline-none ${d.color}`}
                >
                  <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{d.role}</span>
                  <span className="block text-[10px] text-slate-550 truncate mt-0.5">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-600">
          © {new Date().getFullYear()} ZenithOKR. All rights reserved.
        </div>
      </div>

      {/* Right Column: Premium Immersive Sidepanel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 justify-center items-center p-12">
        {/* Glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

        {/* Content Container */}
        <div className="relative max-w-lg text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
          <div className="space-y-4">
            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-semibold rounded-full uppercase tracking-widest">
              OKR Management Platform
            </span>
            <h2 className="text-4xl xl:text-5xl font-display font-extrabold text-white leading-tight tracking-tight">
              Aligning execution with high-precision objectives.
            </h2>
            <p className="text-base text-slate-300 leading-relaxed max-w-md mx-auto">
              ZenithOKR integrates organization-wide goals, manager approval workflows, and active timelines under a unified visual workspace.
            </p>
          </div>

          {/* Testimonial Widget */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl text-left shadow-2xl">
            <p className="text-sm italic text-slate-200 mb-4">
              "ZenithOKR has completely transformed how our teams collaborate and align their goals. Weightages are dynamically adjusted and cascades are simple to execute."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white text-xs">
                JD
              </div>
              <div>
                <p className="text-xs font-bold text-white">Jane Doe</p>
                <p className="text-[10px] text-slate-400">Head of Operations</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};