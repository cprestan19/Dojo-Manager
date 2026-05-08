const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function StudentDetailLoading() {
  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Pulse className="w-8 h-8 rounded-lg" />
          <div className="w-16 h-16 bg-dojo-border rounded-2xl animate-pulse" />
          <div className="space-y-2">
            <Pulse className="h-7 w-48" />
            <div className="flex gap-2">
              <Pulse className="h-4 w-32 bg-dojo-border/40" />
              <Pulse className="h-5 w-16 rounded-full" />
              <Pulse className="h-5 w-20 rounded-full" />
            </div>
          </div>
        </div>
        <Pulse className="h-9 w-24 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card space-y-3">
              <Pulse className="h-4 w-32" />
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex justify-between">
                  <Pulse className="h-3 w-24 bg-dojo-border/40" />
                  <Pulse className="h-3 w-28" />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card space-y-3">
            <div className="flex justify-between">
              <Pulse className="h-4 w-36" />
              <Pulse className="h-8 w-28 rounded-lg" />
            </div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-dojo-dark border border-dojo-border">
                <Pulse className="h-6 w-20 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Pulse className="h-4 w-32" />
                  <Pulse className="h-3 w-20 bg-dojo-border/40" />
                </div>
                <Pulse className="h-3 w-20 bg-dojo-border/40" />
              </div>
            ))}
          </div>
          <div className="card space-y-3">
            <div className="flex justify-between">
              <Pulse className="h-4 w-36" />
              <Pulse className="h-8 w-28 rounded-lg" />
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 py-2 border-b border-dojo-border last:border-0">
                <Pulse className="h-4 w-24 bg-dojo-border/40" />
                <Pulse className="h-4 w-20" />
                <Pulse className="h-4 w-20 bg-dojo-border/40" />
                <Pulse className="h-5 w-16 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
