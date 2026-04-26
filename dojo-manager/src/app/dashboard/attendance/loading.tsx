const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function AttendanceLoading() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Pulse className="h-8 w-40" />
          <Pulse className="h-4 w-32 bg-dojo-border/40" />
        </div>
        <Pulse className="h-9 w-32 rounded-lg bg-dojo-border/40" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Pulse className="h-10 w-56 rounded-lg" />
        <Pulse className="h-10 w-36 rounded-lg bg-dojo-border/40" />
        <Pulse className="h-10 w-36 rounded-lg bg-dojo-border/40" />
        <Pulse className="h-10 w-36 rounded-lg bg-dojo-border/40" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex gap-4 px-5 py-3 border-b border-dojo-border">
          {["w-32", "w-24", "w-20", "w-28", "w-20", "w-16"].map((w, i) => (
            <Pulse key={i} className={`h-4 ${w} bg-dojo-border/40`} />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-dojo-border last:border-0">
            <div className="w-9 h-9 bg-dojo-border rounded-full animate-pulse shrink-0" />
            <Pulse className="h-4 w-36" />
            <Pulse className="h-6 w-20 rounded-full bg-dojo-border/40" />
            <Pulse className="h-4 w-28 bg-dojo-border/40" />
            <Pulse className="h-4 w-24 bg-dojo-border/40" />
            <Pulse className="h-5 w-16 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
