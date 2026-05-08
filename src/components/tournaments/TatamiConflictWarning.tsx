"use client";
import { AlertTriangle } from "lucide-react";

interface ConflictingBracket {
  name:        string;
  scheduledAt: string | null;
  tatami:      number | null;
}

interface Props {
  conflictingBracket: ConflictingBracket;
  onForce:  () => void;
  onCancel: () => void;
}

export function TatamiConflictWarning({ conflictingBracket, onForce, onCancel }: Props) {
  const hora = conflictingBracket.scheduledAt
    ? new Intl.DateTimeFormat("es-PA", {
        timeZone: "America/Panama",
        hour:     "2-digit",
        minute:   "2-digit",
        hour12:   true,
      }).format(new Date(conflictingBracket.scheduledAt))
    : "hora no definida";

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-yellow-300">Conflicto de Tatami</p>
          <p className="text-xs text-yellow-200/80 mt-0.5">
            <span className="font-semibold">{conflictingBracket.name}</span> está en{" "}
            Tatami {conflictingBracket.tatami} a las {hora}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="btn-secondary text-xs flex-1 py-1.5">
          Cancelar
        </button>
        <button
          onClick={onForce}
          className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg
                     bg-yellow-600 hover:bg-yellow-500 text-white transition-colors"
        >
          Guardar de todos modos
        </button>
      </div>
    </div>
  );
}
