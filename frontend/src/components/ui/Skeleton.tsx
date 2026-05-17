export const SkeletonBar = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md ${className}`} />
);

/** Three stat cards (for Dashboard, AdminDashboard) */
export const StatCardsSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50">
        <SkeletonBar className="h-3 w-24 mb-3" />
        <SkeletonBar className="h-8 w-16" />
      </div>
    ))}
  </div>
);

/** Table with N rows (for goal lists, team views, audit log) */
export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
    {/* Header */}
    <div className="bg-gray-50 dark:bg-gray-900/50 p-4 flex gap-4 border-b border-gray-200 dark:border-gray-800">
      {[...Array(cols)].map((_, i) => (
        <SkeletonBar key={i} className="h-3 flex-1" />
      ))}
    </div>
    {/* Rows */}
    {[...Array(rows)].map((_, r) => (
      <div key={r} className="p-4 flex gap-4 border-b last:border-0 border-gray-100 dark:border-gray-800/60">
        {[...Array(cols)].map((_, c) => (
          <SkeletonBar key={c} className={`h-4 flex-1 ${c === 0 ? 'max-w-[200px]' : ''}`} />
        ))}
      </div>
    ))}
  </div>
);

/** Full page loading state — stat cards + table */
export const PageSkeleton = ({ statCards = false, rows = 5, cols = 4 }: {
  statCards?: boolean;
  rows?: number;
  cols?: number;
}) => (
  <div className="space-y-6 animate-pulse">
    {/* Page title */}
    <div className="space-y-2">
      <SkeletonBar className="h-7 w-48" />
      <SkeletonBar className="h-4 w-72" />
    </div>
    {statCards && <StatCardsSkeleton />}
    <TableSkeleton rows={rows} cols={cols} />
  </div>
);

/** Error card with retry button */
export const ErrorCard = ({ message = 'Failed to load data.', onRetry }: {
  message?: string;
  onRetry?: () => void;
}) => (
  <div className="flex flex-col items-center justify-center p-10 text-center rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
    <span className="text-4xl mb-3">⚠️</span>
    <h3 className="text-base font-semibold text-red-800 dark:text-red-300 mb-1">Something went wrong</h3>
    <p className="text-sm text-red-600 dark:text-red-400 mb-4 max-w-sm">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors"
      >
        Try Again
      </button>
    )}
  </div>
);
