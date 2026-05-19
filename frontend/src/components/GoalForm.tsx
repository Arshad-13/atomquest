import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';

const THRUST_AREAS = [
  "Financial Performance",
  "Customer Success & Satisfaction",
  "Operational Excellence",
  "Innovation & Product Development",
  "People, Culture & Team",
  "Strategic Growth"
];

const MAX_GOALS = 8;
const MAX_DESC_CHARS = 500;

interface GoalFormData {
  thrust_area: string;
  title: string;
  description: string;
  uom: 'min' | 'max' | 'timeline' | 'zero';
  target: number;
  weightage: number;
}

export const GoalForm = () => {
  const { id } = useParams<{ id: string }>(); // Captures the ID if we are editing
  const isEditMode = !!id;
  const navigate = useNavigate();
  const location = useLocation();
  const returnComment = location.state?.returnComment; // Passed from EmployeeDashboard

  const { user } = useAppStore();
  const { addToast } = useToastStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [baseWeightage, setBaseWeightage] = useState(0); // Total weightage of *other* goals
  const [goalCount, setGoalCount] = useState(0);
  const [fetchedReturnComment, setFetchedReturnComment] = useState<string | null>(null);

  const activeReturnComment = returnComment || fetchedReturnComment;

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<GoalFormData>({
    mode: 'onBlur',
    defaultValues: { weightage: 10, uom: 'min', thrust_area: THRUST_AREAS[0], description: '' }
  });

  const currentWeightage = watch('weightage') || 0;
  const currentDescription = watch('description') || '';
  const totalProjectedWeightage = baseWeightage + Number(currentWeightage);

  useEffect(() => {
    async function initializeForm() {
      if (!user?.id) return;
      try {
        // 1. Fetch all goals to calculate budget and count
        const goalsRes = await apiClient.get(`/goals/${user.id}`);
        const allGoals = goalsRes.data;
        
        setGoalCount(allGoals.length);
        
        // Calculate the weightage used by *other* goals
        const otherGoalsWeightage = allGoals
          .filter((g: any) => g.id !== Number(id))
          .reduce((sum: number, g: any) => sum + g.weightage, 0);
        
        setBaseWeightage(otherGoalsWeightage);

        // 2. If editing, fetch the specific goal to populate the form
        if (isEditMode) {
          const goalToEdit = allGoals.find((g: any) => g.id === Number(id));
          if (goalToEdit) {
            reset(goalToEdit);
            if (goalToEdit.return_comment) {
              setFetchedReturnComment(goalToEdit.return_comment);
            }
          }
        }
      } catch (_error) {
        addToast("Failed to load goal data", "error");
      } finally {
        setLoading(false);
      }
    };

    initializeForm();
  }, [user?.id, id, isEditMode, reset, addToast]);

  const onFormError = (formErrors: any) => {
    console.warn("Validation errors:", formErrors);
    const firstError = Object.values(formErrors)[0] as any;
    if (firstError?.message) {
      addToast(firstError.message, "error");
    } else {
      addToast("Please check all required fields.", "error");
    }
  };

  async function onSubmit(data: GoalFormData, action: 'draft' | 'submit') {
    setSubmitting(true);
    try {
      let savedGoalId = id;

      // 1. Save the Goal (Create or Update)
      const sanitizedData = {
        thrust_area: data.thrust_area,
        title: data.title,
        description: data.description,
        uom: data.uom,
        target: data.target,
        weightage: data.weightage
      };

      if (isEditMode) {
        await apiClient.patch(`/goals/${id}`, sanitizedData);
      } else {
        const payload = { ...sanitizedData, owner_id: user?.id };
        const response = await apiClient.post('/goals', payload);
        savedGoalId = response.data.id;
      }

      // 2. If "Submit for Approval", call the Phase 2 Submit Endpoint
      if (action === 'submit') {
        await apiClient.post(`/goals/${savedGoalId}/submit`);
        addToast("Goal successfully submitted for manager approval!", "success");
      } else {
        addToast("Draft saved successfully.", "success");
      }

      navigate('/goals'); // Return to dashboard
    } catch (error: any) {
      addToast(error.response?.data?.detail || "Failed to save goal.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Spinner className="w-8 h-8 text-primary-600" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEditMode ? 'Edit Goal' : 'Draft New Goal'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Define your objective and success metrics.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/goals')}>Cancel</Button>
      </div>

      {/* Return Comment Banner */}
      {activeReturnComment && (() => {
        const systemChangesMatch = activeReturnComment.match(/\[MANAGER SUGGESTED CHANGES:\s*(.*?)\]/);
        const displayComment = systemChangesMatch 
          ? activeReturnComment.replace(/\[MANAGER SUGGESTED CHANGES:\s*.*?\]/, '').trim() 
          : activeReturnComment;
        const suggestedChanges = systemChangesMatch ? systemChangesMatch[1] : null;

        return (
          <div className="bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/50 p-4 rounded-xl flex gap-3 shadow-sm animate-in slide-in-from-top-4 duration-300">
            <span className="text-red-500 dark:text-red-400 text-xl flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-900 dark:text-red-100">Manager Returned for Rework</h3>
              <div className="mt-1 text-sm text-red-700 dark:text-red-300 whitespace-pre-line leading-relaxed">
                {displayComment}
              </div>
              
              {suggestedChanges && (
                <div className="mt-3 pt-3 border-t border-red-200/50 dark:border-red-900/30">
                  <span className="text-xs font-bold text-red-800 dark:text-red-400 uppercase tracking-wider block mb-2">
                    Manager Recommended Parameters (Pre-filled):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {suggestedChanges.split(' | ').map((change: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        {change}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Live Budget & Limitations Tracker */}
      <Card className="p-5 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-surface-dark border-indigo-100 dark:border-indigo-900/30">
        <div className="flex justify-between items-end mb-2">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Goal Budget Tracker</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {goalCount} of {MAX_GOALS} goals used
            </p>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${totalProjectedWeightage > 100 ? 'text-red-600' : totalProjectedWeightage === 100 ? 'text-green-600' : 'text-primary-600'}`}>
              {totalProjectedWeightage}%
            </span>
            <span className="text-sm text-gray-500"> / 100% Total</span>
          </div>
        </div>

        {/* Live Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 flex overflow-hidden">
          {/* Base weightage from other goals */}
          <div 
            className="bg-indigo-300 h-3"
            style={{ width: `${Math.min(baseWeightage, 100)}%` }}
            title={`Other goals: ${baseWeightage}%`}
          ></div>
          {/* Currently editing weightage */}
          <div 
            className={`h-3 transition-all duration-300 ${totalProjectedWeightage > 100 ? 'bg-red-500' : 'bg-primary-600'}`}
            style={{ width: `${Math.min(Number(currentWeightage) || 0, 100 - baseWeightage)}%` }}
            title={`This goal: ${currentWeightage}%`}
          ></div>
        </div>
        
        {totalProjectedWeightage > 100 && (
          <p className="text-xs text-red-500 mt-2 font-medium">⚠️ Warning: Total weightage across all goals cannot exceed 100%.</p>
        )}
        {totalProjectedWeightage !== 100 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">⚠️ Strict Limit: Total weightage must be exactly 100% to submit sheet for manager approval. (Current: {totalProjectedWeightage}%)</p>
        )}
        {totalProjectedWeightage === 100 && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-semibold">✅ Perfect! Total weightage is exactly 100%. Ready to submit.</p>
        )}
      </Card>

      {/* Main Form */}
      <Card className="p-6">
        <form className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Thrust Area Selector */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Strategic Thrust Area</label>
              <select 
                {...register('thrust_area', { required: true })}
                className="w-full p-2.5 rounded-lg bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow"
              >
                {THRUST_AREAS.map(area => <option key={area} value={area}>{area}</option>)}
              </select>
            </div>

            {/* Goal Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Goal Title</label>
              <input 
                {...register('title', { required: "Title is required", minLength: { value: 5, message: "Title must be at least 5 characters" } })}
                className={`w-full p-2.5 rounded-lg bg-background-light dark:bg-background-dark border focus:ring-2 focus:ring-primary-500 outline-none transition-shadow ${errors.title ? 'border-red-400 dark:border-red-600 ring-1 ring-red-400' : 'border-gray-300 dark:border-gray-700'}`}
                placeholder="e.g., Increase Q2 Enterprise Sales by 15%"
              />
              {errors.title && <span className="text-xs text-red-500 mt-1 block">{errors.title.message}</span>}
            </div>

            {/* Target Value */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Target Number</label>
              <input 
                type="number" step="any"
                {...register('target', { required: "Target is required", valueAsNumber: true, validate: v => !isNaN(v) || 'Must be a valid number' })}
                className={`w-full p-2.5 rounded-lg bg-background-light dark:bg-background-dark border focus:ring-2 focus:ring-primary-500 outline-none transition-shadow ${errors.target ? 'border-red-400 dark:border-red-600 ring-1 ring-red-400' : 'border-gray-300 dark:border-gray-700'}`}
                placeholder="e.g., 100000"
              />
              {errors.target && <span className="text-xs text-red-500 mt-1 block">{errors.target.message}</span>}
            </div>

            {/* UoM */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Unit of Measurement</label>
              <select 
                {...register('uom')}
                className="w-full p-2.5 rounded-lg bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow"
              >
                <option value="min">Numeric (Higher is better)</option>
                <option value="max">Numeric (Lower is better)</option>
                <option value="timeline">Timeline (Days)</option>
                <option value="zero">Zero-based Incident Count</option>
              </select>
            </div>

            {/* Weightage */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Weightage %</label>
              <input 
                type="number" step="0.5"
                {...register('weightage', { 
                  required: "Weightage is required",
                  min: { value: 10, message: "Minimum weightage is 10%" },
                  max: { value: 100, message: "Maximum weightage is 100%" },
                  valueAsNumber: true
                })}
                className={`w-full p-2.5 rounded-lg bg-background-light dark:bg-background-dark border focus:ring-2 focus:ring-primary-500 outline-none transition-shadow ${errors.weightage ? 'border-red-400 dark:border-red-600 ring-1 ring-red-400' : 'border-gray-300 dark:border-gray-700'}`}
              />
              {errors.weightage && <span className="text-xs text-red-500 mt-1 block">{errors.weightage.message}</span>}
            </div>

            {/* Description with Char Count */}
            <div className="md:col-span-2">
              <div className="flex justify-between items-end mb-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Action Plan / Description</label>
                <span className={`text-xs ${currentDescription.length > MAX_DESC_CHARS ? 'text-red-500' : 'text-gray-500'}`}>
                  {currentDescription.length} / {MAX_DESC_CHARS}
                </span>
              </div>
              <textarea 
                {...register('description', { maxLength: MAX_DESC_CHARS })}
                rows={4}
                className="w-full p-2.5 rounded-lg bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow"
                placeholder="Briefly describe how you plan to achieve this..."
              />
            </div>

          </div>

          {/* Form Actions */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              onClick={handleSubmit((data) => onSubmit(data, 'draft'), onFormError)}
              disabled={submitting || totalProjectedWeightage > 100 || goalCount >= MAX_GOALS && !isEditMode}
            >
              Save as Draft
            </Button>
            
            {/* The primary submit button is strict. It requires exactly 100% total weightage to be pushed to the manager */}
            <Button 
              type="button" 
              variant="primary" 
              isLoading={submitting}
              onClick={handleSubmit((data) => onSubmit(data, 'submit'), onFormError)}
              disabled={totalProjectedWeightage !== 100}
              title={totalProjectedWeightage !== 100 ? "Total weightage must be exactly 100% to submit for approval." : ""}
            >
              Submit for Approval
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};