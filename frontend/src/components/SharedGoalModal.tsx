import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiClient } from '../api/client';
import { useToastStore } from '../store/useToastStore';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface Employee {
  id: string;
  name: string;
  role: string;
  total_weightage: number;
  is_locked: boolean;
}

interface SharedGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onGoalCreated: () => void;
}

const THRUST_AREAS = [
  "Financial Performance",
  "Customer Success & Satisfaction",
  "Operational Excellence",
  "Innovation & Product Development",
  "Strategic Growth"
];

export const SharedGoalModal = ({ isOpen, onClose, employees, onGoalCreated }: SharedGoalModalProps) => {
  const { addToast } = useToastStore();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [primaryOwner, setPrimaryOwner] = useState<string>("");

  // Step 2 Filters
  const [roleFilter, setRoleFilter] = useState<'all' | 'employee' | 'manager'>('all');
  const [feasibilityFilter, setFeasibilityFilter] = useState<'all' | 'fits' | 'exceeds'>('all');

  const { register, handleSubmit, reset, watch } = useForm({
    defaultValues: { title: '', description: '', thrust_area: THRUST_AREAS[0], uom: 'min', target: 0, weightage: 10 }
  });

  const currentGoalWeightage = watch('weightage') || 0;

  const handleClose = () => {
    setStep(1);
    setSelectedRecipients([]);
    setPrimaryOwner("");
    setRoleFilter('all');
    setFeasibilityFilter('all');
    reset();
    onClose();
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
    // If we unselect the primary owner, clear the primary owner
    if (primaryOwner === id) setPrimaryOwner("");
  };

  const selectAll = () => {
    if (selectedRecipients.length === filteredEmployeesList.length) {
      // Clear only those in the current filtered list
      setSelectedRecipients(prev => prev.filter(id => !filteredEmployeesList.some(emp => emp.id === id)));
      setPrimaryOwner("");
    } else {
      // Add all from current filtered list
      setSelectedRecipients(prev => {
        const unique = new Set([...prev, ...filteredEmployeesList.map(emp => emp.id)]);
        return Array.from(unique);
      });
    }
  };

  async function onSubmitForm(data: any) {
    if (step === 1) {
      if (!data.title) return addToast("Shared goal title is required.", "error");
      if (data.weightage <= 0) return addToast("Weightage must be greater than 0%.", "error");
      return setStep(2);
    }
    if (step === 2) {
      if (selectedRecipients.length === 0) return addToast("Select at least one recipient.", "error");
      return setStep(3);
    }
    
    // Step 3: Final Submission
    if (!primaryOwner) return addToast("You must designate a Primary Owner.", "error");

    setSubmitting(true);
    try {
      await apiClient.post('/goals/shared', {
        ...data,
        recipient_ids: selectedRecipients,
        primary_owner_id: primaryOwner
      });
      addToast("Shared Goal successfully cascaded to team.", "success");
      onGoalCreated();
      handleClose();
    } catch {
      addToast("Failed to push shared goal.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Compute list based on filters
  const filteredEmployeesList = employees.filter(emp => {
    // 1. Role Filter
    if (roleFilter !== 'all' && emp.role !== roleFilter) return false;

    // 2. Feasibility Filter
    const newTotal = emp.total_weightage + currentGoalWeightage;
    const fits = newTotal <= 100;
    if (feasibilityFilter === 'fits' && !fits) return false;
    if (feasibilityFilter === 'exceeds' && fits) return false;

    return true;
  });

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Push Shared Goal">
      
      {/* Progress Indicators */}
      <div className="flex items-center justify-between mb-6 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-800 -z-10 transform -translate-y-1/2"></div>
        {[1, 2, 3].map(i => (
          <div key={i} className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-bold ${
            step >= i ? 'bg-primary-600 border-primary-600 text-white' : 'bg-surface-light dark:bg-surface-dark border-gray-300 text-gray-400'
          } transition-colors`}>
            {i}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
        
        {/* STEP 1: Define Goal */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Step 1: Define Objective</h3>
            
            <input {...register('title', { required: true })} className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Shared Goal Title" />
            
            <select {...register('thrust_area')} className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 outline-none">
              {THRUST_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Target Value</label>
                <input type="number" step="any" {...register('target', { valueAsNumber: true, required: true })} className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Target" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Unit of Measure</label>
                <select {...register('uom')} className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="min">Higher is better</option>
                  <option value="max">Lower is better</option>
                  <option value="zero">Zero-based</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Weightage %</label>
                <input type="number" {...register('weightage', { valueAsNumber: true })} className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Weightage %" />
              </div>
            </div>
            
            <textarea {...register('description')} rows={2} className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Execution Plan / Description" />
          </div>
        )}

        {/* STEP 2: Select Recipients */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 dark:text-white">Step 2: Select Recipients</h3>
              <button type="button" onClick={selectAll} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                {selectedRecipients.length === filteredEmployeesList.length ? 'Deselect All Filtered' : 'Select All Filtered'}
              </button>
            </div>

            {/* Role Filter Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800">
              <button 
                type="button" 
                onClick={() => setRoleFilter('all')} 
                className={`py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
                  roleFilter === 'all' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'
                }`}
              >
                All Roles ({employees.length})
              </button>
              <button 
                type="button" 
                onClick={() => setRoleFilter('employee')} 
                className={`py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
                  roleFilter === 'employee' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'
                }`}
              >
                Employees ({employees.filter(e => e.role === 'employee').length})
              </button>
              <button 
                type="button" 
                onClick={() => setRoleFilter('manager')} 
                className={`py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
                  roleFilter === 'manager' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400'
                }`}
              >
                Managers ({employees.filter(e => e.role === 'manager').length})
              </button>
            </div>

            {/* Feasibility Filter Pills */}
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setFeasibilityFilter('all')} 
                className={`text-[10px] px-2.5 py-1 font-bold rounded-full border transition-all ${
                  feasibilityFilter === 'all' 
                    ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200' 
                    : 'bg-transparent border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                All Availability
              </button>
              <button 
                type="button" 
                onClick={() => setFeasibilityFilter('fits')} 
                className={`text-[10px] px-2.5 py-1 font-bold rounded-full border transition-all ${
                  feasibilityFilter === 'fits' 
                    ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800' 
                    : 'bg-transparent border-transparent text-gray-400 hover:text-green-500'
                }`}
              >
                Fits Perfectly (Total &lt;= 100%)
              </button>
              <button 
                type="button" 
                onClick={() => setFeasibilityFilter('exceeds')} 
                className={`text-[10px] px-2.5 py-1 font-bold rounded-full border transition-all ${
                  feasibilityFilter === 'exceeds' 
                    ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800' 
                    : 'bg-transparent border-transparent text-gray-400 hover:text-amber-500'
                }`}
              >
                Auto-Unlocks Sheet (Total &gt; 100%)
              </button>
            </div>
            
            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-surface-dark">
              {filteredEmployeesList.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">No employees match these filters.</div>
              ) : (
                filteredEmployeesList.map(emp => {
                  const newTotal = emp.total_weightage + currentGoalWeightage;
                  const fits = newTotal <= 100;
                  
                  return (
                    <label key={emp.id} className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer">
                      <div className="flex items-center min-w-0 mr-4">
                        <input 
                          type="checkbox" 
                          checked={selectedRecipients.includes(emp.id)}
                          onChange={() => toggleRecipient(emp.id)}
                          className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                        />
                        <div className="ml-3 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-200 truncate">{emp.name}</p>
                          <span className="inline-block mt-0.5 text-[9px] uppercase tracking-wider font-bold text-primary-500">
                            {emp.role}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          Allocated: {emp.total_weightage}%
                        </p>
                        <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          fits 
                            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800' 
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {fits ? `Fits (${newTotal}%)` : `Unlocks Sheet (${newTotal}%)`}
                        </span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Primary Owner */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Step 3: Designate Primary Owner</h3>
            <p className="text-xs text-gray-500">The Primary Owner is responsible for logging the quarterly actual achievements. This value will sync to all other recipients automatically.</p>
            
            <select 
              value={primaryOwner} 
              onChange={(e) => setPrimaryOwner(e.target.value)}
              className="w-full p-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="" disabled>Select Owner...</option>
              {employees.filter(emp => selectedRecipients.includes(emp.id)).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex justify-between">
          <Button type="button" variant="secondary" onClick={step === 1 ? handleClose : () => setStep(step - 1)}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button type="submit" variant="primary" isLoading={submitting}>
            {step === 3 ? 'Push to Team' : 'Continue →'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};