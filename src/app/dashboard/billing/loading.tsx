export default function BillingLoading() {
  return (
    <div className="space-y-8 max-w-4xl animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-40 bg-dojo-border/60 rounded-lg" />
        <div className="h-4 w-64 bg-dojo-border/40 rounded" />
      </div>

      {/* Status card */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dojo-border/60" />
          <div className="space-y-1.5">
            <div className="h-3 w-32 bg-dojo-border/40 rounded" />
            <div className="h-5 w-24 bg-dojo-border/60 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-dojo-border">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 bg-dojo-border/40 rounded" />
              <div className="h-4 w-24 bg-dojo-border/60 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Plans section */}
      <div className="space-y-4">
        <div className="h-6 w-36 bg-dojo-border/60 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="card space-y-3">
              <div className="h-5 w-24 bg-dojo-border/60 rounded" />
              <div className="h-8 w-20 bg-dojo-border/40 rounded" />
              {[1, 2, 3].map(j => (
                <div key={j} className="h-3 w-full bg-dojo-border/40 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Invoice section */}
      <div className="space-y-4">
        <div className="h-6 w-44 bg-dojo-border/60 rounded" />
        <div className="card p-0 overflow-hidden">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-6 px-4 py-3 border-b border-dojo-border/50">
              <div className="h-4 w-24 bg-dojo-border/40 rounded" />
              <div className="h-4 w-20 bg-dojo-border/60 rounded" />
              <div className="h-4 w-24 bg-dojo-border/40 rounded" />
              <div className="h-4 w-16 bg-dojo-border/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
