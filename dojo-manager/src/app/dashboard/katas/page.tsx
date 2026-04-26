"use client";
import { useState, useEffect, useCallback } from "react";
import { BookOpen, Tag, Settings } from "lucide-react";
import Link from "next/link";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { BELT_COLORS } from "@/lib/utils";

interface Kata {
  id: string; name: string; beltColor: string;
  order: number; description: string | null; active: boolean;
}

export default function KatasPage() {
  const [katas,   setKatas]   = useState<Kata[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/katas?active=1");
    if (r.ok) setKatas(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const grouped = BELT_COLORS.reduce<Record<string, Kata[]>>((acc, b) => {
    acc[b.value] = katas.filter(k => k.beltColor === b.value && k.active);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <BookOpen size={24} className="text-dojo-red" /> Catálogo de Katas
          </h1>
          <p className="text-dojo-muted text-sm mt-1">
            {katas.filter(k => k.active).length} katas activos
          </p>
        </div>
        <Link href="/dashboard/settings/katas" className="btn-secondary text-sm">
          <Settings size={15}/> Gestionar Katas
        </Link>
      </div>

      {loading && <div className="text-center py-20 text-dojo-muted">Cargando...</div>}

      {!loading && BELT_COLORS.map(belt => {
        const list = grouped[belt.value] ?? [];
        if (list.length === 0) return null;
        return (
          <div key={belt.value} className="card p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-dojo-border"
              style={{ backgroundColor: belt.hex + "15" }}>
              <span className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: belt.hex }}/>
              <p className="font-semibold text-sm" style={{ color: belt.hex === "#FFFFFF" ? "#ccc" : belt.hex }}>
                Cinta {belt.label}
              </p>
              <span className="text-xs text-dojo-muted ml-auto">{list.length} kata(s)</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {list.map(k => (
                  <tr key={k.id} className="border-b border-dojo-border/40 hover:bg-dojo-border/10 last:border-0">
                    <td className="px-5 py-3 w-10 text-dojo-muted text-center text-xs">{k.order}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-dojo-white">{k.name}</p>
                      {k.description && (
                        <p className="text-xs text-dojo-muted flex items-center gap-1 mt-0.5">
                          <Tag size={10}/> {k.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3"><BeltBadge beltColor={k.beltColor} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        );
      })}

      {!loading && katas.filter(k => k.active).length === 0 && (
        <div className="text-center py-16 text-dojo-muted">
          <BookOpen size={48} className="mx-auto mb-4 opacity-30"/>
          <p>No hay katas activos en el catálogo.</p>
          <p className="text-sm mt-1">
            Ve a{" "}
            <Link href="/dashboard/settings/katas" className="text-dojo-red hover:underline">
              Configuración → Creación de Katas
            </Link>{" "}
            para agregar katas.
          </p>
        </div>
      )}
    </div>
  );
}
