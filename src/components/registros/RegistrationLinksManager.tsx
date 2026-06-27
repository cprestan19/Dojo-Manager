"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Copy, Check, Trash2, ToggleLeft, ToggleRight, ExternalLink } from "lucide-react";

interface RegistrationLink {
  id: string; label: string; token: string; isActive: boolean;
  activatesAt: string | null; expiresAt: string | null;
  maxUses: number | null; useCount: number; createdAt: string;
  _count: { pendingStudents: number };
}

type LinkStatus = "active" | "scheduled" | "expired" | "disabled" | "exhausted";

function getLinkStatus(link: RegistrationLink): LinkStatus {
  if (!link.isActive) return "disabled";
  const now = new Date();
  if (link.activatesAt && new Date(link.activatesAt) > now) return "scheduled";
  if (link.expiresAt   && new Date(link.expiresAt)   < now) return "expired";
  if (link.maxUses != null && link.useCount >= link.maxUses) return "exhausted";
  return "active";
}

const STATUS_LABELS: Record<LinkStatus, { label: string; className: string }> = {
  active:    { label: "Activo",      className: "badge-green"  },
  scheduled: { label: "Programado",  className: "badge-blue"   },
  expired:   { label: "Expirado",    className: "badge-red"    },
  disabled:  { label: "Desactivado", className: "badge-yellow" },
  exhausted: { label: "Agotado",     className: "badge-red"    },
};

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button type="button" onClick={copy} title="Copiar enlace"
      className="p-1.5 rounded hover:bg-dojo-border/40 text-dojo-muted hover:text-dojo-white transition-colors">
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RegistrationLinksManager() {
  const [links, setLinks]     = useState<RegistrationLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({ label: "", activatesAt: "", expiresAt: "", maxUses: "" });
  const [deleting, setDeleting] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/registration-links");
      if (res.ok) setLinks(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createLink() {
    if (!form.label.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/registration-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label:       form.label.trim(),
          activatesAt: form.activatesAt || null,
          expiresAt:   form.expiresAt   || null,
          maxUses:     form.maxUses ? Number(form.maxUses) : null,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setForm({ label: "", activatesAt: "", expiresAt: "", maxUses: "" });
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(link: RegistrationLink) {
    await fetch(`/api/registration-links/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !link.isActive }),
    });
    load();
  }

  async function deleteLink(link: RegistrationLink) {
    if (!confirm(`¿Eliminar el link "${link.label}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(link.id);
    try {
      const res = await fetch(`/api/registration-links/${link.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? "No se pudo eliminar.");
        return;
      }
      load();
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return <div className="h-32 bg-dojo-card rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-dojo-muted text-sm">{links.length} {links.length === 1 ? "enlace" : "enlaces"} creados</p>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={14} /> Nuevo enlace
        </button>
      </div>

      {links.length === 0 && (
        <div className="card text-center py-10 text-dojo-muted">
          <p>No hay enlaces de registro aún.</p>
          <p className="text-sm mt-1">Crea uno para compartir con los padres o alumnos.</p>
        </div>
      )}

      <div className="space-y-3">
        {links.map(link => {
          const status = getLinkStatus(link);
          const { label: sLabel, className: sCls } = STATUS_LABELS[status];
          const url = `${origin}/registro/${link.token}`;

          return (
            <div key={link.id} className="card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-dojo-white truncate">{link.label}</span>
                    <span className={`badge ${sCls}`}>{sLabel}</span>
                    {link._count.pendingStudents > 0 && (
                      <span className="badge badge-gold">{link._count.pendingStudents} pendientes</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-dojo-muted font-mono truncate max-w-xs">{url}</span>
                    <CopyButton url={url} />
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="p-1 text-dojo-muted hover:text-dojo-white">
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(link)} title={link.isActive ? "Desactivar" : "Activar"}
                    className="p-1.5 rounded hover:bg-dojo-border/40 text-dojo-muted hover:text-dojo-white transition-colors">
                    {link.isActive
                      ? <ToggleRight size={18} className="text-green-400" />
                      : <ToggleLeft  size={18} />}
                  </button>
                  <button onClick={() => deleteLink(link)} disabled={deleting === link.id}
                    className="p-1.5 rounded hover:bg-red-900/30 text-dojo-muted hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-dojo-muted border-t border-dojo-border pt-2">
                <span>Usos: <strong className="text-dojo-white">{link.useCount}</strong>{link.maxUses ? ` / ${link.maxUses}` : ""}</span>
                <span>Activa desde: <strong className="text-dojo-white">{formatDate(link.activatesAt)}</strong></span>
                <span>Vence: <strong className="text-dojo-white">{formatDate(link.expiresAt)}</strong></span>
                <span>Creado: <strong className="text-dojo-white">{formatDate(link.createdAt)}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dojo-card rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-dojo-white text-lg">Nuevo enlace de registro</h3>

            <div className="space-y-1">
              <label className="form-label">Nombre del enlace <span className="text-dojo-red">*</span></label>
              <input className="form-input" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                placeholder='Ej: "Inscripciones Enero 2026"' maxLength={200} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="form-label">Activa desde</label>
                <input type="datetime-local" className="form-input text-sm" value={form.activatesAt}
                  onChange={e => setForm(p => ({ ...p, activatesAt: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="form-label">Vence el</label>
                <input type="datetime-local" className="form-input text-sm" value={form.expiresAt}
                  onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="form-label">Máximo de usos</label>
              <input type="number" min="1" className="form-input" value={form.maxUses}
                onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))}
                placeholder="Dejar vacío para sin límite" />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={createLink} disabled={saving || !form.label.trim()} className="btn-primary">
                {saving ? "Creando..." : "Crear enlace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
