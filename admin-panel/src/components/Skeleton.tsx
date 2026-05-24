interface SkeletonProps {
  className?: string
}

/** Tek bir gri pulse placeholder. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />
}

/** Tablo iskeleti — n satır × c sütun. */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-4 ${c === 0 ? 'w-12' : c === cols - 1 ? 'w-16' : 'flex-1'}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Kart iskeleti — KPI / istatistik kartı için. */
export function CardSkeleton({ className = 'h-24' }: { className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-4 ${className}`}>
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-6 w-16 mb-1" />
      <Skeleton className="h-2 w-24" />
    </div>
  )
}
