import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
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
}

export const DashboardPage = () => {
  const { user } = useAppStore();
  const { addToast } = useToastStore();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCycle, setActiveCycle] = useState<ActiveCycle | null>(null);
  const [goals, setGoals] = useState<DashboardGoal[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const cycleRes = await apiClient.get('/cycles/active').catch(() => ({ data: null }));
      setActiveCycle(cycleRes.data);
      
      // Personal goals are only fetched/relevant for non-admin accounts
      if (user.role !== 'admin') {
        const goalsRes = await apiClient.get(`/goals/${user?.id}`);
        setGoals(goalsRes.data);
      }
    } catch (err) {
      setError('Failed to load dashboard data. Please check your connection.');
      addToast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role, addToast]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  if (loading) return <PageSkeleton statCards rows={4} cols={4} />;
  if (error) return <ErrorCard message={error} onRetry={fetchDashboardData} />;

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
  const totalWeightage = goals.reduce((acc, goal) => acc + goal.weightage, 0);
  const pendingApprovals = goals.filter(g => !g.is_locked && g.status === 'submitted').length;
  const drafts = goals.filter(g => g.status === 'draft' || g.status === 'returned').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome back, {user?.name.split(' ')[0]}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Here is your performance overview for the current cycle.</p>
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