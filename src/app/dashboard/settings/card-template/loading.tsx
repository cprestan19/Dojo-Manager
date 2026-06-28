export default function Loading() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="h-9 w-64 bg-dojo-border/60 rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[500px] bg-dojo-border/60 rounded-2xl animate-pulse" />
        <div className="space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-32 bg-dojo-border/40 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
