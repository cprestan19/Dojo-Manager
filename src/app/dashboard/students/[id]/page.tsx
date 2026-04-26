"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Edit, Award, CreditCard, Phone,
  Heart, Calendar, Plus, Shield, Trophy
} from "lucide-react";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { Modal } from "@/components/ui/Modal";
import { calculateAge, formatDate, formatCurrency, BELT_COLORS, PAYMENT_STATUS_LABELS } from "@/lib/utils";
import Image from "next/image";

interface Kata { id: string; name: string; beltColor: string; }
interface BeltEntry {
  id: string; beltColor: string; changeDate: string;
  isRanking: boolean; notes: string | null; kata: Kata | null;
}
interface Payment {
  id: string; type: string; amount: number;
  dueDate: string; paidDate: string | null; status: string; note: string | null;
}
interface Student {
  id: string; firstName: string; lastName: string; photo: string | null;
  birthDate: string; gender: string; nationality: string;
  allergy1: string | null; allergy2: string | null;
  hasPrivateInsurance: boolean; insuranceName: string | null;
  motherName: string | null; motherPhone: string | null; motherEmail: string | null;
  fatherName: string | null; fatherPhone: string | null; fatherEmail: string | null;
  auxContactName: string | null; auxContactPhone: string | null; address: string | null;
  active: boolean;
  inscription: {
    inscriptionDate: string; annualPaymentDate: string | null;
    annualAmount: number; monthlyAmount: number;
    discountAmount: number; discountNote: string | null;
  } | null;
  beltHistory: BeltEntry[];
  payments: Payment[];
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
    fetch("/api/katas").then(r => r.json()).then(setKatas);
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
  const [beltModal,    setBeltModal]  = useState(false);
  const [payModal,     setPayModal]   = useState(false);
  const [markingPay,   setMarkingPay] = useState<string | null>(null);

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

  if (loading) return <div className="flex items-center justify-center h-64 text-dojo-muted">Cargando...</div>;
  if (!student) return <div className="text-center py-20 text-dojo-muted">Alumno no encontrado.</div>;

  const age          = calculateAge(student.birthDate);
  const currentBelt  = student.beltHistory[0];
  const effectiveMonthly = (student.inscription?.monthlyAmount ?? 0) + (student.inscription?.discountAmount ?? 0);

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="btn-ghost"><ArrowLeft size={18}/></button>
          <div className="w-16 h-16 rounded-2xl bg-dojo-border overflow-hidden relative">
            {student.photo
              ? <Image src={student.photo} alt="foto" fill className="object-cover"/>
              : <div className="w-full h-full flex items-center justify-center text-xl font-bold text-dojo-gold">
                  {student.firstName[0]}{student.lastName[0]}
                </div>
            }
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-dojo-white">
              {student.firstName} {student.lastName}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-dojo-muted text-sm">{age} años · {student.nationality}</span>
              {currentBelt && <BeltBadge beltColor={currentBelt.beltColor} />}
              {currentBelt?.isRanking && <span className="badge-gold flex items-center gap-1"><Trophy size={10}/>Ranking</span>}
            </div>
          </div>
        </div>
        <Link href={`/dashboard/students/${id}/edit`} className="btn-secondary">
          <Edit size={16}/> Editar
        </Link>
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
            </dl>
          </div>

          {/* Health */}
          <div className="card">
            <p className="section-title flex items-center gap-2"><Heart size={13}/>Salud</p>
            <div className="space-y-2 text-sm">
              {student.allergy1 && <p className="text-dojo-white">• {student.allergy1}</p>}
              {student.allergy2 && <p className="text-dojo-white">• {student.allergy2}</p>}
              {!student.allergy1 && !student.allergy2 && <p className="text-dojo-muted italic">Sin alergias registradas</p>}
              {student.hasPrivateInsurance && (
                <div className="flex items-center gap-2 mt-3 p-2 bg-blue-900/20 border border-blue-800/40 rounded-lg">
                  <Shield size={14} className="text-blue-400"/>
                  <span className="text-blue-300 text-xs font-semibold">{student.insuranceName ?? "Seguro Privado"}</span>
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
              {student.auxContactName && (
                <div>
                  <p className="text-xs text-dojo-muted mb-0.5">Contacto Auxiliar</p>
                  <p className="font-semibold text-dojo-white">{student.auxContactName}</p>
                  {student.auxContactPhone && <p className="text-dojo-muted">{student.auxContactPhone}</p>}
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
                {student.beltHistory.map((entry, i) => (
                  <div key={entry.id} className={`flex items-start gap-4 p-3 rounded-lg border ${i === 0 ? "border-dojo-red/40 bg-dojo-red/5" : "border-dojo-border bg-dojo-dark"}`}>
                    <div className="mt-0.5"><BeltBadge beltColor={entry.beltColor} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.kata && <p className="text-sm font-semibold text-dojo-white">{entry.kata.name}</p>}
                        {entry.isRanking && <span className="badge-gold text-xs flex items-center gap-1"><Trophy size={10}/>Ranking</span>}
                        {i === 0 && <span className="badge-blue text-xs">Actual</span>}
                      </div>
                      {entry.notes && <p className="text-xs text-dojo-muted mt-0.5">{entry.notes}</p>}
                    </div>
                    <div className="text-xs text-dojo-muted shrink-0">{formatDate(entry.changeDate)}</div>
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
          </div>
        </div>
      </div>

      {/* Modals */}
      <Modal open={beltModal} onClose={() => setBeltModal(false)} title="Registrar Cambio de Cinta" size="md">
        <AddBeltModal studentId={id} onClose={() => setBeltModal(false)} onSaved={fetchStudent} />
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
