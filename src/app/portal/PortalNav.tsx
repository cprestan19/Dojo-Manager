"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import {
  User, CreditCard, Clock, ClipboardList, LogOut, Video,
  Calendar, Radio, X, Bell, FileText, Award, MoreHorizontal, ChevronRight,
} from "lucide-react";
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
  pendingExams:    number;
  events:     { id: string; title: string; startDate: string }[];
  videos:     { id: string; title: string; beltColor: string }[];
}

const BOTTOM_TABS = [
  { href: "/portal",           label: "Inicio",   icon: User       },
  { href: "/portal/payments",  label: "Pagos",    icon: CreditCard },
  { href: "/portal/schedules", label: "Horarios", icon: Clock      },
  { href: "/portal/events",    label: "Eventos",  icon: Calendar   },
];

const MORE_ITEMS = [
  { href: "/portal/attendance",    label: "Asistencia", icon: ClipboardList },
  { href: "/portal/videos",        label: "Videos",     icon: Video         },
  { href: "/portal/postulaciones", label: "Exámenes",   icon: FileText      },
  { href: "/portal/certificados",  label: "Diplomas",   icon: Award         },
  { href: "/portal/live",          label: "En Vivo",    icon: Radio         },
];

const STORAGE_KEY = "portal_notif_seen_at";

export default function PortalNav({ student }: Props) {
  const pathname = usePathname();
  const belt     = student.beltHistory[0]?.beltColor;
  const beltInfo = belt ? getBeltInfo(belt) : null;
  const initials = student.fullName.split(" ").slice(0, 2).map(w => w[0]).join("");

  const [hasLive,   setHasLive]   = useState(false);
  const [notifs,    setNotifs]    = useState<PortalNotifications | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Drawer state — 3 niveles: intención (drawerOpen), DOM (drawerMounted), animación (drawerVisible)
  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // ── Live tatamis ──────────────────────────────────────────────────
  useEffect(() => {
    const check = () =>
      fetch("/api/portal/live-tatamis")
        .then(r => r.ok ? r.json() : { tatamis: [] })
        .then(d => setHasLive((d.tatamis?.length ?? 0) > 0))
        .catch(() => null);
    check();
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, []);

  // ── Notificaciones del portal ─────────────────────────────────────
  const checkNotifications = useCallback(() => {
    const since = localStorage.getItem(STORAGE_KEY)
      ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    fetch(`/api/portal/notifications?since=${encodeURIComponent(since)}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: PortalNotifications | null) => {
        if (data) {
          setNotifs(data);
          if (data.total > 0 || data.pendingPayments > 0) setShowAlert(true);
        }
      })
      .catch(() => null);
  }, []);

  useEffect(() => { checkNotifications(); }, [checkNotifications]);

  // Sincronizar DOM del drawer con la intención de apertura
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (drawerOpen) {
      setDrawerMounted(true);
      t = setTimeout(() => setDrawerVisible(true), 10);
    } else {
      setDrawerVisible(false);
      t = setTimeout(() => setDrawerMounted(false), 300);
    }
    return () => clearTimeout(t);
  }, [drawerOpen]);

  // Cerrar drawer y marcar visto al navegar
  useEffect(() => {
    setDrawerOpen(false);
    if (
      pathname === "/portal/events"   ||
      pathname === "/portal/videos"   ||
      pathname === "/portal/schedules"
    ) {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setShowAlert(false);
    }
  }, [pathname]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setShowAlert(false);
    setDismissed(true);
  }

  const moreHasNotif =
    (!dismissed && (notifs?.newVideos    ?? 0) > 0) ||
    (notifs?.pendingExams ?? 0) > 0 ||
    hasLive;

  const moreIsActive = MORE_ITEMS.some(
    i => pathname === i.href || pathname.startsWith(i.href + "/"),
  );

  const showMoreActive = drawerOpen || moreIsActive;

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
              style={{
                backgroundColor: beltInfo.hex + "25",
                color:           beltInfo.hex === "#FFFFFF" ? "#ccc" : beltInfo.hex,
                border:          `1px solid ${beltInfo.hex}40`,
              }}
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

      {/* ── Banner de novedades / pagos pendientes ───────────────── */}
      {showAlert && notifs && (notifs.total > 0 || notifs.pendingPayments > 0) && (
        <div className={`border-b px-4 py-2.5 flex items-start gap-3 shrink-0 ${
          notifs.pendingPayments > 0 && notifs.total === 0
            ? "bg-orange-950/40 border-orange-500/30"
            : "bg-dojo-dark border-dojo-gold/30"
        }`}>
          <Bell size={15} className={`shrink-0 mt-0.5 ${
            notifs.pendingPayments > 0 && notifs.total === 0 ? "text-orange-400" : "text-dojo-gold"
          }`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold leading-tight ${
              notifs.pendingPayments > 0 && notifs.total === 0 ? "text-orange-300" : "text-dojo-gold"
            }`}>
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
          <button onClick={dismiss} className="p-1 text-dojo-muted hover:text-dojo-white shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Overlay — solo existe en DOM cuando drawer está montado ── */}
      {drawerMounted && (
        <div
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
            drawerVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />
      )}

      {/* ── Drawer "Más" — solo en DOM cuando drawer está montado ── */}
      {drawerMounted && (
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-dojo-dark border-t border-dojo-border rounded-t-2xl transition-transform duration-300 ease-out ${
          drawerVisible ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
      >
        <div className="w-10 h-1 bg-dojo-border rounded-full mx-auto mt-3 mb-1" />
        <div className="max-w-2xl mx-auto px-2 pb-24">
          {MORE_ITEMS.map(item => {
            const Icon      = item.icon;
            const active    = pathname === item.href || pathname.startsWith(item.href + "/");
            const isLive    = item.href === "/portal/live";
            const redDot    = isLive && hasLive;
            const goldDot   = item.href === "/portal/videos"        && (notifs?.newVideos    ?? 0) > 0 && !dismissed;
            const orangeDot = item.href === "/portal/postulaciones" && (notifs?.pendingExams ?? 0) > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors ${
                  active
                    ? "bg-dojo-red/10 text-dojo-red"
                    : "text-dojo-muted hover:bg-dojo-darker hover:text-dojo-white"
                }`}
              >
                <span className="relative shrink-0">
                  <Icon size={20} />
                  {redDot    && <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                  {!redDot && goldDot    && <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-dojo-gold animate-pulse" />}
                  {!redDot && !goldDot && orangeDot && <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-orange-500 animate-pulse" />}
                </span>
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {isLive && hasLive && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold tracking-wide">
                    EN VIVO
                  </span>
                )}
                <ChevronRight size={14} className="opacity-30 shrink-0" />
              </Link>
            );
          })}
        </div>
      </div>
      )}

      {/* ── Bottom navigation fija ───────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-dojo-dark border-t border-dojo-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex max-w-2xl mx-auto">
          {BOTTOM_TABS.map(tab => {
            const Icon   = tab.icon;
            const active = tab.href === "/portal"
              ? pathname === "/portal"
              : pathname === tab.href || pathname.startsWith(tab.href + "/");
            const orangeDot = tab.href === "/portal/payments" && (notifs?.pendingPayments ?? 0) > 0;
            const goldDot   =
              (tab.href === "/portal/events"    && (notifs?.newEvents    ?? 0) > 0 && !dismissed) ||
              (tab.href === "/portal/schedules" && (notifs?.newSchedules ?? 0) > 0 && !dismissed);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 text-[11px] font-medium transition-colors ${
                  active ? "text-dojo-red" : "text-dojo-muted"
                }`}
              >
                <span className="relative">
                  <Icon size={21} />
                  {orangeDot && <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-orange-500 animate-pulse" />}
                  {!orangeDot && goldDot && <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-dojo-gold animate-pulse" />}
                </span>
                {tab.label}
              </Link>
            );
          })}

          {/* Botón Más */}
          <button
            type="button"
            onClick={() => setDrawerOpen(prev => !prev)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 text-[11px] font-medium transition-colors ${
              showMoreActive ? "text-dojo-red" : "text-dojo-muted"
            }`}
          >
            <span className="relative">
              <MoreHorizontal size={21} />
              {moreHasNotif && !drawerOpen && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-dojo-gold animate-pulse" />
              )}
            </span>
            Más
          </button>
        </div>
      </nav>
    </>
  );
}
