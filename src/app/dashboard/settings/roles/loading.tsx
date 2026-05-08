export default function Loading() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-52 bg-dojo-border/60 rounded animate-pulse" />
          <div className="h-4 w-36 bg-dojo-border/40 rounded animate-pulse" />
        </div>
        <div className="h-9 w-36 bg-dojo-border/60 rounded-lg animate-pulse" />
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="h-12 bg-dojo-border/40 animate-pulse border-b border-dojo-border" />
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-dojo-border/40">
            <div className="h-6 w-28 bg-dojo-border/60 rounded animate-pulse" />
            {[1,2,3,4,5,6,7,8].map(j => (
              <div key={j} className="h-5 w-5 bg-dojo-border/60 rounded animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
