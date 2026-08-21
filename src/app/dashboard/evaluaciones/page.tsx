"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ClipboardCheck, Loader2, Plus, Users, Star, UserCog } from "lucide-react";

interface EvaluationRow {
  id: string;
  title: string;
  createdAt: string;
  _count: { links: number; criteria: number; evaluators: number };
}

export default function EvaluacionesPage() {
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [newTitle,    setNewTitle]    = useState("");
  const [creating,    setCreating]    = useState(false);
  const [error,       setError]       = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/evaluations");
    if (res.ok) setEvaluations(await res.json() as EvaluationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
          </Link>
        ))}
        {evaluations.length === 0 && (
          <p className="text-center text-dojo-muted text-sm py-8">Todavía no hay evaluaciones — crea la primera arriba.</p>
        )}
      </div>
    </div>
  );
}
