export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-8 bg-dojo-border/60 rounded w-56 animate-pulse" />
      <div className="card space-y-3 animate-pulse">
        <div className="h-8 bg-dojo-border/40 rounded" />
        <div className="h-8 bg-dojo-border/30 rounded" />
      </div>
      <div className="card p-4 space-y-2 animate-pulse">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-10 bg-dojo-border/40 rounded" />
        ))}
      </div>
    </div>
  );
}
