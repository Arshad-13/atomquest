import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';

interface AuditLog {
  id: number;
  timestamp: string;
  goal_id: number | null;
  goal_title: string | null;
  employee_name: string | null;
  changed_by_name: string;
  change_summary: string;
}

const ITEMS_PER_PAGE = 10;

export const AdminAuditLogPage = () => {
  const { addToast } = useToastStore();
  
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  
  // Filters
  const [searchEmployee, setSearchEmployee] = useState('');
  const [filterAction, setFilterAction] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await apiClient.get('/admin/audit-logs');
      setLogs(response.data);
    } catch (err) {
      addToast("Failed to retrieve system audit trail.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Filter Logic ---
  const filteredLogs = logs.filter(log => {
    // 1. Employee Search
    const employeeMatch = !searchEmployee || 
      (log.employee_name && log.employee_name.toLowerCase().includes(searchEmployee.toLowerCase())) || 
      log.changed_by_name.toLowerCase().includes(searchEmployee.toLowerCase());
      
    if (!employeeMatch) return false;
    
    // 2. Action Type Matcher
    if (filterAction !== 'All') {
      if (filterAction === 'APPROVED' && !log.change_summary.includes('APPROVED')) return false;
      if (filterAction === 'OVERRIDE' && !log.change_summary.includes('OVERRIDE') && !log.change_summary.includes('PASSWORD RESET')) return false;
      if (filterAction === 'PROVISION' && !log.change_summary.includes('EMPLOYEE PROVISIONED')) return false;
      if (filterAction === 'EDIT' && (log.change_summary.includes('APPROVED') || log.change_summary.includes('EMPLOYEE PROVISIONED') || log.change_summary.includes('PASSWORD RESET'))) return false;
    }

    // 3. Date Range
    const logDate = new Date(log.timestamp).getTime();
    if (startDate && logDate < new Date(startDate).getTime()) return false;
    if (endDate && logDate > new Date(endDate).getTime() + 86400000) return false; // +1 day to include end date fully

    return true;
  });

  // --- Pagination Math ---
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // --- CSV Export Logic ---
  const exportCSV = () => {
    if (filteredLogs.length === 0) return addToast("No data to export.", "info");

    const headers = ["Timestamp,Goal ID,Goal Title,Employee,Changed By,Change Summary"];
    const csvRows = filteredLogs.map(log => 
      `"${new Date(log.timestamp).toLocaleString()}","${log.goal_id ?? ''}","${log.goal_title ?? ''}","${log.employee_name ?? ''}","${log.changed_by_name}","${log.change_summary.replace(/"/g, '""')}"`
    );
    
    const csvString = [headers, ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `atomquest_audit_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    addToast("Audit log exported successfully.", "success");
  };

  // Helper to parse action tags for styling
  const getActionBadge = (summary: string) => {
    if (summary.includes("OVERRIDE") || summary.includes("PASSWORD RESET")) return <Badge variant="danger">System Override</Badge>;
    if (summary.includes("APPROVED")) return <Badge variant="success">Authorization</Badge>;
    if (summary.includes("EMPLOYEE PROVISIONED")) return <Badge variant="success">Provisioning</Badge>;
    return <Badge variant="info">Modification</Badge>;
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Immutable Audit Ledger</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Permanent record of all authorizations, modifications, and system overrides.</p>
        </div>
        <Button variant="secondary" onClick={exportCSV}>
          ⬇ Export CSV
        </Button>
      </div>

      {/* Control Panel */}
      <Card className="p-4 bg-gray-50/50 dark:bg-gray-900/20 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Search Identities</label>
          <input 
            type="text" 
            placeholder="Employee or Manager name..."
            value={searchEmployee}
            onChange={(e) => { setSearchEmployee(e.target.value); setCurrentPage(1); }}
            className="w-full p-2 text-sm rounded-lg bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Action Type</label>
          <select 
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }}
            className="w-full p-2 text-sm rounded-lg bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="All">All Actions</option>
            <option value="APPROVED">Authorizations</option>
            <option value="PROVISION">Provisioning</option>
            <option value="EDIT">Modifications</option>
            <option value="OVERRIDE">System Overrides</option>
          </select>
        </div>

        <div className="flex gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="p-2 text-sm rounded-lg bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="p-2 text-sm rounded-lg bg-white dark:bg-surface-dark border border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </Card>

      {/* Main Ledger */}
      <Card className="overflow-hidden">
        {paginatedLogs.length === 0 ? (
          <EmptyState icon="🛡️" title="No logs found" description="No audit events match your current filter criteria." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="p-4 font-semibold w-48 pl-6">Timestamp</th>
                  <th className="p-4 font-semibold">Goal Context</th>
                  <th className="p-4 font-semibold">Actors</th>
                  <th className="p-4 font-semibold w-32">Action Type</th>
                  <th className="p-4 font-semibold">Technical Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/10 transition-colors">
                    
                    <td className="p-4 pl-6 text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>

                    <td className="p-4 max-w-xs">
                      {log.goal_id ? (
                        <>
                          <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{log.goal_title}</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">Goal ID: #{log.goal_id}</p>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-100 dark:bg-gray-800/60 px-2.5 py-1 rounded">
                          ⚙️ System Event
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      {log.employee_name && (
                        <p className="text-sm text-gray-900 dark:text-gray-100"><span className="text-gray-500 text-xs w-12 inline-block">Owner:</span> {log.employee_name}</p>
                      )}
                      <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5"><span className="text-gray-500 text-xs w-12 inline-block">Actor:</span> {log.changed_by_name}</p>
                    </td>

                    <td className="p-4">
                      {getActionBadge(log.change_summary)}
                    </td>

                    <td className="p-4 text-sm text-gray-700 dark:text-gray-300 font-mono">
                      {log.change_summary.split(' | ').map((line, i) => (
                        <span key={i} className="block leading-relaxed">{line}</span>
                      ))}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/20">
                <span className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} entries
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    Previous
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};