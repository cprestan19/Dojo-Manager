/**
 * Componente: Sidebar de navegación
 * Desarrollado por Cristhian Paul Prestán — 2025
 */
"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useDojo } from "@/lib/hooks/useDojo";
import {
  Users, CreditCard, Award, BookOpen,
  BarChart2, Settings, LogOut, Shield, Building2, Clock, ClipboardList, ExternalLink,
  ChevronDown, Tag, Mail, LayoutDashboard,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",            label: "Inicio",         icon: LayoutDashboard, roles: ["sysadmin","admin","user"] },
  { href: "/dashboard/students",   label: "Alumnos",        icon: Users,         roles: ["sysadmin","admin","user"] },
  { href: "/dashboard/attendance", label: "Asistencia",     icon: ClipboardList, roles: ["sysadmin","admin","user"] },
  { href: "/dashboard/schedules",  label: "Horarios",       icon: Clock,         roles: ["sysadmin","admin"] },
  { href: "/dashboard/payments",   label: "Pagos",          icon: CreditCard,    roles: ["sysadmin","admin"] },
  { href: "/dashboard/belts",      label: "Rangos",         icon: Award,         roles: ["sysadmin","admin","user"] },
  { href: "/dashboard/reports",    label: "Reportes",       icon: BarChart2,     roles: ["sysadmin","admin"] },
  { href: "/dashboard/users",      label: "Usuarios",       icon: Shield,        roles: ["sysadmin","admin"] },
  { href: "/dashboard/dojos",      label: "Dojos",          icon: Building2,     roles: ["sysadmin"] },
];

const settingsSubItems = [
  { href: "/dashboard/settings",        label: "General",              icon: Settings, roles: ["sysadmin","admin"] },
  { href: "/dashboard/settings/katas",  label: "Creación de Katas",    icon: Tag,      roles: ["sysadmin","admin"] },
  { href: "/dashboard/settings/email",  label: "Parámetros de Correo", icon: Mail,     roles: ["sysadmin","admin"] },
  { href: "/dashboard/katas",           label: "Catálogo de Katas",    icon: BookOpen, roles: ["sysadmin","admin","user"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role  = (session?.user as { role?: string })?.role ?? "user";
  const dojo  = useDojo();

  const [settingsOpen, setSettingsOpen] = useState(() =>
    pathname.startsWith("/dashboard/settings") || pathname === "/dashboard/katas"
  );

  const visible        = navItems.filter(i => i.roles.includes(role));
  const visibleSettings = settingsSubItems.filter(i => i.roles.includes(role));

  return (
    <aside className="w-64 min-h-screen bg-dojo-dark border-r border-dojo-border flex flex-col">
      {/* Branding del dojo */}
      <div className="p-5 border-b border-dojo-border">
        <div className="flex items-center gap-3">
          {/* Logo del dojo o ícono por defecto */}
          <div className="w-11 h-11 bg-dojo-red rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow shadow-dojo-red/30">
            {dojo?.logo ? (
              <Image src={dojo.logo} alt={dojo.name} width={44} height={44} className="object-contain w-full h-full" />
            ) : (
              <span className="font-display text-white font-bold text-base tracking-wider select-none">
                {(dojo?.name ?? "D").slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0">
            {/* Nombre del dojo (grande) */}
            <p className="font-display text-dojo-white font-bold text-sm tracking-wide truncate leading-tight">
              {dojo?.name ?? (role === "sysadmin" ? "Super Admin" : "Cargando...")}
            </p>
            {/* Nombre del aplicativo (pequeño) */}
            <p className="font-display text-dojo-gold text-[10px] tracking-widest leading-tight mt-0.5">
              DOJO MANAGER
            </p>
          </div>
        </div>

        {/* Eslogan si existe */}
        {dojo?.slogan && (
          <p className="text-dojo-muted text-[10px] italic mt-2 truncate">{dojo.slogan}</p>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-4 space-y-1">
        {visible.map(item => {
          const Icon   = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium",
                active
                  ? "bg-dojo-red text-white"
                  : "text-dojo-muted hover:bg-dojo-border hover:text-dojo-white"
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
                pathname.startsWith("/dashboard/settings") || pathname === "/dashboard/katas"
                  ? "text-white bg-dojo-border/60"
                  : "text-dojo-muted hover:bg-dojo-border hover:text-dojo-white"
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
                  const active = pathname === sub.href;
                  return (
                    <Link
                      key={sub.href} href={sub.href}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm",
                        active
                          ? "bg-dojo-red text-white font-medium"
                          : "text-dojo-muted hover:bg-dojo-border hover:text-dojo-white"
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

      {/* Scanner QR acceso rápido */}
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

      {/* Info del usuario */}
      <div className="p-4 border-t border-dojo-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-dojo-border rounded-full flex items-center justify-center text-xs font-bold text-dojo-gold flex-shrink-0">
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-dojo-white truncate">{session?.user?.name}</p>
            <p className="text-xs text-dojo-muted capitalize">
              {role === "sysadmin" ? "Super Admin" : role}
            </p>
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
