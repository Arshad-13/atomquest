import { useAppStore } from '../store/useAppStore';
import { EmployeeDashboard } from './EmployeeDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { AdminDashboard } from './AdminDashboard';

export const DashboardPage = () => {
  const { user } = useAppStore();

  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }
  if (user?.role === 'manager') {
    return <ManagerDashboard />;
  }
  return <EmployeeDashboard />;
};