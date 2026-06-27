export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-64 bg-dojo-border/60 rounded animate-pulse" />
      <div className="h-4 w-48 bg-dojo-border/40 rounded animate-pulse" />
      <div className="h-48 bg-dojo-card rounded-xl animate-pulse" />
      <div className="h-48 bg-dojo-card rounded-xl animate-pulse" />
    </div>
  );
}
