"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  TooltipProps,
} from "recharts";

type ChartColors = { primary: string; grid: string; axis: string; tooltipBg: string; tooltipBorder: string };

function getChartColors(): ChartColors {
  if (typeof document === "undefined") return darkColors;
  const el    = document.getElementById("dojo-shell") ?? document.documentElement;
  const theme = el.getAttribute("data-theme") ?? "dark-saas";
  const hex   = getComputedStyle(el).getPropertyValue("--c-primary-hex").trim();
  if (theme === "executive-red" || theme === "soft-neutral") {
    return { primary: hex || "#DC2626", grid: "rgba(0,0,0,0.06)", axis: "#9CA3AF", tooltipBg: "#1F2937", tooltipBorder: "rgba(0,0,0,0.15)" };
  }
  return { ...darkColors, primary: hex || "#C0392B" };
}
const darkColors: ChartColors = { primary: "#C0392B", grid: "rgba(255,255,255,0.06)", axis: "#8892A4", tooltipBg: "#1A1A2E", tooltipBorder: "rgba(255,255,255,0.12)" };

interface ScheduleBreakdown { name: string; count: number; }
interface DayData {
  day:       string;
  pct:       number;
  count:     number;
  entries:   number;
  exits:     number;
  date:      string;
  schedules: ScheduleBreakdown[];
}
interface WeekData {
  days:        DayData[];
  weekLabel:   string;
  totalActive: number;
}

/* ─── Custom Tooltip ─────────────────────────────────────── */
function CustomTooltip({ active, payload, label, colors }: TooltipProps<number, string> & { payload?: { payload: DayData }[]; label?: string; colors: ChartColors }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl px-4 py-3 shadow-xl min-w-[160px]"
      style={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}` }}>
      <p className="font-semibold text-sm text-center mb-1.5" style={{ color: colors.axis }}>{label}</p>
      <p className="text-2xl font-bold text-center" style={{ color: colors.primary }}>{d.pct}%</p>
      <div className="flex justify-center gap-4 mt-1.5 text-xs" style={{ color: colors.axis }}>
        <span className="text-green-400">{d.entries} entradas</span>
        <span className="text-red-400">{d.exits} salidas</span>
      </div>
      {d.schedules.length > 0 && (
        <div className="mt-2 pt-2 space-y-0.5" style={{ borderTop: `1px solid ${colors.tooltipBorder}` }}>
          {d.schedules.map(s => (
            <div key={s.name} className="flex justify-between gap-3 text-xs" style={{ color: colors.axis }}>
              <span className="truncate max-w-[120px]">{s.name}</span>
              <span className="font-bold" style={{ color: colors.primary }}>{s.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Chart Component ────────────────────────────────────── */
export function AttendanceChart() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data,       setData]       = useState<WeekData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [colors,     setColors]     = useState<ChartColors>(darkColors);

  // Sincronizar colores con el tema activo y reaccionar a cambios de tema
  useEffect(() => {
    const el = document.getElementById("dojo-shell") ?? document.documentElement;
    const sync = () => setColors(getChartColors());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const r = await fetch(`/api/attendance/weekly?weekOffset=${weekOffset}`);
    if (r.ok) setData(await r.json());
    if (!silent) setLoading(false);
  }, [weekOffset]);

  useEffect(() => { load(); }, [load]);

  // Silent background polling — only for current week, only when tab is visible
  useEffect(() => {
    if (weekOffset !== 0) return;
    const poll = () => {
      if (document.visibilityState === "visible") load(true);
    };
    const id = setInterval(poll, 30_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [weekOffset, load]);

  return (
    <div className="card flex flex-col gap-4 min-h-[260px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="font-display font-bold text-dojo-white text-base tracking-wide">
          Asistencia semanal
        </p>
        {/* Week selector */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="p-1 rounded-lg hover:bg-dojo-border transition-colors text-dojo-muted hover:text-dojo-white"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs font-semibold text-dojo-muted min-w-[100px] text-center select-none">
            {data?.weekLabel ?? "—"}
          </span>
          <button
            onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
            disabled={weekOffset === 0}
            className="p-1 rounded-lg hover:bg-dojo-border transition-colors text-dojo-muted hover:text-dojo-white disabled:opacity-30 disabled:cursor-default"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-dojo-red border-t-transparent animate-spin" />
        </div>
      ) : !data || data.days.every(d => d.pct === 0) ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-dojo-muted text-sm text-center">Sin registros de asistencia esta semana.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <AreaChart data={data.days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={colors.primary} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={colors.primary} stopOpacity={0.04} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke={colors.grid}
                vertical={false}
              />

              <XAxis
                dataKey="day"
                tick={{ fill: colors.axis, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: colors.axis, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                ticks={[0, 25, 50, 75, 100]}
              />

              <Tooltip content={<CustomTooltip colors={colors} />} cursor={{ stroke: colors.grid, strokeWidth: 1 }} />

              <Area
                type="monotone"
                dataKey="pct"
                stroke={colors.primary}
                strokeWidth={4}
                fill="url(#attendGrad)"
                dot={{ fill: colors.primary, r: 4.5, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ fill: colors.primary, r: 6.5, stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer: total active students reference */}
      {data && data.totalActive > 0 && (
        <p className="text-xs text-dojo-muted text-right -mt-1">
          Base: {data.totalActive} alumnos activos
        </p>
      )}
    </div>
  );
}
