const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function EvaluacionDetalleLoading() {
  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Pulse className="h-9 w-9 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Pulse className="h-5 w-56" />
          <Pulse className="h-3 w-40 bg-dojo-border/40" />
        </div>
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card space-y-3">
          <Pulse className="h-4 w-40" />
          <Pulse className="h-4 w-full bg-dojo-border/40" />
          <Pulse className="h-4 w-full bg-dojo-border/40" />
        </div>
      ))}
    </div>
  );
}
