import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { PageSkeleton, ErrorCard } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { useToastStore } from '../store/useToastStore';

// Types matching backend schemas
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
  return_comment?: string;
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

export const DashboardPage = () => {
  const { user } = useAppStore();
  const { addToast } = useToastStore();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<ActiveCycle | null>(null);
  const [goals, setGoals] = useState<DashboardGoal[]>([]);
  const [profile, setProfile] = useState<{ manager_name: string | null } | null>(null);
  const [teamMembers, setTeamMembers] = useState<ManagerTeamMember[]>([]);
  const [teamGoals, setTeamGoals] = useState<DashboardGoal[]>([]);
  const [teamAnalytics, setTeamAnalytics] = useState<ManagerAnalyticsData | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const cycleRes = await apiClient.get('/cycles/active').catch(() => ({ data: null }));
      setActiveCycle(cycleRes.data);
      
      // Personal goals are only fetched/relevant for employees.
      if (user.role === 'employee') {
        const [goalsRes, profileRes] = await Promise.all([
          apiClient.get(`/goals/${user?.id}`),
          apiClient.get(`/employees/${user?.id}/profile`).catch(() => ({ data: { manager_name: null } }))
        ]);
        setGoals(goalsRes.data);
        setProfile(profileRes.data);
        setTeamMembers([]);
        setTeamGoals([]);
        setTeamAnalytics(null);
      } else if (user.role === 'manager') {
        const [teamGoalsRes, teamMembersRes, analyticsRes] = await Promise.all([
          apiClient.get(`/managers/${user.id}/team-goals`),
          apiClient.get(`/managers/${user.id}/team`),
          apiClient.get(`/managers/${user.id}/analytics`).catch(() => ({ data: null }))
        ]);
        setTeamGoals(teamGoalsRes.data);
        setTeamMembers(teamMembersRes.data);
        setTeamAnalytics(analyticsRes.data);
        setGoals([]);
        setProfile(null);
      } else {
        setGoals([]);
        setProfile(null);
        setTeamMembers([]);
        setTeamGoals([]);
        setTeamAnalytics(null);
      }
    } catch {
      setError('Failed to load dashboard data. Please check your connection.');
      addToast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, [user, addToast]);

  const submitGoalForApproval = async (goalId: number) => {
    setProcessingId(goalId);
    try {
      await apiClient.post(`/goals/${goalId}/submit`);
      addToast("Goal submitted for manager review!", "success");
      fetchDashboardData();
    } catch {
      addToast("Failed to submit.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const deleteGoal = async (goalId: number) => {
    if (!window.confirm("Are you sure you want to delete this goal?")) return;
    setProcessingId(goalId);
    try {
      await apiClient.delete(`/goals/${goalId}`);
      addToast("Goal deleted.", "success");
      fetchDashboardData();
    } catch {
      addToast("Failed to delete.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    // This hydrates the dashboard from the current session on mount and refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) return <PageSkeleton statCards rows={4} cols={4} />;
  if (error) return <ErrorCard message={error} onRetry={fetchDashboardData} />;

  if (user?.role === 'manager') {
    const directReports = teamMembers.length;
    const lockedReports = teamMembers.filter(member => member.is_locked).length;
    const balancedReports = teamMembers.filter(member => member.total_weightage === 100).length;
    const needsAttention = teamMembers.filter(member => !member.is_locked || member.total_weightage !== 100).length;
    const pendingReviews = teamGoals.filter(goal => !goal.is_locked && goal.status === 'submitted').length;
    const submittedSheets = Array.from(new Set(teamGoals.filter(goal => !goal.is_locked && goal.status === 'submitted').map(goal => goal.id))).length;

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome back, {user?.name.split(' ')[0]}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Team management console — review submissions, lock balanced sheets, and track direct report health.</p>
        </div>

        {activeCycle ? (
          <div className="bg-primary-50 border border-primary-200 dark:bg-primary-900/10 dark:border-primary-800/50 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <h4 className="font-semibold text-primary-900 dark:text-primary-100">Active Cycle Window: {activeCycle.period_name}</h4>
                <p className="text-sm text-primary-700 dark:text-primary-300">Manager review and submission cycle closes on {new Date(activeCycle.close_date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/team" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors whitespace-nowrap">Open Team Goals</Link>
              <Link to="/approvals" className="px-4 py-2 bg-white hover:bg-gray-50 text-primary-700 text-sm font-medium rounded-lg border border-primary-200 transition-colors whitespace-nowrap dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-primary-300 dark:border-gray-700">Team Reviews</Link>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏸️</span>
              <div>
                <h4 className="font-semibold text-amber-900 dark:text-amber-100">No Active Cycle Window</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">You can still review team history, but approval and check-in activity is paused until the next cycle opens.</p>
              </div>
            </div>
            <Link to="/team" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors whitespace-nowrap">Review Team Sheets</Link>
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
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Team Review Queue</h3>
                <p className="text-xs text-gray-500 mt-0.5">Quick access to submitted goal sheets and rework requests.</p>
              </div>
              <Link to="/approvals" className="text-xs font-bold text-primary-600 hover:text-primary-700">Open Reviews →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800"><span className="text-2xl block">🗂️</span><span className="text-lg font-bold text-gray-900 dark:text-gray-100 block mt-2">{teamGoals.length}</span><span className="text-xs text-gray-500 block mt-1">Total goals in team scope</span></div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800"><span className="text-2xl block">✅</span><span className="text-lg font-bold text-gray-900 dark:text-gray-100 block mt-2">{submittedSheets}</span><span className="text-xs text-gray-500 block mt-1">Sheets awaiting lock</span></div>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800"><span className="text-2xl block">👥</span><span className="text-lg font-bold text-gray-900 dark:text-gray-100 block mt-2">{lockedReports}</span><span className="text-xs text-gray-500 block mt-1">Direct reports fully locked</span></div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Team Health Snapshot</h3>
                <p className="text-xs text-gray-500 mt-0.5">Balanced sheets, goal totals, and readiness at a glance.</p>
              </div>
              <Link to="/team" className="text-xs font-bold text-primary-600 hover:text-primary-700">Open Team Goals →</Link>
            </div>
            <div className="space-y-3">
              {teamMembers.slice(0, 5).map(member => (
                <div key={member.id} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 px-4 py-3 bg-gray-50/60 dark:bg-gray-900/40">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.is_locked ? 'Sheet locked' : 'Sheet open'} · {member.total_weightage}% allocated</p>
                  </div>
                  <Badge variant={member.total_weightage === 100 ? 'success' : 'warning'}>{member.total_weightage === 100 ? 'Ready' : 'Review'}</Badge>
                </div>
              ))}
              {teamMembers.length === 0 && <EmptyState icon="👥" title="No direct reports found" description="Team members will appear here once manager relationships are assigned." />}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 flex flex-col justify-between hover:border-primary-500/50 transition-colors group">
            <div><span className="text-2xl">📋</span><h4 className="font-bold text-gray-900 dark:text-gray-100 mt-3 group-hover:text-primary-600 transition-colors">Team Goals</h4><p className="text-xs text-gray-500 mt-1">Review sheets, adjust inline weightage, and lock approved goals.</p></div>
            <Link to="/team" className="text-xs font-bold text-primary-600 hover:text-primary-700 mt-4 block">Open Goal Workspace →</Link>
          </Card>
          <Card className="p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-colors group">
            <div><span className="text-2xl">🧾</span><h4 className="font-bold text-gray-900 dark:text-gray-100 mt-3 group-hover:text-emerald-600 transition-colors">Team Reviews</h4><p className="text-xs text-gray-500 mt-1">Add check-in notes, track progress, and resolve pending quarterly submissions.</p></div>
            <Link to="/approvals" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 mt-4 block">Open Review Queue →</Link>
          </Card>
          <Card className="p-5 flex flex-col justify-between hover:border-indigo-500/50 transition-colors group">
            <div><span className="text-2xl">🚀</span><h4 className="font-bold text-gray-900 dark:text-gray-100 mt-3 group-hover:text-indigo-600 transition-colors">Shared Goal Cascade</h4><p className="text-xs text-gray-500 mt-1">Distribute a shared objective across direct reports from one workspace.</p></div>
            <Link to="/team" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-4 block">Launch Cascade →</Link>
          </Card>
        </div>

        {teamAnalytics && (
          <Card className="p-6">
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Team Trend Summary</h3>
                <p className="text-xs text-gray-500 mt-0.5">Average scores and quarterly completion heatmaps for direct reports.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 bg-gray-50/60 dark:bg-gray-900/30">
                <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Top Team Averages</p>
                <div className="space-y-2">
                  {teamAnalytics.bar_data.slice(0, 4).map((row) => {
                    const typedRow = row as { name?: string; avgScore?: number };
                    return <div key={typedRow.name} className="flex items-center justify-between"><span>{typedRow.name}</span><span className="font-semibold text-primary-600">{typedRow.avgScore}%</span></div>;
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
  }

  // --- HR ADMIN CONTROL CENTER ---
  if (user?.role === 'admin') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        
        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome back, {user?.name.split(' ')[0]}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">HR Administration Console — Manage active performance frameworks, directories and overrides.</p>
        </div>

        {/* Active Cycle Banner */}
        {activeCycle ? (
          <div className="bg-primary-50 border border-primary-200 dark:bg-primary-900/10 dark:border-primary-800/50 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <h4 className="font-semibold text-primary-900 dark:text-primary-100">Active Cycle Window: {activeCycle.period_name}</h4>
                <p className="text-sm text-primary-700 dark:text-primary-300">
                  Employee submission and review window closes on {new Date(activeCycle.close_date).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Link to="/admin/cycles" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors whitespace-nowrap">
              ⚙️ Cycle Manager
            </Link>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏸️</span>
              <div>
                <h4 className="font-semibold text-amber-900 dark:text-amber-100">No Active Cycle Window</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  There is currently no open goal-setting or check-in window. Employees cannot log check-ins.
                </p>
              </div>
            </div>
            <Link to="/admin/cycles" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors whitespace-nowrap">
              ⚡ Open Cycle Window
            </Link>
          </div>
        )}

        {/* Admin Quick Action Hub */}
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-6">Administrative Control Hub</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Cycle config */}
          <Card className="p-5 flex flex-col justify-between hover:border-primary-500/50 transition-colors group">
            <div>
              <span className="text-2xl">📅</span>
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mt-3 group-hover:text-primary-600 transition-colors">Goal Cycles</h4>
              <p className="text-xs text-gray-500 mt-1">Configure active windows, review close-out deadlines, and toggle operational frameworks.</p>
            </div>
            <Link to="/admin/cycles" className="text-xs font-bold text-primary-600 hover:text-primary-700 mt-4 block">
              Manage Windows →
            </Link>
          </Card>

          {/* Card 2: locked goal overrides */}
          <Card className="p-5 flex flex-col justify-between hover:border-red-500/50 transition-colors group">
            <div>
              <span className="text-2xl">🛡️</span>
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mt-3 group-hover:text-red-500 transition-colors">System Overrides</h4>
              <p className="text-xs text-gray-500 mt-1">Force unlock employee goal sheets, push corporate-wide shared goals, or revert cascades with full audit compliance.</p>
            </div>
            <Link to="/admin/overrides" className="text-xs font-bold text-red-600 hover:text-red-700 mt-4 block">
              Override Console →
            </Link>
          </Card>

          {/* Card 3: Employee Directory */}
          <Card className="p-5 flex flex-col justify-between hover:border-indigo-500/50 transition-colors group">
            <div>
              <span className="text-2xl">👥</span>
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mt-3 group-hover:text-indigo-600 transition-colors">Directory & Passwords</h4>
              <p className="text-xs text-gray-500 mt-1">Register new employee accounts, assign supervisors, and securely reset local logins in a few clicks.</p>
            </div>
            <Link to="/admin/users" className="text-xs font-bold text-indigo-600 hover:text-indigo-700 mt-4 block">
              View Directory →
            </Link>
          </Card>

          {/* Card 4: Audit Logs */}
          <Card className="p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-colors group">
            <div>
              <span className="text-2xl">📝</span>
              <h4 className="font-bold text-gray-900 dark:text-gray-100 mt-3 group-hover:text-emerald-500 transition-colors">Compliance Ledger</h4>
              <p className="text-xs text-gray-500 mt-1">Examine permanent chronological audit trails of all system modifications, unlocks, and password changes.</p>
            </div>
            <Link to="/admin/audit" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 mt-4 block">
              View Audit Trails →
            </Link>
          </Card>

        </div>

        {/* System Completion Dashboard Quick Look */}
        <Card className="p-6 mt-6">
          <div className="flex justify-between items-center border-b border-gray-150 dark:border-gray-800 pb-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Framework Completion Progress</h3>
              <p className="text-xs text-gray-500 mt-0.5">Real-time breakdown of goal-setting submissions across departments.</p>
            </div>
            <Link to="/admin/reports" className="text-xs font-bold text-primary-600 hover:text-primary-700">
              View Full Reports & Export →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center py-4">
            <div className="border-r border-gray-150 dark:border-gray-800 last:border-0">
              <span className="text-2xl block">📊</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 block mt-2">Executive Overview</span>
              <span className="text-xs text-gray-500 block mt-1">Interactive bar charts, department heatmaps and metric analyses.</span>
              <Link to="/admin/analytics" className="text-xs font-bold text-primary-600 hover:text-primary-700 mt-2 block">Analyze Trends →</Link>
            </div>
            <div className="border-r border-gray-150 dark:border-gray-800 last:border-0">
              <span className="text-2xl block">⚡</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 block mt-2">Escalation Center</span>
              <span className="text-xs text-gray-500 block mt-1">Configure warning rules and track auto-alerts for overdue submissions.</span>
              <Link to="/admin/escalation" className="text-xs font-bold text-primary-600 hover:text-primary-700 mt-2 block">Configure Rules →</Link>
            </div>
            <div>
              <span className="text-2xl block">🛡️</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 block mt-2">SSO Integration</span>
              <span className="text-xs text-gray-500 block mt-1">Manage corporate directories and federated logins under Azure AD.</span>
              <span className="text-xs font-semibold text-gray-400 block mt-2">Enabled (SSO Protected)</span>
            </div>
          </div>
        </Card>

      </div>
    );
  }

  // --- STANDARD EMPLOYEE & MANAGER DASHBOARD ---
  const totalGoals = goals.length;
  const totalWeightage = goals.filter(g => g.status === 'approved' || g.is_locked).reduce((acc, goal) => acc + goal.weightage, 0);
  const pendingApprovals = goals.filter(g => !g.is_locked && g.status === 'submitted').length;
  const drafts = goals.filter(g => g.status === 'draft' || g.status === 'returned').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome back, {user?.name.split(' ')[0]}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Here is your performance overview for the current cycle.</p>
        </div>
        {profile && (
          <div className="bg-white/60 dark:bg-surface-dark/60 backdrop-blur-md px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800/80 flex items-center gap-3 shadow-sm transition-all duration-300 hover:shadow-md">
            <div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                {profile.manager_name || "Unassigned"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Active Cycle Banner */}
      {activeCycle ? (
        <div className="bg-indigo-50 border border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/50 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <h4 className="font-semibold text-indigo-900 dark:text-indigo-100">Active Window: {activeCycle.period_name}</h4>
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                Closes on {new Date(activeCycle.close_date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Link to="/goals/new" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors whitespace-nowrap">
            + Draft New Goal
          </Link>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 dark:bg-gray-800/50 dark:border-gray-700 p-4 rounded-xl flex items-center gap-3">
          <span className="text-xl">⏸️</span>
          <p className="text-sm text-gray-600 dark:text-gray-300">No active goal-setting or check-in window is currently open.</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex flex-col justify-center">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Goals</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalGoals}</p>
        </Card>
        
        <Card className="p-5 flex flex-col justify-center">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Weightage Allocated</p>
          <div className="flex items-end gap-2">
            <p className={`text-3xl font-bold ${totalWeightage > 100 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
              {totalWeightage}%
            </p>
            <span className="text-sm text-gray-500 mb-1">/ 100%</span>
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-center">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Pending Approvals</p>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-500">{pendingApprovals}</p>
        </Card>

        <Card className="p-5 flex flex-col justify-center">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Action Required</p>
          <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{drafts}</p>
        </Card>
      </div>

      {/* Recent Goals Quick View */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Goal Sheet</h3>
          <Link to="/goals" className="text-sm text-primary-600 hover:text-primary-700 font-medium">View All →</Link>
        </div>
        
        {goals.length === 0 ? (
          <EmptyState 
            icon="🎯" 
            title="Your goal sheet is empty" 
            description="Start by drafting your first goal for the active cycle." 
            action={<Link to="/goals/new" className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium shadow-sm">Create Goal</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="p-4 font-medium">Goal Title</th>
                  <th className="p-4 font-medium">Thrust Area</th>
                  <th className="p-4 font-medium">Weightage</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {goals.slice(0, 5).map((goal) => (
                  <tr key={goal.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                    <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      <Link to={`/goals/${goal.id}`} className="hover:text-primary-600 transition-colors">{goal.title}</Link>
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400">{goal.thrust_area}</td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400">{goal.weightage}%</td>
                    <td className="p-4">
                      {goal.is_locked ? (
                        <Badge variant="success">Approved</Badge>
                      ) : goal.status === 'submitted' ? (
                        <Badge variant="warning">In Review</Badge>
                      ) : goal.status === 'returned' ? (
                        <Badge variant="danger">Returned</Badge>
                      ) : (
                        <Badge variant="info">Draft</Badge>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(!goal.is_locked && goal.status === 'draft') && (
                          <>
                            <Link to={`/goals/${goal.id}/edit`}><Button variant="secondary" size="sm">Edit</Button></Link>
                            <Button 
                              variant="primary" 
                              size="sm" 
                              isLoading={processingId === goal.id} 
                              onClick={() => submitGoalForApproval(goal.id)}
                            >
                              Submit
                            </Button>
                            <button 
                              onClick={() => deleteGoal(goal.id)} 
                              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete Draft Goal"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                        {(!goal.is_locked && goal.status === 'returned') && (
                          <Link to={`/goals/${goal.id}/edit`} state={{ returnComment: goal.return_comment }}>
                            <Button variant="danger" size="sm">Fix & Resubmit</Button>
                          </Link>
                        )}
                        {(goal.is_locked || goal.status === 'submitted') && (
                          <Link to={`/goals/${goal.id}`}><Button variant="secondary" size="sm">View</Button></Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};