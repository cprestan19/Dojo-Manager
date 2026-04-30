/**
 * Página: Reportes del Dojo
 * Desarrollado por Cristhian Paul Prestán — 2025
 */
"use client";
import { useState, useEffect, useCallback } from "react";
import { BarChart2, Award, Users, CreditCard, Trophy, Phone, User } from "lucide-react";
import Image from "next/image";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { calculateAge, formatDate, formatCurrency } from "@/lib/utils";
import { useDojo } from "@/lib/hooks/useDojo";

type Tab = "belt" | "age" | "payments" | "ranking";

interface StudentSnap {
  id: string; fullName: string; firstName: string; lastName: string; birthDate: string;
  beltHistory?: { beltColor: string; changeDate: string }[];
}

interface RankingEntry {
  id: string; beltColor: string; changeDate: string;
  student: { fullName: string; firstName: string; lastName: string; birthDate: string };
  kata: { name: string } | null;
}

interface PaymentSummary {
  pending: number; paid: number; late: number;
  totalCollected: number; totalPending: number;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="card text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-dojo-muted mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}

export default function ReportsPage() {
  const [tab,     setTab]     = useState<Tab>("belt");
  const [data,    setData]    = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const dojo = useDojo();

  const fetch_ = useCallback(async () => {
    setLoading(true); setData(null);
    const r = await fetch(`/api/reports?type=${tab}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "belt",     label: "Por Cinta",  icon: Award     },
    { key: "age",      label: "Por Edad",   icon: Users     },
    { key: "payments", label: "Pagos",      icon: CreditCard},
    { key: "ranking",  label: "Ranking",    icon: Trophy    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Encabezado del dojo */}
      {dojo && (
        <div className="card flex items-center gap-5 py-4 print:shadow-none">
          <div className="w-16 h-16 bg-dojo-red rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow shadow-dojo-red/30">
            {dojo.logo
              ? <Image src={dojo.logo} alt={dojo.name} width={64} height={64} className="object-contain w-full h-full" />
              : <span className="text-white text-2xl font-display font-bold">{dojo.name[0]}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-dojo-white font-bold text-xl tracking-wide">{dojo.name}</p>
            {dojo.slogan    && <p className="text-dojo-gold text-sm italic">{dojo.slogan}</p>}
            <div className="flex flex-wrap gap-4 mt-1">
              {dojo.ownerName && (
                <span className="flex items-center gap-1 text-dojo-muted text-xs"><User size={11}/>{dojo.ownerName}</span>
              )}
              {dojo.phone && (
                <span className="flex items-center gap-1 text-dojo-muted text-xs"><Phone size={11}/>{dojo.phone}</span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-dojo-muted text-xs uppercase tracking-wider">Reportes</p>
            <p className="text-dojo-white font-display text-sm tracking-widest">DOJO MASTER</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
          <BarChart2 size={24} className="text-dojo-red" /> Reportes
        </h1>
        <p className="text-dojo-muted text-sm mt-1">Análisis y estadísticas del dojo</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-dojo-border pb-0">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
                tab === t.key
                  ? "border-dojo-red text-dojo-white"
                  : "border-transparent text-dojo-muted hover:text-dojo-white"
              }`}
            >
              <Icon size={15}/> {t.label}
            </button>
          );
        })}
      </div>

      {loading && <div className="text-center py-20 text-dojo-muted">Cargando reporte...</div>}

      {/* Belt Report */}
      {!loading && tab === "belt" && data != null && (() => {
        const grouped = data as Record<string, StudentSnap[]>;
        const entries = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
        const total   = entries.reduce((s, [, v]) => s + v.length, 0);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Alumnos" value={total} color="text-dojo-gold"/>
              <StatCard label="Niveles" value={entries.length} color="text-blue-400"/>
              <StatCard label="Cintas negras" value={(grouped["negra"] ?? []).length + (grouped["negra-1-dan"] ?? []).length} color="text-dojo-muted"/>
              <StatCard label="Sin Cinta" value={(grouped["sin-cinta"] ?? []).length} color="text-dojo-muted"/>
            </div>
            {entries.map(([belt, students]) => (
              <div key={belt} className="card p-0 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-dojo-border bg-dojo-dark/50">
                  <div className="flex items-center gap-3">
                    <BeltBadge beltColor={belt === "sin-cinta" ? "blanca" : belt} />
                    {belt === "sin-cinta" && <span className="text-dojo-muted text-xs">(Sin cinta asignada)</span>}
                  </div>
                  <span className="text-sm font-bold text-dojo-white">{students.length} alumno(s)</span>
                </div>
                <div className="divide-y divide-dojo-border/30">
                  {students.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-dojo-border/10">
                      <span className="text-sm text-dojo-white">{s.fullName}</span>
                      <span className="text-xs text-dojo-muted">{calculateAge(s.birthDate)} años</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Age Report */}
      {!loading && tab === "age" && data != null && (() => {
        const grouped = data as Record<string, StudentSnap[]>;
        const total   = Object.values(grouped).reduce((s, v) => s + v.length, 0);
        return (
          <div className="space-y-4">
            <StatCard label="Total Alumnos Activos" value={total} color="text-dojo-gold"/>
            {Object.entries(grouped).map(([range, students]) => (
              <div key={range} className="card p-0 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-dojo-border bg-dojo-dark/50">
                  <p className="font-semibold text-dojo-white">{range}</p>
                  <div className="flex items-center gap-4">
                    <div className="h-2 rounded-full bg-dojo-red/50 overflow-hidden" style={{ width: 100 }}>
                      <div className="h-full bg-dojo-red rounded-full"
                        style={{ width: `${total > 0 ? (students.length / total) * 100 : 0}%` }}/>
                    </div>
                    <span className="text-sm font-bold text-dojo-white w-6 text-right">{students.length}</span>
                  </div>
                </div>
                {students.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-5 py-3">
                    {students.map(s => (
                      <span key={s.id} className="text-xs bg-dojo-border px-2 py-1 rounded-full text-dojo-white">
                        {s.fullName} ({calculateAge(s.birthDate)} a.)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Payment Report */}
      {!loading && tab === "payments" && data != null && (() => {
        const d = data as PaymentSummary;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Pagos Pendientes"  value={d.pending} color="text-yellow-400"/>
              <StatCard label="Pagos Atrasados"   value={d.late}    color="text-red-400"/>
              <StatCard label="Pagos Completados" value={d.paid}    color="text-green-400"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <p className="text-xs text-dojo-muted uppercase tracking-wider mb-2">Total Cobrado</p>
                <p className="text-3xl font-bold text-green-400">{formatCurrency(d.totalCollected)}</p>
              </div>
              <div className="card">
                <p className="text-xs text-dojo-muted uppercase tracking-wider mb-2">Total Pendiente</p>
                <p className="text-3xl font-bold text-yellow-400">{formatCurrency(d.totalPending)}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Ranking Report */}
      {!loading && tab === "ranking" && data != null && (() => {
        const rankings = data as RankingEntry[];
        if (rankings.length === 0)
          return <p className="text-center py-16 text-dojo-muted">No hay cambios de cinta por ranking registrados.</p>;
        return (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dojo-border">
                  {["Alumno","Cinta Obtenida","Kata","Fecha","Edad"].map(h => (
                    <th key={h} className="text-left text-xs text-dojo-muted uppercase tracking-wider px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankings.map(r => (
                  <tr key={r.id} className="border-b border-dojo-border/40 hover:bg-dojo-border/10">
                    <td className="px-5 py-3 font-semibold text-dojo-white flex items-center gap-2">
                      <Trophy size={14} className="text-dojo-gold shrink-0"/>
                      {r.student.fullName}
                    </td>
                    <td className="px-5 py-3"><BeltBadge beltColor={r.beltColor}/></td>
                    <td className="px-5 py-3 text-dojo-muted">{r.kata?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-dojo-muted">{formatDate(r.changeDate)}</td>
                    <td className="px-5 py-3 text-dojo-muted">{calculateAge(r.student.birthDate)} años</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>{/* overflow-x-auto */}
          </div>
        );
      })()}
    </div>
  );
}
