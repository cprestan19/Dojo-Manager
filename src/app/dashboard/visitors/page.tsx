import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Globe, MapPin, Monitor, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ISO-3166-1 alpha-2 → flag emoji
function flag(code: string | null): string {
  if (!code || code.length !== 2) return "🌐";
  return Array.from(code.toUpperCase())
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join("");
}

function fmtDate(d: Date): string {
  return d.toLocaleString("es-PA", { timeZone: "America/Panama", dateStyle: "short", timeStyle: "short" });
}

function browserName(ua: string | null): string {
  if (!ua) return "—";
  if (ua.includes("Edg/"))    return "Edge";
  if (ua.includes("OPR/"))    return "Opera";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Firefox/"))return "Firefox";
  if (ua.includes("Safari/")) return "Safari";
  if (ua.includes("bot") || ua.includes("Bot") || ua.includes("crawl")) return "Bot";
  return "Otro";
}

function pathLabel(path: string): string {
  const map: Record<string, string> = {
    "/":                 "Inicio",
    "/login":            "Login",
    "/forgot-password":  "Recuperar contraseña",
    "/reset-password":   "Resetear contraseña",
  };
  return map[path] ?? path;
}

export default async function VisitorsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const { role } = session.user as { role?: string };
  if (role !== "sysadmin") redirect("/dashboard");

  const TZ    = "America/Panama";
  const now   = new Date();
  const today = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  today.setHours(0, 0, 0, 0);

  const weekAgo  = new Date(today); weekAgo.setDate(today.getDate() - 6);
  const monthAgo = new Date(today); monthAgo.setDate(today.getDate() - 29);

  const [totalToday, totalWeek, totalMonth, byCountry, byPage, recent] = await Promise.all([
    prisma.visitorLog.count({ where: { visitedAt: { gte: today } } }),
    prisma.visitorLog.count({ where: { visitedAt: { gte: weekAgo } } }),
    prisma.visitorLog.count({ where: { visitedAt: { gte: monthAgo } } }),
    prisma.visitorLog.groupBy({
      by:      ["country", "countryCode"],
      where:   { visitedAt: { gte: monthAgo } },
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
      take:    10,
    }),
    prisma.visitorLog.groupBy({
      by:      ["path"],
      where:   { visitedAt: { gte: monthAgo } },
      _count:  { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    prisma.visitorLog.findMany({
      orderBy: { visitedAt: "desc" },
      take:    100,
      select:  { id: true, ip: true, country: true, countryCode: true, city: true, region: true, lat: true, lng: true, path: true, userAgent: true, referer: true, visitedAt: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="btn-ghost p-1.5 rounded-lg">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white flex items-center gap-2">
            <Globe size={22} className="text-dojo-gold" />
            Visitantes
          </h1>
          <p className="text-sm text-dojo-muted">dojomasteronline.com — páginas públicas</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Hoy",        value: totalToday },
          { label: "7 días",     value: totalWeek  },
          { label: "30 días",    value: totalMonth },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className="text-3xl font-bold font-display text-dojo-gold">{s.value}</p>
            <p className="text-xs text-dojo-muted mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Por país y por página */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Países */}
        <div className="card space-y-3">
          <p className="text-sm font-bold text-dojo-white flex items-center gap-2">
            <MapPin size={15} className="text-dojo-gold" />
            Por país <span className="text-dojo-muted font-normal">(últimos 30 días)</span>
          </p>
          {byCountry.length === 0 ? (
            <p className="text-sm text-dojo-muted italic">Sin datos aún</p>
          ) : (
            <div className="space-y-2">
              {byCountry.map(row => {
                const pct = totalMonth > 0 ? Math.round((row._count.id / totalMonth) * 100) : 0;
                return (
                  <div key={row.countryCode ?? row.country} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span>{flag(row.countryCode)}</span>
                        <span className="text-dojo-white">{row.country ?? row.countryCode ?? "Desconocido"}</span>
                      </span>
                      <span className="text-dojo-muted tabular-nums">{row._count.id} <span className="text-xs">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-dojo-border rounded-full overflow-hidden">
                      <div className="h-full bg-dojo-gold/70 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Páginas */}
        <div className="card space-y-3">
          <p className="text-sm font-bold text-dojo-white flex items-center gap-2">
            <Monitor size={15} className="text-dojo-gold" />
            Por página <span className="text-dojo-muted font-normal">(últimos 30 días)</span>
          </p>
          {byPage.length === 0 ? (
            <p className="text-sm text-dojo-muted italic">Sin datos aún</p>
          ) : (
            <div className="divide-y divide-dojo-border">
              {byPage.map(row => (
                <div key={row.path} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-dojo-white font-mono text-xs">{pathLabel(row.path)}</span>
                  <span className="badge-blue">{row._count.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla de visitas recientes */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-dojo-border">
          <p className="text-sm font-bold text-dojo-white">Últimas 100 visitas</p>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-12 text-dojo-muted">
            <Globe size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Sin visitas registradas todavía.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dojo-border text-xs text-dojo-muted">
                  <th className="px-4 py-2 text-left">Fecha</th>
                  <th className="px-4 py-2 text-left">IP</th>
                  <th className="px-4 py-2 text-left">País / Ciudad</th>
                  <th className="px-4 py-2 text-left hidden sm:table-cell">Coords</th>
                  <th className="px-4 py-2 text-left">Página</th>
                  <th className="px-4 py-2 text-left hidden md:table-cell">Navegador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dojo-border/50">
                {recent.map(v => (
                  <tr key={v.id} className="hover:bg-dojo-border/20 transition-colors">
                    <td className="px-4 py-2 text-dojo-muted whitespace-nowrap text-xs">{fmtDate(v.visitedAt)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-dojo-white">{v.ip}</td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1.5">
                        <span className="text-base leading-none">{flag(v.countryCode)}</span>
                        <span className="text-dojo-white text-xs">{v.country ?? v.countryCode ?? "—"}</span>
                        {v.city && <span className="text-dojo-muted text-xs">· {v.city}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-dojo-muted hidden sm:table-cell">
                      {v.lat && v.lng
                        ? <a href={`https://maps.google.com/?q=${v.lat},${v.lng}`} target="_blank" rel="noopener noreferrer" className="text-dojo-gold hover:underline">{v.lat}, {v.lng}</a>
                        : "—"
                      }
                    </td>
                    <td className="px-4 py-2 text-xs text-dojo-white font-mono">{pathLabel(v.path)}</td>
                    <td className="px-4 py-2 text-xs text-dojo-muted hidden md:table-cell">{browserName(v.userAgent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
