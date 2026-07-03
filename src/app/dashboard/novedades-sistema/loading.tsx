export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dojo-border/60 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-48 bg-dojo-border/60 rounded animate-pulse" />
            <div className="h-3 w-64 bg-dojo-border/40 rounded animate-pulse" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="card h-24 animate-pulse bg-dojo-border/40" />
        ))}
      </div>
    </div>
  );
}
