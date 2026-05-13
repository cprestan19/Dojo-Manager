export default function ProgramLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded bg-dojo-card" />
      <div className="card space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-dojo-border">
            <div className="w-8 h-8 rounded bg-dojo-border" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 rounded bg-dojo-border" />
              <div className="h-3 w-24 rounded bg-dojo-border" />
            </div>
            <div className="h-4 w-16 rounded bg-dojo-border" />
          </div>
        ))}
      </div>
    </div>
  );
}
