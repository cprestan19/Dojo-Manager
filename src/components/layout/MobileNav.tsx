"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useDojo } from "@/lib/hooks/useDojo";
import { NAV_KEYS } from "@/lib/permissions";
import type { NavKey } from "@/lib/permissions";
import {
  Menu, X, Users, CreditCard, Award, BookOpen,
  BarChart2, Settings, LogOut, Shield, Building2,
  ClipboardList, QrCode, ChevronDown, Video, ShieldCheck,
  ChevronLeft, Home, Mail, LayoutDashboard, Trophy, ScrollText,
  Crown, Lock, PhoneCall, Calendar,
} from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":                    "Dashboard",
  "/dashboard/students":           "Alumnos",
  "/dashboard/students/new":       "Nuevo Alumno",
  "/dashboard/payments":           "Pagos",
  "/dashboard/belts":              "Cintas o Grados",
  "/dashboard/schedules":          "Horarios",
  "/dashboard/attendance":         "Asistencia",
  "/dashboard/settings/katas":     "Katas",
  "/dashboard/reports":            "Reportes",
  "/dashboard/users":              "Usuarios",
  "/dashboard/dojos":              "Dojos",
  "/dashboard/settings":           "Ajustes Generales",
  "/dashboard/settings/videos":    "Videos por Cinta",
  "/dashboard/settings/email":     "Correo / Notificaciones",
  "/dashboard/settings/roles":     "Roles y Accesos",
  "/dashboard/tournaments":        "Torneos",
  "/dashboard/tournaments/new":    "Nuevo Torneo",
};

interface NavItem { href: string; label: string; icon: React.ElementType; permKey: NavKey }

const drawerItems: NavItem[] = [
  { href: "/dashboard",                label: "Dashboard",       icon: LayoutDashboard, permKey: NAV_KEYS.DASHBOARD      },
  { href: "/dashboard/students",       label: "Alumnos",         icon: Users,           permKey: NAV_KEYS.STUDENTS       },
  { href: "/dashboard/attendance",     label: "Asistencia",      icon: ClipboardList,   permKey: NAV_KEYS.ATTENDANCE     },
  { href: "/dashboard/payments",       label: "Pagos",           icon: CreditCard,      permKey: NAV_KEYS.PAYMENTS       },
  { href: "/dashboard/belts",          label: "Cintas o Grados", icon: Award,           permKey: NAV_KEYS.BELTS          },
  { href: "/dashboard/tournaments",    label: "Torneos",         icon: Trophy,          permKey: NAV_KEYS.TOURNAMENTS    },
  { href: "/dashboard/settings/katas", label: "Katas",           icon: BookOpen,        permKey: NAV_KEYS.SETTINGS_KATAS },
  { href: "/dashboard/events",         label: "Eventos",         icon: Calendar,        permKey: NAV_KEYS.EVENTS         },
  { href: "/dashboard/reports",        label: "Reportes",        icon: BarChart2,       permKey: NAV_KEYS.REPORTS        },
  { href: "/dashboard/users",          label: "Usuarios",        icon: Shield,          permKey: NAV_KEYS.USERS          },
  { href: "/dashboard/dojos",          label: "Dojos",           icon: Building2,       permKey: NAV_KEYS.DOJOS          },
  { href: "/dashboard/audit-log",     label: "Audit Log",       icon: ScrollText,      permKey: NAV_KEYS.AUDIT_LOG      },
];

const settingsItems: NavItem[] = [
  { href: "/dashboard/settings",        label: "General",              icon: Settings,    permKey: NAV_KEYS.SETTINGS_GENERAL },
  { href: "/dashboard/settings/videos", label: "Videos por Cinta",     icon: Video,       permKey: NAV_KEYS.SETTINGS_VIDEOS  },
  { href: "/dashboard/settings/email",  label: "Parámetros Correo",    icon: Mail,        permKey: NAV_KEYS.SETTINGS_EMAIL   },
  { href: "/dashboard/settings/roles",  label: "Roles y Accesos",      icon: ShieldCheck, permKey: NAV_KEYS.SETTINGS_ROLES   },
];

// Quick-access items shown at the bottom bar (max 5, most used)
const quickItems: NavItem[] = [
  { href: "/dashboard",              label: "Inicio",       icon: Home,        permKey: NAV_KEYS.DASHBOARD },
  { href: "/dashboard/students",     label: "Alumnos",      icon: Users,       permKey: NAV_KEYS.STUDENTS  },
  { href: "/dashboard/payments",     label: "Pagos",        icon: CreditCard,  permKey: NAV_KEYS.PAYMENTS  },
  { href: "/dashboard/attendance",   label: "Asistencia",   icon: ClipboardList, permKey: NAV_KEYS.ATTENDANCE },
  { href: "/dashboard/belts",        label: "Rangos",       icon: Award,       permKey: NAV_KEYS.BELTS     },
];

const backRoutes: Record<string, string> = {
  "/dashboard/students":        "/dashboard",
  "/dashboard/payments":        "/dashboard",
  "/dashboard/schedules":       "/dashboard",
  "/dashboard/attendance":      "/dashboard",
  "/dashboard/belts":           "/dashboard",
  "/dashboard/settings/katas":  "/dashboard",
  "/dashboard/reports":         "/dashboard",
  "/dashboard/users":           "/dashboard",
  "/dashboard/settings":        "/dashboard",
  "/dashboard/settings/videos": "/dashboard/settings",
  "/dashboard/settings/email":  "/dashboard/settings",
  "/dashboard/settings/roles":  "/dashboard/settings",
  "/scanner":                   "/dashboard",
  "/dashboard/tournaments":     "/dashboard",
  "/dashboard/tournaments/new": "/dashboard/tournaments",
};

export function MobileNav() {
  const pathname          = usePathname();
  const router            = useRouter();
  const { data: session } = useSession();
  const perms             = usePermissions();
  const dojo              = useDojo();

  const [open,         setOpen]         = useState(false);
  const [showProPopup, setShowProPopup] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() =>
    pathname.startsWith("/dashboard/settings") && !pathname.startsWith("/dashboard/settings/katas"),
  );

  const role       = (session?.user as { role?: string })?.role ?? "user";
  const isSysadmin = role === "sysadmin";
  const name    = session?.user?.name ?? "";
  const photo   = session?.user?.image ?? null;
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const roleLabel =
    role === "sysadmin" ? "Super Admin" :
    role === "admin"    ? "Administrador" :
    role === "user"     ? "Usuario" : role;

  const visibleDrawer   = drawerItems.filter(i => perms.has(i.permKey));
  const visibleSettings = settingsItems.filter(i => perms.has(i.permKey));
  const visibleQuick    = quickItems.filter(i => perms.has(i.permKey)).slice(0, 5);

  function getBackTo(): string | null {
    if (pathname === "/dashboard") return null;
    if (backRoutes[pathname]) return backRoutes[pathname];
    if (pathname.startsWith("/dashboard/students/")) {
      const parts = pathname.split("/");
      if (parts.length === 4) return "/dashboard/students";
      if (parts.length === 5) return `/dashboard/students/${parts[3]}`;
    }
    return null;
  }

  const backTo = getBackTo();
  const title  = Object.entries(PAGE_TITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([p]) => pathname === p || pathname.startsWith(p + "/"))?.[1] ?? "Dashboard";

  function close() { setOpen(false); }

  return (
    <>
    <div className="block lg:hidden">
      {/* Top bar */}
      <header className="h-14 flex items-center justify-between px-4 bg-dojo-dark border-b border-dojo-border shrink-0 gap-3">
        {backTo ? (
          <button onClick={() => router.push(backTo)} className="p-2 rounded-lg hover:bg-dojo-border transition-colors shrink-0">
            <ChevronLeft size={22} className="text-dojo-sidebar-text" />
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <Image
              src={dojo?.logo && dojo.logo.startsWith("http") ? dojo.logo : "/logo.png"}
              alt={dojo?.name ?? "Dojo Master"} width={22} height={22}
              className="rounded object-contain" unoptimized
              onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }} />
            <span className="font-display text-dojo-gold text-sm font-bold tracking-widest">DOJO MASTER</span>
          </div>
        )}
        <p className="font-display text-dojo-sidebar-text text-sm font-semibold truncate flex-1 text-center">{title}</p>
        <button onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-dojo-border transition-colors shrink-0">
          <Menu size={20} className="text-dojo-sidebar-text" />
        </button>
      </header>

      {/* Backdrop */}
      {open && <div className="fixed inset-0 bg-black/60 z-40" onClick={close} />}

      {/* Drawer */}
      <div className={cn(
        "fixed top-0 right-0 h-full w-[280px] bg-dojo-dark border-l border-dojo-border z-50 flex flex-col",
        "transition-transform duration-300",
        open ? "translate-x-0" : "translate-x-full",
      )}>
        <div className="flex items-center justify-between px-4 h-14 border-b border-dojo-border shrink-0">
          <div className="flex items-center gap-2">
            <Image
              src={dojo?.logo && dojo.logo.startsWith("http") ? dojo.logo : "/logo.png"}
              alt={dojo?.name ?? "Dojo Master"} width={28} height={28}
              className="rounded-lg object-contain" unoptimized
              onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }} />
            <span className="font-display text-dojo-sidebar-text text-sm font-bold tracking-widest">DOJO MASTER</span>
          </div>
          <button onClick={close} className="p-2 rounded-lg hover:bg-dojo-border transition-colors">
            <X size={18} className="text-dojo-sidebar-muted" />
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-dojo-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-dojo-border flex items-center justify-center text-xs font-bold text-dojo-gold flex-shrink-0">
              {photo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={photo} alt="" className="w-full h-full object-cover" />
                : initials || "?"
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-dojo-sidebar-text truncate">{name}</p>
              <p className="text-xs text-dojo-sidebar-muted">{roleLabel}</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {visibleDrawer.map(item => {
            const Icon   = item.icon;
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={close}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                  active ? "bg-dojo-nav-active text-white" : "text-dojo-sidebar-muted hover:bg-dojo-border/60 hover:text-dojo-sidebar-text",
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}

          {/* Torneo Pro */}
          {(isSysadmin || role === "admin") && (
            isSysadmin ? (
              <Link href="/dashboard/tournaments" onClick={close}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-dojo-gold hover:bg-dojo-gold/10 transition-colors">
                <Crown size={18} />
                <span className="flex-1">Torneo Pro</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-dojo-gold text-black">PRO</span>
              </Link>
            ) : (
              <button onClick={() => setShowProPopup(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-dojo-muted/60 hover:bg-dojo-border/40 transition-colors">
                <div className="relative">
                  <Crown size={18} />
                  <Lock size={9} className="absolute -bottom-0.5 -right-1 text-dojo-muted/50" />
                </div>
                <span className="flex-1 text-left">Torneo Pro</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-dojo-border text-dojo-muted/60">PRO</span>
              </button>
            )
          )}

          {/* Configuración sub-grupo */}
          {visibleSettings.length > 0 && (
            <div>
              <button
                onClick={() => setSettingsOpen(o => !o)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                  pathname.startsWith("/dashboard/settings") && !pathname.startsWith("/dashboard/settings/katas")
                    ? "bg-dojo-nav-active text-white"
                    : "text-dojo-sidebar-muted hover:bg-dojo-border/60 hover:text-dojo-sidebar-text",
                )}
              >
                <Settings size={18} />
                <span className="flex-1 text-left">Configuración</span>
                <ChevronDown size={14} className={cn("transition-transform duration-200", settingsOpen && "rotate-180")} />
              </button>
              {settingsOpen && (
                <div className="mt-1 ml-4 pl-3 border-l border-dojo-border space-y-1">
                  {visibleSettings.map(sub => {
                    const Icon   = sub.icon;
                    const active = pathname === sub.href || pathname.startsWith(sub.href + "/");
                    return (
                      <Link key={sub.href} href={sub.href} onClick={close}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-sm",
                          active ? "bg-dojo-nav-active text-white font-medium" : "text-dojo-sidebar-muted hover:bg-dojo-border/60 hover:text-dojo-sidebar-text",
                        )}
                      >
                        <Icon size={15} />
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Scanner QR — solo admin / sysadmin */}
        {(role === "sysadmin" || role === "admin") && (
          <div className="px-4 pb-2">
            <a
              href="/scanner"
              onClick={close}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-dojo-red/40 text-dojo-red text-sm font-medium hover:bg-dojo-red/10 transition-colors"
            >
              <QrCode size={18} />
              Abrir Scanner QR
            </a>
          </div>
        )}

        <div className="p-4 border-t border-dojo-border shrink-0">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-dojo-sidebar-muted hover:bg-dojo-border/60 hover:text-dojo-sidebar-text transition-colors"
          >
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </div>
    </div>

    {/* Popup Torneo Pro */}
    {showProPopup && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-dojo-dark border border-dojo-gold/30 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-dojo-gold/10 flex items-center justify-center">
                <Crown size={22} className="text-dojo-gold" />
              </div>
              <div>
                <p className="font-display font-bold text-dojo-sidebar-text text-lg">Torneo Pro</p>
                <p className="text-[10px] text-dojo-gold font-bold uppercase tracking-widest">Módulo Premium</p>
              </div>
            </div>
            <button onClick={() => setShowProPopup(false)} className="text-dojo-sidebar-muted hover:text-dojo-sidebar-text transition-colors">
              <span className="text-lg leading-none">✕</span>
            </button>
          </div>
          <p className="text-sm text-dojo-sidebar-muted leading-relaxed">
            El módulo <span className="text-dojo-sidebar-text font-semibold">Torneo Pro</span> incluye funcionalidades de nivel federativo:
          </p>
          <ul className="space-y-1.5">
            {["🎌 Tatamis con asignación de jueces","📋 Programa oficial","🔴 Transmisión en vivo YouTube","📺 Overlay para OBS","🌐 Página pública para espectadores","📝 Inscripciones externas","🔒 Bloqueo oficial de llaves"].map(f => (
              <li key={f} className="text-xs text-dojo-muted">{f}</li>
            ))}
          </ul>
          <div className="bg-dojo-gold/10 border border-dojo-gold/20 rounded-xl p-3">
            <p className="text-xs text-dojo-gold font-semibold flex items-center gap-2">
              <PhoneCall size={13} /> Para activar este módulo:
            </p>
            <p className="text-xs text-dojo-muted mt-1">
              Contacta al equipo de ventas de <span className="text-dojo-sidebar-text font-semibold">Dojo Master</span> para solicitar la activación.
            </p>
          </div>
          <button onClick={() => setShowProPopup(false)} className="btn-secondary w-full text-sm">
            Entendido
          </button>
        </div>
      </div>
    )}
    </>
  );
}
