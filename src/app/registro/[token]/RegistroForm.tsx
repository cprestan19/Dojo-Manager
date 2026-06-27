"use client";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Camera } from "lucide-react";

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;
const INSURANCE_COMPANIES = ["MAPFRE","PALIG","SURA","FEDPA","ANCON","ACERTA","IS","ASSA SEGUROS","ALIADO SEGUROS","BLUE CROSS"] as const;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

interface Props { token: string; dojoName: string; reset?: boolean }

type FormData = {
  fullName: string; firstName: string; lastName: string;
  birthDate: string; gender: string; nationality: string;
  cedula: string; fepakaId: string; ryoBukaiId: string;
  bloodType: string; condition: string; hasPrivateInsurance: boolean;
  insuranceName: string; insuranceNumber: string;
  motherName: string; motherPhone: string; motherEmail: string;
  fatherName: string; fatherPhone: string; fatherEmail: string;
  address: string;
  photo: string;
};

type FieldErrors = Partial<Record<keyof FormData, string>>;

const INIT: FormData = {
  fullName: "", firstName: "", lastName: "", birthDate: "", gender: "", nationality: "",
  cedula: "", fepakaId: "", ryoBukaiId: "",
  bloodType: "", condition: "", hasPrivateInsurance: false, insuranceName: "", insuranceNumber: "",
  motherName: "", motherPhone: "", motherEmail: "",
  fatherName: "", fatherPhone: "", fatherEmail: "", address: "",
  photo: "",
};

function Section({ title, open, toggle, hasError, children }: {
  title: string; open: boolean; toggle: () => void; hasError?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`border rounded-lg overflow-hidden ${hasError ? "border-red-600" : "border-dojo-border"}`}>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-dojo-card hover:bg-dojo-border/30 transition-colors text-left"
      >
        <span className="font-semibold text-dojo-white flex items-center gap-2">
          {title}
          {hasError && <span className="text-xs font-normal text-red-400">(campos requeridos incompletos)</span>}
        </span>
        {open ? <ChevronUp size={18} className="text-dojo-muted" /> : <ChevronDown size={18} className="text-dojo-muted" />}
      </button>
      {open && <div className="p-4 space-y-4 bg-dojo-darker">{children}</div>}
    </div>
  );
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="form-label text-sm">
        {label}{required && <span className="text-dojo-red ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
    </div>
  );
}

function inputCls(error?: string) {
  return `form-input ${error ? "border-red-600 focus:ring-red-500" : ""}`;
}

export default function RegistroForm({ token, dojoName, reset }: Props) {
  const [form, setForm]       = useState<FormData>(INIT);
  const [errors, setErrors]   = useState<FieldErrors>({});
  const [sections, setSections] = useState({ personal: true, salud: false, contactos: false });
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [globalError, setGlobalError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `registro-sent-${token}`;
    if (reset) {
      localStorage.removeItem(key);
    } else if (localStorage.getItem(key)) {
      setDone(true);
    }
  }, [token, reset]);

  const set = (key: keyof FormData, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const clearError = (key: keyof FormData) =>
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors(prev => ({ ...prev, photo: "La imagen no debe superar 5 MB. Comprime o recorta antes de subir." }));
      if (photoRef.current) photoRef.current.value = "";
      return;
    }
    clearError("photo");
    const reader = new FileReader();
    reader.onload = ev => set("photo", (ev.target?.result as string) ?? "");
    reader.readAsDataURL(file);
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!form.photo)       e.photo       = "La foto del alumno es obligatoria.";
    if (!form.fullName.trim())  e.fullName    = "El nombre completo es obligatorio.";
    if (!form.firstName.trim()) e.firstName   = "El primer nombre es obligatorio.";
    if (!form.lastName.trim())  e.lastName    = "El apellido es obligatorio.";
    if (!form.birthDate)        e.birthDate   = "La fecha de nacimiento es obligatoria.";
    if (!form.gender)           e.gender      = "Selecciona el género.";
    if (!form.nationality.trim()) e.nationality = "La nacionalidad es obligatoria.";
    return e;
  }

  const personalErrorKeys: (keyof FormData)[] = ["photo","fullName","firstName","lastName","birthDate","gender","nationality"];
  const hasPersonalError = (errs: FieldErrors) => personalErrorKeys.some(k => errs[k]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError("");

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      if (hasPersonalError(errs)) setSections(p => ({ ...p, personal: true }));
      setGlobalError("Por favor completa todos los campos obligatorios marcados con *");
      // Scroll al inicio para que el usuario vea los errores en la sección de Datos Personales
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        photo:       form.photo       || null,
      };

      const res = await fetch(`/api/public/register/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGlobalError((data as { error?: string }).error ?? "Error al enviar. Intenta de nuevo.");
        return;
      }
      localStorage.setItem(`registro-sent-${token}`, "1");
      setDone(true);
    } catch {
      setGlobalError("Error de conexión. Revisa tu red e intenta de nuevo.");
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
          Hemos recibido la solicitud de inscripción. <strong className="text-dojo-white">{dojoName}</strong> la revisará
          y se comunicará contigo para confirmar el registro.
        </p>
        <p className="text-dojo-muted text-xs max-w-xs">
          Si proporcionaste un correo electrónico recibirás una confirmación por email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-dojo-muted">
        Los campos marcados con <span className="text-dojo-red font-bold">*</span> son obligatorios.
      </p>

      {/* Banner de error global — visible al tope para que el usuario lo vea sin scrollear */}
      {globalError && (
        <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-600 rounded-lg p-3 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {globalError}
        </div>
      )}

      {/* ── Datos Personales ── */}
      <Section
        title="1. Datos Personales"
        open={sections.personal}
        toggle={() => setSections(p => ({ ...p, personal: !p.personal }))}
        hasError={hasPersonalError(errors)}
      >
        {/* Foto del alumno */}
        <Field label="Foto del alumno" required error={errors.photo}>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              {form.photo ? (
                <img src={form.photo} alt="Vista previa" className="w-20 h-20 rounded-lg object-cover border border-dojo-border shrink-0" />
              ) : (
                <div className={`w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center shrink-0 ${errors.photo ? "border-red-600 bg-red-900/10" : "border-dojo-border"}`}>
                  <Camera size={24} className={errors.photo ? "text-red-400" : "text-dojo-muted"} />
                </div>
              )}
              <div className="space-y-1 flex-1">
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="btn-secondary text-sm w-full text-center">
                  {form.photo ? "Cambiar foto" : "Seleccionar foto"}
                </button>
                <p className="text-xs text-dojo-muted leading-relaxed">
                  De pecho hacia arriba · No cuerpo completo · Fondo neutro · Máx. 5 MB
                </p>
              </div>
            </div>
            <input ref={photoRef} type="file" accept="image/*" capture="user"
              className="hidden" onChange={handlePhotoChange} />
          </div>
        </Field>

        <Field label="Nombre completo" required error={errors.fullName}>
          <input className={inputCls(errors.fullName)} value={form.fullName}
            onChange={e => { set("fullName", e.target.value); clearError("fullName"); }}
            placeholder="Apellido Nombre" maxLength={200} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primer nombre" required error={errors.firstName}>
            <input className={inputCls(errors.firstName)} value={form.firstName}
              onChange={e => { set("firstName", e.target.value); clearError("firstName"); }}
              placeholder="Nombre" maxLength={100} />
          </Field>
          <Field label="Apellido" required error={errors.lastName}>
            <input className={inputCls(errors.lastName)} value={form.lastName}
              onChange={e => { set("lastName", e.target.value); clearError("lastName"); }}
              placeholder="Apellido" maxLength={100} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de nacimiento" required error={errors.birthDate}>
            <input type="date" className={inputCls(errors.birthDate)} value={form.birthDate}
              onChange={e => { set("birthDate", e.target.value); clearError("birthDate"); }} />
          </Field>
          <Field label="Género" required error={errors.gender}>
            <select className={inputCls(errors.gender)} value={form.gender}
              onChange={e => { set("gender", e.target.value); clearError("gender"); }}>
              <option value="">Seleccionar</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </Field>
        </div>
        <Field label="Nacionalidad" required error={errors.nationality}>
          <input className={inputCls(errors.nationality)} value={form.nationality}
            onChange={e => { set("nationality", e.target.value); clearError("nationality"); }}
            placeholder="Ej: Panameña" maxLength={100} />
        </Field>
        <Field label="Cédula / Documento">
          <input className="form-input" value={form.cedula}
            onChange={e => set("cedula", e.target.value)} placeholder="Opcional" maxLength={30} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID FEPAKA">
            <input className="form-input uppercase" value={form.fepakaId}
              onChange={e => set("fepakaId", e.target.value.toUpperCase())} placeholder="Opcional" maxLength={15} />
          </Field>
          <Field label="ID Ryo Bukai">
            <input className="form-input uppercase" value={form.ryoBukaiId}
              onChange={e => set("ryoBukaiId", e.target.value.toUpperCase())} placeholder="Opcional" maxLength={15} />
          </Field>
        </div>
      </Section>

      {/* ── Datos de Salud ── */}
      <Section
        title="2. Datos de Salud"
        open={sections.salud}
        toggle={() => setSections(p => ({ ...p, salud: !p.salud }))}
      >
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
            <Field label="Aseguradora">
              <select className="form-input" value={form.insuranceName}
                onChange={e => set("insuranceName", e.target.value)}>
                <option value="">— Seleccionar —</option>
                {INSURANCE_COMPANIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Número de póliza">
              <input className="form-input font-mono" value={form.insuranceNumber}
                onChange={e => set("insuranceNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 25))}
                maxLength={25} placeholder="Ej. 123456789" />
            </Field>
          </div>
        )}
      </Section>

      {/* ── Contactos ── */}
      <Section
        title="3. Contactos y Dirección"
        open={sections.contactos}
        toggle={() => setSections(p => ({ ...p, contactos: !p.contactos }))}
      >
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

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Enviando..." : "Enviar solicitud de inscripción"}
      </button>

      <p className="text-xs text-dojo-muted text-center">
        Tu información será revisada por {dojoName} antes de ser registrada.
      </p>
    </form>
  );
}
