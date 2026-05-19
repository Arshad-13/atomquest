import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';

// (Keep your existing Goal interface)
interface Goal {
  id: number;
  title: string;
  thrust_area: string;
  uom: string;
  target: number;
  weightage: number;
  is_locked: boolean;
  status: 'draft' | 'submitted' | 'returned' | 'approved';
  progress_score?: number;
  return_comment?: string;
}

export const EmployeeDashboard = () => {
  const { user } = useAppStore();
  const { addToast } = useToastStore();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'goals' | 'analytics'>('goals');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [processingId, setProcessingId] = useState<number | null>(null);
  
  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<{ line_data: any[], radar_data: any[] } | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [user?.id]);

  async function fetchDashboardData() {
    if (!user?.id) return;
    try {
      const [goalsRes, analyticsRes] = await Promise.all([
        apiClient.get(`/goals/${user.id}`),
        apiClient.get(`/employees/${user.id}/analytics`).catch(() => ({ data: null })) // Graceful fail if no checkins yet
      ]);
      
      setGoals(goalsRes.data);
      setAnalyticsData(analyticsRes.data);
    } catch {
      addToast("Failed to load dashboard data.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Keep your existing Goal Actions (submitGoalForApproval, deleteGoal, formatUoM) ---
  async function submitGoalForApproval(goalId: number) {
    setProcessingId(goalId);
    try {
      await apiClient.post(`/goals/${goalId}/submit`);
      addToast("Goal submitted for manager review!", "success");
      fetchDashboardData();
    } catch { addToast("Failed to submit.", "error"); } finally { setProcessingId(null); }
  };

  async function deleteGoal(goalId: number) {
    if (!window.confirm("Are you sure?")) return;
    setProcessingId(goalId);
    try {
      await apiClient.delete(`/goals/${goalId}`);
      addToast("Goal deleted.", "success");
      fetchDashboardData();
    } catch { addToast("Failed to delete.", "error"); } finally { setProcessingId(null); }
  };

  const formatUoM = (uom: string) => {
    switch (uom) { case 'min': return 'Numeric (Higher better)'; case 'max': return 'Numeric (Lower better)'; case 'zero': return 'Zero-based'; case 'timeline': return 'Timeline'; default: return uom; }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;

  // Extract dynamic line chart keys (excluding 'quarter')
  const lineChartKeys = analyticsData?.line_data && analyticsData.line_data.length > 0 
    ? Object.keys(analyticsData.line_data[0]).filter(k => k !== 'quarter')
    : [];
    
  // Dynamic colors for the line chart
  const colors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6'];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Workspace</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your objectives and analyze your performance trends.</p>
        </div>
        <Link to="/goals/new">
          <Button variant="primary">+ Create New Goal</Button>
        </Link>
      </div>

      {/* Tabs Control */}
      <div className="border-b border-gray-200 dark:border-gray-800 flex gap-6">
        <button
          onClick={() => setActiveTab('goals')}
          className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'goals' ? 'text-primary-600 border-b-2 border-primary-600 font-semibold' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          My Goal Sheet
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'analytics' ? 'text-primary-600 border-b-2 border-primary-600 font-semibold' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          Personal Analytics
        </button>
      </div>

      {/* TAB 1: Goal Sheet (Your exact Phase 4.2 Code) */}
      {activeTab === 'goals' && (
        <Card className="overflow-hidden">
          {goals.length === 0 ? (
            <EmptyState icon="📋" title="No goals found" description="You haven't added any goals to your sheet yet." action={<Link to="/goals/new"><Button variant="primary" className="mt-4">Draft First Goal</Button></Link>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                {/* ... (Keep your exact table structure from Phase 4.2 here) ... */}
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="p-4 font-medium">Goal Details</th>
                    <th className="p-4 font-medium">Target</th>
                    <th className="p-4 font-medium">Weightage</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {goals.map((goal) => (
                    <tr key={goal.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                      <td className="p-4">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{goal.title}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-md">{goal.thrust_area}</span>
                      </td>
                      <td className="p-4"><p className="font-medium text-gray-900 dark:text-gray-100">{goal.target}</p><p className="text-xs text-gray-500">{formatUoM(goal.uom)}</p></td>
                      <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{goal.weightage}%</td>
                      <td className="p-4">
                        {goal.is_locked ? <Badge variant="success">Approved</Badge> : goal.status === 'submitted' ? <Badge variant="warning">In Review</Badge> : goal.status === 'returned' ? <Badge variant="danger">Returned</Badge> : <Badge variant="info">Draft</Badge>}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(!goal.is_locked && goal.status === 'draft') && (
                            <>
                              <Link to={`/goals/${goal.id}/edit`}><Button variant="secondary" size="sm">Edit</Button></Link>
                              <Button variant="primary" size="sm" isLoading={processingId === goal.id} onClick={() => submitGoalForApproval(goal.id)}>Submit</Button>
                              <button onClick={() => deleteGoal(goal.id)} className="p-1.5 text-gray-400 hover:text-red-600">🗑️</button>
                            </>
                          )}
                          {(!goal.is_locked && goal.status === 'returned') && (
                            <Link to={`/goals/${goal.id}/edit`} state={{ returnComment: goal.return_comment }}><Button variant="danger" size="sm">Fix & Resubmit</Button></Link>
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
      )}

      {/* TAB 2: Analytics Dashboard */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Trend Line Chart */}
          <Card className="p-6">
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Performance Trajectory</h3>
              <p className="text-sm text-gray-500">Your progress score over time, mapped by individual goals.</p>
            </div>
            {!analyticsData?.line_data || lineChartKeys.length === 0 ? (
               <div className="h-[300px] flex items-center justify-center text-gray-400 italic text-sm">Not enough check-in data to plot trends.</div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.line_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="quarter" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(tick) => `${tick}%`} tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    {lineChartKeys.map((key, index) => (
                      <Line key={key} type="monotone" dataKey={key} stroke={colors[index % colors.length]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Spider/Radar Chart */}
          <Card className="p-6">
            <div className="mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Strategic Alignment</h3>
              <p className="text-sm text-gray-500">Your aggregate performance metrics across corporate thrust areas.</p>
            </div>
            {!analyticsData?.radar_data || analyticsData.radar_data.length === 0 ? (
               <div className="h-[300px] flex items-center justify-center text-gray-400 italic text-sm">Waiting for performance data...</div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={analyticsData.radar_data}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Radar name="Your Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

        </div>
      )}

    </div>
  );
};