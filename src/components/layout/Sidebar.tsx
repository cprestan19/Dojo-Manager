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
  ChevronDown, Mail, LayoutDashboard, Video, ShieldCheck, Trophy, ScrollText,
  Crown, Lock, X, PhoneCall,
} from "lucide-react";

interface NavItem {
  href:    string;
  label:   string;
  icon:    React.ElementType;
  permKey: NavKey;
}

const navItems: NavItem[] = [
  { href: "/dashboard",                 label: "Dashboard",       icon: LayoutDashboard, permKey: NAV_KEYS.DASHBOARD      },
  { href: "/dashboard/students",        label: "Alumnos",         icon: Users,           permKey: NAV_KEYS.STUDENTS       },
  { href: "/dashboard/attendance",      label: "Asistencia",      icon: ClipboardList,   permKey: NAV_KEYS.ATTENDANCE     },
  { href: "/dashboard/payments",        label: "Pagos",           icon: CreditCard,      permKey: NAV_KEYS.PAYMENTS       },
  { href: "/dashboard/belts",           label: "Cintas o Grados", icon: Award,           permKey: NAV_KEYS.BELTS          },
  { href: "/dashboard/tournaments",     label: "Torneos",         icon: Trophy,          permKey: NAV_KEYS.TOURNAMENTS    },
  { href: "/dashboard/settings/katas",  label: "Katas",           icon: BookOpen,        permKey: NAV_KEYS.SETTINGS_KATAS },
  { href: "/dashboard/reports",         label: "Reportes",        icon: BarChart2,       permKey: NAV_KEYS.REPORTS        },
  { href: "/dashboard/users",           label: "Usuarios",        icon: Shield,          permKey: NAV_KEYS.USERS          },
  { href: "/dashboard/dojos",           label: "Dojos",           icon: Building2,       permKey: NAV_KEYS.DOJOS          },
  { href: "/dashboard/audit-log",      label: "Audit Log",       icon: ScrollText,      permKey: NAV_KEYS.AUDIT_LOG      },
];

const settingsSubItems: NavItem[] = [
  { href: "/dashboard/settings",        label: "General",              icon: Settings,    permKey: NAV_KEYS.SETTINGS_GENERAL },
  { href: "/dashboard/settings/videos", label: "Videos de Katas",      icon: Video,       permKey: NAV_KEYS.SETTINGS_VIDEOS  },
  { href: "/dashboard/settings/email",  label: "Correo / Notificaciones", icon: Mail,     permKey: NAV_KEYS.SETTINGS_EMAIL   },
  { href: "/dashboard/settings/roles",  label: "Roles y Accesos",      icon: ShieldCheck, permKey: NAV_KEYS.SETTINGS_ROLES   },
];

export function Sidebar() {
  const pathname          = usePathname();
  const { data: session } = useSession();
  const role  = (session?.user as { role?: string })?.role ?? "user";
  const dojo  = useDojo();
  const perms = usePermissions();

  const inSettings = pathname.startsWith("/dashboard/settings") && !pathname.startsWith("/dashboard/settings/katas");
  const [settingsOpen,   setSettingsOpen]   = useState(() => inSettings);
  const [showProPopup,   setShowProPopup]   = useState(false);
  const isSysadmin = role === "sysadmin";

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
            <p className="font-display text-dojo-sidebar-text font-bold text-sm tracking-wide leading-tight truncate">
              {dojo?.name ?? (role === "sysadmin" ? "Sistema Global" : "Cargando...")}
            </p>
            <p className="font-display text-dojo-gold text-[10px] tracking-widest leading-tight mt-0.5">
              DOJO MASTER
            </p>
          </div>
        </div>
        {dojo?.slogan && (
          <p className="text-dojo-sidebar-muted text-[10px] italic mt-2 truncate">{dojo.slogan}</p>
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
                  ? "bg-dojo-red text-white"
                  : "text-dojo-sidebar-muted hover:bg-dojo-border/60 hover:text-dojo-sidebar-text",
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}

        {/* Torneo Pro — visible para todos, funcional solo para sysadmin */}
        {(isSysadmin || role === "admin") && (
          isSysadmin ? (
            <Link
              href="/dashboard/tournaments"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium relative",
                pathname.startsWith("/dashboard/tournaments-pro")
                  ? "bg-dojo-red text-white"
                  : "text-dojo-gold hover:bg-dojo-gold/10 hover:text-dojo-gold",
              )}
            >
              <Crown size={18} />
              <span className="flex-1">Torneo Pro</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-dojo-gold text-black tracking-wider">PRO</span>
            </Link>
          ) : (
            <button
              onClick={() => setShowProPopup(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium
                         text-dojo-muted/60 hover:bg-dojo-border/40 cursor-pointer group"
            >
              <div className="relative">
                <Crown size={18} />
                <Lock size={9} className="absolute -bottom-0.5 -right-1 text-dojo-muted/50" />
              </div>
              <span className="flex-1 text-left">Torneo Pro</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-dojo-border text-dojo-muted/60 tracking-wider">PRO</span>
            </button>
          )
        )}

        {/* Modal popup Torneo Pro */}
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
                  <X size={18} />
                </button>
              </div>

              <p className="text-sm text-dojo-sidebar-muted leading-relaxed">
                El módulo <span className="text-dojo-sidebar-text font-semibold">Torneo Pro</span> incluye funcionalidades de nivel federativo:
              </p>
              <ul className="space-y-1.5">
                {[
                  "🎌 Tatamis con asignación de jueces",
                  "📋 Programa oficial del torneo",
                  "🔴 Transmisión en vivo por YouTube",
                  "📺 Overlay para OBS/Streamlabs",
                  "🌐 Página pública para espectadores",
                  "📝 Inscripciones de competidores externos",
                  "🔒 Bloqueo oficial de llaves post-inscripción",
                ].map(f => (
                  <li key={f} className="text-xs text-dojo-sidebar-muted flex items-start gap-2">
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="bg-dojo-gold/10 border border-dojo-gold/20 rounded-xl p-3">
                <p className="text-xs text-dojo-gold font-semibold flex items-center gap-2">
                  <PhoneCall size={13} /> Para activar este módulo:
                </p>
                <p className="text-xs text-dojo-sidebar-muted mt-1">
                  Contacta al equipo de ventas de <span className="text-dojo-sidebar-text font-semibold">Dojo Master</span> para solicitar la activación en tu cuenta.
                </p>
              </div>

              <button
                onClick={() => setShowProPopup(false)}
                className="btn-secondary w-full text-sm"
              >
                Entendido
              </button>
            </div>
          </div>
        )}

        {/* Configuración — grupo expandible */}
        {visibleSettings.length > 0 && (
          <div>
            <button
              onClick={() => setSettingsOpen(o => !o)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium",
                inSettings
                  ? "bg-dojo-red text-white"
                  : "text-dojo-sidebar-muted hover:bg-dojo-border/60 hover:text-dojo-sidebar-text",
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
                          ? "bg-dojo-red text-white font-medium"
                          : "text-dojo-sidebar-muted hover:bg-dojo-border/60 hover:text-dojo-sidebar-text",
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
            <p className="text-xs font-semibold text-dojo-sidebar-text truncate">{session?.user?.name}</p>
            <p className="text-xs text-dojo-sidebar-muted capitalize">{roleLabel}</p>
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
