"use client";
import { useState } from "react";
import { Clock, Hash, Save } from "lucide-react";
import { TatamiConflictWarning } from "./TatamiConflictWarning";
import { useToast } from "@/components/ui/Toast";

interface ConflictData {
  name:        string;
  scheduledAt: string | null;
  tatami:      number | null;
}

interface Props {
  bracketId:          string;
  tournamentId:       string;
  initialTatami:      number | null;
  initialScheduledAt: string | null;
  onSaved:            () => void;
}

export function BracketScheduleForm({
  bracketId, tournamentId, initialTatami, initialScheduledAt, onSaved,
}: Props) {
  const { show: showToast } = useToast();

  // Convertir a formato datetime-local (yyyy-MM-ddTHH:mm)
  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toISOString().slice(0, 16);
  };

  const [tatami,      setTatami]      = useState<string>(initialTatami?.toString() ?? "");
  const [scheduledAt, setScheduledAt] = useState<string>(toLocalInput(initialScheduledAt));
  const [saving,      setSaving]      = useState(false);
  const [conflict,    setConflict]    = useState<ConflictData | null>(null);

  async function save(forceOverride = false) {
    setSaving(true);
    setConflict(null);
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/brackets/${bracketId}/schedule`,
        {
          method:  "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tatami:      tatami ? parseInt(tatami, 10) : null,
            scheduledAt: scheduledAt || null,
            forceOverride,
          }),
        },
      );

      if (res.status === 409) {
        const data = await res.json();
        setConflict(data.conflictingBracket);
        return;
      }

      if (res.ok) {
        showToast("Tatami y horario guardados");
        onSaved();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast((d as { error?: string }).error ?? "Error al guardar", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label flex items-center gap-1.5">
            <Hash size={12} /> Tatami
          </label>
          <input
            type="number"
            min={1}
            value={tatami}
            onChange={e => setTatami(e.target.value)}
            className="form-input"
            placeholder="Ej. 1"
          />
        </div>
        <div>
          <label className="form-label flex items-center gap-1.5">
            <Clock size={12} /> Horario
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="form-input"
          />
          <p className="text-[10px] text-dojo-muted mt-0.5">Hora en Panamá (UTC-5)</p>
        </div>
      </div>

      {conflict && (
        <TatamiConflictWarning
          conflictingBracket={conflict}
          onForce={() => save(true)}
          onCancel={() => setConflict(null)}
        />
      )}

      {!conflict && (
        <button
          onClick={() => save(false)}
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Save size={15} />
          {saving ? "Guardando..." : "Guardar Tatami y Horario"}
        </button>
      )}
    </div>
  );
}
