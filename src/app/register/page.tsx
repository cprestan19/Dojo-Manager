"use client";
import Link from "next/link";
import {
  Users, CreditCard, QrCode, Globe, Trophy, Video,
} from "lucide-react";
import RegisterForm from "@/components/register/RegisterForm";

const PRIMARY = "#C0392B";

/* ── Columna de beneficios propia de /register ─────────────── */
function RegisterSidebar() {
  return (
    <div className="space-y-6 md:sticky md:top-12">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: PRIMARY }}>Registro gratuito</p>
        <h1 className="font-black text-4xl text-white leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>
          Tu dojo en Dojo Master<br />en 2 minutos
        </h1>
        <p className="text-white/50 text-base mt-3 leading-relaxed">
          Sin tarjeta de crédito. <strong className="text-white/70">Tu primer mes es gratis</strong> en cualquier plan.
        </p>
      </div>

      {/* Qué incluye */}
      <div className="space-y-3">
        {[
          { icon: QrCode,        label: "Asistencia QR — solo tu celular, sin hardware" },
          { icon: CreditCard,    label: "Cobros y recordatorios automáticos de mora" },
          { icon: Users,         label: "Fichas completas de alumnos con historial" },
          { icon: Video,         label: "Portal del alumno con videos de katas (Academia y padres)" },
          { icon: Globe,         label: "Carnet digital (Academia y padres) · página web (Torneo)" },
          { icon: Trophy,        label: "Torneos con streaming en vivo (plan Torneo)" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${PRIMARY}22` }}>
              <Icon size={14} style={{ color: PRIMARY }} />
            </div>
            <p className="text-sm text-white/65">{label}</p>
          </div>
        ))}
      </div>

      {/* Planes mini */}
      <div className="rounded-2xl p-4 space-y-2.5 border border-white/5" style={{ background: "#0D1117" }}>
        <p className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Planes disponibles — 1er mes gratis</p>
        {[
          { name: "🥋 Academia", limit: "Hasta 60 alumnos", price: "$14.99/mes", color: "#94A3B8" },
          { name: "🥈 Academia y padres",  limit: "Hasta 100 alumnos + portal", price: "$24.99/mes", color: "#F59E0B" },
          { name: "🥇 Academia, padres y Torneo",   limit: "Ilimitado + torneos Pro", price: "$44.99/mes", color: "#F59E0B" },
        ].map(p => (
          <div key={p.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm" style={{ color: p.color }}>{p.name}</span>
              <span className="text-xs text-white/35">{p.limit}</span>
            </div>
            <span className="text-xs font-bold text-white/60">{p.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Componente principal ─────────────────────────────────── */
export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080C14", fontFamily: "'Nunito', sans-serif" }}>

      {/* Nav mínimo */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between" style={{ background: "rgba(8,12,20,0.9)" }}>
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Dojo Master" className="w-8 h-8 object-contain rounded-lg" />
          <span className="font-black text-white text-lg tracking-wide">Dojo Master</span>
        </Link>
        <Link href="/login" className="text-sm text-white/50 hover:text-white transition-colors font-semibold">
          Ya tengo cuenta →
        </Link>
      </nav>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          <RegisterForm sidebar={<RegisterSidebar />} />
        </div>
      </div>
    </div>
  );
}
