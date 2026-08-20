import React from 'react';

// Common shimmer overlay wrapper
function ShimmerWrapper({ className, children }) {
  return (
    <div className={`relative overflow-hidden bg-slate-900/40 border border-slate-900 rounded-xl ${className}`}>
      {children}
      <div className="absolute inset-0 animate-shimmer pointer-events-none" />
    </div>
  );
}

// 1. Dashboard Metrics Skeletons
export function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <ShimmerWrapper key={i} className="p-5 h-24 flex flex-col justify-between">
          <div className="h-2.5 bg-slate-800 rounded-full w-24" />
          <div className="h-6 bg-slate-800 rounded w-16" />
          <div className="h-2 bg-slate-800/60 rounded-full w-32" />
        </ShimmerWrapper>
      ))}
    </div>
  );
}

// 2. Scan History / Table Row Skeletons
export function HistoryTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <ShimmerWrapper key={i} className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-1/3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex-shrink-0" />
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="h-2.5 bg-slate-800 rounded-full w-3/4" />
              <div className="h-2 bg-slate-800/60 rounded-full w-1/2" />
            </div>
          </div>
          <div className="h-4 bg-slate-800 rounded-lg w-20" />
          <div className="h-2 bg-slate-800/60 rounded-full w-12" />
          <div className="h-6 bg-slate-800/50 rounded-xl w-16" />
        </ShimmerWrapper>
      ))}
    </div>
  );
}

// 3. Result Card Loading Skeleton
export function ResultCardSkeleton() {
  return (
    <ShimmerWrapper className="p-6 space-y-6">
      <div className="flex items-center gap-5 pb-6 border-b border-slate-900">
        <div className="w-24 h-24 rounded-full border-4 border-slate-800/40 flex-shrink-0 flex items-center justify-center">
          <div className="h-4 bg-slate-800 rounded w-10 animate-pulse" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-6 bg-slate-800 rounded-xl w-32" />
          <div className="h-3 bg-slate-800/80 rounded w-24" />
          <div className="h-2 bg-slate-800/50 rounded w-40" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 bg-slate-800 rounded w-2/3" />
        <div className="h-24 bg-slate-850 border border-slate-800 rounded-xl" />
      </div>
    </ShimmerWrapper>
  );
}
