"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Crown, ArrowLeft, Info, Users, Trophy, Tv, Radio,
  Plus, Trash2, RefreshCw, Check, X, Search, Filter,
  Copy, Youtube, Monitor, QrCode, Play, Square,
  ChevronRight, AlertTriangle, Settings,
} from "lucide-react";
import { cn, BELT_COLORS, calculateAge } from "@/lib/utils";
import { BracketView, type BracketMatch, type SaveMatchData } from "@/components/tournaments/BracketView";
import { KataOrderList }     from "@/components/tournaments/KataOrderList";
import { TournamentStream }  from "@/components/tournaments/TournamentStream";
import { BeltBadge }         from "@/components/ui/BeltBadge";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { InscripcionesTab } from "./InscripcionesTab";
import {
  AGE_GROUPS, WEIGHT_CATEGORIES, BELT_CATEGORIES,
  buildCategoryLabel,
} from "@/lib/tournament-categories";

// ── Types ────────────────────────────────────────────────────────────────────

type Tab = "info" | "atletas" | "kumite" | "kata" | "tatamis" | "envivo" | "resultados" | "inscripciones";

interface Tournament {
  id: string; name: string; date: string; location: string;
  organization: string; leader1: string; leader2: string; leader3: string;
  status: string; bracketLocked: boolean; archivedAt: string | null;
  publicSlug: string | null; isPublic: boolean;
  tournamentType: string;
  registrationCloseAt: string | null;
  entryFeePerCategory: number | null;
  feeCurrency: string;
  requirePhoto: boolean; requireFederationId: boolean;
  requireWaiver: boolean; waiverText: string | null;
  maxAthletesPerClub: number | null;
  accreditationPin: string | null;
}
interface Student {
  id: string; fullName: string; birthDate: string; gender: string;
  beltHistory: { beltColor: string }[];
  active: boolean;
}
interface Participant {
  id: string; studentId: string; bracketId: string | null; seed: number;
  student: { id: string; fullName: string; birthDate: string; photo?: string | null; beltHistory: { beltColor: string }[] };
}
interface Bracket {
  id: string; name: string; type: string; gender: string | null;
  status: string; bracketLocked: boolean; order: number;
  categoryLabel: string | null;
  ageGroup: string | null; weightCategory: string | null;
  beltCategory: string | null; isTeamKata: boolean;
  _count: { participants: number; matches: number };
}
interface Tatami {
  id: string; name: string; color: string; order: number;
  youtubeVideoId: string | null; streamStatus: string;
  overlayMessage: string | null; currentMatchId: string | null;
  videoReviewEnabled: boolean;
  obsRecordingPath: string | null;
  _count: { judges: number };
}
interface Judge {
  id: string; name: string; role: string; tatamiId: string | null;
  nationality?: string | null; licenseNo?: string | null;
  tatami?: { id: string; name: string; color: string } | null;
}
interface TournamentMatch extends BracketMatch {
  bracketId: string | null;
}

const GENDER_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
];

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Borrador",   cls: "badge-yellow" },
  ready:     { label: "Listo",      cls: "badge-blue"   },
  active:    { label: "Activo",     cls: "badge-green"  },
  completed: { label: "Completo",   cls: "badge-red"    },
  confirmed: { label: "Confirmado", cls: "badge-green"  },
};

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-dojo-muted hover:text-dojo-white transition-colors shrink-0">
      {copied ? <Check size={12} className="text-green-400"/> : <Copy size={12}/>}
    </button>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function TournamentProDetailPage() {
  const { id }            = useParams<{ id: string }>();
  const router            = useRouter();
  const { data: session } = useSession();
  const toastHook         = useToast();
  const toast             = toastHook.show;
  const isSysadmin        = (session?.user as { role?: string })?.role === "sysadmin";

  const [tab,          setTab]          = useState<Tab>("info");
  const [tournament,   setTournament]   = useState<Tournament | null>(null);
  const [students,     setStudents]     = useState<Student[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [brackets,     setBrackets]     = useState<Bracket[]>([]);
  const [matches,      setMatches]      = useState<TournamentMatch[]>([]);
  const [tatamis,      setTatamis]      = useState<Tatami[]>([]);
  const [judges,       setJudges]       = useState<Judge[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [origin,       setOrigin]       = useState("");

  // ── Filtros de atletas ────────────────────────────────────────────────────
  const [search,      setSearch]      = useState("");
  const [filterBelt,  setFilterBelt]  = useState("");
  const [filterGender,setFilterGender]= useState("");
  const [filterAgeMin,setFilterAgeMin]= useState("");
  const [filterAgeMax,setFilterAgeMax]= useState("");
  const [selBrackets, setSelBrackets] = useState<string[]>([]); // IDs de brackets destino
  const [selIds,      setSelIds]      = useState<Set<string>>(new Set());
  const [savingPart,    setSavingPart]    = useState(false);
  const [creatingBracket, setCreatingBracket] = useState(false);

  // ── Bracket seleccionado ──────────────────────────────────────────────────
  const [activeBracket,    setActiveBracket]    = useState<Bracket | null>(null);
  const [bracketSubTab,    setBracketSubTab]    = useState<"athletes"|"bracket">("athletes");
  const [generatingBracket,setGeneratingBracket]= useState(false);
  const [confirmingBracket,setConfirmingBracket]= useState(false);

  // ── Nuevo bracket ─────────────────────────────────────────────────────────
  const [newBracketName,       setNewBracketName]       = useState("");
  const [newBracketType,       setNewBracketType]        = useState<"kumite"|"kata"|"ambas">("ambas");
  const [newBracketGender,     setNewBracketGender]      = useState("");
  // WKF campos
  const [newBracketAgeGroup,   setNewBracketAgeGroup]    = useState("");
  const [newBracketWeight,     setNewBracketWeight]      = useState("");
  const [newBracketBelt,       setNewBracketBelt]        = useState("");
  const [newBracketIsTeam,     setNewBracketIsTeam]      = useState(false);

  // ── Estado del torneo ────────────────────────────────────────────────────
  const [changingStatus, setChangingStatus] = useState(false);

  async function changeStatus(newStatus: string) {
    setChangingStatus(true);
    const r = await fetch(`/api/tournaments/${id}/status`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (r.ok) { toast("Estado actualizado", "success"); load(); }
    else { const d = await r.json(); toast(d.error ?? "Error", "error"); }
    setChangingStatus(false);
  }

  // ── Tatamis ───────────────────────────────────────────────────────────────
  const [newTatamiName,  setNewTatamiName]  = useState("");
  const [newTatamiColor, setNewTatamiColor] = useState("#C0392B");
  const [addingTatami,   setAddingTatami]   = useState(false);
  const [savingStream,   setSavingStream]   = useState<string | null>(null);
  const [ytInputs,       setYtInputs]       = useState<Record<string,string>>({});
  const [msgInputs,      setMsgInputs]      = useState<Record<string,string>>({});
  const [obsPathInputs,  setObsPathInputs]  = useState<Record<string,string>>({});

  useEffect(() => { setOrigin(window.location.origin); }, []);

  // ── Cargar datos ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, sRes, taRes, jRes] = await Promise.all([
      fetch(`/api/tournaments/${id}`),
      fetch("/api/students?active=true"),
      fetch(`/api/tournaments/${id}/tatami`),
      fetch(`/api/tournaments/${id}/judges`),
    ]);

    if (tRes.ok) {
      const data = await tRes.json();
      setTournament(data);
      setParticipants(data.participants ?? []);
      setBrackets(data.brackets ?? []);
      setMatches(data.matches ?? []);
    }
    if (sRes.ok) setStudents(await sRes.json());
    if (taRes.ok) {
      const ts: Tatami[] = await taRes.json();
      setTatamis(ts);
      const ytMap: Record<string,string> = {};
      const msgMap: Record<string,string> = {};
      ts.forEach(t => { ytMap[t.id] = t.youtubeVideoId ?? ""; msgMap[t.id] = t.overlayMessage ?? ""; });
      const obsMap: Record<string,string> = {};
      ts.forEach(t => { obsMap[t.id] = t.obsRecordingPath ?? ""; });
      setObsPathInputs(obsMap);
      setYtInputs(ytMap); setMsgInputs(msgMap);
    }
    if (jRes.ok) setJudges(await jRes.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Resetear selección al cambiar de torneo
  useEffect(() => {
    setSelIds(new Set());
    setSelBrackets([]);
    setSearch("");
  }, [id]);

  // ── Filtrar atletas ───────────────────────────────────────────────────────
  // Solo cuenta como "inscrito" si tiene bracketId activo — bracketId null = liberado
  const participantStudentIds = new Set(
    participants.filter(p => p.bracketId !== null).map(p => p.studentId)
  );

  // Solo muestra estudiantes NO inscritos en ninguna categoría activa del torneo
  const filteredStudents = students.filter(s => {
    if (participantStudentIds.has(s.id)) return false;          // ya inscrito en un bracket → fuera de la lista
    const belt = s.beltHistory[0]?.beltColor ?? "";
    const age  = calculateAge(s.birthDate);
    if (filterBelt   && belt !== filterBelt)                          return false;
    if (filterGender && s.gender !== filterGender)                    return false;
    if (filterAgeMin && age < parseInt(filterAgeMin))                 return false;
    if (filterAgeMax && age > parseInt(filterAgeMax))                 return false;
    if (search && !s.fullName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Guardar participantes en bracket ─────────────────────────────────────
  async function saveParticipants() {
    if (selBrackets.length === 0) { toast("Selecciona una categoría", "error"); return; }
    setSavingPart(true);
    let anyError = false;
    for (const bId of selBrackets) {
      const existing = participants.filter(p => p.bracketId === bId).map(p => p.studentId);
      const merged   = Array.from(new Set([...existing, ...Array.from(selIds)]));
      const r = await fetch(`/api/tournaments/${id}/brackets/${bId}/participants`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ studentIds: merged }),
      });
      if (!r.ok) { const d = await r.json(); toast(d.error ?? "Error", "error"); anyError = true; }
    }
    if (!anyError) { toast("Atletas inscritos", "success"); setSelIds(new Set()); }
    setSavingPart(false);
    load();
  }

  async function removeParticipant(participantId: string, bracketId: string) {
    const bracketParts = participants.filter(p => p.bracketId === bracketId && p.id !== participantId);
    await fetch(`/api/tournaments/${id}/brackets/${bracketId}/participants`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ studentIds: bracketParts.map(p => p.studentId) }),
    });
    load();
  }

  // ── Crear bracket ─────────────────────────────────────────────────────────
  async function createBracket() {
    if (!newBracketName.trim() || creatingBracket) return;
    setCreatingBracket(true);
    try {
      const types = newBracketType === "ambas" ? ["kumite", "kata"] : [newBracketType];
      let anyError = false;

      // Secuencial para evitar race condition en el cálculo del "order"
      for (const t of types) {
        const r = await fetch(`/api/tournaments/${id}/brackets`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            name:           newBracketName.trim(),
            type:           t,
            gender:         newBracketGender || null,
            ageGroup:       newBracketAgeGroup || null,
            weightCategory: t === "kumite" ? (newBracketWeight || null) : null,
            beltCategory:   newBracketBelt || null,
            isTeamKata:     t === "kata" ? newBracketIsTeam : false,
          }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          toast(`Error creando ${t}: ${d.error ?? "desconocido"}`, "error");
          anyError = true;
        }
      }

      if (!anyError) {
        toast(
          newBracketType === "ambas"
            ? "Categorías Kumite y Kata creadas"
            : "Categoría creada",
          "success"
        );
        setNewBracketName("");
        setNewBracketAgeGroup("");
        setNewBracketWeight("");
        setNewBracketBelt("");
        setNewBracketIsTeam(false);
      }
      // Siempre recarga para mostrar lo que se creó
      load();
    } catch {
      toast("Error de conexión", "error");
    }
    setCreatingBracket(false);
  }

  async function deleteBracket(bracketId: string) {
    if (!confirm("¿Eliminar esta categoría y todos sus datos?")) return;
    const r = await fetch(`/api/tournaments/${id}/brackets/${bracketId}`, { method: "DELETE" });
    if (r.ok) {
      if (activeBracket?.id === bracketId) setActiveBracket(null);
      setSelBrackets(prev => prev.filter(id => id !== bracketId));
      load();
    } else {
      const d = await r.json().catch(() => ({}));
      toast(d.error ?? "No se pudo eliminar", "error");
    }
  }

  // ── Generar / confirmar bracket ───────────────────────────────────────────
  async function generateBracket(bracketId: string, type: string) {
    setGeneratingBracket(true);
    const endpoint = type === "kata" ? "kata-order" : "bracket";
    const r = await fetch(`/api/tournaments/${id}/brackets/${bracketId}/${endpoint}`, { method: "POST" });
    if (r.ok) { toast("Llave generada", "success"); load(); }
    else { const d = await r.json(); toast(d.error ?? "Error al generar", "error"); }
    setGeneratingBracket(false);
  }

  async function confirmBracket(bracketId: string) {
    setConfirmingBracket(true);
    const r = await fetch(`/api/tournaments/${id}/brackets/${bracketId}/bracket?action=confirm`, { method: "POST" });
    if (r.ok) { toast("Llave confirmada", "success"); load(); }
    else { const d = await r.json(); toast(d.error ?? "Error", "error"); }
    setConfirmingBracket(false);
  }

  // ── Match scores ──────────────────────────────────────────────────────────
  async function saveMatch(matchId: string, data: SaveMatchData) {
    const r = await fetch(`/api/tournaments/${id}/matches/${matchId}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    if (r.ok) { const d = await r.json(); setMatches(d.matches ?? []); }
  }

  // ── Tatamis ───────────────────────────────────────────────────────────────
  async function addTatami() {
    if (!newTatamiName.trim()) return;
    setAddingTatami(true);
    await fetch(`/api/tournaments/${id}/tatami`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: newTatamiName.trim(), color: newTatamiColor }),
    });
    setNewTatamiName(""); setAddingTatami(false); load();
  }

  async function saveStream(tatamiId: string, newStatus?: string, extra?: Record<string, unknown>) {
    setSavingStream(tatamiId);
    await fetch(`/api/tournaments/${id}/tatami/${tatamiId}/stream`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        youtubeVideoId: ytInputs[tatamiId]?.trim() || null,
        overlayMessage: msgInputs[tatamiId]?.trim() || null,
        ...(newStatus && { streamStatus: newStatus }),
        ...extra,
      }),
    });
    setSavingStream(null); load();
  }

  async function setActiveMatch(tatamiId: string, matchId: string | null) {
    await fetch(`/api/tournaments/${id}/tatami/${tatamiId}/active-match`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ matchId }),
    });
    load();
  }

  if (loading || !tournament) {
    return (
      <div className="space-y-4 animate-pulse max-w-5xl">
        <div className="h-8 w-64 bg-dojo-border/60 rounded-xl"/>
        <div className="h-12 bg-dojo-border/40 rounded-xl"/>
        <div className="h-64 bg-dojo-border/30 rounded-xl"/>
      </div>
    );
  }

  const st     = STATUS_CFG[tournament.status] ?? { label: tournament.status, cls: "badge-yellow" };
  const kumiteBrackets = brackets.filter(b => b.type === "kumite");
  const kataBrackets   = brackets.filter(b => b.type === "kata");
  const matchesForBracket = (bId: string) => matches.filter(m => m.bracketId === bId);
  const partsForBracket   = (bId: string) => participants.filter(p => p.bracketId === bId);

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "info",    label: "Información",    icon: Info    },
    { key: "atletas", label: "Atletas",         icon: Users   },
    { key: "kumite",  label: "Kumite",           icon: Trophy  },
    { key: "kata",    label: "Kata",             icon: Trophy  },
    { key: "tatamis",    label: "Tatamis & Jueces", icon: Tv      },
    { key: "envivo",     label: "En Vivo",          icon: Radio   },
    { key: "resultados",    label: "Resultados",    icon: Trophy  },
    { key: "inscripciones", label: "Inscripciones",  icon: Users   },
  ];

  return (
    <div className="max-w-5xl space-y-5">
      <ToastContainer toasts={toastHook.toasts} dismiss={toastHook.dismiss}/>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard/tournaments-pro")}
            className="p-2 rounded-lg hover:bg-dojo-border transition-colors shrink-0">
            <ArrowLeft size={18} className="text-dojo-muted"/>
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Crown size={18} className="text-dojo-gold shrink-0"/>
              <h1 className="font-display text-xl font-bold text-dojo-white">{tournament.name}</h1>
              {/* Estado — selector inline */}
              <select
                value={tournament.status}
                disabled={changingStatus}
                onChange={e => changeStatus(e.target.value)}
                className="text-xs font-semibold rounded-full px-2 py-0.5 border border-dojo-border bg-dojo-card text-dojo-white cursor-pointer disabled:opacity-50"
              >
                <option value="draft">Borrador</option>
                <option value="ready">Listo</option>
                <option value="active">Activo</option>
                <option value="completed">Completo</option>
                <option value="confirmed">Confirmado</option>
              </select>
            </div>
            <p className="text-dojo-muted text-xs mt-0.5 ml-6">
              {new Date(tournament.date).toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "2-digit", year: "numeric" })} · {tournament.location} · {tournament.organization}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap border-b border-dojo-border pb-0">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-colors",
                tab === t.key
                  ? "border-dojo-gold text-dojo-gold bg-dojo-gold/5"
                  : "border-transparent text-dojo-muted hover:text-dojo-white"
              )}>
              <Icon size={14}/> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB: Información ─────────────────────────────────────────────── */}
      {tab === "info" && (
        <InfoTab tournament={tournament} onSaved={load} toast={toast}/>
      )}

      {/* ── TAB: Atletas ─────────────────────────────────────────────────── */}
      {tab === "atletas" && (
        <div className="space-y-5">

          {/* Crear categoría — formulario WKF */}
          <div className="card space-y-4">
            <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest flex items-center gap-1.5">
              <Plus size={11}/> Nueva categoría
            </p>

            {/* Row 1: tipo + género */}
            <div className="grid grid-cols-3 gap-2">
              <select value={newBracketType} onChange={e => { setNewBracketType(e.target.value as "kumite"|"kata"|"ambas"); setNewBracketWeight(""); setNewBracketIsTeam(false); }} className="form-input">
                <option value="ambas">Kumite + Kata</option>
                <option value="kumite">Kumite</option>
                <option value="kata">Kata</option>
              </select>
              <select value={newBracketGender} onChange={e => { setNewBracketGender(e.target.value); setNewBracketWeight(""); }} className="form-input">
                <option value="">Sin género</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
              {/* Kata en equipo toggle */}
              {newBracketType === "kata" && (
                <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dojo-border bg-dojo-darker text-sm font-semibold text-dojo-white">
                  <input type="checkbox" checked={newBracketIsTeam} onChange={e => setNewBracketIsTeam(e.target.checked)} />
                  En Equipo (3)
                </label>
              )}
            </div>

            {/* Row 2: grupo de edad + peso (kumite) */}
            <div className="grid grid-cols-2 gap-2">
              <select value={newBracketAgeGroup} onChange={e => { setNewBracketAgeGroup(e.target.value); setNewBracketWeight(""); }} className="form-input">
                <option value="">Grupo de edad (WKF)</option>
                {AGE_GROUPS.map(a => (
                  <option key={a.value} value={a.value}>
                    {a.label}{!a.wkfOfficial ? " ⚠️" : ""}
                  </option>
                ))}
              </select>
              {/* Peso — solo kumite con edad y género seleccionados */}
              {newBracketType !== "kata" && newBracketAgeGroup && newBracketGender && (
                <select value={newBracketWeight} onChange={e => setNewBracketWeight(e.target.value)} className="form-input">
                  <option value="">Peso / Open</option>
                  {(WEIGHT_CATEGORIES[newBracketAgeGroup]?.[newBracketGender] ?? ["open"]).map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              )}
              {/* Cinta — torneos por cinta */}
              {(newBracketType === "kumite" || newBracketType === "ambas") && !newBracketAgeGroup && (
                <select value={newBracketBelt} onChange={e => setNewBracketBelt(e.target.value)} className="form-input">
                  <option value="">Por cinta (opcional)</option>
                  {BELT_CATEGORIES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              )}
            </div>

            {/* Row 3: nombre personalizado */}
            <div>
              <input
                value={newBracketName}
                onChange={e => setNewBracketName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createBracket()}
                className="form-input w-full"
                placeholder="Nombre personalizado (opcional — se genera automáticamente)"
              />
              {/* Preview del label generado */}
              {(() => {
                const types = newBracketType === "ambas" ? ["kumite","kata"] : [newBracketType];
                const previews = types.map(t => buildCategoryLabel(
                  t as "kumite"|"kata",
                  newBracketGender || null,
                  newBracketAgeGroup || null,
                  t === "kumite" ? (newBracketWeight || null) : null,
                  t === "kata" ? newBracketIsTeam : false,
                ));
                return (
                  <p className="text-xs text-dojo-gold mt-1.5 font-semibold">
                    Preview: {previews.join(" · ")}
                  </p>
                );
              })()}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={createBracket} disabled={creatingBracket}
                className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1.5 shrink-0">
                {creatingBracket
                  ? <><RefreshCw size={13} className="animate-spin"/> Creando...</>
                  : <><Plus size={14}/> Crear categoría</>}
              </button>
              {/* Chips de categorías existentes */}
              {brackets.map(b => {
                const label = b.categoryLabel ?? b.name;
                return (
                  <div key={b.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-colors group"
                    style={{
                      background:  b.type === "kumite" ? "rgba(239,68,68,0.08)" : "rgba(139,92,246,0.08)",
                      borderColor: b.type === "kumite" ? "rgba(239,68,68,0.3)"  : "rgba(139,92,246,0.3)",
                      color:       b.type === "kumite" ? "#EF4444" : "#A78BFA",
                    }}>
                    <span className="max-w-[160px] truncate" title={label}>{label}</span>
                    <span className="opacity-50">·{b._count.participants}</span>
                    <button onClick={() => deleteBracket(b.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 hover:text-red-400"
                      title="Eliminar">
                      <X size={11}/>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selector de categoría destino — agrupado por nombre+género */}
          {(() => {
            // Agrupar brackets por nombre + género → los que tienen kumite+kata van juntos
            const groupMap = new Map<string, Bracket[]>();
            brackets.forEach(b => {
              const key = `${b.name}__${b.gender ?? ""}`;
              if (!groupMap.has(key)) groupMap.set(key, []);
              groupMap.get(key)!.push(b);
            });
            const groups = Array.from(groupMap.entries()).map(([key, bList]) => ({
              key,
              ids:    bList.map(b => b.id),
              name:   bList[0].name,
              gender: bList[0].gender,
              types:  bList.map(b => b.type),
              total:  bList.reduce((s, b) => s + b._count.participants, 0),
            }));

            const selKey = groups.find(g => g.ids.every(id => selBrackets.includes(id)) && selBrackets.every(id => g.ids.includes(id)))?.key ?? "";

            return (
              <div className="card space-y-3">
                <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest">
                  Inscribir atletas en categoría
                </p>
                <select
                  value={selKey}
                  onChange={e => {
                    const g = groups.find(g => g.key === e.target.value);
                    setSelBrackets(g ? g.ids : []);
                  }}
                  className="form-input w-full">
                  <option value="">— Selecciona una categoría —</option>
                  {groups.map(g => {
                    const typeLabel = g.types.includes("kumite") && g.types.includes("kata")
                      ? "Kumite + Kata"
                      : g.types[0].toUpperCase();
                    const genderLabel = g.gender ? ` · ${g.gender === "M" ? "Masc." : "Fem."}` : "";
                    return (
                      <option key={g.key} value={g.key}>
                        {g.name}{genderLabel} [{typeLabel}] — {g.total} inscritos
                      </option>
                    );
                  })}
                </select>
                {brackets.length === 0 && (
                  <p className="text-xs text-yellow-400 flex items-center gap-1.5">
                    <AlertTriangle size={12}/> Crea una categoría arriba para empezar a inscribir atletas.
                  </p>
                )}
              </div>
            );
          })()}

          {/* Filtros */}
          <div className="card space-y-3">
            <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest flex items-center gap-1.5">
              <Filter size={11}/> Filtrar atletas
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted"/>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="form-input pl-8 w-full" placeholder="Buscar por nombre..."/>
              </div>
              <select value={filterBelt} onChange={e => setFilterBelt(e.target.value)} className="form-input">
                <option value="">Todas las cintas</option>
                {BELT_COLORS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
              <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="form-input">
                {GENDER_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              <input type="number" value={filterAgeMin} onChange={e => setFilterAgeMin(e.target.value)}
                className="form-input" placeholder="Edad mín."/>
              <input type="number" value={filterAgeMax} onChange={e => setFilterAgeMax(e.target.value)}
                className="form-input" placeholder="Edad máx."/>
            </div>
          </div>

          {/* Lista de atletas */}
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest">
                {filteredStudents.length} disponibles · {selIds.size} seleccionados
              </p>
              <div className="flex gap-2">
                <button onClick={() => {
                  const toAdd = new Set<string>();
                  filteredStudents.forEach(s => { if (!participantStudentIds.has(s.id)) toAdd.add(s.id); });
                  setSelIds(toAdd);
                }} className="text-xs text-dojo-muted hover:text-dojo-white transition-colors">
                  Seleccionar todos
                </button>
                <button onClick={() => setSelIds(new Set())} className="text-xs text-dojo-muted hover:text-dojo-white transition-colors">
                  Limpiar
                </button>
              </div>
            </div>

            <div className="divide-y divide-dojo-border max-h-80 overflow-y-auto">
              {filteredStudents.map(s => {
                const belt    = s.beltHistory[0]?.beltColor ?? null;
                const age     = calculateAge(s.birthDate);
                const checked = selIds.has(s.id);
                return (
                  <div key={s.id}
                    onClick={() => setSelIds(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                    className="flex items-center gap-3 py-2.5 px-1 cursor-pointer hover:bg-dojo-border/20 transition-colors">
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      checked ? "bg-dojo-red border-dojo-red" : "border-dojo-border"
                    )}>
                      {checked && <Check size={10} className="text-white"/>}
                    </div>
                    {belt && <BeltBadge beltColor={belt} size="sm"/>}
                    <span className="flex-1 text-sm text-dojo-white">{s.fullName}</span>
                    <span className="text-xs text-dojo-muted">{age} años</span>
                    <span className="text-xs text-dojo-muted">{s.gender === "M" ? "M" : s.gender === "F" ? "F" : ""}</span>
                  </div>
                );
              })}
              {filteredStudents.length === 0 && (
                <p className="text-center text-dojo-muted text-sm py-6">Sin resultados con esos filtros.</p>
              )}
            </div>

            <button onClick={saveParticipants}
              disabled={savingPart || selIds.size === 0 || selBrackets.length === 0}
              className="btn-primary w-full mt-2 disabled:opacity-50">
              {savingPart ? "Inscribiendo..." : `Inscribir ${selIds.size} atleta${selIds.size !== 1 ? "s" : ""} seleccionado${selIds.size !== 1 ? "s" : ""}`}
            </button>
          </div>

          {/* Atletas ya inscritos por categoría */}
          {brackets.map(b => {
            const bParts = partsForBracket(b.id);
            if (bParts.length === 0) return null;
            return (
              <div key={b.id} className="card space-y-2">
                <p className="text-xs font-bold text-dojo-white uppercase tracking-widest">
                  [{b.type.toUpperCase()}] {b.name} — {bParts.length} inscritos
                </p>
                {bParts.map(p => (
                  <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-dojo-border/20">
                    <span className="flex-1 text-sm text-dojo-white">{p.student.fullName}</span>
                    <button onClick={() => removeParticipant(p.id, b.id)}
                      className="text-dojo-muted hover:text-red-400 transition-colors">
                      <X size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: Kumite ──────────────────────────────────────────────────── */}
      {tab === "kumite" && (
        <BracketTab
          brackets={kumiteBrackets} type="kumite"
          participants={participants} matches={matches}
          activeBracket={activeBracket} setActiveBracket={setActiveBracket}
          bracketSubTab={bracketSubTab} setBracketSubTab={setBracketSubTab}
          onDeleteBracket={deleteBracket}
          onGenerate={generateBracket} onConfirm={confirmBracket}
          onSaveMatch={saveMatch}
          generatingBracket={generatingBracket} confirmingBracket={confirmingBracket}
          isSysadmin={isSysadmin} tournamentLocked={tournament.bracketLocked}
        />
      )}

      {/* ── TAB: Kata ────────────────────────────────────────────────────── */}
      {tab === "kata" && (
        <BracketTab
          brackets={kataBrackets} type="kata"
          participants={participants} matches={matches}
          activeBracket={activeBracket} setActiveBracket={setActiveBracket}
          bracketSubTab={bracketSubTab} setBracketSubTab={setBracketSubTab}
          onDeleteBracket={deleteBracket}
          onGenerate={generateBracket} onConfirm={confirmBracket}
          onSaveMatch={saveMatch}
          generatingBracket={generatingBracket} confirmingBracket={confirmingBracket}
          isSysadmin={isSysadmin} tournamentLocked={tournament.bracketLocked}
        />
      )}

      {/* ── TAB: Tatamis & Jueces ─────────────────────────────────────────── */}
      {tab === "tatamis" && (
        <TatamisJuecesTab
          tatamis={tatamis} judges={judges} tournamentId={id}
          newTatamiName={newTatamiName} setNewTatamiName={setNewTatamiName}
          newTatamiColor={newTatamiColor} setNewTatamiColor={setNewTatamiColor}
          addingTatami={addingTatami} onAddTatami={addTatami}
          onReload={load}
        />
      )}

      {/* ── TAB: En Vivo ─────────────────────────────────────────────────── */}
      {tab === "envivo" && (
        <div className="space-y-5">
          {/* Scoreboard público */}
          {tournament.publicSlug && (
            <div className="card flex items-center gap-3 py-3">
              <Monitor size={15} className="text-dojo-gold shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-dojo-white">Scoreboard público (todos los tatamis)</p>
                <p className="text-[10px] text-dojo-muted font-mono truncate">
                  {origin}/public/tournament/{tournament.publicSlug}/scoreboard
                </p>
              </div>
              <a href={`${origin}/public/tournament/${tournament.publicSlug}/scoreboard`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs text-dojo-gold hover:underline shrink-0">Abrir</a>
              <CopyBtn value={`${origin}/public/tournament/${tournament.publicSlug}/scoreboard`}/>
            </div>
          )}

          {/* Stream general */}
          <div className="card">
            <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Youtube size={11}/> Stream general del torneo
            </p>
            <TournamentStream tournamentId={id} publicSlug={tournament.publicSlug} onRefresh={load}/>
          </div>

          {/* Por tatami */}
          {tatamis.length === 0 ? (
            <div className="card text-center py-8">
              <Tv size={32} className="text-dojo-muted mx-auto mb-2"/>
              <p className="text-dojo-muted text-sm">No hay tatamis configurados.</p>
              <button onClick={() => setTab("tatamis")} className="btn-secondary text-xs mt-3">
                Ir a Tatamis →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Guía rápida del proceso */}
              <div className="card border border-dojo-gold/20 bg-dojo-gold/5 space-y-2 py-3">
                <p className="text-xs font-black text-dojo-gold uppercase tracking-widest">⚡ Proceso para transmitir en vivo</p>
                <div className="grid grid-cols-3 gap-2 text-xs text-dojo-muted">
                  <div className="flex items-start gap-1.5">
                    <span className="font-black text-dojo-gold shrink-0">1.</span>
                    <span>Abre la <strong className="text-dojo-white">Pantalla TV</strong> en el televisor del tatami</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-black text-dojo-gold shrink-0">2.</span>
                    <span>Presiona <strong className="text-dojo-white">▶ Live</strong> para activar el stream</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-black text-dojo-gold shrink-0">3.</span>
                    <span><strong className="text-dojo-red">★ Selecciona el combate activo</strong> en el dropdown — esto activa la pantalla TV y la app del juez</span>
                  </div>
                </div>
              </div>

              <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest">Control por tatami</p>
              {tatamis.map(tatami => {
                const isLive = tatami.streamStatus === "live";
                const overlayUrl  = `${origin}/tournament/${id}/overlay/${tatami.id}`;
                const displayUrl  = `${origin}/tournament/${id}/tatami/${tatami.id}/display`;
                const judgeAppUrl = `${origin}/tournament/${id}/judge`;
                const tJudges     = judges.filter(j => j.tatamiId === tatami.id);

                // Solo matches pendientes: con participantes, sin ganador aún, no byes
                const matchOpts = matches.filter(m =>
                  !m.isBye &&
                  !m.winnerId &&                                      // sin ganador = pendiente
                  (m.participant1Id !== null || m.participant2Id !== null)
                );

                return (
                  <div key={tatami.id} className="card space-y-4 border-l-4"
                    style={{ borderLeftColor: tatami.color }}>
                    {/* Header tatami */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: tatami.color }}/>
                        <p className="font-bold text-dojo-white">{tatami.name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                          style={{
                            background: isLive ? "rgba(239,68,68,0.15)" : "rgba(107,114,128,0.15)",
                            color:      isLive ? "#EF4444" : "#6B7280",
                          }}>
                          {isLive ? "🔴 EN VIVO" : "Offline"}
                        </span>
                      </div>
                      {tatami.streamStatus === "finished" ? (
                        <button
                          onClick={() => saveStream(tatami.id, "offline")}
                          disabled={savingStream === tatami.id}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition-all border bg-dojo-card border-dojo-border text-dojo-muted hover:text-dojo-white">
                          {savingStream === tatami.id ? <RefreshCw size={11} className="animate-spin"/> : <>↺ Reiniciar</>}
                        </button>
                      ) : (
                        <button
                          onClick={() => saveStream(tatami.id, isLive ? "offline" : "live")}
                          disabled={savingStream === tatami.id}
                          className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition-all border",
                            isLive
                              ? "bg-red-900/20 text-red-400 border-red-800/40"
                              : "bg-green-900/20 text-green-400 border-green-800/30"
                          )}>
                          {savingStream === tatami.id ? <RefreshCw size={11} className="animate-spin"/> :
                            isLive ? <><Square size={11}/> Stop</> : <><Play size={11}/> Live</>}
                        </button>
                      )}
                    </div>

                    {/* YouTube + Mensaje */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-dojo-muted font-bold block mb-1">YouTube Video ID</label>
                        <div className="flex gap-1.5">
                          <input value={ytInputs[tatami.id] ?? ""} onChange={e => setYtInputs(p => ({...p, [tatami.id]: e.target.value}))}
                            className="form-input flex-1 text-xs font-mono" placeholder="ej. dQw4w9WgXcQ"/>
                          <button onClick={() => saveStream(tatami.id)} disabled={savingStream === tatami.id}
                            className="btn-secondary text-xs shrink-0 px-2">
                            {savingStream === tatami.id ? <RefreshCw size={11} className="animate-spin"/> : "✓"}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-dojo-muted font-bold block mb-1">Mensaje overlay</label>
                        <input value={msgInputs[tatami.id] ?? ""} onChange={e => setMsgInputs(p => ({...p, [tatami.id]: e.target.value}))}
                          className="form-input w-full text-xs" placeholder="Mensaje en pantalla..."/>
                      </div>
                    </div>

                    {/* Video Review */}
                    <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)" }}>
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold flex items-center gap-1.5 text-blue-400 cursor-pointer">
                          <input type="checkbox" checked={tatami.videoReviewEnabled}
                            onChange={e => saveStream(tatami.id, undefined, { videoReviewEnabled: e.target.checked })}
                          />
                          📹 Video Review activado
                        </label>
                        <span className="text-[10px] text-dojo-muted">Permite al juez solicitar revisión de video</span>
                      </div>
                      {tatami.videoReviewEnabled && (
                        <div>
                          <label className="text-xs text-dojo-muted font-bold block mb-1">Ruta grabación OBS (informativo)</label>
                          <div className="flex gap-1.5">
                            <input
                              value={obsPathInputs[tatami.id] ?? ""}
                              onChange={e => setObsPathInputs(p => ({...p, [tatami.id]: e.target.value}))}
                              className="form-input flex-1 text-xs font-mono"
                              placeholder="C:/OBS/Recordings/TatamiA/"
                            />
                            <button
                              onClick={() => saveStream(tatami.id, undefined, { obsRecordingPath: obsPathInputs[tatami.id] })}
                              disabled={savingStream === tatami.id}
                              className="btn-secondary text-xs shrink-0 px-2">
                              {savingStream === tatami.id ? <RefreshCw size={11} className="animate-spin"/> : "✓"}
                            </button>
                          </div>
                          <p className="text-[10px] text-dojo-muted mt-1">
                            El árbitro ve este texto en su pantalla de review para saber dónde buscar el archivo local.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Match activo — PASO CRÍTICO */}
                    <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.3)" }}>
                      <label className="text-xs font-black block flex items-center gap-1.5" style={{ color: "#E57373" }}>
                        <Trophy size={11}/> ★ COMBATE ACTIVO EN PANTALLA
                        <span className="text-[10px] font-semibold text-dojo-muted normal-case">(activa TV y app del juez)</span>
                      </label>
                      <select className="form-input w-full text-sm font-semibold"
                        value={tatami.currentMatchId ?? ""}
                        onChange={e => setActiveMatch(tatami.id, e.target.value || null)}>
                        <option value="">— Selecciona el combate a transmitir —</option>
                        {matchOpts.map(m => {
                          const p1 = participants.find(p => p.id === m.participant1Id);
                          const p2 = participants.find(p => p.id === m.participant2Id);
                          return (
                            <option key={m.id} value={m.id}>
                              R{m.round}M{m.matchNumber}
                              {p1 ? ` · ${p1.student.fullName}` : ""}
                              {p2 ? ` vs ${p2.student.fullName}` : ""}
                            </option>
                          );
                        })}
                      </select>
                      {matchOpts.length === 0 && (
                        <p className="text-xs text-dojo-muted">Sin combates disponibles — genera las llaves en los tabs Kumite/Kata primero.</p>
                      )}
                    </div>

                    {/* URLs */}
                    <div className="space-y-1.5 pt-1 border-t border-dojo-border">
                      {[
                        { icon: Monitor, label: "Pantalla TV (venue)", url: displayUrl },
                        { icon: Youtube, label: "Overlay OBS",         url: overlayUrl },
                      ].map(({ icon: Icon, label, url }) => (
                        <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dojo-darker">
                          <Icon size={12} className="text-dojo-muted shrink-0"/>
                          <span className="text-xs text-dojo-muted w-28 shrink-0">{label}</span>
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] font-mono text-dojo-muted hover:text-dojo-white truncate flex-1">
                            {url.replace(origin, "")}
                          </a>
                          <CopyBtn value={url}/>
                        </div>
                      ))}

                      {tJudges.map(j => {
                        const url = `${judgeAppUrl}?judge=${j.id}`;
                        return (
                          <div key={j.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dojo-darker">
                            <QrCode size={12} className="text-dojo-muted shrink-0"/>
                            <span className="text-xs text-dojo-white font-semibold w-28 shrink-0 truncate">{j.name}</span>
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-dojo-muted hover:text-dojo-white transition-colors">
                              App juez
                            </a>
                            <CopyBtn value={url}/>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Resultados ──────────────────────────────────────────────────── */}
      {tab === "resultados" && (
        <ResultadosTab
          brackets={brackets}
          participants={participants}
          matches={matches}
          tournamentName={tournament.name}
        />
      )}

      {/* ── TAB: Inscripciones externas ──────────────────────────────────────── */}
      {tab === "inscripciones" && (
        <InscripcionesTab tournamentId={id} />
      )}
    </div>
  );
}

// ── Sub-componente: Tab Información ──────────────────────────────────────────
function InfoTab({ tournament, onSaved, toast }: {
  tournament: Tournament;
  onSaved: () => void;
  toast: (msg: string, type?: "success"|"error"|"info") => void;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const [form, setForm] = useState({
    name:                tournament.name,
    date:                tournament.date.split("T")[0],
    location:            tournament.location,
    organization:        tournament.organization,
    leader1:             tournament.leader1,
    leader2:             tournament.leader2 ?? "",
    leader3:             tournament.leader3 ?? "",
    tournamentType:      tournament.tournamentType ?? "internal",
    isPublic:            tournament.isPublic ?? false,
    publicSlug:          tournament.publicSlug ?? "",
    registrationCloseAt: tournament.registrationCloseAt ? tournament.registrationCloseAt.split("T")[0] : "",
    entryFeePerCategory: tournament.entryFeePerCategory?.toString() ?? "",
    feeCurrency:         tournament.feeCurrency ?? "USD",
    requireWaiver:       tournament.requireWaiver ?? true,
    waiverText:          tournament.waiverText ?? "",
    maxAthletesPerClub:  tournament.maxAthletesPerClub?.toString() ?? "",
    accreditationPin:    tournament.accreditationPin ?? "",
  });
  const [saving, setSaving] = useState(false);

  const isOpen = form.tournamentType !== "internal";
  const regUrl = form.publicSlug ? `${origin}/public/tournament/${form.publicSlug}` : null;

  async function save() {
    setSaving(true);
    const body: Record<string, unknown> = {
      ...form,
      entryFeePerCategory: form.entryFeePerCategory ? parseFloat(form.entryFeePerCategory) : null,
      maxAthletesPerClub:  form.maxAthletesPerClub  ? parseInt(form.maxAthletesPerClub)    : null,
      registrationCloseAt: form.registrationCloseAt || null,
      publicSlug:          form.publicSlug.trim() || null,
      accreditationPin:    form.accreditationPin.trim() || null,
    };
    const r = await fetch(`/api/tournaments/${tournament.id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    if (r.ok) { toast("Guardado", "success"); onSaved(); }
    else { const d = await r.json(); toast(d.error ?? "Error", "error"); }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      {/* Datos básicos */}
      <div className="card space-y-4">
        <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest">Datos del torneo</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="form-label">Nombre *</label>
            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="form-input w-full"/>
          </div>
          <div>
            <label className="form-label">Fecha *</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} className="form-input w-full"/>
          </div>
          <div>
            <label className="form-label">Lugar *</label>
            <input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} className="form-input w-full"/>
          </div>
          <div className="sm:col-span-2">
            <label className="form-label">Organización *</label>
            <input value={form.organization} onChange={e => setForm(f => ({...f, organization: e.target.value}))} className="form-input w-full"/>
          </div>
          {[["leader1","Líder 1 *"],["leader2","Líder 2"],["leader3","Líder 3"]].map(([k,l]) => (
            <div key={k}>
              <label className="form-label">{l}</label>
              <input value={(form as unknown as Record<string,string>)[k!]} onChange={e => setForm(f => ({...f, [k!]: e.target.value}))} className="form-input w-full"/>
            </div>
          ))}
        </div>
      </div>

      {/* Tipo de torneo */}
      <div className="card space-y-4">
        <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest">Tipo de torneo</p>
        <div>
          <label className="form-label">Modalidad</label>
          <select value={form.tournamentType} onChange={e => setForm(f => ({...f, tournamentType: e.target.value}))} className="form-input w-full">
            <option value="internal">Interno — solo alumnos del dojo</option>
            <option value="open">Abierto — clubs externos se inscriben con link</option>
            <option value="federated">Federado — igual que abierto + validación de federación</option>
          </select>
          {isOpen && (
            <p className="text-xs text-dojo-gold mt-1.5">
              En torneos abiertos, los coaches externos reciben un link único para inscribir sus atletas. Los gestionas desde el tab <strong>Inscripciones</strong>.
            </p>
          )}
        </div>

        {isOpen && (
          <>
            {/* Página pública */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Slug público (URL)</label>
                <div className="flex gap-2">
                  <input
                    value={form.publicSlug}
                    onChange={e => setForm(f => ({...f, publicSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")}))}
                    className="form-input flex-1 font-mono text-sm"
                    placeholder="copa-karate-2025"
                  />
                </div>
                {regUrl && (
                  <p className="text-[10px] text-dojo-muted mt-1 font-mono truncate">{regUrl}</p>
                )}
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isPublic} onChange={e => setForm(f => ({...f, isPublic: e.target.checked}))} />
                  <span className="text-sm text-dojo-white font-semibold">Página pública activa</span>
                </label>
              </div>
            </div>

            {/* Inscripciones */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Cierre de inscripciones</label>
                <input type="date" value={form.registrationCloseAt} onChange={e => setForm(f => ({...f, registrationCloseAt: e.target.value}))} className="form-input w-full"/>
              </div>
              <div>
                <label className="form-label">Máx. atletas por club</label>
                <input type="number" min="1" value={form.maxAthletesPerClub} onChange={e => setForm(f => ({...f, maxAthletesPerClub: e.target.value}))} className="form-input w-full" placeholder="Sin límite"/>
              </div>
              <div>
                <label className="form-label">Cuota por categoría</label>
                <div className="flex gap-2">
                  <input type="number" min="0" step="0.01" value={form.entryFeePerCategory} onChange={e => setForm(f => ({...f, entryFeePerCategory: e.target.value}))} className="form-input flex-1" placeholder="0"/>
                  <select value={form.feeCurrency} onChange={e => setForm(f => ({...f, feeCurrency: e.target.value}))} className="form-input w-24">
                    <option>USD</option><option>EUR</option><option>PAB</option><option>COP</option><option>MXN</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.requireWaiver} onChange={e => setForm(f => ({...f, requireWaiver: e.target.checked}))} />
                  <span className="text-sm text-dojo-white">Requerir waiver/consentimiento</span>
                </label>
              </div>
            </div>

            {/* Waiver text */}
            {form.requireWaiver && (
              <div>
                <label className="form-label">Texto del waiver / términos</label>
                <textarea rows={3} value={form.waiverText} onChange={e => setForm(f => ({...f, waiverText: e.target.value}))} className="form-input w-full resize-none" placeholder="El atleta acepta participar bajo las reglas del torneo..."/>
              </div>
            )}

            {/* Acreditación */}
            <div>
              <label className="form-label">PIN de acreditación (4-6 dígitos)</label>
              <input type="password" maxLength={6} value={form.accreditationPin} onChange={e => setForm(f => ({...f, accreditationPin: e.target.value}))} className="form-input w-full font-mono" placeholder="PIN para el scanner de entrada"/>
              <p className="text-xs text-dojo-muted mt-1">El voluntario en la entrada usa este PIN para escanear los QRs de los atletas.</p>
            </div>

            {/* Link de inscripción */}
            {regUrl && form.isPublic && (
              <div className="rounded-xl bg-dojo-gold/10 border border-dojo-gold/30 p-4 space-y-2">
                <p className="text-xs font-bold text-dojo-gold uppercase tracking-widest">Link de inscripción para clubs externos</p>
                <p className="text-xs text-dojo-muted">Comparte este link por WhatsApp o email a los coaches de otros dojos:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-dojo-white font-mono flex-1 truncate bg-dojo-darker rounded px-2 py-1.5">{regUrl}</code>
                  <button onClick={() => navigator.clipboard?.writeText(regUrl).catch(() => {})} className="btn-ghost text-xs px-3 py-1.5 shrink-0">Copiar</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}

// ── Sub-componente: Tab Bracket (Kumite y Kata) ──────────────────────────────
function BracketTab({
  brackets, type, participants, matches,
  activeBracket, setActiveBracket, bracketSubTab, setBracketSubTab,
  onDeleteBracket, onGenerate, onConfirm, onSaveMatch,
  generatingBracket, confirmingBracket, isSysadmin, tournamentLocked,
}: {
  brackets: Bracket[]; type: "kumite" | "kata";
  participants: Participant[]; matches: TournamentMatch[];
  activeBracket: Bracket | null; setActiveBracket: (b: Bracket | null) => void;
  bracketSubTab: "athletes"|"bracket"; setBracketSubTab: (t: "athletes"|"bracket") => void;
  onDeleteBracket: (id: string) => void;
  onGenerate: (id: string, type: string) => void; onConfirm: (id: string) => void;
  onSaveMatch: (matchId: string, data: SaveMatchData) => void;
  generatingBracket: boolean; confirmingBracket: boolean;
  isSysadmin: boolean; tournamentLocked: boolean;
}) {
  const partsForBracket   = (bId: string) => participants.filter(p => p.bracketId === bId);
  const matchesForBracket = (bId: string) => matches.filter(m => m.bracketId === bId);

  return (
    <div className="space-y-4">

      {/* Lista de categorías */}
      {brackets.length === 0 ? (
        <div className="card text-center py-10 space-y-2">
          <Trophy size={32} className="text-dojo-muted mx-auto"/>
          <p className="text-dojo-white font-semibold text-sm">
            No hay categorías de {type === "kumite" ? "Kumite" : "Kata"} creadas
          </p>
          <p className="text-dojo-muted text-xs">
            Ve al tab <strong className="text-dojo-gold">Atletas</strong> → crea una categoría
            tipo <strong className="text-dojo-gold">{type === "kumite" ? "Kumite" : "Kata"}</strong> e inscribe atletas.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {brackets.map(b => {
            const bParts   = partsForBracket(b.id);
            const bMatches = matchesForBracket(b.id);
            const isActive = activeBracket?.id === b.id;
            const locked   = b.bracketLocked || tournamentLocked;
            return (
              <div key={b.id} className={cn(
                "card space-y-3 cursor-pointer border-2 transition-all",
                isActive ? "border-dojo-gold" : "border-transparent hover:border-dojo-border"
              )} onClick={() => { setActiveBracket(isActive ? null : b); setBracketSubTab("athletes"); }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-dojo-white text-sm">{b.categoryLabel ?? b.name}</p>
                    <p className="text-xs text-dojo-muted mt-0.5">
                      {b.ageGroup ? `${b.ageGroup} · ` : ""}
                      {b.weightCategory ? `${b.weightCategory} · ` : ""}
                      {bParts.length} atletas · {bMatches.length} matches
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {locked
                      ? <span className="text-[10px] badge-green">Confirmado</span>
                      : <button onClick={e => { e.stopPropagation(); onDeleteBracket(b.id); }}
                          className="text-dojo-muted hover:text-red-400 transition-colors p-1 rounded hover:bg-red-400/10"
                          title="Eliminar categoría">
                          <Trash2 size={13}/>
                        </button>
                    }
                  </div>
                </div>

                {isActive && (
                  <div onClick={e => e.stopPropagation()} className="space-y-3 pt-2 border-t border-dojo-border">
                    {/* Sub-tabs */}
                    <div className="flex gap-1">
                      {(["athletes","bracket"] as const).map(st => (
                        <button key={st} onClick={() => setBracketSubTab(st)}
                          className={cn("text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors",
                            bracketSubTab === st ? "bg-dojo-gold/10 text-dojo-gold" : "text-dojo-muted hover:text-dojo-white")}>
                          {st === "athletes" ? "Atletas" : type === "kata" ? "Orden" : "Llave"}
                        </button>
                      ))}
                    </div>

                    {bracketSubTab === "athletes" && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {bParts.length === 0
                          ? <p className="text-xs text-dojo-muted text-center py-3">Sin atletas. Inscríbelos en el tab Atletas.</p>
                          : bParts.map((p, i) => (
                            <div key={p.id} className="flex items-center gap-2 text-xs py-1">
                              <span className="text-dojo-muted w-5 text-right shrink-0">{i+1}.</span>
                              <span className="text-dojo-white flex-1">{p.student.fullName}</span>
                            </div>
                          ))}
                      </div>
                    )}

                    {bracketSubTab === "bracket" && (
                      <div>
                        {type === "kata" ? (
                          <KataOrderList
                            participants={bParts.map(p => ({
                              id: p.id, seed: p.seed, studentId: p.studentId,
                              student: {
                                fullName:    p.student.fullName,
                                photo:       p.student.photo ?? null,
                                beltHistory: p.student.beltHistory,
                              },
                            }))}
                            bracketName={b.name} locked={locked}
                          />
                        ) : (
                          <BracketView
                            matches={bMatches}
                            participantsMap={Object.fromEntries(
                              bParts.map(p => [p.id, { fullName: p.student.fullName, photo: p.student.photo ?? null }])
                            )}
                            locked={locked}
                            onSaveMatch={onSaveMatch}
                          />
                        )}
                      </div>
                    )}

                    {/* Acciones */}
                    {!locked && (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            if (bMatches.length > 0 && !confirm(`¿Regenerar la llave de "${b.name}"? Los resultados actuales se borrarán.`)) return;
                            onGenerate(b.id, type);
                          }}
                          disabled={generatingBracket || bParts.length < (type === "kata" ? 1 : 2)}
                          className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-50">
                          {generatingBracket ? <RefreshCw size={11} className="animate-spin"/> : <RefreshCw size={11}/>}
                          {bMatches.length > 0
                            ? (type === "kata" ? "Regenerar orden" : "Regenerar llave")
                            : (type === "kata" ? "Generar orden"   : "Generar llave")}
                        </button>
                        {bMatches.length > 0 && (
                          <button onClick={() => onConfirm(b.id)} disabled={confirmingBracket}
                            className="btn-primary text-xs flex items-center gap-1">
                            <Check size={11}/> Confirmar
                          </button>
                        )}
                      </div>
                    )}
                    {locked && isSysadmin && (
                      <p className="text-xs text-dojo-muted">Solo sysadmin puede reabrir una llave confirmada.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Roles profesionales ───────────────────────────────────────────────────────
const JUDGE_ROLES = [
  { value: "shushin",    label: "Árbitro Principal",  sublabel: "Shushin",    max: 1, color: "#F59E0B" },
  { value: "fukushin",   label: "Juez de Esquina",     sublabel: "Fukushin",   max: 4, color: "#3B82F6" },
  { value: "scorer",     label: "Anotador",             sublabel: "Scorer",     max: 2, color: "#10B981" },
  { value: "timekeeper", label: "Cronometrador",        sublabel: "Timekeeper", max: 1, color: "#8B5CF6" },
  { value: "medical",    label: "Médico / Paramédico",  sublabel: "Medical",    max: 1, color: "#EF4444" },
] as const;

type JudgeRoleValue = typeof JUDGE_ROLES[number]["value"];

// ── Sub-componente: Panel Tatamis & Jueces ────────────────────────────────────
function TatamisJuecesTab({
  tatamis, judges, tournamentId,
  newTatamiName, setNewTatamiName, newTatamiColor, setNewTatamiColor,
  addingTatami, onAddTatami, onReload,
}: {
  tatamis: Tatami[]; judges: Judge[]; tournamentId: string;
  newTatamiName: string; setNewTatamiName: (v: string) => void;
  newTatamiColor: string; setNewTatamiColor: (v: string) => void;
  addingTatami: boolean; onAddTatami: () => void; onReload: () => void;
}) {
  const [addingFor, setAddingFor] = useState<{ tatamiId: string; role: JudgeRoleValue } | null>(null);
  const [form,      setForm]      = useState({ name: "", nationality: "", licenseNo: "" });
  const [saving,    setSaving]    = useState(false);

  async function saveJudge() {
    if (!addingFor || !form.name.trim()) return;
    setSaving(true);
    const r = await fetch(`/api/tournaments/${tournamentId}/judges`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:        form.name.trim(),
        role:        addingFor.role,
        tatamiId:    addingFor.tatamiId,
        nationality: form.nationality.trim() || null,
        licenseNo:   form.licenseNo.trim()   || null,
      }),
    });
    if (r.ok) { setAddingFor(null); setForm({ name: "", nationality: "", licenseNo: "" }); onReload(); }
    setSaving(false);
  }

  async function removeJudge(judgeId: string) {
    await fetch(`/api/tournaments/${tournamentId}/judges/${judgeId}`, { method: "DELETE" });
    onReload();
  }

  async function deleteTatami(tatamiId: string) {
    if (!confirm("¿Eliminar este tatami y sus jueces?")) return;
    await fetch(`/api/tournaments/${tournamentId}/tatami/${tatamiId}`, { method: "DELETE" });
    onReload();
  }

  return (
    <div className="space-y-5">
      {tatamis.length === 0 ? (
        <div className="card text-center py-10 space-y-2">
          <Tv size={32} className="text-dojo-muted mx-auto"/>
          <p className="text-dojo-white font-semibold">No hay tatamis configurados</p>
          <p className="text-dojo-muted text-xs">Agrega tatamis usando el formulario de abajo</p>
        </div>
      ) : (
        <div className="space-y-5">
          {tatamis.map(tatami => {
            const tJudges = judges.filter(j => j.tatamiId === tatami.id);
            return (
              <div key={tatami.id} className="rounded-2xl overflow-hidden"
                style={{ border: `1.5px solid ${tatami.color}40`, borderLeft: `4px solid ${tatami.color}` }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ background: `${tatami.color}15`, borderBottom: `1px solid ${tatami.color}25` }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full" style={{ background: tatami.color }}/>
                    <span className="font-black text-dojo-white text-base">{tatami.name}</span>
                    <span className="text-xs text-dojo-muted">
                      · {tJudges.length} {tJudges.length === 1 ? "oficial" : "oficiales"}
                    </span>
                  </div>
                  <button onClick={() => deleteTatami(tatami.id)}
                    className="text-dojo-muted hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10">
                    <Trash2 size={13}/>
                  </button>
                </div>

                {/* Roles */}
                <div className="p-4 space-y-5">
                  {JUDGE_ROLES.map(rc => {
                    const roleJudges   = tJudges.filter(j => j.role === rc.value);
                    const canAdd       = roleJudges.length < rc.max;
                    const isAddingHere = addingFor?.tatamiId === tatami.id && addingFor?.role === rc.value;
                    return (
                      <div key={rc.value} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: rc.color }}/>
                            <span className="text-xs font-bold text-dojo-white">{rc.label}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                              style={{ background: `${rc.color}15`, color: rc.color }}>
                              {rc.sublabel}
                            </span>
                            <span className="text-[10px] text-dojo-muted">{roleJudges.length}/{rc.max}</span>
                          </div>
                          {canAdd && !isAddingHere && (
                            <button
                              onClick={() => { setAddingFor({ tatamiId: tatami.id, role: rc.value }); setForm({ name: "", nationality: "", licenseNo: "" }); }}
                              className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg hover:opacity-80 transition-opacity"
                              style={{ color: rc.color, background: `${rc.color}15` }}>
                              <Plus size={10}/> Agregar
                            </button>
                          )}
                        </div>

                        {roleJudges.map((j: Judge) => (
                          <div key={j.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                            style={{ background: `${rc.color}08`, border: `1px solid ${rc.color}20` }}>
                            <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0"
                              style={{ background: rc.color }}>
                              {(j.name as string).split(" ").map((w: string) => w[0]).slice(0,2).join("").toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-dojo-white">{j.name}</p>
                              {(j.nationality || j.licenseNo) && (
                                <div className="flex items-center gap-2 mt-0.5">
                                  {j.nationality && <span className="text-[10px] font-bold text-dojo-muted uppercase">{j.nationality}</span>}
                                  {j.licenseNo  && <span className="text-[10px] font-mono text-dojo-muted">Lic. {j.licenseNo}</span>}
                                </div>
                              )}
                            </div>
                            <button onClick={() => removeJudge(j.id)}
                              className="text-dojo-muted hover:text-red-400 transition-colors p-1 rounded shrink-0">
                              <X size={13}/>
                            </button>
                          </div>
                        ))}

                        {roleJudges.length === 0 && !isAddingHere && (
                          <div className="px-3 py-2 rounded-xl border border-dashed text-center"
                            style={{ borderColor: `${rc.color}25` }}>
                            <p className="text-[11px]" style={{ color: `${rc.color}50` }}>Sin asignar</p>
                          </div>
                        )}

                        {isAddingHere && (
                          <div className="p-3 rounded-xl border space-y-2.5"
                            style={{ borderColor: `${rc.color}40`, background: `${rc.color}08` }}>
                            <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: rc.color }}>
                              Nuevo {rc.label}
                            </p>
                            <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                              onKeyDown={e => e.key === "Enter" && saveJudge()}
                              className="form-input w-full text-sm" placeholder="Nombre completo *" autoFocus/>
                            <div className="grid grid-cols-2 gap-2">
                              <input value={form.nationality} onChange={e => setForm(f => ({...f, nationality: e.target.value}))}
                                className="form-input text-sm" placeholder="Nac. (PAN, COL...)"/>
                              <input value={form.licenseNo} onChange={e => setForm(f => ({...f, licenseNo: e.target.value}))}
                                className="form-input text-sm font-mono" placeholder="N° Licencia"/>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={saveJudge} disabled={saving || !form.name.trim()}
                                className="btn-primary text-xs flex-1 disabled:opacity-50">
                                {saving ? <RefreshCw size={12} className="animate-spin mx-auto"/> : "Guardar"}
                              </button>
                              <button onClick={() => setAddingFor(null)} className="btn-secondary text-xs px-3">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card space-y-3">
        <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest flex items-center gap-1.5">
          <Plus size={11}/> Agregar tatami
        </p>
        <div className="flex gap-2">
          <input value={newTatamiName} onChange={e => setNewTatamiName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onAddTatami()}
            className="form-input flex-1" placeholder="Ej. Tatami 1, Área A..."/>
          <input type="color" value={newTatamiColor} onChange={e => setNewTatamiColor(e.target.value)}
            className="w-10 h-10 rounded-lg border border-dojo-border cursor-pointer bg-transparent" title="Color"/>
          <button onClick={onAddTatami} disabled={addingTatami || !newTatamiName.trim()}
            className="btn-primary shrink-0 disabled:opacity-50">
            {addingTatami ? <RefreshCw size={14} className="animate-spin"/> : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componente: Resultados con Podio e Impresión ─────────────────────────
const MEDAL = [
  { pos: 1, label: "🥇 Oro",     color: "#F59E0B", bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)" },
  { pos: 2, label: "🥈 Plata",   color: "#94A3B8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.4)" },
  { pos: 3, label: "🥉 Bronce",  color: "#CD7C54", bg: "rgba(205,124,84,0.12)",  border: "rgba(205,124,84,0.4)" },
  { pos: 3, label: "🥉 Bronce",  color: "#CD7C54", bg: "rgba(205,124,84,0.12)",  border: "rgba(205,124,84,0.4)" },
];

function ResultadosTab({ brackets, participants, matches, tournamentName }: {
  brackets: Bracket[]; participants: Participant[]; matches: TournamentMatch[];
  tournamentName: string;
}) {
  const completedBrackets = brackets.filter(b =>
    b.bracketLocked || b.status === "completed" || b.status === "confirmed"
  );

  function getPodium(bracket: Bracket): (Participant | null)[] {
    const bMatches = matches.filter(m => m.bracketId === bracket.id && !m.isBye);
    const bParts   = participants.filter(p => p.bracketId === bracket.id);

    if (bracket.type === "kata") {
      // Kata: ordenar por seed (el orden generado = puntuación)
      const sorted = [...bParts].sort((a, b) => a.seed - b.seed);
      return [sorted[0] ?? null, sorted[1] ?? null, sorted[2] ?? null, sorted[3] ?? null];
    }

    // Kumite: extraer del bracket
    const maxRound = Math.max(0, ...bMatches.map(m => m.round));
    const final    = bMatches.find(m => m.round === maxRound && m.matchNumber === 1);
    const semis    = bMatches.filter(m => m.round === maxRound - 1 && m.matchNumber <= 2);

    const gold   = final?.winnerId ? bParts.find(p => p.id === final.winnerId) ?? null : null;
    const silver = final ? bParts.find(p =>
      p.id !== final.winnerId && (p.id === final.participant1Id || p.id === final.participant2Id)
    ) ?? null : null;
    const bronzes = semis.map(m =>
      m.winnerId ? bParts.find(p =>
        p.id !== m.winnerId && (p.id === m.participant1Id || p.id === m.participant2Id)
      ) ?? null : null
    );

    return [gold, silver, bronzes[0] ?? null, bronzes[1] ?? null];
  }

  function printBracket(bracket: Bracket, podium: (Participant | null)[]) {
    const html = `
      <!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>${tournamentName} — ${bracket.name}</title>
      <style>
        body { font-family: 'Arial', sans-serif; padding: 40px; color: #111; }
        h1 { font-size: 24px; margin-bottom: 4px; }
        h2 { font-size: 18px; color: #555; margin-bottom: 30px; }
        .podium { display: flex; flex-direction: column; gap: 12px; }
        .place { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-radius: 10px; border: 2px solid #ddd; }
        .medal { font-size: 32px; width: 50px; text-align: center; }
        .name  { font-size: 20px; font-weight: bold; }
        .place-label { font-size: 13px; color: #666; }
        .gold   { border-color: #F59E0B; background: #FFFBEB; }
        .silver { border-color: #94A3B8; background: #F8FAFC; }
        .bronze { border-color: #CD7C54; background: #FFF7F0; }
        @media print { body { padding: 20px; } }
      </style>
      </head><body>
      <h1>${tournamentName}</h1>
      <h2>${bracket.name}${bracket.gender ? ` — ${bracket.gender === "M" ? "Masculino" : "Femenino"}` : ""} · ${bracket.type.toUpperCase()}</h2>
      <div class="podium">
        ${podium.map((p, i) => {
          const m = MEDAL[i];
          const cls = i === 0 ? "gold" : i === 1 ? "silver" : "bronze";
          return `<div class="place ${cls}">
            <div class="medal">${["🥇","🥈","🥉","🥉"][i]}</div>
            <div>
              <div class="place-label">${["1er Lugar","2do Lugar","3er Lugar","3er Lugar"][i]}</div>
              <div class="name">${p?.student?.fullName ?? "—"}</div>
            </div>
          </div>`;
        }).join("")}
      </div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  if (completedBrackets.length === 0) {
    return (
      <div className="card text-center py-16 space-y-3">
        <Trophy size={40} className="text-dojo-muted mx-auto"/>
        <p className="text-dojo-white font-semibold">No hay categorías completadas aún</p>
        <p className="text-dojo-muted text-sm">Confirma las llaves en los tabs Kumite y Kata para ver los resultados aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {completedBrackets.map(bracket => {
        const podium = getPodium(bracket);
        return (
          <div key={bracket.id} className="card space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-dojo-border pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black px-2 py-0.5 rounded"
                    style={{
                      background: bracket.type === "kumite" ? "rgba(239,68,68,0.15)" : "rgba(139,92,246,0.15)",
                      color:      bracket.type === "kumite" ? "#EF4444" : "#A78BFA",
                    }}>
                    {bracket.type.toUpperCase()}
                  </span>
                  <h3 className="font-bold text-dojo-white text-lg">{bracket.categoryLabel ?? bracket.name}</h3>
                  {bracket.gender && (
                    <span className="text-xs text-dojo-muted">{bracket.gender === "M" ? "Masculino" : "Femenino"}</span>
                  )}
                </div>
                <span className="badge-green text-[10px] mt-1 inline-block">Completado</span>
              </div>
              <button
                onClick={() => printBracket(bracket, podium)}
                className="btn-secondary text-sm flex items-center gap-2">
                🖨️ Imprimir podio
              </button>
            </div>

            {/* Podio */}
            <div className="grid grid-cols-2 gap-3">
              {podium.map((p, i) => {
                const m = MEDAL[i];
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                    style={{ background: m.bg, borderColor: m.border }}>
                    <div className="text-3xl shrink-0">{["🥇","🥈","🥉","🥉"][i]}</div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: m.color }}>
                        {["1er Lugar","2do Lugar","3er Lugar","3er Lugar"][i]}
                      </p>
                      <p className="text-sm font-bold text-dojo-white truncate">
                        {p?.student?.fullName ?? "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
