import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';

interface ActiveCycle {
  id: number;
  period_name: string;
  close_date: string;
}

interface ApprovedGoal {
  id: number;
  title: string;
  thrust_area: string;
  uom: 'min' | 'max' | 'timeline' | 'zero';
  target: number;
  weightage: number;
  is_shared_recipient?: boolean; // True if synced from a primary owner shared goal
  current_check_in_id?: number;
  actual_achievement: number;
  status: 'not_started' | 'on_track' | 'completed';
}

export const CheckInsPage = () => {
  const { user } = useAppStore();
  const { addToast } = useToastStore();

  const [loading, setLoading] = useState(true);
  const [activeCycle, setActiveCycle] = useState<ActiveCycle | null>(null);
  const [goals, setGoals] = useState<ApprovedGoal[]>([]);
  const [savingRows, setSavingRows] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    const fetchCheckInData = async () => {
      if (!user?.id) return;
      try {
        // 1. Fetch current active window
        const cycleRes = await apiClient.get('/cycles/active');
        setActiveCycle(cycleRes.data);

        if (cycleRes.data) {
          // 2. Fetch approved goals + existing check-in data for this cycle window
          // For the hackathon, we fetch the goals and append empty/existing tracking values
          const goalsRes = await apiClient.get(`/goals/${user.id}`);
          const approvedOnly = goalsRes.data.filter((g: any) => g.is_locked === true);
          
          // Hydrate rows with default values or merge with any existing check-in entries
          const hydratedGoals = await Promise.all(
            approvedOnly.map(async (goal: any) => {
              const ciRes = await apiClient.get(`/goals/${goal.id}/check-ins`);
              const currentQuarterCi = ciRes.data.find((c: any) => c.quarter === cycleRes.data.period_name);
              
              return {
                ...goal,
                current_check_in_id: currentQuarterCi?.id || null,
                actual_achievement: currentQuarterCi?.actual_achievement ?? 0,
                status: currentQuarterCi?.status || 'not_started',
                is_shared_recipient: goal.is_shared_recipient || false // Populated if Phase 2 shared logic flag exists
              };
            })
          );
          
          setGoals(hydratedGoals);
        }
      } catch (err) {
        addToast("Error preparing check-in workspace.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchCheckInData();
  }, [user?.id, addToast]);

  // --- Real-time Frontend Calculation Engine (BRD Formulas) ---
  const calculateLiveScore = (actual: number, target: number, uom: string): number => {
    if (!target || actual === undefined || isNaN(actual)) return 0;
    try {
      if (uom === 'min') {
        return Number(((actual / target) * 100).toFixed(2));
      }
      if (uom === 'max') {
        return Number(((target / actual) * 100).toFixed(2));
      }
      if (uom === 'zero') {
        return actual === 0 ? 100 : 0;
      }
      if (uom === 'timeline') {
        return actual > 0 ? Number(((target / actual) * 100).toFixed(2)) : 100;
      }
    } catch {
      return 0;
    }
    return 0;
  };

  const handleRowChange = (goalId: number, field: 'actual_achievement' | 'status', value: any) => {
    setGoals(prev => prev.map(g => {
      if (g.id === goalId) {
        return { ...g, [field]: value };
      }
      return g;
    }));
  };

  const handleSaveCheckIn = async (goal: ApprovedGoal) => {
    if (!activeCycle) return;
    setSavingRows(prev => ({ ...prev, [goal.id]: true }));

    try {
      const payload = {
        goal_id: goal.id,
        quarter: activeCycle.period_name,
        actual_achievement: goal.actual_achievement,
        status: goal.status
      };

      // Post progress updates to Phase 2 API
      await apiClient.post('/check-ins', payload);
      addToast(`Progress saved for "${goal.title}"`, "success");
    } catch (err: any) {
      addToast(err.response?.data?.detail || "Failed to save update", "error");
    } finally {
      setSavingRows(prev => ({ ...prev, [goal.id]: false }));
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;

  // Gatekeeping Check: Block access if there's no active window open for changes
  if (!activeCycle) {
    return (
      <EmptyState 
        icon="🔒"
        title="Check-in Window Closed"
        description="Progress submission is currently locked. Your tracking sheet will unlock automatically when the system administrator activates the next quarterly window."
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary-600 to-indigo-700 text-white p-6 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="bg-white/20 text-white font-semibold text-xs px-2.5 py-1 rounded-full tracking-wider uppercase">
            Active Cycle Window
          </span>
          <h2 className="text-2xl font-bold mt-2">Log {activeCycle.period_name} Achievements</h2>
          <p className="text-primary-100 text-sm mt-1">Please log updates before the deadline on {new Date(activeCycle.close_date).toLocaleDateString()}.</p>
        </div>
      </div>

      {/* Main Ledger Table */}
      <Card className="overflow-hidden">
        {goals.length === 0 ? (
          <EmptyState 
            icon="🎯"
            title="No approved goals to update"
            description="Only approved, locked goals are eligible for quarterly performance logging. Check back once your manager accepts your current draft objective sheet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="p-4 font-medium">Objective Details</th>
                  <th className="p-4 font-medium">Target Metric</th>
                  <th className="p-4 font-medium w-36">Actual Value</th>
                  <th className="p-4 font-medium w-44">Status Dropdown</th>
                  <th className="p-4 font-medium text-center">Live Score</th>
                  <th className="p-4 font-medium text-right">Commit Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {goals.map((goal) => {
                  const liveScore = calculateLiveScore(goal.actual_achievement, goal.target, goal.uom);

                  return (
                    <tr key={goal.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10 transition-colors">
                      
                      {/* Title & Type */}
                      <td className="p-4">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{goal.title}</p>
                        <span className="inline-block mt-1 text-xs text-gray-400 font-mono uppercase">{goal.thrust_area}</span>
                        {goal.is_shared_recipient && (
                          <span className="ml-2 inline-block text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-semibold px-1.5 py-0.5 rounded">
                            Shared Link
                          </span>
                        )}
                      </td>

                      {/* Target Metric */}
                      <td className="p-4">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{goal.target}</p>
                        <p className="text-xs text-gray-400 uppercase font-mono">{goal.uom}</p>
                      </td>

                      {/* Actual Value Input */}
                      <td className="p-4">
                        <input 
                          type="number"
                          step="any"
                          disabled={goal.is_shared_recipient} // Shared recipients get actuals read-only from primary owner
                          value={goal.actual_achievement || ''}
                          onChange={(e) => handleRowChange(goal.id, 'actual_achievement', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 text-sm rounded-lg bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed font-medium"
                        />
                      </td>

                      {/* Status Dropdown */}
                      <td className="p-4">
                        <select
                          value={goal.status}
                          onChange={(e) => handleRowChange(goal.id, 'status', e.target.value)}
                          className="w-full p-2 text-sm rounded-lg bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none font-medium"
                        >
                          <option value="not_started">Not Started</option>
                          <option value="on_track">On Track</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>

                      {/* Real-time Computed Score */}
                      <td className="p-4 text-center">
                        <span className={`text-sm font-bold ${liveScore >= 100 ? 'text-green-600 dark:text-green-400' : liveScore >= 50 ? 'text-primary-600' : 'text-amber-500'}`}>
                          {liveScore}%
                        </span>
                      </td>

                      {/* Row Action Commit Button */}
                      <td className="p-4 text-right">
                        <Button 
                          variant="secondary"
                          size="sm"
                          isLoading={savingRows[goal.id]}
                          onClick={() => handleSaveCheckIn(goal)}
                        >
                          Save
                        </Button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};