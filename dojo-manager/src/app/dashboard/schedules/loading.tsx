const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function SchedulesLoading() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Pulse className="h-8 w-36" />
          <Pulse className="h-4 w-28 bg-dojo-border/40" />
        </div>
        <Pulse className="h-9 w-36 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card space-y-3">
            <div className="flex items-center justify-between">
              <Pulse className="h-5 w-36" />
              <Pulse className="h-5 w-14 rounded-full bg-dojo-border/40" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[...Array(4)].map((_, j) => (
                <Pulse key={j} className="h-5 w-16 rounded-full bg-dojo-border/40" />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Pulse className="h-4 w-24 bg-dojo-border/40" />
              <Pulse className="h-4 w-28 bg-dojo-border/40" />
            </div>
            <div className="flex justify-end gap-2">
              <Pulse className="h-8 w-20 rounded-lg bg-dojo-border/40" />
              <Pulse className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
