"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useDojo } from "@/lib/hooks/useDojo";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { NAV_KEYS } from "@/lib/permissions";
import type { NavKey } from "@/lib/permissions";
import {
  Users, CreditCard, Award, BookOpen,
  BarChart2, Settings, LogOut, Shield, Building2, ClipboardList, ExternalLink,
  ChevronDown, Tag, Mail, LayoutDashboard, Video, ShieldCheck,
} from "lucide-react";

interface NavItem {
  href:    string;
  label:   string;
  icon:    React.ElementType;
  permKey: NavKey;
}

const navItems: NavItem[] = [
  { href: "/dashboard",            label: "Dashboard",     icon: LayoutDashboard, permKey: NAV_KEYS.DASHBOARD  },
  { href: "/dashboard/students",   label: "Alumnos",    icon: Users,           permKey: NAV_KEYS.STUDENTS   },
  { href: "/dashboard/attendance", label: "Asistencia", icon: ClipboardList,   permKey: NAV_KEYS.ATTENDANCE },
  { href: "/dashboard/payments",   label: "Pagos",      icon: CreditCard,      permKey: NAV_KEYS.PAYMENTS   },
  { href: "/dashboard/belts",      label: "Cintas o Grados",     icon: Award,           permKey: NAV_KEYS.BELTS      },
  { href: "/dashboard/reports",    label: "Reportes",   icon: BarChart2,       permKey: NAV_KEYS.REPORTS    },
  { href: "/dashboard/users",      label: "Usuarios",   icon: Shield,          permKey: NAV_KEYS.USERS      },
  { href: "/dashboard/dojos",      label: "Dojos",      icon: Building2,       permKey: NAV_KEYS.DOJOS      },
];

const settingsSubItems: NavItem[] = [
  { href: "/dashboard/settings",        label: "General",           icon: Settings,    permKey: NAV_KEYS.SETTINGS_GENERAL },
  { href: "/dashboard/settings/katas",  label: "Katas",             icon: Tag,         permKey: NAV_KEYS.SETTINGS_KATAS   },
  { href: "/dashboard/settings/videos", label: "Videos de Katas",   icon: Video,       permKey: NAV_KEYS.SETTINGS_VIDEOS  },
  { href: "/dashboard/settings/email",  label: "Correo / Notificaciones", icon: Mail,        permKey: NAV_KEYS.SETTINGS_EMAIL   },
  { href: "/dashboard/settings/roles",  label: "Roles y Accesos",   icon: ShieldCheck, permKey: NAV_KEYS.SETTINGS_ROLES   },
  { href: "/dashboard/katas",           label: "Catálogo de Katas", icon: BookOpen,    permKey: NAV_KEYS.KATAS_CATALOG    },
];

const SETTINGS_PATHS = ["/dashboard/settings", "/dashboard/katas"];

export function Sidebar() {
  const pathname          = usePathname();
  const { data: session } = useSession();
  const role  = (session?.user as { role?: string })?.role ?? "user";
  const dojo  = useDojo();
  const perms = usePermissions();

  const inSettings = SETTINGS_PATHS.some(p => pathname.startsWith(p));
  const [settingsOpen, setSettingsOpen] = useState(() => inSettings);

  const visible         = navItems.filter(i => perms.has(i.permKey));
  const visibleSettings = settingsSubItems.filter(i => perms.has(i.permKey));

  const roleLabel =
    role === "sysadmin" ? "Super Admin" :
    role === "admin"    ? "Administrador" :
    role === "user"     ? "Usuario" :
    role;

  return (
    <aside className="w-64 min-h-screen bg-dojo-dark border-r border-dojo-border flex flex-col">
      {/* App branding — dojo logo when available, app logo as fallback */}
      <div className="px-4 py-4 border-b border-dojo-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-dojo-red flex items-center justify-center shadow shadow-dojo-red/30">
            <Image
              src={dojo?.logo && dojo.logo.startsWith("http") ? dojo.logo : "/logo.png"}
              alt={dojo?.name ?? "Dojo Master"}
              width={40}
              height={40}
              className="w-full h-full object-contain"
              priority
              unoptimized
              onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
            />
          </div>
          <div className="min-w-0">
            <p className="font-display text-dojo-white font-bold text-sm tracking-wide leading-tight truncate">
              {dojo?.name ?? (role === "sysadmin" ? "Sistema Global" : "Cargando...")}
            </p>
            <p className="font-display text-dojo-gold text-[10px] tracking-widest leading-tight mt-0.5">
              DOJO MASTER
            </p>
          </div>
        </div>
        {dojo?.slogan && (
          <p className="text-dojo-muted text-[10px] italic mt-2 truncate">{dojo.slogan}</p>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visible.map(item => {
          const Icon   = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium",
                active
                  ? "bg-[#1e3a5c] text-white"
                  : "text-dojo-muted hover:bg-dojo-border hover:text-dojo-white",
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}

        {/* Configuración — grupo expandible */}
        {visibleSettings.length > 0 && (
          <div>
            <button
              onClick={() => setSettingsOpen(o => !o)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium",
                inSettings
                  ? "text-white bg-dojo-border/60"
                  : "text-dojo-muted hover:bg-dojo-border hover:text-dojo-white",
              )}
            >
              <Settings size={18} />
              <span className="flex-1 text-left">Configuración</span>
              <ChevronDown
                size={14}
                className={cn("transition-transform duration-200", settingsOpen && "rotate-180")}
              />
            </button>

            {settingsOpen && (
              <div className="mt-1 ml-4 pl-3 border-l border-dojo-border space-y-1">
                {visibleSettings.map(sub => {
                  const Icon   = sub.icon;
                  const active = pathname === sub.href || (sub.href !== "/dashboard/settings" && pathname.startsWith(sub.href));
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                        active
                          ? "bg-[#1e3a5c] text-white font-medium"
                          : "text-dojo-muted hover:bg-dojo-border hover:text-dojo-white",
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

      {/* Scanner QR — solo admin/sysadmin */}
      {(role === "sysadmin" || role === "admin") && (
        <div className="px-4 pb-3">
          <a
            href="/scanner"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-dojo-red/40 text-dojo-red text-sm font-medium hover:bg-dojo-red/10 transition-colors duration-200"
          >
            <ExternalLink size={16} />
            Scanner QR
          </a>
        </div>
      )}

      {/* Info del usuario */}
      <div className="p-4 border-t border-dojo-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-dojo-border flex items-center justify-center text-xs font-bold text-dojo-gold flex-shrink-0">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="w-full h-full object-cover" />
            ) : (
              session?.user?.name?.[0]?.toUpperCase() ?? "?"
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-dojo-white truncate">{session?.user?.name}</p>
            <p className="text-xs text-dojo-muted capitalize">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full btn-ghost text-sm justify-start"
        >
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
