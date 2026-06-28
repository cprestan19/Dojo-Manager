"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, UserCheck, UserX, User, Filter, Trash2, ShieldCheck, Users, AlertTriangle } from "lucide-react";

interface PendingStudent {
  id: string; status: string; submittedAt: string;
  fullName: string; firstName: string; lastName: string;
  photo: string | null;
  birthDate: string; gender: string; nationality: string;
  cedula: string | null; fepakaId: string | null; ryoBukaiId: string | null;
  bloodType: string | null; condition: string | null;
  hasPrivateInsurance: boolean; insuranceName: string | null; insuranceNumber: string | null;
  motherName: string | null; motherPhone: string | null; motherEmail: string | null;
  fatherName: string | null; fatherPhone: string | null; fatherEmail: string | null;
  address: string | null;
  hasSiblingInDojo: boolean;
  primaryGuardian: "mother" | "father" | null;
  registrationLink: { label: string };
}

type DupWarning = { message: string; hint?: string };
type ApproveResult = { duplicate?: boolean; message?: string; hint?: string } | void;

function InfoRow({ label, value }: { label: string; value: string | null | boolean | undefined }) {
  if (!value && value !== false) return null;
  return (
    <div className="text-sm">
      <span className="text-dojo-muted">{label}: </span>
      <span className="text-dojo-white">{typeof value === "boolean" ? (value ? "Sí" : "No") : String(value)}</span>
    </div>
  );
}

function StudentCard({
  student, onApprove, onReject, onDelete,
}: {
  student:   PendingStudent;
  onApprove: (id: string, force?: boolean) => Promise<ApproveResult>;
  onReject:  (id: string, note: string, notify: boolean) => Promise<void>;
  onDelete:  (id: string, notify: boolean) => Promise<void>;
}) {
  const [expanded,       setExpanded]       = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [showReject,     setShowReject]     = useState(false);
  const [showDelete,     setShowDelete]     = useState(false);
  const [dupWarning,     setDupWarning]     = useState<DupWarning | null>(null);
  const [note,           setNote]           = useState("");
  const [notifyOnRej,    setNotifyOnRej]    = useState(true);
  const [notifyOnDel,    setNotifyOnDel]    = useState(true);

  const hasEmail = !!(student.motherEmail || student.fatherEmail);

  async function approve(force = false) {
    if (!force && !confirm(`¿Aprobar e inscribir a ${student.fullName}?`)) return;
    setLoading(true);
    const result = await onApprove(student.id, force).finally(() => setLoading(false));
    if (result?.duplicate) {
      setDupWarning({ message: result.message ?? "Posible duplicado detectado.", hint: result.hint });
    }
  }

  async function reject() {
    setLoading(true);
    await onReject(student.id, note, notifyOnRej && hasEmail).finally(() => setLoading(false));
    setShowReject(false);
    setNote("");
  }

  async function deleteStudent() {
    setLoading(true);
    await onDelete(student.id, notifyOnDel && hasEmail).finally(() => setLoading(false));
    setShowDelete(false);
  }

  const age = Math.floor((Date.now() - new Date(student.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));

  if (student.status === "approved") {
    return (
      <div className="card opacity-60 border-green-800 flex items-center gap-3">
        <UserCheck size={18} className="text-green-400 shrink-0" />
        <div>
          <p className="text-dojo-white font-medium">{student.fullName}</p>
          <p className="text-xs text-dojo-muted">Aprobado · Link: {student.registrationLink.label}</p>
        </div>
      </div>
    );
  }

  if (student.status === "rejected") {
    return (
      <div className="card opacity-60 border-red-900 flex items-center gap-3">
        <UserX size={18} className="text-red-400 shrink-0" />
        <div>
          <p className="text-dojo-white font-medium">{student.fullName}</p>
          <p className="text-xs text-dojo-muted">Rechazado · Link: {student.registrationLink.label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-3 border border-dojo-border">
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {student.photo ? (
            <img src={student.photo} alt={student.fullName}
              className="w-9 h-9 rounded-full object-cover shrink-0 border border-dojo-border" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-dojo-red/20 flex items-center justify-center shrink-0">
              <User size={16} className="text-dojo-red" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-dojo-white">{student.fullName}</p>
              {student.hasSiblingInDojo && (
                <span className="inline-flex items-center gap-1 text-xs bg-dojo-gold/10 text-dojo-gold border border-dojo-gold/30 rounded-full px-2 py-0.5">
                  <Users size={10} /> Hermano/a
                </span>
              )}
            </div>
            <p className="text-xs text-dojo-muted">
              {student.gender === "M" ? "Masculino" : "Femenino"} · {age} años · {student.nationality}
              <span className="ml-2">Link: {student.registrationLink.label}</span>
            </p>
            <p className="text-xs text-dojo-muted">
              Enviado: {new Date(student.submittedAt).toLocaleString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => { setShowDelete(v => !v); setShowReject(false); setDupWarning(null); }} title="Eliminar solicitud"
            className="p-1.5 rounded hover:bg-red-900/20 text-dojo-muted hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded hover:bg-dojo-border/40 text-dojo-muted">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Detalle expandible */}
      {expanded && (
        <div className="space-y-4 border-t border-dojo-border pt-3">
          <div>
            <p className="text-xs font-semibold text-dojo-muted uppercase tracking-wide mb-2">Datos personales</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <InfoRow label="Nombre"     value={student.firstName} />
              <InfoRow label="Apellido"   value={student.lastName} />
              <InfoRow label="Nacimiento" value={new Date(student.birthDate).toLocaleDateString("es-PA", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" })} />
              <InfoRow label="Cédula"     value={student.cedula} />
              <InfoRow label="FEPAKA"     value={student.fepakaId} />
              <InfoRow label="Ryo Bukai"  value={student.ryoBukaiId} />
            </div>
          </div>
          {(student.bloodType || student.condition || student.hasPrivateInsurance) && (
            <div>
              <p className="text-xs font-semibold text-dojo-muted uppercase tracking-wide mb-2">Salud</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <InfoRow label="Tipo de sangre" value={student.bloodType} />
                <InfoRow label="Seguro privado" value={student.hasPrivateInsurance} />
                <InfoRow label="Aseguradora"    value={student.insuranceName} />
                <InfoRow label="Nº póliza"      value={student.insuranceNumber} />
              </div>
              {student.condition && (
                <div className="mt-1 text-sm">
                  <span className="text-dojo-muted">Condición: </span>
                  <span className="text-dojo-white">{student.condition}</span>
                </div>
              )}
            </div>
          )}
          {(student.motherName || student.fatherName || student.address) && (
            <div>
              <p className="text-xs font-semibold text-dojo-muted uppercase tracking-wide mb-2">Contactos</p>
              {student.hasSiblingInDojo && (
                <p className="text-xs text-dojo-gold mb-2 flex items-center gap-1">
                  <Users size={11} /> El padre/tutor indicó que tiene un hermano/a en el dojo — el correo puede coincidir.
                </p>
              )}
              {student.primaryGuardian && (
                <p className="text-xs text-dojo-gold mb-2 flex items-center gap-1">
                  <ShieldCheck size={11} />
                  Acudiente principal: <strong>{student.primaryGuardian === "mother" ? "Madre" : "Padre"}</strong>
                  {" — "}este correo se usará para el acceso al portal del alumno.
                </p>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <InfoRow label={`Madre${student.primaryGuardian === "mother" ? " ★" : ""}`} value={student.motherName} />
                <InfoRow label="Tel. madre"  value={student.motherPhone} />
                <InfoRow label="Email madre" value={student.motherEmail} />
                <InfoRow label={`Padre${student.primaryGuardian === "father" ? " ★" : ""}`} value={student.fatherName} />
                <InfoRow label="Tel. padre"  value={student.fatherPhone} />
                <InfoRow label="Email padre" value={student.fatherEmail} />
              </div>
              {student.address && (
                <div className="mt-1 text-sm">
                  <span className="text-dojo-muted">Dirección: </span>
                  <span className="text-dojo-white">{student.address}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Advertencia de duplicado */}
      {dupWarning && (
        <div className="border border-orange-700 bg-orange-900/15 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-orange-300 font-semibold">Posible duplicado detectado</p>
              <p className="text-xs text-orange-200">{dupWarning.message}</p>
              {dupWarning.hint && <p className="text-xs text-dojo-muted">{dupWarning.hint}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDupWarning(null)} className="btn-secondary text-sm flex-1">Cancelar</button>
            <button onClick={() => { setDupWarning(null); approve(true); }} disabled={loading}
              className="flex-1 bg-orange-700 hover:bg-orange-600 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors">
              {loading ? "Procesando..." : "Aprobar de todas formas"}
            </button>
          </div>
        </div>
      )}

      {/* Panel eliminar */}
      {showDelete && (
        <div className="border border-red-800 bg-red-900/10 rounded-lg p-3 space-y-3">
          <p className="text-sm text-red-300 font-semibold">¿Eliminar esta solicitud permanentemente?</p>
          <p className="text-xs text-dojo-muted">El registro se borrará de la cola. Si el padre/tutor tiene correo registrado puedes pedirle que lo envíe de nuevo.</p>
          {hasEmail && (
            <label className="flex items-center gap-2 text-sm text-dojo-white cursor-pointer">
              <input type="checkbox" checked={notifyOnDel} onChange={e => setNotifyOnDel(e.target.checked)}
                className="w-4 h-4 accent-dojo-red" />
              Enviar email pidiendo reenvío del formulario
            </label>
          )}
          {!hasEmail && (
            <p className="text-xs text-yellow-500">⚠ No hay correo registrado — no se puede notificar.</p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setShowDelete(false)} className="btn-secondary text-sm flex-1">Cancelar</button>
            <button onClick={deleteStudent} disabled={loading}
              className="flex-1 bg-red-700 hover:bg-red-600 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors">
              {loading ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>
      )}

      {/* Acciones aprobar / rechazar */}
      {!showDelete && !dupWarning && (showReject ? (
        <div className="space-y-3 border-t border-dojo-border pt-3">
          <textarea className="form-input resize-none text-sm" rows={2} value={note}
            onChange={e => setNote(e.target.value)} placeholder="Motivo del rechazo (opcional — el padre/tutor lo verá si se notifica)" />
          {hasEmail ? (
            <label className="flex items-center gap-2 text-sm text-dojo-white cursor-pointer">
              <input type="checkbox" checked={notifyOnRej} onChange={e => setNotifyOnRej(e.target.checked)}
                className="w-4 h-4 accent-dojo-red" />
              Enviar email con link para que corrija y reenvíe
            </label>
          ) : (
            <p className="text-xs text-yellow-500">⚠ No hay correo registrado — no se puede notificar.</p>
          )}
          {notifyOnRej && hasEmail && (
            <p className="text-xs text-dojo-muted">
              El padre/tutor recibirá un enlace con <code className="text-dojo-gold">?reset=1</code> que le permite volver a abrir el formulario y corregir los datos.
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => setShowReject(false)} className="btn-secondary text-sm flex-1">Cancelar</button>
            <button onClick={reject} disabled={loading}
              className="flex-1 bg-red-700 hover:bg-red-600 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors">
              {loading ? "Rechazando..." : "Confirmar rechazo"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 border-t border-dojo-border pt-3">
          <button onClick={() => setShowReject(true)} disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 bg-dojo-card hover:bg-red-900/30 border border-dojo-border hover:border-red-700 text-dojo-muted hover:text-red-400 rounded-lg px-3 py-2 text-sm font-medium transition-colors">
            <UserX size={14} /> Rechazar
          </button>
          <button onClick={() => approve()} disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 btn-primary text-sm">
            <UserCheck size={14} /> {loading ? "Procesando..." : "Aprobar e inscribir"}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function PendingStudentsQueue({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const [students, setStudents]   = useState<PendingStudent[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [statusFilter, setStatus] = useState("pending");

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pending-students?status=${status}`);
      if (res.ok) {
        const data: PendingStudent[] = await res.json();
        setStudents(data);
        if (status === "pending") onCountChange?.(data.length);
      }
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => { load(statusFilter); }, [load, statusFilter]);

  async function approve(id: string, force = false): Promise<ApproveResult> {
    const res = await fetch(`/api/pending-students/${id}/approve`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ force }),
    });

    if (res.status === 409) {
      const data = await res.json().catch(() => ({})) as { duplicate?: boolean; message?: string; hint?: string; error?: string };
      if (data.duplicate) return data; // devuelve la advertencia para mostrar en la card
      alert(data.error ?? "Error al aprobar.");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert((data as { message?: string }).message ?? "Error al aprobar.");
      return;
    }
    load(statusFilter);
  }

  async function reject(id: string, note: string, notify: boolean) {
    const res = await fetch(`/api/pending-students/${id}/reject`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ note, notify }),
    });
    if (!res.ok) alert("Error al rechazar.");
    else load(statusFilter);
  }

  async function deletePending(id: string, notify: boolean) {
    const res = await fetch(`/api/pending-students/${id}`, {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ notify }),
    });
    if (!res.ok) alert("Error al eliminar.");
    else load(statusFilter);
  }

  const pending   = students.filter(s => s.status === "pending");
  const processed = students.filter(s => s.status !== "pending");

  return (
    <div className="space-y-4">

      {/* Garantía de aislamiento */}
      <div className="flex items-start gap-2 bg-green-900/20 border border-green-800/40 rounded-lg px-3 py-2.5">
        <ShieldCheck size={15} className="text-green-400 mt-0.5 shrink-0" />
        <p className="text-xs text-green-300">
          <strong>Ninguna solicitud se agrega a la base de alumnos</strong> hasta que el administrador la apruebe manualmente.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-dojo-muted" />
        <span className="text-sm text-dojo-muted">Filtrar:</span>
        {(["pending", "approved", "rejected"] as const).map(s => (
          <button key={s} onClick={() => { setStatus(s); load(s); }}
            className={`text-sm px-3 py-1 rounded-full transition-colors ${
              statusFilter === s
                ? "bg-dojo-red text-white"
                : "bg-dojo-card border border-dojo-border text-dojo-muted hover:text-dojo-white"
            }`}>
            {s === "pending" ? "Pendientes" : s === "approved" ? "Aprobados" : "Rechazados"}
          </button>
        ))}
      </div>

      {loading && <div className="h-32 bg-dojo-card rounded-xl animate-pulse" />}

      {!loading && students.length === 0 && (
        <div className="card text-center py-10 text-dojo-muted">
          No hay solicitudes {statusFilter === "pending" ? "pendientes" : statusFilter === "approved" ? "aprobadas" : "rechazadas"}.
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {(statusFilter === "pending" ? pending : processed).map(s => (
            <StudentCard key={s.id} student={s} onApprove={approve} onReject={reject} onDelete={deletePending} />
          ))}
        </div>
      )}
    </div>
  );
}
