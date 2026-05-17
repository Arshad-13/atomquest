import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';
import { Modal } from './ui/Modal';

interface UserDirectoryEntry {
  id: string;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'admin';
  total_weightage: number;
  is_locked: boolean;
  manager_id: string | null;
  manager_name: string | null;
}

export const AdminUsersPage = () => {
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserDirectoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<'all' | 'employee' | 'manager' | 'admin'>('all');

  // Provision Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    manager_id: ""
  });

  // Password Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<UserDirectoryEntry | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [submittingReset, setSubmittingReset] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/admin/users');
      setUsers(response.data);
    } catch (err) {
      addToast("Failed to load user directory.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOpenModal = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "employee",
      manager_id: ""
    });
    setModalOpen(true);
  };

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validations
    if (!formData.name.trim()) return addToast("Full Name is required.", "error");
    if (!formData.email.trim() || !formData.email.includes("@")) {
      return addToast("A valid email address is required.", "error");
    }
    if (!formData.password || formData.password.length < 6) {
      return addToast("Password must be at least 6 characters.", "error");
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        manager_id: formData.manager_id || null
      };

      await apiClient.post('/admin/users', payload);
      addToast(`Successfully registered ${formData.name} in the system!`, "success");
      setModalOpen(false);
      fetchUsers(); // Reload directory
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to provision new account.";
      addToast(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // PASSWORD RESET HANDLER
  const handleOpenResetModal = (u: UserDirectoryEntry) => {
    setSelectedUserForReset(u);
    setResetPassword("");
    setResetModalOpen(true);
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset) return;
    if (!resetPassword || resetPassword.length < 6) {
      return addToast("New password must be at least 6 characters.", "error");
    }

    setSubmittingReset(true);
    try {
      await apiClient.post(`/admin/users/${selectedUserForReset.id}/reset-password`, {
        password: resetPassword
      });
      addToast(`Successfully reset password for ${selectedUserForReset.name}!`, "success");
      setResetModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to reset password.";
      addToast(msg, "error");
    } finally {
      setSubmittingReset(false);
    }
  };

  // Filtered List
  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  // Get potential reporting managers (Managers or Admins)
  const potentialManagers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  if (loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner className="w-8 h-8 text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Employee Directory</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage active corporate directories and securely provision new local login credentials.</p>
        </div>
        
        <Button variant="primary" onClick={handleOpenModal}>
          ➕ Add New Employee
        </Button>
      </div>

      {/* Control Console (Search & Filter) */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        
        {/* Search */}
        <input 
          type="text"
          placeholder="Search directory by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark outline-none focus:ring-2 focus:ring-primary-500 w-full md:w-80"
        />

        {/* Role Pills */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: 'All Accounts', value: 'all' },
            { label: 'Employees', value: 'employee' },
            { label: 'Managers', value: 'manager' },
            { label: 'Admins', value: 'admin' },
          ].map(p => (
            <button
              key={p.value}
              onClick={() => setRoleFilter(p.value as any)}
              className={`text-xs px-3.5 py-1.5 font-bold rounded-full border transition-all ${
                roleFilter === p.value 
                  ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Directory Table */}
      <Card className="overflow-hidden">
        {filteredUsers.length === 0 ? (
          <EmptyState icon="👥" title="No directory entries found" description="There are currently no accounts matching your search or filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="p-4 font-semibold pl-6">Employee Details</th>
                  <th className="p-4 font-semibold">Account Role</th>
                  <th className="p-4 font-semibold text-center">Scorecard Weightage</th>
                  <th className="p-4 font-semibold text-center">Sheet Status</th>
                  <th className="p-4 font-semibold text-center">Reporting Manager</th>
                  <th className="p-4 font-semibold pr-6 text-right">System Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-surface-dark">
                {filteredUsers.map((u) => {
                  const roleColors = {
                    employee: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
                    manager: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800',
                    admin: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                  };

                  return (
                    <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                      
                      {/* Employee Details */}
                      <td className="p-4 pl-6">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{u.name}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </td>

                      {/* Account Role Badge */}
                      <td className="p-4">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${roleColors[u.role]}`}>
                          {u.role}
                        </span>
                      </td>

                      {/* Scorecard Weightage */}
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{u.total_weightage}% / 100%</span>
                          <div className="w-20 bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                u.total_weightage === 100 
                                  ? 'bg-green-500' 
                                  : u.total_weightage > 100 
                                    ? 'bg-red-500 animate-pulse' 
                                    : 'bg-primary-500'
                              }`} 
                              style={{ width: `${Math.min(u.total_weightage, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Sheet lock status */}
                      <td className="p-4 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                          u.is_locked 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {u.is_locked ? '🔒 Approved' : '📝 In Progress'}
                        </span>
                      </td>

                      {/* Reporting Manager */}
                      <td className="p-4 text-center text-sm text-gray-600 dark:text-gray-400 font-medium">
                        {u.manager_name ? u.manager_name : <span className="text-gray-400 font-normal">—</span>}
                      </td>

                      {/* Reset Password Action */}
                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => handleOpenResetModal(u)}
                          className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 px-2.5 py-1 rounded transition-colors"
                        >
                          🔑 Reset Password
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Employee Modal */}
      <Modal isOpen={modalOpen} onClose={() => !submitting && setModalOpen(false)} title="Provision New Employee Profile">
        <form onSubmit={handleProvisionUser} className="space-y-4">
          
          <div className="bg-primary-50 border-l-4 border-primary-500 p-3 text-xs text-primary-800 dark:bg-primary-900/20 dark:text-primary-400">
            <strong>Local Provisioning:</strong> Registering an account here instantly creates local `bcrypt` login credentials. Azure SSO accounts are managed directly on the Azure AD / Entra console.
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              Full Name
            </label>
            <input 
              type="text" 
              name="name"
              placeholder="e.g. Anita Desai"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <input 
              type="email" 
              name="email"
              placeholder="e.g. anita.desai@company.com"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              Secure Password (Min 6 chars)
            </label>
            <input 
              type="password" 
              name="password"
              placeholder="Create login password..."
              value={formData.password}
              onChange={handleInputChange}
              className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 outline-none"
              required
            />
          </div>

          {/* Role & Manager Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* System Role */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                System Role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">HR Admin</option>
              </select>
            </div>

            {/* Reporting Manager */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                Reporting Manager
              </label>
              <select
                name="manager_id"
                value={formData.manager_id}
                onChange={handleInputChange}
                className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-surface-dark focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">No Manager (Direct Admin / Root)</option>
                {potentialManagers.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.role.toUpperCase()})</option>
                ))}
              </select>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Create Employee Profile
            </Button>
          </div>

        </form>
      </Modal>

      {/* Force Reset Password Modal */}
      <Modal isOpen={resetModalOpen} onClose={() => !submittingReset && setResetModalOpen(false)} title="Force Reset Local Password">
        <form onSubmit={handleResetConfirm} className="space-y-4">
          
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
            <strong>Warning:</strong> You are about to override the password for <strong>{selectedUserForReset?.name}</strong>. They will immediately lose access with their old password and will need this new one to log in.
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              New Secure Password (Min 6 chars)
            </label>
            <input 
              type="password" 
              placeholder="Enter new account password..."
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-amber-500 outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setResetModalOpen(false)} disabled={submittingReset}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" className="bg-amber-600 hover:bg-amber-700 text-white" isLoading={submittingReset}>
              Confirm Password Reset
            </Button>
          </div>

        </form>
      </Modal>

    </div>
  );
};
