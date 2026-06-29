import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Sliders, Shield, Zap, ArrowRight, Sun, Moon } from 'lucide-react';

export const Homepage = () => {
  const { user, theme, toggleTheme } = useAppStore();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden transition-colors duration-300">
      {/* Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-gradient-to-b from-indigo-500/5 via-purple-500/2.5 to-transparent dark:from-indigo-500/10 dark:via-purple-500/5 dark:to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Header / Navbar */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 h-20 flex items-center justify-between border-b border-slate-200 dark:border-white/5">
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-heading font-bold text-lg shadow-md shadow-indigo-600/30">
            Z
          </div>
          <span className="font-heading font-bold text-lg tracking-tight text-slate-900 dark:text-white">ZenithOKR</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500 dark:text-slate-400">
          <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">Features</a>
          <a href="#security" className="hover:text-slate-900 dark:hover:text-white transition-colors">Security</a>
          <a href="#architecture" className="hover:text-slate-900 dark:hover:text-white transition-colors">Architecture</a>
        </nav>

        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-full text-slate-500 dark:text-slate-450 hover:bg-slate-200/50 dark:hover:bg-white/5 transition-colors focus:outline-none flex items-center justify-center"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-slate-650" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {user ? (
            <Link
              to="/dashboard"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/25 transition-all btn-scale flex items-center gap-1.5"
            >
              Go to Workspace <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors">
                Sign In
              </Link>
               <Link
                 to="/login"
                 className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-955 text-sm font-semibold rounded-xl transition-all btn-scale shadow-sm"
               >
                 Get Started
               </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-16 text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs font-semibold rounded-full uppercase tracking-widest">
          <span className="animate-pulse">Enterprise Goal Alignment</span>
        </div>

        <h1 className="text-5xl sm:text-7xl font-heading font-extrabold text-slate-900 dark:text-white tracking-tighter leading-none max-w-4xl mx-auto">
          Align organization execution <br />
          <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
            with absolute precision.
          </span>
        </h1>

        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          ZenithOKR coordinates team objectives, locks weightage allocations, enforces audit logging, and drives active performance feedback under a clean corporate workspace.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
           <Link
             to="/login"
             className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xl shadow-indigo-600/30 transition-all btn-scale flex items-center justify-center gap-2"
           >
             Access Workspace <ArrowRight className="w-4 h-4" />
           </Link>
           <a
             href="#features"
             className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 dark:bg-surface-dark dark:hover:bg-slate-800 dark:text-slate-300 dark:border-white/10 font-semibold rounded-xl transition-all btn-scale shadow-sm"
           >
             Explore Features
           </a>
        </div>
      </section>

       {/* Features Grid */}
       <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-slate-200 dark:border-white/5 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-150">
         <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
           <h2 className="text-3xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">
             Engineered for high-performing teams
           </h2>
           <p className="text-slate-600 dark:text-slate-400 text-sm">
             Everything you need to set, align, track, and audit team objectives in one environment.
           </p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Card 1 */}
           <div className="bg-white dark:bg-surface-dark/80 border border-slate-200 dark:border-white/5 rounded-xl shadow-sm dark:shadow-xl p-8 space-y-4 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-colors group">
             <div className="w-10 h-10 rounded-xl bg-indigo-650/10 dark:bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
               <Sliders className="w-5 h-5" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors font-heading">
               Strict Business Constraints
             </h3>
             <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
               Automated enforcement of a maximum of 8 goals per employee, minimum 10% weightage, and exact 100% total weightage limits.
             </p>
           </div>

           {/* Card 2 */}
           <div className="bg-white dark:bg-surface-dark/80 border border-slate-200 dark:border-white/5 rounded-xl shadow-sm dark:shadow-xl p-8 space-y-4 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-colors group">
             <div className="w-10 h-10 rounded-xl bg-indigo-650/10 dark:bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
               <Shield className="w-5 h-5" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors font-heading">
               Security & SSO Audits
             </h3>
             <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
               Secure HTTP-Only session management, Microsoft Azure AD federated SSO, and immutable chronological database audit logging.
             </p>
           </div>

           {/* Card 3 */}
           <div className="bg-white dark:bg-surface-dark/80 border border-slate-200 dark:border-white/5 rounded-xl shadow-sm dark:shadow-xl p-8 space-y-4 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-colors group">
             <div className="w-10 h-10 rounded-xl bg-indigo-650/10 dark:bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
               <Zap className="w-5 h-5" />
             </div>
             <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors font-heading">
               Active Escalations
             </h3>
             <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
               Integrated background rules engine that automatically detects unsubmitted OKR sheets and logs notifications to managers.
             </p>
           </div>
         </div>
       </section>

       {/* Footer */}
       <footer className="border-t border-slate-200 dark:border-white/5 py-12 text-center text-sm text-slate-500 dark:text-slate-650">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-200 dark:bg-slate-800 rounded flex items-center justify-center text-slate-800 dark:text-white text-xs font-bold font-heading">Z</div>
            <span className="font-bold text-slate-600 dark:text-slate-400 font-heading">ZenithOKR</span>
          </div>
          <p>© {new Date().getFullYear()} ZenithOKR. Enterprise Performance Alignment.</p>
        </div>
      </footer>
    </div>
  );
};
