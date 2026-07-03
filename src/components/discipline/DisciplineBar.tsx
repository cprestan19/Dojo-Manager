"use client";
import { useEffect, useRef, useState, useId } from "react";
import type { DisciplineData, DisciplineStatus } from "@/lib/monthly-discipline";

// ── Design tokens ─────────────────────────────────────────────────────────────

function barColor(status: DisciplineStatus): string {
  switch (status) {
    case "exemplary":       return "#22c55e";
    case "good":            return "#84cc16";
    case "building":        return "#F39C12";
    case "needs_attention": return "#ef4444";
    default:                return "#4b5563";
  }
}

function barGlow(status: DisciplineStatus): string {
  switch (status) {
    case "exemplary":       return "0 0 12px rgba(34,197,94,0.5)";
    case "good":            return "0 0 12px rgba(132,204,22,0.4)";
    case "building":        return "0 0 12px rgba(243,156,18,0.4)";
    case "needs_attention": return "0 0 12px rgba(239,68,68,0.4)";
    default:                return "none";
  }
}

// ── Animated number counter ───────────────────────────────────────────────────

function useAnimatedCounter(target: number, durationMs = 1300): number {
  const [value, setValue] = useState(0);
  const rafRef            = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, durationMs]);

  return value;
}

// ── Star SVG — fills bottom-to-top via linearGradient ────────────────────────

function StarSVG({
  fillPercent,
  color,
  size = "w-8 h-8",
}: {
  fillPercent: number;
  color:       string;
  size?:       string;
}) {
  const gradId = useId();
  const stop   = Math.max(2, Math.min(100, fillPercent));

  return (
    <svg
      viewBox="0 0 40 40"
      className={`${size} shrink-0`}
      aria-hidden
    >
      <defs>
        {/*
          Gradient goes from bottom (y1=100%) to top (y2=0%).
          offset 0% = bottom, offset 100% = top.
          Bottom `stop`% is filled; above that is faded.
        */}
        <linearGradient id={gradId} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%"          stopColor={color} stopOpacity="1"    />
          <stop offset={`${stop}%`}  stopColor={color} stopOpacity="1"    />
          <stop offset={`${stop}%`}  stopColor={color} stopOpacity="0.15" />
          <stop offset="100%"        stopColor={color} stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* 5-pointed star: outer R=17, inner r=7, center (20,20) */}
      <path
        d="M 20 3 L 24.1 14.3 L 36.2 14.8 L 26.7 22.2 L 30 33.8 L 20 27 L 10 33.8 L 13.3 22.2 L 3.8 14.8 L 15.9 14.3 Z"
        fill={`url(#${gradId})`}
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{ transition: "stroke 0.8s ease", filter: stop > 50 ? `drop-shadow(0 0 4px ${color}60)` : "none" }}
      />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DisciplineBarProps {
  data:     DisciplineData;
  compact?: boolean;
}

export function DisciplineBar({ data, compact = false }: DisciplineBarProps) {
  const { percentage, expectedCount, attendedCount, message, status } = data;

  const target              = percentage ?? 0;
  const animPct             = useAnimatedCounter(target);
  const [barPct, setBarPct] = useState(0);
  const color               = barColor(status);
  const glow                = barGlow(status);
  const hasData             = expectedCount > 0;

  useEffect(() => {
    const t = setTimeout(() => setBarPct(target), 80);
    return () => clearTimeout(t);
  }, [target]);

  // ── Compact mode (dark overlay — scanner) ──────────────────────────────────
  if (compact) {
    return (
      <div className="w-full space-y-1.5 px-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white/70 tracking-wide">
            DISCIPLINA DEL MES
          </span>
          {hasData && (
            <span className="text-sm font-bold tabular-nums" style={{ color }}>
              {animPct}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
            {hasData ? (
              <div
                className="h-full rounded-full"
                style={{
                  width:           `${barPct}%`,
                  backgroundColor: color,
                  boxShadow:       glow,
                  transition:      "width 1.3s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            ) : (
              <div className="h-full w-1/3 bg-white/5 rounded-full animate-pulse" />
            )}
          </div>
          <StarSVG fillPercent={animPct} color={color} />
        </div>

        {hasData && (
          <p className="text-xs text-white/50">
            {attendedCount} de {expectedCount} clases este mes
          </p>
        )}
        <p className="text-xs italic" style={{ color: hasData ? `${color}cc` : "rgba(255,255,255,0.4)" }}>
          {message}
        </p>
      </div>
    );
  }

  // ── Full card mode ─────────────────────────────────────────────────────────
  return (
    <div className="card space-y-3 border-dojo-border/80">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-dojo-white flex items-center gap-2">
          <span aria-hidden>⭐</span>
          Disciplina del Mes
        </p>
        {hasData ? (
          <span
            className="text-xl font-bold font-display tabular-nums leading-none"
            style={{ color, transition: "color 0.6s ease" }}
          >
            {animPct}%
          </span>
        ) : (
          <span className="text-xs text-dojo-muted italic">Sin horario asignado</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-4 bg-dojo-border rounded-full overflow-hidden">
          {hasData ? (
            <div
              className="h-full rounded-full"
              style={{
                width:           `${barPct}%`,
                backgroundColor: color,
                boxShadow:       glow,
                transition:      "width 1.3s cubic-bezier(0.4,0,0.2,1), box-shadow 1.3s ease",
              }}
            />
          ) : (
            <div className="h-full w-0 rounded-full" />
          )}
        </div>
        <StarSVG fillPercent={animPct} color={color} size="w-9 h-9" />
      </div>

      {hasData && (
        <p className="text-xs text-dojo-muted">
          <span className="font-semibold" style={{ color }}>{attendedCount}</span>
          {" "}de{" "}
          <span className="font-semibold text-dojo-white">{expectedCount}</span>
          {" "}entrenamientos realizados este mes
        </p>
      )}

      <p className="text-xs leading-relaxed" style={{ color: hasData ? color : "#6b7280" }}>
        {message}
      </p>
    </div>
  );
}

// ── Portal self-fetching loader ───────────────────────────────────────────────

export function DisciplineBarPortal() {
  const [items,   setItems]   = useState<DisciplineData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/monthly-discipline")
      .then(r => r.ok ? (r.json() as Promise<DisciplineData[]>) : [])
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-dojo-border/60 rounded w-36" />
          <div className="h-5 bg-dojo-border/40 rounded w-12" />
        </div>
        <div className="h-4 bg-dojo-border/40 rounded-full" />
        <div className="h-3 bg-dojo-border/30 rounded w-52" />
      </div>
    );
  }

  if (!items.length) return null;

  if (items.length === 1) return <DisciplineBar data={items[0]!} />;

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-dojo-muted uppercase tracking-wider px-1">
        Disciplina del Mes — Familia
      </p>
      {items.map(item => (
        <div key={item.studentId} className="space-y-1">
          <p className="text-xs font-semibold text-dojo-muted px-1">{item.fullName}</p>
          <DisciplineBar data={item} />
        </div>
      ))}
    </div>
  );
}

// ── Hero card star — inline, below the photo in portal ───────────────────────

function DisciplineHeroInner({ data }: { data: DisciplineData }) {
  const { percentage, expectedCount, attendedCount, message, status } = data;
  const target  = percentage ?? 0;
  const animPct = useAnimatedCounter(target);
  const color   = barColor(status);
  const hasData = expectedCount > 0;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-t border-dojo-border/60"
      style={{ background: `${color}08` }}
    >
      <StarSVG fillPercent={animPct} color={color} size="w-10 h-10" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-dojo-muted uppercase tracking-wide font-semibold">
            Disciplina del Mes
          </p>
          <span
            className="text-base font-bold font-display tabular-nums leading-none"
            style={{ color }}
          >
            {animPct}%
          </span>
        </div>
        {hasData ? (
          <p className="text-xs mt-0.5" style={{ color: `${color}bb` }}>
            {attendedCount} de {expectedCount} clases · {message}
          </p>
        ) : (
          <p className="text-xs text-dojo-muted mt-0.5">{message}</p>
        )}
      </div>
    </div>
  );
}

export function DisciplineStarHero() {
  const [items,   setItems]   = useState<DisciplineData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/monthly-discipline")
      .then(r => r.ok ? (r.json() as Promise<DisciplineData[]>) : [])
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-t border-dojo-border/60 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-dojo-border/40 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 bg-dojo-border/40 rounded w-28" />
          <div className="h-2 bg-dojo-border/30 rounded w-44" />
        </div>
      </div>
    );
  }

  if (!items.length || !items[0]) return null;

  // Para familia: mostrar solo el primer alumno en el hero
  return <DisciplineHeroInner data={items[0]} />;
}

// ── Scanner discipline loader (fetches by studentId, compact mode) ─────────────

export function DisciplineBarScanner({ studentId }: { studentId: string }) {
  const [data,    setData]    = useState<DisciplineData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    fetch(`/api/students/${studentId}/monthly-discipline`)
      .then(r => r.ok ? (r.json() as Promise<DisciplineData>) : null)
      .then(d  => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="w-full space-y-1.5 animate-pulse px-1">
        <div className="h-2.5 bg-white/10 rounded-full" />
        <div className="h-2 bg-white/5 rounded w-32" />
      </div>
    );
  }

  if (!data) return null;
  return <DisciplineBar data={data} compact />;
}
