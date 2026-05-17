import type { ReactNode } from 'react';

export const EmptyState = ({ title, description, icon, action }: { title: string, description: string, icon?: string, action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-900/20">
    <div className="text-4xl mb-4 opacity-50">{icon || '📁'}</div>
    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">{description}</p>
    {action}
  </div>
);