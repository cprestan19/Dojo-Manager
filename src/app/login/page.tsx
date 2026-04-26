"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Sword, Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router  = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");

    const res = await signIn("credentials", {
      email, password, redirect: false,
    });

    if (res?.ok) {
      router.push("/dashboard");
    } else {
      setError("Credenciales incorrectas. Verifique su email y contraseña.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dojo-darker relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: "repeating-linear-gradient(45deg, #C0392B 0, #C0392B 1px, transparent 0, transparent 50%)",
          backgroundSize: "40px 40px",
        }} />
      </div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-dojo-red/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-dojo-gold/5 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-dojo-red rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-dojo-red/30">
            <Sword size={36} className="text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-dojo-white tracking-widest">DOJO</h1>
          <p className="font-display text-dojo-gold tracking-widest text-sm">MANAGER</p>
          <p className="text-dojo-muted text-sm mt-2">Sistema de Administración de Karate</p>
        </div>

        {/* Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="form-label">Correo Electrónico</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input pl-9"
                  placeholder="usuario@dojo.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input pl-9 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted hover:text-dojo-white transition-colors"
                >
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Iniciando sesión...
                </span>
              ) : "Iniciar Sesión"}
            </button>
          </form>
        </div>

        <p className="text-center text-dojo-muted text-xs mt-6">
          © {new Date().getFullYear()} DojoManager · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}
