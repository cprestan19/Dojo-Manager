"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  TooltipProps,
} from "recharts";

interface DayData {
  day:   string;
  pct:   number;
  count: number;
  date:  string;
}
interface WeekData {
  days:        DayData[];
  weekLabel:   string;
  totalActive: number;
}

/* ─── Custom Tooltip ─────────────────────────────────────── */
function CustomTooltip({ active, payload, label }: TooltipProps<number, string> & { payload?: { payload: DayData }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl px-4 py-2.5 shadow-xl text-center"
      style={{ background: "#1A1A2E", border: "1px solid rgba(255,255,255,0.12)" }}>
      <p className="text-white font-semibold text-sm">{label}</p>
      <p className="text-2xl font-bold" style={{ color: "#C0392B" }}>{d.pct}%</p>
      <p className="text-xs" style={{ color: "#8892A4" }}>{d.count} alumnos</p>
    </div>
  );
}

/* ─── Chart Component ────────────────────────────────────── */
export function AttendanceChart() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data,       setData]       = useState<WeekData | null>(null);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/attendance/weekly?weekOffset=${weekOffset}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [weekOffset]);

  useEffect(() => { load(); }, [load]);

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
                  <stop offset="0%"   stopColor="#C0392B" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#C0392B" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />

              <XAxis
                dataKey="day"
                tick={{ fill: "#8892A4", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fill: "#8892A4", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                ticks={[0, 25, 50, 75, 100]}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1 }} />

              <Area
                type="monotone"
                dataKey="pct"
                stroke="#C0392B"
                strokeWidth={2.5}
                fill="url(#attendGrad)"
                dot={{ fill: "#C0392B", r: 3.5, strokeWidth: 0 }}
                activeDot={{ fill: "#C0392B", r: 5, stroke: "#fff", strokeWidth: 1.5 }}
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
