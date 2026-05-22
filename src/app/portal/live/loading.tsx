export default function LiveLoading() {
  return (
    <div className="space-y-4">
      {[1, 2].map(i => <div key={i} className="h-40 bg-dojo-border/40 rounded-xl animate-pulse" />)}
    </div>
  );
}
