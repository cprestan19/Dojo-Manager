export default function Loading() {
  return (
    <div className="p-6 flex gap-6" style={{ minHeight: "80vh" }}>
      {/* Lista izquierda */}
      <div className="w-64 shrink-0 space-y-3">
        <div className="h-7 w-40 bg-dojo-border/60 rounded animate-pulse mb-4" />
        <div className="h-9 w-full bg-dojo-border/60 rounded animate-pulse" />
        {[1,2,3].map(i => (
          <div key={i} className="h-14 w-full bg-dojo-border/40 rounded animate-pulse" />
        ))}
      </div>
      {/* Editor derecho */}
      <div className="flex-1 space-y-4">
        <div className="h-7 w-48 bg-dojo-border/60 rounded animate-pulse mb-4" />
        <div className="aspect-[10/7] bg-dojo-border/30 rounded-xl animate-pulse" />
        <div className="h-9 w-32 bg-dojo-border/60 rounded animate-pulse" />
      </div>
    </div>
  );
}
