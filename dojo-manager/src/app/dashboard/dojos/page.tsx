"use client";
import { useState, useEffect } from "react";
import { Building2, Plus, Users, GraduationCap, Globe, CheckCircle, XCircle, Copy, KeyRound, Eye, EyeOff, Lock } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface Dojo {
  id: string; name: string; slug: string; logo: string | null;
  active: boolean; createdAt: string;
  _count: { users: number; students: number };
}

interface CreatedAdmin { email: string; tempPassword: string; loginUrl: string; }

const defaultForm = { name: "", slug: "", adminPassword: "", showPass: false };

export default function DojosPage() {
  const [dojos,        setDojos]        = useState<Dojo[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [modal,        setModal]        = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [form,         setForm]         = useState(defaultForm);
  const [error,        setError]        = useState("");
  const [createdAdmin, setCreatedAdmin] = useState<CreatedAdmin | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/dojos");
    if (r.ok) setDojos(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function slugify(text: string) {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  function handleNameChange(name: string) {
    setForm(f => ({ ...f, name, slug: slugify(name) }));
  }

  function closeModal() {
    setModal(false); setError(""); setForm(defaultForm);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");

    if (form.adminPassword.length < 8) {
      setError("La contraseña del admin debe tener al menos 8 caracteres.");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/dojos", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: form.name, slug: form.slug, adminPassword: form.adminPassword }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Error al crear el dojo");
      setSaving(false);
      return;
    }

    setCreatedAdmin({
      email:        data.adminEmail,
      tempPassword: form.adminPassword,
      loginUrl:     `/login?dojo=${data.slug}`,
    });
    closeModal();
    load();
    setSaving(false);
  }

  async function toggleActive(dojo: Dojo) {
    await fetch(`/api/dojos/${dojo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: dojo.name, active: !dojo.active }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <Building2 size={28} className="text-dojo-red" /> Gestión de Dojos
          </h1>
          <p className="text-dojo-muted text-sm mt-1">Administra todos los dojos de la plataforma</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nuevo Dojo
        </button>
      </div>

      {loading ? (
        <div className="text-dojo-muted text-center py-16">Cargando dojos...</div>
      ) : dojos.length === 0 ? (
        <div className="card text-center py-16">
          <Building2 size={40} className="text-dojo-muted mx-auto mb-3" />
          <p className="text-dojo-muted">No hay dojos registrados aún.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dojos.map(dojo => (
            <div key={dojo.id} className={`card space-y-4 ${!dojo.active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-dojo-red rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                    {dojo.logo
                      ? <img src={dojo.logo} alt={dojo.name} className="w-full h-full object-contain" />
                      : <span className="text-white text-xl font-display font-bold">{dojo.name[0]}</span>
                    }
                  </div>
                  <div>
                    <p className="text-dojo-white font-semibold">{dojo.name}</p>
                    <p className="text-dojo-muted text-xs font-mono">{dojo.slug}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(dojo)}
                  title={dojo.active ? "Desactivar" : "Activar"}
                  className="text-dojo-muted hover:text-dojo-white transition-colors"
                >
                  {dojo.active
                    ? <CheckCircle size={18} className="text-green-400" />
                    : <XCircle size={18} className="text-red-400" />
                  }
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-dojo-darker rounded-lg p-3 text-center">
                  <Users size={14} className="text-dojo-muted mx-auto mb-1" />
                  <p className="text-dojo-white font-bold text-lg">{dojo._count.users}</p>
                  <p className="text-dojo-muted text-xs">Usuarios</p>
                </div>
                <div className="bg-dojo-darker rounded-lg p-3 text-center">
                  <GraduationCap size={14} className="text-dojo-muted mx-auto mb-1" />
                  <p className="text-dojo-white font-bold text-lg">{dojo._count.students}</p>
                  <p className="text-dojo-muted text-xs">Alumnos</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-dojo-muted border-t border-dojo-border pt-3">
                <Globe size={12} />
                <a
                  href={`/login?dojo=${dojo.slug}`}
                  target="_blank" rel="noopener noreferrer"
                  className="hover:text-dojo-gold transition-colors truncate"
                >
                  /login?dojo={dojo.slug}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credenciales auto-generadas tras crear dojo */}
      {createdAdmin && (
        <div className="card border-dojo-gold/30 bg-dojo-gold/5 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-dojo-gold" />
            <p className="font-semibold text-dojo-gold text-sm">Credenciales del administrador creado</p>
          </div>
          <p className="text-dojo-muted text-xs">Comparte estos datos con el administrador del dojo. Deberá cambiar la contraseña al primer ingreso.</p>
          <div className="space-y-2">
            {[
              { label: "Email",      value: createdAdmin.email },
              { label: "Contraseña", value: createdAdmin.tempPassword },
              { label: "URL acceso", value: window.location.origin + createdAdmin.loginUrl },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between gap-3 bg-dojo-darker rounded-lg px-3 py-2">
                <div>
                  <p className="text-dojo-muted text-xs">{label}</p>
                  <p className="text-dojo-white text-sm font-mono">{value}</p>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(value)}
                  className="text-dojo-muted hover:text-dojo-gold transition-colors"
                  title="Copiar"
                >
                  <Copy size={14} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setCreatedAdmin(null)} className="btn-ghost text-xs w-full justify-center">
            Cerrar
          </button>
        </div>
      )}

      {/* Modal nuevo dojo */}
      <Modal open={modal} onClose={closeModal} title="Nuevo Dojo">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="form-label">Nombre del Dojo</label>
            <input
              type="text" value={form.name} onChange={e => handleNameChange(e.target.value)}
              className="form-input" placeholder="Ej. Dojo Shotokan Norte" required
            />
          </div>
          <div>
            <label className="form-label">Slug (URL)</label>
            <div className="flex items-center gap-2 bg-dojo-darker border border-dojo-border rounded-lg px-3 py-2">
              <Globe size={14} className="text-dojo-muted" />
              <span className="text-dojo-muted text-sm">/login?dojo=</span>
              <input
                type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="bg-transparent text-dojo-gold text-sm font-mono flex-1 outline-none" required
              />
            </div>
          </div>

          {/* Admin auto-generado */}
          <div className="border-t border-dojo-border pt-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound size={14} className="text-dojo-gold" />
              <p className="text-dojo-white text-sm font-semibold">Administrador del dojo</p>
            </div>

            <div>
              <label className="form-label">Email (generado automáticamente)</label>
              <div className="form-input bg-dojo-darker/60 text-dojo-gold font-mono text-sm cursor-default select-all">
                admin@{form.slug || "slug"}.com
              </div>
            </div>

            <div>
              <label className="form-label">Contraseña inicial *</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input
                  type={form.showPass ? "text" : "password"}
                  value={form.adminPassword}
                  onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                  className="form-input pl-9 pr-10"
                  placeholder="Mínimo 8 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, showPass: !f.showPass }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted hover:text-dojo-white transition-colors"
                >
                  {form.showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <p className="text-dojo-muted text-xs flex items-center gap-1.5">
              <CheckCircle size={11} className="text-dojo-gold shrink-0" />
              El admin deberá cambiar esta contraseña al primer ingreso.
            </p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? "Creando..." : "Crear Dojo"}
            </button>
            <button type="button" onClick={closeModal} className="btn-secondary flex-1 justify-center">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
