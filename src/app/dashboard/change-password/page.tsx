"use client";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Lock, Eye, EyeOff, ShieldAlert, CheckCircle } from "lucide-react";

export default function ChangePasswordPage() {
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

    if (next !== confirm) { setError("Las contraseñas nuevas no coinciden."); return; }
    if (next.length < 8)  { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (next === current) { setError("La nueva contraseña debe ser diferente a la actual."); return; }

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
    // Sign out after 2s so new token is issued on next login
    setTimeout(() => signOut({ callbackUrl: "/login" }), 2000);
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-16 h-16 bg-green-900/30 border-2 border-green-600/40 rounded-2xl flex items-center justify-center">
          <CheckCircle size={32} className="text-green-400" />
        </div>
        <p className="font-display text-dojo-white text-xl font-bold">¡Contraseña actualizada!</p>
        <p className="text-dojo-muted text-sm">Redirigiendo al login…</p>
      </div>
    );
  }

  const user = session?.user as { email?: string; name?: string; mustChangePassword?: boolean } | undefined;
  const forced = user?.mustChangePassword === true;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
          <Lock size={22} className="text-dojo-red" /> Cambiar Contraseña
        </h1>
        {forced && (
          <div className="mt-3 flex items-start gap-3 p-4 bg-yellow-900/20 border border-yellow-700/40 rounded-xl">
            <ShieldAlert size={18} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-yellow-300 text-sm">
              Por seguridad debes cambiar tu contraseña temporal antes de continuar.
            </p>
          </div>
        )}
        {user?.email && (
          <p className="text-dojo-muted text-sm mt-2">Cuenta: <span className="text-dojo-gold font-mono">{user.email}</span></p>
        )}
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="form-label">Contraseña actual</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
              <input
                type={showCur ? "text" : "password"}
                value={current}
                onChange={e => setCurrent(e.target.value)}
                className="form-input pl-9 pr-10"
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowCur(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted hover:text-dojo-white transition-colors">
                {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label">Nueva contraseña</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
              <input
                type={showNew ? "text" : "password"}
                value={next}
                onChange={e => setNext(e.target.value)}
                className="form-input pl-9 pr-10"
                placeholder="Mínimo 8 caracteres"
                required
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted hover:text-dojo-white transition-colors">
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label">Confirmar nueva contraseña</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="form-input pl-9"
                placeholder="Repite la contraseña"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{error}</div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-3">
            {saving ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
