"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Users, CreditCard, AlertTriangle, CheckCircle, Bell,
  Mail, X, Clock, CalendarClock, TrendingUp, ChevronRight,
  UserX, Loader2, TriangleAlert,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

/* ─── Types ────────────────────────────────────────────────── */
interface LateStudent {
  id: string; amount: number; dueDate: string; status: string;
  student: { id: string; fullName: string; motherEmail: string | null; fatherEmail: string | null };
}
interface AbsentStudent {
  id: string; fullName: string; lastSeen: string | null;
}
interface UpcomingPayment {
  id: string; amount: number; dueDate: string;
  student: { id: string; fullName: string };
}
interface Props {
  activeStudents:  number;
  totalStudents:   number;
  paidThisMonth:   number;
  pendingCount:    number;
  pendingAmount:   number;
  lateCount:       number;
  alertCount:      number;
  lateStudents:    LateStudent[];
  absentStudents:  AbsentStudent[];
  upcomingPayments:UpcomingPayment[];
}

type Panel = "payments" | "attendance" | "alerts" | null;
type AlertTab = "late" | "absent" | "upcoming";

/* ─── Helpers ──────────────────────────────────────────────── */
const daysAgo = (iso: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null;

const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

function Initials({ name, color = "#E53935" }: { name: string; color?: string }) {
  const letters = name.split(" ").slice(0, 2).map(w => w[0]).join("");
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: color + "20", color }}>
      {letters}
    </div>
  );
}

/* ─── Sheet wrapper (bottom sheet on mobile, modal on desktop) */
function Sheet({ open, onClose, title, badge, children }: {
  open: boolean; onClose: () => void; title: string;
  badge?: { count: number; color: string };
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />
      {/* Mobile: bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 rounded-t-2xl z-50 flex flex-col lg:hidden"
        style={{ background: "#0F2644", borderTop: "1px solid rgba(255,255,255,0.10)", maxHeight: "88vh" }}>
        <SheetHeader title={title} badge={badge} onClose={onClose} />
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
      {/* Desktop: centered panel */}
      <div className="fixed inset-0 z-50 items-center justify-center p-6 hidden lg:flex">
        <div className="w-full max-w-2xl rounded-2xl flex flex-col shadow-2xl"
          style={{ background: "#0F2644", border: "1px solid rgba(255,255,255,0.10)", maxHeight: "85vh" }}>
          <SheetHeader title={title} badge={badge} onClose={onClose} />
          <div className="overflow-y-auto flex-1">{children}</div>
        </div>
      </div>
    </>
  );
}

function SheetHeader({ title, badge, onClose }: {
  title: string; badge?: { count: number; color: string }; onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 shrink-0"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-3">
        <p className="font-display text-white font-bold text-base">{title}</p>
        {badge && badge.count > 0 && (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: badge.color + "25", color: badge.color, border: `1px solid ${badge.color}40` }}>
            {badge.count}
          </span>
        )}
      </div>
      <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
        <X size={18} style={{ color: "#7A97B0" }} />
      </button>
    </div>
  );
}

/* ─── Stat Card ────────────────────────────────────────────── */
interface CardProps {
  label:     string;
  value:     string | number;
  sub:       string;
  icon:      React.ElementType;
  accent:    string;     // hex color
  pulse?:    boolean;
  onClick?:  () => void;
  href?:     string;
}
function StatCard({ label, value, sub, icon: Icon, accent, pulse, onClick, href }: CardProps) {
  const clickable = !!onClick || !!href;
  const inner = (
    <div
      className={`card relative p-3 sm:p-5 flex flex-col gap-2 sm:gap-3 transition-all duration-200 select-none min-w-0
        ${clickable ? "cursor-pointer hover:-translate-y-0.5 active:scale-[0.98]" : ""}`}
      style={{ border: `1px solid ${accent}30` }}
      onClick={onClick}
    >
      {/* Accent line top */}
      <div className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full"
        style={{ background: `linear-gradient(90deg, ${accent}80, ${accent}20)` }} />

      {/* Icon + pulse/chevron row */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0"
            style={{ background: accent + "18" }}>
            <Icon size={14} style={{ color: accent }} />
          </div>
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide truncate"
            style={{ color: accent }}>
            {label}
          </span>
        </div>
        {pulse && (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
              style={{ background: accent }} />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ background: accent }} />
          </span>
        )}
        {clickable && !pulse && (
          <ChevronRight size={13} className="shrink-0" style={{ color: accent + "80" }} />
        )}
      </div>

      {/* Value */}
      <div className="min-w-0">
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-none truncate">{value}</p>
        <p className="text-[10px] sm:text-xs mt-1 truncate" style={{ color: "#7A97B0" }}>{sub}</p>
      </div>

      {clickable && (
        <p className="text-[10px] sm:text-xs font-medium hidden sm:block" style={{ color: accent + "90" }}>
          Ver detalle →
        </p>
      )}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

/* ─── Main Component ───────────────────────────────────────── */
export function DashboardStats({
  activeStudents, totalStudents, paidThisMonth,
  pendingCount, pendingAmount, lateCount, alertCount,
  lateStudents, absentStudents, upcomingPayments,
}: Props) {
  const [panel,    setPanel]    = useState<Panel>(null);
  const [alertTab, setAlertTab] = useState<AlertTab>("late");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending,  setSending]  = useState(false);
  const [sentMsg,  setSentMsg]  = useState("");

  const lateOnly = lateStudents.filter(p => p.status === "late");

  function openPanel(p: Panel) {
    setPanel(p); setSentMsg(""); setSelected(new Set());
  }

  function toggleAll() {
    const ids = lateStudents.map(p => p.id);
    setSelected(prev => prev.size === ids.length ? new Set() : new Set(ids));
  }
  function toggleOne(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function sendReminders() {
    setSending(true); setSentMsg("");
    const r = await fetch("/api/payments", { method: "PATCH" });
    const d = await r.json();
    setSentMsg(`${d.emailsSent ?? 0} recordatorio(s) enviado(s).`);
    setSending(false);
  }

  const inactiveStudents = totalStudents - activeStudents;

  /* ── Cards ── */
  const cards: CardProps[] = [
    {
      label:   "Alumnos",
      value:   activeStudents,
      sub:     `${inactiveStudents > 0 ? `${inactiveStudents} inactivos · ` : ""}${totalStudents} total`,
      icon:    Users,
      accent:  "#2980B9",   // dojo-info
      href:    "/dashboard/students",
    },
    {
      label:   "Cobrado",
      value:   formatCurrency(paidThisMonth),
      sub:     "este mes",
      icon:    CheckCircle,
      accent:  "#27AE60",   // dojo-success
    },
    {
      label:   "Atrasados",
      value:   lateCount,
      sub:     pendingCount > lateCount ? `${pendingCount} pendientes · ${formatCurrency(pendingAmount)}` : formatCurrency(pendingAmount),
      icon:    CreditCard,
      accent:  "#C0392B",   // dojo-red
      pulse:   lateCount > 0,
      onClick: lateStudents.length > 0 ? () => openPanel("payments") : undefined,
    },
    {
      label:   "Alertas",
      value:   alertCount,
      sub:     [
        lateCount > 0         && `${lateCount} atrasados`,
        absentStudents.length > 0 && `${absentStudents.length} sin asistencia`,
        upcomingPayments.length > 0 && `${upcomingPayments.length} por vencer`,
      ].filter(Boolean).join(" · ") || "sin alertas activas",
      icon:    TriangleAlert,
      accent:  "#E67E22",   // dojo-warning
      pulse:   alertCount > 0,
      onClick: alertCount > 0 ? () => { setAlertTab("late"); openPanel("alerts"); } : undefined,
    },
  ];

  return (
    <>
      {/* ── Grid de cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {cards.map(card => <StatCard key={card.label} {...card} />)}
      </div>

      {/* ─────────── Panel: Pagos Atrasados ─────────── */}
      <Sheet
        open={panel === "payments"}
        onClose={() => setPanel(null)}
        title="Pagos Pendientes y Atrasados"
        badge={{ count: lateStudents.length, color: "#EF4444" }}
      >
        {lateStudents.length === 0 ? (
          <EmptyState icon={CheckCircle} text="Sin pagos pendientes" color="#10B981" />
        ) : (
          <>
            {/* Select all */}
            <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox"
                  checked={selected.size === lateStudents.length && lateStudents.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4 accent-red-500" />
                <span className="text-sm text-white">Seleccionar todos ({lateStudents.length})</span>
              </label>
            </div>

            {/* List */}
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {lateStudents.map(p => {
                const days = daysAgo(p.dueDate) ?? 0;
                const isLate = p.status === "late";
                const hasMail = p.student.motherEmail || p.student.fatherEmail;
                return (
                  <label key={p.id} className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-white/5 transition-colors">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)}
                      className="w-4 h-4 accent-red-500 shrink-0" />
                    <Initials name={p.student.fullName} color={isLate ? "#EF4444" : "#F59E0B"} />
                    <div className="flex-1 min-w-0">
                      <Link href={`/dashboard/students/${p.student.id}`} onClick={() => setPanel(null)}
                        className="text-sm font-semibold text-white hover:text-red-400 transition-colors truncate block">
                        {p.student.fullName}
                      </Link>
                      <p className="text-xs mt-0.5" style={{ color: "#7A97B0" }}>
                        {formatCurrency(p.amount)} · vence {formatDate(p.dueDate)}
                        {days > 0 && <span style={{ color: "#EF4444" }} className="ml-1.5 font-semibold">+{days}d</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isLate
                        ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#EF444425", color: "#EF4444" }}>Atrasado</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "#F59E0B25", color: "#F59E0B" }}>Pendiente</span>
                      }
                      {hasMail && <Mail size={12} style={{ color: "#7A97B0" }} />}
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Footer action */}
            <div className="px-5 py-4 space-y-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              {sentMsg && <p className="text-emerald-400 text-sm text-center font-medium">{sentMsg}</p>}
              <div className="flex gap-3">
                <Link href="/dashboard/payments"
                  onClick={() => setPanel(null)}
                  className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: "rgba(255,255,255,0.07)", color: "#CBD5E1" }}>
                  Ver todos los pagos
                </Link>
                <button onClick={sendReminders} disabled={sending || selected.size === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                  style={{ background: "#E53935" }}>
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
                  {sending ? "Enviando..." : `Recordar${selected.size > 0 ? ` (${selected.size})` : ""}`}
                </button>
              </div>
            </div>
          </>
        )}
      </Sheet>

      {/* ─────────── Panel: Alertas consolidadas ─────────── */}
      <Sheet
        open={panel === "alerts"}
        onClose={() => setPanel(null)}
        title="Alertas del Dojo"
        badge={{ count: alertCount, color: "#E67E22" }}
      >
        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {([
            { key: "late" as AlertTab,     label: "Atrasados",     count: lateOnly.length,          color: "#C0392B" },
            { key: "absent" as AlertTab,   label: "Sin asistencia",count: absentStudents.length,    color: "#E67E22" },
            { key: "upcoming" as AlertTab, label: "Por vencer",    count: upcomingPayments.length,  color: "#2980B9" },
          ]).map(tab => (
            <button key={tab.key}
              onClick={() => setAlertTab(tab.key)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
                alertTab === tab.key ? "border-current" : "border-transparent"
              }`}
              style={{ color: alertTab === tab.key ? tab.color : "#7A97B0" }}
            >
              <span className="text-lg font-bold leading-none">{tab.count}</span>
              <span className="uppercase tracking-wide">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab: Pagos Atrasados */}
        {alertTab === "late" && (
          lateOnly.length === 0
            ? <EmptyState icon={CheckCircle} text="Sin pagos atrasados" color="#10B981" />
            : <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {lateOnly.map(p => {
                  const days = daysAgo(p.dueDate) ?? 0;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                      <Initials name={p.student.fullName} color="#EF4444" />
                      <div className="flex-1 min-w-0">
                        <Link href={`/dashboard/students/${p.student.id}`} onClick={() => setPanel(null)}
                          className="text-sm font-semibold text-white hover:text-red-400 transition-colors truncate block">
                          {p.student.fullName}
                        </Link>
                        <p className="text-xs mt-0.5" style={{ color: "#7A97B0" }}>
                          {formatCurrency(p.amount)} · venció {formatDate(p.dueDate)}
                        </p>
                      </div>
                      <span className="text-xs font-bold shrink-0" style={{ color: "#EF4444" }}>+{days}d</span>
                    </div>
                  );
                })}
              </div>
        )}

        {/* Tab: Sin Asistencia */}
        {alertTab === "absent" && (
          absentStudents.length === 0
            ? <EmptyState icon={Users} text="Todos los alumnos asistieron recientemente" color="#10B981" />
            : <>
                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <Clock size={13} style={{ color: "#F59E0B" }} />
                  <p className="text-xs" style={{ color: "#7A97B0" }}>Alumnos sin asistencia registrada en los últimos 14 días</p>
                </div>
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  {absentStudents.map(s => {
                    const days = daysAgo(s.lastSeen);
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                        <Initials name={s.fullName} color="#F59E0B" />
                        <div className="flex-1 min-w-0">
                          <Link href={`/dashboard/students/${s.id}`} onClick={() => setPanel(null)}
                            className="text-sm font-semibold text-white hover:text-yellow-400 transition-colors truncate block">
                            {s.fullName}
                          </Link>
                          <p className="text-xs mt-0.5" style={{ color: "#7A97B0" }}>
                            {s.lastSeen
                              ? `Última vez hace ${days} días (${formatDate(s.lastSeen)})`
                              : "Sin asistencia registrada"}
                          </p>
                        </div>
                        <UserX size={15} style={{ color: days && days > 30 ? "#EF4444" : "#F59E0B" }} className="shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </>
        )}

        {/* Tab: Por Vencer */}
        {alertTab === "upcoming" && (
          upcomingPayments.length === 0
            ? <EmptyState icon={CalendarClock} text="Sin pagos próximos a vencer" color="#3B82F6" />
            : <>
                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <CalendarClock size={13} style={{ color: "#3B82F6" }} />
                  <p className="text-xs" style={{ color: "#7A97B0" }}>Pagos que vencen en los próximos 7 días</p>
                </div>
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  {upcomingPayments.map(p => {
                    const days = daysUntil(p.dueDate);
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                        <Initials name={p.student.fullName} color="#3B82F6" />
                        <div className="flex-1 min-w-0">
                          <Link href={`/dashboard/students/${p.student.id}`} onClick={() => setPanel(null)}
                            className="text-sm font-semibold text-white hover:text-blue-400 transition-colors truncate block">
                            {p.student.fullName}
                          </Link>
                          <p className="text-xs mt-0.5" style={{ color: "#7A97B0" }}>
                            {formatCurrency(p.amount)} · vence {formatDate(p.dueDate)}
                          </p>
                        </div>
                        <span className="text-xs font-bold shrink-0 px-2 py-0.5 rounded-full"
                          style={{ background: "#3B82F620", color: "#3B82F6" }}>
                          {days === 0 ? "hoy" : `en ${days}d`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
        )}

        <div className="px-5 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <Link href="/dashboard/payments" onClick={() => setPanel(null)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: "rgba(255,255,255,0.07)", color: "#CBD5E1" }}>
            <TrendingUp size={15} /> Ver módulo de Pagos
          </Link>
        </div>
      </Sheet>
    </>
  );
}

function EmptyState({ icon: Icon, text, color }: { icon: React.ElementType; text: string; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14" style={{ color: "#7A97B0" }}>
      <Icon size={40} className="mb-3 opacity-40" style={{ color }} />
      <p className="text-sm text-center">{text}</p>
    </div>
  );
}
