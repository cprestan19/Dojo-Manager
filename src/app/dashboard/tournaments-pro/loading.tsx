export default function Loading() {
  return (
    <div className="space-y-6 max-w-5xl animate-pulse">
      <div className="h-10 w-64 bg-dojo-border/60 rounded-xl"/>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-dojo-border/40 rounded-xl"/>)}
        </div>
        <div className="h-64 bg-dojo-border/40 rounded-xl"/>
      </div>
    </div>
  );
}
