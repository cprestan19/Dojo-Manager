"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2, Link2, Copy, Check, ShieldCheck, XCircle, RefreshCw } from "lucide-react";

interface AsChild {
  status: "PENDING" | "ACTIVE" | "REVOKED";
  parentDojoName: string;
  requestedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}
interface AsParentRow {
  status: "PENDING" | "ACTIVE" | "REVOKED";
  childDojoName: string;
  requestedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}
interface StatusData { asChild: AsChild | null; asParent: AsParentRow[] }

function fmt(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" });
}

export default function FederacionPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [genLoading, setGenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [verifyCode, setVerifyCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifiedName, setVerifiedName] = useState<string | null>(null);

  const [acting, setActing] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const load = useCallback(async () => {
    const [statusRes, codeRes] = await Promise.all([
      fetch("/api/dojo-federation/status"),
      fetch("/api/dojo-federation/code"),
    ]);
    if (statusRes.ok) setStatus(await statusRes.json() as StatusData);
    if (codeRes.ok) setCode((await codeRes.json() as { code: string | null }).code);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generateCode() {
    setGenLoading(true);
    try {
      const res = await fetch("/api/dojo-federation/code", { method: "POST" });
      if (res.ok) { const d = await res.json() as { code: string }; setCode(d.code); }
    } finally { setGenLoading(false); }
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* portapapeles no disponible */ }
  }

  async function doVerify() {
    setVerifyError("");
    setVerifiedName(null);
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/dojo-federation/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const d = await res.json() as { childDojoName?: string; error?: string };
      if (!res.ok) { setVerifyError(d.error ?? "Error al verificar"); return; }
      setVerifiedName(d.childDojoName ?? null);
      setVerifyCode("");
      await load();
    } finally { setVerifyLoading(false); }
  }

  async function doAccept() {
    setActing(true);
    try {
      const res = await fetch("/api/dojo-federation/accept", { method: "POST" });
      if (res.ok) await load();
    } finally { setActing(false); }
  }

  async function doRevoke() {
    setActing(true);
    try {
      const res = await fetch("/api/dojo-federation/revoke", { method: "POST" });
      if (res.ok) { setConfirmRevoke(false); await load(); }
    } finally { setActing(false); }
  }

  if (loading) return <div className="p-6 flex justify-center"><Loader2 size={24} className="animate-spin text-dojo-gold" /></div>;

  const asChild = status?.asChild ?? null;

  return (
    <div className="p-6 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-lg font-display font-bold text-dojo-white flex items-center gap-2">
          <Link2 size={18} className="text-dojo-gold" /> Federación entre Dojos
        </h1>
        <p className="text-xs text-dojo-muted mt-1">
          Vincula tu dojo con un dojo padre para que sus Senseis puedan evaluar a tus postulados en Evaluaciones compartidas.
          Solo se comparte nombre, foto y cinta de los alumnos que tú elijas ofrecer — nunca cédula, salud, contactos ni pagos.
          Los resultados quedan siempre del lado del dojo padre; nunca se modifican tus propios datos.
        </p>
      </div>

      {/* Mi código de invitación (como hijo) */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-dojo-white text-sm">Mi código de invitación</h3>
        <p className="text-xs text-dojo-muted">
          Compártelo con tu dojo padre para que lo ingrese desde su pantalla de Evaluaciones. Regenerarlo invalida el código anterior de inmediato.
        </p>
        {code ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-dojo-gold tracking-widest bg-dojo-border/30 rounded-lg px-3 py-1.5 flex-1 text-center">
              {code}
            </span>
            <button onClick={copyCode} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0">
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />} {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-dojo-muted">Todavía no has generado un código.</p>
        )}
        <button onClick={generateCode} disabled={genLoading} className="btn-secondary text-xs flex items-center gap-1.5">
          {genLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {code ? "Regenerar código" : "Generar código"}
        </button>
      </div>

      {/* Mi vinculación como hijo */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-dojo-white text-sm">Mi dojo padre</h3>
        {!asChild && <p className="text-sm text-dojo-muted">Este dojo no tiene un dojo padre vinculado.</p>}
        {asChild?.status === "PENDING" && (
          <div className="space-y-3">
            <div className="bg-dojo-gold/10 border border-dojo-gold/30 rounded-lg px-3 py-2">
              <p className="text-sm text-dojo-white"><span className="font-semibold">{asChild.parentDojoName}</span> quiere vincularse como tu dojo padre.</p>
              <p className="text-xs text-dojo-muted mt-1">Solicitado el {fmt(asChild.requestedAt)}. Nada de tus datos es visible para ellos todavía — solo pasa a activo si aceptas.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={doAccept} disabled={acting} className="btn-primary text-xs flex items-center gap-1.5 flex-1 justify-center">
                {acting ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Aceptar
              </button>
              <button onClick={() => setConfirmRevoke(true)} disabled={acting} className="btn-secondary text-xs flex items-center gap-1.5 flex-1 justify-center">
                <XCircle size={13} /> Rechazar
              </button>
            </div>
          </div>
        )}
        {asChild?.status === "ACTIVE" && (
          <div className="space-y-3">
            <div className="bg-green-900/10 border border-green-800/30 rounded-lg px-3 py-2 flex items-center gap-2">
              <ShieldCheck size={16} className="text-green-400 shrink-0" />
              <p className="text-sm text-dojo-white">Vinculado con <span className="font-semibold">{asChild.parentDojoName}</span> desde el {fmt(asChild.acceptedAt)}.</p>
            </div>
            <button onClick={() => setConfirmRevoke(true)} className="btn-secondary text-xs text-dojo-red flex items-center gap-1.5">
              <XCircle size={13} /> Revocar vinculación
            </button>
          </div>
        )}
        {asChild?.status === "REVOKED" && (
          <p className="text-sm text-dojo-muted">
            Vinculación con <span className="text-dojo-white">{asChild.parentDojoName}</span> revocada el {fmt(asChild.revokedAt)}. Puedes generar un nuevo código para vincularte con otro dojo padre.
          </p>
        )}
      </div>

      {/* Vincular un dojo hijo (como padre) */}
      <div className="card space-y-3">
        <h3 className="font-semibold text-dojo-white text-sm">Vincular un dojo hijo</h3>
        <p className="text-xs text-dojo-muted">Ingresa el código de 10 dígitos que te compartió el dojo hijo.</p>
        {verifyError && <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{verifyError}</div>}
        {verifiedName && (
          <div className="text-green-400 text-xs bg-green-900/20 border border-green-800/40 rounded-lg px-3 py-2">
            ✓ Código verificado — dojo <span className="font-semibold">{verifiedName}</span>. Se envió la solicitud; queda pendiente hasta que ellos la acepten desde su propia pantalla.
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="form-input text-sm flex-1 font-mono tracking-widest"
            placeholder="0000000000" maxLength={10}
            value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ""))}
          />
          <button onClick={doVerify} disabled={verifyLoading || verifyCode.length !== 10} className="btn-primary text-sm shrink-0">
            {verifyLoading ? <Loader2 size={14} className="animate-spin" /> : "Verificar"}
          </button>
        </div>

        {status && status.asParent.length > 0 && (
          <div className="pt-2 border-t border-dojo-border space-y-2">
            {status.asParent.map((l, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-dojo-white">{l.childDojoName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  l.status === "ACTIVE" ? "bg-green-900/30 text-green-400"
                  : l.status === "PENDING" ? "bg-dojo-gold/20 text-dojo-gold"
                  : "bg-dojo-border/40 text-dojo-muted"
                }`}>
                  {l.status === "ACTIVE" ? "Activo" : l.status === "PENDING" ? "Pendiente" : "Revocado"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dojo-dark border border-dojo-border rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div>
              <p className="font-semibold text-dojo-white">Revocar vinculación</p>
              <p className="text-xs text-dojo-muted mt-1">
                El dojo padre deja de tener acceso de inmediato. Los puntajes que ya haya registrado no se borran ni se modifican.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRevoke(false)} disabled={acting} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={doRevoke} disabled={acting} className="flex-1 text-sm bg-dojo-red hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                {acting ? <Loader2 size={14} className="animate-spin" /> : null} Revocar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
