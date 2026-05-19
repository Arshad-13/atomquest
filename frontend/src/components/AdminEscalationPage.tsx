import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';

interface EscalationRule {
  id: number;
  trigger_event: string;
  days_threshold: number;
  is_active: boolean;
}

interface EscalationLog {
  id: number;
  trigger_event: string;
  employee_name: string;
  manager_name: string;
  triggered_at: string;
  is_resolved: boolean;
}

export const AdminEscalationPage = () => {
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');
  
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [logs, setLogs] = useState<EscalationLog[]>([]);
  const [savingRuleId, setSavingRuleId] = useState<number | null>(null);

  async function fetchData() {
    try {
      const [rulesRes, logsRes] = await Promise.all([
        apiClient.get('/admin/escalation-rules').catch(() => ({ data: [] })),
        apiClient.get('/admin/escalation-logs').catch(() => ({ data: [] }))
      ]);
      setRules(rulesRes.data);
      setLogs(logsRes.data);
    } catch {
      addToast("Failed to load escalation data.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const handleRuleChange = (id: number, field: keyof EscalationRule, value: any) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  async function saveRule(rule: EscalationRule) {
    setSavingRuleId(rule.id);
    try {
      await apiClient.patch(`/admin/escalation-rules/${rule.id}`, {
        days_threshold: rule.days_threshold,
        is_active: rule.is_active
      });
      addToast("Escalation rule updated successfully.", "success");
    } catch {
      addToast("Failed to update rule.", "error");
    } finally {
      setSavingRuleId(null);
    }
  };

  const formatEventName = (event: string) => {
    return event.replace(/_/g, ' ');
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Automated Escalations</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure system governance rules and monitor auto-generated compliance alerts.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800 flex gap-6">
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'rules' ? 'text-red-600 border-b-2 border-red-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Configuration Rules
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'logs' ? 'text-red-600 border-b-2 border-red-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Triggered Alerts ({logs.filter(l => !l.is_resolved).length})
        </button>
      </div>

      {/* TAB 1: Rules */}
      {activeTab === 'rules' && (
        <Card className="overflow-hidden">
          {rules.length === 0 ? (
            <EmptyState icon="⚙️" title="No Rules Configured" description="Escalation rules have not been seeded in the database." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <th className="p-4 font-semibold pl-6">Trigger Event</th>
                    <th className="p-4 font-semibold text-center">Days Threshold (Grace Period)</th>
                    <th className="p-4 font-semibold text-center">Engine Status</th>
                    <th className="p-4 font-semibold pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                      <td className="p-4 pl-6 font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        {formatEventName(rule.trigger_event)}
                      </td>
                      <td className="p-4 text-center">
                        <input 
                          type="number" 
                          min="1"
                          value={rule.days_threshold}
                          onChange={(e) => handleRuleChange(rule.id, 'days_threshold', parseInt(e.target.value) || 1)}
                          className="w-20 p-1.5 text-sm text-center rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={rule.is_active}
                            onChange={(e) => handleRuleChange(rule.id, 'is_active', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                        </label>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <Button variant="secondary" size="sm" isLoading={savingRuleId === rule.id} onClick={() => saveRule(rule)}>
                          Save Config
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

      {/* TAB 2: Logs */}
      {activeTab === 'logs' && (
        <Card className="overflow-hidden border-red-100 dark:border-red-900/30">
          {logs.length === 0 ? (
            <EmptyState icon="✅" title="All Clear" description="There are currently no active escalation alerts in the system." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-red-50/50 dark:bg-red-900/10">
                  <tr className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-red-100 dark:border-red-900/30">
                    <th className="p-4 font-semibold pl-6">Date Triggered</th>
                    <th className="p-4 font-semibold">Alert Type</th>
                    <th className="p-4 font-semibold">Employee</th>
                    <th className="p-4 font-semibold">Escalated Manager</th>
                    <th className="p-4 font-semibold pr-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                      <td className="p-4 pl-6 text-sm text-gray-500 font-mono">{new Date(log.triggered_at).toLocaleDateString()}</td>
                      <td className="p-4 font-semibold text-red-600 dark:text-red-400 text-sm">{formatEventName(log.trigger_event)}</td>
                      <td className="p-4 font-medium text-gray-900 dark:text-gray-100 text-sm">{log.employee_name}</td>
                      <td className="p-4 text-sm text-gray-600 dark:text-gray-400">{log.manager_name}</td>
                      <td className="p-4 pr-6 text-right">
                        {log.is_resolved ? <Badge variant="success">Resolved</Badge> : <Badge variant="danger">Active Alert</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

    </div>
  );
};