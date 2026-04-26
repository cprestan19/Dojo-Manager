"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Menu, X, Users, CreditCard, Award, BookOpen,
  BarChart2, Settings, LogOut, Shield, Building2, Clock,
  ClipboardList, QrCode, ChevronDown, Tag,
  ChevronLeft, Home, UserPlus, Mail, LayoutDashboard,
} from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":               "Inicio",
  "/dashboard/students":      "Alumnos",
  "/dashboard/students/new":  "Nuevo Alumno",
  "/dashboard/payments":      "Pagos",
  "/dashboard/belts":         "Rangos",
  "/dashboard/schedules":     "Horarios",
  "/dashboard/attendance":    "Asistencia",
  "/dashboard/katas":         "Catálogo Katas",
  "/dashboard/reports":       "Reportes",
  "/dashboard/users":         "Usuarios",
  "/dashboard/dojos":         "Dojos",
  "/dashboard/settings":      "Configuración",
  "/dashboard/settings/katas":"Creación de Katas",
};

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
  { href: "/dashboard/settings",        label: "General",              icon: Settings },
  { href: "/dashboard/settings/katas",  label: "Creación de Katas",    icon: Tag },
  { href: "/dashboard/settings/email",  label: "Parámetros de Correo", icon: Mail },
  { href: "/dashboard/katas",           label: "Catálogo de Katas",    icon: BookOpen },
];

const mobileNavItems = [
  { href: "/dashboard",              label: "Inicio",            icon: Home,        roles: ["sysadmin","admin","user"] },
  { href: "/dashboard/students",     label: "Ver Alumnos",       icon: Users,       roles: ["sysadmin","admin","user"] },
  { href: "/dashboard/schedules",    label: "Turnos / Horarios", icon: Clock,       roles: ["sysadmin","admin"] },
  { href: "/dashboard/payments",     label: "Pagos",             icon: CreditCard,  roles: ["sysadmin","admin"] },
  { href: "/dashboard/students/new", label: "Nuevo Alumno",      icon: UserPlus,    roles: ["sysadmin","admin"] },
  { href: "/scanner",                label: "Marcación QR",      icon: QrCode,      roles: ["sysadmin","admin","user"] },
  { href: "/dashboard/dojos",        label: "Gestión de Dojos",  icon: Building2,   roles: ["sysadmin"] },
];

const backRoutes: Record<string, string> = {
  "/dashboard/students":   "/dashboard",
  "/dashboard/payments":   "/dashboard",
  "/dashboard/schedules":  "/dashboard",
  "/dashboard/attendance": "/dashboard",
  "/dashboard/belts":      "/dashboard",
  "/dashboard/katas":      "/dashboard/settings",
  "/dashboard/reports":    "/dashboard",
  "/dashboard/users":      "/dashboard",
  "/dashboard/settings":   "/dashboard",
  "/scanner":              "/dashboard",
};

export function MobileNav() {
  const pathname                = usePathname();
  const router                  = useRouter();
  const { data: session }       = useSession();
  const [open, setOpen]         = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() =>
    pathname.startsWith("/dashboard/settings") || pathname === "/dashboard/katas"
  );

  const role    = (session?.user as { role?: string })?.role ?? "user";
  const name    = session?.user?.name ?? "";
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const visible         = navItems.filter(i => i.roles.includes(role));
  const visibleSettings = settingsSubItems;
  const visibleMobile   = mobileNavItems.filter(i => i.roles.includes(role));
  const showSettings    = role === "admin" || role === "sysadmin";

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

  const title = Object.entries(PAGE_TITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => pathname === path || pathname.startsWith(path + "/"))?.[1]
    ?? "Dashboard";

  function close() { setOpen(false); }

  return (
    <div className="block lg:hidden">
      <header className="h-14 flex items-center justify-between px-4 bg-dojo-dark border-b border-dojo-border shrink-0 gap-3">
        {backTo ? (
          <button
            onClick={() => router.push(backTo)}
            className="p-2 rounded-lg hover:bg-dojo-border transition-colors shrink-0"
            aria-label="Volver"
          >
            <ChevronLeft size={22} className="text-dojo-white" />
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <LayoutDashboard size={18} className="text-dojo-red" />
            <span className="font-display text-dojo-gold text-sm font-bold tracking-widest">INICIO</span>
          </div>
        )}
        <p className="font-display text-dojo-white text-sm font-semibold truncate flex-1 text-center">{title}</p>
        <button
          onClick={() => setOpen(true)}
          className="p-2 rounded-lg hover:bg-dojo-border transition-colors shrink-0"
          aria-label="Abrir menú"
        >
          <Menu size={20} className="text-dojo-white" />
        </button>
      </header>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40"
          onClick={close}
        />
      )}

      <div className={cn(
        "fixed top-0 right-0 h-full w-[280px] bg-dojo-dark border-l border-dojo-border z-50 flex flex-col",
        "transition-transform duration-300",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between px-4 h-14 border-b border-dojo-border shrink-0">
          <span className="font-display text-dojo-white text-sm font-bold">Menú</span>
          <button onClick={close} className="p-2 rounded-lg hover:bg-dojo-border transition-colors">
            <X size={18} className="text-dojo-muted" />
          </button>
        </div>

        <div className="px-4 py-4 border-b border-dojo-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-dojo-border rounded-full flex items-center justify-center text-xs font-bold text-dojo-gold shrink-0">
              {initials || "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-dojo-white truncate">{name}</p>
              <p className="text-xs text-dojo-muted capitalize">
                {role === "sysadmin" ? "Super Admin" : role}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {visibleMobile.map(item => {
            const Icon   = item.icon;
            const active = pathname === item.href ||
              (item.href !== "/dashboard" && item.href !== "/scanner" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                  active ? "bg-dojo-red text-white" : "text-dojo-muted hover:bg-dojo-border hover:text-dojo-white"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-dojo-border shrink-0">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-dojo-muted hover:bg-dojo-border hover:text-dojo-white transition-colors"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
