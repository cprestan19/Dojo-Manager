"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { NAV_KEYS } from "@/lib/permissions";
import type { NavKey } from "@/lib/permissions";
import {
  Menu, X, Users, CreditCard, Award, BookOpen,
  BarChart2, Settings, LogOut, Shield, Building2, Clock,
  ClipboardList, QrCode, ChevronDown, Tag, Video, ShieldCheck,
  ChevronLeft, Home, UserPlus, Mail, LayoutDashboard,
} from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":                    "Dashboard",
  "/dashboard/students":           "Alumnos",
  "/dashboard/students/new":       "Nuevo Alumno",
  "/dashboard/payments":           "Pagos",
  "/dashboard/belts":              "Cintas o Grados",
  "/dashboard/schedules":          "Horarios",
  "/dashboard/attendance":         "Asistencia",
  "/dashboard/katas":              "Catálogo Katas",
  "/dashboard/reports":            "Reportes",
  "/dashboard/users":              "Usuarios",
  "/dashboard/dojos":              "Dojos",
  "/dashboard/settings":           "Ajustes Generales",
  "/dashboard/settings/katas":     "Creación de Katas",
  "/dashboard/settings/videos":    "Videos por Cinta",
  "/dashboard/settings/email":     "Correo / Notificaciones",
  "/dashboard/settings/roles":     "Roles y Accesos",
};

interface NavItem { href: string; label: string; icon: React.ElementType; permKey: NavKey }

const drawerItems: NavItem[] = [
  { href: "/dashboard",            label: "Dashboard",     icon: LayoutDashboard, permKey: NAV_KEYS.DASHBOARD  },
  { href: "/dashboard/students",   label: "Alumnos",    icon: Users,           permKey: NAV_KEYS.STUDENTS   },
  { href: "/dashboard/attendance", label: "Asistencia", icon: ClipboardList,   permKey: NAV_KEYS.ATTENDANCE },
  { href: "/dashboard/payments",   label: "Pagos",      icon: CreditCard,      permKey: NAV_KEYS.PAYMENTS   },
  { href: "/dashboard/belts",      label: "Cintas o Grados",     icon: Award,           permKey: NAV_KEYS.BELTS      },
  { href: "/dashboard/reports",    label: "Reportes",   icon: BarChart2,       permKey: NAV_KEYS.REPORTS    },
  { href: "/dashboard/schedules",  label: "Horarios",   icon: Clock,           permKey: NAV_KEYS.SCHEDULES  },
  { href: "/dashboard/users",      label: "Usuarios",   icon: Shield,          permKey: NAV_KEYS.USERS      },
  { href: "/dashboard/dojos",      label: "Dojos",      icon: Building2,       permKey: NAV_KEYS.DOJOS      },
];

const settingsItems: NavItem[] = [
  { href: "/dashboard/settings",        label: "General",           icon: Settings,    permKey: NAV_KEYS.SETTINGS_GENERAL },
  { href: "/dashboard/settings/katas",  label: "Creación de Katas", icon: Tag,         permKey: NAV_KEYS.SETTINGS_KATAS   },
  { href: "/dashboard/settings/videos", label: "Videos por Cinta",  icon: Video,       permKey: NAV_KEYS.SETTINGS_VIDEOS  },
  { href: "/dashboard/settings/email",  label: "Parámetros Correo", icon: Mail,        permKey: NAV_KEYS.SETTINGS_EMAIL   },
  { href: "/dashboard/settings/roles",  label: "Roles y Accesos",   icon: ShieldCheck, permKey: NAV_KEYS.SETTINGS_ROLES   },
  { href: "/dashboard/katas",           label: "Catálogo de Katas", icon: BookOpen,    permKey: NAV_KEYS.KATAS_CATALOG    },
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
  "/dashboard/katas":           "/dashboard/settings",
  "/dashboard/reports":         "/dashboard",
  "/dashboard/users":           "/dashboard",
  "/dashboard/settings":        "/dashboard",
  "/dashboard/settings/katas":  "/dashboard/settings",
  "/dashboard/settings/videos": "/dashboard/settings",
  "/dashboard/settings/email":  "/dashboard/settings",
  "/dashboard/settings/roles":  "/dashboard/settings",
  "/scanner":                   "/dashboard",
};

export function MobileNav() {
  const pathname          = usePathname();
  const router            = useRouter();
  const { data: session } = useSession();
  const perms             = usePermissions();

  const [open,         setOpen]         = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() =>
    pathname.startsWith("/dashboard/settings") || pathname === "/dashboard/katas",
  );

  const role    = (session?.user as { role?: string })?.role ?? "user";
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
    <div className="block lg:hidden">
      {/* Top bar */}
      <header className="h-14 flex items-center justify-between px-4 bg-dojo-dark border-b border-dojo-border shrink-0 gap-3">
        {backTo ? (
          <button onClick={() => router.push(backTo)} className="p-2 rounded-lg hover:bg-dojo-border transition-colors shrink-0">
            <ChevronLeft size={22} className="text-dojo-white" />
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <Image src="/logo.png" alt="Dojo Manager" width={22} height={22} className="rounded object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="font-display text-dojo-gold text-sm font-bold tracking-widest">DOJO MANAGER</span>
          </div>
        )}
        <p className="font-display text-dojo-white text-sm font-semibold truncate flex-1 text-center">{title}</p>
        <button onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-dojo-border transition-colors shrink-0">
          <Menu size={20} className="text-dojo-white" />
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
            <Image src="/logo.png" alt="" width={28} height={28} className="rounded-lg object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="font-display text-dojo-white text-sm font-bold tracking-widest">DOJO MANAGER</span>
          </div>
          <button onClick={close} className="p-2 rounded-lg hover:bg-dojo-border transition-colors">
            <X size={18} className="text-dojo-muted" />
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
              <p className="text-sm font-semibold text-dojo-white truncate">{name}</p>
              <p className="text-xs text-dojo-muted">{roleLabel}</p>
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
                  active ? "bg-dojo-red text-white" : "text-dojo-muted hover:bg-dojo-border hover:text-dojo-white",
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}

          {/* Configuración sub-grupo */}
          {visibleSettings.length > 0 && (
            <div>
              <button
                onClick={() => setSettingsOpen(o => !o)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                  pathname.startsWith("/dashboard/settings") || pathname === "/dashboard/katas"
                    ? "text-white bg-dojo-border/60"
                    : "text-dojo-muted hover:bg-dojo-border hover:text-dojo-white",
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
                          active ? "bg-dojo-red text-white font-medium" : "text-dojo-muted hover:bg-dojo-border hover:text-dojo-white",
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

        <div className="p-4 border-t border-dojo-border shrink-0">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-dojo-muted hover:bg-dojo-border hover:text-dojo-white transition-colors"
          >
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
