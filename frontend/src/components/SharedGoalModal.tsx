import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiClient } from '../api/client';
import { useToastStore } from '../store/useToastStore';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface Employee {
  id: string;
  name: string;
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

  const { register, handleSubmit, reset } = useForm({
    defaultValues: { title: '', description: '', thrust_area: THRUST_AREAS[0], uom: 'min', target: 0, weightage: 10 }
  });

  const handleClose = () => {
    setStep(1);
    setSelectedRecipients([]);
    setPrimaryOwner("");
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
    if (selectedRecipients.length === employees.length) {
      setSelectedRecipients([]);
      setPrimaryOwner("");
    } else {
      setSelectedRecipients(employees.map(emp => emp.id));
    }
  };

  const onSubmitForm = async (data: any) => {
    if (step === 1) return setStep(2);
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
    } catch (err) {
      addToast("Failed to push shared goal.", "error");
    } finally {
      setSubmitting(false);
    }
  };

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
                {selectedRecipients.length === employees.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {employees.map(emp => (
                <label key={emp.id} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedRecipients.includes(emp.id)}
                    onChange={() => toggleRecipient(emp.id)}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-200">{emp.name}</span>
                </label>
              ))}
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