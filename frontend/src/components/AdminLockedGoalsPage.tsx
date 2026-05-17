import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';
import { Modal } from './ui/Modal';

interface LockedGoal {
  id: number;
  title: string;
  thrust_area: string;
  weightage: number;
  owner_name: string;
  owner_email: string;
}

export const AdminLockedGoalsPage = () => {
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<LockedGoal[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<LockedGoal | null>(null);
  const [unlockReason, setUnlockReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchLockedGoals();
  }, []);

  const fetchLockedGoals = async () => {
    try {
      const response = await apiClient.get('/admin/goals/locked');
      setGoals(response.data);
    } catch (err) {
      addToast("Failed to load system locked goals.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUnlock = (goal: LockedGoal) => {
    setSelectedGoal(goal);
    setUnlockReason("");
    setUnlockModalOpen(true);
  };

  const handleConfirmUnlock = async () => {
    if (!unlockReason.trim() || unlockReason.length < 10) {
      addToast("A detailed reason (min 10 chars) is required for the audit trail.", "error");
      return;
    }
    
    if (!selectedGoal) return;
    setSubmitting(true);

    try {
      await apiClient.post(`/admin/goals/${selectedGoal.id}/unlock`, {
        reason: unlockReason
      });
      
      addToast(`Goal #${selectedGoal.id} successfully unlocked.`, "success");
      setUnlockModalOpen(false);
      
      // Remove the unlocked goal from the local list
      setGoals(prev => prev.filter(g => g.id !== selectedGoal.id));
    } catch (err) {
      addToast("Failed to execute admin override.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredGoals = goals.filter(g => 
    g.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.owner_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Override: Locked Goals</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage locked assets. All unlock actions are permanently logged to the system audit trail.</p>
        </div>
        
        <input 
          type="text"
          placeholder="Search by goal title or owner..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark outline-none focus:ring-2 focus:ring-red-500 w-full sm:w-72"
        />
      </div>

      {/* Main Data Table */}
      <Card className="overflow-hidden border-red-100 dark:border-red-900/30">
        {filteredGoals.length === 0 ? (
          <EmptyState icon="🔒" title="No locked goals found" description="There are currently no locked goals matching your search criteria." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="p-4 font-semibold pl-6">Goal ID & Title</th>
                  <th className="p-4 font-semibold">Owner</th>
                  <th className="p-4 font-semibold text-center">Weightage</th>
                  <th className="p-4 font-semibold pr-6 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-surface-dark">
                {filteredGoals.map((goal) => (
                  <tr key={goal.id} className="hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors">
                    
                    <td className="p-4 pl-6">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">#{goal.id} — {goal.title}</p>
                      <span className="inline-block mt-1 text-[10px] font-mono uppercase text-gray-400 tracking-wider">
                        {goal.thrust_area}
                      </span>
                    </td>

                    <td className="p-4">
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{goal.owner_name}</p>
                      <p className="text-xs text-gray-500">{goal.owner_email}</p>
                    </td>

                    <td className="p-4 text-center">
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{goal.weightage}%</span>
                    </td>

                    <td className="p-4 pr-6 text-right">
                      <Button variant="danger" size="sm" onClick={() => handleOpenUnlock(goal)}>
                        🔓 Force Unlock
                      </Button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Mandatory Unlock Modal */}
      <Modal 
        isOpen={unlockModalOpen} 
        onClose={() => !submitting && setUnlockModalOpen(false)} 
        title="Execute System Override"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <strong>Warning:</strong> You are about to break a system lock on Goal #{selectedGoal?.id}. This will revert the goal to <strong>Draft</strong> status and allow the employee to alter metrics.
          </div>
          
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Mandatory Audit Log Reason (Min 10 chars)
            </label>
            <textarea 
              rows={3}
              placeholder="State the corporate justification for breaking this lock..."
              value={unlockReason}
              onChange={(e) => setUnlockReason(e.target.value)}
              className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button variant="secondary" onClick={() => setUnlockModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirmUnlock} isLoading={submitting}>
              Confirm Override
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};