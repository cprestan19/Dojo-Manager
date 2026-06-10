"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown, ChevronUp, Award, CreditCard, Star,
  Calendar, Fingerprint, Trophy, Users, Heart,
  Phone, User, ClipboardList, LogIn, LogOut,
} from "lucide-react";
import { StudentQR } from "@/components/students/StudentQR";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FamilyMember {
  id:          string;
  fullName:    string;
  studentCode: number | null;
  cardToken:   string | null;
  photo:       string | null;
  isMain:      boolean;
  // Belt
  currentBeltLabel: string | null;
  currentBeltHex:   string | null;
  beltHistory: { label: string; hex: string; date: string; isRanking: boolean; kataName: string | null }[];
  // Payments
  payments: { id: string; amount: number; dueDate: string; status: string }[];
  // Kata competitions
  kataCompetitions: { id: string; kataName: string | null; tournament: string | null; result: string | null; date: string }[];
  // Schedules
  schedules: { name: string; days: string[]; startTime: string; endTime: string }[];
  // Attendance (recent)
  attendances: { id: string; type: string; markedAt: string; scheduleName: string | null }[];
  // Personal
  birthDate:   string;
  gender:      string;
  nationality: string;
  cedula:      string | null;
  address:     string | null;
  // Health
  bloodType:          string | null;
  condition:          string | null;
  hasPrivateInsurance: boolean;
  insuranceName:      string | null;
  insuranceNumber:    string | null;
  // Contacts
  motherName:  string | null;
  motherPhone: string | null;
  fatherName:  string | null;
  fatherPhone: string | null;
  // Inscription
  inscription: {
    date:         string;
    paymentPeriod: string;
    monthlyAmt:   number;
    periodLabel:  string;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABEL: Record<string, string> = {
  lunes: "Lun", martes: "Mar", miercoles: "Mié",
  jueves: "Jue", viernes: "Vie", sabado: "Sáb", domingo: "Dom",
};

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <p className="text-[11px] font-bold text-dojo-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
      <Icon size={11} /> {label}
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FamilyMemberAccordion({ members }: { members: FamilyMember[] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Card header */}
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

            {/* ── Cabecera del acordeón ── */}
            <button
              type="button"
              onClick={() => toggle(m.id)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dojo-darker/40 transition-colors text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-dojo-border overflow-hidden flex items-center justify-center text-sm font-bold text-dojo-gold shrink-0">
                {m.photo?.startsWith("http")
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={m.photo} alt="" className="w-full h-full object-cover" />
                  : m.fullName.split(" ").slice(0, 2).map(w => w[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-dojo-white text-sm leading-tight">{m.fullName}</p>
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
                    ? <span className="text-[11px] text-yellow-400 font-semibold">⚠️ {pending} pago{pending > 1 ? "s" : ""} pendiente{pending > 1 ? "s" : ""}</span>
                    : <span className="text-[11px] text-green-400 font-semibold">✓ Al día</span>}
                </div>
              </div>
              <div className="shrink-0 text-dojo-muted">
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {/* ── Contenido expandido ── */}
            {isOpen && (
              <div className="border-t border-dojo-border/50 px-4 pb-5 pt-4 space-y-5">

                {/* 1. Pagos */}
                <section>
                  <SectionTitle icon={CreditCard} label="Pagos Pendientes" />
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

                {/* 2. Marcaciones recientes */}
                <section>
                  <SectionTitle icon={ClipboardList} label="Marcaciones Recientes" />
                  {m.attendances.length > 0 ? (
                    <div className="space-y-1">
                      {m.attendances.map(a => (
                        <div key={a.id} className="flex items-center gap-2.5 text-xs py-1.5 border-b border-dojo-border/20 last:border-0">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            a.type === "entry" ? "bg-green-900/40" : "bg-red-900/40"
                          }`}>
                            {a.type === "entry"
                              ? <LogIn  size={11} className="text-green-400" />
                              : <LogOut size={11} className="text-red-400" />}
                          </div>
                          <span className="text-dojo-white flex-1">{a.markedAt}</span>
                          <span className={`font-semibold shrink-0 ${a.type === "entry" ? "text-green-400" : "text-red-400"}`}>
                            {a.type === "entry" ? "Entrada" : "Salida"}
                          </span>
                        </div>
                      ))}
                      {m.isMain && (
                        <Link href="/portal/attendance" className="block mt-1 text-[10px] text-dojo-red hover:underline text-right">
                          Ver historial completo →
                        </Link>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-dojo-muted bg-dojo-darker rounded-lg px-3 py-2">Sin marcaciones recientes.</p>
                  )}
                </section>

                {/* 3. Horarios */}
                {m.schedules.length > 0 && (
                  <section>
                    <SectionTitle icon={Calendar} label="Horarios" />
                    <div className="space-y-2">
                      {m.schedules.map((s, i) => (
                        <div key={i} className="text-xs p-2.5 rounded-lg bg-dojo-darker border border-dojo-border/60">
                          <p className="text-dojo-white font-semibold">{s.name}</p>
                          <p className="text-dojo-muted mt-0.5">
                            {s.days.map(d => DAY_LABEL[d] ?? d).join(" · ")} · {s.startTime} – {s.endTime}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 4. Cintas */}
                {m.beltHistory.length > 0 && (
                  <section>
                    <SectionTitle icon={Award} label="Cintas" />
                    <div className="space-y-0">
                      {m.beltHistory.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-dojo-border/20 last:border-0">
                          <span className="w-3 h-3 rounded-full shrink-0 border border-white/20" style={{ backgroundColor: b.hex }} />
                          <span className={`font-medium ${i === 0 ? "text-dojo-white" : "text-dojo-muted"}`}>{b.label}</span>
                          {i === 0 && <span className="badge-blue text-[9px]">Actual</span>}
                          {b.isRanking && <span className="text-dojo-gold text-[9px] flex items-center gap-0.5"><Trophy size={8} />Ranking</span>}
                          {b.kataName && <span className="text-dojo-muted text-[10px] truncate flex-1">{b.kataName}</span>}
                          <span className="text-dojo-muted ml-auto shrink-0 text-[10px]">{b.date}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 5. Competencias */}
                {m.kataCompetitions.length > 0 && (
                  <section>
                    <SectionTitle icon={Star} label="Competencias" />
                    <div className="space-y-2">
                      {m.kataCompetitions.map(k => (
                        <div key={k.id} className="text-xs p-2.5 rounded-lg bg-dojo-darker border border-dojo-border/60 space-y-0.5">
                          <p className="text-dojo-white font-semibold">{k.kataName ?? <span className="italic text-dojo-muted">Sin kata</span>}</p>
                          {k.tournament && <p className="text-dojo-muted">🏟 {k.tournament}</p>}
                          {k.result     && <p className="text-dojo-gold font-semibold">🏅 {k.result}</p>}
                          <p className="text-dojo-muted text-[10px]">{k.date}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 6. Datos personales */}
                <section>
                  <SectionTitle icon={User} label="Datos Personales" />
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-dojo-darker rounded-lg p-3 border border-dojo-border/60">
                    <div>
                      <dt className="text-dojo-muted">Nacimiento</dt>
                      <dd className="text-dojo-white">{m.birthDate}</dd>
                    </div>
                    <div>
                      <dt className="text-dojo-muted">Género</dt>
                      <dd className="text-dojo-white">{m.gender === "M" ? "Masculino" : "Femenino"}</dd>
                    </div>
                    <div>
                      <dt className="text-dojo-muted">Nacionalidad</dt>
                      <dd className="text-dojo-white">{m.nationality}</dd>
                    </div>
                    {m.cedula && (
                      <div>
                        <dt className="text-dojo-muted">Cédula</dt>
                        <dd className="text-dojo-white font-mono">{m.cedula}</dd>
                      </div>
                    )}
                    {m.address && (
                      <div className="col-span-2">
                        <dt className="text-dojo-muted">Dirección</dt>
                        <dd className="text-dojo-white">{m.address}</dd>
                      </div>
                    )}
                  </dl>
                </section>

                {/* 7. Salud */}
                {(m.bloodType || m.condition || m.hasPrivateInsurance) && (
                  <section>
                    <SectionTitle icon={Heart} label="Salud" />
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-dojo-darker rounded-lg p-3 border border-dojo-border/60">
                      {m.bloodType && (
                        <div>
                          <dt className="text-dojo-muted">Tipo de sangre</dt>
                          <dd className="text-dojo-white font-semibold">{m.bloodType}</dd>
                        </div>
                      )}
                      {m.condition && (
                        <div className="col-span-2">
                          <dt className="text-dojo-muted">Condición</dt>
                          <dd className="text-dojo-white">{m.condition}</dd>
                        </div>
                      )}
                      {m.hasPrivateInsurance && m.insuranceName && (
                        <div>
                          <dt className="text-dojo-muted">Aseguradora</dt>
                          <dd className="text-dojo-white">{m.insuranceName}</dd>
                        </div>
                      )}
                      {m.hasPrivateInsurance && m.insuranceNumber && (
                        <div>
                          <dt className="text-dojo-muted">Póliza</dt>
                          <dd className="text-dojo-white font-mono">{m.insuranceNumber}</dd>
                        </div>
                      )}
                    </dl>
                  </section>
                )}

                {/* 8. Acudientes */}
                {(m.motherName || m.fatherName) && (
                  <section>
                    <SectionTitle icon={Phone} label="Acudientes" />
                    <div className="space-y-2">
                      {m.motherName && (
                        <div className="flex items-start gap-2 text-xs bg-dojo-darker rounded-lg p-3 border border-dojo-border/60">
                          <div className="w-6 h-6 rounded-full bg-dojo-border flex items-center justify-center text-[10px] font-bold text-dojo-gold shrink-0 mt-0.5">
                            {m.motherName[0]}
                          </div>
                          <div>
                            <p className="text-dojo-white font-medium">{m.motherName}</p>
                            <p className="text-dojo-muted text-[10px]">Madre / Tutora</p>
                            {m.motherPhone && <p className="text-dojo-gold font-mono text-[10px]">{m.motherPhone}</p>}
                          </div>
                        </div>
                      )}
                      {m.fatherName && (
                        <div className="flex items-start gap-2 text-xs bg-dojo-darker rounded-lg p-3 border border-dojo-border/60">
                          <div className="w-6 h-6 rounded-full bg-dojo-border flex items-center justify-center text-[10px] font-bold text-dojo-gold shrink-0 mt-0.5">
                            {m.fatherName[0]}
                          </div>
                          <div>
                            <p className="text-dojo-white font-medium">{m.fatherName}</p>
                            <p className="text-dojo-muted text-[10px]">Padre / Tutor</p>
                            {m.fatherPhone && <p className="text-dojo-gold font-mono text-[10px]">{m.fatherPhone}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* 9. Inscripción */}
                {m.inscription && (
                  <section>
                    <SectionTitle icon={Calendar} label="Inscripción" />
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs bg-dojo-darker rounded-lg p-3 border border-dojo-border/60">
                      <div>
                        <dt className="text-dojo-muted">Fecha</dt>
                        <dd className="text-dojo-white">{m.inscription.date}</dd>
                      </div>
                      <div>
                        <dt className="text-dojo-muted">Periodo</dt>
                        <dd className="text-dojo-white capitalize">
                          {m.inscription.paymentPeriod === "biweekly" ? "Quincenal" : "Mensual"}
                        </dd>
                      </div>
                      {m.inscription.monthlyAmt > 0 && (
                        <div>
                          <dt className="text-dojo-muted">Monto por {m.inscription.periodLabel}</dt>
                          <dd className="text-dojo-gold font-semibold">${m.inscription.monthlyAmt.toFixed(2)}</dd>
                        </div>
                      )}
                    </dl>
                  </section>
                )}

                {/* 10. QR */}
                <StudentQR studentCode={m.studentCode} cardToken={m.cardToken} fullName={m.fullName} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
