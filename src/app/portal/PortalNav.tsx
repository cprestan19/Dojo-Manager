"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { User, CreditCard, Clock, ClipboardList, LogOut, Video, Calendar, Radio, X, Bell } from "lucide-react";
import { getBeltInfo } from "@/lib/utils";
import Image from "next/image";

interface Props {
  student: {
    id: string;
    fullName: string;
    photo: string | null;
    dojo: { name: string; logo: string | null } | null;
    beltHistory: { beltColor: string }[];
  };
}

interface PortalNotifications {
  total:           number;
  newEvents:       number;
  newVideos:       number;
  newSchedules:    number;
  pendingPayments: number;
  events:     { id: string; title: string; startDate: string }[];
  videos:     { id: string; title: string; beltColor: string }[];
}

const BASE_TABS = [
  { href: "/portal",            label: "Perfil",      icon: User          },
  { href: "/portal/payments",   label: "Pagos",       icon: CreditCard    },
  { href: "/portal/schedules",  label: "Horarios",    icon: Clock         },
  { href: "/portal/attendance", label: "Asistencia",  icon: ClipboardList },
  { href: "/portal/videos",     label: "Videos",      icon: Video         },
  { href: "/portal/events",     label: "Eventos",     icon: Calendar      },
];

const STORAGE_KEY = "portal_notif_seen_at";

export default function PortalNav({ student }: Props) {
  const pathname  = usePathname();
  const belt      = student.beltHistory[0]?.beltColor;
  const beltInfo  = belt ? getBeltInfo(belt) : null;
  const initials  = student.fullName.split(" ").slice(0, 2).map(w => w[0]).join("");

  const [hasLive,  setHasLive]  = useState(false);
  const [notifs,   setNotifs]   = useState<PortalNotifications | null>(null);
  const [showAlert,setShowAlert]= useState(false);
  const [dismissed,setDismissed]= useState(false);

  // ── Live tatamis check ──────────────────────────────────────────
  useEffect(() => {
    fetch("/api/portal/live-tatamis")
      .then(r => r.ok ? r.json() : { tatamis: [] })
      .then(d => setHasLive((d.tatamis?.length ?? 0) > 0))
      .catch(() => null);
    const iv = setInterval(() => {
      fetch("/api/portal/live-tatamis")
        .then(r => r.ok ? r.json() : { tatamis: [] })
        .then(d => setHasLive((d.tatamis?.length ?? 0) > 0))
        .catch(() => null);
    }, 30_000);
    return () => clearInterval(iv);
  }, []);

  // ── Portal notifications ────────────────────────────────────────
  const checkNotifications = useCallback(() => {
    const since = localStorage.getItem(STORAGE_KEY) ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    fetch(`/api/portal/notifications?since=${encodeURIComponent(since)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: PortalNotifications | null) => {
        if (data) {
          setNotifs(data);
          // El banner aparece si hay contenido nuevo O pagos pendientes
          if (data.total > 0 || data.pendingPayments > 0) {
            setShowAlert(true);
          }
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    checkNotifications();
  }, [checkNotifications]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setShowAlert(false);
    setDismissed(true);
  }

  // Al navegar a las secciones con contenido nuevo, marcar como visto
  useEffect(() => {
    if (
      pathname === "/portal/events"    ||
      pathname === "/portal/videos"    ||
      pathname === "/portal/schedules"
    ) {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setShowAlert(false);
    }
  }, [pathname]);

  const tabs = [
    ...BASE_TABS.map(t => ({
      ...t,
      badge: hasLive && t.href === "/portal/live" ? true : false,
      // Punto dorado — contenido nuevo descartable
      notif:
        (t.href === "/portal/events"    && (notifs?.newEvents    ?? 0) > 0 && !dismissed) ||
        (t.href === "/portal/videos"    && (notifs?.newVideos    ?? 0) > 0 && !dismissed) ||
        (t.href === "/portal/schedules" && (notifs?.newSchedules ?? 0) > 0 && !dismissed),
      // Punto naranja — pagos pendientes (persistente, no se descarta)
      warn: t.href === "/portal/payments" && (notifs?.pendingPayments ?? 0) > 0,
    })),
    { href: "/portal/live", label: "En Vivo", icon: Radio, badge: hasLive, notif: false, warn: false },
  ];

  return (
    <>
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="bg-dojo-dark border-b border-dojo-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-dojo-border overflow-hidden flex items-center justify-center text-sm font-bold text-dojo-gold shrink-0">
            {student.photo?.startsWith("http")
              ? <Image src={student.photo} alt="" width={36} height={36} className="object-cover w-full h-full" unoptimized />
              : initials
            }
          </div>
          <div>
            <p className="text-sm font-semibold text-dojo-white leading-tight">{student.fullName}</p>
            <p className="text-xs text-dojo-muted leading-tight">{student.dojo?.name ?? "Dojo Master"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {beltInfo && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: beltInfo.hex + "25", color: beltInfo.hex === "#FFFFFF" ? "#ccc" : beltInfo.hex, border: `1px solid ${beltInfo.hex}40` }}
            >
              {beltInfo.label}
            </span>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 text-dojo-muted hover:text-dojo-white transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Alerta de novedades y pagos ──────────────────────────── */}
      {showAlert && notifs && (notifs.total > 0 || notifs.pendingPayments > 0) && (
        <div className={`border-b px-4 py-2.5 flex items-start gap-3 shrink-0 ${
          notifs.pendingPayments > 0 && notifs.total === 0
            ? "bg-orange-950/40 border-orange-500/30"
            : "bg-dojo-dark border-dojo-gold/30"
        }`}>
          <Bell size={15} className={`shrink-0 mt-0.5 ${notifs.pendingPayments > 0 && notifs.total === 0 ? "text-orange-400" : "text-dojo-gold"}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold leading-tight ${notifs.pendingPayments > 0 && notifs.total === 0 ? "text-orange-300" : "text-dojo-gold"}`}>
              {notifs.total === 0
                ? `Tienes ${notifs.pendingPayments} pago${notifs.pendingPayments !== 1 ? "s" : ""} pendiente${notifs.pendingPayments !== 1 ? "s" : ""}`
                : notifs.pendingPayments > 0
                  ? "Tienes novedades y pagos pendientes"
                  : notifs.total === 1
                    ? "Hay 1 novedad nueva de tu dojo"
                    : `Hay ${notifs.total} novedades nuevas de tu dojo`
              }
            </p>
            <p className="text-[11px] text-dojo-muted mt-0.5 leading-tight">
              {[
                notifs.newEvents       > 0 && `${notifs.newEvents} evento${notifs.newEvents !== 1 ? "s" : ""} nuevo${notifs.newEvents !== 1 ? "s" : ""}`,
                notifs.newVideos       > 0 && `${notifs.newVideos} video${notifs.newVideos !== 1 ? "s" : ""} nuevo${notifs.newVideos !== 1 ? "s" : ""}`,
                notifs.newSchedules    > 0 && `${notifs.newSchedules} horario${notifs.newSchedules !== 1 ? "s" : ""} asignado${notifs.newSchedules !== 1 ? "s" : ""}`,
                notifs.pendingPayments > 0 && `${notifs.pendingPayments} pago${notifs.pendingPayments !== 1 ? "s" : ""} pendiente${notifs.pendingPayments !== 1 ? "s" : ""}`,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            onClick={dismiss}
            className="p-1 text-dojo-muted hover:text-dojo-white transition-colors shrink-0"
            title="Descartar"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Nav tabs ─────────────────────────────────────────────── */}
      <nav className="bg-dojo-dark border-b border-dojo-border shrink-0">
        <div className="flex overflow-x-auto">
          {tabs.map(t => {
            const Icon   = t.icon;
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            const hasRed = "badge" in t ? t.badge : false;
            const hasGold = "notif" in t ? t.notif : false;
            const hasWarn = "warn" in t ? (t as { warn: boolean }).warn : false;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors border-b-2 relative min-w-[52px] ${
                  active
                    ? "border-dojo-red text-dojo-red"
                    : "border-transparent text-dojo-muted hover:text-dojo-white"
                }`}
              >
                <span className="relative">
                  <Icon size={18} />
                  {/* Punto rojo — En Vivo activo */}
                  {hasRed && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                  {/* Punto dorado — contenido nuevo (eventos, videos, horarios) */}
                  {!hasRed && hasGold && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-dojo-gold animate-pulse" />
                  )}
                  {/* Punto naranja — pagos pendientes (persistente) */}
                  {!hasRed && !hasGold && hasWarn && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  )}
                </span>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
