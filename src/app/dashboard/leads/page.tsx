"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users, Phone, Calendar, CheckCircle, Clock, XCircle, Check,
  MessageCircle, ChevronDown, Trash2, ExternalLink, Star,
  UserPlus, AlertCircle, FileText,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface Lead {
  id:          string;
  childName:   string;
  childAge:    number;
  parentName:  string;
  parentPhone: string;
  parentEmail: string | null;
  message:     string | null;
  status:      string;
  notes:       string | null;
  scheduleId:  string | null;
  createdAt:   string;
  schedule:    { id: string; name: string } | null;
}

type Status = "all" | "pending" | "contacted" | "scheduled" | "enrolled" | "cancelled";

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType; badge: string }> = {
  pending:   { label: "Pendiente",  color: "#F59E0B", icon: Clock,        badge: "badge-yellow" },
  contacted: { label: "Contactado", color: "#3B82F6", icon: Phone,        badge: "badge-blue"   },
  scheduled: { label: "Programado", color: "#8B5CF6", icon: Calendar,     badge: "badge-gold"   },
  enrolled:  { label: "Inscrito",   color: "#10B981", icon: CheckCircle,  badge: "badge-green"  },
  cancelled: { label: "Cancelado",  color: "#6B7280", icon: XCircle,      badge: "badge-red"    },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short", year: "numeric" });
}
function formatPhone(p: string) {
  const clean = p.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=Hola%20${encodeURIComponent(p)}%2C%20te%20contactamos%20del%20dojo%20por%20tu%20solicitud%20de%20clase%20de%20prueba.`;
}

export default function LeadsPage() {
  const [leads,    setLeads]    = useState<Lead[]>([]);
  const [tab,      setTab]      = useState<Status>("all");
  const [loading,  setLoading]  = useState(true);
  const [noteModal,setNoteModal]= useState<Lead | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [noteSaved,setNoteSaved]= useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/leads?status=${tab}`);
    if (r.ok) setLeads(await r.json());
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(id: string, status: string) {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function saveNote() {
    if (!noteModal) return;
    setSaving(true);
    await fetch(`/api/leads/${noteModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: noteText }),
    });
    setSaving(false);
    setNoteSaved(true);
    setTimeout(() => { setNoteSaved(false); setNoteModal(null); load(); }, 1200);
  }

  async function deleteLead(id: string) {
    if (!confirm("¿Eliminar este prospecto?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    load();
  }

  const displayed = tab === "all" ? leads : leads.filter(l => l.status === tab);

  const counts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pending = counts["pending"] ?? 0;

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-2">
            <Users size={22} className="text-dojo-red" /> Prospectos
          </h1>
          <p className="text-dojo-muted text-sm mt-0.5">
            Solicitudes de clase de prueba desde la página pública
          </p>
        </div>
        {pending > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-900/20 border border-yellow-700/40">
            <AlertCircle size={15} className="text-yellow-400" />
            <span className="text-yellow-300 text-sm font-semibold">{pending} sin atender</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className="card p-3 text-center cursor-pointer hover:border-dojo-red/40 transition-colors"
              onClick={() => setTab(key as Status)}>
              <Icon size={16} className="mx-auto mb-1" style={{ color: cfg.color }} />
              <p className="text-lg font-bold text-dojo-white">{counts[key] ?? 0}</p>
              <p className="text-xs text-dojo-muted">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-dojo-dark border border-dojo-border rounded-lg p-1 flex-wrap">
        {([["all","Todos"]] as [Status,string][]).concat(
          Object.entries(STATUS_CFG).map(([k,v]) => [k as Status, v.label])
        ).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
              tab === key ? "bg-dojo-nav-active text-white" : "text-dojo-muted hover:text-dojo-white"
            }`}
          >
            {label}
            {key !== "all" && (counts[key] ?? 0) > 0 && (
              <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center"
                style={{ background: STATUS_CFG[key]?.color + "40", color: STATUS_CFG[key]?.color }}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="card text-center py-14">
          <Star size={36} className="mx-auto text-dojo-muted opacity-30 mb-2" />
          <p className="text-dojo-muted">
            {tab === "all" ? "No hay prospectos aún." : `No hay prospectos en estado "${STATUS_CFG[tab]?.label}".`}
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dojo-border">
                  {["Niño/a","Edad","Padre / Madre","Contacto","Fecha","Estado","Acciones"].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(lead => {
                  const cfg = STATUS_CFG[lead.status];
                  const Icon = cfg?.icon ?? Clock;
                  return (
                    <tr key={lead.id} className="border-b border-dojo-border/40 hover:bg-dojo-border/10 transition-colors">

                      {/* Nombre niño */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-dojo-white">{lead.childName}</p>
                        {lead.notes && (
                          <p className="text-xs text-dojo-muted mt-0.5 truncate max-w-[160px]">
                            📝 {lead.notes}
                          </p>
                        )}
                      </td>

                      {/* Edad */}
                      <td className="px-4 py-3 text-dojo-muted">{lead.childAge} años</td>

                      {/* Padre */}
                      <td className="px-4 py-3">
                        <p className="text-dojo-white">{lead.parentName}</p>
                        {lead.parentEmail && <p className="text-xs text-dojo-muted">{lead.parentEmail}</p>}
                      </td>

                      {/* Contacto */}
                      <td className="px-4 py-3">
                        <a href={formatPhone(lead.parentPhone)} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-green-400 hover:text-green-300 transition-colors text-sm font-medium">
                          <MessageCircle size={13} /> {lead.parentPhone}
                        </a>
                      </td>

                      {/* Fecha */}
                      <td className="px-4 py-3 text-dojo-muted whitespace-nowrap">{formatDate(lead.createdAt)}</td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        <div className="relative group">
                          <button className={`${cfg?.badge ?? "badge-yellow"} flex items-center gap-1 cursor-pointer`}>
                            <Icon size={11} />
                            {cfg?.label ?? lead.status}
                            <ChevronDown size={10} />
                          </button>
                          {/* Dropdown */}
                          <div className="absolute left-0 top-full mt-1 w-40 bg-dojo-dark border border-dojo-border rounded-xl shadow-2xl z-20
                                          hidden group-hover:block">
                            {Object.entries(STATUS_CFG).map(([key, c]) => {
                              const SI = c.icon;
                              return (
                                <button key={key} onClick={() => changeStatus(lead.id, key)}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-dojo-border/40 transition-colors first:rounded-t-xl last:rounded-b-xl ${
                                    lead.status === key ? "font-bold" : ""
                                  }`}
                                  style={{ color: c.color }}>
                                  <SI size={12} /> {c.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setNoteModal(lead); setNoteText(lead.notes ?? ""); }}
                            className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-white" title="Agregar nota">
                            <FileText size={14} />
                          </button>
                          {lead.status !== "enrolled" && (
                            <Link
                              href={`/dashboard/students/new?name=${encodeURIComponent(lead.childName)}&phone=${encodeURIComponent(lead.parentPhone)}&parent=${encodeURIComponent(lead.parentName)}`}
                              className="btn-ghost p-1.5 text-dojo-muted hover:text-green-400" title="Inscribir como alumno">
                              <UserPlus size={14} />
                            </Link>
                          )}
                          <button onClick={() => deleteLead(lead.id)}
                            className="btn-ghost p-1.5 text-dojo-muted hover:text-red-400" title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de notas */}
      <Modal open={!!noteModal} onClose={() => setNoteModal(null)} title="Notas del prospecto" size="sm">
        {noteModal && (
          <div className="space-y-3">
            <p className="text-dojo-muted text-sm">
              <span className="font-semibold text-dojo-white">{noteModal.childName}</span> · {noteModal.parentName}
            </p>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              className="form-input min-h-[100px] resize-y"
              placeholder="Ej. Llamé el martes, quedaron de venir el jueves..."
              rows={4}
            />
            {noteSaved && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/20 border border-green-700/40 text-green-300 text-sm">
                <Check size={14} /> Nota guardada correctamente
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setNoteModal(null)} className="btn-secondary text-sm">Cancelar</button>
              <button onClick={saveNote} disabled={saving || noteSaved} className="btn-primary text-sm">
                {noteSaved ? <><Check size={14}/> ¡Guardado!</> : saving ? "Guardando..." : "Guardar nota"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
