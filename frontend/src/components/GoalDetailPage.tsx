import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';

// --- Types ---
interface Goal {
  id: number;
  title: string;
  description: string;
  thrust_area: string;
  uom: string;
  target: number;
  weightage: number;
  is_locked: boolean;
  status: 'draft' | 'submitted' | 'returned' | 'approved';
}

interface CheckIn {
  id: number;
  quarter: string;
  actual_achievement: number;
  status: string;
  manager_comment: string | null;
  progress_score: number;
}

interface ApprovalRequest {
  id: number;
  action: 'SUBMITTED' | 'APPROVED' | 'RETURNED';
  comment: string | null;
  actioned_at: string;
  user_name: string; // The person who did the action
}

export const GoalDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToastStore();

  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [history, setHistory] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    const fetchGoalDetails = async () => {
      try {
        // Run fetches in parallel for speed
        const [goalRes, checkInsRes, historyRes] = await Promise.all([
          apiClient.get(`/goals/detail/${id}`),
          apiClient.get(`/goals/${id}/check-ins`).catch(() => ({ data: [] })),
          apiClient.get(`/goals/${id}/history`).catch(() => ({ data: [] }))
        ]);

        if (!goalRes.data) throw new Error("Goal not found");
        
        setGoal(goalRes.data);
        setCheckIns(checkInsRes.data);
        setHistory(historyRes.data);
      } catch (err) {
        addToast("Failed to load goal details.", "error");
        navigate('/goals');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchGoalDetails();
  }, [id, addToast, navigate]);

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;
  if (!goal) return null;

  // Find the latest return comment if applicable
  const latestReturn = history.find(h => h.action === 'RETURNED');
  
  // Format UoM
  const formatUoM = (uom: string) => {
    switch (uom) {
      case 'min': return 'Numeric (Higher is better)';
      case 'max': return 'Numeric (Lower is better)';
      case 'zero': return 'Zero-based';
      case 'timeline': return 'Timeline';
      default: return uom;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Navigation & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/goals')} className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300">
            ← Back
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{goal.title}</h2>
              {goal.is_locked ? <Badge variant="success">Approved & Locked</Badge> : 
               goal.status === 'submitted' ? <Badge variant="warning">In Review</Badge> : 
               goal.status === 'returned' ? <Badge variant="danger">Returned</Badge> : 
               <Badge variant="info">Draft</Badge>}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{goal.thrust_area}</p>
          </div>
        </div>
        
        {/* Contextual Action Button */}
        {!goal.is_locked && (goal.status === 'draft' || goal.status === 'returned') && (
          <Link to={`/goals/${goal.id}/edit`} state={{ returnComment: latestReturn?.comment }}>
            <Button variant="primary">Edit Goal</Button>
          </Link>
        )}
      </div>

      {/* Rejection Callout */}
      {goal.status === 'returned' && latestReturn && (
        <div className="bg-red-50 border border-red-200 dark:bg-red-900/10 dark:border-red-900/30 p-5 rounded-xl flex items-start gap-4">
          <div className="text-2xl mt-1">⚠️</div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-800 dark:text-red-400">Manager Returned for Rework</h3>
            <p className="text-red-700 dark:text-red-300 mt-1">{latestReturn.comment}</p>
            <div className="mt-3">
              <Link to={`/goals/${goal.id}/edit`} state={{ returnComment: latestReturn.comment }}>
                <Button variant="danger" size="sm">Fix & Resubmit</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details & Check-ins */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Goal Metrics */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">Objective Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Target</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{goal.target}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Weightage</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{goal.weightage}%</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Measurement Type</p>
                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{formatUoM(goal.uom)}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Action Plan / Description</p>
              <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg whitespace-pre-wrap text-sm leading-relaxed border border-gray-100 dark:border-gray-700">
                {goal.description || "No description provided."}
              </p>
            </div>
          </Card>

          {/* Check-ins Ledger */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Progress Tracking</h3>
            </div>
            
            {checkIns.length === 0 ? (
              <EmptyState 
                icon="📊" 
                title="No check-ins yet" 
                description={goal.is_locked ? "Log your first check-in when the cycle window opens." : "Goal must be approved before you can log progress."} 
              />
            ) : (
              <div className="space-y-4">
                {checkIns.map((ci) => (
                  <div key={ci.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/20">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-primary-700 dark:text-primary-400">{ci.quarter} Update</span>
                        <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs capitalize font-medium">
                          {ci.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-gray-500">System Score: </span>
                        <span className="font-bold text-green-600 dark:text-green-400">{ci.progress_score}%</span>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Actual Achievement: </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{ci.actual_achievement}</span>
                    </div>

                    {ci.manager_comment && (
                      <div className="bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-md border border-indigo-100 dark:border-indigo-800/30">
                        <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-400 mb-1">Manager Feedback</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{ci.manager_comment}"</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Approval Timeline */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6 border-b border-gray-100 dark:border-gray-800 pb-2">Approval Timeline</h3>
            
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 italic text-center">No history recorded yet.</p>
            ) : (
              <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-8">
                {history.map((event, _index) => (
                  <div key={event.id} className="relative pl-6">
                    {/* Timeline Dot */}
                    <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white dark:border-surface-dark ${
                      event.action === 'APPROVED' ? 'bg-green-500' :
                      event.action === 'RETURNED' ? 'bg-red-500' :
                      'bg-amber-500'
                    }`}></div>
                    
                    {/* Event Content */}
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {event.action === 'SUBMITTED' ? 'Submitted for Review' :
                           event.action === 'RETURNED' ? 'Returned for Rework' :
                           'Goal Approved'}
                        </h4>
                        <span className="text-xs text-gray-500">{new Date(event.actioned_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">By {event.user_name}</p>
                      
                      {event.comment && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-2.5 rounded-md text-sm text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700">
                          {event.comment}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
};