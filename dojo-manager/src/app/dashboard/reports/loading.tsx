const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function ReportsLoading() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="space-y-1.5">
        <Pulse className="h-8 w-36" />
        <Pulse className="h-4 w-52 bg-dojo-border/40" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[...Array(4)].map((_, i) => (
          <Pulse key={i} className="h-9 w-32 rounded-lg" />
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card space-y-2">
            <Pulse className="h-3 w-20 bg-dojo-border/40" />
            <Pulse className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Content area */}
      <div className="card space-y-3">
        <Pulse className="h-4 w-40" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2 border-b border-dojo-border last:border-0">
            <div className="w-9 h-9 bg-dojo-border rounded-full animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Pulse className="h-4 w-40" />
              <Pulse className="h-3 w-24 bg-dojo-border/40" />
            </div>
            <Pulse className="h-6 w-20 rounded-full" />
            <Pulse className="h-4 w-16 bg-dojo-border/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
