"use client";
import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  TOURNAMENT_STATUS, JUDGE_ROLES, SCHEDULE_EVENT_TYPES, getTournamentStatusFlow,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Edit2, Check, X, ChevronUp, ChevronDown,
  AlertTriangle, Users, Calendar, MapPin, Globe, Link,
} from "lucide-react";

interface Tatami {
  id: string;
  name: string;
  color: string;
  order: number;
  active: boolean;
  _count?: { judges: number; scheduleSlots: number };
}

interface Judge {
  id: string;
  name: string;
  role: string;
  tatamiId: string | null;
  licenseNo: string | null;
  nationality: string | null;
  active: boolean;
  tatami: { id: string; name: string; color: string } | null;
}

interface ScheduleSlot {
  id: string;
  startTime: string;
  endTime: string | null;
  eventType: string;
  title: string;
  description: string | null;
  tatamiId: string | null;
  order: number;
  tatami: { id: string; name: string; color: string } | null;
}

interface Registration {
  id: string;
  studentId: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
  guestDojo: string | null;
  guestBelt: string | null;
  categories: string;
  status: string;
  createdAt: string;
  student: { fullName: string; studentCode: number | null } | null;
}

type SubTab = "general" | "registrations" | "tatamis" | "schedule";

interface Props {
  tournamentId: string;
  tournament: {
    id: string;
    name: string;
    status: string;
    venue?: string | null;
    city?: string | null;
    country?: string | null;
    maxParticipants?: number | null;
    isPublic?: boolean;
    publicSlug?: string | null;
    organizerName?: string | null;
    organizerEmail?: string | null;
    organizerPhone?: string | null;
    rules?: string | null;
  };
  onRefresh: () => void;
}

function SubTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
        active
          ? "border-dojo-gold text-dojo-gold"
          : "border-transparent text-dojo-muted hover:text-dojo-white hover:border-dojo-border",
      )}
    >
      {children}
    </button>
  );
}

export function TournamentSettings({ tournamentId, tournament, onRefresh }: Props) {
  const { show: showToast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>("general");

  const [tatamis, setTatamis]         = useState<Tatami[]>([]);
  const [judges, setJudges]           = useState<Judge[]>([]);
  const [slots, setSlots]             = useState<ScheduleSlot[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  const [saving, setSaving] = useState(false);
  const [generalForm, setGeneralForm] = useState({
    venue: tournament.venue ?? "",
    city: tournament.city ?? "",
    country: tournament.country ?? "",
    maxParticipants: tournament.maxParticipants?.toString() ?? "",
    organizerName: tournament.organizerName ?? "",
    organizerEmail: tournament.organizerEmail ?? "",
    organizerPhone: tournament.organizerPhone ?? "",
    rules: tournament.rules ?? "",
    isPublic: tournament.isPublic ?? false,
    publicSlug: tournament.publicSlug ?? "",
  });

  const [showCloseModal, setShowCloseModal]   = useState(false);
  const [closeConfirmed, setCloseConfirmed]   = useState(false);
  const [changingStatus, setChangingStatus]   = useState(false);

  const [showJudgeModal, setShowJudgeModal]   = useState(false);
  const [editingJudge, setEditingJudge]       = useState<Judge | null>(null);
  const [judgeForm, setJudgeForm] = useState({ name: "", role: "judge", tatamiId: "", licenseNo: "", nationality: "" });
  const [savingJudge, setSavingJudge]         = useState(false);

  const [showSlotModal, setShowSlotModal]     = useState(false);
  const [editingSlot, setEditingSlot]         = useState<ScheduleSlot | null>(null);
  const [slotForm, setSlotForm] = useState({ startTime: "", endTime: "", eventType: "kumite", title: "", description: "", tatamiId: "" });
  const [savingSlot, setSavingSlot]           = useState(false);

  const [newTatamiName, setNewTatamiName]     = useState("");
  const [newTatamiColor, setNewTatamiColor]   = useState("#C0392B");
  const [addingTatami, setAddingTatami]       = useState(false);

  const loadTatamis = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${tournamentId}/tatami`);
    if (res.ok) setTatamis(await res.json());
  }, [tournamentId]);

  const loadJudges = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${tournamentId}/judges`);
    if (res.ok) setJudges(await res.json());
  }, [tournamentId]);

  const loadSlots = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${tournamentId}/schedule`);
    if (res.ok) setSlots(await res.json());
  }, [tournamentId]);

  const loadRegistrations = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${tournamentId}/registrations`);
    if (res.ok) setRegistrations(await res.json());
  }, [tournamentId]);

  useEffect(() => {
    if (subTab === "tatamis") { loadTatamis(); loadJudges(); }
    if (subTab === "schedule") loadSlots();
    if (subTab === "registrations") loadRegistrations();
  }, [subTab, loadTatamis, loadJudges, loadSlots, loadRegistrations]);

  async function handleSaveGeneral() {
    setSaving(true);
    try {
      let slug = generalForm.publicSlug;
      if (generalForm.isPublic && !slug) {
        slug = tournament.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60) + "-" + Date.now().toString(36);
        setGeneralForm(p => ({ ...p, publicSlug: slug }));
      }

      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue: generalForm.venue || null,
          city: generalForm.city || null,
          country: generalForm.country || null,
          maxParticipants: generalForm.maxParticipants ? parseInt(generalForm.maxParticipants) : null,
          organizerName: generalForm.organizerName || null,
          organizerEmail: generalForm.organizerEmail || null,
          organizerPhone: generalForm.organizerPhone || null,
          rules: generalForm.rules || null,
          isPublic: generalForm.isPublic,
          publicSlug: slug || null,
        }),
      });
      if (res.ok) {
        showToast("Configuración guardada exitosamente");
        onRefresh();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast((d as { error?: string }).error ?? "Error al guardar", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setChangingStatus(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(`Estado cambiado a: ${TOURNAMENT_STATUS[newStatus as keyof typeof TOURNAMENT_STATUS]?.label ?? newStatus}`);
        onRefresh();
        setShowCloseModal(false);
        setCloseConfirmed(false);
      } else {
        const d = await res.json().catch(() => ({}));
        showToast((d as { error?: string }).error ?? "Error al cambiar estado", "error");
      }
    } finally {
      setChangingStatus(false);
    }
  }

  async function handleAddTatami() {
    if (!newTatamiName.trim()) return;
    setAddingTatami(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/tatami`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTatamiName.trim(), color: newTatamiColor }),
      });
      if (res.ok) {
        setNewTatamiName("");
        setNewTatamiColor("#C0392B");
        loadTatamis();
        showToast("Tatami agregado");
      } else {
        const d = await res.json().catch(() => ({}));
        showToast((d as { error?: string }).error ?? "Error al agregar tatami", "error");
      }
    } finally {
      setAddingTatami(false);
    }
  }

  async function handleDeleteTatami(id: string) {
    if (!confirm("¿Eliminar este tatami?")) return;
    const res = await fetch(`/api/tournaments/${tournamentId}/tatami/${id}`, { method: "DELETE" });
    if (res.ok) { loadTatamis(); showToast("Tatami eliminado"); }
    else {
      const d = await res.json().catch(() => ({}));
      showToast((d as { error?: string }).error ?? "Error al eliminar", "error");
    }
  }

  async function handleSaveJudge() {
    if (!judgeForm.name.trim()) return;
    setSavingJudge(true);
    try {
      const url = editingJudge
        ? `/api/tournaments/${tournamentId}/judges/${editingJudge.id}`
        : `/api/tournaments/${tournamentId}/judges`;
      const method = editingJudge ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: judgeForm.name.trim(),
          role: judgeForm.role,
          tatamiId: judgeForm.tatamiId || null,
          licenseNo: judgeForm.licenseNo || null,
          nationality: judgeForm.nationality || null,
        }),
      });
      if (res.ok) {
        loadJudges();
        setShowJudgeModal(false);
        setEditingJudge(null);
        setJudgeForm({ name: "", role: "judge", tatamiId: "", licenseNo: "", nationality: "" });
        showToast(editingJudge ? "Juez actualizado" : "Juez agregado");
      } else {
        const d = await res.json().catch(() => ({}));
        showToast((d as { error?: string }).error ?? "Error", "error");
      }
    } finally {
      setSavingJudge(false);
    }
  }

  async function handleDeleteJudge(id: string) {
    if (!confirm("¿Eliminar este juez?")) return;
    const res = await fetch(`/api/tournaments/${tournamentId}/judges/${id}`, { method: "DELETE" });
    if (res.ok) { loadJudges(); showToast("Juez eliminado"); }
    else {
      const d = await res.json().catch(() => ({}));
      showToast((d as { error?: string }).error ?? "Error al eliminar", "error");
    }
  }

  async function handleSaveSlot() {
    if (!slotForm.startTime || !slotForm.title.trim()) return;
    setSavingSlot(true);
    try {
      const url = editingSlot
        ? `/api/tournaments/${tournamentId}/schedule/${editingSlot.id}`
        : `/api/tournaments/${tournamentId}/schedule`;
      const method = editingSlot ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: slotForm.startTime,
          endTime: slotForm.endTime || null,
          eventType: slotForm.eventType,
          title: slotForm.title.trim(),
          description: slotForm.description || null,
          tatamiId: slotForm.tatamiId || null,
        }),
      });
      if (res.ok) {
        loadSlots();
        setShowSlotModal(false);
        setEditingSlot(null);
        setSlotForm({ startTime: "", endTime: "", eventType: "kumite", title: "", description: "", tatamiId: "" });
        showToast(editingSlot ? "Evento actualizado" : "Evento agregado");
      } else {
        const d = await res.json().catch(() => ({}));
        showToast((d as { error?: string }).error ?? "Error", "error");
      }
    } finally {
      setSavingSlot(false);
    }
  }

  async function handleDeleteSlot(id: string) {
    if (!confirm("¿Eliminar este evento?")) return;
    const res = await fetch(`/api/tournaments/${tournamentId}/schedule/${id}`, { method: "DELETE" });
    if (res.ok) { loadSlots(); showToast("Evento eliminado"); }
    else {
      const d = await res.json().catch(() => ({}));
      showToast((d as { error?: string }).error ?? "Error al eliminar", "error");
    }
  }

  async function handleMoveSlot(idx: number, dir: "up" | "down") {
    const newSlots = [...slots];
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= newSlots.length) return;
    [newSlots[idx], newSlots[target]] = [newSlots[target], newSlots[idx]];
    const reordered = newSlots.map((s, i) => ({ ...s, order: i }));
    setSlots(reordered);
    await fetch(`/api/tournaments/${tournamentId}/schedule/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: reordered.map(s => ({ id: s.id, order: s.order })) }),
    });
  }

  async function handleRegStatus(regId: string, newStatus: string) {
    const res = await fetch(`/api/tournaments/${tournamentId}/registrations/${regId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) { loadRegistrations(); showToast("Estado actualizado"); }
    else {
      const d = await res.json().catch(() => ({}));
      showToast((d as { error?: string }).error ?? "Error", "error");
    }
  }

  async function handleDeleteReg(regId: string) {
    if (!confirm("¿Eliminar esta inscripción?")) return;
    const res = await fetch(`/api/tournaments/${tournamentId}/registrations/${regId}`, { method: "DELETE" });
    if (res.ok) { loadRegistrations(); showToast("Inscripción eliminada"); }
    else {
      const d = await res.json().catch(() => ({}));
      showToast((d as { error?: string }).error ?? "Error al eliminar", "error");
    }
  }

  function exportCSV() {
    const headers = ["Nombre", "Dojo", "Categorías", "Estado", "Fecha"];
    const rows = registrations.map(r => {
      const name = r.student?.fullName ?? `${r.guestFirstName ?? ""} ${r.guestLastName ?? ""}`.trim();
      const cats = (() => { try { return JSON.parse(r.categories).join("; "); } catch { return r.categories; } })();
      return [name, r.guestDojo ?? "", cats, r.status, r.createdAt?.slice(0, 10) ?? ""].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscripciones-${tournamentId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const transitions = getTournamentStatusFlow(tournament.status);
  const statusInfo = TOURNAMENT_STATUS[tournament.status as keyof typeof TOURNAMENT_STATUS];
  const publicUrl = generalForm.publicSlug ? `${typeof window !== "undefined" ? window.location.origin : ""}/public/tournament/${generalForm.publicSlug}` : null;

  const regByStatus = {
    pending:  registrations.filter(r => r.status === "pending").length,
    approved: registrations.filter(r => r.status === "approved").length,
    rejected: registrations.filter(r => r.status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-dojo-border flex gap-0 overflow-x-auto">
        <SubTabButton active={subTab === "general"} onClick={() => setSubTab("general")}>
          <MapPin size={14} className="inline mr-1" /> General
        </SubTabButton>
        <SubTabButton active={subTab === "registrations"} onClick={() => setSubTab("registrations")}>
          <Users size={14} className="inline mr-1" /> Inscripciones ({registrations.length})
        </SubTabButton>
        <SubTabButton active={subTab === "tatamis"} onClick={() => setSubTab("tatamis")}>
          <Globe size={14} className="inline mr-1" /> Tatamis &amp; Jueces
        </SubTabButton>
        <SubTabButton active={subTab === "schedule"} onClick={() => setSubTab("schedule")}>
          <Calendar size={14} className="inline mr-1" /> Programa
        </SubTabButton>
      </div>

      {subTab === "general" && (
        <div className="space-y-4 max-w-2xl">
          <div className="card space-y-4">
            <p className="text-xs text-dojo-muted uppercase tracking-wider font-semibold">Sede del Evento</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="form-label">Venue / Instalación</label>
                <input className="form-input" value={generalForm.venue} placeholder="Ej. Gimnasio Nacional"
                  onChange={e => setGeneralForm(p => ({ ...p, venue: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Ciudad</label>
                <input className="form-input" value={generalForm.city}
                  onChange={e => setGeneralForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">País</label>
                <input className="form-input" value={generalForm.country}
                  onChange={e => setGeneralForm(p => ({ ...p, country: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Máx. Participantes</label>
                <input type="number" className="form-input" value={generalForm.maxParticipants}
                  onChange={e => setGeneralForm(p => ({ ...p, maxParticipants: e.target.value }))} min={1} />
              </div>
            </div>

            <p className="text-xs text-dojo-muted uppercase tracking-wider font-semibold pt-2 border-t border-dojo-border">Organizador</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="form-label">Nombre del Organizador</label>
                <input className="form-input" value={generalForm.organizerName}
                  onChange={e => setGeneralForm(p => ({ ...p, organizerName: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Email Organizador</label>
                <input type="email" className="form-input" value={generalForm.organizerEmail}
                  onChange={e => setGeneralForm(p => ({ ...p, organizerEmail: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Teléfono Organizador</label>
                <input className="form-input" value={generalForm.organizerPhone}
                  onChange={e => setGeneralForm(p => ({ ...p, organizerPhone: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="form-label">Reglamento / Reglas</label>
              <textarea rows={4} className="form-input resize-none" value={generalForm.rules}
                onChange={e => setGeneralForm(p => ({ ...p, rules: e.target.value }))}
                placeholder="Reglas del torneo, sistema de puntuación, etc." />
            </div>

            <div className="pt-2 border-t border-dojo-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-dojo-white">Página Pública</p>
                  <p className="text-xs text-dojo-muted mt-0.5">Permitir que el torneo sea visible públicamente con un enlace</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGeneralForm(p => ({ ...p, isPublic: !p.isPublic }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    generalForm.isPublic ? "bg-dojo-gold" : "bg-dojo-border",
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    generalForm.isPublic ? "translate-x-6" : "translate-x-1",
                  )} />
                </button>
              </div>
              {generalForm.isPublic && publicUrl && (
                <div className="mt-3 flex items-center gap-2 p-2 bg-green-900/20 border border-green-700/30 rounded-lg">
                  <Link size={14} className="text-green-400 flex-shrink-0" />
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-green-400 hover:underline truncate">{publicUrl}</a>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={handleSaveGeneral} className="btn-primary" disabled={saving}>
                {saving ? "Guardando..." : "Guardar Configuración"}
              </button>
            </div>
          </div>
        </div>
      )}

      {subTab === "registrations" && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-dojo-white">Estado del Torneo</p>
                <div className={cn("inline-flex items-center gap-2 mt-1 px-3 py-1 rounded-full text-sm font-medium border",
                  statusInfo?.bg, statusInfo?.text, statusInfo?.border)}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusInfo?.color }} />
                  {statusInfo?.label ?? tournament.status}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {transitions.map(t => {
                  const info = TOURNAMENT_STATUS[t as keyof typeof TOURNAMENT_STATUS];
                  const isClose = t === "registration_closed";
                  return (
                    <button
                      key={t}
                      disabled={changingStatus}
                      onClick={() => isClose ? setShowCloseModal(true) : handleStatusChange(t)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                        isClose
                          ? "border-red-600/50 text-red-400 hover:bg-red-900/20"
                          : "border-dojo-border text-dojo-muted hover:text-dojo-white hover:border-dojo-border/70",
                      )}
                    >
                      {info?.label ?? t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/30">
                <p className="text-xl font-bold text-yellow-400">{regByStatus.pending}</p>
                <p className="text-xs text-dojo-muted">Pendientes</p>
              </div>
              <div className="p-3 rounded-lg bg-green-900/20 border border-green-700/30">
                <p className="text-xl font-bold text-green-400">{regByStatus.approved}</p>
                <p className="text-xs text-dojo-muted">Aprobadas</p>
              </div>
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-700/30">
                <p className="text-xl font-bold text-red-400">{regByStatus.rejected}</p>
                <p className="text-xs text-dojo-muted">Rechazadas</p>
              </div>
            </div>
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-dojo-white">Inscripciones ({registrations.length})</p>
              {registrations.length > 0 && (
                <button onClick={exportCSV} className="btn-secondary text-xs">Exportar CSV</button>
              )}
            </div>
            {registrations.length === 0 ? (
              <p className="text-dojo-muted text-sm py-6 text-center">Sin inscripciones aún.</p>
            ) : (
              <div className="divide-y divide-dojo-border">
                {registrations.map(r => {
                  const name = r.student?.fullName ?? `${r.guestFirstName ?? ""} ${r.guestLastName ?? ""}`.trim();
                  const cats = (() => { try { return JSON.parse(r.categories).join(", "); } catch { return r.categories; } })();
                  return (
                    <div key={r.id} className="py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dojo-white truncate">{name || "Sin nombre"}</p>
                        <p className="text-xs text-dojo-muted">{r.guestDojo ?? "Dojo no especificado"} · {cats}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.status === "pending" && (
                          <>
                            <button onClick={() => handleRegStatus(r.id, "approved")}
                              className="p-1.5 rounded-lg hover:bg-green-900/20 text-green-400 transition-colors" title="Aprobar">
                              <Check size={14} />
                            </button>
                            <button onClick={() => handleRegStatus(r.id, "rejected")}
                              className="p-1.5 rounded-lg hover:bg-red-900/20 text-red-400 transition-colors" title="Rechazar">
                              <X size={14} />
                            </button>
                          </>
                        )}
                        {r.status === "approved" && <span className="text-[10px] badge-green">Aprobada</span>}
                        {r.status === "rejected" && <span className="text-[10px] badge-red">Rechazada</span>}
                        {r.status !== "approved" && (
                          <button onClick={() => handleDeleteReg(r.id)}
                            className="p-1.5 rounded-lg hover:bg-red-900/10 text-dojo-muted hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "tatamis" && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <p className="font-semibold text-dojo-white">Tatamis ({tatamis.length})</p>
            <div className="flex items-center gap-3">
              <input className="form-input flex-1" placeholder="Nombre del tatami..."
                value={newTatamiName} onChange={e => setNewTatamiName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddTatami()} />
              <input type="color" value={newTatamiColor}
                onChange={e => setNewTatamiColor(e.target.value)}
                className="h-9 w-12 rounded border border-dojo-border cursor-pointer bg-dojo-bg" />
              <button onClick={handleAddTatami} disabled={addingTatami || !newTatamiName.trim()} className="btn-primary flex items-center gap-1">
                <Plus size={15} /> Agregar
              </button>
            </div>
            {tatamis.length === 0 ? (
              <p className="text-dojo-muted text-sm text-center py-4">Sin tatamis registrados.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tatamis.map(t => (
                  <div key={t.id} className="p-3 rounded-lg border border-dojo-border bg-dojo-bg/50 flex items-center gap-3">
                    <div className="w-4 h-10 rounded" style={{ backgroundColor: t.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dojo-white truncate">{t.name}</p>
                      <p className="text-xs text-dojo-muted">{t._count?.judges ?? 0} jueces · {t._count?.scheduleSlots ?? 0} eventos</p>
                    </div>
                    <button onClick={() => handleDeleteTatami(t.id)}
                      className="p-1.5 rounded hover:bg-red-900/20 text-dojo-muted hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-dojo-white">Jueces ({judges.length})</p>
              <button onClick={() => { setEditingJudge(null); setJudgeForm({ name: "", role: "judge", tatamiId: "", licenseNo: "", nationality: "" }); setShowJudgeModal(true); }}
                className="btn-primary flex items-center gap-1 text-sm">
                <Plus size={14} /> Agregar Juez
              </button>
            </div>
            {judges.length === 0 ? (
              <p className="text-dojo-muted text-sm text-center py-4">Sin jueces registrados.</p>
            ) : (
              <div className="divide-y divide-dojo-border">
                {judges.map(j => {
                  const roleInfo = JUDGE_ROLES[j.role as keyof typeof JUDGE_ROLES];
                  return (
                    <div key={j.id} className="py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dojo-white truncate">{j.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn("text-xs font-medium", roleInfo?.color ?? "text-dojo-muted")}>
                            {roleInfo?.label ?? j.role}
                          </span>
                          {j.tatami && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-dojo-border text-dojo-muted">
                              {j.tatami.name}
                            </span>
                          )}
                          {j.nationality && <span className="text-xs text-dojo-muted">{j.nationality}</span>}
                        </div>
                      </div>
                      <button onClick={() => { setEditingJudge(j); setJudgeForm({ name: j.name, role: j.role, tatamiId: j.tatamiId ?? "", licenseNo: j.licenseNo ?? "", nationality: j.nationality ?? "" }); setShowJudgeModal(true); }}
                        className="p-1.5 rounded hover:bg-dojo-border text-dojo-muted hover:text-dojo-white transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDeleteJudge(j.id)}
                        className="p-1.5 rounded hover:bg-red-900/20 text-dojo-muted hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "schedule" && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-dojo-white">Programa del Evento ({slots.length} eventos)</p>
              <button onClick={() => { setEditingSlot(null); setSlotForm({ startTime: "", endTime: "", eventType: "kumite", title: "", description: "", tatamiId: "" }); setShowSlotModal(true); }}
                className="btn-primary flex items-center gap-1 text-sm">
                <Plus size={14} /> Agregar Evento
              </button>
            </div>
            {slots.length === 0 ? (
              <p className="text-dojo-muted text-sm text-center py-8">Sin eventos en el programa.</p>
            ) : (
              <div className="space-y-2">
                {slots.map((s, idx) => {
                  const evType = SCHEDULE_EVENT_TYPES[s.eventType as keyof typeof SCHEDULE_EVENT_TYPES];
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-dojo-border bg-dojo-bg/50">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => handleMoveSlot(idx, "up")} disabled={idx === 0}
                          className="p-0.5 rounded hover:bg-dojo-border text-dojo-muted disabled:opacity-30 transition-colors">
                          <ChevronUp size={12} />
                        </button>
                        <button onClick={() => handleMoveSlot(idx, "down")} disabled={idx === slots.length - 1}
                          className="p-0.5 rounded hover:bg-dojo-border text-dojo-muted disabled:opacity-30 transition-colors">
                          <ChevronDown size={12} />
                        </button>
                      </div>
                      <span className="text-lg">{evType?.icon ?? "📋"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dojo-white truncate">{s.title}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <span className="text-xs text-dojo-muted">{s.startTime}{s.endTime ? ` – ${s.endTime}` : ""}</span>
                          {s.tatami && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-dojo-muted"
                              style={{ borderColor: s.tatami.color + "60" }}>
                              {s.tatami.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => { setEditingSlot(s); setSlotForm({ startTime: s.startTime, endTime: s.endTime ?? "", eventType: s.eventType, title: s.title, description: s.description ?? "", tatamiId: s.tatamiId ?? "" }); setShowSlotModal(true); }}
                        className="p-1.5 rounded hover:bg-dojo-border text-dojo-muted hover:text-dojo-white transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDeleteSlot(s.id)}
                        className="p-1.5 rounded hover:bg-red-900/20 text-dojo-muted hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-dojo-card rounded-xl border border-dojo-border shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-semibold text-dojo-white">Cerrar Inscripciones</p>
                <p className="text-sm text-dojo-muted mt-1">
                  Esta acción cerrará las inscripciones. Los participantes ya no podrán inscribirse.
                  Esta acción quedará registrada en el log de auditoría.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none mb-4">
              <input type="checkbox" checked={closeConfirmed} onChange={e => setCloseConfirmed(e.target.checked)}
                className="w-4 h-4 accent-dojo-gold" />
              <span className="text-sm text-dojo-white">Entiendo que esta acción cerrará las inscripciones</span>
            </label>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowCloseModal(false); setCloseConfirmed(false); }} className="btn-secondary">Cancelar</button>
              <button onClick={() => handleStatusChange("registration_closed")}
                disabled={!closeConfirmed || changingStatus}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-40">
                {changingStatus ? "Cerrando..." : "Cerrar Inscripciones"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJudgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-dojo-card rounded-xl border border-dojo-border shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <p className="font-semibold text-dojo-white">{editingJudge ? "Editar Juez" : "Agregar Juez"}</p>
            <div className="space-y-3">
              <div>
                <label className="form-label">Nombre *</label>
                <input className="form-input" value={judgeForm.name}
                  onChange={e => setJudgeForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Rol</label>
                <select className="form-input" value={judgeForm.role}
                  onChange={e => setJudgeForm(p => ({ ...p, role: e.target.value }))}>
                  {Object.entries(JUDGE_ROLES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Tatami Asignado</label>
                <select className="form-input" value={judgeForm.tatamiId}
                  onChange={e => setJudgeForm(p => ({ ...p, tatamiId: e.target.value }))}>
                  <option value="">Sin tatami</option>
                  {tatamis.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">No. Licencia</label>
                  <input className="form-input" value={judgeForm.licenseNo}
                    onChange={e => setJudgeForm(p => ({ ...p, licenseNo: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Nacionalidad</label>
                  <input className="form-input" value={judgeForm.nationality}
                    onChange={e => setJudgeForm(p => ({ ...p, nationality: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowJudgeModal(false); setEditingJudge(null); }} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveJudge} disabled={savingJudge || !judgeForm.name.trim()} className="btn-primary">
                {savingJudge ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-dojo-card rounded-xl border border-dojo-border shadow-xl p-6 max-w-md w-full mx-4 space-y-4">
            <p className="font-semibold text-dojo-white">{editingSlot ? "Editar Evento" : "Agregar Evento"}</p>
            <div className="space-y-3">
              <div>
                <label className="form-label">Tipo de Evento</label>
                <select className="form-input" value={slotForm.eventType}
                  onChange={e => setSlotForm(p => ({ ...p, eventType: e.target.value }))}>
                  {Object.entries(SCHEDULE_EVENT_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Título *</label>
                <input className="form-input" value={slotForm.title}
                  onChange={e => setSlotForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Hora Inicio *</label>
                  <input type="time" className="form-input" value={slotForm.startTime}
                    onChange={e => setSlotForm(p => ({ ...p, startTime: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Hora Fin</label>
                  <input type="time" className="form-input" value={slotForm.endTime}
                    onChange={e => setSlotForm(p => ({ ...p, endTime: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Tatami</label>
                <select className="form-input" value={slotForm.tatamiId}
                  onChange={e => setSlotForm(p => ({ ...p, tatamiId: e.target.value }))}>
                  <option value="">Sin tatami específico</option>
                  {tatamis.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Descripción</label>
                <textarea rows={2} className="form-input resize-none" value={slotForm.description}
                  onChange={e => setSlotForm(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowSlotModal(false); setEditingSlot(null); }} className="btn-secondary">Cancelar</button>
              <button onClick={handleSaveSlot} disabled={savingSlot || !slotForm.title.trim() || !slotForm.startTime} className="btn-primary">
                {savingSlot ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
