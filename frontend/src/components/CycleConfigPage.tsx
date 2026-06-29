import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { Modal } from './ui/Modal';

interface CycleWindow {
  id: number;
  period_name: string;
  open_date: string;
  close_date: string;
  is_active: boolean;
}

const PERIODS = [
  { key: 'GOAL_SETTING', label: 'Annual Goal Setting', desc: 'Allows employees to draft and submit new objective sheets.' },
  { key: 'Q1', label: 'Q1 Check-ins', desc: 'Q1 performance metrics logging and manager reviews.' },
  { key: 'Q2', label: 'Q2 Check-ins', desc: 'Q2 performance metrics logging and manager reviews.' },
  { key: 'Q3', label: 'Q3 Check-ins', desc: 'Q3 performance metrics logging and manager reviews.' },
  { key: 'Q4', label: 'Q4 / Year-End Review', desc: 'Final year-end scoring and performance appraisals.' }
];

export const CycleConfigPage = () => {
  const { user: _user } = useAppStore();
  const { addToast } = useToastStore();

  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<CycleWindow[]>([]);
  
  // Modal State
  const [activeModalPeriod, setActiveModalPeriod] = useState<string | null>(null);
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCycles();
  }, []);

  async function fetchCycles() {
    try {
      const response = await apiClient.get('/cycles');
      setCycles(response.data);
    } catch {
      addToast("Failed to load cycle configurations.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (periodKey: string) => {
    setActiveModalPeriod(periodKey);
    // Reset dates or pre-fill if modifying an existing one
    const existing = cycles.find(c => c.period_name === periodKey);
    if (existing) {
      setOpenDate(existing.open_date.split('T')[0]);
      setCloseDate(existing.close_date.split('T')[0]);
    } else {
      setOpenDate('');
      setCloseDate('');
    }
  };

  async function handleActivateCycle() {
    if (!openDate || !closeDate) {
      addToast("Both open and close dates are required.", "error");
      return;
    }
    
    if (new Date(closeDate) <= new Date(openDate)) {
      addToast("Close date must be after the open date.", "error");
      return;
    }

    setSubmitting(true);
    try {
      // POST new cycle window. Backend should handle deactivating the previous active window.
      await apiClient.post('/cycles', {
        period_name: activeModalPeriod,
        open_date: new Date(openDate).toISOString(),
        close_date: new Date(closeDate).toISOString(),
        is_active: true
      });

      addToast(`${activeModalPeriod} window successfully activated.`, "success");
      setActiveModalPeriod(null);
      fetchCycles(); // Refresh the grid to show the new active state
    } catch {
      addToast("Failed to activate cycle window.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;

  const activeCycle = cycles.find(c => c.is_active);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Cycle Configuration</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage organizational performance windows. Only <strong className="text-gray-700 dark:text-gray-300">one</strong> window can be active at a time.
        </p>
      </div>

      {/* Active Status Banner */}
      {activeCycle ? (
        <div className="bg-emerald-50/50 border border-emerald-150 dark:bg-emerald-950/10 dark:border-emerald-900/40 p-4 rounded-xl flex items-center gap-4">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <h4 className="font-semibold text-emerald-900 dark:text-emerald-200">
              System is currently unlocked for: {PERIODS.find(p => p.key === activeCycle.period_name)?.label || activeCycle.period_name}
            </h4>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Closes automatically on {new Date(activeCycle.close_date).toLocaleDateString()}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50/50 border border-amber-150 dark:bg-amber-950/10 dark:border-amber-900/40 p-4 rounded-xl flex items-center gap-4">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-amber-900 dark:text-amber-200">System is currently locked</h4>
            <p className="text-sm text-amber-700 dark:text-amber-400">No active window is configured. Employees cannot submit goals or check-ins.</p>
          </div>
        </div>
      )}

      {/* Cycle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PERIODS.map((period) => {
          // Find the latest DB record for this period key
          const dbRecord = cycles.find(c => c.period_name === period.key);
          const isActive = dbRecord?.is_active;

          return (
            <Card key={period.key} className={`flex flex-col h-full transition-shadow hover:shadow-md ${isActive ? 'ring-2 ring-primary-500' : ''}`}>
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg">{period.label}</h3>
                  {isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : dbRecord ? (
                    <Badge variant="info">Closed</Badge>
                  ) : (
                    <Badge variant="warning">Unconfigured</Badge>
                  )}
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 h-10 line-clamp-2">
                  {period.desc}
                </p>

                {dbRecord && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-sm space-y-1.5 border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Opens:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{new Date(dbRecord.open_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Closes:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{new Date(dbRecord.close_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20">
                <Button 
                  variant={isActive ? "secondary" : "primary"} 
                  className="w-full"
                  onClick={() => handleOpenModal(period.key)}
                  disabled={isActive} // Cannot re-activate an already active window
                >
                  {isActive ? 'Currently Active' : 'Configure & Open Window'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Activation Modal */}
      <Modal 
        isOpen={!!activeModalPeriod} 
        onClose={() => !submitting && setActiveModalPeriod(null)} 
        title={`Activate Window: ${PERIODS.find(p => p.key === activeModalPeriod)?.label}`}
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
            <strong>Warning:</strong> Activating this window will immediately close and lock the currently active window (if any).
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Open Date</label>
            <input 
              type="date" 
              value={openDate}
              onChange={(e) => setOpenDate(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-background-light dark:bg-background-dark outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Close Date</label>
            <input 
              type="date" 
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-background-light dark:bg-background-dark outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button variant="secondary" onClick={() => setActiveModalPeriod(null)} disabled={submitting}>Cancel</Button>
            <Button variant="danger" onClick={handleActivateCycle} isLoading={submitting}>Activate Window</Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};