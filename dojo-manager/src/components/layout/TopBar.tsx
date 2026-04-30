"use client";
import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Search, Bell, ChevronDown, LogOut, KeyRound } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const NOTIFICATION_COUNT = 3;

export function TopBar() {
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const role = (session?.user as { role?: string })?.role ?? "user";
  const name = session?.user?.name ?? "";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const roleLabel =
    role === "sysadmin"
      ? "Super Admin"
      : role === "admin"
      ? "Administrador"
      : "Usuario";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="hidden lg:flex h-16 items-center justify-between px-6 bg-dojo-dark border-b border-dojo-border gap-4 shrink-0">
      {/* Search bar */}
      <div className="relative flex-1 max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Buscar alumno, pago..."
          aria-label="Buscar"
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-dojo-darker border border-dojo-border text-sm text-dojo-white placeholder:text-dojo-muted focus:outline-none focus:ring-2 focus:ring-dojo-red/40 focus:border-dojo-red/50 transition-all"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <button
          aria-label={`${NOTIFICATION_COUNT} notificaciones pendientes`}
          className="relative p-2 rounded-lg text-dojo-muted hover:bg-dojo-border hover:text-dojo-white transition-colors"
        >
          <Bell size={20} />
          {NOTIFICATION_COUNT > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 w-4 h-4 bg-dojo-red rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none"
            >
              {NOTIFICATION_COUNT}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-dojo-border mx-1" aria-hidden="true" />

        {/* User profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            aria-label="Menú de perfil de usuario"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-dojo-border transition-colors"
          >
            {/* Avatar */}
            <div className="w-8 h-8 bg-dojo-border rounded-full flex items-center justify-center text-xs font-bold text-dojo-gold flex-shrink-0">
              {initials || "?"}
            </div>

            {/* Name + role */}
            <div className="text-left hidden xl:block">
              <p className="text-sm font-semibold text-dojo-white leading-tight truncate max-w-[140px]">
                {name}
              </p>
              <p className="text-[11px] text-dojo-muted leading-tight">{roleLabel}</p>
            </div>

            <ChevronDown
              size={14}
              className={cn(
                "text-dojo-muted transition-transform duration-200",
                dropdownOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 w-56 bg-dojo-dark border border-dojo-border rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Header info */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-dojo-border">
                <div className="w-9 h-9 bg-dojo-border rounded-full flex items-center justify-center text-xs font-bold text-dojo-gold flex-shrink-0">
                  {initials || "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-dojo-white truncate">{name}</p>
                  <p className="text-xs text-dojo-muted">{roleLabel}</p>
                </div>
              </div>

              {/* Options */}
              <div className="p-1.5 space-y-0.5">
                <Link
                  href="/dashboard/change-password"
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dojo-muted hover:bg-dojo-border hover:text-dojo-white transition-colors"
                >
                  <KeyRound size={15} aria-hidden="true" />
                  Cambiar Contraseña
                </Link>

                <button
                  role="menuitem"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dojo-muted hover:bg-dojo-red/10 hover:text-dojo-red transition-colors"
                >
                  <LogOut size={15} aria-hidden="true" />
                  Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
