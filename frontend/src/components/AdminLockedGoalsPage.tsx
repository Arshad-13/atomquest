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

interface SharedGoalRecipient {
  id: string;
  name: string;
}

interface SharedGoal {
  id: number;
  title: string;
  description: string;
  thrust_area: string;
  weightage: number;
  recipients: SharedGoalRecipient[];
}

export const AdminLockedGoalsPage = () => {
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'locked' | 'shared'>('locked');
  const [searchTerm, setSearchTerm] = useState("");

  // Locked Goals State
  const [goals, setGoals] = useState<LockedGoal[]>([]);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<LockedGoal | null>(null);
  const [unlockReason, setUnlockReason] = useState("");
  const [submittingUnlock, setSubmittingUnlock] = useState(false);

  // Shared Goals State
  const [sharedGoals, setSharedGoals] = useState<SharedGoal[]>([]);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedSharedGoal, setSelectedSharedGoal] = useState<SharedGoal | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'locked') {
        const response = await apiClient.get('/admin/goals/locked');
        setGoals(response.data);
      } else {
        const response = await apiClient.get('/admin/shared-goals');
        setSharedGoals(response.data);
      }
    } catch (err) {
      addToast(`Failed to load ${activeTab === 'locked' ? 'locked' : 'shared'} goals.`, "error");
    } finally {
      setLoading(false);
    }
  };

  // UNLOCK ACTIONS
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
    setSubmittingUnlock(true);

    try {
      await apiClient.post(`/admin/goals/${selectedGoal.id}/unlock`, {
        reason: unlockReason
      });
      
      addToast(`Goal #${selectedGoal.id} successfully unlocked.`, "success");
      setUnlockModalOpen(false);
      setGoals(prev => prev.filter(g => g.id !== selectedGoal.id));
    } catch (err) {
      addToast("Failed to execute admin override.", "error");
    } finally {
      setSubmittingUnlock(false);
    }
  };

  // CANCEL ACTIONS
  const handleOpenCancel = (sg: SharedGoal) => {
    setSelectedSharedGoal(sg);
    setCancelReason("");
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim() || cancelReason.length < 10) {
      addToast("A detailed reason (min 10 chars) is required for the audit trail.", "error");
      return;
    }
    
    if (!selectedSharedGoal) return;
    setSubmittingCancel(true);

    try {
      await apiClient.post(`/admin/shared-goals/${selectedSharedGoal.id}/cancel`, {
        reason: cancelReason
      });
      
      addToast(`Shared goal "${selectedSharedGoal.title}" successfully canceled. Recipient sheets rebalanced.`, "success");
      setCancelModalOpen(false);
      setSharedGoals(prev => prev.filter(g => g.id !== selectedSharedGoal.id));
    } catch (err) {
      addToast("Failed to cancel shared goal.", "error");
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Filter lists based on search
  const filteredLockedGoals = goals.filter(g => 
    g.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.owner_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSharedGoals = sharedGoals.filter(sg => 
    sg.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Override Console</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage locked goal overrides and active shared goal cascades. All actions are permanently logged.</p>
        </div>
        
        <input 
          type="text"
          placeholder={activeTab === 'locked' ? "Search locked goals..." : "Search shared goals..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark outline-none focus:ring-2 focus:ring-red-500 w-full sm:w-72"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button 
          onClick={() => { setActiveTab('locked'); setSearchTerm(""); }}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'locked' ? 'border-red-600 text-red-600 dark:text-red-400' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          🔒 Locked Goals Override ({goals.length})
        </button>
        <button 
          onClick={() => { setActiveTab('shared'); setSearchTerm(""); }}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'shared' ? 'border-red-600 text-red-600 dark:text-red-400' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          🔄 Pushed Shared Goals ({sharedGoals.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>
      ) : activeTab === 'locked' ? (
        /* LOCKED GOALS SECTION */
        <Card className="overflow-hidden border-red-100 dark:border-red-900/30">
          {filteredLockedGoals.length === 0 ? (
            <EmptyState icon="🔒" title="No locked goals found" description="There are currently no locked goals matching your search." />
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
                  {filteredLockedGoals.map((goal) => (
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
      ) : (
        /* SHARED GOALS SECTION */
        <Card className="overflow-hidden border-red-100 dark:border-red-900/30">
          {filteredSharedGoals.length === 0 ? (
            <EmptyState icon="🔄" title="No shared goals found" description="There are currently no pushed shared goals active in the system." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="p-4 font-semibold pl-6">Shared Goal Info</th>
                    <th className="p-4 font-semibold">Recipients Cascaded</th>
                    <th className="p-4 font-semibold text-center">Weightage</th>
                    <th className="p-4 font-semibold pr-6 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-surface-dark">
                  {filteredSharedGoals.map((sg) => (
                    <tr key={sg.id} className="hover:bg-red-50/30 dark:hover:bg-red-900/10 transition-colors">
                      <td className="p-4 pl-6 max-w-sm whitespace-normal">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{sg.title}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{sg.description}</p>
                        <span className="inline-block mt-2 text-[10px] font-mono uppercase text-gray-400 tracking-wider">
                          {sg.thrust_area}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {sg.recipients.map(r => (
                            <span key={r.id} className="inline-block text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                              {r.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{sg.weightage}%</span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <Button variant="danger" size="sm" onClick={() => handleOpenCancel(sg)}>
                          ❌ Cancel & Revert
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Mandatory Unlock Modal */}
      <Modal 
        isOpen={unlockModalOpen} 
        onClose={() => !submittingUnlock && setUnlockModalOpen(false)} 
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
            <Button variant="secondary" onClick={() => setUnlockModalOpen(false)} disabled={submittingUnlock}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirmUnlock} isLoading={submittingUnlock}>
              Confirm Override
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mandatory Cancel Shared Goal Modal */}
      <Modal 
        isOpen={cancelModalOpen} 
        onClose={() => !submittingCancel && setCancelModalOpen(false)} 
        title="Cancel & Revert Shared Goal"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border-l-4 border-red-500 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <strong>Warning:</strong> Canceling <strong>"{selectedSharedGoal?.title}"</strong> will completely delete it and all of its cloned employee goals across <strong>{selectedSharedGoal?.recipients.length}</strong> sheets. Employees' total weightages will immediately revert to their previous status.
          </div>
          
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
              Mandatory Audit Log Reason (Min 10 chars)
            </label>
            <textarea 
              rows={3}
              placeholder="State the corporate reason for canceling this corporate shared goal..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)} disabled={submittingCancel}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirmCancel} isLoading={submittingCancel}>
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};