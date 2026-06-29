import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { apiClient } from './api/client';
import { useAppStore } from './store/useAppStore';
import { REQUIRED_ROLES } from './utils/authConstants';

// Layout & Auth Gatekeepers

// Layout & Auth Gatekeepers
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleGate } from './components/auth/RoleGate';

// Components
import { Homepage } from './components/Homepage';
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
import { AdminUsersPage } from './components/AdminUsersPage';

function App() {
  const { user, token, setAuth, logout, theme } = useAppStore();
  const [isInitializing, setIsInitializing] = useState(true);

  // Enforce dark mode class on the HTML document globally
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // JWT session hydration on reload
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const response = await apiClient.get('/auth/me');
        const currentToken = token || localStorage.getItem('zenithokr_token') || 'session';
        setAuth(response.data, currentToken);
      } catch { 
        logout(); 
      } finally {
        setIsInitializing(false);
      }
    };
    initializeAuth();
  }, [setAuth, logout]);

  if (isInitializing) {
    return <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-primary-600">Loading Workspace...</div>;
  }

  return (
    <BrowserRouter>
    <ToastContainer />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Homepage />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />

        {/* Protected App Shell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>

            {/* Core Routes (All Authenticated Users) */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/goals" element={<EmployeeDashboard />} />
            <Route path="/goals/new" element={<GoalForm />} />
            <Route path="/goals/:id/edit" element={<GoalForm />} />
            <Route path="/goals/:id" element={<GoalDetailPage />} />
            <Route path="/checkins" element={<CheckInsPage />} />

            {/* Manager+ Routes */}
            <Route path="/team" element={
              <RoleGate allowedRoles={REQUIRED_ROLES.MANAGER_OR_ADMIN}>
                <TeamGoalsPage /> 
              </RoleGate>
            } />
            {/* Admin+ Routes */}
            <Route path="/approvals" element={
              <RoleGate allowedRoles={REQUIRED_ROLES.MANAGER_OR_ADMIN}>
                   <ApprovalsPage /> 
              </RoleGate>
            } />
            <Route path="/admin/cycles" element={
              <RoleGate allowedRoles={REQUIRED_ROLES.ADMIN_ONLY}>
                <CycleConfigPage /> 
              </RoleGate>
            } />
            <Route path="/admin/reports" element={
              <RoleGate allowedRoles={REQUIRED_ROLES.ADMIN_ONLY}>
                <ReportsPage />
              </RoleGate>
            } />
            <Route path="/admin/audit" element={
              <RoleGate allowedRoles={REQUIRED_ROLES.ADMIN_ONLY}>
                <AdminAuditLogPage />
              </RoleGate>
            } />
            <Route path="/admin/overrides" element={
              <RoleGate allowedRoles={REQUIRED_ROLES.ADMIN_ONLY}>
                <AdminLockedGoalsPage />
              </RoleGate>
            } />
            <Route path="/admin/analytics" element={
              <RoleGate allowedRoles={REQUIRED_ROLES.ADMIN_ONLY}>
                <AdminAnalyticsPage />
              </RoleGate>
            } />
            <Route path="/admin/escalation" element={
              <RoleGate allowedRoles={REQUIRED_ROLES.ADMIN_ONLY}>
                <AdminEscalationPage />
              </RoleGate>
            } />
            <Route path="/admin/users" element={
              <RoleGate allowedRoles={REQUIRED_ROLES.ADMIN_ONLY}>
                <AdminUsersPage />
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