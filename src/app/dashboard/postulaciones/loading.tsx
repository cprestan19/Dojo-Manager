export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-dojo-border/60 rounded animate-pulse" />
        <div className="h-9 w-36 bg-dojo-border/60 rounded animate-pulse" />
      </div>
      <div className="flex gap-3 mb-4">
        <div className="h-9 w-40 bg-dojo-border/60 rounded animate-pulse" />
        <div className="h-9 w-56 bg-dojo-border/60 rounded animate-pulse" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="card space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-5 w-64 bg-dojo-border/60 rounded animate-pulse" />
              <div className="h-4 w-48 bg-dojo-border/40 rounded animate-pulse" />
            </div>
            <div className="h-6 w-20 bg-dojo-border/60 rounded-full animate-pulse" />
          </div>
          <div className="flex gap-4">
            <div className="h-4 w-24 bg-dojo-border/40 rounded animate-pulse" />
            <div className="h-4 w-24 bg-dojo-border/40 rounded animate-pulse" />
            <div className="h-4 w-24 bg-dojo-border/40 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
