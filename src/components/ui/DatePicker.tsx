"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/** Fecha de hoy en Panamá (UTC-5) como YYYY-MM-DD. */
export function panamaTodayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });
}

function parseISO(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function toISO(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatDisplay(value: string): string {
  const p = parseISO(value);
  if (!p) return "";
  return `${String(p.d).padStart(2, "0")}/${String(p.m + 1).padStart(2, "0")}/${p.y}`;
}

interface DatePickerProps {
  /** Valor en formato YYYY-MM-DD (o "" para vacío) */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function DatePicker({ value, onChange, className, placeholder = "dd/mm/aaaa" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selected = parseISO(value);
  const today = parseISO(panamaTodayISO())!;
  const [viewY, setViewY] = useState(selected?.y ?? today.y);
  const [viewM, setViewM] = useState(selected?.m ?? today.m);

  useEffect(() => {
    if (!open) return;
    const p = parseISO(value);
    setViewY(p?.y ?? today.y);
    setViewM(p?.m ?? today.m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function selectDay(d: number) {
    onChange(toISO(viewY, viewM, d));
    setOpen(false);
  }

  function prevMonth() {
    if (viewM === 0) { setViewY(y => y - 1); setViewM(11); }
    else setViewM(m => m - 1);
  }
  function nextMonth() {
    if (viewM === 11) { setViewY(y => y + 1); setViewM(0); }
    else setViewM(m => m + 1);
  }

  const firstOfMonth = new Date(Date.UTC(viewY, viewM, 1));
  const startWeekday = (firstOfMonth.getUTCDay() + 6) % 7; // 0 = lunes
  const daysInMonth = new Date(Date.UTC(viewY, viewM + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        className={cn(
          "form-input flex items-center justify-between text-left",
          !value && "text-dojo-muted",
          className
        )}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
        <Calendar size={15} className="text-dojo-muted shrink-0 ml-2" />
      </button>

      {open && coords && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, minWidth: Math.max(coords.width, 260) }}
          className="z-[70] bg-dojo-card border border-dojo-border rounded-xl shadow-2xl p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="btn-ghost p-1.5">
              <ChevronLeft size={16} />
            </button>
            <span className="font-display text-dojo-white text-sm font-semibold">
              {MONTHS[viewM]} {viewY}
            </span>
            <button type="button" onClick={nextMonth} className="btn-ghost p-1.5">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-dojo-muted uppercase">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const isSelected = !!selected && selected.y === viewY && selected.m === viewM && selected.d === d;
              const isToday = today.y === viewY && today.m === viewM && today.d === d;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(d)}
                  className={cn(
                    "h-8 w-8 rounded-lg text-sm flex items-center justify-center transition-colors",
                    isSelected
                      ? "bg-dojo-red text-white font-semibold"
                      : isToday
                      ? "border border-dojo-gold text-dojo-gold"
                      : "text-dojo-white hover:bg-dojo-border"
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => { onChange(panamaTodayISO()); setOpen(false); }}
            className="w-full mt-2 text-xs text-dojo-muted hover:text-dojo-white text-center py-1.5 rounded-lg hover:bg-dojo-border transition-colors"
          >
            Hoy
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
