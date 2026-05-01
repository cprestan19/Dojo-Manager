"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Bell, ChevronDown, LogOut, KeyRound,
  CreditCard, UserX, AlertTriangle, X, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────── */
interface LateItem { id: string; studentId: string; studentName: string; amount: number; dueDate: string; daysLate: number }
interface AbsenceItem { id: string; fullName: string; daysSince: number | null; status: "ALERTA" | "RIESGO" }
interface Notifications {
  total: number;
  latePayments: { count: number; amount: number; items: LateItem[] };
  attendance: { alert: { count: number; students: AbsenceItem[] }; risk: { count: number; students: AbsenceItem[] } };
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

/* ─── Notification Panel ─────────────────────────────────── */
function NotificationPanel({ data, onClose }: { data: Notifications; onClose: () => void }) {
  const hasLate    = data.latePayments.count > 0;
  const hasAlert   = data.attendance.alert.count > 0;
  const hasRisk    = data.attendance.risk.count > 0;
  const hasNothing = !hasLate && !hasAlert && !hasRisk;

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-dojo-dark border border-dojo-border rounded-2xl shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dojo-border">
        <p className="font-semibold text-dojo-white text-sm">Notificaciones</p>
        <button onClick={onClose} className="text-dojo-muted hover:text-dojo-white transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="overflow-y-auto max-h-[420px]">
        {hasNothing && (
          <div className="flex flex-col items-center justify-center py-10 text-dojo-muted">
            <Bell size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Sin notificaciones pendientes</p>
          </div>
        )}

        {/* ── Pagos Atrasados ── */}
        {hasLate && (
          <div>
            <div className="flex items-center gap-2 px-4 py-2 bg-red-900/20 border-b border-dojo-border/40">
              <CreditCard size={13} className="text-red-400 shrink-0" />
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">
                Pagos atrasados ({data.latePayments.count})
              </p>
              <span className="ml-auto text-xs text-red-300 font-semibold">
                {fmtCurrency(data.latePayments.amount)}
              </span>
            </div>
            {data.latePayments.items.map(p => (
              <Link key={p.id} href={`/dashboard/students/${p.studentId}`} onClick={onClose}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-dojo-border/20 transition-colors border-b border-dojo-border/20">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "#EF444420", color: "#EF4444" }}>
                  {p.studentName.split(" ").slice(0,2).map(w=>w[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-dojo-white truncate">{p.studentName}</p>
                  <p className="text-[10px] text-dojo-muted">{fmtCurrency(p.amount)} · +{p.daysLate}d atraso</p>
                </div>
              </Link>
            ))}
            {data.latePayments.count > 10 && (
              <Link href="/dashboard/payments" onClick={onClose}
                className="block px-4 py-2 text-xs text-center text-dojo-red hover:underline border-b border-dojo-border/20">
                Ver todos los pagos atrasados →
              </Link>
            )}
          </div>
        )}

        {/* ── Alumnos en RIESGO (14+ días) ── */}
        {hasRisk && (
          <div>
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-900/20 border-b border-dojo-border/40">
              <UserX size={13} className="text-orange-400 shrink-0" />
              <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                En riesgo de abandono ({data.attendance.risk.count})
              </p>
            </div>
            {data.attendance.risk.students.map(s => (
              <Link key={s.id} href={`/dashboard/students/${s.id}`} onClick={onClose}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-dojo-border/20 transition-colors border-b border-dojo-border/20">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "#F97316" + "20", color: "#F97316" }}>
                  {s.fullName.split(" ").slice(0,2).map(w=>w[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-dojo-white truncate">{s.fullName}</p>
                  <p className="text-[10px] text-dojo-muted">
                    {s.daysSince !== null ? `${s.daysSince} días sin asistir` : "Sin asistencia registrada"}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: "#F97316" + "25", color: "#F97316" }}>RIESGO</span>
              </Link>
            ))}
          </div>
        )}

        {/* ── Alumnos en ALERTA (3–13 días) ── */}
        {hasAlert && (
          <div>
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-900/20 border-b border-dojo-border/40">
              <AlertTriangle size={13} className="text-yellow-400 shrink-0" />
              <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                Ausencias recientes ({data.attendance.alert.count})
              </p>
            </div>
            {data.attendance.alert.students.map(s => (
              <Link key={s.id} href={`/dashboard/students/${s.id}`} onClick={onClose}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-dojo-border/20 transition-colors border-b border-dojo-border/20">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "#EAB30820", color: "#EAB308" }}>
                  {s.fullName.split(" ").slice(0,2).map(w=>w[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-dojo-white truncate">{s.fullName}</p>
                  <p className="text-[10px] text-dojo-muted">
                    {s.daysSince !== null ? `${s.daysSince} días sin asistir` : "Sin asistencia registrada"}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: "#EAB30825", color: "#EAB308" }}>ALERTA</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-dojo-border flex gap-2">
        <Link href="/dashboard/payments" onClick={onClose}
          className="flex-1 text-center text-xs text-dojo-muted hover:text-dojo-white transition-colors py-1.5 rounded-lg hover:bg-dojo-border">
          Ver pagos
        </Link>
        <Link href="/dashboard/students" onClick={onClose}
          className="flex-1 text-center text-xs text-dojo-muted hover:text-dojo-white transition-colors py-1.5 rounded-lg hover:bg-dojo-border">
          Ver alumnos
        </Link>
      </div>
    </div>
  );
}

/* ─── TopBar ─────────────────────────────────────────────── */
export function TopBar() {
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bellOpen,     setBellOpen]     = useState(false);
  const [notifs,       setNotifs]       = useState<Notifications | null>(null);
  const [notifsLoaded, setNotifsLoaded] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef     = useRef<HTMLDivElement>(null);

  const role     = (session?.user as { role?: string })?.role ?? "user";
  const name     = session?.user?.name ?? "";
  const photo    = session?.user?.image ?? null;
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const roleLabel =
    role === "sysadmin" ? "Super Admin" :
    role === "admin"    ? "Administrador" : "Usuario";

  const fetchNotifs = useCallback(async () => {
    if (role === "user") return; // users don't see notifications
    try {
      const r = await fetch("/api/notifications");
      if (r.ok) { setNotifs(await r.json()); setNotifsLoaded(true); }
    } catch { /* silent */ }
  }, [role]);

  // Load on mount + refresh every 5 minutes
  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (bellRef.current     && !bellRef.current.contains(e.target as Node))     setBellOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const totalNotifs = notifs?.total ?? 0;
  const showBell    = role === "sysadmin" || role === "admin";

  return (
    <header className="hidden lg:flex h-16 items-center justify-between px-6 bg-dojo-dark border-b border-dojo-border gap-4 shrink-0">
      {/* Left spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2">

        {/* ── Notification Bell (admin/sysadmin only) ── */}
        {showBell && (
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => { setBellOpen(o => !o); if (!bellOpen) fetchNotifs(); }}
              aria-label={`${totalNotifs} notificaciones`}
              className="relative p-2 rounded-lg text-dojo-muted hover:bg-dojo-border hover:text-dojo-white transition-colors"
            >
              <Bell size={20} />
              {notifsLoaded && totalNotifs > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-dojo-red rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none px-1">
                  {totalNotifs > 99 ? "99+" : totalNotifs}
                </span>
              )}
            </button>
            {bellOpen && notifs && (
              <NotificationPanel data={notifs} onClose={() => setBellOpen(false)} />
            )}
          </div>
        )}

        <div className="w-px h-6 bg-dojo-border mx-1" />

        {/* ── User profile dropdown ── */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-dojo-border transition-colors"
          >
            <div className="w-8 h-8 bg-dojo-border rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-dojo-gold flex-shrink-0">
              {photo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={photo} alt="" className="w-full h-full object-cover" />
                : initials || "?"
              }
            </div>
            <div className="text-left hidden xl:block">
              <p className="text-sm font-semibold text-dojo-white leading-tight truncate max-w-[140px]">{name}</p>
              <p className="text-[11px] text-dojo-muted leading-tight">{roleLabel}</p>
            </div>
            <ChevronDown size={14} className={cn("text-dojo-muted transition-transform duration-200", dropdownOpen && "rotate-180")} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-dojo-dark border border-dojo-border rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-dojo-border">
                <div className="w-9 h-9 bg-dojo-border rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-dojo-gold flex-shrink-0">
                  {photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={photo} alt="" className="w-full h-full object-cover" />
                    : initials || "?"
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-dojo-white truncate">{name}</p>
                  <p className="text-xs text-dojo-muted">{roleLabel}</p>
                </div>
              </div>
              <div className="p-1.5 space-y-0.5">
                <Link href="/dashboard/change-password" onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dojo-muted hover:bg-dojo-border hover:text-dojo-white transition-colors">
                  <KeyRound size={15} /> Cambiar Contraseña
                </Link>
                <button onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dojo-muted hover:bg-dojo-red/10 hover:text-dojo-red transition-colors">
                  <LogOut size={15} /> Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
