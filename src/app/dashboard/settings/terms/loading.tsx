export default function Loading() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-dojo-border/60 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-5 w-48 bg-dojo-border/60 rounded animate-pulse" />
          <div className="h-3 w-72 bg-dojo-border/40 rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card">
            <div className="h-7 w-12 bg-dojo-border/60 rounded animate-pulse mx-auto mb-1" />
            <div className="h-3 w-20 bg-dojo-border/40 rounded animate-pulse mx-auto" />
          </div>
        ))}
      </div>
      <div className="card h-16 bg-dojo-border/40 animate-pulse" />
      <div className="h-72 bg-dojo-border/40 rounded-lg animate-pulse" />
    </div>
  );
}
