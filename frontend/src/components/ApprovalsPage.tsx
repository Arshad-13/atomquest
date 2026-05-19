import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';

interface TeamCheckIn {
  id: number;
  quarter: string;
  actual_achievement: number;
  status: string;
  manager_comment: string | null;
  progress_score: number;
  goal_id: number;
  goal_title: string;
  goal_thrust_area: string;
  goal_target: number;
  goal_uom: string;
  employee_id: string;
  employee_name: string;
}

export const ApprovalsPage = () => {
  const { user } = useAppStore();
  const { addToast } = useToastStore();

  const [loading, setLoading] = useState(true);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [checkIns, setCheckIns] = useState<TeamCheckIn[]>([]);
  
  // Local comment state tracking: map checkInId -> string
  const [comments, setComments] = useState<{ [checkInId: number]: string }>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  async function fetchTeamCheckIns() {
    if (!user?.id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(`/managers/${user.id}/team-check-ins`, {
        params: { quarter: selectedQuarter }
      });
      setCheckIns(response.data);
      
      // Seed comment tracking buffers with baseline data
      const initialComments: typeof comments = {};
      response.data.forEach((ci: TeamCheckIn) => {
        initialComments[ci.id] = ci.manager_comment || "";
      });
      setComments(initialComments);
    } catch {
      addToast("Failed to load team quarterly data metrics.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeamCheckIns();
  }, [user?.id, selectedQuarter]);

  const handleCommentChange = (id: number, text: string) => {
    setComments(prev => ({ ...prev, [id]: text }));
  };

  async function handleSaveComment(checkInId: number) {
    const textToCommit = comments[checkInId];
    if (!textToCommit?.trim()) {
      addToast("Feedback summary statement is required before saving.", "error");
      return;
    }

    setSavingId(checkInId);
    try {
      // Calls Phase 2 review endpoint update matrix
      await apiClient.patch(`/check-ins/${checkInId}/review`, {
        manager_comment: textToCommit
      });
      
      addToast("Review dialogue appended to record matrix.", "success");
      
      // Update data mapping array locally to establish persistence indicators
      setCheckIns(prev => prev.map(ci => ci.id === checkInId ? { ...ci, manager_comment: textToCommit } : ci));
    } catch {
      addToast("Failed to serialize feedback review.", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Quarterly Progress Reviews</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Audit direct report metrics, track score calculations, and register structured comments.</p>
        </div>
        
        {/* Quarter Selection Panel */}
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
          {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
            <button
              key={q}
              onClick={() => setSelectedQuarter(q)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedQuarter === q 
                  ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {q} Window
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid View Ledger */}
      {loading ? (
        <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>
      ) : checkIns.length === 0 ? (
        <EmptyState 
          icon="📋"
          title={`No data submitted for ${selectedQuarter}`}
          description={`None of your team members have logged performance metrics inside the active ${selectedQuarter} tracking window yet.`}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="p-4 font-medium pl-6">Team Member</th>
                  <th className="p-4 font-medium">Objective Parameter</th>
                  <th className="p-4 font-medium text-center">Target vs Actual</th>
                  <th className="p-4 font-medium text-center">Computed Progress</th>
                  <th className="p-4 font-medium">Progress Track</th>
                  <th className="p-4 font-medium pl-8">Manager Feedback Log (Inline)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-surface-dark">
                {checkIns.map((ci) => (
                  <tr key={ci.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/10 transition-colors">
                    
                    {/* Employee Profile Name */}
                    <td className="p-4 pl-6 font-semibold text-gray-900 dark:text-white text-sm">
                      {ci.employee_name}
                    </td>

                    {/* Goal Metrics Summary Block */}
                    <td className="p-4 max-w-xs whitespace-normal">
                      <p className="font-medium text-gray-800 dark:text-gray-200 text-sm leading-tight">{ci.goal_title}</p>
                      <span className="inline-block mt-1 text-[10px] font-mono uppercase text-gray-400 tracking-wider">
                        {ci.goal_thrust_area}
                      </span>
                    </td>

                    {/* Raw Metric Parameters Block */}
                    <td className="p-4 text-center">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{ci.actual_achievement}</span>
                      <span className="text-xs text-gray-400 font-medium block">of {ci.goal_target} <span className="uppercase text-[10px] font-mono">({ci.goal_uom})</span></span>
                    </td>

                    {/* Mathematically Processed Value Badge */}
                    <td className="p-4 text-center">
                      <span className={`text-base font-bold ${ci.progress_score >= 100 ? 'text-green-600 dark:text-green-400' : 'text-primary-600'}`}>
                        {ci.progress_score}%
                      </span>
                    </td>

                    {/* Status Tracking Pill Indicator */}
                    <td className="p-4">
                      {ci.status === 'completed' ? (
                        <Badge variant="success">Completed</Badge>
                      ) : ci.status === 'on_track' ? (
                        <Badge variant="info">On Track</Badge>
                      ) : (
                        <Badge variant="warning">Not Started</Badge>
                      )}
                    </td>

                    {/* Real-time Inline Review Feedback Text Entry Row Component */}
                    <td className="p-4 pl-8 min-w-[320px]">
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          placeholder="Provide performance feedback statement..."
                          value={comments[ci.id] || ""}
                          onChange={(e) => handleCommentChange(ci.id, e.target.value)}
                          className="flex-1 p-2 text-sm rounded-lg bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none font-medium transition-shadow text-gray-900 dark:text-white"
                        />
                        <Button
                          variant={ci.manager_comment === comments[ci.id] ? "secondary" : "primary"}
                          size="sm"
                          isLoading={savingId === ci.id}
                          disabled={ci.manager_comment === comments[ci.id]}
                          onClick={() => handleSaveComment(ci.id)}
                        >
                          {ci.manager_comment ? 'Update' : 'Save'}
                        </Button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  );
};