"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  ShoppingBag, Plus, Edit2, Trash2, X, Save,
  Image as ImageIcon, Tag, Eye, EyeOff, Check,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface Product {
  id:          string;
  name:        string;
  description: string | null;
  price:       number;
  currency:    string;
  imageUrl:    string | null;
  sizes:       unknown;  // Json → cast to string[]
  active:      boolean;
}

const PRESET_SIZES = ["XS","S","M","L","XL","XXL","Único"];
const EMPTY_FORM   = { name:"", description:"", price:"", currency:"USD", imageUrl:"", sizes:[] as string[], active:true };

function fmtPrice(price: number, currency: string) {
  return new Intl.NumberFormat("es-PA", { style:"currency", currency, minimumFractionDigits:2 }).format(price);
}

export default function StorePage() {
  const [products,  setProducts]  = useState<Product[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [editing,   setEditing]   = useState<Product | null>(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [customSize,setCustomSize]= useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/store-products");
    if (r.ok) setProducts(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setError(""); setSaved(false); setModal(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name:        p.name,
      description: p.description ?? "",
      price:       String(p.price),
      currency:    p.currency,
      imageUrl:    p.imageUrl ?? "",
      sizes:       Array.isArray(p.sizes) ? (p.sizes as string[]) : [],
      active:      p.active,
    });
    setError(""); setSaved(false); setModal(true);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("type","image"); fd.append("purpose","store-product");
    const r = await fetch("/api/upload", { method:"POST", body:fd });
    const j = await r.json();
    if (r.ok) setForm(f => ({ ...f, imageUrl: j.url }));
    else setError(j.error ?? "Error al subir imagen");
    setUploading(false);
  }

  function toggleSize(s: string) {
    setForm(f => ({
      ...f,
      sizes: f.sizes.includes(s) ? f.sizes.filter(x => x !== s) : [...f.sizes, s],
    }));
  }
  function addCustomSize() {
    const s = customSize.trim().toUpperCase();
    if (s && !form.sizes.includes(s)) setForm(f => ({ ...f, sizes: [...f.sizes, s] }));
    setCustomSize("");
  }

  async function save() {
    setError(""); setSaved(false);
    if (!form.name.trim())         { setError("El nombre es requerido"); return; }
    if (!form.price || isNaN(Number(form.price))) { setError("El precio es inválido"); return; }
    setSaving(true);
    try {
      const body = {
        name:        form.name.trim(),
        description: form.description.trim() || null,
        price:       Number(form.price),
        currency:    form.currency,
        imageUrl:    form.imageUrl || null,
        sizes:       form.sizes.length > 0 ? form.sizes : null,
        active:      form.active,
      };
      const url    = editing ? `/api/store-products/${editing.id}` : "/api/store-products";
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, { method, headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Error al guardar"); return; }
      setSaved(true);
      setTimeout(() => { setModal(false); setSaved(false); load(); }, 1000);
    } finally { setSaving(false); }
  }

  async function toggleActive(p: Product) {
    await fetch(`/api/store-products/${p.id}`, {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ ...p, active: !p.active, sizes: Array.isArray(p.sizes) ? p.sizes : null }),
    });
    load();
  }

  async function deleteProduct(id: string) {
    if (!confirm("¿Eliminar este producto?")) return;
    setDeleting(id);
    await fetch(`/api/store-products/${id}`, { method:"DELETE" });
    setDeleting(null); load();
  }

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-2">
            <ShoppingBag size={22} className="text-dojo-red" /> Tienda
          </h1>
          <p className="text-dojo-muted text-sm mt-0.5">
            Catálogo de productos — los clientes consultan por WhatsApp
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} /> Nuevo Producto
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-dojo-border/40 bg-dojo-border/10">
        <ShoppingBag size={15} className="text-dojo-red shrink-0 mt-0.5" />
        <p className="text-xs text-dojo-muted leading-relaxed">
          Los productos se muestran en tu página pública. Los clientes seleccionan talla y presionan
          <strong className="text-dojo-white"> "Consultar por WhatsApp"</strong> — el mensaje llega con el artículo,
          talla y precio. Tú coordinas pago y entrega directamente.
        </p>
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="card text-center py-16 space-y-2">
          <ShoppingBag size={40} className="mx-auto text-dojo-muted opacity-30" />
          <p className="text-dojo-muted">Aún no tienes productos en la tienda.</p>
          <button onClick={openCreate} className="text-dojo-red text-sm hover:underline">
            Agregar el primero
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => {
            const sizes = Array.isArray(p.sizes) ? (p.sizes as string[]) : [];
            return (
              <div key={p.id} className={`card p-0 overflow-hidden transition-opacity ${p.active ? "" : "opacity-50"}`}>
                {/* Imagen */}
                {p.imageUrl
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="w-full h-48 object-cover block" />
                  : <div className="w-full h-48 bg-dojo-border/30 flex items-center justify-center">
                      <ImageIcon size={32} className="text-dojo-muted opacity-30" />
                    </div>
                }
                <div className="p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-dojo-white">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-dojo-muted mt-1 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <p className="text-xl font-bold text-dojo-red">{fmtPrice(p.price, p.currency)}</p>
                  {sizes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {sizes.map(s => (
                        <span key={s} className="text-[10px] font-bold px-2 py-0.5 rounded border border-dojo-border text-dojo-muted">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-1 border-t border-dojo-border/40">
                    <button onClick={() => toggleActive(p)}
                      className={`btn-ghost p-1.5 text-xs flex items-center gap-1 ${p.active ? "text-green-400" : "text-dojo-muted"}`}
                      title={p.active ? "Desactivar" : "Activar"}>
                      {p.active ? <Eye size={14}/> : <EyeOff size={14}/>}
                      {p.active ? "Activo" : "Inactivo"}
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => openEdit(p)} className="btn-ghost p-1.5 text-dojo-muted hover:text-dojo-white" title="Editar">
                      <Edit2 size={14}/>
                    </button>
                    <button onClick={() => deleteProduct(p.id)} disabled={deleting === p.id}
                      className="btn-ghost p-1.5 text-dojo-muted hover:text-red-400" title="Eliminar">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={editing ? "Editar Producto" : "Nuevo Producto"} size="lg">
        <div className="space-y-4">

          {/* Imagen */}
          <div>
            <label className="form-label">Foto del producto</label>
            <div onClick={() => fileRef.current?.click()}
              className="relative cursor-pointer rounded-xl overflow-hidden border-2 border-dashed border-dojo-border hover:border-dojo-red transition-colors group"
              style={{ minHeight:"120px" }}>
              {form.imageUrl
                ? <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.imageUrl} alt="" className="w-full h-48 object-cover block" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-sm font-semibold flex items-center gap-2"><ImageIcon size={15}/>Cambiar foto</p>
                    </div>
                  </>
                : <div className="flex flex-col items-center justify-center h-28 gap-2 text-dojo-muted group-hover:text-dojo-red transition-colors">
                    {uploading
                      ? <div className="w-5 h-5 border-2 border-dojo-red border-t-transparent rounded-full animate-spin"/>
                      : <><ImageIcon size={22}/><p className="text-xs">Clic para subir foto</p></>
                    }
                  </div>
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if(f) uploadImage(f); e.target.value=""; }} />
            {form.imageUrl && (
              <button onClick={() => setForm(f => ({...f, imageUrl:""}))}
                className="mt-1 text-xs text-dojo-muted hover:text-red-400 flex items-center gap-1">
                <X size={10}/> Quitar foto
              </button>
            )}
          </div>

          {/* Nombre */}
          <div>
            <label className="form-label">Nombre del producto *</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))}
              className="form-input" placeholder="Ej. Kimono de karate, Cinturón rojo..." />
          </div>

          {/* Precio y moneda */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Precio *</label>
              <div className="flex">
                <select value={form.currency} onChange={e => setForm(f => ({...f, currency:e.target.value}))}
                  className="form-input rounded-r-none border-r-0 w-20 shrink-0">
                  <option>USD</option><option>PAB</option><option>CRC</option>
                  <option>MXN</option><option>COP</option><option>VEF</option>
                </select>
                <input type="number" min="0" step="0.01" value={form.price}
                  onChange={e => setForm(f => ({...f, price:e.target.value}))}
                  className="form-input rounded-l-none flex-1" placeholder="0.00" />
              </div>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={() => setForm(f => ({...f, active:!f.active}))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${form.active ? "bg-dojo-red" : "bg-dojo-border"}`}
                  style={{ flex:"none" }}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.active ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-dojo-muted">{form.active ? "Visible en tienda" : "Oculto"}</span>
              </label>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="form-label">Descripción</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))}
              className="form-input resize-y" rows={3}
              placeholder="Material, medidas, características del producto..." />
          </div>

          {/* Tallas */}
          <div>
            <label className="form-label flex items-center gap-1.5"><Tag size={11}/> Tallas disponibles</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_SIZES.map(s => (
                <button key={s} type="button" onClick={() => toggleSize(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.sizes.includes(s)
                      ? "bg-dojo-red border-dojo-red text-white"
                      : "border-dojo-border text-dojo-muted hover:border-dojo-red/50"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
            {/* Talla personalizada */}
            <div className="flex gap-2">
              <input value={customSize} onChange={e => setCustomSize(e.target.value)}
                onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); addCustomSize(); }}}
                className="form-input flex-1 text-sm" placeholder="Agregar talla personalizada (Ej. 38, 40...)" />
              <button type="button" onClick={addCustomSize} className="btn-secondary text-sm px-3">
                <Plus size={14}/> Agregar
              </button>
            </div>
            {form.sizes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.sizes.map(s => (
                  <span key={s} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-dojo-red/20 text-dojo-red border border-dojo-red/30">
                    {s}
                    <button onClick={() => setForm(f => ({...f, sizes:f.sizes.filter(x=>x!==s)}))}
                      className="hover:text-white"><X size={10}/></button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-dojo-muted mt-1">Deja vacío si el producto no tiene tallas (accesorios, libros, etc.)</p>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
          )}
          {saved && (
            <p className="text-green-400 text-sm bg-green-900/20 border border-green-800/40 rounded-lg px-3 py-2 flex items-center gap-2">
              <Check size={14}/> ¡Producto guardado correctamente!
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setModal(false)} className="btn-secondary"><X size={16}/> Cancelar</button>
            <button onClick={save} disabled={saving || uploading} className="btn-primary">
              <Save size={16}/> {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
