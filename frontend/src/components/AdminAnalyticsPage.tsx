import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useToastStore } from '../store/useToastStore';
import { useAppStore } from '../store/useAppStore';
import { Card } from './ui/Card';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface QoQTrend {

  quarter: string;
  Engineering: number;
  Management: number;
}

interface GoalDistribution {
  name: string;
  value: number;
}

interface UoMBreakdown {
  name: string;
  count: number;
}

interface ManagerEffectiveness {
  name: string;
  completionRate: number;
}

interface ExecutiveAnalytics {
  qoq_trends: QoQTrend[];
  goal_distribution: GoalDistribution[];
  uom_breakdown: UoMBreakdown[];
  manager_effectiveness: ManagerEffectiveness[];
}

const METRIC_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6'];

export const AdminAnalyticsPage = () => {
  const { addToast } = useToastStore();
  const { theme } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ExecutiveAnalytics | null>(null);

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#334155' : '#e5e7eb';
  const textColor = isDark ? '#94a3b8' : '#6b7280';
  const labelColor = isDark ? '#cbd5e1' : '#4b5563';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#475569' : '#e2e8f0';
  const tooltipText = isDark ? '#f8fafc' : '#0f172a';

  useEffect(() => {
    async function fetchExecutiveMetrics() {
      try {
        const response = await apiClient.get('/admin/executive-analytics');
        setAnalytics(response.data);
      } catch {
        addToast("Failed to compile system organizational analytics data profiles.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchExecutiveMetrics();
  }, [addToast]);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;
  }

  if (!analytics) {
    return <EmptyState icon={<BarChart3 className="w-8 h-8" />} title="Analytics Pipeline Down" description="Unable to connect with the structural processing cluster data models." />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Context Description Banner */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Executive Intelligence Dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          High-density organizational charts evaluating structural trends, configuration matrices, alignment distributions, and direct operational metrics.
        </p>
      </div>

      {/* Main 2x2 High-Density Analytics Matrix Grid Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CHART 1: QoQ Trends by Department */}
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">QoQ Performance Trajectory</h3>
            <p className="text-xs text-gray-500">Evaluates weighted progression parameters mapped longitudinally across functional operational boundaries.</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.qoq_trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="quarter" tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => `${val}%`} tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipText }} labelStyle={{ color: tooltipText }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="Engineering" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Management" stroke="#a855f7" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* CHART 2: Goal Distribution by Strategic Thrust Area */}
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Strategic Alignment Configuration Matrix</h3>
            <p className="text-xs text-gray-500">Structural mapping evaluating active operational clusters registered across corporate target objectives.</p>
          </div>
          <div className="h-72 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="w-full sm:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.goal_distribution}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {analytics.goal_distribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={METRIC_COLORS[index % METRIC_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipText }} labelStyle={{ color: tooltipText }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Custom high-density legend block */}
            <div className="w-full sm:w-1/2 space-y-1.5 max-h-64 overflow-y-auto pr-2">
              {analytics.goal_distribution.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate mr-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: METRIC_COLORS[index % METRIC_COLORS.length] }}></div>
                    <span className="text-gray-600 dark:text-gray-300 font-medium truncate" title={item.name}>{item.name}</span>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* CHART 3: UoM Breakdown Strategy */}
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Measurement Modality Segmentations</h3>
            <p className="text-xs text-gray-500">Distribution analysis of selected target units of measurement deployed across systems execution.</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.uom_breakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipText }} labelStyle={{ color: tooltipText }} />
                <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* CHART 4: L1 Manager Effectiveness Tracker */}
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Leadership Compliance Matrix</h3>
            <p className="text-xs text-gray-500">Evaluates tracking check-in data validation execution cycles sorted across assigned L1 management blocks.</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.manager_effectiveness} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke={gridColor} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(val) => `${val}%`} tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: labelColor, fontSize: 11, fontWeight: 500 }} width={90} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, borderRadius: '8px', color: tooltipText }} labelStyle={{ color: tooltipText }} />
                <Bar dataKey="completionRate" name="Team Log Compliance Rate" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

      </div>
    </div>
  );
};