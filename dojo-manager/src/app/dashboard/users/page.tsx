"use client";
import { useState, useEffect, useCallback } from "react";
import { Shield, Plus, Save, X, Eye, EyeOff } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";

interface User {
  id: string; name: string; email: string; role: string; active: boolean; createdAt: string;
  dojoId: string | null;
  dojo: { name: string; slug: string } | null;
}

const ROLES = [
  { value: "user",     label: "Usuario",       desc: "Solo lectura básica" },
  { value: "admin",    label: "Administrador", desc: "Gestión completa" },
  { value: "sysadmin", label: "SysAdmin",      desc: "Acceso total + configuración" },
];

const ROLE_STYLES: Record<string, string> = {
  sysadmin: "badge-red",
  admin:    "badge-blue",
  user:     "badge-green",
};

export default function UsersPage() {
  const [users,    setUsers]   = useState<User[]>([]);
  const [loading,  setLoading] = useState(true);
  const [modal,    setModal]   = useState(false);
  const [form,     setForm]    = useState({ name: "", email: "", password: "", role: "user" });
  const [showPass, setShow]    = useState(false);
  const [saving,   setSaving]  = useState(false);
  const [error,    setError]   = useState("");

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/users");
    if (r.ok) setUsers(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  function openCreate() {
    setForm({ name: "", email: "", password: "", role: "user" });
    setError(""); setModal(true);
  }

  async function save() {
    if (!form.name || !form.email || !form.password) { setError("Todos los campos son requeridos."); return; }
    setSaving(true); setError("");
    const r = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!r.ok) {
      const d = await r.json();
      setError(d.error ?? "Error al crear usuario");
    } else {
      setModal(false);
      fetch_();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <Shield size={24} className="text-dojo-red" /> Usuarios del Sistema
          </h1>
          <p className="text-dojo-muted text-sm mt-1">{users.length} usuario(s) registrado(s)</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={18}/> Nuevo Usuario</button>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3">
        {ROLES.map(r => (
          <div key={r.value} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dojo-card border border-dojo-border">
            <span className={ROLE_STYLES[r.value] + " badge"}>{r.label}</span>
            <span className="text-xs text-dojo-muted">{r.desc}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dojo-border">
              {["Nombre","Email","Dojo","Rol","Estado","Creado"].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center py-12 text-dojo-muted">Cargando...</td></tr>}
            {!loading && users.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-dojo-muted">No hay usuarios.</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} className="border-b border-dojo-border/40 hover:bg-dojo-border/10">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-dojo-border flex items-center justify-center text-xs font-bold text-dojo-gold">
                      {u.name[0].toUpperCase()}
                    </div>
                    <span className="font-semibold text-dojo-white">{u.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-dojo-muted text-xs">{u.email}</td>
                <td className="px-5 py-3">
                  {u.dojo ? (
                    <span className="text-xs text-dojo-white">{u.dojo.name}</span>
                  ) : (
                    <span className="text-xs text-dojo-muted italic">Global</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={ROLE_STYLES[u.role] ?? "badge-blue"}>
                    {ROLES.find(r => r.value === u.role)?.label ?? u.role}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={u.active ? "badge-green" : "badge-red"}>
                    {u.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-5 py-3 text-dojo-muted">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>{/* overflow-x-auto */}
      </div>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Usuario" size="sm">
        <div className="space-y-4">
          <div>
            <label className="form-label">Nombre completo *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="form-input" placeholder="Juan Pérez" />
          </div>
          <div>
            <label className="form-label">Correo electrónico *</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              className="form-input" placeholder="usuario@dojo.com" />
          </div>
          <div>
            <label className="form-label">Contraseña *</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="form-input pr-10" placeholder="Mínimo 8 caracteres" />
              <button type="button" onClick={() => setShow(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted hover:text-dojo-white">
                {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>
          <div>
            <label className="form-label">Rol *</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="form-input">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
            </select>
          </div>
          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{error}</div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary"><X size={16}/> Cancelar</button>
            <button type="button" onClick={save} disabled={saving} className="btn-primary">
              <Save size={16}/> {saving ? "Guardando..." : "Crear Usuario"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
