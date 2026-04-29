"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Edit, Award, CreditCard, Phone,
  Heart, Calendar, Plus, Shield, Trophy, Fingerprint, Trash2, Pencil, Star,
  ClipboardList, LogIn, LogOut, UserX, UserCheck, KeyRound,
} from "lucide-react";
import { StudentQR } from "@/components/students/StudentQR";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { Modal } from "@/components/ui/Modal";
import { calculateAge, formatDate, formatCurrency, BELT_COLORS, PAYMENT_STATUS_LABELS } from "@/lib/utils";
import Image from "next/image";

interface Kata { id: string; name: string; beltColor: string; }
interface BeltEntry {
  id: string; beltColor: string; changeDate: string;
  isRanking: boolean; notes: string | null; kata: Kata | null;
}
interface KataComp {
  id: string; date: string;
  tournament: string | null; result: string | null; notes: string | null;
  kata: { id: string; name: string } | null;
}
interface Payment {
  id: string; type: string; amount: number;
  dueDate: string; paidDate: string | null; status: string; note: string | null;
}
interface Student {
  id: string; fullName: string; firstName: string; lastName: string; photo: string | null;
  studentCode: number | null; cedula: string | null;
  fepakaId: string | null; ryoBukaiId: string | null;
  birthDate: string; gender: string; nationality: string;
  condition: string | null; bloodType: string | null;
  hasPrivateInsurance: boolean; insuranceName: string | null; insuranceNumber: string | null;
  motherName: string | null; motherPhone: string | null; motherEmail: string | null;
  fatherName: string | null; fatherPhone: string | null; fatherEmail: string | null;
  address: string | null;
  active: boolean;
  portalUser: { id: string; active: boolean; email: string } | null;
  dojo: { name: string; phone: string | null; slug: string } | null;
  inscription: {
    inscriptionDate: string; annualPaymentDate: string | null;
    annualAmount: number; monthlyAmount: number;
    discountAmount: number; discountNote: string | null;
  } | null;
  beltHistory:      BeltEntry[];
  kataCompetitions: KataComp[];
  payments:         Payment[];
}

// ── Belt History Modal ────────────────────────────────────
function AddBeltModal({ studentId, onClose, onSaved }: { studentId: string; onClose: () => void; onSaved: () => void; }) {
  const [katas,      setKatas]     = useState<Kata[]>([]);
  const [beltColor,  setBeltColor] = useState("blanca");
  const [kataId,     setKataId]    = useState("");
  const [changeDate, setChange]    = useState(new Date().toISOString().split("T")[0]);
  const [isRanking,  setRanking]   = useState(false);
  const [notes,      setNotes]     = useState("");
  const [loading,    setLoading]   = useState(false);

  useEffect(() => {
    fetch("/api/katas?active=1").then(r => r.json()).then(setKatas);
  }, []);

  async function save() {
    setLoading(true);
    await fetch("/api/belt-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, beltColor, kataId: kataId || null, changeDate, isRanking, notes }),
    });
    setLoading(false);
    onSaved();
    onClose();
  }

  const filteredKatas = beltColor ? katas.filter(k => k.beltColor === beltColor) : katas;

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">Color de Cinta *</label>
        <select value={beltColor} onChange={e => { setBeltColor(e.target.value); setKataId(""); }} className="form-input">
          {BELT_COLORS.map(b => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="form-label">Kata del Cambio de Cinta</label>
        <select value={kataId} onChange={e => setKataId(e.target.value)} className="form-input">
          <option value="">— Seleccione un Kata —</option>
          {filteredKatas.map(k => (
            <option key={k.id} value={k.id}>{k.name}</option>
          ))}
          {filteredKatas.length === 0 && (
            <option disabled>No hay katas para esta cinta</option>
          )}
        </select>
        {beltColor && filteredKatas.length === 0 && (
          <p className="text-xs text-dojo-muted mt-1">
            Agrega katas para este nivel en el{" "}
            <Link href="/dashboard/katas" className="text-dojo-red hover:underline">Catálogo de Katas</Link>.
          </p>
        )}
      </div>
      <div>
        <label className="form-label">Fecha de Cambio *</label>
        <input type="date" value={changeDate} onChange={e => setChange(e.target.value)} className="form-input" />
      </div>
      <div className="flex items-center gap-3 p-3 bg-dojo-dark rounded-lg border border-dojo-border">
        <input type="checkbox" id="ranking" checked={isRanking} onChange={e => setRanking(e.target.checked)}
          className="w-4 h-4 accent-dojo-red" />
        <label htmlFor="ranking" className="text-sm text-dojo-white font-medium cursor-pointer flex items-center gap-2">
          <Trophy size={14} className="text-dojo-gold" /> Es cambio de cinta por Ranking / Competencia
        </label>
      </div>
      <div>
        <label className="form-label">Notas adicionales</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          className="form-input min-h-[70px] resize-none" placeholder="Observaciones opcionales..." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="button" onClick={save} disabled={loading} className="btn-primary">
          <Award size={16} /> {loading ? "Guardando..." : "Registrar Cambio"}
        </button>
      </div>
    </div>
  );
}

// ── Edit Belt Modal ───────────────────────────────────────
function EditBeltModal({ entry, onClose, onSaved }: { entry: BeltEntry; onClose: () => void; onSaved: () => void; }) {
  const [katas,      setKatas]     = useState<Kata[]>([]);
  const [beltColor,  setBeltColor] = useState(entry.beltColor);
  const [kataId,     setKataId]    = useState(entry.kata?.id ?? "");
  const [changeDate, setChange]    = useState(new Date(entry.changeDate).toISOString().split("T")[0]);
  const [isRanking,  setRanking]   = useState(entry.isRanking);
  const [notes,      setNotes]     = useState(entry.notes ?? "");
  const [loading,    setLoading]   = useState(false);

  useEffect(() => {
    fetch("/api/katas?active=1").then(r => r.json()).then(setKatas);
  }, []);

  async function save() {
    setLoading(true);
    await fetch(`/api/belt-history/${entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beltColor, kataId: kataId || null, changeDate, isRanking, notes }),
    });
    setLoading(false);
    onSaved();
    onClose();
  }

  const filteredKatas = katas.filter(k => k.beltColor === beltColor);

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">Color de Cinta *</label>
        <select value={beltColor} onChange={e => { setBeltColor(e.target.value); setKataId(""); }} className="form-input">
          {BELT_COLORS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Kata del Cambio de Cinta</label>
        <select value={kataId} onChange={e => setKataId(e.target.value)} className="form-input">
          <option value="">— Seleccione un Kata —</option>
          {filteredKatas.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Fecha de Cambio *</label>
        <input type="date" value={changeDate} onChange={e => setChange(e.target.value)} className="form-input" />
      </div>
      <div className="flex items-center gap-3 p-3 bg-dojo-dark rounded-lg border border-dojo-border">
        <input type="checkbox" id="editRanking" checked={isRanking} onChange={e => setRanking(e.target.checked)}
          className="w-4 h-4 accent-dojo-red" />
        <label htmlFor="editRanking" className="text-sm text-dojo-white font-medium cursor-pointer flex items-center gap-2">
          <Trophy size={14} className="text-dojo-gold" /> Es cambio de cinta por Ranking / Competencia
        </label>
      </div>
      <div>
        <label className="form-label">Notas adicionales</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          className="form-input min-h-[70px] resize-none" placeholder="Observaciones opcionales..." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="button" onClick={save} disabled={loading} className="btn-primary">
          <Award size={16} /> {loading ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </div>
  );
}

// ── Add Kata Competition Modal ────────────────────────────
function AddKataCompModal({ studentId, onClose, onSaved }: { studentId: string; onClose: () => void; onSaved: () => void }) {
  const [katas,      setKatas]      = useState<{ id: string; name: string }[]>([]);
  const [kataId,     setKataId]     = useState("");
  const [date,       setDate]       = useState(new Date().toISOString().split("T")[0]);
  const [tournament, setTournament] = useState("");
  const [result,     setResult]     = useState("");
  const [notes,      setNotes]      = useState("");
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    fetch("/api/katas")
      .then(r => r.json())
      .then((all: { id: string; name: string; description: string | null; active: boolean }[]) =>
        setKatas(all.filter(k => k.description === "Kata de Competencias" && k.active))
      );
  }, []);

  async function save() {
    setLoading(true);
    await fetch("/api/kata-competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, kataId: kataId || null, date, tournament, result, notes }),
    });
    setLoading(false);
    onSaved(); onClose();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">Kata de Competencia</label>
        <select value={kataId} onChange={e => setKataId(e.target.value)} className="form-input">
          <option value="">— Seleccione un Kata —</option>
          {katas.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        {katas.length === 0 && (
          <p className="text-xs text-dojo-muted mt-1">
            No hay katas de competencia. Agrégalos en Configuración → Creación de Katas.
          </p>
        )}
      </div>
      <div>
        <label className="form-label">Fecha *</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Torneo / Competencia</label>
          <input value={tournament} onChange={e => setTournament(e.target.value)}
            className="form-input" placeholder="Ej. Campeonato Nacional 2025" />
        </div>
        <div>
          <label className="form-label">Resultado</label>
          <input value={result} onChange={e => setResult(e.target.value)}
            className="form-input" placeholder="Ej. 1er lugar, Finalista..." />
        </div>
      </div>
      <div>
        <label className="form-label">Notas adicionales</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          className="form-input min-h-[60px] resize-none" placeholder="Observaciones opcionales..." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="button" onClick={save} disabled={loading || !date} className="btn-primary">
          <Star size={15}/> {loading ? "Guardando..." : "Registrar"}
        </button>
      </div>
    </div>
  );
}

// ── Edit Kata Competition Modal ───────────────────────────
function EditKataCompModal({ entry, onClose, onSaved }: { entry: KataComp; onClose: () => void; onSaved: () => void }) {
  const [katas,      setKatas]      = useState<{ id: string; name: string }[]>([]);
  const [kataId,     setKataId]     = useState(entry.kata?.id ?? "");
  const [date,       setDate]       = useState(new Date(entry.date).toISOString().split("T")[0]);
  const [tournament, setTournament] = useState(entry.tournament ?? "");
  const [result,     setResult]     = useState(entry.result ?? "");
  const [notes,      setNotes]      = useState(entry.notes ?? "");
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    fetch("/api/katas")
      .then(r => r.json())
      .then((all: { id: string; name: string; description: string | null; active: boolean }[]) =>
        setKatas(all.filter(k => k.description === "Kata de Competencias" && k.active))
      );
  }, []);

  async function save() {
    setLoading(true);
    await fetch(`/api/kata-competitions/${entry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kataId: kataId || null, date, tournament, result, notes }),
    });
    setLoading(false);
    onSaved(); onClose();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">Kata de Competencia</label>
        <select value={kataId} onChange={e => setKataId(e.target.value)} className="form-input">
          <option value="">— Seleccione un Kata —</option>
          {katas.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Fecha *</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Torneo / Competencia</label>
          <input value={tournament} onChange={e => setTournament(e.target.value)}
            className="form-input" placeholder="Ej. Campeonato Nacional 2025" />
        </div>
        <div>
          <label className="form-label">Resultado</label>
          <input value={result} onChange={e => setResult(e.target.value)}
            className="form-input" placeholder="Ej. 1er lugar, Finalista..." />
        </div>
      </div>
      <div>
        <label className="form-label">Notas adicionales</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          className="form-input min-h-[60px] resize-none" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="button" onClick={save} disabled={loading || !date} className="btn-primary">
          <Star size={15}/> {loading ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </div>
  );
}

// ── Payment Modal ─────────────────────────────────────────
function AddPaymentModal({ studentId, monthlyAmount, onClose, onSaved }: {
  studentId: string; monthlyAmount: number; onClose: () => void; onSaved: () => void;
}) {
  const [type,     setType]    = useState("monthly");
  const [amount,   setAmount]  = useState(String(monthlyAmount || ""));
  const [dueDate,  setDue]     = useState(new Date().toISOString().split("T")[0]);
  const [paidDate, setPaid]    = useState(new Date().toISOString().split("T")[0]);
  const [status,   setStatus]  = useState("paid");
  const [note,     setNote]    = useState("");
  const [loading,  setLoading] = useState(false);

  async function save() {
    setLoading(true);
    await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, type, amount: Number(amount), dueDate, paidDate: status === "paid" ? paidDate : null, status, note }),
    });
    setLoading(false);
    onSaved();
    onClose();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">Tipo de Pago</label>
        <select value={type} onChange={e => setType(e.target.value)} className="form-input">
          <option value="monthly">Mensualidad</option>
          <option value="annual">Anualidad / Inscripción</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Monto (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted text-sm">$</span>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              className="form-input pl-7" placeholder="0.00" />
          </div>
        </div>
        <div>
          <label className="form-label">Estado</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="form-input">
            <option value="paid">Pagado</option>
            <option value="pending">Pendiente</option>
            <option value="late">Atrasado</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Fecha de Vencimiento</label>
          <input type="date" value={dueDate} onChange={e => setDue(e.target.value)} className="form-input" />
        </div>
        {status === "paid" && (
          <div>
            <label className="form-label">Fecha de Pago</label>
            <input type="date" value={paidDate} onChange={e => setPaid(e.target.value)} className="form-input" />
          </div>
        )}
      </div>
      <div>
        <label className="form-label">Nota</label>
        <input value={note} onChange={e => setNote(e.target.value)}
          className="form-input" placeholder="Ej. Pago con descuento, tardío, etc." />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="button" onClick={save} disabled={loading} className="btn-primary">
          <CreditCard size={16} /> {loading ? "Guardando..." : "Registrar Pago"}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function StudentDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [student,      setStudent]    = useState<Student | null>(null);
  const [loading,      setLoading]    = useState(true);
  const [beltModal,       setBeltModal]       = useState(false);
  const [editBelt,        setEditBelt]        = useState<BeltEntry | null>(null);
  const [deletingBelt,    setDeletingBelt]    = useState<string | null>(null);
  const [kataCompModal,   setKataCompModal]   = useState(false);
  const [editKataComp,    setEditKataComp]    = useState<KataComp | null>(null);
  const [deletingKataComp,setDeletingKataComp]= useState<string | null>(null);
  const [payModal,        setPayModal]        = useState(false);
  const [markingPay,      setMarkingPay]      = useState<string | null>(null);
  const [togglingActive,  setTogglingActive]  = useState(false);
  const [accessLoading,   setAccessLoading]   = useState(false);
  const [accessResult,    setAccessResult]    = useState<{ email: string; tempPassword: string } | null>(null);

  const defaultFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const defaultTo   = new Date().toISOString().split("T")[0];
  const [attFrom,     setAttFrom]   = useState(defaultFrom);
  const [attTo,       setAttTo]     = useState(defaultTo);
  const [attList,     setAttList]   = useState<{ id: string; type: string; markedAt: string; schedule: { name: string } | null; corrected: boolean }[]>([]);
  const [attLoading,  setAttLoading] = useState(false);
  const [attLoaded,   setAttLoaded]  = useState(false);

  async function loadAttendance() {
    setAttLoading(true);
    const params = new URLSearchParams({ studentId: id, dateFrom: attFrom, dateTo: attTo + "T23:59:59" });
    const r = await fetch(`/api/attendance?${params}`);
    if (r.ok) setAttList(await r.json());
    setAttLoading(false);
    setAttLoaded(true);
  }

  const fetchStudent = useCallback(async () => {
    const res = await fetch(`/api/students/${id}`);
    if (res.ok) setStudent(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchStudent(); }, [fetchStudent]);

  async function markAsPaid(paymentId: string) {
    setMarkingPay(paymentId);
    await fetch("/api/payments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: paymentId, status: "paid", paidDate: new Date().toISOString() }),
    });
    setMarkingPay(null);
    fetchStudent();
  }

  async function deleteBeltEntry(entryId: string) {
    if (!confirm("¿Eliminar este registro de cinta? Esta acción no se puede deshacer.")) return;
    setDeletingBelt(entryId);
    await fetch(`/api/belt-history/${entryId}`, { method: "DELETE" });
    setDeletingBelt(null);
    fetchStudent();
  }

  async function enableAccess() {
    if (!confirm("¿Crear acceso al portal para este alumno? Se le enviará un correo con su contraseña temporal.")) return;
    setAccessLoading(true);
    const r = await fetch(`/api/students/${id}/access`, { method: "POST" });
    const d = await r.json();
    setAccessLoading(false);
    if (r.ok) { setAccessResult({ email: d.email, tempPassword: d.tempPassword }); fetchStudent(); }
    else alert(d.error ?? "Error al crear acceso");
  }

  async function disableAccess() {
    if (!confirm("¿Desactivar el acceso de este alumno al portal?")) return;
    setAccessLoading(true);
    await fetch(`/api/students/${id}/access`, { method: "DELETE" });
    setAccessLoading(false);
    fetchStudent();
  }

  async function toggleActive() {
    const action = student!.active ? "desactivar" : "activar";
    if (!confirm(`¿Deseas ${action} a este alumno?`)) return;
    setTogglingActive(true);
    const res = await fetch(`/api/students/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...student, active: !student!.active }),
    });
    setTogglingActive(false);
    if (res.ok) fetchStudent();
  }

  async function deleteKataComp(entryId: string) {
    if (!confirm("¿Eliminar este registro de kata? Esta acción no se puede deshacer.")) return;
    setDeletingKataComp(entryId);
    await fetch(`/api/kata-competitions/${entryId}`, { method: "DELETE" });
    setDeletingKataComp(null);
    fetchStudent();
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-dojo-muted">Cargando...</div>;
  if (!student) return <div className="text-center py-20 text-dojo-muted">Alumno no encontrado.</div>;

  const age = calculateAge(student.birthDate);
  const currentBelt = student.beltHistory.length > 0
    ? student.beltHistory.reduce((max, e) =>
        new Date(e.changeDate) > new Date(max.changeDate) ? e : max)
    : null;
  const effectiveMonthly = (student.inscription?.monthlyAmount ?? 0) + (student.inscription?.discountAmount ?? 0);

  return (
    <div className="max-w-5xl space-y-6">
      {accessResult && (
        <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <p className="text-blue-300 font-semibold text-sm flex items-center gap-2">
              <KeyRound size={15}/> Acceso creado — guarda estas credenciales
            </p>
            <button onClick={() => setAccessResult(null)} className="text-blue-400 hover:text-blue-200 text-xs">✕</button>
          </div>
          <div className="bg-dojo-dark rounded-lg p-3 space-y-1.5 font-mono text-sm">
            <div className="flex justify-between"><span className="text-dojo-muted">Correo:</span><span className="text-dojo-white">{accessResult.email}</span></div>
            <div className="flex justify-between"><span className="text-dojo-muted">Contraseña temporal:</span><span className="text-dojo-gold font-bold">{accessResult.tempPassword}</span></div>
          </div>
          <p className="text-xs text-blue-300/70">Se envió también por correo al alumno. Deberá cambiar la contraseña al primer ingreso.</p>
        </div>
      )}

      {!student.active && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-900/20 border border-red-800/50 rounded-xl">
          <UserX size={16} className="text-red-400 shrink-0" />
          <p className="text-red-300 text-sm font-medium">
            Este alumno está <strong>inactivo</strong>. No aparece en la lista principal ni en el scanner.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="btn-ghost"><ArrowLeft size={18}/></button>
          <div className="w-16 h-16 rounded-2xl bg-dojo-border overflow-hidden relative">
            {student.photo
              ? <Image src={student.photo} alt="foto" fill className="object-cover"/>
              : <div className="w-full h-full flex items-center justify-center text-xl font-bold text-dojo-gold">
                  {student.fullName.split(" ").slice(0,2).map(w => w[0]).join("")}
                </div>
            }
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-dojo-white">
              {student.fullName}
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-dojo-muted text-sm">{age} años · {student.nationality}</span>
              {student.studentCode && (
                <span className="font-mono text-xs text-dojo-gold bg-dojo-darker border border-dojo-border px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Fingerprint size={10} /> #{student.studentCode}
                </span>
              )}
              {currentBelt && <BeltBadge beltColor={currentBelt.beltColor} />}
              {currentBelt?.isRanking && <span className="badge-gold flex items-center gap-1"><Trophy size={10}/>Ranking</span>}
            </div>
            {student.fepakaId && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="font-mono text-xs text-dojo-muted bg-dojo-darker border border-dojo-border px-2 py-0.5 rounded-full">
                  Fepaka: <span className="text-dojo-white font-semibold">{student.fepakaId}</span>
                </span>
                {student.ryoBukaiId && (
                  <span className="font-mono text-xs text-dojo-muted bg-dojo-darker border border-dojo-border px-2 py-0.5 rounded-full">
                    Ryo Bukai: <span className="text-dojo-white font-semibold">{student.ryoBukaiId}</span>
                  </span>
                )}
              </div>
            )}
            {!student.fepakaId && student.ryoBukaiId && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="font-mono text-xs text-dojo-muted bg-dojo-darker border border-dojo-border px-2 py-0.5 rounded-full">
                  Ryo Bukai: <span className="text-dojo-white font-semibold">{student.ryoBukaiId}</span>
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {student.portalUser?.active ? (
            <button onClick={disableAccess} disabled={accessLoading}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-orange-800/60 text-orange-400 hover:bg-orange-900/20 transition-colors disabled:opacity-50">
              <KeyRound size={15}/> {accessLoading ? "..." : "Revocar Portal"}
            </button>
          ) : (
            <button onClick={enableAccess} disabled={accessLoading || (!student.motherEmail && !student.fatherEmail)}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-blue-800/60 text-blue-400 hover:bg-blue-900/20 transition-colors disabled:opacity-40"
              title={!student.motherEmail && !student.fatherEmail ? "El alumno necesita un correo registrado" : ""}
            >
              <KeyRound size={15}/> {accessLoading ? "..." : "Dar acceso portal"}
            </button>
          )}
          <button
            onClick={toggleActive}
            disabled={togglingActive}
            className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition-colors disabled:opacity-50 ${
              student.active
                ? "border-red-800/60 text-red-400 hover:bg-red-900/20"
                : "border-green-800/60 text-green-400 hover:bg-green-900/20"
            }`}
          >
            {student.active
              ? <><UserX size={15}/> {togglingActive ? "..." : "Desactivar"}</>
              : <><UserCheck size={15}/> {togglingActive ? "..." : "Activar"}</>
            }
          </button>
          <Link href={`/dashboard/students/${id}/edit`} className="btn-secondary">
            <Edit size={16}/> Editar
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Personal info */}
        <div className="lg:col-span-1 space-y-4">

          {/* Personal */}
          <div className="card">
            <p className="section-title flex items-center gap-2"><Calendar size={13}/>Datos Personales</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-dojo-muted">Fecha nacimiento</dt><dd>{formatDate(student.birthDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-dojo-muted">Género</dt><dd>{student.gender === "M" ? "Masculino" : "Femenino"}</dd></div>
              {student.cedula && (
                <div className="flex justify-between"><dt className="text-dojo-muted">Cédula</dt><dd className="font-mono">{student.cedula}</dd></div>
              )}
            </dl>
          </div>

          {/* QR / ID Card */}
          <StudentQR
            studentCode={student.studentCode}
            fullName={student.fullName}
            cedula={student.cedula}
            address={student.address}
            motherName={student.motherName}
            motherPhone={student.motherPhone}
            fatherName={student.fatherName}
            fatherPhone={student.fatherPhone}
            dojoName={student.dojo?.name ?? "Dojo Manager"}
            dojoPhone={student.dojo?.phone ?? null}
          />

          {/* Health */}
          <div className="card">
            <p className="section-title flex items-center gap-2"><Heart size={13}/>Salud</p>
            <div className="space-y-2 text-sm">
              {student.condition
                ? <p className="text-dojo-white">• {student.condition}</p>
                : <p className="text-dojo-muted italic">Sin condición registrada</p>
              }
              {student.bloodType && (
                <p className="text-dojo-muted">Tipo de sangre: <span className="text-dojo-white font-semibold">{student.bloodType}</span></p>
              )}
              {student.hasPrivateInsurance && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-blue-900/20 border border-blue-800/40 rounded-lg flex-wrap">
                  <Shield size={14} className="text-blue-400"/>
                  <span className="text-blue-300 text-xs font-semibold">{student.insuranceName ?? "Seguro Privado"}</span>
                  {student.insuranceNumber && (
                    <span className="text-blue-300/70 text-xs font-mono ml-1">#{student.insuranceNumber}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Contacts */}
          <div className="card">
            <p className="section-title flex items-center gap-2"><Phone size={13}/>Contactos</p>
            <div className="space-y-3 text-sm">
              {student.motherName && (
                <div>
                  <p className="text-xs text-dojo-muted mb-0.5">Madre</p>
                  <p className="font-semibold text-dojo-white">{student.motherName}</p>
                  {student.motherPhone && <p className="text-dojo-muted">{student.motherPhone}</p>}
                  {student.motherEmail && <p className="text-dojo-muted text-xs">{student.motherEmail}</p>}
                </div>
              )}
              {student.fatherName && (
                <div>
                  <p className="text-xs text-dojo-muted mb-0.5">Padre</p>
                  <p className="font-semibold text-dojo-white">{student.fatherName}</p>
                  {student.fatherPhone && <p className="text-dojo-muted">{student.fatherPhone}</p>}
                  {student.fatherEmail && <p className="text-dojo-muted text-xs">{student.fatherEmail}</p>}
                </div>
              )}
              {student.address && (
                <div>
                  <p className="text-xs text-dojo-muted mb-0.5">Dirección</p>
                  <p className="text-dojo-white text-xs">{student.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Inscription */}
          {student.inscription && (
            <div className="card">
              <p className="section-title flex items-center gap-2"><CreditCard size={13}/>Inscripción</p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-dojo-muted">Inscripción</dt>
                  <dd>{formatDate(student.inscription.inscriptionDate)}</dd>
                </div>
                {student.inscription.annualPaymentDate && (
                  <div className="flex justify-between">
                    <dt className="text-dojo-muted">Anualidad</dt>
                    <dd>{formatDate(student.inscription.annualPaymentDate)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-dojo-muted">Monto anual</dt>
                  <dd className="text-dojo-gold">{formatCurrency(student.inscription.annualAmount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-dojo-muted">Mensualidad base</dt>
                  <dd>{formatCurrency(student.inscription.monthlyAmount)}</dd>
                </div>
                {student.inscription.discountAmount !== 0 && (
                  <div className="flex justify-between">
                    <dt className={student.inscription.discountAmount < 0 ? "text-green-400" : "text-yellow-400"}>
                      {student.inscription.discountAmount < 0 ? "Descuento" : "Aumento"}
                    </dt>
                    <dd className={student.inscription.discountAmount < 0 ? "text-green-400" : "text-yellow-400"}>
                      {student.inscription.discountAmount < 0 ? "-" : "+"}{formatCurrency(Math.abs(student.inscription.discountAmount))}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-dojo-border pt-2 mt-2">
                  <dt className="font-bold text-dojo-white">Total mensual</dt>
                  <dd className="font-bold text-dojo-white">{formatCurrency(effectiveMonthly)}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {/* Right: Belt + Payments */}
        <div className="lg:col-span-2 space-y-4">

          {/* Belt history */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <p className="section-title flex items-center gap-2 mb-0"><Award size={13}/>Historial de Rangos</p>
              <button onClick={() => setBeltModal(true)} className="btn-primary py-1.5 text-sm">
                <Plus size={15}/> Nuevo Rango
              </button>
            </div>
            {student.beltHistory.length === 0 ? (
              <p className="text-center text-dojo-muted py-6 text-sm">Sin historial de rangos.</p>
            ) : (
              <div className="space-y-3">
                {student.beltHistory.map((entry) => {
                  const isCurrent = entry.id === currentBelt?.id;
                  return (
                    <div key={entry.id} className={`flex items-start gap-4 p-3 rounded-lg border ${isCurrent ? "border-dojo-red/40 bg-dojo-red/5" : "border-dojo-border bg-dojo-dark"}`}>
                      <div className="mt-0.5"><BeltBadge beltColor={entry.beltColor} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {entry.kata && <p className="text-sm font-semibold text-dojo-white">{entry.kata.name}</p>}
                          {entry.isRanking && <span className="badge-gold text-xs flex items-center gap-1"><Trophy size={10}/>Ranking</span>}
                          {isCurrent && <span className="badge-blue text-xs">Actual</span>}
                        </div>
                        {entry.notes && <p className="text-xs text-dojo-muted mt-0.5">{entry.notes}</p>}
                      </div>
                      <div className="text-xs text-dojo-muted shrink-0">{formatDate(entry.changeDate)}</div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditBelt(entry)}
                          className="p-1.5 text-dojo-muted hover:text-dojo-white transition-colors rounded"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteBeltEntry(entry.id)}
                          disabled={deletingBelt === entry.id}
                          className="p-1.5 text-dojo-muted hover:text-red-400 transition-colors rounded disabled:opacity-40"
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Kata de Competencias */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <p className="section-title flex items-center gap-2 mb-0">
                <Star size={13} className="text-dojo-gold"/> Historial de Kata de Competencias
              </p>
              <button onClick={() => setKataCompModal(true)} className="btn-primary py-1.5 text-sm">
                <Plus size={15}/> Nueva Kata de Competencia
              </button>
            </div>
            {student.kataCompetitions.length === 0 ? (
              <p className="text-center text-dojo-muted py-6 text-sm">Sin registros de kata de competencia.</p>
            ) : (
              <div className="space-y-3">
                {student.kataCompetitions.map(entry => (
                  <div key={entry.id} className="flex items-start gap-4 p-3 rounded-lg border border-dojo-border bg-dojo-dark">
                    <div className="w-8 h-8 rounded-lg bg-dojo-gold/20 border border-dojo-gold/40 flex items-center justify-center shrink-0 mt-0.5">
                      <Star size={14} className="text-dojo-gold"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-dojo-white">
                        {entry.kata?.name ?? <span className="text-dojo-muted italic">Sin kata seleccionado</span>}
                      </p>
                      {entry.tournament && (
                        <p className="text-xs text-dojo-muted mt-0.5">🏟 {entry.tournament}</p>
                      )}
                      {entry.result && (
                        <p className="text-xs text-dojo-gold font-semibold mt-0.5">🥇 {entry.result}</p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-dojo-muted mt-0.5">{entry.notes}</p>
                      )}
                    </div>
                    <div className="text-xs text-dojo-muted shrink-0">{formatDate(entry.date)}</div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditKataComp(entry)}
                        className="p-1.5 text-dojo-muted hover:text-dojo-white transition-colors rounded"
                        title="Editar"
                      >
                        <Pencil size={13}/>
                      </button>
                      <button
                        onClick={() => deleteKataComp(entry.id)}
                        disabled={deletingKataComp === entry.id}
                        className="p-1.5 text-dojo-muted hover:text-red-400 transition-colors rounded disabled:opacity-40"
                        title="Eliminar"
                      >
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <p className="section-title flex items-center gap-2 mb-0"><CreditCard size={13}/>Historial de Pagos</p>
              <button onClick={() => setPayModal(true)} className="btn-primary py-1.5 text-sm">
                <Plus size={15}/> Registrar Pago
              </button>
            </div>
            {student.payments.length === 0 ? (
              <p className="text-center text-dojo-muted py-6 text-sm">Sin pagos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dojo-border">
                      <th className="text-left text-xs text-dojo-muted px-2 py-2 uppercase">Tipo</th>
                      <th className="text-left text-xs text-dojo-muted px-2 py-2 uppercase">Monto</th>
                      <th className="text-left text-xs text-dojo-muted px-2 py-2 uppercase">Vencimiento</th>
                      <th className="text-left text-xs text-dojo-muted px-2 py-2 uppercase">Pago</th>
                      <th className="text-left text-xs text-dojo-muted px-2 py-2 uppercase">Estado</th>
                      <th className="text-right text-xs text-dojo-muted px-2 py-2 uppercase">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.payments.map(p => {
                      const st = PAYMENT_STATUS_LABELS[p.status] ?? { label: p.status, className: "badge-blue" };
                      return (
                        <tr key={p.id} className="border-b border-dojo-border/40 hover:bg-dojo-border/10">
                          <td className="px-2 py-2 capitalize text-dojo-white">
                            {p.type === "monthly" ? "Mensualidad" : "Anualidad"}
                          </td>
                          <td className="px-2 py-2 text-dojo-gold font-semibold">{formatCurrency(p.amount)}</td>
                          <td className="px-2 py-2 text-dojo-muted">{formatDate(p.dueDate)}</td>
                          <td className="px-2 py-2 text-dojo-muted">{p.paidDate ? formatDate(p.paidDate) : "—"}</td>
                          <td className="px-2 py-2"><span className={st.className}>{st.label}</span></td>
                          <td className="px-2 py-2 text-right">
                            {p.status !== "paid" && (
                              <button
                                onClick={() => markAsPaid(p.id)}
                                disabled={markingPay === p.id}
                                className="text-xs text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                              >
                                {markingPay === p.id ? "..." : "Marcar pagado"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {student.payments.length >= 24 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-dojo-border">
                <p className="text-xs text-dojo-muted">
                  Mostrando los últimos 24 pagos.
                </p>
                <a
                  href={`/dashboard/payments`}
                  className="text-xs text-dojo-red hover:underline"
                >
                  Ver historial completo →
                </a>
              </div>
            )}
          </div>

          {/* Asistencia */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <p className="section-title flex items-center gap-2 mb-0">
                <ClipboardList size={13}/> Asistencia
              </p>
            </div>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="flex-1 min-w-[130px]">
                <label className="form-label text-xs">Desde</label>
                <input type="date" value={attFrom} onChange={e => setAttFrom(e.target.value)} className="form-input" />
              </div>
              <div className="flex-1 min-w-[130px]">
                <label className="form-label text-xs">Hasta</label>
                <input type="date" value={attTo} onChange={e => setAttTo(e.target.value)} className="form-input" />
              </div>
              <div className="flex items-end">
                <button onClick={loadAttendance} disabled={attLoading} className="btn-secondary text-sm py-2">
                  {attLoading ? "..." : "Filtrar"}
                </button>
              </div>
            </div>
            {attLoaded && (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {([
                    { label: "Total",    value: attList.length,                                  color: "text-dojo-white" },
                    { label: "Entradas", value: attList.filter(a => a.type === "entry").length,  color: "text-green-400"  },
                    { label: "Salidas",  value: attList.filter(a => a.type === "exit").length,   color: "text-red-400"    },
                  ] as const).map(s => (
                    <div key={s.label} className="bg-dojo-dark border border-dojo-border rounded-lg p-3 text-center">
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-dojo-muted">{s.label}</p>
                    </div>
                  ))}
                </div>
                {attList.length === 0 ? (
                  <p className="text-center text-dojo-muted text-sm py-4">Sin marcaciones en este período.</p>
                ) : (
                  <div className="space-y-2">
                    {attList.map(a => (
                      <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-dojo-dark border border-dojo-border">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          a.type === "entry" ? "bg-green-900/40" : "bg-red-900/40"
                        }`}>
                          {a.type === "entry"
                            ? <LogIn size={13} className="text-green-400"/>
                            : <LogOut size={13} className="text-red-400"/>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-dojo-white">
                            {new Date(a.markedAt).toLocaleDateString("es-PA")}
                            {" — "}
                            {new Date(a.markedAt).toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {a.schedule && <p className="text-xs text-dojo-muted truncate">{a.schedule.name}</p>}
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          a.type === "entry" ? "text-green-400 bg-green-900/30" : "text-red-400 bg-red-900/30"
                        }`}>
                          {a.type === "entry" ? "Entrada" : "Salida"}
                        </span>
                        {a.corrected && <span className="badge-yellow text-xs">Corregida</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <Modal open={beltModal} onClose={() => setBeltModal(false)} title="Registrar Cambio de Cinta" size="md">
        <AddBeltModal studentId={id} onClose={() => setBeltModal(false)} onSaved={fetchStudent} />
      </Modal>
      <Modal open={!!editBelt} onClose={() => setEditBelt(null)} title="Editar Registro de Cinta" size="md">
        {editBelt && (
          <EditBeltModal entry={editBelt} onClose={() => setEditBelt(null)} onSaved={fetchStudent} />
        )}
      </Modal>
      <Modal open={kataCompModal} onClose={() => setKataCompModal(false)} title="Nueva Kata de Competencia" size="md">
        <AddKataCompModal studentId={id} onClose={() => setKataCompModal(false)} onSaved={fetchStudent} />
      </Modal>
      <Modal open={!!editKataComp} onClose={() => setEditKataComp(null)} title="Editar Kata de Competencia" size="md">
        {editKataComp && (
          <EditKataCompModal entry={editKataComp} onClose={() => setEditKataComp(null)} onSaved={fetchStudent} />
        )}
      </Modal>
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Registrar Pago" size="md">
        <AddPaymentModal
          studentId={id}
          monthlyAmount={effectiveMonthly}
          onClose={() => setPayModal(false)}
          onSaved={fetchStudent}
        />
      </Modal>
    </div>
  );
}
