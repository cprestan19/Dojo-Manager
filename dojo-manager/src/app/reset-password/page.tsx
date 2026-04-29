"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";

function ResetForm() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) { setError("Las contraseñas no coinciden"); return; }
    if (password.length < 8)    { setError("Mínimo 8 caracteres"); return; }
    setLoading(true); setError("");
    const r = await fetch("/api/auth/reset-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token, password }),
    });
    const d = await r.json();
    setLoading(false);
    if (!r.ok) { setError(d.error ?? "Error al restablecer"); return; }
    setDone(true);
    setTimeout(() => router.push("/login"), 3000);
  }

  if (!token) return (
    <div className="card text-center space-y-3">
      <p className="text-red-400">Enlace inválido o expirado.</p>
      <Link href="/forgot-password" className="btn-secondary w-full justify-center">Solicitar nuevo enlace</Link>
    </div>
  );

  if (done) return (
    <div className="card text-center space-y-4">
      <CheckCircle size={48} className="text-green-400 mx-auto" />
      <h1 className="font-display text-xl font-bold text-dojo-white">¡Contraseña actualizada!</h1>
      <p className="text-dojo-muted text-sm">Redirigiendo al inicio de sesión...</p>
    </div>
  );

  return (
    <div className="card space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-dojo-white">Nueva contraseña</h1>
        <p className="text-dojo-muted text-sm mt-1">Elige una contraseña segura.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Nueva contraseña</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
            <input
              type={showPass ? "text" : "password"} value={password}
              onChange={e => setPassword(e.target.value)}
              className="form-input pl-9 pr-10" placeholder="Mínimo 8 caracteres" required
              style={{ fontSize: "16px" }}
            />
            <button type="button" onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted hover:text-dojo-white">
              {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
            </button>
          </div>
        </div>
        <div>
          <label className="form-label">Confirmar contraseña</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
            <input
              type={showPass ? "text" : "password"} value={password2}
              onChange={e => setPassword2(e.target.value)}
              className="form-input pl-9" placeholder="Repite la contraseña" required
              style={{ fontSize: "16px" }}
            />
          </div>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
          {loading ? "Guardando..." : "Establecer nueva contraseña"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-dojo-darker px-4">
      <div className="w-full max-w-sm">
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
