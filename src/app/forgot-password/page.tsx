"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    await fetch("/api/auth/forgot-password", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-dojo-darker px-4">
      <div className="w-full max-w-sm">
        <Link href="/login" className="flex items-center gap-2 text-dojo-muted hover:text-dojo-white text-sm mb-6 transition-colors">
          <ArrowLeft size={16} /> Volver al inicio de sesión
        </Link>

        {sent ? (
          <div className="card text-center space-y-4">
            <CheckCircle size={48} className="text-green-400 mx-auto" />
            <h1 className="font-display text-xl font-bold text-dojo-white">Correo enviado</h1>
            <p className="text-dojo-muted text-sm">
              Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.
            </p>
            <Link href="/login" className="btn-primary w-full justify-center">
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <div className="card space-y-5">
            <div>
              <h1 className="font-display text-2xl font-bold text-dojo-white">¿Olvidaste tu contraseña?</h1>
              <p className="text-dojo-muted text-sm mt-1">
                Ingresa tu correo y te enviaremos un enlace para restablecerla.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">Correo electrónico</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="form-input pl-9" placeholder="tu@correo.com" required
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                {loading ? "Enviando..." : "Enviar enlace"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
