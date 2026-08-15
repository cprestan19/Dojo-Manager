export default function Loading() {
  return (
    <div className="space-y-5 max-w-5xl">
      <div className="h-10 bg-dojo-border/60 rounded-xl w-72 animate-pulse" />
      <div className="flex gap-1.5">
        <div className="h-9 w-28 bg-dojo-border/40 rounded-xl animate-pulse" />
        <div className="h-9 w-28 bg-dojo-border/40 rounded-xl animate-pulse" />
        <div className="h-9 w-20 bg-dojo-border/40 rounded-xl animate-pulse" />
      </div>
      <div className="card p-4 space-y-2 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-dojo-border/40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
