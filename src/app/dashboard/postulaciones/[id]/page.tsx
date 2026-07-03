"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, getBeltInfo, BELT_COLORS } from "@/lib/utils";
import {
  ChevronLeft, Loader2, CheckCircle, XCircle, Clock, Users, Award, ClipboardList,
  Pencil, Archive, Trash2, UserPlus, Search, Lock, ChevronDown, ChevronUp
} from "lucide-react";

interface StudentOption {
  id:          string;
  fullName:    string;
  studentCode: number | null;
  beltHistory: { beltColor: string }[];
}

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
  archivedAt:  string | null;
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

  // Archive / delete from detail
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(false);

  // Panel agregar alumno
  const [addOpen,      setAddOpen]      = useState(false);
  const [addStudents,  setAddStudents]  = useState<StudentOption[]>([]);
  const [addSearch,    setAddSearch]    = useState("");
  const [addLoading,   setAddLoading]   = useState(false);
  const [addSel,       setAddSel]       = useState<StudentOption | null>(null);
  const [addBelt,      setAddBelt]      = useState("blanca");
  const [addSaving,    setAddSaving]    = useState(false);
  const [addError,     setAddError]     = useState("");

  // Certificados
  const [templates,    setTemplates]    = useState<CertTemplate[]>([]);
  const [selTemplate,  setSelTemplate]  = useState("");
  const [issuedDate,   setIssuedDate]   = useState(new Date().toISOString().slice(0,10));
  const [instructor,   setInstructor]   = useState("");
  const [selInvitees,  setSelInvitees]  = useState<Set<string>>(new Set());
  const [genLoading,   setGenLoading]   = useState(false);
  const [certError,    setCertError]    = useState("");

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/exam-applications/${id}`);
      if (res.ok) { setApp(await res.json() as Application); setLastRefresh(new Date()); }
      else if (!silent) setError("No se pudo cargar la postulación");
    } finally { if (!silent) setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-polling cada 15s mientras la página es visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, 15_000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleArchive() {
    setActioning("archive");
    try {
      const res = await fetch(`/api/exam-applications/${id}/archive`, { method: "POST" });
      if (res.ok) { router.replace("/dashboard/postulaciones"); }
      else { const d = await res.json() as { error?: string }; setError(d.error ?? "Error al archivar"); }
    } finally { setActioning(null); setConfirmArchive(false); }
  }

  async function handleDelete() {
    setActioning("delete");
    try {
      const res = await fetch(`/api/exam-applications/${id}`, { method: "DELETE" });
      if (res.ok) { router.replace("/dashboard/postulaciones"); }
      else { const d = await res.json() as { error?: string }; setError(d.error ?? "Error al eliminar"); }
    } finally { setActioning(null); setConfirmDelete(false); }
  }

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

  async function openAddPanel() {
    setAddOpen(true);
    setAddError("");
    setAddSel(null);
    setAddSearch("");
    if (addStudents.length > 0) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/students?active=true&limit=500");
      if (res.ok) {
        const data = await res.json() as { students?: StudentOption[] } | StudentOption[];
        const list = Array.isArray(data) ? data : (data as { students?: StudentOption[] }).students ?? [];
        setAddStudents(list);
      }
    } finally { setAddLoading(false); }
  }

  async function handleAddInvitee() {
    if (!addSel) return;
    setAddSaving(true);
    setAddError("");
    try {
      const res = await fetch(`/api/exam-applications/${id}/invitees`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ studentId: addSel.id, beltToPresent: addBelt }),
      });
      const d = await res.json() as { error?: string };
      if (!res.ok) { setAddError(d.error ?? "Error al agregar"); return; }
      setAddSel(null);
      setAddSearch("");
      setAddOpen(false);
      await load();
    } finally { setAddSaving(false); }
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
  const deadlinePassed      = !!app.deadline && new Date(app.deadline) < new Date();
  const canAddStudents      = (app.status === "DRAFT" || app.status === "PUBLISHED") && !deadlinePassed;

  // Alumnos ya invitados (para excluirlos del picker)
  const invitedIds = new Set(app.invitees.map(i => i.studentId));

  // Filtrar picker
  const addFiltered = addStudents.filter(s =>
    !invitedIds.has(s.id) &&
    (s.fullName.toLowerCase().includes(addSearch.toLowerCase()) ||
     String(s.studentCode ?? "").includes(addSearch))
  );

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      {/* Indicador de auto-actualización */}
      {lastRefresh && (
        <div className="flex items-center gap-1.5 text-[11px] text-dojo-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
          Actualización en tiempo real · última vez {lastRefresh.toLocaleTimeString("es-PA", { timeZone: "America/Panama", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      )}
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
        {/* Acciones */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
          {app.status !== "FINALIZED" && (
            <Link href={`/dashboard/postulaciones/${id}/edit`}
              className="p-1.5 rounded-lg text-dojo-muted hover:text-dojo-white hover:bg-dojo-border transition-colors"
              title="Editar">
              <Pencil size={16} />
            </Link>
          )}
          {!app.archivedAt && (
            <button onClick={() => setConfirmArchive(true)} disabled={!!actioning}
              className="p-1.5 rounded-lg text-dojo-muted hover:text-orange-400 hover:bg-orange-900/20 transition-colors"
              title="Archivar">
              <Archive size={16} />
            </button>
          )}
          <button onClick={() => setConfirmDelete(true)} disabled={!!actioning}
            className="p-1.5 rounded-lg text-dojo-muted hover:text-dojo-red hover:bg-dojo-red/10 transition-colors"
            title="Eliminar">
            <Trash2 size={16} />
          </button>
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
          {/* Bloque de rechazo — siempre visible cuando hay rechazos */}
          {app.invitees.filter(i => i.response === "REJECTED").length > 0 && (
            <div className="border border-red-800/50 bg-red-900/10 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-red-900/20 border-b border-red-800/40">
                <XCircle size={15} className="text-red-400 shrink-0" />
                <span className="text-sm font-semibold text-red-400">
                  No participarán ({app.invitees.filter(i => i.response === "REJECTED").length})
                </span>
              </div>
              <div className="divide-y divide-red-900/30">
                {app.invitees.filter(i => i.response === "REJECTED").map(inv => {
                  const beltInfo = getBeltInfo(inv.beltToPresent);
                  return (
                    <div key={inv.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dojo-white">{inv.student.fullName}</p>
                        {inv.responseNote && (
                          <p className="text-xs text-red-300/80 mt-0.5 leading-relaxed">
                            Motivo: {inv.responseNote}
                          </p>
                        )}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                        style={{ backgroundColor: beltInfo.hex + "25", color: beltInfo.hex === "#FFFFFF" ? "#aaa" : beltInfo.hex }}>
                        {beltInfo.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                    <tr key={inv.id} className={`border-b border-dojo-border/50 hover:bg-dojo-border/20 ${
                      inv.response === "REJECTED" ? "bg-red-900/10" : ""
                    }`}>
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
                        {app.amount > 0 && inv.response !== "REJECTED" && (
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
                      <td className="py-2.5 px-3 text-xs text-dojo-muted">
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
                  <div key={inv.id} className={`card space-y-2 ${inv.response === "REJECTED" ? "border-red-800/40 bg-red-900/10" : ""}`}>
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
                      {app.amount > 0 && inv.response !== "REJECTED" && (
                        <button onClick={() => togglePayment(inv)} className={`px-2 py-0.5 rounded font-medium transition-colors ${
                          inv.paymentStatus === "PAID" ? "bg-green-900/40 text-green-400" : "bg-dojo-border text-dojo-muted"
                        }`}>
                          {inv.paymentStatus === "PAID" ? "Pagado ✓" : "Marcar pagado"}
                        </button>
                      )}
                    </div>
                    {inv.responseNote && (
                      <p className={`text-xs italic ${inv.response === "REJECTED" ? "text-red-300/80" : "text-dojo-muted"}`}>
                        {inv.response === "REJECTED" ? `Motivo: ${inv.responseNote}` : inv.responseNote}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Panel agregar alumno ─────────────────────────────── */}
          {(app.status === "DRAFT" || app.status === "PUBLISHED") && (
            <div className="mt-2">
              {/* Bloqueado por deadline vencido */}
              {deadlinePassed ? (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-dojo-border/20 border border-dojo-border text-dojo-muted text-sm">
                  <Lock size={14} className="text-orange-400 shrink-0" />
                  <span>El plazo de respuesta venció el <strong className="text-dojo-white">{formatDate(app.deadline!)}</strong> — no se pueden agregar más alumnos.</span>
                </div>
              ) : (
                <>
                  {/* Botón de abrir/cerrar */}
                  <button
                    onClick={() => (addOpen ? setAddOpen(false) : openAddPanel())}
                    className="flex items-center gap-2 text-sm text-dojo-gold hover:text-yellow-300 transition-colors font-medium"
                  >
                    <UserPlus size={15} />
                    Agregar alumno
                    {addOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {/* Panel expandido */}
                  {addOpen && (
                    <div className="mt-3 card space-y-3 border-dojo-gold/20">
                      {addError && (
                        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                          {addError}
                        </div>
                      )}

                      {/* Buscador */}
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                        <input
                          className="form-input pl-9 text-sm"
                          placeholder="Buscar por nombre o código..."
                          value={addSearch}
                          onChange={e => { setAddSearch(e.target.value); setAddSel(null); }}
                        />
                      </div>

                      {addLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 size={20} className="animate-spin text-dojo-gold" />
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {addFiltered.slice(0, 30).map(s => {
                            const belt = getBeltInfo(s.beltHistory[0]?.beltColor ?? "blanca");
                            const isSel = addSel?.id === s.id;
                            return (
                              <button
                                key={s.id}
                                onClick={() => { setAddSel(s); setAddBelt(s.beltHistory[0]?.beltColor ?? "blanca"); }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors text-sm ${
                                  isSel
                                    ? "bg-dojo-gold/10 border border-dojo-gold/40"
                                    : "hover:bg-dojo-border/40"
                                }`}
                              >
                                <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isSel ? "border-dojo-gold bg-dojo-gold" : "border-dojo-border"}`}>
                                  {isSel && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                                </span>
                                <span className="flex-1 min-w-0 text-dojo-white truncate">{s.fullName}</span>
                                {s.studentCode && <span className="text-xs text-dojo-muted shrink-0">#{s.studentCode}</span>}
                                <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                                  style={{ backgroundColor: belt.hex + "25", color: belt.hex === "#FFFFFF" ? "#aaa" : belt.hex }}>
                                  {belt.label}
                                </span>
                              </button>
                            );
                          })}
                          {addFiltered.length === 0 && (
                            <p className="text-center text-dojo-muted text-sm py-4">
                              {addStudents.length === 0 ? "No hay alumnos activos" : "Sin resultados"}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Cinta a presentar (cuando hay selección) */}
                      {addSel && (
                        <div className="pt-2 border-t border-dojo-border space-y-2">
                          <p className="text-sm text-dojo-muted">
                            Alumno: <span className="text-dojo-white font-medium">{addSel.fullName}</span>
                          </p>
                          <div>
                            <label className="form-label text-xs">Cinta a presentar</label>
                            <select
                              className="form-input text-sm"
                              value={addBelt}
                              onChange={e => setAddBelt(e.target.value)}
                            >
                              {BELT_COLORS.map(bc => (
                                <option key={bc.value} value={bc.value}>{bc.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setAddSel(null); setAddSearch(""); }}
                              className="btn-secondary text-sm flex-1"
                              disabled={addSaving}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleAddInvitee}
                              disabled={addSaving}
                              className="btn-primary text-sm flex-1 flex items-center justify-center gap-2"
                            >
                              {addSaving
                                ? <Loader2 size={14} className="animate-spin" />
                                : <UserPlus size={14} />
                              }
                              Agregar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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

      {/* Modal archivar */}
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
              ¿Mover <span className="text-dojo-white font-medium">"{app.title}"</span> al historial?
              Esta acción no elimina los datos.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmArchive(false)} className="btn-secondary flex-1 text-sm" disabled={actioning === "archive"}>
                Cancelar
              </button>
              <button onClick={handleArchive}
                className="flex-1 text-sm bg-orange-700 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                disabled={actioning === "archive"}>
                {actioning === "archive" ? <Loader2 size={14} className="animate-spin inline" /> : "Sí, archivar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
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
              <span className="text-dojo-white font-medium">"{app.title}"</span>?
              Se borrarán todos los invitados y respuestas.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 text-sm" disabled={actioning === "delete"}>
                Cancelar
              </button>
              <button onClick={handleDelete}
                className="btn-primary flex-1 text-sm bg-dojo-red hover:bg-red-700"
                disabled={actioning === "delete"}>
                {actioning === "delete" ? <Loader2 size={14} className="animate-spin inline" /> : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
