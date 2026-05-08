const S = ({ w, h, extra = "" }: { w: string; h: string; extra?: string }) => (
  <div className={`${w} ${h} bg-dojo-border/60 rounded animate-pulse ${extra}`} />
);

export default function DashboardLoading() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="space-y-1">
        <S w="w-80" h="h-9" />
        <S w="w-48" h="h-4" extra="bg-dojo-border/40" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card flex items-center gap-4">
            <div className="w-12 h-12 bg-dojo-border rounded-xl animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <S w="w-14" h="h-7" />
              <S w="w-24" h="h-3" extra="bg-dojo-border/40" />
            </div>
          </div>
        ))}
      </div>

      <div className="card space-y-3">
        <S w="w-40" h="h-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-dojo-border last:border-0">
            <div className="w-9 h-9 bg-dojo-border rounded-full animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <S w="w-36" h="h-4" />
              <S w="w-16" h="h-3" extra="bg-dojo-border/40" />
            </div>
            <S w="w-20" h="h-5" extra="rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
