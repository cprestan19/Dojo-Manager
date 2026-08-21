const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function CustomFieldsLoading() {
  return (
    <div className="p-6 space-y-4 max-w-2xl mx-auto">
      <div className="space-y-1.5">
        <Pulse className="h-7 w-56" />
        <Pulse className="h-4 w-80 bg-dojo-border/40" />
      </div>
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <Pulse className="h-4 w-32" />
          <Pulse className="h-3 w-10 bg-dojo-border/40" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-dojo-border animate-pulse" />
            <Pulse className="h-4 flex-1" />
            <Pulse className="w-7 h-7 rounded" />
            <Pulse className="w-7 h-7 rounded bg-dojo-border/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
