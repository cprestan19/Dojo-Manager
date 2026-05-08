"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Shield, Plus, Save, X, Eye, EyeOff, Edit2, Trash2, UserX, UserCheck, Camera, Loader2, KeyRound } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try { return await res.json(); } catch { return {}; }
}

interface DojoOption { id: string; name: string; slug: string }

interface User {
  id: string; name: string; email: string; role: string; active: boolean;
  createdAt: string; photo: string | null;
  dojoId: string | null;
  dojo: { name: string; slug: string } | null;
}

interface RoleOption {
  roleName: string; roleLabel: string; roleColor: string; isSystem: boolean;
}

const SYSTEM_ROLES: RoleOption[] = [
  { roleName: "user",     roleLabel: "Usuario",       roleColor: "green", isSystem: true },
  { roleName: "admin",    roleLabel: "Administrador", roleColor: "blue",  isSystem: true },
  { roleName: "sysadmin", roleLabel: "Super Admin",   roleColor: "red",   isSystem: true },
];

const BADGE: Record<string, string> = {
  sysadmin: "badge-red", admin: "badge-blue", user: "badge-green",
};

type ModalMode = "create" | "edit" | "password";

const emptyForm = () => ({
  name: "", email: "", password: "", role: "user", active: true, photo: null as string | null,
});

export default function UsersPage() {
  const [users,     setUsers]    = useState<User[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [roles,     setRoles]    = useState<RoleOption[]>(SYSTEM_ROLES);
  const [mode,      setMode]     = useState<ModalMode>("create");
  const [modal,     setModal]    = useState(false);
  const [form,      setForm]     = useState(emptyForm());
  const [editId,    setEditId]   = useState<string | null>(null);
  const [showPass,  setShow]     = useState(false);
  const [saving,    setSaving]   = useState(false);
  const [error,     setError]    = useState("");
  const [toggling,  setToggling] = useState<string | null>(null);
  const [deleting,  setDel]      = useState<string | null>(null);
  const [uploading, setUploading]= useState(false);
  const [photoErr,  setPhotoErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const list: User[] = await res.json();
        setUsers(list);
      }
    } catch (err) {
      console.error("Error cargando usuarios:", err);
    } finally {
      setLoading(false);
    }

    // Roles — best-effort, no bloquea la lista de usuarios
    fetch("/api/roles")
      .then(r => r.ok ? r.json() : null)
      .then((d: { roles?: RoleOption[] } | null) => {
        if (d?.roles && Array.isArray(d.roles)) setRoles(d.roles);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  function openCreate() {
    setForm(emptyForm()); setEditId(null); setMode("create");
    setError(""); setPhotoErr(""); setModal(true);
  }

  function openEdit(u: User) {
    setForm({ name: u.name, email: u.email, password: "", role: u.role, active: u.active, photo: u.photo });
    setEditId(u.id); setMode("edit");
    setError(""); setPhotoErr(""); setModal(true);
  }

  function openPassword(u: User) {
    setForm(f => ({ ...f, password: "" }));
    setEditId(u.id); setMode("password");
    setError(""); setModal(true);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoErr(""); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "image");
      fd.append("purpose", "user-photo");
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await safeJson(res);
      if (!res.ok) throw new Error((data.error as string) ?? "Error al subir imagen");
      setForm(p => ({ ...p, photo: (data.url as string) ?? null }));
    } catch (err: unknown) {
      setPhotoErr(err instanceof Error ? err.message : "Error al subir imagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    setError("");
    if (mode === "create" && (!form.name || !form.email || !form.password)) {
      setError("Nombre, email y contraseña son requeridos."); return;
    }
    if (mode === "password" && !form.password) {
      setError("Ingresa la nueva contraseña."); return;
    }

    setSaving(true);
    let res: Response;

    if (mode === "create") {
      res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role, photo: form.photo }),
      });
    } else if (mode === "edit") {
      const body: Record<string, unknown> = { name: form.name, email: form.email, role: form.role, photo: form.photo };
      res = await fetch(`/api/users/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch(`/api/users/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.password, mustChangePassword: true }),
      });
    }

    if (!res.ok) {
      const d = await safeJson(res);
      setError((d.error as string) ?? "Error al guardar");
    } else {
      setModal(false);
      fetch_();
    }
    setSaving(false);
  }

  async function toggleActive(u: User) {
    setToggling(u.id);
    await fetch(`/api/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    setToggling(null);
    fetch_();
  }

  async function deleteUser(u: User) {
    if (!confirm(`¿Eliminar definitivamente al usuario "${u.name}"? Esta acción no se puede deshacer.`)) return;
    setDel(u.id);
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await safeJson(res);
      alert((d.error as string) ?? "No se pudo eliminar el usuario");
    }
    setDel(null);
    fetch_();
  }

  function roleBadge(roleName: string) {
    const r = roles.find(r => r.roleName === roleName);
    const badge = BADGE[roleName] ?? "badge-blue";
    return <span className={badge}>{r?.roleLabel ?? roleName}</span>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <Shield size={24} className="text-dojo-red" /> Usuarios del Sistema
          </h1>
          <p className="text-dojo-muted text-sm mt-1">
            {users.filter(u => u.active).length} activos · {users.filter(u => !u.active).length} inactivos
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={18} /> Nuevo Usuario</button>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3">
        {roles.filter(r => r.roleName !== "student").map(r => (
          <div key={r.roleName} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dojo-card border border-dojo-border">
            <span className={BADGE[r.roleName] ?? "badge-blue"}>{r.roleLabel}</span>
            {!r.isSystem && <span className="text-xs text-dojo-muted italic">Personalizado</span>}
          </div>
        ))}
      </div>

      {/* ── Mobile: card list ── */}
      <div className="block sm:hidden space-y-2">
        {loading && <p className="text-center py-10 text-dojo-muted text-sm">Cargando...</p>}
        {!loading && users.length === 0 && (
          <p className="text-center py-10 text-dojo-muted text-sm">No hay usuarios.</p>
        )}
        {users.map(u => (
          <div key={u.id} className={`card p-3 space-y-2.5 ${!u.active ? "opacity-60" : ""}`}>
            {/* Row 1: avatar + name + actions */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-dojo-border flex items-center justify-center text-sm font-bold text-dojo-gold flex-shrink-0">
                {u.photo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={u.photo} alt="" className="w-full h-full object-cover" />
                  : u.name[0]?.toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-dojo-white truncate">{u.name}</p>
                <p className="text-xs text-dojo-muted truncate">{u.email}</p>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => openEdit(u)} className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-white" title="Editar">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => openPassword(u)} className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-gold" title="Cambiar contraseña">
                  <KeyRound size={15} />
                </button>
                <button onClick={() => toggleActive(u)} disabled={toggling === u.id}
                  className={`btn-ghost p-1.5 ${u.active ? "text-dojo-muted hover:text-red-400" : "text-dojo-muted hover:text-green-400"}`}
                  title={u.active ? "Desactivar" : "Activar"}>
                  {toggling === u.id ? <Loader2 size={15} className="animate-spin" /> : u.active ? <UserX size={15} /> : <UserCheck size={15} />}
                </button>
                <button onClick={() => deleteUser(u)} disabled={deleting === u.id}
                  className="btn-ghost p-1.5 text-dojo-muted hover:text-red-500" title="Eliminar">
                  {deleting === u.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
            {/* Row 2: role + status + dojo */}
            <div className="flex items-center gap-2 flex-wrap">
              {roleBadge(u.role)}
              <span className={u.active ? "badge-green" : "badge-red"}>{u.active ? "Activo" : "Inactivo"}</span>
              {u.dojo
                ? <span className="text-xs text-dojo-muted">{u.dojo.name}</span>
                : <span className="text-xs text-dojo-muted italic">Global</span>
              }
              <span className="text-xs text-dojo-muted ml-auto">{formatDate(u.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Desktop: table ── */}
      <div className="hidden sm:block card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dojo-border">
                {["Usuario", "Email", "Dojo", "Rol", "Estado", "Creado", "Acciones"].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center py-12 text-dojo-muted">Cargando...</td></tr>}
              {!loading && users.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-dojo-muted">No hay usuarios.</td></tr>
              )}
              {users.map(u => (
                <tr key={u.id} className={`border-b border-dojo-border/40 hover:bg-dojo-border/10 ${!u.active ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-dojo-border flex items-center justify-center text-xs font-bold text-dojo-gold flex-shrink-0">
                        {u.photo
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={u.photo} alt="" className="w-full h-full object-cover" />
                          : u.name[0]?.toUpperCase()
                        }
                      </div>
                      <span className="font-semibold text-dojo-white">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-dojo-muted text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.dojo ? <span className="text-xs text-dojo-white">{u.dojo.name}</span>
                            : <span className="text-xs text-dojo-muted italic">Global</span>}
                  </td>
                  <td className="px-4 py-3">{roleBadge(u.role)}</td>
                  <td className="px-4 py-3">
                    <span className={u.active ? "badge-green" : "badge-red"}>{u.active ? "Activo" : "Inactivo"}</span>
                  </td>
                  <td className="px-4 py-3 text-dojo-muted text-xs">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)} className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-white" title="Editar"><Edit2 size={14} /></button>
                      <button onClick={() => openPassword(u)} className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-gold" title="Cambiar contraseña"><KeyRound size={14} /></button>
                      <button onClick={() => toggleActive(u)} disabled={toggling === u.id}
                        className={`btn-ghost p-1.5 ${u.active ? "text-dojo-muted hover:text-red-400" : "text-dojo-muted hover:text-green-400"}`}
                        title={u.active ? "Desactivar" : "Activar"}>
                        {toggling === u.id ? <Loader2 size={14} className="animate-spin" /> : u.active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      <button onClick={() => deleteUser(u)} disabled={deleting === u.id}
                        className="btn-ghost p-1.5 text-dojo-muted hover:text-red-500" title="Eliminar">
                        {deleting === u.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear / editar / contraseña */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={mode === "create" ? "Nuevo Usuario" : mode === "edit" ? "Editar Usuario" : "Cambiar Contraseña"}
        size="md"
      >
        <div className="space-y-4">
          {/* Foto — solo en crear/editar */}
          {mode !== "password" && (
            <div className="flex items-center gap-4">
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                className={`w-20 h-20 rounded-full overflow-hidden bg-dojo-border flex items-center justify-center cursor-pointer border-2 border-dashed border-dojo-border hover:border-dojo-red transition-colors relative group flex-shrink-0 ${uploading ? "opacity-60 cursor-wait" : ""}`}
              >
                {uploading ? (
                  <Loader2 size={22} className="animate-spin text-dojo-muted" />
                ) : form.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={22} className="text-dojo-muted" />
                )}
                {!uploading && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                    <Camera size={16} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-dojo-white font-medium">Foto del usuario</p>
                <p className="text-xs text-dojo-muted mt-0.5">JPG, PNG o WebP · máx. 5 MB</p>
                {photoErr && <p className="text-xs text-red-400 mt-1">{photoErr}</p>}
                {form.photo && !uploading && (
                  <button type="button" onClick={() => setForm(p => ({ ...p, photo: null }))} className="text-xs text-dojo-muted hover:text-red-400 mt-1">
                    Quitar foto
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
            </div>
          )}

          {/* Nombre */}
          {mode !== "password" && (
            <div>
              <label className="form-label">Nombre completo *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="form-input" placeholder="Juan Pérez" />
            </div>
          )}

          {/* Email */}
          {mode !== "password" && (
            <div>
              <label className="form-label">Correo electrónico *</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="form-input" placeholder="usuario@dojo.com" />
            </div>
          )}

          {/* Contraseña */}
          {(mode === "create" || mode === "password") && (
            <div>
              <label className="form-label">
                {mode === "password" ? "Nueva contraseña *" : "Contraseña *"}
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="form-input pr-10"
                  placeholder="Mínimo 8 caracteres"
                />
                <button type="button" onClick={() => setShow(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted hover:text-dojo-white">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {mode === "password" && (
                <p className="text-xs text-dojo-muted mt-1">El usuario deberá cambiarla en su próximo ingreso.</p>
              )}
            </div>
          )}

          {/* Rol */}
          {mode !== "password" && (
            <div>
              <label className="form-label">Rol *</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="form-input">
                {roles.filter(r => r.roleName !== "student").map(r => (
                  <option key={r.roleName} value={r.roleName}>{r.roleLabel}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary"><X size={16} /> Cancelar</button>
            <button type="button" onClick={save} disabled={saving || uploading} className="btn-primary">
              <Save size={16} /> {saving ? "Guardando..." : mode === "password" ? "Actualizar" : mode === "create" ? "Crear" : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
