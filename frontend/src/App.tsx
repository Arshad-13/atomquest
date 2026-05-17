import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { apiClient } from './api/client';
import { useAppStore } from './store/useAppStore';


// Layout & Auth Gatekeepers
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleGate } from './components/auth/RoleGate';

// Components
import { Login } from './components/Login';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { GoalForm } from './components/GoalForm';
import { ToastContainer } from './components/ui/ToastContainer';
import { DashboardPage } from './components/DashboardPage';
import { GoalDetailPage } from './components/GoalDetailPage';
import { CheckInsPage } from './components/CheckInsPage';
import { TeamGoalsPage } from './components/TeamGoalsPage';
import { ApprovalsPage } from './components/ApprovalsPage';
import { CycleConfigPage } from './components/CycleConfigPage';
import { AdminLockedGoalsPage } from './components/AdminLockedGoalsPage';
import { AdminAuditLogPage } from './components/AdminAuditLogPage';
import { ReportsPage } from './components/ReportsPage';
import { AdminAnalyticsPage } from './components/AdminAnalyticsPage';
import { AdminEscalationPage } from './components/AdminEscalationPage';

function App() {
  const { user, token, setAuth, logout } = useAppStore();
  const [isInitializing, setIsInitializing] = useState(true);

  // JWT session hydration on reload
  useEffect(() => {
    const initializeAuth = async () => {
      if (token && !user) {
        try {
          const response = await apiClient.get('/auth/me');
          setAuth(response.data, token);
        } catch { logout(); }
      }
      setIsInitializing(false);
    };
    initializeAuth();
  }, [token, user, setAuth, logout]);

  if (isInitializing) {
    return <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-primary-600">Loading Workspace...</div>;
  }

  return (
    <BrowserRouter>
    <ToastContainer />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

        {/* Protected App Shell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            
            {/* Base Redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Core Routes (All Authenticated Users) */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/goals" element={<EmployeeDashboard />} />
            <Route path="/goals/new" element={<GoalForm />} />
            <Route path="/goals/:id/edit" element={<GoalForm />} />
            <Route path="/goals/:id" element={<GoalDetailPage />} />
            <Route path="/checkins" element={<CheckInsPage />} />

            {/* Manager+ Routes */}
            <Route path="/team" element={
              <RoleGate allowedRoles={['manager', 'admin']}>
                <TeamGoalsPage /> 
              </RoleGate>
            } />
            {/* Admin+ Routes */}
            <Route path="/approvals" element={
              <RoleGate allowedRoles={['manager', 'admin']}>
                  <ApprovalsPage /> 
              </RoleGate>
            } />
            <Route path="/admin/cycles" element={
              <RoleGate allowedRoles={['admin']}>
                <CycleConfigPage /> 
              </RoleGate>
            } />
            <Route path="/admin/reports" element={
              <RoleGate allowedRoles={['admin']}>
                <ReportsPage />
              </RoleGate>
            } />
            <Route path="/admin/audit" element={
              <RoleGate allowedRoles={['admin']}>
                <AdminAuditLogPage />
              </RoleGate>
            } />
            <Route path="/admin/overrides" element={
              <RoleGate allowedRoles={['admin']}>
                <AdminLockedGoalsPage />
              </RoleGate>
            } />
            <Route path="/admin/analytics" element={
              <RoleGate allowedRoles={['admin']}>
                <AdminAnalyticsPage />
              </RoleGate>
            } />
            <Route path="/admin/escalation" element={
              <RoleGate allowedRoles={['admin']}>
                <AdminEscalationPage />
              </RoleGate>
            } />
          </Route>
        </Route>

        {/* Catch-All 404 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;