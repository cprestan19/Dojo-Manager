export default function Loading() {
  return (
    <div className="p-6 space-y-4 max-w-2xl mx-auto">
      <div className="h-7 w-64 bg-dojo-border/60 rounded animate-pulse" />
      <div className="h-32 bg-dojo-border/40 rounded-xl animate-pulse" />
      <div className="h-32 bg-dojo-border/40 rounded-xl animate-pulse" />
    </div>
  );
}
