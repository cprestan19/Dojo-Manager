"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Eye, EyeOff, LogIn, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface DojoInfo {
  name: string;
  logo: string | null;
  slug: string;
}

export default function DojoLoginPage() {
  const params              = useParams();
  const slug                = params.slug as string;
  const router              = useRouter();
  const { data: session, status } = useSession();

  const [dojo,       setDojo]       = useState<DojoInfo | null>(null);
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  // Cargar info del dojo
  useEffect(() => {
    fetch(`/api/public/dojo/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDojo(d); })
      .catch(() => {});
  }, [slug]);

  // Si ya tiene sesión activa, redirigir
  useEffect(() => {
    if (status === "authenticated" && session) {
      const role = (session.user as { role?: string })?.role;
      router.replace(role === "student" ? "/portal" : "/dashboard");
    }
  }, [status, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const result = await signIn("credentials", {
        email:    email.trim().toLowerCase(),
        password,
        dojoSlug: slug,
        redirect: false,
      });

      if (!result?.ok || result.error) {
        setError("Credenciales incorrectas o no tienes acceso a este dojo.");
      } else {
        // Root page maneja la redirección según el rol
        router.replace("/");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080C14]">
        <Loader2 size={32} className="text-white/30 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#080C14] relative">

      {/* Fondo sutil */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at top, #C0392B15 0%, transparent 60%)" }} />

      {/* Volver a la página pública */}
      <div className="absolute top-4 left-4">
        <Link href={`/dojo/${slug}`}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft size={15} /> Volver al inicio
        </Link>
      </div>

      <div className="w-full max-w-sm relative">

        {/* Branding del dojo */}
        <div className="text-center mb-8">
          {dojo?.logo && (
            <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 shadow-xl"
              style={{ border: "2px solid rgba(192,57,43,0.4)", background: "rgba(192,57,43,0.2)" }}>
              <Image src={dojo.logo} alt={dojo.name ?? "Dojo"}
                width={64} height={64} className="w-full h-full object-contain" unoptimized />
            </div>
          )}
          {dojo ? (
            <>
              <h1 className="text-2xl font-black text-white tracking-wide"
                style={{ fontFamily: "'Cinzel', serif" }}>
                {dojo.name}
              </h1>
              <p className="text-white/40 text-sm mt-1">Acceso exclusivo para miembros</p>
            </>
          ) : (
            <div className="space-y-2 animate-pulse">
              <div className="h-6 w-40 bg-white/10 rounded mx-auto" />
              <div className="h-3 w-28 bg-white/5 rounded mx-auto" />
            </div>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}
          className="space-y-4 p-6 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl text-white placeholder-white/25 focus:outline-none text-sm"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", fontSize:"16px" }}
              placeholder="tu@correo.com"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl text-white placeholder-white/25 focus:outline-none text-sm pr-11"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", fontSize:"16px" }}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm text-red-300"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <span className="shrink-0 mt-0.5">⚠️</span>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 mt-2"
            style={{ background: "#C0392B", boxShadow: "0 4px 20px rgba(192,57,43,0.4)" }}>
            {loading
              ? <><Loader2 size={18} className="animate-spin"/> Verificando...</>
              : <><LogIn size={18}/> Ingresar</>
            }
          </button>
        </form>

        {/* Info de acceso */}
        <p className="text-center text-white/25 text-xs mt-6 leading-relaxed">
          Solo los miembros registrados en {dojo?.name ?? "este dojo"} pueden ingresar.
          <br/>Si olvidaste tu contraseña, contacta al administrador.
        </p>

        {/* Powered by */}
        <p className="text-center mt-4">
          <a href="https://dojomasteronline.com" target="_blank" rel="noopener noreferrer"
            className="text-xs text-white/15 hover:text-white/30 transition-colors">
            by dojomasteronline.com
          </a>
        </p>
      </div>
    </div>
  );
}
