export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-8 w-8 bg-dojo-border/60 rounded animate-pulse" />
        <div className="h-7 w-64 bg-dojo-border/60 rounded animate-pulse" />
      </div>
      <div className="card space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 bg-dojo-border/40 rounded animate-pulse" />
              <div className="h-5 w-24 bg-dojo-border/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3 border-b border-dojo-border pb-2">
        {[1,2,3].map(i => (
          <div key={i} className="h-8 w-28 bg-dojo-border/60 rounded animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="card flex items-center gap-4">
            <div className="h-4 w-4 bg-dojo-border/60 rounded animate-pulse" />
            <div className="flex-1 h-4 w-48 bg-dojo-border/60 rounded animate-pulse" />
            <div className="h-6 w-20 bg-dojo-border/40 rounded-full animate-pulse" />
            <div className="h-8 w-28 bg-dojo-border/40 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
