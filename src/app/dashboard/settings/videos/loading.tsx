export default function Loading() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 bg-dojo-border/60 rounded animate-pulse" />
          <div className="h-4 w-40 bg-dojo-border/40 rounded animate-pulse" />
        </div>
        <div className="h-9 w-32 bg-dojo-border/60 rounded-lg animate-pulse" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="card p-0 overflow-hidden">
          <div className="h-10 bg-dojo-border/40 animate-pulse" />
          {[1, 2].map(j => (
            <div key={j} className="flex items-center gap-4 px-5 py-4 border-b border-dojo-border/40 last:border-0">
              <div className="h-4 w-4/5 bg-dojo-border/60 rounded animate-pulse" />
              <div className="h-4 w-16 bg-dojo-border/40 rounded animate-pulse ml-auto" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
