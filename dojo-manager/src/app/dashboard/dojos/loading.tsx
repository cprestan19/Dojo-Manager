const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function DojosLoading() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Pulse className="h-8 w-36" />
          <Pulse className="h-4 w-28 bg-dojo-border/40" />
        </div>
        <Pulse className="h-9 w-32 rounded-lg" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex gap-4 px-5 py-3 border-b border-dojo-border">
          {["w-24", "w-28", "w-32", "w-20", "w-20"].map((w, i) => (
            <Pulse key={i} className={`h-4 ${w} bg-dojo-border/40`} />
          ))}
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-dojo-border last:border-0">
            <div className="w-10 h-10 bg-dojo-border rounded-xl animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Pulse className="h-4 w-36" />
              <Pulse className="h-3 w-24 bg-dojo-border/40" />
            </div>
            <Pulse className="h-4 w-28 bg-dojo-border/40" />
            <Pulse className="h-5 w-16 rounded-full" />
            <div className="flex gap-1.5 ml-auto">
              <Pulse className="w-8 h-8 rounded-lg bg-dojo-border/40" />
              <Pulse className="w-8 h-8 rounded-lg bg-dojo-border/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
