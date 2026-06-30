"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Crown, Plus, Trophy, MapPin, Calendar, Users, ChevronRight, Archive } from "lucide-react";
import { TournamentOnboardingVideo, OnboardingReopenButton } from "@/components/tournaments/TournamentOnboardingVideo";

interface Tournament {
  id: string; name: string; date: string; location: string;
  organization: string; status: string; archivedAt: string | null;
  _count: { participants: number };
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Borrador",   cls: "badge-yellow" },
  ready:     { label: "Listo",      cls: "badge-blue"   },
  active:    { label: "Activo",     cls: "badge-green"  },
  completed: { label: "Completo",   cls: "badge-red"    },
  confirmed: { label: "Confirmado", cls: "badge-green"  },
};

export default function TournamentsProPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetch("/api/tournaments")
      .then(r => r.ok ? r.json() : { tournaments: [] })
      .then(data => {
        const list: Tournament[] = Array.isArray(data) ? data : (data.tournaments ?? []);
        setTournaments(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const active  = tournaments.filter(t => !t.archivedAt);
  const history = tournaments.filter(t => !!t.archivedAt);
  const shown   = showHistory ? history : active;

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Onboarding modal — aparece solo la primera vez */}
      <TournamentOnboardingVideo />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <Crown size={28} className="text-dojo-gold"/> Torneo Pro
          </h1>
          <p className="text-dojo-muted text-sm mt-1">
            Gestión completa: inscripciones, llaves, tatamis y transmisión en vivo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OnboardingReopenButton />
          <Link href="/dashboard/tournaments-pro/new" className="btn-primary flex items-center gap-2">
            <Plus size={16}/> Nuevo Torneo
          </Link>
        </div>
      </div>

      {/* Tabs activo / historial */}
      <div className="flex gap-1 border-b border-dojo-border pb-0">
        {[
          { key: false, label: `Activos (${active.length})` },
          { key: true,  label: `Historial (${history.length})` },
        ].map(opt => (
          <button key={String(opt.key)} onClick={() => setShowHistory(opt.key)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              showHistory === opt.key
                ? "border-dojo-gold text-dojo-gold bg-dojo-gold/5"
                : "border-transparent text-dojo-muted hover:text-dojo-white"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-dojo-border/40 rounded-xl animate-pulse"/>)}
        </div>
      ) : shown.length === 0 ? (
        <div className="card text-center py-16 space-y-3">
          <Trophy size={40} className="text-dojo-muted mx-auto"/>
          <p className="text-dojo-muted">
            {showHistory ? "No hay torneos en el historial." : "No hay torneos activos."}
          </p>
          {!showHistory && (
            <Link href="/dashboard/tournaments-pro/new" className="btn-primary inline-flex items-center gap-2">
              <Plus size={14}/> Crear primer torneo
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(t => {
            const st = STATUS_CFG[t.status] ?? { label: t.status, cls: "badge-yellow" };
            return (
              <Link key={t.id} href={`/dashboard/tournaments-pro/${t.id}`}
                className="card flex items-center gap-4 hover:border-dojo-gold/40 border-2 border-transparent transition-all group">
                <div className="w-12 h-12 rounded-xl bg-dojo-gold/10 flex items-center justify-center shrink-0">
                  {t.archivedAt
                    ? <Archive size={20} className="text-dojo-muted"/>
                    : <Crown size={20} className="text-dojo-gold"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-dojo-white truncate">{t.name}</p>
                    <span className={st.cls}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-dojo-muted flex-wrap">
                    <span className="flex items-center gap-1"><Calendar size={10}/>{new Date(t.date).toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                    {t.location && <span className="flex items-center gap-1"><MapPin size={10}/>{t.location}</span>}
                    <span className="flex items-center gap-1"><Users size={10}/>{t._count.participants} atletas</span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-dojo-muted group-hover:text-dojo-gold transition-colors shrink-0"/>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
