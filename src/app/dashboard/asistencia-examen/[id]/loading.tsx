export default function Loading() {
  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="h-7 w-64 bg-dojo-border/60 rounded animate-pulse" />
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-dojo-border/40 rounded-xl animate-pulse" />)}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-14 bg-dojo-border/40 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
