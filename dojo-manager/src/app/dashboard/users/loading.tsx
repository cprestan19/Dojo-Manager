const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function UsersLoading() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Pulse className="h-8 w-36" />
          <Pulse className="h-4 w-28 bg-dojo-border/40" />
        </div>
        <Pulse className="h-9 w-36 rounded-lg" />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex gap-4 px-5 py-3 border-b border-dojo-border">
          {["w-32", "w-48", "w-20", "w-24", "w-20"].map((w, i) => (
            <Pulse key={i} className={`h-4 ${w} bg-dojo-border/40`} />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-dojo-border last:border-0">
            <div className="w-8 h-8 bg-dojo-border rounded-full animate-pulse shrink-0" />
            <Pulse className="h-4 w-36" />
            <Pulse className="h-4 w-48 bg-dojo-border/40" />
            <Pulse className="h-5 w-20 rounded-full" />
            <Pulse className="h-5 w-16 rounded-full bg-dojo-border/40 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
