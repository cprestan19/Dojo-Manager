export default function TournamentsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dojo-card animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-28 rounded bg-dojo-card animate-pulse" />
            <div className="h-3 w-44 rounded bg-dojo-card animate-pulse" />
          </div>
        </div>
        <div className="h-9 w-36 rounded-lg bg-dojo-card animate-pulse" />
      </div>

      {/* Cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="h-5 w-40 rounded bg-dojo-border animate-pulse" />
              <div className="h-5 w-20 rounded bg-dojo-border animate-pulse" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-4 w-full rounded bg-dojo-border animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
