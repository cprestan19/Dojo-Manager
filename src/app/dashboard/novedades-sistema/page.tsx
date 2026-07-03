"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Plus, Trash2, Edit2, X, Check,
  ChevronDown, ChevronUp, Loader2, Eye, Globe, Mail,
} from "lucide-react";

interface NewsItem {
  text:     string;
  category: "feature" | "improvement" | "fix" | "security";
}

interface SystemNews {
  id:            string;
  version:       string;
  title:         string;
  items:         NewsItem[];
  audience:      string;
  status:        string;
  testUserEmail: string | null;
  publishedAt:   string;
}

const CATEGORY_OPTIONS = [
  { value: "feature",     label: "🚀 Nueva función"   },
  { value: "improvement", label: "⚡ Mejora"           },
  { value: "fix",         label: "🐛 Corrección"       },
  { value: "security",    label: "🔒 Seguridad"        },
] as const;

const AUDIENCE_OPTIONS = [
  { value: "all",      label: "Todos (admins y estudiantes)" },
  { value: "admins",   label: "Solo administradores"         },
  { value: "students", label: "Solo estudiantes"             },
];

const CATEGORY_EMOJI: Record<string, string> = {
  feature: "🚀", improvement: "⚡", fix: "🐛", security: "🔒",
};

const EMPTY_ITEM: NewsItem = { text: "", category: "feature" };

function emptyForm() {
  return {
    version:       "",
    title:         "",
    audience:      "all",
    status:        "draft",
    testUserEmail: "",
    publishedAt:   new Date().toISOString().slice(0, 16),
    items:         [{ ...EMPTY_ITEM }] as NewsItem[],
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PA", {
    day: "numeric", month: "short", year: "numeric",
    timeZone: "America/Panama",
  });
}

export default function NovedadesSistemaPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const router = useRouter();

  const [newsList,   setNewsList]   = useState<SystemNews[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [form,       setForm]       = useState(emptyForm());
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [preview,    setPreview]    = useState<SystemNews | null>(null);

  useEffect(() => {
    if (status === "authenticated" && role !== "sysadmin") {
      router.replace("/dashboard");
    }
  }, [status, role, router]);

  async function loadNews() {
    setLoading(true);
    const r = await fetch("/api/system/news");
    if (r.ok) setNewsList(await r.json());
    setLoading(false);
  }

  useEffect(() => { loadNews(); }, []);

  function openNew() {
    setForm(emptyForm());
    setEditId(null);
    setShowForm(true);
    setError(null);
  }

  function openEdit(n: SystemNews) {
    setForm({
      version:       n.version,
      title:         n.title,
      audience:      n.audience,
      status:        n.status,
      testUserEmail: n.testUserEmail ?? "",
      publishedAt:   new Date(n.publishedAt).toISOString().slice(0, 16),
      items:         n.items as NewsItem[],
    });
    setEditId(n.id);
    setShowForm(true);
    setError(null);
  }

  function cancel() { setShowForm(false); setEditId(null); setForm(emptyForm()); setError(null); }

  function addItem()  { setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] })); }
  function removeItem(i: number) { setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })); }
  function setItem(i: number, field: keyof NewsItem, value: string) {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      return { ...f, items };
    });
  }

  async function save() {
    if (!form.version.trim() || !form.title.trim()) {
      setError("Versión y título son obligatorios.");
      return;
    }
    const validItems = form.items.filter(i => i.text.trim());
    if (validItems.length === 0) {
      setError("Agrega al menos un ítem.");
      return;
    }

    setSaving(true);
    setError(null);

    const body = JSON.stringify({
      ...form,
      testUserEmail: form.testUserEmail?.trim()?.toLowerCase() || null,
      items: validItems,
    });
    const url = editId ? `/api/system/news/${editId}` : "/api/system/news";
    const r   = await fetch(url, {
      method:  editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    setSaving(false);

    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error ?? "Error al guardar");
      return;
    }

    setSuccess(editId ? "Novedad actualizada." : "Novedad guardada como borrador.");
    setTimeout(() => setSuccess(null), 3000);
    cancel();
    loadNews();
  }

  async function publish(id: string) {
    if (!confirm("¿Publicar esta novedad para todos los usuarios? Ya no será un borrador.")) return;
    setPublishing(id);
    const r = await fetch(`/api/system/news/${id}`, { method: "PATCH" });
    setPublishing(null);
    if (r.ok) {
      setSuccess("Novedad publicada para todos los usuarios.");
      setTimeout(() => setSuccess(null), 3000);
      loadNews();
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta novedad?")) return;
    await fetch(`/api/system/news/${id}`, { method: "DELETE" });
    loadNews();
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Vista previa modal */}
      {preview && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setPreview(null)}
          />
          <div className="relative z-10 w-full max-w-md">
            <div className="flex justify-center mb-3">
              <span className="text-xs bg-dojo-gold/20 text-dojo-gold border border-dojo-gold/30 px-3 py-1 rounded-full font-semibold">
                Vista previa — así lo ven los usuarios
              </span>
            </div>
            <div className="h-1 rounded-t-2xl bg-gradient-to-r from-dojo-gold/60 via-dojo-gold to-dojo-gold/60" />
            <div className="bg-dojo-dark border-x border-b border-dojo-border/80 rounded-b-2xl overflow-hidden shadow-2xl shadow-black/60">
              <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-dojo-gold/10 border border-dojo-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={18} className="text-dojo-gold" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black tracking-widest text-dojo-gold uppercase">
                        Dojo Master Online
                      </span>
                      <span className="text-[10px] bg-dojo-gold/15 text-dojo-gold border border-dojo-gold/30 px-2 py-0.5 rounded-full font-bold">
                        {preview.version}
                      </span>
                    </div>
                    <p className="text-base font-bold text-dojo-white mt-0.5 leading-snug">{preview.title}</p>
                    <p className="text-[11px] text-dojo-muted mt-0.5">{formatDate(preview.publishedAt)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setPreview(null)}
                  className="p-1.5 text-dojo-muted hover:text-dojo-white transition-colors shrink-0 mt-0.5"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mx-5 h-px bg-dojo-border/60" />
              <ul className="px-5 py-4 space-y-2.5">
                {(preview.items as NewsItem[]).map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-base leading-none mt-0.5 shrink-0">
                      {CATEGORY_EMOJI[item.category] ?? "✨"}
                    </span>
                    <span className="text-sm text-dojo-white/90 leading-snug">{item.text}</span>
                  </li>
                ))}
              </ul>
              <div className="px-5 pb-5 pt-3">
                <button
                  onClick={() => setPreview(null)}
                  className="w-full btn-primary text-sm py-2.5 font-semibold"
                >
                  ¡Entendido!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dojo-gold/10 border border-dojo-gold/20 flex items-center justify-center">
            <Sparkles size={20} className="text-dojo-gold" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-dojo-white">Novedades del Sistema</h1>
            <p className="text-xs text-dojo-muted">Anuncios visibles en todos los dojos al iniciar sesión</p>
          </div>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Nueva novedad
        </button>
      </div>

      {/* Feedback */}
      {success && (
        <div className="bg-green-900/30 border border-green-700/40 text-green-300 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
          <Check size={15} /> {success}
        </div>
      )}

      {/* Formulario — modal overlay */}
      {showForm && (
        <div className="fixed inset-0 z-[500] flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cancel} />
          <div className="relative z-10 w-full max-w-2xl my-6 card space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-dojo-white">
              {editId ? "Editar novedad" : "Nueva novedad"}
            </h2>
            <button onClick={cancel} className="text-dojo-muted hover:text-dojo-white">
              <X size={18} />
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/20 border border-red-700/30 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Versión</label>
              <input
                className="form-input"
                placeholder="v2.4 · Julio 2026"
                value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Audiencia</label>
              <select
                className="form-input"
                value={form.audience}
                onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
              >
                {AUDIENCE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Título de la novedad</label>
            <input
              className="form-input"
              placeholder="Actualización de Julio 2026"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Fecha de publicación</label>
              <input
                type="datetime-local"
                className="form-input"
                value={form.publishedAt}
                onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Estado</label>
              <select
                className="form-input"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="draft">Borrador — solo usuario de prueba</option>
                <option value="published">Publicar inmediatamente</option>
              </select>
            </div>
          </div>

          {form.status === "draft" && (
            <div>
              <label className="form-label flex items-center gap-1.5">
                <Mail size={13} className="text-dojo-muted" />
                Correo del usuario de prueba
                <span className="text-dojo-muted font-normal">(opcional)</span>
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="usuario@ejemplo.com"
                value={form.testUserEmail}
                onChange={e => setForm(f => ({ ...f, testUserEmail: e.target.value }))}
              />
              <p className="text-[11px] text-dojo-muted mt-1.5">
                Este usuario verá el modal al iniciar sesión y puede confirmar que todo se ve correctamente antes de publicarlo para todos.
              </p>
            </div>
          )}

          {/* Ítems */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">Ítems de la novedad</label>
              <button
                onClick={addItem}
                className="text-xs text-dojo-gold hover:text-dojo-gold/80 flex items-center gap-1 transition-colors"
              >
                <Plus size={13} /> Agregar ítem
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className="form-input text-sm w-44 shrink-0"
                    value={item.category}
                    onChange={e => setItem(i, "category", e.target.value)}
                  >
                    {CATEGORY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    className="form-input text-sm flex-1"
                    placeholder="Descripción breve del cambio..."
                    value={item.text}
                    onChange={e => setItem(i, "text", e.target.value)}
                  />
                  {form.items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-dojo-muted hover:text-red-400 transition-colors shrink-0">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {(form.title || form.items.some(i => i.text)) && (
            <div className="border border-dojo-gold/20 rounded-xl overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-dojo-gold/50 via-dojo-gold to-dojo-gold/50" />
              <div className="bg-dojo-darker/60 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black tracking-widest text-dojo-gold uppercase">Vista previa</span>
                  {form.version && (
                    <span className="text-[10px] bg-dojo-gold/15 text-dojo-gold border border-dojo-gold/30 px-2 py-0.5 rounded-full font-bold">
                      {form.version}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-dojo-white">{form.title || "Sin título"}</p>
                <ul className="space-y-1">
                  {form.items.filter(i => i.text).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-dojo-white/80">
                      <span>{CATEGORY_EMOJI[item.category]}</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={cancel} className="btn-secondary flex-1 text-sm">Cancelar</button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editId
                ? "Guardar cambios"
                : form.status === "draft" ? "Guardar borrador" : "Publicar novedad"
              }

            </button>
          </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="card animate-pulse h-20 bg-dojo-border/60" />
          ))}
        </div>
      ) : newsList.length === 0 ? (
        <div className="card text-center py-12">
          <Sparkles size={32} className="text-dojo-gold/30 mx-auto mb-3" />
          <p className="text-dojo-muted text-sm">No hay novedades publicadas.</p>
          <p className="text-dojo-muted/60 text-xs mt-1">Crea la primera para que todos los usuarios la vean al iniciar sesión.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {newsList.map(n => (
            <div key={n.id} className={`card border ${
              n.status === "draft" ? "border-amber-600/30" : "border-dojo-border"
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs bg-dojo-gold/15 text-dojo-gold border border-dojo-gold/30 px-2 py-0.5 rounded-full font-bold">
                      {n.version}
                    </span>
                    {/* Estado badge */}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                      n.status === "published"
                        ? "bg-green-900/30 text-green-300 border-green-700/30"
                        : "bg-amber-900/30 text-amber-300 border-amber-700/30"
                    }`}>
                      {n.status === "published" ? "✓ Publicado" : "Borrador"}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                      n.audience === "all"
                        ? "bg-blue-900/30 text-blue-300 border-blue-700/30"
                        : n.audience === "admins"
                          ? "bg-purple-900/30 text-purple-300 border-purple-700/30"
                          : "bg-green-900/30 text-green-300 border-green-700/30"
                    }`}>
                      {n.audience === "all" ? "Todos" : n.audience === "admins" ? "Admins" : "Estudiantes"}
                    </span>
                    <span className="text-[10px] text-dojo-muted">{formatDate(n.publishedAt)}</span>
                  </div>
                  <p className="text-sm font-semibold text-dojo-white truncate">{n.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-dojo-muted">
                      {(n.items as NewsItem[]).length} ítem{(n.items as NewsItem[]).length !== 1 ? "s" : ""}
                    </p>
                    {n.status === "draft" && n.testUserEmail && (
                      <p className="text-xs text-amber-400 flex items-center gap-1">
                        <Mail size={10} />
                        Prueba: {n.testUserEmail}
                      </p>
                    )}
                    {n.status === "draft" && !n.testUserEmail && (
                      <p className="text-xs text-dojo-muted/60">Sin usuario de prueba asignado</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setExpanded(e => e === n.id ? null : n.id)}
                    className="p-1.5 text-dojo-muted hover:text-dojo-white transition-colors"
                  >
                    {expanded === n.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {/* Vista previa */}
                  <button
                    onClick={() => setPreview(n)}
                    className="p-1.5 text-dojo-muted hover:text-dojo-gold transition-colors"
                    title="Ver como lo ven los usuarios"
                  >
                    <Eye size={15} />
                  </button>
                  <button
                    onClick={() => openEdit(n)}
                    className="p-1.5 text-dojo-muted hover:text-dojo-gold transition-colors"
                  >
                    <Edit2 size={15} />
                  </button>
                  {/* Publicar (solo borradores) */}
                  {n.status === "draft" && (
                    <button
                      onClick={() => publish(n.id)}
                      disabled={publishing === n.id}
                      className="p-1.5 text-dojo-muted hover:text-green-400 transition-colors"
                      title="Publicar para todos"
                    >
                      {publishing === n.id
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Globe size={15} />
                      }
                    </button>
                  )}
                  <button
                    onClick={() => remove(n.id)}
                    className="p-1.5 text-dojo-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {expanded === n.id && (
                <ul className="mt-3 pt-3 border-t border-dojo-border/60 space-y-1.5">
                  {(n.items as NewsItem[]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-dojo-white/80">
                      <span className="shrink-0">{CATEGORY_EMOJI[item.category] ?? "✨"}</span>
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
