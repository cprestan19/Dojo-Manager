const Pulse = ({ className }: { className: string }) => (
  <div className={`bg-dojo-border/60 rounded animate-pulse ${className}`} />
);

export default function ScannerLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-dojo-darker">
      <div className="h-14 flex items-center justify-between px-4 bg-dojo-dark border-b border-dojo-border shrink-0">
        <Pulse className="h-5 w-32" />
        <Pulse className="h-4 w-12 bg-dojo-border/40" />
      </div>

      <div className="flex-1 px-4 py-5 space-y-3">
        <Pulse className="h-6 w-40 mb-1" />
        <Pulse className="h-4 w-56 bg-dojo-border/40" />

        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-dojo-dark border border-dojo-border rounded-2xl">
            <Pulse className="w-10 h-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Pulse className="h-4 w-32" />
              <Pulse className="h-3 w-20 bg-dojo-border/40" />
            </div>
          </div>
        ))}

        <div className="flex items-center justify-center mt-8">
          <div
            className="w-[260px] h-[260px] border-2 border-dashed border-dojo-border/60 rounded-2xl flex items-center justify-center"
          >
            <Pulse className="w-16 h-16 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
