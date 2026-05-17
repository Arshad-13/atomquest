import type { ReactNode } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Link } from 'react-router-dom';

interface RoleGateProps {
  allowedRoles: ('employee' | 'manager' | 'admin')[];
  children: ReactNode;
}

export const RoleGate = ({ allowedRoles, children }: RoleGateProps) => {
  const { user } = useAppStore();

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center text-3xl mb-4">
          🔒
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          403 Access Denied
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
          Your current role ({user?.role}) does not have the required permissions to view this workspace.
        </p>
        <Link 
          to="/dashboard" 
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded shadow transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};