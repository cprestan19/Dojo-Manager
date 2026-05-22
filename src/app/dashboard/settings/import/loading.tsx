export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="h-8 w-52 bg-dojo-border/60 rounded animate-pulse" />
      <div className="h-3 w-80 bg-dojo-border/40 rounded animate-pulse" />
      <div className="card p-5 space-y-3">
        <div className="h-3 w-40 bg-dojo-border/40 rounded animate-pulse" />
        <div className="h-10 w-52 bg-dojo-border/60 rounded-lg animate-pulse" />
      </div>
      <div className="card p-5 space-y-3">
        <div className="h-3 w-40 bg-dojo-border/40 rounded animate-pulse" />
        <div className="h-32 bg-dojo-border/30 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
