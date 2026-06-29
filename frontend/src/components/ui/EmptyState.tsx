import type { ReactNode } from 'react';
import { Folder } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export const EmptyState = ({ title, description, icon, action }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl bg-white dark:bg-slate-900/50 shadow-sm transition-all duration-300 hover:shadow-md animate-in fade-in zoom-in-95 duration-500">
      {/* Decorative Outer Circle */}
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center mb-5 border border-indigo-100/50 dark:border-indigo-900/20 relative group-hover:scale-105 transition-transform duration-300">
        {icon ? (
          <div className="text-indigo-600 dark:text-indigo-400">{icon}</div>
        ) : (
          <Folder className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        )}
        {/* Glow halo */}
        <div className="absolute -inset-0.5 bg-indigo-500/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      <h3 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 mb-2">
        {title}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm leading-relaxed">
        {description}
      </p>

      {action && (
        <div className="animate-in fade-in slide-in-from-bottom-2 delay-150 duration-500">
          {action}
        </div>
      )}
    </div>
  );
};