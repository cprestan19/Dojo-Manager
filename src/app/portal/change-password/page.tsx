"use client";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Lock, Eye, EyeOff, ShieldAlert, CheckCircle } from "lucide-react";

export default function PortalChangePasswordPage() {
  const { data: session } = useSession();

  const [current,  setCurrent]  = useState("");
  const [next,     setNext]     = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (next.length < 8)  { setError("Mínimo 8 caracteres."); return; }
    if (next === current) { setError("La nueva contraseña debe ser diferente."); return; }

    setSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Error al cambiar contraseña."); return; }
    setSuccess(true);
    setTimeout(() => signOut({ callbackUrl: "/login" }), 2000);
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center py-16">
        <CheckCircle size={48} className="text-green-400" />
        <p className="font-display text-dojo-white text-xl font-bold">¡Contraseña actualizada!</p>
        <p className="text-dojo-muted text-sm">Redirigiendo al inicio de sesión…</p>
      </div>
    );
  }

  const user   = session?.user as { email?: string; mustChangePassword?: boolean } | undefined;
  const forced = user?.mustChangePassword === true;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-dojo-white flex items-center gap-2">
          <Lock size={20} className="text-dojo-red" /> Cambiar Contraseña
        </h1>
        {forced && (
          <div className="mt-3 flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-700/40 rounded-xl">
            <ShieldAlert size={16} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-yellow-300 text-sm">
              Debes cambiar tu contraseña temporal antes de continuar.
            </p>
          </div>
        )}
      </div>
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Contraseña actual",          value: current,  set: setCurrent,  show: showCur,  setShow: setShowCur },
            { label: "Nueva contraseña",           value: next,     set: setNext,     show: showNew,  setShow: setShowNew },
            { label: "Confirmar nueva contraseña", value: confirm,  set: setConfirm,  show: false,    setShow: () => {} },
          ].map(f => (
            <div key={f.label}>
              <label className="form-label">{f.label}</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input
                  type={f.show ? "text" : "password"}
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  className="form-input pl-9 pr-9"
                  placeholder="••••••••"
                  required
                  style={{ fontSize: "16px" }}
                />
                {f.label !== "Confirmar nueva contraseña" && (
                  <button type="button" onClick={() => f.setShow(!f.show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted hover:text-dojo-white">
                    {f.show ? <EyeOff size={14}/> : <Eye size={14}/>}
                  </button>
                )}
              </div>
            </div>
          ))}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-3">
            {saving ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
