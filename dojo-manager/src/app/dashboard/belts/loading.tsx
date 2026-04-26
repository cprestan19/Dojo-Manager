const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function BeltsLoading() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="space-y-1.5">
        <Pulse className="h-8 w-48" />
        <Pulse className="h-4 w-40 bg-dojo-border/40" />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {[...Array(5)].map((_, i) => (
          <Pulse key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex gap-4 px-5 py-3 border-b border-dojo-border">
          {["w-28", "w-20", "w-24", "w-20", "w-20", "w-16"].map((w, i) => (
            <Pulse key={i} className={`h-4 ${w} bg-dojo-border/40`} />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-dojo-border last:border-0">
            <Pulse className="h-4 w-36" />
            <Pulse className="h-6 w-20 rounded-full" />
            <Pulse className="h-4 w-28 bg-dojo-border/40" />
            <Pulse className="h-4 w-20 bg-dojo-border/40" />
            <Pulse className="h-4 w-16 bg-dojo-border/40" />
            <Pulse className="h-5 w-16 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
