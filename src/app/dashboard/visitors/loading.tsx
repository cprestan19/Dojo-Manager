export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 bg-dojo-border/60 rounded w-48 animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => (
          <div key={i} className="card animate-pulse space-y-2">
            <div className="h-8 bg-dojo-border/40 rounded w-16 mx-auto" />
            <div className="h-3 bg-dojo-border/30 rounded w-12 mx-auto" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card animate-pulse space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-6 bg-dojo-border/40 rounded" />)}
        </div>
        <div className="card animate-pulse space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-6 bg-dojo-border/40 rounded" />)}
        </div>
      </div>
      <div className="card animate-pulse h-64" />
    </div>
  );
}
