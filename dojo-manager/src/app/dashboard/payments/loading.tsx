const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function PaymentsLoading() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <Pulse className="h-8 w-32" />
          <Pulse className="h-4 w-24 bg-dojo-border/40" />
        </div>
        <Pulse className="h-9 w-44 rounded-lg" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {["w-20", "w-24", "w-16"].map((w, i) => (
          <div key={i} className="card space-y-2">
            <Pulse className={`h-3 ${w} bg-dojo-border/40`} />
            <Pulse className="h-8 w-28" />
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Pulse className="h-10 w-56 rounded-lg" />
        <Pulse className="h-10 w-36 rounded-lg bg-dojo-border/40" />
        <Pulse className="h-10 w-36 rounded-lg bg-dojo-border/40" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex gap-4 px-4 py-3 border-b border-dojo-border">
          {["w-28", "w-20", "w-16", "w-24", "w-20", "w-16", "w-20"].map((w, i) => (
            <Pulse key={i} className={`h-4 ${w} bg-dojo-border/40`} />
          ))}
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-dojo-border last:border-0">
            <Pulse className="h-4 w-36" />
            <Pulse className="h-4 w-20 bg-dojo-border/40" />
            <Pulse className="h-4 w-16" />
            <Pulse className="h-4 w-20 bg-dojo-border/40" />
            <Pulse className="h-4 w-20 bg-dojo-border/40" />
            <Pulse className="h-5 w-20 rounded-full" />
            <div className="ml-auto flex gap-2">
              <Pulse className="h-4 w-16 bg-dojo-border/40" />
              <Pulse className="h-4 w-24 bg-dojo-border/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
