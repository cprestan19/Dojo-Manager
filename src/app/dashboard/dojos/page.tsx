"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Users, GraduationCap, Globe, CheckCircle, XCircle,
  Copy, KeyRound, LogIn, Lock, Eye, EyeOff, Crown, Trash2, AlertTriangle,
  Crown as CrownIcon,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface Dojo {
  id: string; name: string; slug: string; logo: string | null;
  active: boolean; tournamentPro: boolean; createdAt: string;
  email: string | null; phone: string | null;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    plan: { name: string; maxStudents: number | null } | null;
  } | null;
  _count: { users: number; students: number };
}

interface CreatedAdmin { email: string; tempPassword: string; loginUrl: string; }

const defaultForm = { name: "", slug: "", adminPassword: "", showPass: false };

type StatusFilter = "active" | "inactive" | "all";

const SUB_BADGE: Record<string, string> = {
  TRIAL:         "bg-blue-900/30 text-blue-300 border border-blue-700/40",
  ACTIVE:        "bg-green-900/30 text-green-300 border border-green-700/40",
  PAST_DUE:      "bg-yellow-900/30 text-yellow-300 border border-yellow-700/40",
  CANCELED:      "bg-red-900/30 text-red-300 border border-red-700/40",
  READ_ONLY:     "bg-red-900/30 text-red-300 border border-red-700/40",
  COMPLIMENTARY: "bg-dojo-gold/10 text-dojo-gold border border-dojo-gold/30",
};

const SUB_LABEL: Record<string, string> = {
  TRIAL:         "Trial",
  ACTIVE:        "Activo",
  PAST_DUE:      "Vencido",
  CANCELED:      "Cancelado",
  READ_ONLY:     "Solo lectura",
  COMPLIMENTARY: "Cortesía",
};

function normalize(s: string) { return s.trim().replace(/\s+/g, " "); }

export default function DojosPage() {
  const router = useRouter();
  const [dojos,         setDojos]         = useState<Dojo[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>("active");
  const [modal,         setModal]         = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [form,          setForm]          = useState(defaultForm);
  const [error,         setError]         = useState("");
  const [createdAdmin,  setCreatedAdmin]  = useState<CreatedAdmin | null>(null);
  const [entering,      setEntering]      = useState<string | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<Dojo | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting,      setDeleting]      = useState(false);
  const [deleteError,   setDeleteError]   = useState("");

  async function enterDojo(dojo: Dojo) {
    setEntering(dojo.id);
    await fetch("/api/sysadmin/set-dojo", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ dojoId: dojo.id }),
    });
    setEntering(null);
    router.push("/dashboard");
    router.refresh();
  }

  async function load() {
    setLoading(true);
    const r = await fetch("/api/dojos");
    if (r.ok) setDojos(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function slugify(text: string) {
    return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  function handleNameChange(name: string) {
    setForm(f => ({ ...f, name, slug: slugify(name) }));
  }

  function closeModal() { setModal(false); setError(""); setForm(defaultForm); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    if (form.adminPassword.length < 8) {
      setError("La contraseña del admin debe tener al menos 8 caracteres.");
      setSaving(false); return;
    }
    const res = await fetch("/api/dojos", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: form.name, slug: form.slug, adminPassword: form.adminPassword }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Error al crear el dojo"); setSaving(false); return; }
    setCreatedAdmin({ email: data.adminEmail, tempPassword: form.adminPassword, loginUrl: `/login?dojo=${data.slug}` });
    closeModal(); load(); setSaving(false);
  }

  async function toggleActive(dojo: Dojo) {
    await fetch(`/api/dojos/${dojo.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: dojo.name, active: !dojo.active }),
    });
    load();
  }

  async function toggleTournamentPro(dojo: Dojo) {
    await fetch(`/api/dojos/${dojo.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: dojo.name, tournamentPro: !dojo.tournamentPro }),
    });
    load();
  }

  function openDelete(dojo: Dojo) { setDeleteTarget(dojo); setDeleteConfirm(""); setDeleteError(""); }
  function closeDelete()           { setDeleteTarget(null); setDeleteConfirm(""); setDeleteError(""); }

  async function handleDelete() {
    if (!deleteTarget || normalize(deleteConfirm) !== normalize(deleteTarget.name)) return;
    setDeleting(true); setDeleteError("");
    const res = await fetch(`/api/dojos/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setDeleteError(data.error ?? "Error al eliminar"); setDeleting(false); return; }
    closeDelete(); setDeleting(false); load();
  }

  const active   = dojos.filter(d => d.active);
  const inactive = dojos.filter(d => !d.active);
  const visible  = statusFilter === "active" ? active : statusFilter === "inactive" ? inactive : dojos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <Building2 size={28} className="text-dojo-red" /> Gestión de Dojos
          </h1>
          <p className="text-dojo-muted text-sm mt-1">
            {active.length} activos · {inactive.length} inactivos · {dojos.length} total
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nuevo Dojo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        {(["active", "inactive", "all"] as const).map(f => {
          const count = f === "active" ? active.length : f === "inactive" ? inactive.length : dojos.length;
          const label = f === "active" ? "Activos" : f === "inactive" ? "Inactivos" : "Todos";
          return (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === f
                  ? "bg-dojo-red text-white"
                  : "bg-dojo-card border border-dojo-border text-dojo-muted hover:text-dojo-white"
              }`}
            >
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusFilter === f ? "bg-white/20" : "bg-dojo-border"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="h-40 bg-dojo-card rounded-xl animate-pulse" />
      ) : visible.length === 0 ? (
        <div className="card text-center py-16">
          <Building2 size={40} className="text-dojo-muted mx-auto mb-3" />
          <p className="text-dojo-muted">No hay dojos {statusFilter === "active" ? "activos" : statusFilter === "inactive" ? "inactivos" : "registrados"}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-dojo-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-dojo-darker text-dojo-muted text-xs uppercase tracking-wide border-b border-dojo-border">
                <th className="text-left px-4 py-3">Dojo</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Slug</th>
                <th className="text-center px-4 py-3">Alumnos</th>
                <th className="text-center px-4 py-3 hidden sm:table-cell">Usuarios</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Plan</th>
                <th className="text-center px-4 py-3 hidden xl:table-cell">Pro</th>
                <th className="text-left px-4 py-3 hidden xl:table-cell">Creado</th>
                <th className="text-right px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dojo-border">
              {visible.map(dojo => {
                const sub   = dojo.subscription;
                const limit = sub?.plan?.maxStudents;
                const pct   = limit ? dojo._count.students / limit : null;
                const atLim = limit != null && dojo._count.students >= limit;

                return (
                  <tr key={dojo.id}
                    className={`transition-colors hover:bg-dojo-border/20 ${!dojo.active ? "opacity-50" : ""}`}
                  >
                    {/* Nombre + estado */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-dojo-red rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                          {dojo.logo?.startsWith("http")
                            ? <img src={dojo.logo} alt="" className="w-full h-full object-contain" />
                            : <Building2 size={14} className="text-white" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-dojo-white font-medium truncate">{dojo.name}</p>
                          {dojo.email && (
                            <p className="text-dojo-muted text-xs truncate hidden lg:block">{dojo.email}</p>
                          )}
                        </div>
                        {dojo.active
                          ? <CheckCircle size={13} className="text-green-400 shrink-0" />
                          : <XCircle    size={13} className="text-red-400 shrink-0" />
                        }
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <a href={`/login?dojo=${dojo.slug}`} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-xs text-dojo-gold hover:underline">
                        {dojo.slug}
                      </a>
                    </td>

                    {/* Alumnos */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`font-semibold ${atLim ? "text-red-300" : "text-dojo-white"}`}>
                          {dojo._count.students}
                        </span>
                        {limit != null && (
                          <div className="w-16 h-1 bg-dojo-border rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${atLim ? "bg-red-500" : pct! >= 0.8 ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${Math.min((pct ?? 0) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                        {limit != null && (
                          <span className="text-xs text-dojo-muted">{`/${limit}`}</span>
                        )}
                      </div>
                    </td>

                    {/* Usuarios */}
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        <Users size={12} className="text-dojo-muted" />
                        <span className="text-dojo-white">{dojo._count.users}</span>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {sub ? (
                        <div className="space-y-1">
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${SUB_BADGE[sub.status] ?? "text-dojo-muted"}`}>
                            {SUB_LABEL[sub.status] ?? sub.status}
                          </span>
                          {sub.plan && (
                            <p className="text-xs text-dojo-muted">{sub.plan.name}</p>
                          )}
                          {sub.currentPeriodEnd && (
                            <p className="text-xs text-dojo-muted">
                              Vence: {new Date(sub.currentPeriodEnd).toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short", year: "numeric" })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-dojo-muted italic">Sin plan</span>
                      )}
                    </td>

                    {/* Torneo Pro */}
                    <td className="px-4 py-3 text-center hidden xl:table-cell">
                      <button onClick={() => toggleTournamentPro(dojo)}
                        title={dojo.tournamentPro ? "Desactivar Pro" : "Activar Pro"}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
                          dojo.tournamentPro
                            ? "bg-dojo-gold/20 text-dojo-gold hover:bg-dojo-gold/30"
                            : "bg-dojo-border text-dojo-muted hover:bg-dojo-border/70"
                        }`}
                      >
                        <CrownIcon size={10} /> {dojo.tournamentPro ? "PRO" : "—"}
                      </button>
                    </td>

                    {/* Fecha creación */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-dojo-muted">
                        {new Date(dojo.createdAt).toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => enterDojo(dojo)} disabled={entering === dojo.id}
                          title="Entrar al dojo"
                          className="p-1.5 rounded-lg text-dojo-muted hover:text-dojo-red hover:bg-dojo-red/10 transition-colors disabled:opacity-40">
                          <LogIn size={15} />
                        </button>
                        <button onClick={() => toggleActive(dojo)}
                          title={dojo.active ? "Desactivar" : "Activar"}
                          className="p-1.5 rounded-lg text-dojo-muted hover:text-dojo-white hover:bg-dojo-border/40 transition-colors">
                          {dojo.active ? <XCircle size={15} className="text-red-400" /> : <CheckCircle size={15} className="text-green-400" />}
                        </button>
                        <button onClick={() => openDelete(dojo)}
                          title="Eliminar"
                          className="p-1.5 rounded-lg text-dojo-muted hover:text-red-400 hover:bg-red-900/20 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Credenciales auto-generadas */}
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
                <button onClick={() => navigator.clipboard?.writeText(value).catch(() => {})}
                  className="text-dojo-muted hover:text-dojo-gold transition-colors" title="Copiar">
                  <Copy size={14} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setCreatedAdmin(null)} className="btn-ghost text-xs w-full justify-center">Cerrar</button>
        </div>
      )}

      {/* Modal eliminar dojo */}
      <Modal open={!!deleteTarget} onClose={closeDelete} title="Eliminar Dojo">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-900/30 border border-red-800/50">
            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 text-sm font-semibold">Acción irreversible</p>
              <p className="text-red-300/80 text-xs mt-0.5">
                Se eliminarán permanentemente el dojo y todos sus datos.
              </p>
            </div>
          </div>
          <div className="bg-dojo-darker rounded-xl p-4 space-y-1.5">
            <p className="text-dojo-white text-sm font-semibold mb-2">{deleteTarget?.name}</p>
            <p className="text-dojo-muted text-xs flex items-center gap-1.5"><Users size={11} /> {deleteTarget?._count.users ?? 0} usuarios del dojo</p>
            <p className="text-dojo-muted text-xs flex items-center gap-1.5"><GraduationCap size={11} /> {deleteTarget?._count.students ?? 0} alumnos y toda su historia</p>
            <p className="text-dojo-muted text-xs flex items-center gap-1.5"><Building2 size={11} /> Torneos, katas, horarios y configuración</p>
            <p className="text-dojo-muted/60 text-[11px] mt-2 pt-2 border-t border-dojo-border">
              ⚠️ Las imágenes en Cloudinary deben eliminarse manualmente.
            </p>
          </div>
          <div>
            <label className="form-label">
              Escribe <span className="text-dojo-white font-mono">{deleteTarget?.name}</span> para confirmar
            </label>
            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleDelete(); }}
              className="form-input" placeholder="Nombre exacto del dojo..." autoComplete="off" />
          </div>
          {deleteError && <p className="text-red-400 text-sm">{deleteError}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={handleDelete}
              disabled={deleting || normalize(deleteConfirm) !== normalize(deleteTarget?.name ?? "")}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm bg-red-700 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Trash2 size={15} /> {deleting ? "Eliminando..." : "Eliminar definitivamente"}
            </button>
            <button onClick={closeDelete} className="btn-secondary flex-1 justify-center">Cancelar</button>
          </div>
        </div>
      </Modal>

      {/* Modal nuevo dojo */}
      <Modal open={modal} onClose={closeModal} title="Nuevo Dojo">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="form-label">Nombre del Dojo</label>
            <input type="text" value={form.name} onChange={e => handleNameChange(e.target.value)}
              className="form-input" placeholder="Ej. Dojo Shotokan Norte" required />
          </div>
          <div>
            <label className="form-label">Slug (URL)</label>
            <div className="flex items-center gap-2 bg-dojo-darker border border-dojo-border rounded-lg px-3 py-2">
              <Globe size={14} className="text-dojo-muted" />
              <span className="text-dojo-muted text-sm">/login?dojo=</span>
              <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                className="bg-transparent text-dojo-gold text-sm font-mono flex-1 outline-none" required />
            </div>
          </div>
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
                <input type={form.showPass ? "text" : "password"} value={form.adminPassword}
                  onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                  className="form-input pl-9 pr-10" placeholder="Mínimo 8 caracteres" required />
                <button type="button" onClick={() => setForm(f => ({ ...f, showPass: !f.showPass }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted hover:text-dojo-white transition-colors">
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
            <button type="button" onClick={closeModal} className="btn-secondary flex-1 justify-center">Cancelar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
