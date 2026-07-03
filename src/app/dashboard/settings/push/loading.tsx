export default function Loading() {
  return (
    <div className="space-y-6 p-4 lg:p-6 animate-pulse">
      <div className="h-7 w-64 bg-dojo-border/60 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card h-24 bg-dojo-border/40" />
        ))}
      </div>
      <div className="card h-64 bg-dojo-border/40" />
      <div className="card h-48 bg-dojo-border/40" />
    </div>
  );
}
