"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown, ChevronUp, Award, CreditCard,
  Star, Calendar, Fingerprint, Trophy, Users,
} from "lucide-react";
import { StudentQR } from "@/components/students/StudentQR";

export interface FamilyMember {
  id:           string;
  fullName:     string;
  studentCode:  number | null;
  photo:        string | null;
  isMain:       boolean;
  // Belt
  currentBeltLabel: string | null;
  currentBeltHex:   string | null;
  beltHistory: {
    label:    string;
    hex:      string;
    date:     string;
    isRanking: boolean;
    kataName: string | null;
  }[];
  // Payments (already pending/late)
  payments: {
    id:     string;
    amount: number;
    dueDate: string;
    status: string;
  }[];
  // Kata competitions
  kataCompetitions: {
    id:         string;
    kataName:   string | null;
    tournament: string | null;
    result:     string | null;
    date:       string;
  }[];
  // Schedules
  schedules: {
    name:      string;
    days:      string[];
    startTime: string;
    endTime:   string;
  }[];
}

const DAY_LABEL: Record<string, string> = {
  lunes: "Lun", martes: "Mar", miercoles: "Mié",
  jueves: "Jue", viernes: "Vie", sabado: "Sáb", domingo: "Dom",
};

export function FamilyMemberAccordion({ members }: { members: FamilyMember[] }) {
  // First member (main student) starts expanded
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(members[0]?.id ? [members[0].id] : [])
  );

  function toggle(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-dojo-border bg-dojo-darker/60">
        <Users size={14} className="text-dojo-muted" />
        <p className="text-xs font-bold text-dojo-muted uppercase tracking-wider">
          Resumen Familiar — {members.length} miembro{members.length !== 1 ? "s" : ""}
        </p>
      </div>

      {members.map((m, idx) => {
        const isOpen  = openIds.has(m.id);
        const isLast  = idx === members.length - 1;
        const pending = m.payments.length;

        return (
          <div key={m.id} className={!isLast ? "border-b border-dojo-border" : ""}>

            {/* ── Acordeón: cabecera siempre visible ── */}
            <button
              type="button"
              onClick={() => toggle(m.id)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dojo-darker/40 transition-colors text-left"
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-xl bg-dojo-border overflow-hidden flex items-center justify-center text-sm font-bold text-dojo-gold shrink-0">
                {m.photo?.startsWith("http")
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={m.photo} alt="" className="w-full h-full object-cover" />
                  : m.fullName.split(" ").slice(0, 2).map(w => w[0]).join("")}
              </div>

              {/* Info resumen */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-dojo-white text-sm leading-tight">{m.fullName}</p>
                  {m.isMain && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-dojo-red/20 text-dojo-red border border-dojo-red/30 shrink-0">
                      Tú
                    </span>
                  )}
                </div>
                {m.studentCode != null && (
                  <span className="font-mono text-[11px] text-dojo-gold flex items-center gap-1 mt-0.5">
                    <Fingerprint size={9} /> #{m.studentCode}
                  </span>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {m.currentBeltLabel && (
                    <span className="text-xs font-semibold flex items-center gap-1"
                      style={{ color: m.currentBeltHex === "#FFFFFF" ? "#ccc" : (m.currentBeltHex ?? "#aaa") }}>
                      <span className="w-2 h-2 rounded-full inline-block border border-white/20"
                        style={{ backgroundColor: m.currentBeltHex ?? "#888" }} />
                      {m.currentBeltLabel}
                    </span>
                  )}
                  {pending > 0
                    ? <span className="text-[11px] text-yellow-400 font-semibold">
                        ⚠️ {pending} pago{pending > 1 ? "s" : ""} pendiente{pending > 1 ? "s" : ""}
                      </span>
                    : <span className="text-[11px] text-green-400 font-semibold">✓ Al día</span>
                  }
                </div>
              </div>

              {/* Chevron */}
              <div className="shrink-0 text-dojo-muted">
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {/* ── Contenido expandido ── */}
            {isOpen && (
              <div className="border-t border-dojo-border/50 px-4 pb-5 space-y-5 pt-4">

                {/* Pagos */}
                <section>
                  <p className="text-[11px] font-bold text-dojo-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CreditCard size={11} /> Pagos
                  </p>
                  {m.payments.length > 0 ? (
                    <div className="rounded-lg border border-yellow-800/40 bg-yellow-900/10 px-3 py-2.5 space-y-1.5">
                      {m.payments.map(p => (
                        <div key={p.id} className="flex justify-between text-xs">
                          <span className="text-dojo-muted">{p.dueDate}</span>
                          <span className={p.status === "late" ? "text-red-400 font-semibold" : "text-yellow-400"}>
                            ${p.amount.toFixed(2)} · {p.status === "late" ? "Atrasado" : "Pendiente"}
                          </span>
                        </div>
                      ))}
                      {m.isMain && (
                        <Link href="/portal/payments" className="block mt-1 text-[10px] text-dojo-red hover:underline text-right">
                          Ver historial completo →
                        </Link>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-green-400 font-semibold bg-green-900/10 border border-green-800/40 rounded-lg px-3 py-2">
                      ✓ Al día en pagos
                    </p>
                  )}
                </section>

                {/* Cintas */}
                {m.beltHistory.length > 0 && (
                  <section>
                    <p className="text-[11px] font-bold text-dojo-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Award size={11} /> Cintas
                    </p>
                    <div className="space-y-1">
                      {m.beltHistory.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-dojo-border/20 last:border-0">
                          <span className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                            style={{ backgroundColor: b.hex }} />
                          <span className={`font-medium ${i === 0 ? "text-dojo-white" : "text-dojo-muted"}`}>
                            {b.label}
                          </span>
                          {i === 0 && <span className="badge-blue text-[9px]">Actual</span>}
                          {b.isRanking && (
                            <span className="text-dojo-gold text-[9px] flex items-center gap-0.5">
                              <Trophy size={8} /> Ranking
                            </span>
                          )}
                          {b.kataName && (
                            <span className="text-dojo-muted text-[10px] truncate flex-1">{b.kataName}</span>
                          )}
                          <span className="text-dojo-muted ml-auto shrink-0 text-[10px]">{b.date}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Competencias */}
                {m.kataCompetitions.length > 0 && (
                  <section>
                    <p className="text-[11px] font-bold text-dojo-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Star size={11} className="text-dojo-gold" /> Competencias
                    </p>
                    <div className="space-y-2">
                      {m.kataCompetitions.map(k => (
                        <div key={k.id} className="text-xs p-2.5 rounded-lg bg-dojo-darker border border-dojo-border/60 space-y-0.5">
                          <p className="text-dojo-white font-semibold">{k.kataName ?? <span className="italic text-dojo-muted">Sin kata</span>}</p>
                          {k.tournament && <p className="text-dojo-muted">🏟 {k.tournament}</p>}
                          {k.result    && <p className="text-dojo-gold font-semibold">🏅 {k.result}</p>}
                          <p className="text-dojo-muted text-[10px]">{k.date}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Horarios */}
                {m.schedules.length > 0 && (
                  <section>
                    <p className="text-[11px] font-bold text-dojo-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Calendar size={11} /> Horarios
                    </p>
                    <div className="space-y-2">
                      {m.schedules.map((s, i) => (
                        <div key={i} className="text-xs p-2.5 rounded-lg bg-dojo-darker border border-dojo-border/60">
                          <p className="text-dojo-white font-semibold">{s.name}</p>
                          <p className="text-dojo-muted mt-0.5">
                            {s.days.map(d => DAY_LABEL[d] ?? d).join(" · ")}
                            {" · "}{s.startTime} – {s.endTime}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* QR */}
                <StudentQR studentCode={m.studentCode} fullName={m.fullName} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
