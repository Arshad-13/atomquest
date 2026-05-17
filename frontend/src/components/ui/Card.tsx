import type { ReactNode } from 'react';

export const Card = ({ children, className = '' }: { children: ReactNode, className?: string }) => (
  <div className={`bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm ${className}`}>
    {children}
  </div>
);