import { useEffect } from 'react';
import { useToastStore } from '../../store/useToastStore';

export const ToastContainer = () => {
  const { toasts, removeToast, addToast } = useToastStore();

  // Listen for api-error events dispatched by the Axios response interceptor
  useEffect(() => {
    const handler = (e: Event) => {
      const { type, message } = (e as CustomEvent).detail;
      addToast(message, type);
    };
    window.addEventListener('api-error', handler);
    return () => window.removeEventListener('api-error', handler);
  }, [addToast]);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div 
          key={toast.id} 
          className={`flex items-center justify-between p-4 min-w-[300px] rounded-lg shadow-lg border animate-in slide-in-from-right-8 duration-300 ${
            toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/50 dark:border-green-800 dark:text-green-200' :
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/50 dark:border-red-800 dark:text-red-200' :
            'bg-white border-gray-200 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200'
          }`}
        >
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} className="ml-4 opacity-70 hover:opacity-100">✕</button>
        </div>
      ))}
    </div>
  );
};