export default function BillingSuperadminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-dojo-border/60 rounded-lg" />
        <div className="h-4 w-72 bg-dojo-border/40 rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4,5,6,7].map(i => <div key={i} className="card h-20 bg-dojo-border/40" />)}
      </div>
      <div className="card p-0 overflow-hidden">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex gap-6 px-4 py-3.5 border-b border-dojo-border/50">
            <div className="h-4 w-32 bg-dojo-border/60 rounded" />
            <div className="h-4 w-20 bg-dojo-border/40 rounded" />
            <div className="h-4 w-24 bg-dojo-border/40 rounded" />
            <div className="h-4 w-16 bg-dojo-border/40 rounded" />
            <div className="h-4 w-28 bg-dojo-border/40 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
