"use client";
import { useState, useEffect } from "react";
import { ShoppingBag, Image as ImageIcon, Check, Loader2 } from "lucide-react";

interface Product {
  id:          string;
  name:        string;
  description: string | null;
  price:       number;
  currency:    string;
  imageUrl:    string | null;
  sizes:       unknown; // Json → string[]
}

interface Member {
  id:       string;
  fullName: string;
  isMe:     boolean;
}

function fmtPrice(price: number, currency: string) {
  return new Intl.NumberFormat("es-PA", { style: "currency", currency, minimumFractionDigits: 2 }).format(price);
}

export default function PortalStorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [members,  setMembers]  = useState<Member[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    fetch("/api/portal/store")
      .then(async r => {
        if (r.status === 403) { setNoAccess(true); return null; }
        return r.ok ? r.json() as Promise<{ products: Product[]; members: Member[] }> : null;
      })
      .then(data => {
        if (data) { setProducts(data.products); setMembers(data.members); }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 size={24} className="animate-spin text-dojo-gold" />
      </div>
    );
  }

  if (noAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 px-4">
        <ShoppingBag size={48} className="text-dojo-border" />
        <p className="text-dojo-white font-semibold text-lg">Tienda no disponible</p>
        <p className="text-dojo-muted text-sm">El plan de tu academia no incluye la tienda en línea.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ShoppingBag size={22} className="text-dojo-red shrink-0" />
        <div>
          <h1 className="font-display text-xl font-bold text-dojo-white">Tienda</h1>
          <p className="text-dojo-muted text-xs">Productos de tu dojo</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card text-center py-14 space-y-2">
          <ShoppingBag size={36} className="mx-auto text-dojo-muted opacity-40" />
          <p className="text-dojo-muted text-sm">Aún no hay productos disponibles.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map(p => (
            <ProductCard key={p.id} product={p} members={members} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, members }: { product: Product; members: Member[] }) {
  const sizes = Array.isArray(product.sizes) ? (product.sizes as string[]) : [];
  const [open,      setOpen]      = useState(false);
  const [size,      setSize]      = useState("");
  const [studentId, setStudentId] = useState(members.find(m => m.isMe)?.id ?? members[0]?.id ?? "");
  const [notes,     setNotes]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState("");

  async function submit() {
    if (sizes.length > 0 && !size) { setError("Selecciona una talla"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/portal/store", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ productId: product.id, size: size || undefined, notes: notes.trim() || undefined, studentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Error al enviar la solicitud");
      }
      setSent(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar la solicitud");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-0 overflow-hidden">
      {product.imageUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={product.imageUrl} alt={product.name} className="w-full h-auto block" />
        : <div className="w-full h-40 bg-dojo-border/30 flex items-center justify-center">
            <ImageIcon size={28} className="text-dojo-muted opacity-30" />
          </div>
      }
      <div className="p-4 space-y-3">
        <div>
          <h2 className="font-display font-bold text-dojo-white text-lg leading-tight">{product.name}</h2>
          {product.description && (
            <p className="text-sm text-dojo-muted mt-1">{product.description}</p>
          )}
        </div>
        <p className="text-xl font-bold text-dojo-red">{fmtPrice(product.price, product.currency)}</p>

        {sent ? (
          <p className="flex items-center gap-1.5 text-sm text-green-400 font-semibold bg-green-900/10 border border-green-800/40 rounded-lg px-3 py-2">
            <Check size={14} /> Solicitud enviada — tu dojo se pondrá en contacto contigo
          </p>
        ) : !open ? (
          <button onClick={() => setOpen(true)} className="btn-primary w-full">
            Quiero comprar
          </button>
        ) : (
          <div className="space-y-3 border-t border-dojo-border/40 pt-3">
            {sizes.length > 0 && (
              <div>
                <p className="text-xs text-dojo-muted mb-1.5">Talla</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map(s => (
                    <button key={s} type="button" onClick={() => setSize(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        size === s ? "bg-dojo-red border-dojo-red text-white" : "border-dojo-border text-dojo-muted"
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {members.length > 1 && (
              <div>
                <p className="text-xs text-dojo-muted mb-1.5">¿Para quién es?</p>
                <select value={studentId} onChange={e => setStudentId(e.target.value)} className="form-input text-sm">
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.fullName}{m.isMe ? " (yo)" : ""}</option>
                  ))}
                </select>
              </div>
            )}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Nota adicional (opcional)..."
              className="form-input text-sm min-h-14 resize-y w-full"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOpen(false)} className="btn-ghost text-sm">Cancelar</button>
              <button onClick={submit} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Enviar solicitud
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
