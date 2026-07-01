"use client";
import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { FileText, Plus, Users, CheckCircle, XCircle, Clock } from "lucide-react";

interface PostulacionItem {
  id:            string;
  title:         string;
  location:      string;
  examDate:      Date | string;
  examTime:      string;
  deadline:      Date | string | null;
  amount:        number;
  status:        string;
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

export default function PostulacionesClient({ initialData }: { initialData: PostulacionItem[] }) {
  const [items, setItems]         = useState<PostulacionItem[]>(initialData);
  const [statusFilter, setStatus] = useState("");
  const [search, setSearch]       = useState("");

  const filtered = items.filter(item => {
    const matchStatus = !statusFilter || item.status === statusFilter;
    const matchSearch = !search || item.title.toLowerCase().includes(search.toLowerCase()) ||
                        item.location.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  async function reload() {
    const res = await fetch("/api/exam-applications");
    if (res.ok) {
      const data = await res.json() as PostulacionItem[];
      setItems(data);
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-dojo-gold" />
          <h1 className="text-xl font-display font-bold text-dojo-white">Postulaciones de Examen</h1>
        </div>
        <Link href="/dashboard/postulaciones/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} />
          Nueva Postulación
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          className="form-input text-sm w-44"
        >
          <option value="">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="PUBLISHED">Publicada</option>
          <option value="CLOSED">Cerrada</option>
          <option value="FINALIZED">Finalizada</option>
        </select>
        <input
          type="text"
          placeholder="Buscar por título o lugar..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input text-sm flex-1 min-w-48"
        />
        <button onClick={reload} className="btn-ghost text-sm">Actualizar</button>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center space-y-4">
          <FileText size={48} className="text-dojo-border" />
          <p className="text-dojo-muted text-lg font-medium">No hay postulaciones</p>
          <p className="text-dojo-muted text-sm">Crea una nueva postulación para comenzar.</p>
          <Link href="/dashboard/postulaciones/new" className="btn-primary text-sm">
            Crear primera postulación
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <div key={item.id} className="card hover:border-dojo-gold/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🥋</span>
                    <h3 className="font-semibold text-dojo-white truncate">{item.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_BADGE[item.status] ?? "badge-blue"}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>
                  <p className="text-sm text-dojo-muted">
                    📍 {item.location} &nbsp;·&nbsp; 📅 {formatDate(item.examDate)} a las {item.examTime}
                    {item.amount > 0 && ` · $${item.amount.toFixed(2)}`}
                  </p>
                  {item.deadline && (
                    <p className="text-xs text-dojo-muted">
                      Límite de respuesta: {formatDate(item.deadline)}
                    </p>
                  )}
                </div>

                <Link href={`/dashboard/postulaciones/${item.id}`} className="btn-secondary text-sm shrink-0 whitespace-nowrap">
                  Ver detalle →
                </Link>
              </div>

              {/* Contadores */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-dojo-border">
                <span className="flex items-center gap-1.5 text-sm text-dojo-muted">
                  <Users size={14} /> {item.totalInvitees} invitados
                </span>
                <span className="flex items-center gap-1.5 text-sm text-green-400">
                  <CheckCircle size={14} /> {item.accepted} aceptaron
                </span>
                <span className="flex items-center gap-1.5 text-sm text-red-400">
                  <XCircle size={14} /> {item.rejected} rechazaron
                </span>
                <span className="flex items-center gap-1.5 text-sm text-dojo-muted">
                  <Clock size={14} /> {item.pending} pendientes
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
