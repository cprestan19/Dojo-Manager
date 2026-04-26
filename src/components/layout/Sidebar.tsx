"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Users, CreditCard, Award, BookOpen,
  BarChart2, Settings, LogOut, Sword, Shield,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",           label: "Inicio",      icon: Sword,     roles: ["sysadmin","admin","user"] },
  { href: "/dashboard/students",  label: "Alumnos",     icon: Users,     roles: ["sysadmin","admin","user"] },
  { href: "/dashboard/payments",  label: "Pagos",       icon: CreditCard,roles: ["sysadmin","admin"] },
  { href: "/dashboard/belts",     label: "Rangos",      icon: Award,     roles: ["sysadmin","admin","user"] },
  { href: "/dashboard/katas",     label: "Catálogo Katas", icon: BookOpen,roles: ["sysadmin","admin"] },
  { href: "/dashboard/reports",   label: "Reportes",    icon: BarChart2, roles: ["sysadmin","admin"] },
  { href: "/dashboard/users",     label: "Usuarios",    icon: Shield,    roles: ["sysadmin","admin"] },
  { href: "/dashboard/settings",  label: "Configuración",icon: Settings,  roles: ["sysadmin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "user";

  const visible = navItems.filter((i) => i.roles.includes(role));

  return (
    <aside className="w-64 min-h-screen bg-dojo-dark border-r border-dojo-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-dojo-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-dojo-red rounded-lg flex items-center justify-center">
            <Sword size={20} className="text-white" />
          </div>
          <div>
            <p className="font-display text-dojo-white font-bold text-sm tracking-widest">DOJO</p>
            <p className="font-display text-dojo-gold text-xs tracking-widest">MANAGER</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
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
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-dojo-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-dojo-border rounded-full flex items-center justify-center text-xs font-bold text-dojo-gold">
            {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-dojo-white truncate">{session?.user?.name}</p>
            <p className="text-xs text-dojo-muted capitalize">{role}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full btn-ghost text-sm justify-start"
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
