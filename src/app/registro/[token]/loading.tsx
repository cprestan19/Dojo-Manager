export default function Loading() {
  return (
    <div className="min-h-screen bg-dojo-darker flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <div className="h-8 w-48 bg-dojo-border/60 rounded animate-pulse mx-auto" />
        <div className="h-4 w-64 bg-dojo-border/40 rounded animate-pulse mx-auto" />
        <div className="h-96 bg-dojo-card rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
