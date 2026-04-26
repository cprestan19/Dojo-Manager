const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function KatasSettingsLoading() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Pulse className="h-8 w-52" />
          <Pulse className="h-4 w-48 bg-dojo-border/40" />
        </div>
        <Pulse className="h-9 w-32 rounded-lg" />
      </div>

      {[...Array(3)].map((_, g) => (
        <div key={g} className="card p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-dojo-border bg-dojo-dark">
            <div className="w-3 h-3 rounded-full bg-dojo-border animate-pulse" />
            <Pulse className="h-4 w-24" />
            <Pulse className="h-3 w-16 ml-auto bg-dojo-border/40" />
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 border-b border-dojo-border last:border-0">
              <Pulse className="h-4 w-6 bg-dojo-border/40" />
              <div className="flex-1 space-y-1.5">
                <Pulse className="h-4 w-40" />
                <Pulse className="h-3 w-32 bg-dojo-border/40" />
              </div>
              <Pulse className="h-6 w-20 rounded-full" />
              <Pulse className="h-5 w-14 rounded-full bg-dojo-border/40" />
              <div className="flex gap-1.5">
                <Pulse className="w-7 h-7 rounded" />
                <Pulse className="w-7 h-7 rounded bg-dojo-border/40" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
