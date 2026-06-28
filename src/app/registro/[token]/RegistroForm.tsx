"use client";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Camera, ShieldCheck, Clock, Users } from "lucide-react";
import PhotoCropper from "@/components/ui/PhotoCropper";

const BLOOD_TYPES       = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;
const INSURANCE_COMPANIES = ["MAPFRE","PALIG","SURA","FEDPA","ANCON","ACERTA","IS","ASSA SEGUROS","ALIADO SEGUROS","BLUE CROSS"] as const;
const MAX_PHOTO_BYTES   = 5 * 1024 * 1024;

interface Props {
  token:     string;
  dojoName:  string;
  dojoLogo:  string | null;
  expiresAt: string | null;
  reset?:    boolean;
}

type Step = "splash" | "form" | "done" | "already-submitted";

type FormData = {
  fullName: string;
  birthDate: string; gender: string; nationality: string;
  cedula: string; fepakaId: string; ryoBukaiId: string;
  bloodType: string; condition: string; hasPrivateInsurance: boolean;
  insuranceName: string; insuranceNumber: string;
  motherName: string; motherPhone: string; motherEmail: string;
  fatherName: string; fatherPhone: string; fatherEmail: string;
  address: string; photo: string;
  hasSiblingInDojo: boolean;
  primaryGuardian: "" | "mother" | "father";
};

type FieldErrors = Partial<Record<keyof FormData, string>>;

const INIT: FormData = {
  fullName: "", birthDate: "", gender: "", nationality: "",
  cedula: "", fepakaId: "", ryoBukaiId: "",
  bloodType: "", condition: "", hasPrivateInsurance: false,
  insuranceName: "", insuranceNumber: "",
  motherName: "", motherPhone: "", motherEmail: "",
  fatherName: "", fatherPhone: "", fatherEmail: "",
  address: "", photo: "",
  hasSiblingInDojo: false,
  primaryGuardian: "",
};

function Section({ title, open, toggle, hasError, children }: {
  title: string; open: boolean; toggle: () => void; hasError?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`border rounded-lg overflow-hidden ${hasError ? "border-red-600" : "border-dojo-border"}`}>
      <button type="button" onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-dojo-card hover:bg-dojo-border/30 transition-colors text-left">
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

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString("es-PA", {
    timeZone: "America/Panama",
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export default function RegistroForm({ token, dojoName, dojoLogo, expiresAt, reset }: Props) {
  const [step,     setStep]     = useState<Step>("splash");
  const [form,     setForm]     = useState<FormData>(INIT);
  const [errors,   setErrors]   = useState<FieldErrors>({});
  const [sections, setSections] = useState({ personal: true, salud: false, contactos: false });
  const [loading,   setLoading]   = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [rawPhoto,  setRawPhoto]  = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `registro-sent-${token}`;
    if (reset) {
      localStorage.removeItem(key);
    } else if (localStorage.getItem(key)) {
      setStep("already-submitted");
    }
  }, [token, reset]);

  const set = (key: keyof FormData, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const clearError = (key: keyof FormData) =>
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors(prev => ({ ...prev, photo: "El archivo debe ser una imagen (JPG, PNG, HEIC, etc.)." }));
      if (photoRef.current) photoRef.current.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors(prev => ({ ...prev, photo: "La imagen no debe superar 5 MB. Comprime o recorta antes de subir." }));
      if (photoRef.current) photoRef.current.value = "";
      return;
    }
    clearError("photo");
    const reader = new FileReader();
    reader.onload = ev => setRawPhoto((ev.target?.result as string) ?? "");
    reader.readAsDataURL(file);
  }

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!form.fullName.trim())    e.fullName    = "El nombre completo es obligatorio.";
    if (!form.birthDate)          e.birthDate   = "La fecha de nacimiento es obligatoria.";
    if (!form.gender)             e.gender      = "Selecciona el género.";
    if (!form.nationality.trim()) e.nationality = "La nacionalidad es obligatoria.";
    // Acudiente principal — requerido si se llenó algún dato de contacto
    const hasAnyGuardian = form.motherName.trim() || form.motherEmail.trim() ||
                           form.fatherName.trim()  || form.fatherEmail.trim();
    if (hasAnyGuardian && !form.primaryGuardian) {
      e.primaryGuardian = "Selecciona quién es el acudiente principal del alumno.";
    }
    if (form.primaryGuardian === "mother" && !form.motherEmail.trim()) {
      e.motherEmail = "El acudiente principal debe tener un correo electrónico.";
    }
    if (form.primaryGuardian === "father" && !form.fatherEmail.trim()) {
      e.fatherEmail = "El acudiente principal debe tener un correo electrónico.";
    }
    return e;
  }

  const personalErrorKeys: (keyof FormData)[] = ["fullName","birthDate","gender","nationality"];
  const hasPersonalError  = (errs: FieldErrors) => personalErrorKeys.some(k => errs[k]);
  const contactErrorKeys:  (keyof FormData)[] = ["primaryGuardian","motherEmail","fatherEmail"];
  const hasContactError   = (errs: FieldErrors) => contactErrorKeys.some(k => errs[k]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError("");

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      if (hasPersonalError(errs)) setSections(p => ({ ...p, personal: true }));
      if (hasContactError(errs))  setSections(p => ({ ...p, contactos: true }));
      setGlobalError("Por favor completa todos los campos obligatorios marcados con *");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setLoading(true);
    try {
      const nameParts = form.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] ?? "";
      const lastName  = nameParts.slice(1).join(" ") || firstName;

      const payload = {
        ...form,
        firstName,
        lastName,
        primaryGuardian: form.primaryGuardian || null,
        fepakaId:        form.fepakaId.toUpperCase()   || null,
        ryoBukaiId:      form.ryoBukaiId.toUpperCase() || null,
        bloodType:       form.bloodType       || null,
        cedula:          form.cedula          || null,
        condition:       form.condition       || null,
        insuranceName:   form.insuranceName   || null,
        insuranceNumber: form.insuranceNumber || null,
        motherName:      form.motherName      || null,
        motherPhone:     form.motherPhone     || null,
        motherEmail:     form.motherEmail     || null,
        fatherName:      form.fatherName      || null,
        fatherPhone:     form.fatherPhone     || null,
        fatherEmail:     form.fatherEmail     || null,
        address:         form.address         || null,
        photo:           form.photo           || null,
      };

      const res = await fetch(`/api/public/register/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; field?: string };
        const msg  = data.error ?? "Error al enviar. Intenta de nuevo.";
        setGlobalError(msg);

        // Marcar el campo duplicado y abrir la sección correspondiente
        if (res.status === 409) {
          if (data.field === "cedula") {
            setErrors(prev => ({ ...prev, cedula: msg }));
            setSections(p => ({ ...p, personal: true }));
          } else if (data.field === "email") {
            setErrors(prev => ({ ...prev, motherEmail: msg, fatherEmail: msg }));
            setSections(p => ({ ...p, contactos: true }));
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
        return;
      }
      localStorage.setItem(`registro-sent-${token}`, "1");
      setStep("done");
    } catch {
      setGlobalError("Error de conexión. Revisa tu red e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // ── Pantalla de bienvenida / confidencialidad ─────────────────────────────
  if (step === "splash") {
    return (
      <div className="flex flex-col items-center gap-6 py-6 px-2 text-center">
        {/* Logo */}
        {dojoLogo ? (
          <img src={dojoLogo} alt={dojoName}
            className="w-24 h-24 object-contain rounded-2xl border border-dojo-border shadow-lg" />
        ) : (
          <div className="w-24 h-24 bg-dojo-red rounded-2xl flex items-center justify-center shadow-lg shadow-dojo-red/20">
            <span className="text-4xl select-none">🥋</span>
          </div>
        )}

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-dojo-gold">Formulario de Inscripción</p>
          <h2 className="text-xl font-bold text-dojo-white font-display leading-tight">{dojoName}</h2>
        </div>

        {/* Confidencialidad */}
        <div className="bg-dojo-card border border-green-800/40 rounded-lg p-4 text-left w-full">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={15} className="text-green-400 shrink-0" />
            <span className="font-semibold text-green-300 text-sm">Información Confidencial</span>
          </div>
          <p className="text-dojo-muted text-sm leading-relaxed">
            Los datos que proporciones serán utilizados exclusivamente para tu inscripción en{" "}
            <strong className="text-dojo-white">{dojoName}</strong> y tratados de forma segura y privada.
            No serán compartidos con terceros.
          </p>
        </div>

        {/* Vencimiento del link */}
        {expiresAt && (
          <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-800/40 rounded-lg px-4 py-3 w-full text-left">
            <Clock size={14} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-300 leading-snug">
              Este enlace estará disponible hasta el{" "}
              <strong className="text-yellow-200">{formatExpiry(expiresAt)}</strong>.
            </p>
          </div>
        )}

        <button onClick={() => setStep("form")} className="btn-primary w-full py-3 text-base">
          Acepto · Completar el formulario
        </button>

        <p className="text-xs text-dojo-muted leading-relaxed">
          Al continuar, aceptas que tu información sea procesada por{" "}
          <strong className="text-dojo-white">{dojoName}</strong> con fines de inscripción.
        </p>
      </div>
    );
  }

  // ── Ya enviaste (localStorage) ────────────────────────────────────────────
  if (step === "already-submitted") {
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        {dojoLogo && (
          <img src={dojoLogo} alt={dojoName}
            className="w-16 h-16 object-contain rounded-xl border border-dojo-border opacity-80" />
        )}
        <div className="w-14 h-14 bg-blue-900/30 rounded-full flex items-center justify-center border border-blue-800/40">
          <CheckCircle2 size={28} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-dojo-white">Ya enviaste tu solicitud</h2>
          <p className="text-dojo-muted text-sm mt-2 max-w-xs leading-relaxed">
            Recibimos tu solicitud de inscripción en{" "}
            <strong className="text-dojo-white">{dojoName}</strong>.
            Está siendo revisada por el equipo del dojo.
          </p>
        </div>
        <div className="bg-dojo-card border border-dojo-border rounded-lg p-4 text-sm text-dojo-muted text-left w-full max-w-sm leading-relaxed">
          <p>
            Si necesitas <strong className="text-dojo-white">modificar</strong> tu información o
            cometiste algún error, comunícate con{" "}
            <strong className="text-dojo-white">{dojoName}</strong> para que te envíen un nuevo
            enlace de inscripción.
          </p>
        </div>
      </div>
    );
  }

  // ── Enviado con éxito ─────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <CheckCircle2 size={56} className="text-green-400" />
        <h2 className="text-xl font-bold text-dojo-white">¡Solicitud enviada!</h2>
        <p className="text-dojo-muted max-w-xs leading-relaxed">
          Hemos recibido la solicitud de inscripción.{" "}
          <strong className="text-dojo-white">{dojoName}</strong> la revisará y se comunicará
          contigo para confirmar el registro.
        </p>
        <p className="text-dojo-muted text-xs max-w-xs">
          Si proporcionaste un correo electrónico recibirás una confirmación por email.
        </p>
      </div>
    );
  }

  // ── Formulario ────────────────────────────────────────────────────────────
  return (
    <>
    {rawPhoto && (
      <PhotoCropper
        imageSrc={rawPhoto}
        onCancel={() => { setRawPhoto(null); if (photoRef.current) photoRef.current.value = ""; }}
        onSave={(cropped) => { set("photo", cropped); clearError("photo"); setRawPhoto(null); }}
      />
    )}
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-dojo-muted">
        Los campos marcados con <span className="text-dojo-red font-bold">*</span> son obligatorios.
      </p>

      {/* Banner de error — visible al tope */}
      {globalError && (
        <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-600 rounded-lg p-3 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {globalError}
        </div>
      )}

      {/* ── 1. Datos Personales ── */}
      <Section
        title="1. Datos Personales"
        open={sections.personal}
        toggle={() => setSections(p => ({ ...p, personal: !p.personal }))}
        hasError={hasPersonalError(errors)}
      >
        {/* Foto */}
        <Field label="Foto del alumno (opcional)" error={errors.photo}>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              {form.photo ? (
                <img src={form.photo} alt="Vista previa"
                  className="w-20 h-20 rounded-lg object-cover border border-dojo-border shrink-0" />
              ) : (
                <div className={`w-20 h-20 rounded-lg border-2 border-dashed flex items-center justify-center shrink-0 ${errors.photo ? "border-red-600 bg-red-900/10" : "border-dojo-border"}`}>
                  <Camera size={24} className={errors.photo ? "text-red-400" : "text-dojo-muted"} />
                </div>
              )}
              <div className="space-y-1 flex-1 min-w-0">
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
        <Field label="Cédula / Documento" error={errors.cedula}>
          <input className={inputCls(errors.cedula)} value={form.cedula}
            onChange={e => { set("cedula", e.target.value); clearError("cedula"); }} placeholder="Opcional" maxLength={30} />
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

      {/* ── 2. Datos de Salud ── */}
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
                onChange={e => set("insuranceNumber", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 25))}
                maxLength={25} placeholder="Ej. 123456789" />
            </Field>
          </div>
        )}
      </Section>

      {/* ── 3. Contactos y Dirección ── */}
      <Section
        title="3. Contactos y Dirección"
        open={sections.contactos}
        toggle={() => setSections(p => ({ ...p, contactos: !p.contactos }))}
        hasError={hasContactError(errors)}
      >
        {/* Hermano/a en el dojo */}
        <div className="flex items-start gap-3 bg-dojo-card/60 border border-dojo-border rounded-lg p-3">
          <input type="checkbox" id="sibling" checked={form.hasSiblingInDojo}
            onChange={e => set("hasSiblingInDojo", e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-dojo-red shrink-0" />
          <label htmlFor="sibling" className="text-sm cursor-pointer">
            <span className="flex items-center gap-1.5 text-dojo-white font-medium">
              <Users size={13} className="text-dojo-gold shrink-0" />
              Tengo un hermano/a ya inscrito/a en este dojo
            </span>
            <span className="block text-xs text-dojo-muted mt-0.5 leading-relaxed">
              Activa esta opción si un familiar comparte el mismo correo de contacto.
              El administrador vinculará los perfiles de familia al aprobar.
            </span>
          </label>
        </div>

        <p className="text-dojo-muted text-xs">Al menos un contacto es recomendado para emergencias.</p>

        {/* Error de acudiente principal */}
        {errors.primaryGuardian && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={11} />{errors.primaryGuardian}
          </p>
        )}

        {/* Madre */}
        <div className={`border rounded-lg p-3 space-y-3 transition-colors ${form.primaryGuardian === "mother" ? "border-dojo-gold/50 bg-dojo-gold/5" : "border-dojo-border/60"}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-dojo-white">Madre</span>
            <label className="flex items-center gap-1.5 cursor-pointer select-none group">
              <input type="radio" name="primaryGuardian" value="mother"
                checked={form.primaryGuardian === "mother"}
                onChange={() => { set("primaryGuardian", "mother"); clearError("primaryGuardian"); }}
                className="w-3.5 h-3.5 accent-dojo-red" />
              <span className="text-xs text-dojo-muted group-hover:text-dojo-gold transition-colors leading-tight">
                Acudiente principal
                <span className="block text-dojo-muted/70 text-[10px] leading-tight">Este correo será tu usuario para el portal</span>
              </span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre">
              <input className="form-input" value={form.motherName}
                onChange={e => set("motherName", e.target.value)} maxLength={200} />
            </Field>
            <Field label="Teléfono">
              <input className="form-input" type="tel" value={form.motherPhone}
                onChange={e => set("motherPhone", e.target.value)} maxLength={30} />
            </Field>
          </div>
          <Field label="Email" error={errors.motherEmail}>
            <input className={inputCls(errors.motherEmail)} type="email" value={form.motherEmail}
              onChange={e => { set("motherEmail", e.target.value); clearError("motherEmail"); clearError("primaryGuardian"); }} maxLength={200} />
          </Field>
        </div>

        {/* Padre */}
        <div className={`border rounded-lg p-3 space-y-3 transition-colors ${form.primaryGuardian === "father" ? "border-dojo-gold/50 bg-dojo-gold/5" : "border-dojo-border/60"}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-dojo-white">Padre</span>
            <label className="flex items-center gap-1.5 cursor-pointer select-none group">
              <input type="radio" name="primaryGuardian" value="father"
                checked={form.primaryGuardian === "father"}
                onChange={() => { set("primaryGuardian", "father"); clearError("primaryGuardian"); }}
                className="w-3.5 h-3.5 accent-dojo-red" />
              <span className="text-xs text-dojo-muted group-hover:text-dojo-gold transition-colors leading-tight">
                Acudiente principal
                <span className="block text-dojo-muted/70 text-[10px] leading-tight">Este correo será tu usuario para el portal</span>
              </span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre">
              <input className="form-input" value={form.fatherName}
                onChange={e => set("fatherName", e.target.value)} maxLength={200} />
            </Field>
            <Field label="Teléfono">
              <input className="form-input" type="tel" value={form.fatherPhone}
                onChange={e => set("fatherPhone", e.target.value)} maxLength={30} />
            </Field>
          </div>
          <Field label="Email" error={errors.fatherEmail}>
            <input className={inputCls(errors.fatherEmail)} type="email" value={form.fatherEmail}
              onChange={e => { set("fatherEmail", e.target.value); clearError("fatherEmail"); clearError("primaryGuardian"); }} maxLength={200} />
          </Field>
        </div>
        <Field label="Dirección">
          <textarea className="form-input resize-none" rows={2} value={form.address}
            onChange={e => set("address", e.target.value)} maxLength={500}
            placeholder="Calle, ciudad, provincia..." />
        </Field>
      </Section>

      <div className="flex gap-3">
        <button type="button" disabled={loading}
          onClick={() => { setForm(INIT); setErrors({}); setGlobalError(""); setStep("splash"); }}
          className="btn-secondary flex-1">
          Cancelar
        </button>
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? "Enviando..." : "Enviar solicitud"}
        </button>
      </div>

      <p className="text-xs text-dojo-muted text-center">
        Tu información será revisada por {dojoName} antes de ser registrada.
      </p>
    </form>
    </>
  );
}
