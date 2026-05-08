"use client";
import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

let nextId = 1;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}

// ── Component ─────────────────────────────────────────────────────────────────

const STYLES: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg:     "bg-green-900/95",
    border: "border-green-600/50",
    icon:   <CheckCircle size={18} className="text-green-400 shrink-0" />,
  },
  error: {
    bg:     "bg-red-900/95",
    border: "border-red-600/50",
    icon:   <XCircle size={18} className="text-red-400 shrink-0" />,
  },
  info: {
    bg:     "bg-dojo-card/95",
    border: "border-dojo-border",
    icon:   <Info size={18} className="text-blue-400 shrink-0" />,
  },
};

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const s = STYLES[toast.type];

  useEffect(() => {
    // Tiny delay so the enter animation fires
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={[
        "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-sm",
        "transition-all duration-300 ease-out max-w-xs w-full",
        s.bg, s.border,
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
      ].join(" ")}
    >
      {s.icon}
      <p className="flex-1 text-sm font-medium text-white leading-snug">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="text-white/50 hover:text-white transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
