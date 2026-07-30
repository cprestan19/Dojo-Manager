"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Award, Trophy, Search } from "lucide-react";
import Link from "next/link";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { calculateAge, formatDate, BELT_COLORS } from "@/lib/utils";

interface BeltEntry {
  id: string; beltColor: string; changeDate: string; isRanking: boolean; notes: string | null;
  kata: { name: string } | null;
  student: { id?: string; fullName: string; firstName: string; lastName: string; birthDate: string };
}

export default function BeltsPage() {
  const [history,  setHistory]  = useState<BeltEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const [nameSearch, setNameSearch] = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/belt-history");
    if (r.ok) setHistory(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const filtered = useMemo(() => {
    let result = filter === "all"
      ? history
      : filter === "ranking"
      ? history.filter(h => h.isRanking)
      : history.filter(h => h.beltColor === filter);

    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      result = result.filter(h => h.student.fullName.toLowerCase().includes(q));
    }
    if (dateFrom) {
      result = result.filter(h => h.changeDate.slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(h => h.changeDate.slice(0, 10) <= dateTo);
    }
    return result;
  }, [history, filter, nameSearch, dateFrom, dateTo]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
          <Award size={24} className="text-dojo-red" /> Historial de Rangos
        </h1>
        <p className="text-dojo-muted text-sm mt-1">Todos los cambios de cinta registrados en el dojo</p>
      </div>

      {/* Búsqueda por nombre + rango de fecha */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
          <input
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            placeholder="Buscar alumno..."
            className="form-input pl-9 text-sm w-full"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-dojo-muted">
          <label className="flex items-center gap-1.5">
            Desde
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="form-input text-sm py-1.5" />
          </label>
          <label className="flex items-center gap-1.5">
            Hasta
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="form-input text-sm py-1.5" />
          </label>
          {(nameSearch || dateFrom || dateTo) && (
            <button onClick={() => { setNameSearch(""); setDateFrom(""); setDateTo(""); }}
              className="text-dojo-red hover:underline">
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === "all" ? "bg-dojo-red text-white" : "bg-dojo-border text-dojo-muted hover:text-dojo-white"}`}>
          Todos ({history.length})
        </button>
        <button onClick={() => setFilter("ranking")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors ${filter === "ranking" ? "bg-dojo-gold text-black" : "bg-dojo-border text-dojo-muted hover:text-dojo-white"}`}>
          <Trophy size={12}/> Ranking ({history.filter(h => h.isRanking).length})
        </button>
        {BELT_COLORS.map(b => {
          const count = history.filter(h => h.beltColor === b.value).length;
          if (count === 0) return null;
          return (
            <button key={b.value} onClick={() => setFilter(b.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === b.value ? "ring-2 ring-dojo-red" : ""}`}
              style={{ backgroundColor: b.hex + "33", color: b.hex === "#FFFFFF" ? "#ccc" : b.hex, border: `1px solid ${b.hex}55` }}>
              {b.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading && <div className="text-center py-20 text-dojo-muted">Cargando...</div>}
      {!loading && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dojo-border">
                {["Alumno","Cinta","Kata","Fecha","Edad","Tipo"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-dojo-muted">Sin resultados.</td></tr>
              )}
              {filtered.map(entry => (
                <tr key={entry.id} className="border-b border-dojo-border/40 hover:bg-dojo-border/10">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/students/${entry.student.id}`}
                      className="font-semibold text-dojo-white hover:text-dojo-red transition-colors">
                      {entry.student.fullName}
                    </Link>
                  </td>
                  <td className="px-5 py-3"><BeltBadge beltColor={entry.beltColor}/></td>
                  <td className="px-5 py-3 text-dojo-muted">{entry.kata?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-dojo-muted">{formatDate(entry.changeDate)}</td>
                  <td className="px-5 py-3 text-dojo-muted">{calculateAge(entry.student.birthDate)} a.</td>
                  <td className="px-5 py-3">
                    {entry.isRanking
                      ? <span className="badge-gold flex items-center gap-1 w-fit"><Trophy size={10}/>Ranking</span>
                      : <span className="badge-blue">Regular</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>{/* overflow-x-auto */}
        </div>
      )}
    </div>
  );
}
