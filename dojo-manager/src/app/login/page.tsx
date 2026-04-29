"use client";
import { Suspense, useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sword, Eye, EyeOff, Lock, Mail } from "lucide-react";
import Image from "next/image";

interface DojoInfo { name: string; logo: string | null; slug: string }

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const dojoSlug     = searchParams.get("dojo");

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [dojo,     setDojo]     = useState<DojoInfo | null>(null);
  const [bgImage,  setBgImage]  = useState<string | null>(null);

  useEffect(() => {
    if (!dojoSlug) return;
    fetch(`/api/public/dojo/${dojoSlug}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setDojo(data); })
      .catch(() => {});
  }, [dojoSlug]);

  useEffect(() => {
    const slugParam = dojoSlug ? `?slug=${dojoSlug}` : "";
    fetch(`/api/public/login-bg${slugParam}`)
      .then(r => r.json())
      .then(d => { if (d.loginBgImage) setBgImage(d.loginBgImage); })
      .catch(() => {});
  }, [dojoSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");

    const res = await signIn("credentials", { email, password, redirect: false });

    if (res?.ok) {
      const { getSession } = await import("next-auth/react");
      const sess = await getSession();
      const role = (sess?.user as { role?: string })?.role;
      router.push(role === "student" ? "/portal" : "/dashboard");
      return;
    }

    setError("Credenciales incorrectas. Verifique su email y contraseña.");
    setLoading(false);
  }

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center bg-dojo-darker relative overflow-hidden"
      style={bgImage ? {
        backgroundImage:      `url(${bgImage})`,
        backgroundSize:       "cover",
        backgroundPosition:   "center",
        backgroundAttachment: "fixed",
      } : {}}
    >
      {bgImage && <div className="absolute inset-0 bg-black/50 z-0" />}

      {!bgImage && (
        <>
          <div className="absolute inset-0 opacity-5 z-0">
            <div className="absolute inset-0" style={{
              backgroundImage: "repeating-linear-gradient(45deg, #C0392B 0, #C0392B 1px, transparent 0, transparent 50%)",
              backgroundSize: "40px 40px",
            }} />
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-dojo-red/10 rounded-full blur-3xl z-0" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-dojo-gold/5 rounded-full blur-3xl z-0" />
        </>
      )}

      <div className="relative z-10 w-full max-w-sm mx-auto px-4 py-8">
        {/* Logo / Branding */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-dojo-red rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-dojo-red/30 overflow-hidden">
            {dojo?.logo ? (
              <Image src={dojo.logo} alt={dojo.name} width={80} height={80} className="object-contain w-full h-full" />
            ) : (
              <Sword size={36} className="text-white" />
            )}
          </div>
          {dojo ? (
            <>
              <h1 className="font-display text-xl font-bold text-dojo-white tracking-tight">{dojo.name}</h1>
              <p className="font-display text-dojo-gold tracking-widest text-[10px] font-semibold uppercase mt-1">Dojo Manager</p>
            </>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold text-dojo-white tracking-tight">Dojo Manager</h1>
              <p className="font-display text-dojo-gold tracking-widest text-[10px] font-semibold uppercase mt-1">Sistema de Karate</p>
            </>
          )}
          <p className="font-body text-dojo-muted text-xs mt-1.5">Gestión de tu dojo, simplificada</p>
        </div>

        {/* Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="font-body text-xs font-semibold text-dojo-muted uppercase tracking-wider block mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="form-input pl-9 font-body" placeholder="usuario@dojo.com" required
                  style={{ fontSize: "16px" }}
                />
              </div>
            </div>

            <div>
              <label className="font-body text-xs font-semibold text-dojo-muted uppercase tracking-wider block mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input
                  type={showPass ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input pl-9 pr-10 font-body" placeholder="••••••••" required
                  style={{ fontSize: "16px" }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dojo-muted hover:text-dojo-white transition-colors">
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{error}</div>
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

            <div className="text-center">
              <a href="/forgot-password" className="font-body text-xs text-dojo-muted hover:text-dojo-red transition-colors">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          </form>
        </div>

        <p className="font-body text-center text-dojo-muted text-xs mt-6">
          © {new Date().getFullYear()} Dojo Manager · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
