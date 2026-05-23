"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Trophy, Plus, MapPin, Calendar, Users, CheckCircle,
  Medal, Trash2, AlertTriangle, BarChart3, X, Printer,
} from "lucide-react";
import type { TEventSummary, TEventStats, TEventMedalStudent } from "@/lib/tournament-events";

/* ── helpers ──────────────────────────────────────────────────────── */

function Avatar({ photo, name }: { photo: string | null; name: string }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (photo?.startsWith("http")) {
    return (
      <img
        src={photo}
        alt={name}
        className="w-9 h-9 rounded-full object-cover shrink-0 border border-dojo-border"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-dojo-border flex items-center justify-center text-xs font-bold text-dojo-muted shrink-0">
      {initials || "?"}
    </div>
  );
}

function beltLabel(belt: string) {
  return belt.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/* ── sub-componente: fila de alumno ───────────────────────────────── */

function StudentMedalRow({ s }: { s: TEventMedalStudent }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-dojo-border/30 transition-colors">
      <Avatar photo={s.photo} name={s.fullName} />
      <div className="flex-1 min-w-0">
        <p className="text-dojo-white text-sm font-semibold truncate">{s.fullName}</p>
        <p className="text-dojo-muted text-xs truncate">
          {beltLabel(s.belt)}{s.age > 0 ? ` · ${s.age} años` : ""}
        </p>
        {s.categories.length > 0 && (
          <p className="text-dojo-muted text-xs truncate">🏷️ {s.categories.join(", ")}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {s.gold   > 0 && <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(234,179,8,0.15)",   color: "#FACC15" }}>🥇 {s.gold}</span>}
        {s.silver > 0 && <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(156,163,175,0.15)", color: "#D1D5DB" }}>🥈 {s.silver}</span>}
        {s.bronze > 0 && <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(180,83,9,0.15)",    color: "#FB923C" }}>🥉 {s.bronze}</span>}
      </div>
    </div>
  );
}

/* ── sub-componente: grupo de medallas ────────────────────────────── */

interface MedalGroupProps {
  emoji:    string;
  label:    string;
  color:    string;
  bg:       string;
  students: TEventMedalStudent[];
  medalKey: "gold" | "silver" | "bronze";
}

function MedalGroup({ emoji, label, color, bg, students, medalKey }: MedalGroupProps) {
  const filtered = students
    .filter(s => s[medalKey] > 0)
    .sort((a, b) => b[medalKey] - a[medalKey] || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1 mb-2">
        <span className="text-base">{emoji}</span>
        <h3 className="text-sm font-bold" style={{ color }}>{label}</h3>
        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: bg, color }}>
          {filtered.length}
        </span>
      </div>
      <div className="divide-y divide-dojo-border/40">
        {filtered.map(s => <StudentMedalRow key={s.studentId} s={s} />)}
      </div>
    </div>
  );
}

/* ── función de impresión ─────────────────────────────────────────── */

function printMedalStats(stats: TEventStats) {
  const today = new Date().toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" });

  const goldList   = stats.students.filter(s => s.gold > 0)
    .sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze);
  const silverList = stats.students.filter(s => s.gold === 0 && s.silver > 0)
    .sort((a, b) => b.silver - a.silver || b.bronze - a.bronze);
  const bronzeList = stats.students.filter(s => s.gold === 0 && s.silver === 0 && s.bronze > 0)
    .sort((a, b) => b.bronze - a.bronze);

  function rows(list: TEventMedalStudent[]) {
    return list.map((s, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f9"}">
        <td style="padding:7px 10px;font-weight:600">${s.fullName}</td>
        <td style="padding:7px 10px;color:#555">${beltLabel(s.belt)}</td>
        <td style="padding:7px 10px;color:#555;text-align:center">${s.age > 0 ? `${s.age} años` : "—"}</td>
        <td style="padding:7px 10px;color:#555">${s.categories.length > 0 ? s.categories.join(", ") : "—"}</td>
        <td style="padding:7px 10px;text-align:center">
          ${s.gold   > 0 ? `🥇 ${s.gold}  ` : ""}${s.silver > 0 ? `🥈 ${s.silver}  ` : ""}${s.bronze > 0 ? `🥉 ${s.bronze}` : ""}
        </td>
      </tr>`).join("");
  }

  function section(emoji: string, label: string, color: string, list: TEventMedalStudent[]) {
    if (list.length === 0) return "";
    return `
      <h3 style="color:${color};margin:22px 0 8px;font-size:15px">${emoji} ${label} <span style="font-size:12px;color:#888">(${list.length} alumno${list.length !== 1 ? "s" : ""})</span></h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:6px">
        <thead>
          <tr style="background:#f0f0f0;color:#333">
            <th style="padding:7px 10px;text-align:left">Alumno</th>
            <th style="padding:7px 10px;text-align:left">Cinta</th>
            <th style="padding:7px 10px;text-align:center">Edad</th>
            <th style="padding:7px 10px;text-align:left">Categoría</th>
            <th style="padding:7px 10px;text-align:center">Medallas</th>
          </tr>
        </thead>
        <tbody>${rows(list)}</tbody>
      </table>`;
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Estadísticas de Medallas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Nunito', Arial, sans-serif; padding: 28px; color: #1a1a1a; }
    h1 { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
    .date { font-size: 12px; color: #888; margin-bottom: 20px; }
    .medals { display: flex; gap: 14px; margin-bottom: 24px; }
    .medal-card { flex: 1; text-align: center; padding: 16px 8px; border-radius: 12px; }
    .medal-card .emoji { font-size: 26px; }
    .medal-card .count { font-size: 28px; font-weight: 900; margin: 4px 0; }
    .medal-card .lbl { font-size: 11px; color: #666; font-weight: 600; }
    .gold-card   { background: #fffbeb; border: 1px solid #fde68a; }
    .silver-card { background: #f9fafb; border: 1px solid #e5e7eb; }
    .bronze-card { background: #fff7ed; border: 1px solid #fed7aa; }
    @media print { body { padding: 14px; } }
  </style>
</head>
<body>
  <h1>🏆 Estadísticas de Medallas — Torneos</h1>
  <p class="date">Generado el ${today}</p>

  <div class="medals">
    <div class="medal-card gold-card">
      <div class="emoji">🥇</div>
      <div class="count" style="color:#b45309">${stats.totalGold}</div>
      <div class="lbl">Medallas de Oro</div>
    </div>
    <div class="medal-card silver-card">
      <div class="emoji">🥈</div>
      <div class="count" style="color:#6b7280">${stats.totalSilver}</div>
      <div class="lbl">Medallas de Plata</div>
    </div>
    <div class="medal-card bronze-card">
      <div class="emoji">🥉</div>
      <div class="count" style="color:#c2410c">${stats.totalBronze}</div>
      <div class="lbl">Medallas de Bronce</div>
    </div>
  </div>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:18px">

  ${section("🥇", "Con Medalla de Oro",    "#b45309", goldList)}
  ${section("🥈", "Con Medalla de Plata",  "#6b7280", silverList)}
  ${section("🥉", "Con Medalla de Bronce", "#c2410c", bronzeList)}

  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

/* ── componente principal ─────────────────────────────────────────── */

export default function TournamentEventsPage() {
  const [events,       setEvents]       = useState<TEventSummary[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [deleting,     setDeleting]     = useState<string | null>(null);
  const [confirmDel,   setConfirmDel]   = useState<TEventSummary | null>(null);

  const [showStats,    setShowStats]    = useState(false);
  const [stats,        setStats]        = useState<TEventStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    // ?t= evita que el navegador o Next.js sirva la respuesta cacheada
    const r = await fetch(`/api/tournament-events?t=${Date.now()}`, { cache: "no-store" });
    if (r.ok) setEvents(await r.json());
    setLoading(false);
  }

  async function loadStats() {
    setLoadingStats(true);
    const r = await fetch(`/api/tournament-events/stats?t=${Date.now()}`, { cache: "no-store" });
    if (r.ok) setStats(await r.json());
    setLoadingStats(false);
  }

  useEffect(() => {
    setLoading(true);
    load();
    setStats(null);

    // Polling cada 10 s para reflejar cambios hechos en la página de detalle
    pollingRef.current = setInterval(load, 10_000);

    // También refrescar al recuperar visibilidad del tab
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleStats() {
    if (!showStats && !stats) loadStats();
    setShowStats(v => !v);
  }

  async function handleDelete(ev: TEventSummary) {
    setDeleting(ev.id);
    const r = await fetch(`/api/tournament-events/${ev.id}`, { method: "DELETE" });
    if (r.ok) {
      setEvents(e => e.filter(x => x.id !== ev.id));
      setStats(null);
    }
    setDeleting(null);
    setConfirmDel(null);
  }

  /* ── render ─────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <Trophy size={28} className="text-dojo-red" /> Asistencia de Torneos
          </h1>
          <p className="text-dojo-muted text-sm mt-1">
            Controla la llegada y resultados de tus alumnos en cada torneo
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={toggleStats}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              showStats
                ? "bg-dojo-gold/20 border-dojo-gold/40 text-dojo-gold"
                : "bg-dojo-darker border-dojo-border text-dojo-muted hover:text-dojo-white"
            }`}
          >
            <BarChart3 size={15} />
            Estadísticas
          </button>
          <Link href="/dashboard/tournament-events/new" className="flex-1 sm:flex-none btn-primary flex items-center justify-center gap-2">
            <Plus size={16} /> Nuevo Torneo
          </Link>
        </div>
      </div>

      {/* ── Sección Estadísticas ────────────────────────────────────── */}
      {showStats && (
        <div className="card space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-dojo-white flex items-center gap-2">
              <BarChart3 size={18} className="text-dojo-gold" />
              Estadísticas de Torneos
            </h2>
            <div className="flex items-center gap-2">
              {stats && stats.students.length > 0 && (
                <button
                  onClick={() => printMedalStats(stats)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-dojo-darker border border-dojo-border text-dojo-muted hover:text-dojo-white transition-colors"
                  title="Imprimir PDF"
                >
                  <Printer size={13} />
                  Imprimir PDF
                </button>
              )}
              <button onClick={() => setShowStats(false)} className="text-dojo-muted hover:text-dojo-white transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {loadingStats && (
            <div className="flex items-center justify-center py-10">
              <div className="w-7 h-7 rounded-full border-4 border-dojo-gold border-t-transparent animate-spin" />
            </div>
          )}

          {!loadingStats && stats && (
            <>
              {/* Tarjetas de totales */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl p-4 text-center space-y-1" style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)" }}>
                  <div className="text-3xl">🥇</div>
                  <p className="text-3xl font-black" style={{ color: "#FACC15" }}>{stats.totalGold}</p>
                  <p className="text-xs font-semibold text-dojo-muted">Medallas de Oro</p>
                </div>
                <div className="rounded-2xl p-4 text-center space-y-1" style={{ background: "rgba(156,163,175,0.1)", border: "1px solid rgba(156,163,175,0.25)" }}>
                  <div className="text-3xl">🥈</div>
                  <p className="text-3xl font-black" style={{ color: "#D1D5DB" }}>{stats.totalSilver}</p>
                  <p className="text-xs font-semibold text-dojo-muted">Medallas de Plata</p>
                </div>
                <div className="rounded-2xl p-4 text-center space-y-1" style={{ background: "rgba(180,83,9,0.1)", border: "1px solid rgba(180,83,9,0.25)" }}>
                  <div className="text-3xl">🥉</div>
                  <p className="text-3xl font-black" style={{ color: "#FB923C" }}>{stats.totalBronze}</p>
                  <p className="text-xs font-semibold text-dojo-muted">Medallas de Bronce</p>
                </div>
              </div>

              {/* Alumnos agrupados por medallas */}
              {stats.students.length === 0 ? (
                <div className="text-center py-8">
                  <Medal size={36} className="text-dojo-muted mx-auto mb-3 opacity-30" />
                  <p className="text-dojo-muted text-sm">Aún no hay medallas registradas.</p>
                  <p className="text-dojo-muted text-xs mt-1">Ingresa resultados desde el control de cada torneo.</p>
                </div>
              ) : (
                <div className="space-y-6 pt-2 border-t border-dojo-border">
                  <MedalGroup
                    emoji="🥇" label="Con Medalla de Oro"
                    color="#FACC15" bg="rgba(234,179,8,0.12)"
                    students={stats.students} medalKey="gold"
                  />
                  <MedalGroup
                    emoji="🥈" label="Con Medalla de Plata"
                    color="#D1D5DB" bg="rgba(156,163,175,0.12)"
                    students={stats.students.filter(s => s.gold === 0)}
                    medalKey="silver"
                  />
                  <MedalGroup
                    emoji="🥉" label="Con Medalla de Bronce"
                    color="#FB923C" bg="rgba(180,83,9,0.12)"
                    students={stats.students.filter(s => s.gold === 0 && s.silver === 0)}
                    medalKey="bronze"
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Lista de torneos ────────────────────────────────────────── */}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="card text-center py-16">
          <Trophy size={48} className="text-dojo-muted mx-auto mb-4 opacity-30" />
          <p className="text-dojo-white font-semibold text-lg">Sin torneos registrados</p>
          <p className="text-dojo-muted text-sm mt-1">
            Crea un torneo para controlar la asistencia y resultados de tus alumnos.
          </p>
          <Link href="/dashboard/tournament-events/new" className="btn-primary mt-6 inline-flex items-center gap-2">
            <Plus size={16} /> Crear primer torneo
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {events.map(ev => {
          const date    = new Date(ev.date);
          const dateStr = date.toLocaleDateString("es-PA", { weekday:"short", day:"numeric", month:"long", year:"numeric" });
          const pct     = ev.totalStudents > 0 ? Math.round((ev.arrivedCount / ev.totalStudents) * 100) : 0;

          return (
            <div key={ev.id} className="card space-y-4">
              {/* Cabecera */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-bold text-dojo-white text-lg leading-tight truncate">
                    {ev.name}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-1 text-dojo-muted text-xs">
                    <Calendar size={11} />
                    <span>{dateStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-dojo-muted text-xs mt-0.5">
                    <MapPin size={11} />
                    <span className="truncate">{ev.location}</span>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmDel(ev)}
                  className="text-dojo-muted hover:text-red-400 transition-colors p-1 shrink-0"
                  title="Eliminar torneo"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-dojo-darker rounded-lg p-2">
                  <Users size={14} className="text-dojo-muted mx-auto mb-1" />
                  <p className="text-dojo-white font-bold text-base">{ev.totalStudents}</p>
                  <p className="text-dojo-muted text-xs">Inscritos</p>
                </div>
                <div className="bg-dojo-darker rounded-lg p-2">
                  <CheckCircle size={14} className="text-green-400 mx-auto mb-1" />
                  <p className="text-green-400 font-bold text-base">{ev.arrivedCount}</p>
                  <p className="text-dojo-muted text-xs">Llegaron</p>
                </div>
                <div className="bg-dojo-darker rounded-lg p-2">
                  <Medal size={14} className="text-dojo-gold mx-auto mb-1" />
                  <p className="text-dojo-gold font-bold text-base">{ev.resultsCount}</p>
                  <p className="text-dojo-muted text-xs">Resultados</p>
                </div>
              </div>

              {/* Barra de progreso */}
              <div>
                <div className="flex justify-between text-xs text-dojo-muted mb-1">
                  <span>Asistencia</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 bg-dojo-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct === 100 ? "#10B981" : "#C0392B" }}
                  />
                </div>
              </div>

              {/* Acciones */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dojo-border">
                <Link
                  href={`/dashboard/tournament-events/${ev.id}`}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-dojo-darker hover:bg-dojo-border transition-colors text-dojo-white"
                >
                  📋 Control
                </Link>
                <Link
                  href={`/dashboard/tournament-events/${ev.id}/scan`}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg transition-colors text-white"
                  style={{ background: "#C0392B" }}
                >
                  📷 Escanear QR
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal confirmación de borrado */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="card max-w-sm w-full space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-900/30 border border-red-800/50">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-semibold text-sm">Eliminar torneo</p>
                <p className="text-red-300/80 text-xs mt-0.5">
                  Se eliminarán todos los registros de asistencia y resultados de <strong>{confirmDel.name}</strong>.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDel)}
                disabled={deleting === confirmDel.id}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-red-700 hover:bg-red-600 text-white disabled:opacity-50"
              >
                <Trash2 size={15} />
                {deleting === confirmDel.id ? "Eliminando..." : "Eliminar"}
              </button>
              <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1 justify-center">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
