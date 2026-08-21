const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function EvaluacionesLoading() {
  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="space-y-1.5">
        <Pulse className="h-7 w-48" />
        <Pulse className="h-4 w-96 bg-dojo-border/40" />
      </div>
      <div className="card h-16" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card flex items-center gap-4">
          <div className="flex-1 space-y-1.5">
            <Pulse className="h-4 w-56" />
            <Pulse className="h-3 w-24 bg-dojo-border/40" />
          </div>
          <Pulse className="h-4 w-24 bg-dojo-border/40" />
        </div>
      ))}
    </div>
  );
}
