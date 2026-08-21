"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ClipboardCheck, Loader2, Plus, Users, Star, UserCog, Trash2 } from "lucide-react";

interface EvaluationRow {
  id: string;
  title: string;
  createdAt: string;
  _count: { links: number; criteria: number; evaluators: number };
}

export default function EvaluacionesPage() {
  const { data: session } = useSession();
  const role    = (session?.user as { role?: string } | undefined)?.role ?? "";
  const isAdmin = role === "admin" || role === "sysadmin";

  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [newTitle,    setNewTitle]    = useState("");
  const [creating,    setCreating]    = useState(false);
  const [error,       setError]       = useState("");
  const [confirmDel,  setConfirmDel]  = useState<EvaluationRow | null>(null);
  const [deleting,    setDeleting]    = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/evaluations");
    if (res.ok) setEvaluations(await res.json() as EvaluationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteEvaluation(ev: EvaluationRow) {
    setDeleteError("");
    setDeleting(true);
    try {
      const res = await fetch(`/api/evaluations/${ev.id}`, { method: "DELETE" });
      if (res.ok) { setConfirmDel(null); await load(); return; }
      const d = await res.json() as { error?: string };
      setDeleteError(d.error ?? "Error al eliminar");
    } finally { setDeleting(false); }
  }

  async function create() {
    setError("");
    const title = newTitle.trim();
    if (!title) { setError("Escribe un nombre"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/evaluations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const d = await res.json() as { id?: string; error?: string };
      if (!res.ok || !d.id) { setError(d.error ?? "Error al crear"); return; }
      window.location.href = `/dashboard/evaluaciones/${d.id}`;
    } finally { setCreating(false); }
  }

  if (loading) return <div className="p-6 flex justify-center"><Loader2 size={24} className="animate-spin text-dojo-gold" /></div>;

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-display font-bold text-dojo-white flex items-center gap-2">
          <ClipboardCheck size={20} className="text-dojo-red" /> Evaluaciones
        </h1>
        <p className="text-sm text-dojo-muted mt-1">
          Configura criterios y Senseis una sola vez, y llama a las Postulaciones que quieras evaluar.
        </p>
      </div>

      <div className="card space-y-3">
        {error && <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex gap-2">
          <input
            className="form-input text-sm flex-1"
            placeholder='Nombre (ej. "Examen de Cinta — Agosto 2026")'
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") create(); }}
            maxLength={120}
          />
          <button onClick={create} disabled={creating} className="btn-primary text-sm shrink-0 flex items-center gap-1.5">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Crear
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {evaluations.map(ev => (
          <Link key={ev.id} href={`/dashboard/evaluaciones/${ev.id}`} className="card flex items-center gap-4 hover:border-dojo-gold/40 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-dojo-white truncate">{ev.title}</p>
              <p className="text-xs text-dojo-muted">
                {new Date(ev.createdAt).toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-dojo-muted shrink-0">
              <span className="flex items-center gap-1"><Users size={12} /> {ev._count.links}</span>
              <span className="flex items-center gap-1"><Star size={12} /> {ev._count.criteria}</span>
              <span className="flex items-center gap-1"><UserCog size={12} /> {ev._count.evaluators}</span>
            </div>
            {isAdmin && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setDeleteError(""); setConfirmDel(ev); }}
                className="p-1.5 rounded-lg text-dojo-muted hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0"
                title="Eliminar evaluación"
              >
                <Trash2 size={14} />
              </button>
            )}
          </Link>
        ))}
        {evaluations.length === 0 && (
          <p className="text-center text-dojo-muted text-sm py-8">Todavía no hay evaluaciones — crea la primera arriba.</p>
        )}
      </div>

      {/* Modal eliminar evaluación */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-dojo-red/10 flex items-center justify-center shrink-0">
                <Trash2 size={20} className="text-dojo-red" />
              </div>
              <div>
                <p className="font-semibold text-dojo-white">Eliminar &quot;{confirmDel.title}&quot;</p>
                <p className="text-xs text-dojo-muted">
                  Se borran las postulaciones vinculadas (el vínculo, no la postulación), los criterios, los Senseis y <span className="text-dojo-red font-medium">todas las notas ya cargadas</span>. No se puede deshacer.
                </p>
              </div>
            </div>
            {deleteError && <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{deleteError}</div>}
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} disabled={deleting} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={() => deleteEvaluation(confirmDel)} disabled={deleting} className="flex-1 text-sm bg-dojo-red hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : null} Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
