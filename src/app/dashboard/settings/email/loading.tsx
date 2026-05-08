const P = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);
export default function EmailSettingsLoading() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div className="space-y-1.5"><P className="h-9 w-64" /><P className="h-4 w-80 bg-dojo-border/40" /></div>
      <P className="h-16 w-full rounded-xl" />
      {[...Array(2)].map((_, i) => (
        <div key={i} className="card space-y-4">
          <P className="h-5 w-40" />
          <P className="h-10 w-full rounded-lg" />
          <P className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <P className="h-10 w-40 rounded-lg" />
    </div>
  );
}
