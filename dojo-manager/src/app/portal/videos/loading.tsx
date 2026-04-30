export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-40 bg-dojo-border/60 rounded animate-pulse" />
      {[1, 2].map(i => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-32 bg-dojo-border/60 rounded animate-pulse" />
          {[1, 2].map(j => (
            <div key={j} className="card space-y-2">
              <div className="h-4 w-3/4 bg-dojo-border/60 rounded animate-pulse" />
              <div className="h-36 w-full bg-dojo-border/40 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
