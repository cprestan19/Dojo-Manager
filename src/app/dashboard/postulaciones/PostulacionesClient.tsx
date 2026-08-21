"use client";
import { useState } from "react";
import Link from "next/link";
import { FileText, Plus, Users, CheckCircle, XCircle, Clock, Archive, Pencil, Trash2, History } from "lucide-react";
import { useDojoTimeZone, useDojoCurrency } from "@/lib/hooks/useDojo";
import { formatCurrency } from "@/lib/currency";
import { isExamApplicationHistoric } from "@/lib/timezone";

interface PostulacionItem {
  id:            string;
  title:         string;
  location:      string;
  examDate:      Date | string;
  examTime:      string;
  deadline:      Date | string | null;
  amount:        number;
  status:        string;
  archivedAt:    Date | string | null;
  createdAt:     Date | string;
  totalInvitees: number;
  accepted:      number;
  rejected:      number;
  pending:       number;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT:     "Borrador",
  PUBLISHED: "Publicada",
  CLOSED:    "Cerrada",
  FINALIZED: "Finalizada",
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT:     "bg-dojo-border text-dojo-muted",
  PUBLISHED: "bg-green-900/40 text-green-400 border border-green-800/50",
  CLOSED:    "bg-orange-900/40 text-orange-400 border border-orange-800/50",
  FINALIZED: "bg-blue-900/40 text-blue-400 border border-blue-800/50",
};

// examDate/deadline son fechas puras (sin hora — vienen de <input type="date">, guardadas
// como medianoche UTC). Se formatean con los componentes UTC directos, SIN convertir a
// ninguna zona horaria: aplicar una zona con offset negativo (todo el continente americano)
// mostraría el día anterior al que realmente se guardó.
function fmtDate(val: Date | string | null): string {
  if (!val) return "—";
  const d = new Date(val);
  const day   = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleDateString("es-PA", { month: "short", timeZone: "UTC" });
  const year  = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

// Pasa a "historial" el día calendario siguiente a su fecha límite de
// respuesta (o si no tiene deadline, cuando ya pasó la fecha del examen) —
// comparado por día calendario del dojo, ver isExamApplicationHistoric().
function isHistory(item: PostulacionItem, tz: string): boolean {
  if (item.archivedAt) return true;
  return isExamApplicationHistoric(item.deadline, item.examDate, tz);
}

export default function PostulacionesClient({ initialData }: { initialData: PostulacionItem[] }) {
  const tz                          = useDojoTimeZone();
  const currency                    = useDojoCurrency();
  const [items, setItems]           = useState<PostulacionItem[]>(initialData);
  const [tab, setTab]               = useState<"active" | "history">("active");
  const [search, setSearch]         = useState("");
  const [confirmDelete, setConfirmDelete] = useState<PostulacionItem | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<PostulacionItem | null>(null);
  const [busy, setBusy]             = useState(false);
  const [feedback, setFeedback]     = useState("");

  async function reload() {
    const res = await fetch("/api/exam-applications");
    if (res.ok) setItems(await res.json() as PostulacionItem[]);
  }

  const listed = items
    .filter(i => (tab === "active" ? !isHistory(i, tz) : isHistory(i, tz)))
    .filter(i => {
      if (!search) return true;
      return (
        i.title.toLowerCase().includes(search.toLowerCase()) ||
        i.location.toLowerCase().includes(search.toLowerCase())
      );
    });

  async function handleArchive(item: PostulacionItem) {
    setBusy(true);
    try {
      const res = await fetch(`/api/exam-applications/${item.id}/archive`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setFeedback(d.error ?? "Error al archivar");
      } else {
        setFeedback("Postulación movida a historial.");
        await reload();
      }
    } finally {
      setBusy(false);
      setConfirmArchive(null);
    }
  }

  async function handleDelete(item: PostulacionItem) {
    setBusy(true);
    try {
      const res = await fetch(`/api/exam-applications/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setFeedback(d.error ?? "Error al eliminar");
      } else {
        setFeedback("Postulación eliminada.");
        await reload();
      }
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-dojo-gold" />
          <h1 className="text-xl font-display font-bold text-dojo-white">Postulaciones de Examen</h1>
        </div>
        <Link href="/dashboard/postulaciones/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Nueva
        </Link>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-green-300 text-sm flex justify-between">
          <span>✓ {feedback}</span>
          <button onClick={() => setFeedback("")} className="text-green-400 hover:text-green-200 ml-4 text-xs">✕</button>
        </div>
      )}

      {/* Tabs Activas / Historial */}
      <div className="flex border-b border-dojo-border">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "active"
              ? "border-dojo-red text-dojo-white"
              : "border-transparent text-dojo-muted hover:text-dojo-white"
          }`}
        >
          Activas
          <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-dojo-border text-dojo-muted">
            {items.filter(i => !isHistory(i, tz)).length}
          </span>
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "history"
              ? "border-dojo-red text-dojo-white"
              : "border-transparent text-dojo-muted hover:text-dojo-white"
          }`}
        >
          <History size={14} /> Historial
          <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-dojo-border text-dojo-muted">
            {items.filter(i => isHistory(i, tz)).length}
          </span>
        </button>
      </div>

      {/* Búsqueda */}
      <input
        type="text"
        placeholder="Buscar por título o lugar..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="form-input text-sm w-full max-w-sm"
      />

      {/* Lista */}
      {listed.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center space-y-3">
          {tab === "active" ? (
            <>
              <FileText size={40} className="text-dojo-border" />
              <p className="text-dojo-muted font-medium">No hay postulaciones activas</p>
              <Link href="/dashboard/postulaciones/new" className="btn-primary text-sm">
                Crear primera postulación
              </Link>
            </>
          ) : (
            <>
              <History size={40} className="text-dojo-border" />
              <p className="text-dojo-muted font-medium">El historial está vacío</p>
              <p className="text-dojo-muted text-sm">Las postulaciones pasadas o archivadas aparecerán aquí.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {listed.map(item => {
            const inHistory = isHistory(item, tz);
            return (
              <div key={item.id} className={`card transition-colors ${
                inHistory ? "opacity-80" : "hover:border-dojo-gold/30"
              }`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">🥋</span>
                      <h3 className="font-semibold text-dojo-white truncate">{item.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_BADGE[item.status] ?? "badge-blue"}`}>
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                      {item.archivedAt && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-dojo-border text-dojo-muted shrink-0 flex items-center gap-1">
                          <Archive size={10} /> Archivada
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-dojo-muted">
                      📍 {item.location} &nbsp;·&nbsp;
                      📅 {fmtDate(item.examDate)} a las {item.examTime}
                      {item.amount > 0 && ` · ${formatCurrency(item.amount, currency)}`}
                    </p>
                    {item.deadline && (
                      <p className="text-xs text-dojo-muted">
                        Límite de respuesta: {fmtDate(item.deadline)}
                      </p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dashboard/postulaciones/${item.id}`}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Ver
                    </Link>
                    <Link
                      href={`/dashboard/postulaciones/${item.id}/edit`}
                      className="p-1.5 rounded-lg text-dojo-muted hover:text-dojo-white hover:bg-dojo-border transition-colors"
                      title="Editar"
                    >
                      <Pencil size={15} />
                    </Link>
                    {!inHistory && (
                      <button
                        onClick={() => setConfirmArchive(item)}
                        className="p-1.5 rounded-lg text-dojo-muted hover:text-orange-400 hover:bg-orange-900/20 transition-colors"
                        title="Archivar"
                      >
                        <Archive size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDelete(item)}
                      className="p-1.5 rounded-lg text-dojo-muted hover:text-dojo-red hover:bg-dojo-red/10 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Contadores */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-dojo-border flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-dojo-muted">
                    <Users size={12} /> {item.totalInvitees} invitados
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-green-400">
                    <CheckCircle size={12} /> {item.accepted} aceptaron
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-red-400">
                    <XCircle size={12} /> {item.rejected} rechazaron
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-dojo-muted">
                    <Clock size={12} /> {item.pending} pendientes
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal confirmar archivar */}
      {confirmArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-900/30 flex items-center justify-center">
                <Archive size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="font-semibold text-dojo-white">Archivar postulación</p>
                <p className="text-xs text-dojo-muted">Se moverá al historial</p>
              </div>
            </div>
            <p className="text-sm text-dojo-muted">
              ¿Mover <span className="text-dojo-white font-medium">"{confirmArchive.title}"</span> al historial?
              Esta acción no elimina los datos.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmArchive(null)} className="btn-secondary flex-1 text-sm" disabled={busy}>
                Cancelar
              </button>
              <button
                onClick={() => handleArchive(confirmArchive)}
                className="flex-1 text-sm bg-orange-700 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                disabled={busy}
              >
                {busy ? "Archivando..." : "Sí, archivar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-dojo-red/10 flex items-center justify-center">
                <Trash2 size={20} className="text-dojo-red" />
              </div>
              <div>
                <p className="font-semibold text-dojo-white">Eliminar postulación</p>
                <p className="text-xs text-red-400">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-dojo-muted">
              ¿Eliminar definitivamente{" "}
              <span className="text-dojo-white font-medium">"{confirmDelete.title}"</span>?
              Se borrarán todos los invitados y respuestas asociadas.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1 text-sm" disabled={busy}>
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="btn-primary flex-1 text-sm bg-dojo-red hover:bg-red-700"
                disabled={busy}
              >
                {busy ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
