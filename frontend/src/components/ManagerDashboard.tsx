import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { PageSkeleton } from './ui/Skeleton';
import { Users } from 'lucide-react';


interface ActiveCycle {
  id: number;
  period_name: string;
  close_date: string;
}

interface DashboardGoal {
  id: number;
  title: string;
  thrust_area: string;
  weightage: number;
  is_locked: boolean;
  status: string;
}

interface ManagerTeamMember {
  id: string;
  name: string;
  role: string;
  total_weightage: number;
  is_locked: boolean;
}

interface ManagerAnalyticsData {
  bar_data: Array<Record<string, unknown>>;
  heatmap_data: Array<Record<string, unknown>>;
}

export const ManagerDashboard = () => {
  const { user } = useAppStore();
  const { addToast } = useToastStore();
  
  const [loading, setLoading] = useState(true);
  const [activeCycle, setActiveCycle] = useState<ActiveCycle | null>(null);
  const [teamGoals, setTeamGoals] = useState<DashboardGoal[]>([]);
  const [teamMembers, setTeamMembers] = useState<ManagerTeamMember[]>([]);
  const [teamAnalytics, setTeamAnalytics] = useState<ManagerAnalyticsData | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const cycleRes = await apiClient.get('/cycles/active').catch(() => ({ data: null }));
      setActiveCycle(cycleRes.data);
      
      const [teamGoalsRes, teamMembersRes, analyticsRes] = await Promise.all([
        apiClient.get(`/managers/${user.id}/team-goals`),
        apiClient.get(`/managers/${user.id}/team`),
        apiClient.get(`/managers/${user.id}/analytics`).catch(() => ({ data: null }))
      ]);
      setTeamGoals(teamGoalsRes.data);
      setTeamMembers(teamMembersRes.data);
      setTeamAnalytics(analyticsRes.data);
    } catch {
      addToast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, [user, addToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) return <PageSkeleton statCards rows={4} cols={4} />;

  const directReports = teamMembers.length;
  const lockedReports = teamMembers.filter(member => member.is_locked).length;
  const balancedReports = teamMembers.filter(member => member.total_weightage === 100).length;
  const needsAttention = teamMembers.filter(member => !member.is_locked || member.total_weightage !== 100).length;
  const pendingReviews = teamGoals.filter(goal => !goal.is_locked && goal.status === 'submitted').length;
  const submittedSheets = Array.from(new Set(teamGoals.filter(goal => !goal.is_locked && goal.status === 'submitted').map(goal => goal.id))).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-display">Welcome back, {user?.name.split(' ')[0]}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Team management console — review submissions, lock balanced sheets, and track direct report health.</p>
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
              <p className="text-sm text-indigo-700 dark:text-indigo-400">Manager review and submission cycle closes on {new Date(activeCycle.close_date).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/team" className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] whitespace-nowrap">Open Team Goals</Link>
            <Link to="/approvals" className="px-4 py-2.5 bg-white hover:bg-gray-50 text-indigo-700 text-sm font-semibold rounded-xl border border-indigo-200 transition-all active:scale-[0.98] whitespace-nowrap dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-indigo-400 dark:border-slate-800">Team Reviews</Link>
          </div>
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
              <p className="text-sm text-amber-700 dark:text-amber-400">You can still review team history, but approval and check-in activity is paused until the next cycle opens.</p>
            </div>
          </div>
          <Link to="/team" className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-amber-600/20 transition-all active:scale-[0.98] whitespace-nowrap">Review Team Sheets</Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5 flex flex-col justify-center"><p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Direct Reports</p><p className="text-3xl font-bold text-gray-900 dark:text-white">{directReports}</p></Card>
        <Card className="p-5 flex flex-col justify-center"><p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Balanced Sheets</p><div className="flex items-end gap-2"><p className="text-3xl font-bold text-green-600 dark:text-green-400">{balancedReports}</p><span className="text-sm text-gray-500 mb-1">/ {directReports}</span></div></Card>
        <Card className="p-5 flex flex-col justify-center"><p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Pending Reviews</p><p className="text-3xl font-bold text-amber-600 dark:text-amber-500">{pendingReviews}</p></Card>
        <Card className="p-5 flex flex-col justify-center"><p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Needs Attention</p><p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{needsAttention}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 font-display">Team Review Queue</h3>
              <p className="text-xs text-gray-500 mt-0.5">Quick access to submitted goal sheets and rework requests.</p>
            </div>
            <Link to="/approvals" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Open Reviews →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center py-2">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100/50 dark:border-slate-800/40 flex flex-col items-center">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 block">{teamGoals.length}</span>
              <span className="text-xs text-gray-500 mt-0.5">Total goals in scope</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100/50 dark:border-slate-800/40 flex flex-col items-center">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 block">{submittedSheets}</span>
              <span className="text-xs text-gray-500 mt-0.5">Sheets awaiting lock</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100/50 dark:border-slate-800/40 flex flex-col items-center">
              <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 block">{lockedReports}</span>
              <span className="text-xs text-gray-500 mt-0.5">Reports fully locked</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 font-display">Team Health Snapshot</h3>
              <p className="text-xs text-gray-500 mt-0.5">Balanced sheets, goal totals, and readiness at a glance.</p>
            </div>
            <Link to="/team" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Open Team Goals →</Link>
          </div>
          <div className="space-y-3">
            {teamMembers.slice(0, 5).map(member => (
              <div key={member.id} className="flex items-center justify-between rounded-xl border border-slate-100/50 dark:border-slate-800/40 px-4 py-3 bg-slate-50/50 dark:bg-slate-900/30">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.is_locked ? 'Sheet locked' : 'Sheet open'} · {member.total_weightage}% allocated</p>
                </div>
                <Badge variant={member.total_weightage === 100 ? 'success' : 'warning'}>{member.total_weightage === 100 ? 'Ready' : 'Review'}</Badge>
              </div>
            ))}
            {teamMembers.length === 0 && <EmptyState icon={<Users className="w-8 h-8 text-indigo-500" />} title="No direct reports found" description="Team members will appear here once manager relationships are assigned." />}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 flex flex-col justify-between hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-all group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100/50 dark:border-indigo-900/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Team Goals</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Review sheets, adjust inline weightage, and lock approved goals.</p>
          </div>
          <Link to="/team" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-4 block">Open Goal Workspace →</Link>
        </Card>
        <Card className="p-5 flex flex-col justify-between hover:border-emerald-500/50 dark:hover:border-emerald-500/30 transition-all group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-900/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Team Reviews</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Add check-in notes, track progress, and resolve pending quarterly submissions.</p>
          </div>
          <Link to="/approvals" className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline mt-4 block">Open Review Queue →</Link>
        </Card>
        <Card className="p-5 flex flex-col justify-between hover:border-violet-500/50 dark:hover:border-violet-500/30 transition-all group">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-100/50 dark:border-violet-900/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">Shared Goal Cascade</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Distribute a shared objective across direct reports from one workspace.</p>
          </div>
          <Link to="/team" className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline mt-4 block">Launch Cascade →</Link>
        </Card>
      </div>

      {teamAnalytics && (
        <Card className="p-6">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 font-display">Team Trend Summary</h3>
              <p className="text-xs text-gray-500 mt-0.5">Average scores and quarterly completion heatmaps for direct reports.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50/60 dark:bg-gray-900/30">
              <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Top Team Averages</p>
              <div className="space-y-2">
                {teamAnalytics.bar_data.slice(0, 4).map((row) => {
                  const typedRow = row as { name?: string; avgScore?: number };
                  return <div key={typedRow.name} className="flex items-center justify-between"><span>{typedRow.name}</span><span className="font-semibold text-indigo-600 dark:text-indigo-400">{typedRow.avgScore}%</span></div>;
                })}
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50/60 dark:bg-gray-900/30">
              <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Quarter Completion Heatmap</p>
              <div className="space-y-2">
                {teamAnalytics.heatmap_data.slice(0, 3).map((row) => {
                  const typedRow = row as { name?: string; Q1?: number; Q2?: number; Q3?: number; Q4?: number };
                  return <div key={typedRow.name} className="flex items-center justify-between text-xs"><span>{typedRow.name}</span><span className="font-semibold text-gray-700 dark:text-gray-200">Q1 {typedRow.Q1 ?? 0}% · Q2 {typedRow.Q2 ?? 0}% · Q3 {typedRow.Q3 ?? 0}% · Q4 {typedRow.Q4 ?? 0}%</span></div>;
                })}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
