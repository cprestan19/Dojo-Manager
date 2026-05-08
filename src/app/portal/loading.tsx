const P = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);
export default function PortalLoading() {
  return (
    <div className="space-y-5">
      <div className="card flex items-center gap-4">
        <P className="w-20 h-20 rounded-2xl shrink-0" />
        <div className="space-y-2 flex-1">
          <P className="h-5 w-40" />
          <P className="h-4 w-24 bg-dojo-border/40" />
          <P className="h-5 w-20 rounded-full" />
        </div>
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="card space-y-3">
          <P className="h-4 w-32" />
          <P className="h-4 w-full bg-dojo-border/40" />
          <P className="h-4 w-3/4 bg-dojo-border/40" />
        </div>
      ))}
    </div>
  );
}
