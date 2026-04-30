"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  User, Heart, Phone, CreditCard, Award,
  Camera, ChevronDown, ChevronUp, Save, ArrowLeft, Calendar, Loader2
} from "lucide-react";
import { cn, calculateAge, BELT_COLORS, GENDERS, NATIONALITIES } from "@/lib/utils";

interface InscriptionData {
  inscriptionDate: string;
  annualPaymentDate: string;
  annualAmount: string;
  monthlyAmount: string;
  discountAmount: string;
  discountNote: string;
}

interface FormData {
  fullName: string;
  cedula: string;
  fepakaId: string;
  ryoBukaiId: string;
  birthDate: string;
  gender: string;
  nationality: string;
  condition: string;
  bloodType: string;
  hasPrivateInsurance: boolean;
  insuranceName: string;
  insuranceNumber: string;
  motherName: string;
  motherPhone: string;
  motherEmail: string;
  fatherName: string;
  fatherPhone: string;
  fatherEmail: string;
  address: string;
  inscription: InscriptionData;
}

interface StudentFormProps {
  defaultValues?: Partial<FormData> & {
    id?: string; photo?: string | null; studentCode?: number | null;
    fepakaId?: string | null; ryoBukaiId?: string | null;
    fullName?: string;
  };
  isEdit?: boolean;
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between mb-0"
      >
        <p className={cn("section-title flex items-center gap-2 mb-0", open && "mb-4")}>
          <Icon size={14} /> {title}
        </p>
        {open ? <ChevronUp size={16} className="text-dojo-muted" /> : <ChevronDown size={16} className="text-dojo-muted" />}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default function StudentForm({ defaultValues, isEdit = false }: StudentFormProps) {
  const router = useRouter();
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      fullName:   defaultValues?.fullName   ?? "",
      cedula:     defaultValues?.cedula     ?? "",
      fepakaId:   defaultValues?.fepakaId   ?? "",
      ryoBukaiId: defaultValues?.ryoBukaiId ?? "",
      birthDate: defaultValues?.birthDate
        ? new Date(defaultValues.birthDate).toISOString().split("T")[0]
        : "",
      gender:      defaultValues?.gender      ?? "M",
      nationality: defaultValues?.nationality ?? "Panameña",
      condition:   defaultValues?.condition   ?? "",
      bloodType:   defaultValues?.bloodType   ?? "",
      hasPrivateInsurance: defaultValues?.hasPrivateInsurance ?? false,
      insuranceName:   defaultValues?.insuranceName   ?? "",
      insuranceNumber: defaultValues?.insuranceNumber ?? "",
      motherName:  defaultValues?.motherName  ?? "",
      motherPhone: defaultValues?.motherPhone ?? "",
      motherEmail: defaultValues?.motherEmail ?? "",
      fatherName:  defaultValues?.fatherName  ?? "",
      fatherPhone: defaultValues?.fatherPhone ?? "",
      fatherEmail: defaultValues?.fatherEmail ?? "",
      address: defaultValues?.address ?? "",
      inscription: {
        inscriptionDate:  defaultValues?.inscription?.inscriptionDate
          ? new Date(defaultValues.inscription.inscriptionDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        annualPaymentDate: defaultValues?.inscription?.annualPaymentDate
          ? new Date(defaultValues.inscription.annualPaymentDate).toISOString().split("T")[0]
          : "",
        annualAmount:  String(defaultValues?.inscription?.annualAmount  ?? ""),
        monthlyAmount: String(defaultValues?.inscription?.monthlyAmount ?? ""),
        discountAmount: String(defaultValues?.inscription?.discountAmount ?? "0"),
        discountNote:  defaultValues?.inscription?.discountNote ?? "",
      },
    },
  });

  const [photo,          setPhoto]         = useState<string | null>(defaultValues?.photo ?? null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError,     setPhotoError]     = useState("");
  const [age,            setAge]            = useState<number | null>(null);
  const [error,          setError]          = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const birthDate          = watch("birthDate");
  const hasInsurance       = watch("hasPrivateInsurance");
  const discountAmount     = watch("inscription.discountAmount");
  const hasDiscount        = discountAmount && Number(discountAmount) !== 0;

  useEffect(() => {
    if (birthDate) setAge(calculateAge(birthDate));
    else           setAge(null);
  }, [birthDate]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "image");
      fd.append("purpose", "student-photo");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al subir imagen");
      setPhoto(data.url);
    } catch (err: unknown) {
      setPhotoError(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setPhotoUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSubmit(data: FormData) {
    setError("");
    const trimmed   = data.fullName.trim();
    const parts     = trimmed.split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName  = parts.slice(1).join(" ");
    const { fullName: _, ...rest } = data;
    const payload = { ...rest, fullName: trimmed, firstName, lastName, photo };

    const url    = isEdit ? `/api/students/${defaultValues?.id}` : "/api/students";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let body: Record<string, unknown> = {};
    try { body = text ? JSON.parse(text) : {}; } catch { /* non-JSON response */ }

    if (!res.ok) {
      setError((body.error as string) ?? `Error ${res.status} al guardar el alumno`);
      return;
    }

    router.push(`/dashboard/students/${(body as { id: string }).id}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button type="button" onClick={() => router.back()} className="btn-ghost text-sm mb-2">
            <ArrowLeft size={16} /> Volver
          </button>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide">
            {isEdit ? "Editar Alumno" : "Nuevo Alumno"}
          </h1>
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          <Save size={18} /> {isSubmitting ? "Guardando..." : "Guardar Alumno"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">
          {error}
        </div>
      )}

      {/* ── DATOS PERSONALES ── */}
      <Section title="Datos Personales" icon={User}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Photo upload */}
          <div className="flex flex-col items-center gap-3">
            <div
              onClick={() => !photoUploading && fileRef.current?.click()}
              className={cn(
                "w-44 h-44 rounded-2xl bg-dojo-border border-2 border-dashed border-dojo-border transition-colors relative group overflow-hidden",
                photoUploading ? "cursor-wait opacity-70" : "hover:border-dojo-red cursor-pointer",
              )}
            >
              {photoUploading ? (
                <div className="flex flex-col items-center justify-center h-full text-dojo-muted">
                  <Loader2 size={28} className="animate-spin mb-1" />
                  <p className="text-xs">Subiendo...</p>
                </div>
              ) : photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="foto" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-dojo-muted">
                  <Camera size={28} className="mb-1" />
                  <p className="text-xs">Foto</p>
                </div>
              )}
              {!photoUploading && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={20} className="text-white" />
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
            {photoError && <p className="text-xs text-red-400 text-center">{photoError}</p>}
            {photo && !photoUploading && (
              <button type="button" onClick={() => setPhoto(null)} className="text-xs text-dojo-muted hover:text-red-400 transition-colors">
                Quitar foto
              </button>
            )}
          </div>

          {/* Fields */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Nombre Completo *</label>
              <input
                {...register("fullName", {
                  required: "El nombre es obligatorio",
                  validate: v => v.trim().length >= 2 || "Ingrese al menos nombre y apellido",
                })}
                className={cn("form-input", errors.fullName && "border-red-600")}
                placeholder="Ej. Carlos Rodríguez"
              />
              {errors.fullName && (
                <p className="text-xs text-red-400 mt-1">{errors.fullName.message}</p>
              )}
            </div>
            <div>
              <label className="form-label flex items-center gap-1">
                <Calendar size={12} /> Fecha de Nacimiento *
              </label>
              <input type="date" {...register("birthDate", { required: true })}
                className={cn("form-input", errors.birthDate && "border-red-600")} />
              {age !== null && (
                <p className="text-xs text-dojo-gold mt-1 font-semibold">✦ Edad calculada: {age} años</p>
              )}
            </div>
            <div>
              <label className="form-label">Cédula / Pasaporte</label>
              <input {...register("cedula")} className="form-input" placeholder="Ej. 8-123-4567" />
            </div>
            <div>
              <label className="form-label">Género *</label>
              <select {...register("gender")} className="form-input">
                {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Nacionalidad *</label>
              <select {...register("nationality")} className="form-input">
                {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {/* Código Fepaka */}
            <div>
              <label className="form-label">Código Fepaka</label>
              {(() => {
                const { onChange: rhfOnChange, ...fepakaRest } = register("fepakaId", {
                  maxLength: { value: 15, message: "Máximo 15 caracteres" },
                });
                return (
                  <input
                    {...fepakaRest}
                    onChange={e => {
                      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
                      rhfOnChange(e);
                    }}
                    className={cn("form-input font-mono", errors.fepakaId && "border-red-600")}
                    placeholder="Ej. FEP001"
                    maxLength={15}
                  />
                );
              })()}
              {errors.fepakaId && <p className="text-xs text-red-400 mt-1">{errors.fepakaId.message}</p>}
            </div>

            {/* Pasaporte Ryo Bukai */}
            <div>
              <label className="form-label">Pasaporte Ryo Bukai</label>
              {(() => {
                const { onChange: rhfOnChange, ...ryoRest } = register("ryoBukaiId", {
                  maxLength: { value: 15, message: "Máximo 15 caracteres" },
                });
                return (
                  <input
                    {...ryoRest}
                    onChange={e => {
                      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
                      rhfOnChange(e);
                    }}
                    className={cn("form-input font-mono", errors.ryoBukaiId && "border-red-600")}
                    placeholder="Ej. RYO001"
                    maxLength={15}
                  />
                );
              })()}
              {errors.ryoBukaiId && <p className="text-xs text-red-400 mt-1">{errors.ryoBukaiId.message}</p>}
            </div>

            {isEdit && defaultValues?.studentCode && (
              <div className="col-span-2 flex items-center gap-2 text-xs text-dojo-muted bg-dojo-darker rounded-lg px-3 py-2">
                <span className="font-mono text-dojo-gold font-bold">ID #{defaultValues.studentCode}</span>
                <span>— código generado automáticamente</span>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── SALUD ── */}
      <Section title="Salud" icon={Heart}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Condición</label>
            <input {...register("condition")} className="form-input"
              placeholder="Ej. Asma leve, hipertensión..." />
          </div>
          <div>
            <label className="form-label">Tipo de Sangre</label>
            <select {...register("bloodType")} className="form-input">
              <option value="">— Desconocido —</option>
              {["O+","O-","A+","A-","B+","B-","AB+","AB-"].map(bt => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 p-3 bg-dojo-dark rounded-lg border border-dojo-border">
              <input
                type="checkbox"
                id="insurance"
                {...register("hasPrivateInsurance")}
                className="w-4 h-4 accent-dojo-red"
              />
              <label htmlFor="insurance" className="text-sm text-dojo-white font-medium cursor-pointer">
                Posee seguro médico privado
              </label>
            </div>
            {hasInsurance && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Nombre de la Aseguradora</label>
                  <input {...register("insuranceName")} className="form-input"
                    placeholder="Ej. ASSA, Mapfre, Panamá Seguros..." />
                </div>
                <div>
                  <label className="form-label">Número de Seguro</label>
                  {(() => {
                    const { onChange: rhfOnChange, ...insRest } = register("insuranceNumber", {
                      maxLength: { value: 25, message: "Máximo 25 caracteres" },
                    });
                    return (
                      <input
                        {...insRest}
                        onChange={e => {
                          e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, "").slice(0, 25);
                          rhfOnChange(e);
                        }}
                        className={cn("form-input font-mono", errors.insuranceNumber && "border-red-600")}
                        placeholder="Ej. 123456789"
                        maxLength={25}
                      />
                    );
                  })()}
                  {errors.insuranceNumber && (
                    <p className="text-xs text-red-400 mt-1">{errors.insuranceNumber.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── CONTACTOS ── */}
      <Section title="Datos de Contacto" icon={Phone}>
        <div className="space-y-6">
          {/* Madre */}
          <div>
            <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-4 h-px bg-dojo-border inline-block" /> Madre / Tutora
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Nombre completo</label>
                <input {...register("motherName")} className="form-input" placeholder="Nombre de la madre" />
              </div>
              <div>
                <label className="form-label">Celular</label>
                <input {...register("motherPhone")} className="form-input" placeholder="+507 6000-0000" />
              </div>
              <div>
                <label className="form-label">Correo electrónico</label>
                <input type="email" {...register("motherEmail")} className="form-input" placeholder="madre@email.com" />
              </div>
            </div>
          </div>

          {/* Padre */}
          <div>
            <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-4 h-px bg-dojo-border inline-block" /> Padre / Tutor
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Nombre completo</label>
                <input {...register("fatherName")} className="form-input" placeholder="Nombre del padre" />
              </div>
              <div>
                <label className="form-label">Celular</label>
                <input {...register("fatherPhone")} className="form-input" placeholder="+507 6000-0000" />
              </div>
              <div>
                <label className="form-label">Correo electrónico</label>
                <input type="email" {...register("fatherEmail")} className="form-input" placeholder="padre@email.com" />
              </div>
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="form-label">Dirección de Vivienda</label>
            <textarea {...register("address")} className="form-input min-h-[80px] resize-none"
              placeholder="Corregimiento, sector, calle, número de casa..." />
          </div>
        </div>
      </Section>

      {/* ── INSCRIPCIÓN Y MENSUALIDADES ── */}
      <Section title="Inscripción y Mensualidades" icon={CreditCard}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Fecha de Inscripción</label>
            <input type="date" {...register("inscription.inscriptionDate")} className="form-input" />
          </div>
          <div>
            <label className="form-label">Fecha de Pago de Anualidad</label>
            <input type="date" {...register("inscription.annualPaymentDate")} className="form-input" />
          </div>
          <div>
            <label className="form-label">Monto de Inscripción / Anualidad (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted text-sm">$</span>
              <input type="number" step="0.01" {...register("inscription.annualAmount")}
                className="form-input pl-7" placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="form-label">Mensualidad Base (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted text-sm">$</span>
              <input type="number" step="0.01" {...register("inscription.monthlyAmount")}
                className="form-input pl-7" placeholder="0.00" />
            </div>
          </div>

          {/* Discount/increase line */}
          <div className="md:col-span-2">
            <div className="bg-dojo-dark rounded-lg border border-dojo-border p-4">
              <label className="form-label">Ajuste de Mensualidad</label>
              <p className="text-xs text-dojo-muted mb-3">
                Ingrese un monto negativo para aplicar <span className="text-green-400">descuento</span>,
                o positivo para un <span className="text-yellow-400">aumento</span>. Deje en 0 si no aplica.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Monto Ajuste (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted text-sm">$</span>
                    <input type="number" step="0.01" {...register("inscription.discountAmount")}
                      className={cn("form-input pl-7",
                        hasDiscount && Number(discountAmount) < 0 && "border-green-700",
                        hasDiscount && Number(discountAmount) > 0 && "border-yellow-700"
                      )}
                      placeholder="Ej. -10.00 o +5.00" />
                  </div>
                  {hasDiscount && (
                    <p className={cn("text-xs mt-1 font-semibold",
                      Number(discountAmount) < 0 ? "text-green-400" : "text-yellow-400"
                    )}>
                      {Number(discountAmount) < 0 ? `▼ Descuento de $${Math.abs(Number(discountAmount)).toFixed(2)}` : `▲ Aumento de $${Number(discountAmount).toFixed(2)}`}
                    </p>
                  )}
                </div>
                <div>
                  <label className="form-label">Motivo del Ajuste</label>
                  <input {...register("inscription.discountNote")} className="form-input"
                    placeholder="Ej. Hermano inscrito, beca deportiva..." />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── RANGO INICIAL (solo en creación) ── */}
      {!isEdit && (
        <div className="card mb-4">
          <p className="section-title flex items-center gap-2"><Award size={14}/> Rango Inicial</p>
          <p className="text-xs text-dojo-muted">
            Podrás registrar el rango y el historial de cintas desde la página del alumno una vez guardado.
          </p>
        </div>
      )}

      {/* Bottom save */}
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={isSubmitting} className="btn-primary px-8">
          <Save size={18} /> {isSubmitting ? "Guardando..." : "Guardar Alumno"}
        </button>
      </div>
    </form>
  );
}
