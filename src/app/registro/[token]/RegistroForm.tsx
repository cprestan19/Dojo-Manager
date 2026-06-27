"use client";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from "lucide-react";

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;

interface Props { token: string; dojoName: string }

type FormData = {
  fullName: string; firstName: string; lastName: string;
  birthDate: string; gender: string; nationality: string;
  cedula: string; fepakaId: string; ryoBukaiId: string;
  bloodType: string; condition: string; hasPrivateInsurance: boolean;
  insuranceName: string; insuranceNumber: string;
  motherName: string; motherPhone: string; motherEmail: string;
  fatherName: string; fatherPhone: string; fatherEmail: string;
  address: string;
};

const INIT: FormData = {
  fullName: "", firstName: "", lastName: "", birthDate: "", gender: "", nationality: "",
  cedula: "", fepakaId: "", ryoBukaiId: "",
  bloodType: "", condition: "", hasPrivateInsurance: false, insuranceName: "", insuranceNumber: "",
  motherName: "", motherPhone: "", motherEmail: "",
  fatherName: "", fatherPhone: "", fatherEmail: "", address: "",
};

function Section({ title, open, toggle, children }: {
  title: string; open: boolean; toggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-dojo-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-dojo-card hover:bg-dojo-border/30 transition-colors text-left"
      >
        <span className="font-semibold text-dojo-white">{title}</span>
        {open ? <ChevronUp size={18} className="text-dojo-muted" /> : <ChevronDown size={18} className="text-dojo-muted" />}
      </button>
      {open && <div className="p-4 space-y-4 bg-dojo-darker">{children}</div>}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="form-label text-sm">
        {label}{required && <span className="text-dojo-red ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function RegistroForm({ token, dojoName }: Props) {
  const [form, setForm] = useState<FormData>(INIT);
  const [sections, setSections] = useState({ personal: true, salud: false, contactos: false });
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");

  // Marcar como enviado en localStorage para que recarga de página no permita reenvío
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(`registro-sent-${token}`)) {
      setDone(true);
    }
  }, [token]);

  const set = (key: keyof FormData, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const toggleSection = (key: keyof typeof sections) =>
    setSections(prev => ({ ...prev, [key]: !prev[key] }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.fullName || !form.firstName || !form.lastName || !form.birthDate || !form.gender || !form.nationality) {
      setError("Completa todos los campos obligatorios.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        fepakaId:   form.fepakaId.toUpperCase()   || null,
        ryoBukaiId: form.ryoBukaiId.toUpperCase() || null,
        bloodType:  form.bloodType   || null,
        cedula:     form.cedula      || null,
        condition:  form.condition   || null,
        insuranceName:   form.insuranceName   || null,
        insuranceNumber: form.insuranceNumber || null,
        motherName:  form.motherName  || null,
        motherPhone: form.motherPhone || null,
        motherEmail: form.motherEmail || null,
        fatherName:  form.fatherName  || null,
        fatherPhone: form.fatherPhone || null,
        fatherEmail: form.fatherEmail || null,
        address:     form.address     || null,
      };

      const res = await fetch(`/api/public/register/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Error al enviar. Intenta de nuevo.");
        return;
      }
      localStorage.setItem(`registro-sent-${token}`, "1");
      setDone(true);
    } catch {
      setError("Error de conexión. Revisa tu red e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <CheckCircle2 size={56} className="text-green-400" />
        <h2 className="text-xl font-bold text-dojo-white">¡Solicitud enviada!</h2>
        <p className="text-dojo-muted max-w-xs">
          {dojoName} revisará tu información y te contactará pronto para confirmar la inscripción.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Datos Personales ── */}
      <Section title="1. Datos Personales" open={sections.personal} toggle={() => toggleSection("personal")}>
        <Field label="Nombre completo" required>
          <input className="form-input" value={form.fullName} onChange={e => set("fullName", e.target.value)}
            placeholder="Apellido Nombre" maxLength={200} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primer nombre" required>
            <input className="form-input" value={form.firstName} onChange={e => set("firstName", e.target.value)}
              placeholder="Nombre" maxLength={100} />
          </Field>
          <Field label="Apellido" required>
            <input className="form-input" value={form.lastName} onChange={e => set("lastName", e.target.value)}
              placeholder="Apellido" maxLength={100} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de nacimiento" required>
            <input type="date" className="form-input" value={form.birthDate} onChange={e => set("birthDate", e.target.value)} />
          </Field>
          <Field label="Género" required>
            <select className="form-input" value={form.gender} onChange={e => set("gender", e.target.value)}>
              <option value="">Seleccionar</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </Field>
        </div>
        <Field label="Nacionalidad" required>
          <input className="form-input" value={form.nationality} onChange={e => set("nationality", e.target.value)}
            placeholder="Ej: Panameña" maxLength={100} />
        </Field>
        <Field label="Cédula / Documento">
          <input className="form-input" value={form.cedula} onChange={e => set("cedula", e.target.value)}
            placeholder="Opcional" maxLength={30} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID FEPAKA">
            <input className="form-input uppercase" value={form.fepakaId} onChange={e => set("fepakaId", e.target.value.toUpperCase())}
              placeholder="Opcional" maxLength={15} />
          </Field>
          <Field label="ID Ryo Bukai">
            <input className="form-input uppercase" value={form.ryoBukaiId} onChange={e => set("ryoBukaiId", e.target.value.toUpperCase())}
              placeholder="Opcional" maxLength={15} />
          </Field>
        </div>
      </Section>

      {/* ── Datos de Salud ── */}
      <Section title="2. Datos de Salud" open={sections.salud} toggle={() => toggleSection("salud")}>
        <Field label="Tipo de sangre">
          <select className="form-input" value={form.bloodType} onChange={e => set("bloodType", e.target.value)}>
            <option value="">No indicado</option>
            {BLOOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Condición de salud / Alergias">
          <textarea className="form-input resize-none" rows={3} value={form.condition}
            onChange={e => set("condition", e.target.value)} maxLength={500}
            placeholder="Ej: Asma, alergia a picadura de abejas..." />
        </Field>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="insurance" checked={form.hasPrivateInsurance}
            onChange={e => set("hasPrivateInsurance", e.target.checked)}
            className="w-4 h-4 accent-dojo-red" />
          <label htmlFor="insurance" className="text-dojo-white text-sm">Tiene seguro médico privado</label>
        </div>
        {form.hasPrivateInsurance && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre del seguro">
              <input className="form-input" value={form.insuranceName}
                onChange={e => set("insuranceName", e.target.value)} maxLength={200} />
            </Field>
            <Field label="Número de póliza">
              <input className="form-input" value={form.insuranceNumber}
                onChange={e => set("insuranceNumber", e.target.value)} maxLength={25} />
            </Field>
          </div>
        )}
      </Section>

      {/* ── Contactos ── */}
      <Section title="3. Contactos y Dirección" open={sections.contactos} toggle={() => toggleSection("contactos")}>
        <p className="text-dojo-muted text-xs">Al menos un contacto es recomendado para emergencias.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre de la madre">
            <input className="form-input" value={form.motherName}
              onChange={e => set("motherName", e.target.value)} maxLength={200} />
          </Field>
          <Field label="Teléfono">
            <input className="form-input" type="tel" value={form.motherPhone}
              onChange={e => set("motherPhone", e.target.value)} maxLength={30} />
          </Field>
        </div>
        <Field label="Email de la madre">
          <input className="form-input" type="email" value={form.motherEmail}
            onChange={e => set("motherEmail", e.target.value)} maxLength={200} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre del padre">
            <input className="form-input" value={form.fatherName}
              onChange={e => set("fatherName", e.target.value)} maxLength={200} />
          </Field>
          <Field label="Teléfono">
            <input className="form-input" type="tel" value={form.fatherPhone}
              onChange={e => set("fatherPhone", e.target.value)} maxLength={30} />
          </Field>
        </div>
        <Field label="Email del padre">
          <input className="form-input" type="email" value={form.fatherEmail}
            onChange={e => set("fatherEmail", e.target.value)} maxLength={200} />
        </Field>
        <Field label="Dirección">
          <textarea className="form-input resize-none" rows={2} value={form.address}
            onChange={e => set("address", e.target.value)} maxLength={500}
            placeholder="Calle, ciudad, provincia..." />
        </Field>
      </Section>

      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Enviando..." : "Enviar solicitud de inscripción"}
      </button>

      <p className="text-xs text-dojo-muted text-center">
        Tu información será revisada por {dojoName} antes de ser registrada.
      </p>
    </form>
  );
}
