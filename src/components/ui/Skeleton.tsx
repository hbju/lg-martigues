interface Props {
  className?: string
  count?: number
}

export function Skeleton({ className = 'h-4 w-full', count = 1 }: Props) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton ${className}`} />
      ))}
    </>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-night-800/50 rounded-xl p-4 space-y-3">
      <div className="skeleton h-4 w-1/3" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-2/3" />
    </div>
  )
}

export function SkeletonPlayerList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-night-800/50 rounded-lg">
          <div className="skeleton w-8 h-8 rounded-full flex-shrink-0" />
          <div className="skeleton h-4 w-24" />
        </div>
      ))}
    </div>
  )
}
