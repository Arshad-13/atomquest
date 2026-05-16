import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { apiClient } from '../api/client';

// Types mapping to your FastAPI Pydantic schema
interface GoalFormData {
  thrust_area: string;
  title: string;
  description: string;
  uom: 'min' | 'max' | 'timeline' | 'zero';
  target: number;
  weightage: number;
}

export const GoalForm = () => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<GoalFormData>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const onSubmit = async (data: GoalFormData) => {
    setServerError(null);
    setSuccessMsg(null);
    
    try {
      // DEV MODE: Hardcoding the owner_id since we bypassed Azure AD
      const payload = { ...data, owner_id: "dev-user-001" }; 
      
      const response = await apiClient.post('/goals', payload);
      setSuccessMsg(`Goal "${response.data.title}" created successfully!`);
      reset(); // Clear the form
    } catch (error: any) {
      // Catch the HTTP 400 errors from FastAPI (e.g., > 100% weightage)
      if (error.response && error.response.data) {
        setServerError(error.response.data.detail);
      } else {
        setServerError("An unexpected error occurred.");
      }
    }
  };

  return (
    <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mt-6">
      <h3 className="text-xl font-semibold text-primary-700 dark:text-primary-400 mb-4">
        Create New Goal
      </h3>
      
      {serverError && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm border border-red-200 dark:border-red-800">
          ⚠️ {serverError}
        </div>
      )}
      
      {successMsg && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-sm border border-green-200 dark:border-green-800">
          ✅ {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Thrust Area */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Thrust Area</label>
            <input 
              {...register('thrust_area', { required: "Thrust Area is required" })}
              className="w-full p-2 rounded bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="e.g., Q2 Revenue"
            />
            {errors.thrust_area && <span className="text-xs text-red-500">{errors.thrust_area.message}</span>}
          </div>

          {/* Goal Title */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Goal Title</label>
            <input 
              {...register('title', { required: "Title is required" })}
              className="w-full p-2 rounded bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="e.g., Increase B2B Sales"
            />
            {errors.title && <span className="text-xs text-red-500">{errors.title.message}</span>}
          </div>

          {/* Unit of Measurement */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Unit of Measurement (UoM)</label>
            <select 
              {...register('uom')}
              className="w-full p-2 rounded bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="min">Numeric (Higher is better)</option>
              <option value="max">Numeric (Lower is better)</option>
              <option value="timeline">Timeline (Date-based)</option>
              <option value="zero">Zero-based (e.g., Safety incidents)</option>
            </select>
          </div>

          {/* Target */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Target Value</label>
            <input 
              type="number" step="any"
              {...register('target', { required: "Target is required" })}
              className="w-full p-2 rounded bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
            />
            {errors.target && <span className="text-xs text-red-500">{errors.target.message}</span>}
          </div>

          {/* Weightage */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              Weightage % (Minimum 10%)
            </label>
            <input 
              type="number" step="0.1"
              {...register('weightage', { 
                required: "Weightage is required",
                min: { value: 10, message: "Minimum weightage is 10%" }
              })}
              className="w-full p-2 rounded bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
            />
            {errors.weightage && <span className="text-xs text-red-500">{errors.weightage.message}</span>}
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Description</label>
            <textarea 
              {...register('description')}
              rows={3}
              className="w-full p-2 rounded bg-background-light dark:bg-background-dark border border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Briefly describe how this will be achieved..."
            />
          </div>
        </div>

        <button 
          type="submit"
          className="mt-4 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded shadow transition-colors"
        >
          Submit Goal
        </button>
      </form>
    </div>
  );
};