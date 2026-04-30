"use client";
import { useState, useEffect, useCallback } from "react";

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try { return await res.json(); } catch { return {}; }
}
import {
  ShieldCheck, Plus, Save, X, Trash2, Loader2, RotateCcw, Info,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  ALL_DOJO_KEYS, NAV_KEYS, NAV_KEY_LABELS, DEFAULT_PERMISSIONS,
  ROLE_COLORS, BADGE_BY_COLOR,
} from "@/lib/permissions";
import type { NavKey } from "@/lib/permissions";

interface RoleRow {
  id:           string | null;
  roleName:     string;
  roleLabel:    string;
  roleColor:    string;
  isSystem:     boolean;
  permissions:  NavKey[];
  description:  string | null;
  isCustomized: boolean;
}

// Nav groups for readable matrix columns
const NAV_GROUPS = [
  {
    label: "Navegación principal",
    keys: [
      NAV_KEYS.DASHBOARD, NAV_KEYS.STUDENTS, NAV_KEYS.ATTENDANCE,
      NAV_KEYS.PAYMENTS, NAV_KEYS.BELTS, NAV_KEYS.REPORTS, NAV_KEYS.SCHEDULES,
    ],
  },
  {
    label: "Administración",
    keys: [NAV_KEYS.USERS, NAV_KEYS.DOJOS],
  },
  {
    label: "Configuración",
    keys: [
      NAV_KEYS.SETTINGS_GENERAL, NAV_KEYS.SETTINGS_KATAS, NAV_KEYS.SETTINGS_VIDEOS,
      NAV_KEYS.SETTINGS_EMAIL, NAV_KEYS.SETTINGS_ROLES,
    ],
  },
  {
    label: "Catálogo",
    keys: [NAV_KEYS.KATAS_CATALOG],
  },
];

const ALL_VISIBLE_KEYS = NAV_GROUPS.flatMap(g => g.keys);

export default function RolesPage() {
  const [roles,    setRoles]   = useState<RoleRow[]>([]);
  const [loading,  setLoading] = useState(true);
  const [dirty,    setDirty]   = useState<Record<string, Set<NavKey>>>({});
  const [saving,   setSaving]  = useState<string | null>(null);
  const [modal,    setModal]   = useState(false);
  const [newRole,  setNewRole] = useState({ roleName: "", roleLabel: "", roleColor: "blue" });
  const [creating, setCreating]= useState(false);
  const [deleting, setDel]     = useState<string | null>(null);
  const [err,      setErr]     = useState("");

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/roles");
    if (r.ok) {
      const data = await r.json();
      setRoles(data.roles ?? []);
    }
    setLoading(false);
    setDirty({});
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  function getPermSet(role: RoleRow): Set<NavKey> {
    if (dirty[role.roleName]) return dirty[role.roleName];
    return new Set(Array.isArray(role.permissions) ? role.permissions as NavKey[] : []);
  }

  function togglePerm(role: RoleRow, key: NavKey) {
    if (role.roleName === "sysadmin") return; // sysadmin is immutable
    const current = getPermSet(role);
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    setDirty(d => ({ ...d, [role.roleName]: next }));
  }

  function isDirty(role: RoleRow) {
    return !!dirty[role.roleName];
  }

  function resetRole(role: RoleRow) {
    setDirty(d => { const n = { ...d }; delete n[role.roleName]; return n; });
  }

  async function saveRole(role: RoleRow) {
    const perms = getPermSet(role);
    setSaving(role.roleName);
    const body = {
      roleName:    role.roleName,
      roleLabel:   role.roleLabel,
      roleColor:   role.roleColor,
      isSystem:    role.isSystem,
      permissions: [...perms],
    };

    if (role.id) {
      // Existing DB record → update
      await fetch(`/api/roles/${role.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      // System role with no DB override yet → create it
      await fetch("/api/roles/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setSaving(null);
    fetch_();
  }

  async function saveAllDirty() {
    const dirtyRoles = roles.filter(r => isDirty(r));
    for (const role of dirtyRoles) {
      await saveRole(role);
    }
  }

  async function createCustomRole() {
    if (!newRole.roleName.trim() || !newRole.roleLabel.trim()) {
      setErr("Nombre e etiqueta son requeridos"); return;
    }
    setCreating(true); setErr("");
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roleName:    newRole.roleName,
        roleLabel:   newRole.roleLabel,
        roleColor:   newRole.roleColor,
        permissions: [...(DEFAULT_PERMISSIONS.user ?? [])],
      }),
    });
    if (!res.ok) {
      const d = await safeJson(res);
      setErr((d.error as string) ?? "Error al crear rol");
    } else {
      setModal(false);
      setNewRole({ roleName: "", roleLabel: "", roleColor: "blue" });
      fetch_();
    }
    setCreating(false);
  }

  async function deleteRole(role: RoleRow) {
    if (!role.id || role.isSystem) return;
    if (!confirm(`¿Eliminar el rol "${role.roleLabel}"? Los usuarios con este rol quedarán sin acceso.`)) return;
    setDel(role.roleName);
    const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await safeJson(res);
      alert((d.error as string) ?? "No se pudo eliminar");
    }
    setDel(null);
    fetch_();
  }

  const dirtyCount = roles.filter(r => isDirty(r)).length;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <ShieldCheck size={24} className="text-dojo-red" /> Roles y Accesos
          </h1>
          <p className="text-dojo-muted text-sm mt-1">
            Define qué secciones puede ver cada rol. Los cambios aplican al menú de navegación.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirtyCount > 0 && (
            <button onClick={saveAllDirty} className="btn-primary">
              <Save size={16} /> Guardar cambios ({dirtyCount})
            </button>
          )}
          <button onClick={() => { setModal(true); setErr(""); }} className="btn-secondary">
            <Plus size={16} /> Nuevo Rol
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-dojo-card border border-dojo-border/60 text-sm text-dojo-muted">
        <Info size={16} className="text-dojo-gold mt-0.5 flex-shrink-0" />
        <p>
          Marca o desmarca los accesos de cada rol. <strong className="text-dojo-white">sysadmin</strong> siempre tiene acceso total y no puede modificarse.
          Los roles del sistema (admin, user) se personalizan por dojo. Los roles personalizados heredan los permisos de <em>Usuario</em> al crearse.
        </p>
      </div>

      {loading && <div className="text-center py-20 text-dojo-muted">Cargando...</div>}

      {!loading && (
        <div className="space-y-6">
          {/* Matrix table */}
          <div className="card p-0 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              {/* Group headers */}
              <thead>
                <tr className="border-b border-dojo-border bg-dojo-darker/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-dojo-muted uppercase tracking-wider w-44 sticky left-0 bg-dojo-darker/90">
                    Rol
                  </th>
                  {NAV_GROUPS.map(g => (
                    <th
                      key={g.label}
                      colSpan={g.keys.length}
                      className="text-center px-2 py-3 text-xs font-semibold text-dojo-muted uppercase tracking-wider border-l border-dojo-border/30"
                    >
                      {g.label}
                    </th>
                  ))}
                  <th className="w-24 px-4 py-3" />
                </tr>
                {/* Nav item sub-headers */}
                <tr className="border-b border-dojo-border bg-dojo-card/40">
                  <th className="sticky left-0 bg-dojo-card/90" />
                  {ALL_VISIBLE_KEYS.map((key, i) => {
                    const isFirstInGroup = NAV_GROUPS.some(g => g.keys[0] === key);
                    return (
                      <th
                        key={key}
                        className={`py-2 px-1 text-center ${isFirstInGroup ? "border-l border-dojo-border/30" : ""}`}
                      >
                        <span
                          className="text-[10px] font-medium text-dojo-muted writing-vertical block w-full"
                          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 72, paddingBottom: 4 }}
                        >
                          {NAV_KEY_LABELS[key]}
                        </span>
                      </th>
                    );
                  })}
                  <th />
                </tr>
              </thead>

              <tbody>
                {roles.map(role => {
                  const perms    = getPermSet(role);
                  const isSaving = saving === role.roleName;
                  const hasChanges = isDirty(role);
                  const isSysadmin = role.roleName === "sysadmin";

                  return (
                    <tr
                      key={role.roleName}
                      className={`border-b border-dojo-border/40 hover:bg-dojo-border/10 ${hasChanges ? "bg-dojo-gold/5" : ""}`}
                    >
                      {/* Role name */}
                      <td className="px-5 py-3 sticky left-0 bg-dojo-darker/90 z-10">
                        <div className="flex flex-col gap-1">
                          <span className={`${BADGE_BY_COLOR[role.roleColor] ?? "badge-blue"} text-xs self-start`}>
                            {role.roleLabel}
                          </span>
                          {!role.isSystem && (
                            <span className="text-[10px] text-dojo-muted">Personalizado</span>
                          )}
                          {isSysadmin && (
                            <span className="text-[10px] text-dojo-gold">Acceso total</span>
                          )}
                        </div>
                      </td>

                      {/* Permission checkboxes */}
                      {ALL_VISIBLE_KEYS.map((key, i) => {
                        const isFirstInGroup = NAV_GROUPS.some(g => g.keys[0] === key);
                        const checked = isSysadmin ? true : perms.has(key);
                        return (
                          <td
                            key={key}
                            className={`text-center py-3 px-1 ${isFirstInGroup ? "border-l border-dojo-border/20" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isSysadmin}
                              onChange={() => togglePerm(role, key)}
                              className="w-4 h-4 accent-dojo-red cursor-pointer disabled:cursor-default disabled:opacity-50"
                            />
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {hasChanges && (
                            <>
                              <button
                                onClick={() => saveRole(role)}
                                disabled={isSaving}
                                className="btn-ghost p-1.5 text-dojo-gold hover:text-dojo-white"
                                title="Guardar"
                              >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                              </button>
                              <button
                                onClick={() => resetRole(role)}
                                className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-white"
                                title="Descartar cambios"
                              >
                                <RotateCcw size={14} />
                              </button>
                            </>
                          )}
                          {!role.isSystem && role.id && (
                            <button
                              onClick={() => deleteRole(role)}
                              disabled={deleting === role.roleName}
                              className="btn-ghost p-1.5 text-dojo-muted hover:text-red-400"
                              title="Eliminar rol"
                            >
                              {deleting === role.roleName
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Trash2 size={14} />
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <p className="text-xs text-dojo-muted">
            ✅ Acceso habilitado · ☐ Sin acceso · Los cambios no guardados se muestran con fondo dorado.
          </p>
        </div>
      )}

      {/* Modal: nuevo rol personalizado */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Rol Personalizado" size="sm">
        <div className="space-y-4">
          <div>
            <label className="form-label">Identificador interno *</label>
            <input
              value={newRole.roleName}
              onChange={e => setNewRole(p => ({ ...p, roleName: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
              className="form-input font-mono"
              placeholder="instructor"
            />
            <p className="text-xs text-dojo-muted mt-1">Solo letras, números y guión bajo. Ej: <code>instructor</code>, <code>secretaria</code></p>
          </div>
          <div>
            <label className="form-label">Nombre para mostrar *</label>
            <input
              value={newRole.roleLabel}
              onChange={e => setNewRole(p => ({ ...p, roleLabel: e.target.value }))}
              className="form-input"
              placeholder="Instructor"
            />
          </div>
          <div>
            <label className="form-label">Color del badge</label>
            <select value={newRole.roleColor} onChange={e => setNewRole(p => ({ ...p, roleColor: e.target.value }))} className="form-input">
              {ROLE_COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <p className="text-xs text-dojo-muted p-3 bg-dojo-dark rounded-lg border border-dojo-border">
            El nuevo rol hereda los permisos de <strong>Usuario</strong> al crearse. Puedes ajustarlos en la matriz.
          </p>
          {err && <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{err}</div>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary"><X size={16} /> Cancelar</button>
            <button type="button" onClick={createCustomRole} disabled={creating} className="btn-primary">
              <Save size={16} /> {creating ? "Creando..." : "Crear Rol"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
