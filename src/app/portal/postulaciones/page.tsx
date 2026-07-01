"use client";
import { useState, useEffect } from "react";
import { formatDate, getBeltInfo } from "@/lib/utils";
import { Loader2, FileText } from "lucide-react";

interface ApplicationInfo {
  id:          string;
  title:       string;
  location:    string;
  examDate:    string;
  examTime:    string;
  deadline:    string | null;
  amount:      number;
  status:      string;
  description: string | null;
}

interface ExamItem {
  application:   ApplicationInfo;
  inviteeId:     string;
  beltToPresent: string;
  response:      string;
  responseNote:  string | null;
  respondedAt:   string | null;
}

export default function PortalPostulacionesPage() {
  const [items,   setItems]   = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/exam-applications")
      .then(r => r.ok ? r.json() as Promise<ExamItem[]> : [])
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  async function respond(inviteeId: string, applicationId: string, response: "ACCEPTED" | "REJECTED", responseNote?: string) {
    const res = await fetch(`/api/exam-applications/${applicationId}/respond`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ response, responseNote }),
    });
    if (res.ok) {
      setItems(prev => prev.map(item =>
        item.inviteeId === inviteeId
          ? { ...item, response, responseNote: responseNote ?? null, respondedAt: new Date().toISOString() }
          : item
      ));
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 size={24} className="animate-spin text-dojo-gold" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 px-4">
        <FileText size={48} className="text-dojo-border" />
        <p className="text-dojo-white font-semibold text-lg">No tienes exámenes pendientes</p>
        <p className="text-dojo-muted text-sm">Cuando tu sensei te invite a un examen, aparecerá aquí.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <h1 className="font-display font-bold text-dojo-white text-xl">Exámenes</h1>
      {items.map(item => (
        <ExamCard key={item.inviteeId} item={item} onRespond={respond} />
      ))}
    </div>
  );
}

function ExamCard({
  item,
  onRespond,
}: {
  item: ExamItem;
  onRespond: (inviteeId: string, applicationId: string, response: "ACCEPTED" | "REJECTED", note?: string) => Promise<void>;
}) {
  const [localResponse, setLocalResponse] = useState<"ACCEPTED" | "REJECTED" | "">(
    item.response === "PENDING" ? "" : item.response as "ACCEPTED" | "REJECTED"
  );
  const [note,    setNote]    = useState(item.responseNote ?? "");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [editing, setEditing] = useState(false);

  const app      = item.application;
  const beltInfo = getBeltInfo(item.beltToPresent);
  const now      = new Date();
  const deadline = app.deadline ? new Date(app.deadline) : null;
  // Comparar sólo la parte de fecha en Panama (UTC-5).
  // El deadline "2026-07-01" guardado como medianoche UTC = 19:00 Panama del 30/jun,
  // lo cual expiría 7h antes del día real. Con en-CA obtenemos YYYY-MM-DD comparable.
  const toYMD    = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Panama" });
  const expired  = deadline ? toYMD(now) > toYMD(deadline) : false;
  const canRespond = (item.response === "PENDING" || editing) && !expired && app.status === "PUBLISHED";

  async function handleSubmit() {
    if (!localResponse) { setError("Selecciona una respuesta"); return; }
    if (localResponse === "REJECTED" && !note.trim()) { setError("El motivo es requerido al rechazar"); return; }
    setSaving(true);
    setError("");
    try {
      await onRespond(item.inviteeId, app.id, localResponse, note.trim() || undefined);
      setEditing(false);
    } catch {
      setError("Error al guardar la respuesta");
    } finally { setSaving(false); }
  }

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">🥋</span>
            <h2 className="font-semibold text-dojo-white text-sm">{app.title}</h2>
          </div>
          <p className="text-xs text-dojo-muted mt-1">
            📍 {app.location} · 📅 {formatDate(app.examDate)} {app.examTime}
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: beltInfo.hex + "25", color: beltInfo.hex === "#FFFFFF" ? "#ccc" : beltInfo.hex, border: `1px solid ${beltInfo.hex}40` }}>
          {beltInfo.label}
        </span>
      </div>

      {app.amount > 0 && (
        <p className="text-sm text-dojo-gold font-semibold">Valor: ${app.amount.toFixed(2)}</p>
      )}
      {deadline && (
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg w-fit ${
          expired
            ? "bg-red-900/20 border border-red-800/40 text-red-400"
            : "bg-dojo-border/40 text-dojo-muted"
        }`}>
          <span>📅</span>
          {expired
            ? "Período de respuesta cerrado"
            : <>Fecha límite para responder: <strong className="text-dojo-white ml-1">{formatDate(app.deadline!)}</strong></>
          }
        </div>
      )}
      {app.description && <p className="text-xs text-dojo-muted">{app.description}</p>}

      {/* Estado / formulario */}
      {!canRespond && item.response !== "PENDING" && !editing ? (
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 text-sm font-medium ${
            item.response === "ACCEPTED" ? "text-green-400" : "text-red-400"
          }`}>
            {item.response === "ACCEPTED" ? "✓ Participaré" : "✗ No participaré"}
            {item.responseNote && <span className="text-dojo-muted font-normal text-xs">— {item.responseNote}</span>}
          </div>
          {!expired && app.status === "PUBLISHED" && (
            <button onClick={() => setEditing(true)} className="btn-ghost text-xs">Cambiar</button>
          )}
        </div>
      ) : canRespond ? (
        <div className="space-y-3">
          <div className="flex gap-3">
            <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border flex-1 justify-center transition-colors ${
              localResponse === "ACCEPTED" ? "border-green-500/50 bg-green-900/20 text-green-400" : "border-dojo-border text-dojo-muted hover:border-dojo-muted"
            }`}>
              <input type="radio" name={`resp_${item.inviteeId}`} value="ACCEPTED" checked={localResponse === "ACCEPTED"}
                onChange={() => setLocalResponse("ACCEPTED")} className="hidden" />
              <span className="text-sm">✓ Sí, deseo participar</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border flex-1 justify-center transition-colors ${
              localResponse === "REJECTED" ? "border-red-500/50 bg-red-900/20 text-red-400" : "border-dojo-border text-dojo-muted hover:border-dojo-muted"
            }`}>
              <input type="radio" name={`resp_${item.inviteeId}`} value="REJECTED" checked={localResponse === "REJECTED"}
                onChange={() => setLocalResponse("REJECTED")} className="hidden" />
              <span className="text-sm">✗ No participaré</span>
            </label>
          </div>
          {localResponse === "REJECTED" && (
            <textarea
              className="form-input text-sm min-h-16 resize-y w-full"
              placeholder="Motivo (requerido)..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          )}
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 justify-end">
            {editing && (
              <button onClick={() => { setEditing(false); setLocalResponse(item.response as "ACCEPTED" | "REJECTED"); }} className="btn-ghost text-sm">
                Cancelar
              </button>
            )}
            <button onClick={handleSubmit} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Guardar respuesta
            </button>
          </div>
        </div>
      ) : expired ? (
        <p className="text-xs text-dojo-muted bg-dojo-border/30 rounded-lg px-3 py-2">
          Período de respuesta cerrado
        </p>
      ) : null}
    </div>
  );
}
