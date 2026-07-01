export default function Loading() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-8 w-8 bg-dojo-border/60 rounded animate-pulse" />
        <div className="space-y-1">
          <div className="h-6 w-48 bg-dojo-border/60 rounded animate-pulse" />
          <div className="h-3 w-32 bg-dojo-border/40 rounded animate-pulse" />
        </div>
      </div>
      <div className="card space-y-4">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-24 bg-dojo-border/40 rounded animate-pulse" />
            <div className="h-10 bg-dojo-border/60 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
