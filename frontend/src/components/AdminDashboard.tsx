import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { PageSkeleton } from './ui/Skeleton';

interface ActiveCycle {
  id: number;
  period_name: string;
  close_date: string;
}

export const AdminDashboard = () => {
  const { user } = useAppStore();
  const { addToast } = useToastStore();
  
  const [loading, setLoading] = useState(true);
  const [activeCycle, setActiveCycle] = useState<ActiveCycle | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const cycleRes = await apiClient.get('/cycles/active').catch(() => ({ data: null }));
      setActiveCycle(cycleRes.data);
    } catch {
      addToast("Failed to load active cycle window", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) return <PageSkeleton statCards rows={4} cols={4} />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-display">Welcome back, {user?.name.split(' ')[0]}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">HR Administration Console — Manage active performance frameworks, directories and overrides.</p>
      </div>

      {activeCycle ? (
        <div className="bg-indigo-50/50 border border-indigo-150 dark:bg-indigo-950/10 dark:border-indigo-900/40 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-indigo-900 dark:text-indigo-200">Active Cycle Window: {activeCycle.period_name}</h4>
              <p className="text-sm text-indigo-700 dark:text-indigo-400">
                Employee submission and review window closes on {new Date(activeCycle.close_date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Link to="/admin/cycles" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] whitespace-nowrap">
            Cycle Manager
          </Link>
        </div>
      ) : (
        <div className="bg-amber-50/50 border border-amber-150 dark:bg-amber-950/10 dark:border-amber-900/40 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-amber-900 dark:text-amber-200">No Active Cycle Window</h4>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                There is currently no open goal-setting or check-in window. Employees cannot log check-ins.
              </p>
            </div>
          </div>
          <Link to="/admin/cycles" className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-amber-600/20 transition-all active:scale-[0.98] whitespace-nowrap">
            Open Cycle Window
          </Link>
        </div>
      )}

      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 font-display">Administrative Control Hub</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <Card className="p-5 flex flex-col justify-between hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-all group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100/50 dark:border-indigo-900/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Goal Cycles</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Configure active windows, review close-out deadlines, and toggle operational frameworks.</p>
          </div>
          <Link to="/admin/cycles" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-4 block">
            Manage Windows →
          </Link>
        </Card>

        {/* Card 2 */}
        <Card className="p-5 flex flex-col justify-between hover:border-red-500/50 dark:hover:border-red-500/30 transition-all group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-100/50 dark:border-red-900/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-red-500 transition-colors">System Overrides</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Force unlock employee goal sheets, push corporate-wide shared goals, or revert cascades with full audit compliance.</p>
          </div>
          <Link to="/admin/overrides" className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline mt-4 block">
            Override Console →
          </Link>
        </Card>

        {/* Card 3 */}
        <Card className="p-5 flex flex-col justify-between hover:border-violet-500/50 dark:hover:border-violet-500/30 transition-all group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-100/50 dark:border-violet-900/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">Directory & Passwords</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Register new employee accounts, assign supervisors, and securely reset local logins in a few clicks.</p>
          </div>
          <Link to="/admin/users" className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline mt-4 block">
            View Directory →
          </Link>
        </Card>

        {/* Card 4 */}
        <Card className="p-5 flex flex-col justify-between hover:border-emerald-500/50 dark:hover:border-emerald-500/30 transition-all group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-900/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Compliance Ledger</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Examine permanent chronological audit trails of all system modifications, unlocks, and password changes.</p>
          </div>
          <Link to="/admin/audit" className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline mt-4 block">
            View Audit Trails →
          </Link>
        </Card>
      </div>

      <Card className="p-6 mt-6">
        <div className="flex justify-between items-center border-b border-gray-150 dark:border-gray-800 pb-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 font-display">Framework Completion Progress</h3>
            <p className="text-xs text-gray-500 mt-0.5">Real-time breakdown of goal-setting submissions across departments.</p>
          </div>
          <Link to="/admin/reports" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
            View Full Reports & Export →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center py-4">
          <div className="border-r border-gray-150 dark:border-gray-800 last:border-0 flex flex-col items-center p-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.003 9.003 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100 font-display">Executive Overview</span>
            <span className="text-xs text-gray-500 mt-1 max-w-[200px]">Interactive bar charts, department heatmaps and metric analyses.</span>
            <Link to="/admin/analytics" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-3 block">Analyze Trends →</Link>
          </div>
          <div className="border-r border-gray-150 dark:border-gray-800 last:border-0 flex flex-col items-center p-2">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100 font-display">Escalation Center</span>
            <span className="text-xs text-gray-500 mt-1 max-w-[200px]">Configure warning rules and track auto-alerts for overdue submissions.</span>
            <Link to="/admin/escalation" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-3 block">Configure Rules →</Link>
          </div>
          <div className="flex flex-col items-center p-2">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100 font-display">SSO Integration</span>
            <span className="text-xs text-gray-500 mt-1 max-w-[200px]">Manage corporate directories and federated logins under Azure AD.</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-3 block">SSO Active</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
