export default function Loading() {
  return (
    <div className="space-y-5 max-w-5xl animate-pulse">
      <div className="h-8 w-48 bg-dojo-border/60 rounded" />
      <div className="grid grid-cols-5 gap-2">
        {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-dojo-border/40 rounded-xl" />)}
      </div>
      <div className="h-10 w-full bg-dojo-border/40 rounded-lg" />
      <div className="card p-0">
        {[...Array(5)].map((_, i) => <div key={i} className="h-14 border-b border-dojo-border/40" />)}
      </div>
    </div>
  );
}
