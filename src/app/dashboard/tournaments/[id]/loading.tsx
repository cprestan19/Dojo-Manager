export default function TournamentDetailLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-dojo-card animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-64 rounded bg-dojo-card animate-pulse" />
          <div className="h-4 w-40 rounded bg-dojo-card animate-pulse" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="border-b border-dojo-border flex gap-4 pb-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 rounded-t bg-dojo-card animate-pulse" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-dojo-border animate-pulse" />
              <div className="h-5 w-40 rounded bg-dojo-border animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
