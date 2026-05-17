import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';

interface CompletionRow {
  user_id: string;
  name: string;
  department: string;
  goals_submitted: number;
  goals_approved: number;
  check_in_completed: boolean;
  status_category: 'complete' | 'in_progress' | 'not_started';
}

export const AdminReportsPage = () => {
  const { addToast } = useToastStore();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CompletionRow[]>([]);
  
  // Filters
  const [filterDept, setFilterDept] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await apiClient.get('/admin/completion-dashboard');
      setData(response.data);
    } catch (err) {
      addToast("Failed to load org-wide completion metrics.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Extract unique departments for the dropdown
  const departments = ['All', ...Array.from(new Set(data.map(d => d.department)))];

  // Apply Client-Side Filters
  const filteredData = data.filter(row => {
    const matchesDept = filterDept === 'All' || row.department === filterDept;
    const matchesStatus = filterStatus === 'All' || row.status_category === filterStatus;
    return matchesDept && matchesStatus;
  });

  // Calculate top-level stats
  const totalEmployees = data.length;
  const fullyCompliant = data.filter(d => d.status_category === 'complete').length;
  const complianceRate = totalEmployees ? Math.round((fullyCompliant / totalEmployees) * 100) : 0;

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & High-Level Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Completion & Compliance</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Monitor organization-wide adoption and mandatory cycle completion.</p>
        </div>

        <div className="flex gap-4">
          <Card className="px-5 py-3 text-center border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/10">
            <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">Org Compliance</p>
            <p className="text-2xl font-black text-green-700 dark:text-green-300">{complianceRate}%</p>
          </Card>
          <Card className="px-5 py-3 text-center border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Pending Action</p>
            <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{totalEmployees - fullyCompliant}</p>
          </Card>
        </div>
      </div>

      {/* Control Bar */}
      <Card className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between bg-gray-50/50 dark:bg-gray-900/20">
        <div className="flex gap-4 w-full sm:w-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Department</label>
            <select 
              value={filterDept} 
              onChange={e => setFilterDept(e.target.value)}
              className="p-2 text-sm rounded-lg bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-primary-500 min-w-[150px]"
            >
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</label>
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)}
              className="p-2 text-sm rounded-lg bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-primary-500 min-w-[150px]"
            >
              <option value="All">All Statuses</option>
              <option value="complete">Fully Compliant</option>
              <option value="in_progress">In Progress</option>
              <option value="not_started">Not Started</option>
            </select>
          </div>
        </div>
        
        <Button variant="secondary" onClick={() => { /* Implement Phase 2 CSV Export here if time permits */ }}>
          ↓ Export CSV
        </Button>
      </Card>

      {/* Main Data Table */}
      <Card className="overflow-hidden">
        {filteredData.length === 0 ? (
          <EmptyState icon="📊" title="No records found" description="Adjust your filters to see employee compliance data." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="p-4 font-semibold pl-6">Employee</th>
                  <th className="p-4 font-semibold text-center">Goals Submitted</th>
                  <th className="p-4 font-semibold text-center">Goals Approved</th>
                  <th className="p-4 font-semibold text-center">Active Check-in</th>
                  <th className="p-4 font-semibold pr-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredData.map((row) => {
                  // Determine dynamic row background color based on status
                  const rowBg = 
                    row.status_category === 'complete' ? 'bg-green-50/40 dark:bg-green-900/10' :
                    row.status_category === 'not_started' ? 'bg-red-50/40 dark:bg-red-900/10' :
                    'bg-amber-50/30 dark:bg-amber-900/10';

                  return (
                    <tr key={row.user_id} className={`hover:brightness-95 transition-all ${rowBg}`}>
                      
                      <td className="p-4 pl-6">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{row.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{row.department}</p>
                      </td>

                      <td className="p-4 text-center">
                        <span className={`text-sm font-bold ${row.goals_submitted > 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                          {row.goals_submitted}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span className={`text-sm font-bold ${row.goals_approved > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                          {row.goals_approved}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        {row.check_in_completed ? (
                          <span className="text-green-600 text-lg" title="Completed">✓</span>
                        ) : (
                          <span className="text-red-400 text-lg" title="Missing">✕</span>
                        )}
                      </td>

                      <td className="p-4 pr-6 text-right">
                        {row.status_category === 'complete' ? (
                          <Badge variant="success">Compliant</Badge>
                        ) : row.status_category === 'not_started' ? (
                          <Badge variant="danger">Not Started</Badge>
                        ) : (
                          <Badge variant="warning">Action Required</Badge>
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
    </div>
  );
};