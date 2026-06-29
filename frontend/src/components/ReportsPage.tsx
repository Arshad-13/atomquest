import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useToastStore } from '../store/useToastStore';
import { useAppStore } from '../store/useAppStore';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';
import { TrendingDown, Download } from 'lucide-react';


import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AchievementRow {
  quarter: string;
  employee_name: string;
  goal_title: string;
  planned_target: number;
  uom: string;
  actual_achievement: number;
  status: string;
}

interface CompletionData {
  department: string;
  Q1: number;
  Q2: number;
  Q3: number;
  Q4: number;
}

export const ReportsPage = () => {
  const { addToast } = useToastStore();
  const { theme } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'achievement' | 'completion'>('achievement');

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#334155' : '#e5e7eb';
  const textColor = isDark ? '#94a3b8' : '#6b7280';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#475569' : '#e2e8f0';
  const tooltipText = isDark ? '#f8fafc' : '#0f172a';
  
  const [achievementData, setAchievementData] = useState<AchievementRow[]>([]);
  const [completionData, setCompletionData] = useState<CompletionData[]>([]);
  const [downloadingCSV, setDownloadingCSV] = useState(false);

  async function fetchReports() {
    try {
      const [achieveRes, compRes] = await Promise.all([
        apiClient.get('/reports/achievement'),
        apiClient.get('/reports/completion')
      ]);
      setAchievementData(achieveRes.data);
      setCompletionData(compRes.data);
    } catch {
      addToast("Failed to load corporate reports.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []);

  async function handleDownloadCSV() {
    setDownloadingCSV(true);
    try {
      // Direct fetch to handle the Blob response correctly
      const token = useAppStore.getState().token || localStorage.getItem('zenithokr_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/reports/achievement?format=csv`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `corporate_achievement_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      addToast("CSV Download initialized.", "success");
    } catch {
      addToast("Failed to download CSV.", "error");
    } finally {
      setDownloadingCSV(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Executive Reports</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Analyze organizational performance and compliance metrics.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800 flex gap-6">
        <button
          onClick={() => setActiveTab('achievement')}
          className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'achievement' ? 'text-primary-600 border-b-2 border-primary-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Planned vs Actual
        </button>
        <button
          onClick={() => setActiveTab('completion')}
          className={`pb-3 text-sm font-medium transition-colors ${activeTab === 'completion' ? 'text-primary-600 border-b-2 border-primary-600 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Compliance Trends
        </button>
      </div>

      {/* TAB 1: Achievement Data */}
      {activeTab === 'achievement' && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/20">
            <h3 className="font-semibold text-gray-900 dark:text-white">Quarterly Objective Achievements</h3>
            <Button variant="primary" size="sm" className="flex items-center gap-1.5" onClick={handleDownloadCSV} isLoading={downloadingCSV}>
              <Download className="w-3.5 h-3.5" /> Download CSV
            </Button>
          </div>
          
          {achievementData.length === 0 ? (
             <EmptyState icon={<TrendingDown className="w-8 h-8 text-indigo-500" />} title="No check-in data available" description="Achievement data will populate here once employees begin logging quarterly progress." />
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
                  <tr className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="p-4 font-semibold">Quarter</th>
                    <th className="p-4 font-semibold">Employee</th>
                    <th className="p-4 font-semibold">Goal Objective</th>
                    <th className="p-4 font-semibold text-right">Target</th>
                    <th className="p-4 font-semibold text-right">Actual</th>
                    <th className="p-4 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-surface-dark">
                  {achievementData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                      <td className="p-4 text-sm font-medium text-primary-600">{row.quarter}</td>
                      <td className="p-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{row.employee_name}</td>
                      <td className="p-4 text-sm text-gray-700 dark:text-gray-300 truncate max-w-[300px]">{row.goal_title}</td>
                      <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-100 text-right">{row.planned_target} <span className="text-[10px] text-gray-400">{row.uom}</span></td>
                      <td className="p-4 text-sm font-bold text-gray-900 dark:text-gray-100 text-right">{row.actual_achievement}</td>
                      <td className="p-4 text-xs font-medium uppercase text-center text-gray-500">{row.status.replace('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: Completion Rates Chart */}
      {activeTab === 'completion' && (
        <Card className="p-6">
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Check-in Compliance Rate by Department</h3>
            <p className="text-sm text-gray-500">Percentage of expected quarterly progress logs successfully submitted.</p>
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="department" tick={{ fill: textColor }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(tick) => `${tick}%`} tick={{ fill: textColor }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipText }}
                  labelStyle={{ color: tooltipText }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                
                <Bar dataKey="Q1" name="Q1 Window" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Q2" name="Q2 Window" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Q3" name="Q3 Window" fill="#ec4899" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Q4" name="Q4 Window" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

    </div>
  );
};