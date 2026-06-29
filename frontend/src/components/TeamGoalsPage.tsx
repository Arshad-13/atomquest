import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';
import { Modal } from './ui/Modal';
import { Rocket, Users } from 'lucide-react';

import { SharedGoalModal } from './SharedGoalModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EmployeeBasic {
  id: string;
  name: string;
}

interface TeamGoal {
  id: number;
  thrust_area: string;
  title: string;
  description: string;
  uom: 'min' | 'max' | 'timeline' | 'zero';
  target: number;
  weightage: number;
  is_locked: boolean;
  status: 'draft' | 'submitted' | 'returned' | 'approved';
  owner: EmployeeBasic;
}

interface GroupedTeamSheets {
  [employeeId: string]: {
    employee: EmployeeBasic;
    goals: TeamGoal[];
  };
}

interface EmployeeSummary {
  id: string;
  name: string;
  role: string;
  total_weightage: number;
  is_locked: boolean;
}

interface AnalyticsData {
  bar_data: Array<Record<string, unknown>>;
  heatmap_data: Array<Record<string, unknown>>;
}

export const TeamGoalsPage = () => {
  const { user, theme } = useAppStore();
  const { addToast } = useToastStore();

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#334155' : '#e5e7eb';
  const textColor = isDark ? '#94a3b8' : '#6b7280';
  const labelColor = isDark ? '#cbd5e1' : '#4b5563';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#475569' : '#e2e8f0';
  const tooltipText = isDark ? '#f8fafc' : '#0f172a';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all' | 'analytics'>('pending');
  const [rawGoals, setRawGoals] = useState<TeamGoal[]>([]);
  const [directReports, setDirectReports] = useState<EmployeeSummary[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [expandedEmployees, setExpandedEmployees] = useState<{ [key: string]: boolean }>({});
  
  // Inline editing state tracking: maps goalId -> { target, weightage }
  const [inlineEdits, setInlineEdits] = useState<{ [goalId: number]: { target: number; weightage: number } }>({});
  
  // Return/Rework Modal state
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [targetEmployeeId, setTargetEmployeeId] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // New state for Shared Goal Modal
  const [sharedModalOpen, setSharedModalOpen] = useState(false);

  const fetchTeamGoals = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Run fetches in parallel
      const [teamRes, analyticsRes, reportsRes] = await Promise.all([
        apiClient.get(`/managers/${user.id}/team-goals`),
        apiClient.get(`/managers/${user.id}/analytics`).catch(() => ({ data: null })), // Graceful fail if no data
        apiClient.get(`/managers/${user.id}/team`).catch(() => ({ data: [] }))
      ]);

      setRawGoals(teamRes.data);
      setDirectReports(reportsRes.data);

      // Inject the analytics data into state if it exists
      if (analyticsRes.data) {
        setAnalyticsData(analyticsRes.data);
      }

      // Initialize inline edit fields with existing values
      const initialEdits: typeof inlineEdits = {};
      teamRes.data.forEach((g: TeamGoal) => {
        initialEdits[g.id] = { target: g.target, weightage: g.weightage };
      });
      setInlineEdits(initialEdits);

      // Auto-expand employee sheets that contain pending items
      const initialExpansion: typeof expandedEmployees = {};
      teamRes.data.forEach((g: TeamGoal) => {
        if (!g.is_locked && g.status === 'submitted') {
          initialExpansion[g.owner.id] = true;
        }
      });
      setExpandedEmployees(initialExpansion);
    } catch {
      addToast("Failed to retrieve team performance profiles.", "error");
    } finally {
      setLoading(false);
    }
  }, [user, addToast]);

  useEffect(() => {
    // This effect intentionally hydrates local view state from the team-goals API on mount and refresh.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTeamGoals();
  }, [fetchTeamGoals]);

  const handleInlineChange = (goalId: number, field: 'target' | 'weightage', value: number) => {
    setInlineEdits(prev => ({
      ...prev,
      [goalId]: {
        ...prev[goalId],
        [field]: value
      }
    }));
  };

  const toggleAccordion = (employeeId: string) => {
    setExpandedEmployees(prev => ({ ...prev, [employeeId]: !prev[employeeId] }));
  };

  // --- Core Workflows ---

  async function handleApproveSheet(_employeeId: string, goals: TeamGoal[]) {
    setSubmittingAction(true);
    try {
      const fullSheetGoals = allGroupedSheets[_employeeId]?.goals || goals;

      // Calculate total allocated weightage across the employee's full sheet, including current inline edits
      const computedTotalWeightage = fullSheetGoals.reduce((sum, g) => {
        const edit = inlineEdits[g.id];
        return sum + (edit ? edit.weightage : g.weightage);
      }, 0);

      // Enforce strict enterprise budgeting logic
      if (computedTotalWeightage !== 100) {
        addToast(`Validation Error: Target goal sheet totals ${computedTotalWeightage}%. It must equal exactly 100% to lock.`, "error");
        setSubmittingAction(false);
        return;
      }

      // Commit inline changes and approve goals sequentially or via Promise.all
      await Promise.all(
        goals.map(async (goal) => {
          const editValues = inlineEdits[goal.id] || { target: goal.target, weightage: goal.weightage };
          
          // Use the dedicated Phase 5 Workflow API
          return apiClient.post(`/goals/${goal.id}/approve`, {
            target: editValues.target,
            weightage: editValues.weightage
          });
        })
      );

      addToast("Objective sheet validated, authorized, and locked.", "success");
      fetchTeamGoals();
    } catch {
      addToast("Failed to process sheet authorization.", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleOpenReturnModal = (employeeId: string) => {
    setTargetEmployeeId(employeeId);
    setReturnComment("");
    setReturnModalOpen(true);
  };

  async function handleConfirmReturn() {
    if (!returnComment.trim() || !targetEmployeeId) {
      addToast("A rejection/rework diagnostic comment is required.", "error");
      return;
    }
    setSubmittingAction(true);
    try {
      const employeeGoalsToReturn = rawGoals.filter(g => g.owner.id === targetEmployeeId && !g.is_locked && g.status === 'submitted');
      
      // Call Phase 2 Endpoint to cycle status from submitted -> draft/returned with documentation and updated params
      await Promise.all(
        employeeGoalsToReturn.map(g => {
          const edits = inlineEdits[g.id] || { target: g.target, weightage: g.weightage };
          return apiClient.post(`/goals/${g.id}/return`, { 
            comment: returnComment,
            target: edits.target,
            weightage: edits.weightage
          });
        })
      );

      addToast("Goal sheet returned to employee for structural correction.", "success");
      setReturnModalOpen(false);
      fetchTeamGoals();
    } catch {
      addToast("Failed to reject target objective sheet.", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  // --- Filtering & Categorization Layout Math ---

  const filteredGoals = rawGoals.filter(goal => {
    if (activeTab === 'pending') return !goal.is_locked && goal.status === 'submitted';
    if (activeTab === 'approved') return goal.is_locked === true;
    return true; // 'all'
  });

  // Regroup the full dataset so sheet totals stay accurate even when the pending tab only shows a subset.
  const allGroupedSheets: GroupedTeamSheets = {};
  rawGoals.forEach(goal => {
    if (!allGroupedSheets[goal.owner.id]) {
      allGroupedSheets[goal.owner.id] = {
        employee: goal.owner,
        goals: []
      };
    }
    allGroupedSheets[goal.owner.id].goals.push(goal);
  });

  // Regroup the filtered dataset for the current tab's visible rows.
  const groupedSheets: GroupedTeamSheets = {};
  filteredGoals.forEach(goal => {
    if (!groupedSheets[goal.owner.id]) {
      groupedSheets[goal.owner.id] = {
        employee: goal.owner,
        goals: []
      };
    }
    groupedSheets[goal.owner.id].goals.push(goal);
  });

  // Extract a clean list of direct reports from the grouped sheets
  const directReportsList = Object.values(groupedSheets).map(sheet => ({
    id: sheet.employee.id,
    name: sheet.employee.name,
    role: 'employee',
    total_weightage: sheet.goals.reduce((acc, g) => acc + g.weightage, 0),
    is_locked: sheet.goals.every(g => g.is_locked)
  }));

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header Context */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Team Goal Management</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Review performance parameters, alter weightages inline, and approve sheets for your team.</p>
        </div>
      </div>

      {/* Tabs Control Panel & Shared Goal Button */}
      <div className="border-b border-gray-200 dark:border-gray-800 flex justify-between items-end">
        <div className="flex gap-6">
          {(['pending', 'approved', 'all', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors relative capitalize ${
                activeTab === tab 
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 font-semibold' 
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab === 'pending' ? 'Pending Approval' : tab === 'approved' ? 'Approved & Locked' : tab === 'all' ? 'All Records' : 'Team Analytics'}
              {tab === 'pending' && rawGoals.filter(g => !g.is_locked && g.status === 'submitted').length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">
                  {Array.from(new Set(rawGoals.filter(g => !g.is_locked && g.status === 'submitted').map(g => g.owner.id))).length}
                </span>
              )}
            </button>
          ))}
        </div>
        
        <div className="pb-2">
          <Button variant="primary" size="sm" className="flex items-center gap-1.5" onClick={() => setSharedModalOpen(true)}>
            <Rocket className="w-3.5 h-3.5" /> Push Shared Goal
          </Button>
        </div>
      </div>

      {/* TAB 4: ANALYTICS DASHBOARD    */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-300">
          
          {/* Average Score Bar Chart */}
          <Card className="p-6">
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Average Progress Score</h3>
              <p className="text-sm text-gray-500">Current aggregate performance across all locked goals per employee.</p>
            </div>
            
            {!analyticsData?.bar_data || analyticsData.bar_data.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-gray-400 italic text-sm">Insufficient data to plot scores.</div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.bar_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={gridColor} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: labelColor, fontSize: 12, fontWeight: 500 }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipText }} labelStyle={{ color: tooltipText }} cursor={{fill: 'transparent'}} />
                    <Bar dataKey="avgScore" name="Average Score %" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Quarterly Completion Heatmap */}
          <Card className="p-6">
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Check-in Completion Heatmap</h3>
              <p className="text-sm text-gray-500">Percentage of expected quarterly updates submitted.</p>
            </div>

            {!analyticsData?.heatmap_data || analyticsData.heatmap_data.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-gray-400 italic text-sm">Insufficient data for heatmap.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 font-medium text-xs text-gray-500 w-1/3 border-b border-gray-100 dark:border-gray-800">Team Member</th>
                      {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                        <th key={q} className="p-2 font-medium text-xs text-center text-gray-500 border-b border-gray-100 dark:border-gray-800">{q}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.heatmap_data.map((emp: any) => (
                      <tr key={emp.name} className="border-b border-gray-50 dark:border-gray-800/50">
                        <td className="p-3 text-sm font-medium text-gray-900 dark:text-gray-200">{emp.name}</td>
                        {['Q1', 'Q2', 'Q3', 'Q4'].map(q => {
                          const val = emp[q] as number;
                          // Heatmap Color Logic
                          let bgColor = 'bg-gray-100 dark:bg-gray-800'; // Missing/Zero
                          if (val > 0 && val < 100) bgColor = 'bg-amber-400 dark:bg-amber-500'; // Partial
                          if (val === 100) bgColor = 'bg-green-500 dark:bg-green-600'; // Complete
                          
                          return (
                            <td key={q} className="p-2">
                              <div 
                                className={`w-full h-8 rounded ${bgColor} transition-all duration-300 flex items-center justify-center cursor-help`}
                                title={`${emp.name} - ${q}: ${val}% Completed`}
                              >
                                {val > 0 && <span className="text-[10px] font-bold text-white/90">{val}%</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center gap-4 mt-6 text-xs text-gray-500 justify-end">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-100 dark:bg-gray-800 rounded"></div> 0%</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-400 rounded"></div> Partial</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded"></div> 100%</div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Accordion List — only shown when NOT on analytics tab */}
      {activeTab !== 'analytics' && (
        Object.keys(groupedSheets).length === 0 ? (
          <EmptyState 
            icon={<Users className="w-8 h-8 text-indigo-500" />}
            title={`No targets match your query`}
            description={`There are currently no employee goal sheets assigned to the "${activeTab}" validation cycle.`}
          />
        ) : (
          <div className="space-y-4">
            {Object.values(groupedSheets).map(({ employee, goals }) => {
              const isExpanded = !!expandedEmployees[employee.id];
              const fullSheetGoals = allGroupedSheets[employee.id]?.goals || goals;
              
              const liveTotalWeightage = fullSheetGoals.reduce((sum, g) => {
                const currentEdit = inlineEdits[g.id];
                return sum + (currentEdit ? currentEdit.weightage : g.weightage);
              }, 0);

              const hasPendingActions = goals.some(g => !g.is_locked && g.status === 'submitted');

              return (
                <Card key={employee.id} className="overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm">
                  
                  {/* Employee Card Summary Accordion Trigger Row */}
                  <div 
                    onClick={() => toggleAccordion(employee.id)}
                    className="p-5 bg-gray-50/70 dark:bg-gray-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-900/70 transition-colors border-b border-gray-100 dark:border-gray-800"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xl transform transition-transform duration-200 inline-block">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">{employee.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{goals.length} Balanced Scorecard Objectives assigned</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                      <div className="text-right">
                        <p className="text-xs text-gray-400 font-medium">Sheet Weightage Allocation</p>
                        <p className={`text-sm font-bold ${liveTotalWeightage === 100 ? 'text-green-600' : 'text-amber-500 font-semibold'}`}>
                          {liveTotalWeightage}% / 100%
                        </p>
                      </div>

                      {hasPendingActions && activeTab === 'pending' && (
                        <div className="flex gap-2 ml-2">
                          <Button variant="secondary" size="sm" onClick={() => handleOpenReturnModal(employee.id)} disabled={submittingAction}>
                            Return Rework
                          </Button>
                          <Button 
                            variant="primary" size="sm"
                            onClick={() => handleApproveSheet(employee.id, goals)}
                            disabled={submittingAction || liveTotalWeightage !== 100}
                            title={liveTotalWeightage !== 100 ? "Total weightage must equal 100% to lock." : ""}
                          >
                            Authorize & Lock
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="overflow-x-auto animate-in slide-in-from-top-2 duration-200">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white dark:bg-gray-900 text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                            <th className="p-4 font-medium pl-12">Performance Dimension</th>
                            <th className="p-4 font-medium">UoM Strategy</th>
                            <th className="p-4 font-medium w-40">Target Value (Editable)</th>
                            <th className="p-4 font-medium w-36">Weightage % (Editable)</th>
                            <th className="p-4 font-medium">Audit Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-surface-dark">
                          {goals.map((goal) => {
                            const edits = inlineEdits[goal.id] || { target: goal.target, weightage: goal.weightage };
                            const isEditable = !goal.is_locked && activeTab === 'pending';

                            return (
                              <tr key={goal.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/10 transition-colors">
                                <td className="p-4 pl-12 max-w-sm">
                                  <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm whitespace-normal">{goal.title}</p>
                                  <span className="inline-block mt-1 text-[10px] uppercase font-mono tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                    {goal.thrust_area}
                                  </span>
                                </td>
                                <td className="p-4 text-sm font-mono text-gray-500 dark:text-gray-400 capitalize">
                                  {goal.uom === 'zero' ? 'Zero-based' : goal.uom}
                                </td>
                                <td className="p-4">
                                  <input type="number" step="any" disabled={!isEditable}
                                    value={edits.target}
                                    onChange={(e) => handleInlineChange(goal.id, 'target', parseFloat(e.target.value) || 0)}
                                    className="w-full p-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-transparent disabled:border-transparent focus:ring-1 focus:ring-primary-500 outline-none font-medium transition-all text-gray-900 dark:text-white disabled:opacity-80"
                                  />
                                </td>
                                <td className="p-4">
                                  <input type="number" step="0.5" disabled={!isEditable}
                                    value={edits.weightage}
                                    onChange={(e) => handleInlineChange(goal.id, 'weightage', parseFloat(e.target.value) || 0)}
                                    className="w-full p-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-transparent disabled:border-transparent focus:ring-1 focus:ring-primary-500 outline-none font-medium transition-all text-gray-900 dark:text-white disabled:opacity-80"
                                  />
                                </td>
                                <td className="p-4">
                                  {goal.is_locked ? (
                                    <Badge variant="success">Locked</Badge>
                                  ) : goal.status === 'submitted' ? (
                                    <Badge variant="warning">In Review</Badge>
                                  ) : goal.status === 'returned' ? (
                                    <Badge variant="danger">Rework</Badge>
                                  ) : (
                                    <Badge variant="info">Draft</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* Rework Diagnostics Action Modal Sheet Overlay */}
      <Modal 
        isOpen={returnModalOpen} 
        onClose={() => setReturnModalOpen(false)} 
        title="Specify Rework Diagnostics"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Provide explicit, actionable feedback detailing why this goal sheet is being returned. This summary will be displayed directly at the top of the employee's edit form.
          </p>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
              Rework Correction Comment
            </label>
            <textarea 
              rows={4}
              placeholder="e.g., Weightage allocations across financial tracking need adjustments; increase Strategic Growth threshold..."
              value={returnComment}
              onChange={(e) => setReturnComment(e.target.value)}
              className="w-full p-2.5 text-sm rounded-lg bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setReturnModalOpen(false)} disabled={submittingAction}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmReturn} isLoading={submittingAction}>
              Issue Return Order
            </Button>
          </div>
        </div>
      </Modal>

      {/* Shared Goal Injection Modal */}
      <SharedGoalModal 
        isOpen={sharedModalOpen}
        onClose={() => setSharedModalOpen(false)}
        employees={directReports.length > 0 ? directReports : directReportsList}
        onGoalCreated={fetchTeamGoals}
      />
    </div>
  );
};