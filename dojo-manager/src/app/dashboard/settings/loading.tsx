const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function SettingsLoading() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-1.5">
        <Pulse className="h-9 w-48" />
        <Pulse className="h-4 w-64 bg-dojo-border/40" />
      </div>

      {/* Logo section */}
      <div className="card space-y-5">
        <Pulse className="h-5 w-36 border-b border-dojo-border pb-3" />
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-dojo-border rounded-2xl animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <Pulse className="h-9 w-full rounded-lg" />
            <Pulse className="h-4 w-40 bg-dojo-border/40" />
          </div>
        </div>
      </div>

      {/* Form fields */}
      <div className="card space-y-5">
        <Pulse className="h-5 w-32" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Pulse className="h-3 w-32 bg-dojo-border/40" />
            <Pulse className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Payment params */}
      <div className="card space-y-5">
        <Pulse className="h-5 w-56" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Pulse className="h-3 w-36 bg-dojo-border/40" />
            <Pulse className="h-10 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Pulse className="h-3 w-36 bg-dojo-border/40" />
            <Pulse className="h-10 rounded-lg" />
          </div>
        </div>
        <Pulse className="h-14 w-full rounded-lg" />
      </div>

      <Pulse className="h-10 w-36 rounded-lg" />
    </div>
  );
}
