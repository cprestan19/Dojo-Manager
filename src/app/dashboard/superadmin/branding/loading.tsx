const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function PlatformBrandingLoading() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-1.5">
        <Pulse className="h-9 w-72" />
        <Pulse className="h-4 w-96 bg-dojo-border/40" />
      </div>

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
    </div>
  );
}
