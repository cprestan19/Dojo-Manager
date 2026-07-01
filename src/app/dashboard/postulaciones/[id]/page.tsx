"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDate, getBeltInfo } from "@/lib/utils";
import {
  ChevronLeft, Loader2, CheckCircle, XCircle, Clock, Users, Award, ClipboardList
} from "lucide-react";

interface Invitee {
  id:            string;
  studentId:     string;
  beltToPresent: string;
  response:      string;
  responseNote:  string | null;
  respondedAt:   string | null;
  paymentStatus: string;
  paidAt:        string | null;
  attended:      boolean;
  passed:        boolean | null;
  student:       { id: string; fullName: string; studentCode: number | null };
  certificate:   { id: string; status: string; pdfUrl: string | null; issuedDate: string } | null;
}

interface Application {
  id:          string;
  title:       string;
  location:    string;
  examDate:    string;
  examTime:    string;
  deadline:    string | null;
  amount:      number;
  description: string | null;
  status:      string;
  invitees:    Invitee[];
}

interface CertTemplate { id: string; name: string; }

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador", PUBLISHED: "Publicada", CLOSED: "Cerrada", FINALIZED: "Finalizada",
};
const STATUS_BADGE: Record<string, string> = {
  DRAFT:     "bg-dojo-border text-dojo-muted",
  PUBLISHED: "bg-green-900/40 text-green-400 border border-green-800/50",
  CLOSED:    "bg-orange-900/40 text-orange-400 border border-orange-800/50",
  FINALIZED: "bg-blue-900/40 text-blue-400 border border-blue-800/50",
};

type ResponseFilter = "all" | "PENDING" | "ACCEPTED" | "REJECTED";

export default function PostulacionDetallePage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [app,       setApp]       = useState<Application | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [tab,       setTab]       = useState<"respuestas" | "asistencia" | "certificados">("respuestas");
  const [filter,    setFilter]    = useState<ResponseFilter>("all");
  const [actioning, setActioning] = useState<string | null>(null);

  // Certificados
  const [templates,    setTemplates]    = useState<CertTemplate[]>([]);
  const [selTemplate,  setSelTemplate]  = useState("");
  const [issuedDate,   setIssuedDate]   = useState(new Date().toISOString().slice(0,10));
  const [instructor,   setInstructor]   = useState("");
  const [selInvitees,  setSelInvitees]  = useState<Set<string>>(new Set());
  const [genLoading,   setGenLoading]   = useState(false);
  const [certError,    setCertError]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/exam-applications/${id}`);
      if (res.ok) setApp(await res.json() as Application);
      else setError("No se pudo cargar la postulación");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(action: "publish" | "close" | "finalize") {
    setActioning(action);
    try {
      const res = await fetch(`/api/exam-applications/${id}/${action}`, { method: "POST" });
      if (res.ok) await load();
      else { const d = await res.json() as { error?: string }; setError(d.error ?? "Error"); }
    } finally { setActioning(null); }
  }

  async function togglePayment(invitee: Invitee) {
    const newStatus = invitee.paymentStatus === "PAID" ? "PENDING" : "PAID";
    setActioning(invitee.id + "_pay");
    try {
      await fetch(`/api/exam-applications/${id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeId: invitee.id, paymentStatus: newStatus }),
      });
      await load();
    } finally { setActioning(null); }
  }

  async function toggleAttendance(invitee: Invitee, field: "attended" | "passed") {
    const data = field === "attended"
      ? { inviteeId: invitee.id, attended: !invitee.attended }
      : { inviteeId: invitee.id, attended: invitee.attended, passed: !invitee.passed };
    await fetch(`/api/exam-applications/${id}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await load();
  }

  async function loadTemplates() {
    const res = await fetch("/api/certificate-templates");
    if (res.ok) { const d = await res.json() as CertTemplate[]; setTemplates(d); if (d[0]) setSelTemplate(d[0].id); }
  }

  async function generateCerts() {
    setCertError("");
    if (!selTemplate) { setCertError("Selecciona una plantilla"); return; }
    if (!selInvitees.size) { setCertError("Selecciona al menos un alumno"); return; }
    setGenLoading(true);
    try {
      const res = await fetch("/api/generated-certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteeIds:    Array.from(selInvitees),
          templateId:    selTemplate,
          issuedDate,
          instructorName: instructor.trim() || undefined,
        }),
      });
      const d = await res.json() as { created?: number; error?: string };
      if (!res.ok) { setCertError(d.error ?? "Error"); return; }
      setSelInvitees(new Set());
      await load();
    } finally { setGenLoading(false); }
  }

  if (loading) return <div className="p-6 flex justify-center"><Loader2 size={24} className="animate-spin text-dojo-gold" /></div>;
  if (error)   return <div className="p-6 text-red-400">{error}</div>;
  if (!app)    return null;

  const filteredInvitees = app.invitees.filter(i =>
    filter === "all" ? true : i.response === filter
  );
  const acceptedInvitees = app.invitees.filter(i => i.response === "ACCEPTED");
  const passedInvitees   = app.invitees.filter(i => i.passed === true);
  const pendingCount     = app.invitees.filter(i => i.response === "PENDING").length;
  const canShowAttendance   = app.status === "CLOSED" || app.status === "FINALIZED";
  const canShowCertificates = app.status === "CLOSED" || app.status === "FINALIZED";

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/dashboard/postulaciones")} className="btn-ghost p-2">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-display font-bold text-dojo-white truncate">{app.title}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_BADGE[app.status]}`}>
              {STATUS_LABELS[app.status]}
            </span>
          </div>
          <p className="text-sm text-dojo-muted">
            📍 {app.location} · 📅 {formatDate(app.examDate)} {app.examTime}
            {app.amount > 0 && ` · $${app.amount.toFixed(2)}`}
          </p>
        </div>
        {/* Acciones de estado */}
        <div className="flex gap-2 shrink-0">
          {app.status === "DRAFT" && (
            <button onClick={() => changeStatus("publish")} disabled={!!actioning} className="btn-primary text-sm">
              {actioning === "publish" ? <Loader2 size={14} className="animate-spin" /> : "Publicar"}
            </button>
          )}
          {app.status === "PUBLISHED" && (
            <button onClick={() => changeStatus("close")} disabled={!!actioning} className="btn-secondary text-sm">
              {actioning === "close" ? <Loader2 size={14} className="animate-spin" /> : "Cerrar inscripciones"}
            </button>
          )}
          {app.status === "CLOSED" && (
            <button onClick={() => changeStatus("finalize")} disabled={!!actioning} className="btn-secondary text-sm">
              {actioning === "finalize" ? <Loader2 size={14} className="animate-spin" /> : "Finalizar"}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-dojo-border overflow-x-auto">
        {([
          { key: "respuestas",   label: "Respuestas",  icon: Users },
          ...(canShowAttendance   ? [{ key: "asistencia",   label: "Asistencia",  icon: ClipboardList }] : []),
          ...(canShowCertificates ? [{ key: "certificados", label: "Certificados", icon: Award }] : []),
        ] as { key: string; label: string; icon: React.ElementType }[]).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key as typeof tab); if (t.key === "certificados" && !templates.length) loadTemplates(); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key ? "border-dojo-red text-dojo-red" : "border-transparent text-dojo-muted hover:text-dojo-white"
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab Respuestas */}
      {tab === "respuestas" && (
        <div className="space-y-3">
          {/* Filtros */}
          <div className="flex items-center gap-2 flex-wrap">
            {(["all","PENDING","ACCEPTED","REJECTED"] as ResponseFilter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  filter === f ? "bg-dojo-gold text-black" : "bg-dojo-border text-dojo-muted hover:text-dojo-white"
                }`}>
                {f === "all" ? "Todos" : f === "PENDING" ? "Pendientes" : f === "ACCEPTED" ? "Aceptados" : "Rechazados"}
                {f !== "all" && ` (${app.invitees.filter(i => i.response === f).length})`}
              </button>
            ))}
            {pendingCount > 0 && app.status === "PUBLISHED" && (
              <span className="ml-auto text-xs text-dojo-muted">
                {pendingCount} sin responder
              </span>
            )}
          </div>

          {/* Tabla desktop / tarjetas mobile */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm hidden md:table">
              <thead>
                <tr className="border-b border-dojo-border text-dojo-muted text-xs">
                  <th className="text-left py-2 px-3">Alumno</th>
                  <th className="text-left py-2 px-3">Cinta</th>
                  <th className="text-left py-2 px-3">Respuesta</th>
                  <th className="text-left py-2 px-3">Pago</th>
                  <th className="text-left py-2 px-3">Nota</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {filteredInvitees.map(inv => {
                  const beltInfo = getBeltInfo(inv.beltToPresent);
                  return (
                    <tr key={inv.id} className="border-b border-dojo-border/50 hover:bg-dojo-border/20">
                      <td className="py-2.5 px-3 font-medium text-dojo-white">{inv.student.fullName}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: beltInfo.hex + "30", color: beltInfo.hex === "#FFFFFF" ? "#aaa" : beltInfo.hex }}>
                          {beltInfo.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {inv.response === "ACCEPTED" ? (
                          <span className="flex items-center gap-1 text-green-400"><CheckCircle size={14} /> Aceptó</span>
                        ) : inv.response === "REJECTED" ? (
                          <span className="flex items-center gap-1 text-red-400"><XCircle size={14} /> Rechazó</span>
                        ) : (
                          <span className="flex items-center gap-1 text-dojo-muted"><Clock size={14} /> Pendiente</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {app.amount > 0 && (
                          <button
                            onClick={() => togglePayment(inv)}
                            disabled={actioning === inv.id + "_pay"}
                            className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                              inv.paymentStatus === "PAID"
                                ? "bg-green-900/40 text-green-400 border border-green-800/50"
                                : "bg-dojo-border text-dojo-muted hover:text-dojo-white"
                            }`}
                          >
                            {inv.paymentStatus === "PAID" ? "Pagado ✓" : "Marcar pagado"}
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-dojo-muted max-w-32 truncate">
                        {inv.responseNote}
                      </td>
                      <td className="py-2.5 px-3" />
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {filteredInvitees.map(inv => {
                const beltInfo = getBeltInfo(inv.beltToPresent);
                return (
                  <div key={inv.id} className="card space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-dojo-white text-sm">{inv.student.fullName}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: beltInfo.hex + "30", color: beltInfo.hex === "#FFFFFF" ? "#aaa" : beltInfo.hex }}>
                        {beltInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {inv.response === "ACCEPTED" ? (
                        <span className="flex items-center gap-1 text-green-400"><CheckCircle size={12} /> Aceptó</span>
                      ) : inv.response === "REJECTED" ? (
                        <span className="flex items-center gap-1 text-red-400"><XCircle size={12} /> Rechazó</span>
                      ) : (
                        <span className="flex items-center gap-1 text-dojo-muted"><Clock size={12} /> Pendiente</span>
                      )}
                      {app.amount > 0 && (
                        <button onClick={() => togglePayment(inv)} className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          inv.paymentStatus === "PAID" ? "bg-green-900/40 text-green-400" : "bg-dojo-border text-dojo-muted"
                        }`}>
                          {inv.paymentStatus === "PAID" ? "Pagado ✓" : "Marcar pagado"}
                        </button>
                      )}
                    </div>
                    {inv.responseNote && <p className="text-xs text-dojo-muted italic">{inv.responseNote}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab Asistencia */}
      {tab === "asistencia" && canShowAttendance && (
        <div className="space-y-3">
          <p className="text-sm text-dojo-muted">Solo se muestran los alumnos que aceptaron ({acceptedInvitees.length})</p>
          <div className="space-y-2">
            {acceptedInvitees.map(inv => (
              <div key={inv.id} className="card flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-dojo-white text-sm">{inv.student.fullName}</p>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inv.attended}
                    onChange={() => toggleAttendance(inv, "attended")}
                    className="w-4 h-4 accent-yellow-500"
                  />
                  <span className="text-dojo-muted">Asistió</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inv.passed ?? false}
                    onChange={() => toggleAttendance(inv, "passed")}
                    className="w-4 h-4 accent-green-500"
                    disabled={!inv.attended}
                  />
                  <span className={inv.attended ? "text-dojo-muted" : "text-dojo-border"}>Aprobó</span>
                </label>
              </div>
            ))}
            {acceptedInvitees.length === 0 && (
              <p className="text-center text-dojo-muted py-8">No hay alumnos que hayan aceptado</p>
            )}
          </div>
        </div>
      )}

      {/* Tab Certificados */}
      {tab === "certificados" && canShowCertificates && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="font-semibold text-dojo-white">Generar Certificados</h3>
            {certError && <div className="text-red-400 text-sm">{certError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Plantilla</label>
                <select className="form-input" value={selTemplate} onChange={e => setSelTemplate(e.target.value)}>
                  {templates.length === 0 && <option value="">Sin plantillas</option>}
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Fecha de emisión</label>
                <input type="date" className="form-input" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Instructor (opcional)</label>
                <input className="form-input" value={instructor} onChange={e => setInstructor(e.target.value)} placeholder="Nombre del instructor" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-dojo-muted">Alumnos aprobados ({passedInvitees.length})</p>
              {passedInvitees.map(inv => (
                <label key={inv.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selInvitees.has(inv.id)}
                    onChange={() => {
                      const next = new Set(selInvitees);
                      if (next.has(inv.id)) next.delete(inv.id); else next.add(inv.id);
                      setSelInvitees(next);
                    }}
                    className="w-4 h-4 accent-yellow-500"
                  />
                  <span className="text-sm text-dojo-white">{inv.student.fullName}</span>
                  {inv.certificate && (
                    <span className="text-xs text-dojo-muted">(ya tiene certificado)</span>
                  )}
                </label>
              ))}
              {passedInvitees.length === 0 && (
                <p className="text-dojo-muted text-sm">No hay alumnos marcados como aprobados aún</p>
              )}
            </div>

            <button
              onClick={generateCerts}
              disabled={genLoading || !selInvitees.size}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {genLoading ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />}
              Generar Certificados ({selInvitees.size})
            </button>
          </div>

          {/* Lista de certificados generados */}
          {app.invitees.some(i => i.certificate) && (
            <div className="space-y-2">
              <h3 className="font-semibold text-dojo-white text-sm">Certificados generados</h3>
              {app.invitees.filter(i => i.certificate).map(inv => (
                <div key={inv.id} className="card flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dojo-white">{inv.student.fullName}</p>
                    <p className="text-xs text-dojo-muted">Estado: {inv.certificate!.status}</p>
                  </div>
                  {inv.certificate!.pdfUrl && (
                    <a href={inv.certificate!.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs">
                      Descargar PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
