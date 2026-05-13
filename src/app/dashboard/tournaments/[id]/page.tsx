"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn, formatDate, calculateAge, BELT_COLORS } from "@/lib/utils";
import { BracketView, type BracketMatch } from "@/components/tournaments/BracketView";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { TournamentSettings } from "@/components/tournaments/TournamentSettings";
import { TournamentStream }   from "@/components/tournaments/TournamentStream";
import { KataOrderList }      from "@/components/tournaments/KataOrderList";
import {
  Trophy, Info, GitBranch, Settings, ArrowLeft,
  X, Printer, CheckCircle, RefreshCw, AlertTriangle,
  Plus, Trash2, ChevronRight, Users, ShieldAlert, Unlock, Archive,
  LockKeyhole, LockOpen, Video, Sliders,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  fullName: string;
  birthDate: string;
  active: boolean;
  beltHistory: { beltColor: string }[];
}

interface Participant {
  id: string;
  tournamentId: string;
  studentId: string;
  bracketId: string | null;
  seed: number;
  student: {
    id: string;
    fullName: string;
    birthDate: string;
    photo?: string | null;
    beltHistory: { beltColor: string }[];
  };
}

interface Referee {
  id: string;
  name: string;
  order: number;
}

interface BracketInfo {
  id: string;
  name: string;
  type: string;          // "kumite" | "kata"
  gender: string | null;
  order: number;
  status: string;
  bracketLocked: boolean;
  _count: { participants: number; matches: number };
}

interface Tournament {
  id: string;
  name: string;
  date: string;
  location: string;
  organization: string;
  leader1: string;
  leader2: string | null;
  leader3: string | null;
  tatami: number | null;
  scheduledAt: string | null;
  status: string;
  bracketLocked: boolean;
  archivedAt: string | null;
  description: string | null;
  format: string | null;
  arbitrage: string | null;
  requirements: string | null;
  contact: string | null;
  flyerImage: string | null;
  participants: Participant[];
  matches: BracketMatch[];
  referees: Referee[];
  brackets: BracketInfo[];
}

// ── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:     { label: "Borrador",          className: "badge-yellow" },
  ready:     { label: "Bracket Listo",     className: "badge-blue"   },
  active:    { label: "En Progreso",        className: "badge-green"  },
  completed: { label: "Completado",         className: "badge-red"    },
  confirmed: { label: "Torneo Completado ✓", className: "badge-green" },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] ?? { label: status, className: "badge-yellow" };
  return <span className={c.className}>{c.label}</span>;
}

// ── Tab component ────────────────────────────────────────────────────────────

type Tab = "info" | "kumite" | "kata" | "config" | "registrations" | "stream" | "settings_pro";

function TabButton({
  active, onClick, children, disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-dojo-gold text-dojo-gold"
          : disabled
          ? "border-transparent text-dojo-muted/40 cursor-not-allowed"
          : "border-transparent text-dojo-muted hover:text-dojo-white hover:border-dojo-border",
      )}
    >
      {children}
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function TournamentDetailPage() {
  const { id }            = useParams<{ id: string }>();
  const router            = useRouter();
  const { data: session } = useSession();
  const { toasts, show: showToast, dismiss } = useToast();

  const role       = (session?.user as { role?: string })?.role ?? "user";
  const isSysadmin = role === "sysadmin";
  const canEdit    = role === "admin" || role === "sysadmin";

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("info");
  const [error, setError] = useState<string | null>(null);

  // Info tab state
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    name: "", date: "", location: "", organization: "",
    leader1: "", leader2: "", leader3: "",
    description: "", format: "", arbitrage: "", requirements: "", contact: "",
    flyerImage: "" as string,
  });
  const [savingInfo,     setSavingInfo]     = useState(false);
  const [uploadingFlyer, setUploadingFlyer] = useState(false);

  // Brackets tab state
  const [brackets, setBrackets] = useState<BracketInfo[]>([]);
  const [selectedBracketId, setSelectedBracketId] = useState<string | null>(null);
  const [bracketSubTab, setBracketSubTab] = useState<"participants" | "bracket">("participants");
  const [showNewBracketModal, setShowNewBracketModal] = useState(false);
  const [newBracketName,   setNewBracketName]   = useState("");
  const [newBracketGender, setNewBracketGender] = useState<"M" | "F" | null>(null);
  const [newBracketType,   setNewBracketType]   = useState<"kumite" | "kata">("kumite");
  const [creatingBracket, setCreatingBracket] = useState(false);
  const [deletingBracketId, setDeletingBracketId] = useState<string | null>(null);

  // Bracket-level students management
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [bracketSelectedIds, setBracketSelectedIds] = useState<Set<string>>(new Set());
  const [savingBracketParticipants, setSavingBracketParticipants] = useState(false);
  const [bracketParticipantError, setBracketParticipantError] = useState<string | null>(null);
  const [searchStudent, setSearchStudent] = useState("");
  const [filterMinAge, setFilterMinAge] = useState("");
  const [filterMaxAge, setFilterMaxAge] = useState("");
  const [filterBelts, setFilterBelts] = useState<Set<string>>(new Set());

  // Bracket generation state
  const [generatingBracket,   setGeneratingBracket]   = useState(false);
  const [generatingKataOrder, setGeneratingKataOrder] = useState(false);
  const [confirmingBracket, setConfirmingBracket] = useState(false);
  const [bracketMatches, setBracketMatches] = useState<BracketMatch[]>([]);
  const [loadingBracketMatches, setLoadingBracketMatches] = useState(false);
  const [savingWinner, setSavingWinner] = useState<string | null>(null);

  // Config tab state
  const [configForm, setConfigForm] = useState({
    tatami: "", scheduledAt: "", referees: ["", "", "", "", ""],
  });
  const [savingConfig,         setSavingConfig]         = useState(false);
  const [completingTournament, setCompletingTournament] = useState(false);
  const [reopeningTournament,  setReopeningTournament]  = useState(false);

  // ── Load tournament ──────────────────────────────────────────────────────

  const loadTournament = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tournaments/${id}`);
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Error al cargar torneo");
        return;
      }
      const data: Tournament = await res.json();
      setTournament(data);
      setBrackets(data.brackets ?? []);

      // Sync info form
      setInfoForm({
        name:         data.name,
        date:         data.date ? data.date.slice(0, 10) : "",
        location:     data.location,
        organization: data.organization,
        leader1:      data.leader1,
        leader2:      data.leader2 ?? "",
        leader3:      data.leader3 ?? "",
        description:  data.description  ?? "",
        format:       data.format       ?? "",
        arbitrage:    data.arbitrage    ?? "",
        requirements: data.requirements ?? "",
        contact:      data.contact      ?? "",
        flyerImage:   data.flyerImage   ?? "",
      });

      // Sync config form
      const existingReferees = data.referees.map((r) => r.name);
      const padded = [...existingReferees, "", "", "", "", ""].slice(0, 5);
      setConfigForm({
        tatami: data.tatami?.toString() ?? "",
        scheduledAt: data.scheduledAt ? data.scheduledAt.slice(0, 16) : "",
        referees: padded,
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTournament();
  }, [loadTournament]);

  // ── Load students when needed ────────────────────────────────────────────

  useEffect(() => {
    if ((tab !== "kumite" && tab !== "kata") || allStudents.length > 0) return;
    setLoadingStudents(true);
    fetch("/api/students?active=true")
      .then((r) => r.json())
      .then((data) => setAllStudents(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, [tab, allStudents.length]);

  // ── Bracket helpers ──────────────────────────────────────────────────────

  // Filter bracket data from already-loaded tournament state (no API call)
  const syncBracketFromState = useCallback((bracketId: string, src: Tournament) => {
    const filtered = (src.matches ?? []).filter(
      m => (m as BracketMatch & { bracketId?: string }).bracketId === bracketId
    );
    setBracketMatches(filtered);
    const bracketParts = (src.participants ?? []).filter(p => p.bracketId === bracketId);
    setBracketSelectedIds(new Set(bracketParts.map(p => p.studentId)));
  }, []);

  // Full API refetch — only needed after mutations (generate, confirm, save participants)
  const loadBracketMatches = useCallback(async (bracketId: string) => {
    setLoadingBracketMatches(true);
    try {
      const res = await fetch(`/api/tournaments/${id}`);
      if (!res.ok) return;
      const data: Tournament = await res.json();
      setTournament(data);
      setBrackets(data.brackets ?? []);
      syncBracketFromState(bracketId, data);
    } finally {
      setLoadingBracketMatches(false);
    }
  }, [id, syncBracketFromState]);

  // When selecting a bracket: use state if available, avoid extra API call
  useEffect(() => {
    if (!selectedBracketId) return;
    setTournament(prev => {
      if (prev) syncBracketFromState(selectedBracketId, prev);
      return prev;
    });
  }, [selectedBracketId, syncBracketFromState]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 rounded bg-dojo-card animate-pulse" />
        <div className="h-64 rounded-lg bg-dojo-card animate-pulse" />
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="card flex flex-col items-center gap-4 py-16 text-center">
        <AlertTriangle className="text-dojo-red" size={32} />
        <p className="text-dojo-white font-semibold">{error ?? "Torneo no encontrado"}</p>
        <button onClick={() => router.push("/dashboard/tournaments")} className="btn-secondary">
          Volver a Torneos
        </button>
      </div>
    );
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleSaveInfo() {
    setSavingInfo(true);
    try {
      const res = await fetch(`/api/tournaments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:         infoForm.name.trim(),
          date:         infoForm.date,
          location:     infoForm.location.trim(),
          organization: infoForm.organization.trim(),
          leader1:      infoForm.leader1.trim(),
          leader2:      infoForm.leader2.trim()      || null,
          leader3:      infoForm.leader3.trim()      || null,
          description:  infoForm.description.trim()  || null,
          format:       infoForm.format.trim()        || null,
          arbitrage:    infoForm.arbitrage.trim()     || null,
          requirements: infoForm.requirements.trim()  || null,
          contact:      infoForm.contact.trim()       || null,
          flyerImage:   infoForm.flyerImage           || null,
        }),
      });
      if (res.ok) {
        await loadTournament();
        setEditingInfo(false);
        showToast("Información guardada exitosamente");
      } else {
        const d = await res.json().catch(() => ({}));
        showToast((d as {error?:string}).error ?? "Error al guardar", "error");
      }
    } finally {
      setSavingInfo(false);
    }
  }

  function openNewBracketModal(type: "kumite" | "kata") {
    setNewBracketType(type);
    setNewBracketName("");
    setNewBracketGender(null);
    setShowNewBracketModal(true);
  }

  function closeNewBracketModal() {
    setShowNewBracketModal(false);
    setNewBracketName("");
    setNewBracketGender(null);
  }

  async function handleCreateBracket() {
    if (!newBracketName.trim()) return;
    setCreatingBracket(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/brackets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBracketName.trim(), gender: newBracketGender, type: newBracketType }),
      });
      if (res.ok) {
        const newBracket: BracketInfo = await res.json();
        setBrackets(prev => [...prev, newBracket]);
        closeNewBracketModal();
        setSelectedBracketId(newBracket.id);
        setTab(newBracketType);
        showToast("Bracket creado exitosamente");
      }
    } finally {
      setCreatingBracket(false);
    }
  }

  async function handleDeleteBracket(bracketId: string) {
    if (!confirm("¿Eliminar este bracket? Se perderán sus matches y asignaciones de participantes.")) return;
    setDeletingBracketId(bracketId);
    try {
      const res = await fetch(`/api/tournaments/${id}/brackets/${bracketId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBrackets(prev => prev.filter(b => b.id !== bracketId));
        if (selectedBracketId === bracketId) {
          setSelectedBracketId(null);
          setBracketMatches([]);
        }
        await loadTournament();
      } else {
        const d = await res.json();
        alert(d.error ?? "Error al eliminar bracket");
      }
    } finally {
      setDeletingBracketId(null);
    }
  }

  async function handleSaveBracketParticipants() {
    if (!selectedBracketId) return;
    setSavingBracketParticipants(true);
    setBracketParticipantError(null);
    try {
      const res = await fetch(
        `/api/tournaments/${id}/brackets/${selectedBracketId}/participants`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIds: Array.from(bracketSelectedIds) }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        await loadBracketMatches(selectedBracketId);
        await loadTournament();
        showToast("Participantes guardados exitosamente");
      } else if (res.status === 409) {
        setBracketParticipantError(
          `${data.error}: ${(data.conflicts as string[]).join(", ")}`,
        );
      } else {
        setBracketParticipantError(data.error ?? "Error al guardar participantes");
      }
    } finally {
      setSavingBracketParticipants(false);
    }
  }

  async function handleGenerateBracket() {
    if (!selectedBracketId) return;
    setGeneratingBracket(true);
    try {
      const res = await fetch(
        `/api/tournaments/${id}/brackets/${selectedBracketId}/bracket`,
        { method: "POST" },
      );
      if (res.ok) {
        await loadBracketMatches(selectedBracketId);
        setBracketSubTab("bracket");
        showToast("Bracket generado exitosamente");
      } else {
        const d = await res.json();
        showToast(d.error ?? "Error al generar bracket", "error");
      }
    } finally {
      setGeneratingBracket(false);
    }
  }

  async function handleGenerateKataOrder() {
    if (!selectedBracketId) return;
    setGeneratingKataOrder(true);
    try {
      const res = await fetch(
        `/api/tournaments/${id}/brackets/${selectedBracketId}/kata-order`,
        { method: "POST" },
      );
      if (res.ok) {
        await loadBracketMatches(selectedBracketId);
        setBracketSubTab("bracket");
        showToast("Orden de actuación generado aleatoriamente");
      } else {
        const d = await res.json().catch(() => ({}));
        showToast((d as { error?: string }).error ?? "Error al generar el orden", "error");
      }
    } finally {
      setGeneratingKataOrder(false);
    }
  }

  async function handleConfirmBracket() {
    if (!selectedBracketId) return;
    setConfirmingBracket(true);
    try {
      const res = await fetch(
        `/api/tournaments/${id}/brackets/${selectedBracketId}/bracket?action=confirm`,
        { method: "POST" },
      );
      if (res.ok) {
        await loadBracketMatches(selectedBracketId);
        await loadTournament();
        showToast("¡Bracket confirmado y bloqueado!");
      } else {
        const d = await res.json();
        showToast(d.error ?? "Error al confirmar bracket", "error");
      }
    } finally {
      setConfirmingBracket(false);
    }
  }

  async function handleSaveMatch(
    matchId: string,
    data: { score1: number; score2: number; winnerId: string },
  ) {
    setSavingWinner(matchId);
    try {
      const res = await fetch(`/api/tournaments/${id}/matches/${matchId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok) {
        // Update local bracket matches
        const allUpdated: (BracketMatch & { bracketId?: string })[] = result.matches ?? [];
        if (selectedBracketId) {
          const filtered = allUpdated.filter(m => m.bracketId === selectedBracketId);
          setBracketMatches(filtered);
        }
        // Update tournament status
        setTournament(prev =>
          prev
            ? { ...prev, matches: result.matches ?? prev.matches, status: result.tournament?.status ?? prev.status }
            : prev,
        );
      } else {
        showToast((result as { error?: string }).error ?? "Error al guardar resultado", "error");
      }
    } catch {
      showToast("Error de conexión al guardar resultado", "error");
    } finally {
      setSavingWinner(null);
    }
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      await fetch(`/api/tournaments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tatami: configForm.tatami ? parseInt(configForm.tatami) : null,
          scheduledAt: configForm.scheduledAt || null,
        }),
      });

      const validReferees = configForm.referees.filter((r) => r.trim());
      await fetch(`/api/tournaments/${id}/referees`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referees: validReferees }),
      });

      await loadTournament();
      showToast("Configuración guardada exitosamente");
    } finally {
      setSavingConfig(false);
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  // Build participantsMap from all tournament participants
  const participantsMap: Record<string, { fullName: string; beltColor: string; photo?: string | null }> = {};
  for (const p of tournament.participants) {
    participantsMap[p.id] = {
      fullName:  p.student.fullName,
      beltColor: p.student.beltHistory[0]?.beltColor ?? "blanca",
      photo:     p.student.photo ?? null,
    };
  }

  // Kata participants for the selected bracket — sorted by seed
  const kataParticipants = selectedBracketId
    ? tournament.participants
        .filter(p => p.bracketId === selectedBracketId)
        .map(p => ({
          id:        p.id,
          seed:      p.seed ?? 999,
          studentId: p.studentId,
          student: {
            fullName:    p.student.fullName,
            photo:       p.student.photo ?? null,
            beltHistory: p.student.beltHistory,
          },
        }))
        .sort((a, b) => a.seed - b.seed)
    : [];

  // Students already in OTHER brackets of this tournament (by studentId)
  const studentIdToOtherBracketId: Record<string, string> = {};
  for (const p of tournament.participants) {
    if (p.bracketId && p.bracketId !== selectedBracketId) {
      studentIdToOtherBracketId[p.studentId] = p.bracketId;
    }
  }

  // Filtered students for bracket participant management
  const filteredStudents = allStudents.filter((s) => {
    if (searchStudent && !s.fullName.toLowerCase().includes(searchStudent.toLowerCase())) return false;
    const age = calculateAge(s.birthDate);
    if (filterMinAge && age < parseInt(filterMinAge)) return false;
    if (filterMaxAge && age > parseInt(filterMaxAge)) return false;
    if (filterBelts.size > 0) {
      const belt = s.beltHistory[0]?.beltColor ?? "blanca";
      if (!filterBelts.has(belt)) return false;
    }
    return true;
  });

  const selectedBracket = brackets.find(b => b.id === selectedBracketId) ?? null;

  // Sysadmin puede eliminar cualquier bracket; admin solo en borrador
  const canDeleteBracket = (b: BracketInfo) =>
    isSysadmin || (b.status === "draft" && tournament.status !== "completed");

  // ── Completar / Reabrir torneo ───────────────────────────────────────────

  async function handleCompleteTournament() {
    if (!confirm("¿Completar el torneo? Las llaves quedarán bloqueadas y solo se podrán ingresar puntajes.")) return;
    setCompletingTournament(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/confirm`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast("✓ Torneo completado y bloqueado");
        loadTournament();
      } else {
        const msgs = (d as { missing?: string[] }).missing?.join("\n• ") ?? (d as { error?: string }).error;
        showToast(`Requisitos incompletos:\n• ${msgs}`, "error");
      }
    } finally {
      setCompletingTournament(false);
    }
  }

  async function handleReopenTournament() {
    if (!confirm("¿Reabrir el torneo? Se habilitará la edición de brackets nuevamente. Esta acción quedará en el log.")) return;
    setReopeningTournament(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/confirm`, { method: "DELETE" });
      if (res.ok) {
        showToast("Torneo reabierto — acción registrada en audit log");
        loadTournament();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast((d as { error?: string }).error ?? "Error al reabrir", "error");
      }
    } finally {
      setReopeningTournament(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push("/dashboard/tournaments")}
          className="mt-1 p-2 rounded-lg hover:bg-dojo-border transition-colors flex-shrink-0"
        >
          <ArrowLeft size={18} className="text-dojo-muted" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-dojo-white truncate">{tournament.name}</h1>
            <StatusBadge status={tournament.status} />
            {tournament.bracketLocked && (
              <span className="badge-green text-xs">Bracket Confirmado</span>
            )}
          </div>
          <p className="text-xs text-dojo-muted mt-0.5">
            {formatDate(tournament.date)} · {tournament.location}
          </p>
        </div>

        {/* Inactivar torneo — disponible si no está ya archivado */}
        {canEdit && !tournament.archivedAt && (
          <button
            onClick={async () => {
              if (!confirm(`¿Inactivar "${tournament.name}"? El torneo pasará al historial.`)) return;
              const res = await fetch(`/api/tournaments/${id}/archive`, { method: "POST" });
              if (res.ok) {
                showToast("Torneo inactivado");
                router.push("/dashboard/tournaments");
              } else {
                const d = await res.json().catch(() => ({}));
                showToast((d as { error?: string }).error ?? "Error al inactivar", "error");
              }
            }}
            title="Inactivar torneo (mover al historial)"
            className="mt-1 p-2 rounded-lg transition-colors flex-shrink-0
                       text-dojo-muted hover:bg-yellow-400/10 hover:text-yellow-400"
          >
            <Archive size={18} />
          </button>
        )}

        {/* Eliminar torneo — admin: cualquier estado excepto confirmado · sysadmin: siempre */}
        {(isSysadmin || tournament.status !== "confirmed") && canEdit && (
          <button
            onClick={async () => {
              if (!confirm(`¿Eliminar el torneo "${tournament.name}"? Esta acción no se puede deshacer.`)) return;
              const res = await fetch(`/api/tournaments/${id}`, { method: "DELETE" });
              if (res.ok) {
                showToast("Torneo eliminado");
                router.push("/dashboard/tournaments");
              } else {
                const d = await res.json().catch(() => ({}));
                showToast((d as { error?: string }).error ?? "No se pudo eliminar", "error");
              }
            }}
            className="mt-1 flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors flex-shrink-0
                       text-red-400 hover:bg-red-400/10 border border-red-400/30 hover:border-red-400/60 text-sm font-medium"
          >
            <Trash2 size={15} />
            Eliminar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-dojo-border flex gap-0 overflow-x-auto">
        <TabButton active={tab === "info"} onClick={() => setTab("info")}>
          <Info size={15} /> Info
        </TabButton>
        <TabButton active={tab === "kumite"} onClick={() => setTab("kumite")}>
          <GitBranch size={15} /> Kumite ({brackets.filter(b => b.type === "kumite").length})
        </TabButton>
        <TabButton active={tab === "kata"} onClick={() => setTab("kata")}>
          <GitBranch size={15} /> Kata ({brackets.filter(b => b.type === "kata").length})
        </TabButton>
        <TabButton active={tab === "config"} onClick={() => setTab("config")}>
          <Settings size={15} /> Configuración
        </TabButton>
        {/* Tabs Pro — solo sysadmin (Torneo Pro) */}
        {isSysadmin && (
          <>
            <TabButton active={tab === "registrations"} onClick={() => setTab("registrations")}>
              <Users size={15} /> Inscripciones
            </TabButton>
            <TabButton active={tab === "stream"} onClick={() => setTab("stream")}>
              <Video size={15} /> Stream
            </TabButton>
            <TabButton active={tab === "settings_pro"} onClick={() => setTab("settings_pro")}>
              <Sliders size={15} /> Ajustes Pro
            </TabButton>
          </>
        )}
      </div>

      {/* ── TAB: INFO ─────────────────────────────────────────────────────── */}
      {tab === "info" && (
        <div className="space-y-4 max-w-2xl">
          {!editingInfo ? (
            /* ── Vista ── */
            <div className="card space-y-5">
              {/* Datos básicos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField label="Nombre"        value={tournament.name} />
                <InfoField label="Fecha"         value={formatDate(tournament.date)} />
                <InfoField label="Lugar"         value={tournament.location} />
                <InfoField label="Organización"  value={tournament.organization} />
                <InfoField label="Líder 1"       value={tournament.leader1} />
                {tournament.leader2 && <InfoField label="Líder 2" value={tournament.leader2} />}
                {tournament.leader3 && <InfoField label="Líder 3" value={tournament.leader3} />}
              </div>

              {/* Campos adicionales */}
              {tournament.description && (
                <div className="border-t border-dojo-border pt-4">
                  <p className="form-label mb-1">Descripción del Evento</p>
                  <p className="text-sm text-dojo-white whitespace-pre-wrap">{tournament.description}</p>
                </div>
              )}
              {tournament.format && (
                <div>
                  <p className="form-label mb-1">Formato del Torneo</p>
                  <p className="text-sm text-dojo-white whitespace-pre-wrap">{tournament.format}</p>
                </div>
              )}
              {tournament.arbitrage && (
                <div>
                  <p className="form-label mb-1">Arbitraje del Evento</p>
                  <p className="text-sm text-dojo-white whitespace-pre-wrap">{tournament.arbitrage}</p>
                </div>
              )}
              {tournament.requirements && (
                <div>
                  <p className="form-label mb-1">Requisitos para Participar</p>
                  <p className="text-sm text-dojo-white whitespace-pre-wrap">{tournament.requirements}</p>
                </div>
              )}
              {tournament.contact && (
                <div>
                  <p className="form-label mb-1">Contacto para Participar</p>
                  <p className="text-sm text-dojo-white whitespace-pre-wrap">{tournament.contact}</p>
                </div>
              )}

              {/* Flyer — al final */}
              {tournament.flyerImage && (
                <div className="border-t border-dojo-border pt-4">
                  <p className="form-label mb-2">Flyer del Evento</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tournament.flyerImage}
                    alt="Flyer del torneo"
                    className="w-full max-w-md rounded-lg border border-dojo-border object-contain"
                  />
                </div>
              )}

              <div className="pt-2">
                <button onClick={() => setEditingInfo(true)} className="btn-secondary">
                  Editar Información
                </button>
              </div>
            </div>
          ) : (
            /* ── Edición ── */
            <div className="card space-y-4">
              {/* Datos básicos */}
              <p className="text-xs text-dojo-muted uppercase tracking-wider font-semibold">Datos Básicos</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="form-label">Nombre *</label>
                  <input className="form-input" value={infoForm.name}
                    onChange={e => setInfoForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Fecha *</label>
                  <input type="date" className="form-input" value={infoForm.date}
                    onChange={e => setInfoForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Lugar *</label>
                  <input className="form-input" value={infoForm.location}
                    onChange={e => setInfoForm(p => ({ ...p, location: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Organización *</label>
                  <input className="form-input" value={infoForm.organization}
                    onChange={e => setInfoForm(p => ({ ...p, organization: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Líder 1 *</label>
                  <input className="form-input" value={infoForm.leader1}
                    onChange={e => setInfoForm(p => ({ ...p, leader1: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Líder 2</label>
                  <input className="form-input" value={infoForm.leader2}
                    onChange={e => setInfoForm(p => ({ ...p, leader2: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Líder 3</label>
                  <input className="form-input" value={infoForm.leader3}
                    onChange={e => setInfoForm(p => ({ ...p, leader3: e.target.value }))} />
                </div>
              </div>

              {/* Campos adicionales */}
              <p className="text-xs text-dojo-muted uppercase tracking-wider font-semibold pt-2 border-t border-dojo-border">
                Información del Evento
              </p>
              <div className="space-y-3">
                <div>
                  <label className="form-label">Descripción del Evento</label>
                  <textarea rows={3} className="form-input resize-none" value={infoForm.description}
                    onChange={e => setInfoForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Descripción general del torneo..." />
                </div>
                <div>
                  <label className="form-label">Formato del Torneo</label>
                  <textarea rows={2} className="form-input resize-none" value={infoForm.format}
                    onChange={e => setInfoForm(p => ({ ...p, format: e.target.value }))}
                    placeholder="Ej. Eliminación directa, Round robin, etc." />
                </div>
                <div>
                  <label className="form-label">Arbitraje del Evento</label>
                  <textarea rows={2} className="form-input resize-none" value={infoForm.arbitrage}
                    onChange={e => setInfoForm(p => ({ ...p, arbitrage: e.target.value }))}
                    placeholder="Sistema de arbitraje, árbitros invitados, etc." />
                </div>
                <div>
                  <label className="form-label">Requisitos para Participar</label>
                  <textarea rows={3} className="form-input resize-none" value={infoForm.requirements}
                    onChange={e => setInfoForm(p => ({ ...p, requirements: e.target.value }))}
                    placeholder="Edad mínima, cintas requeridas, documentos, etc." />
                </div>
                <div>
                  <label className="form-label">Contacto para Participar</label>
                  <textarea rows={2} className="form-input resize-none" value={infoForm.contact}
                    onChange={e => setInfoForm(p => ({ ...p, contact: e.target.value }))}
                    placeholder="Correo, teléfono, WhatsApp, etc." />
                </div>
              </div>

              {/* Flyer — al final */}
              <p className="text-xs text-dojo-muted uppercase tracking-wider font-semibold pt-2 border-t border-dojo-border">
                Flyer del Evento
              </p>
              <div className="space-y-2">
                {infoForm.flyerImage && (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={infoForm.flyerImage} alt="Flyer"
                      className="max-h-48 rounded-lg border border-dojo-border object-contain" />
                    <button
                      type="button"
                      onClick={() => setInfoForm(p => ({ ...p, flyerImage: "" }))}
                      className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
                <label className={[
                  "btn-secondary cursor-pointer inline-flex items-center gap-2 text-sm",
                  uploadingFlyer ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingFlyer}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      // Subir a Cloudinary — NUNCA guardar base64 en la BD
                      setUploadingFlyer(true);
                      try {
                        const fd = new FormData();
                        fd.append("file", file);
                        fd.append("type", "image");
                        const res = await fetch("/api/upload", { method: "POST", body: fd });
                        if (res.ok) {
                          const { url } = await res.json() as { url: string };
                          setInfoForm(p => ({ ...p, flyerImage: url }));
                        } else {
                          alert("Error al subir la imagen a Cloudinary");
                        }
                      } finally {
                        setUploadingFlyer(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  {uploadingFlyer ? "Subiendo..." : infoForm.flyerImage ? "Cambiar imagen" : "Subir Flyer"}
                </label>
                <p className="text-xs text-dojo-muted">JPG o PNG — la imagen se guarda en Cloudinary.</p>
              </div>

              <div className="flex gap-3 pt-2 border-t border-dojo-border">
                <button onClick={() => setEditingInfo(false)} className="btn-secondary" disabled={savingInfo}>
                  Cancelar
                </button>
                <button onClick={handleSaveInfo} className="btn-primary" disabled={savingInfo || !infoForm.name || !infoForm.date}>
                  {savingInfo ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TABS: KUMITE y KATA (misma lógica, filtrado por type) ──────────── */}
      {(tab === "kumite" || tab === "kata") && (
        <div className="space-y-4">
          {/* Bracket list + New bracket button */}
          {selectedBracketId === null ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-dojo-white flex items-center gap-2">
                  {tab === "kumite" ? "⚔️ Kumite" : "🥋 Kata"}
                  <span className="text-xs font-normal text-dojo-muted">
                    ({brackets.filter(b => b.type === tab).length} brackets)
                  </span>
                </h2>
                {tournament.status !== "completed" && tournament.status !== "confirmed" && (
                  <button
                    onClick={() => openNewBracketModal(tab)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Plus size={15} /> Nuevo Bracket {tab === "kumite" ? "Kumite" : "Kata"}
                  </button>
                )}
              </div>

              {/* Filtrar brackets por tipo del tab activo */}
              {(() => {
                const typedBrackets = brackets.filter(b => b.type === tab);
                return typedBrackets.length === 0 ? (
                <div className="card flex flex-col items-center gap-4 py-16 text-center">
                  <GitBranch className="text-dojo-gold/50" size={40} />
                  <div>
                    <p className="text-dojo-white font-semibold">Sin brackets de {tab === "kumite" ? "Kumite" : "Kata"}</p>
                    <p className="text-dojo-muted text-sm mt-1">
                      Crea un bracket para comenzar.
                    </p>
                  </div>
                  {tournament.status !== "completed" && tournament.status !== "confirmed" && (
                    <button
                      onClick={() => openNewBracketModal(tab as "kumite" | "kata")}
                      className="btn-primary flex items-center gap-2"
                    >
                      <Plus size={15} /> Nuevo Bracket {tab === "kumite" ? "Kumite" : "Kata"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {typedBrackets.map((b) => (
                    <div
                      key={b.id}
                      className="card flex items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-dojo-white truncate">{b.name}</p>
                          {/* Badge de género */}
                          {b.gender === "M" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                                             bg-blue-600/20 text-blue-300 border border-blue-600/30">
                              ♂ Masculino
                            </span>
                          )}
                          {b.gender === "F" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                                             bg-pink-600/20 text-pink-300 border border-pink-600/30">
                              ♀ Femenino
                            </span>
                          )}
                          <StatusBadge status={b.status} />
                          {b.bracketLocked && (
                            <span className="badge-green text-xs">Confirmado</span>
                          )}
                        </div>
                        <p className="text-xs text-dojo-muted mt-0.5">
                          {b._count.participants} participante{b._count.participants !== 1 ? "s" : ""} ·{" "}
                          {b._count.matches} match{b._count.matches !== 1 ? "es" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setSelectedBracketId(b.id);
                            setBracketSubTab("participants");
                          }}
                          className="btn-secondary flex items-center gap-1.5 text-sm"
                        >
                          <ChevronRight size={14} /> Gestionar
                        </button>
                        {/* Reabrir bracket — solo sysadmin, solo cuando está bloqueado */}
                        {isSysadmin && b.bracketLocked && (
                          <button
                            onClick={async () => {
                              const reason = prompt("Motivo de reapertura (obligatorio):");
                              if (!reason?.trim()) return;
                              const res = await fetch(
                                `/api/tournaments/${id}/brackets/${b.id}/reopen`,
                                {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ reason }),
                                },
                              );
                              if (res.ok) {
                                showToast("Bracket reabierto — acción registrada en audit log");
                                loadTournament();
                              } else {
                                const d = await res.json().catch(() => ({}));
                                showToast((d as { error?: string }).error ?? "Error al reabrir", "error");
                              }
                            }}
                            className="p-2 rounded-lg hover:bg-yellow-400/10 transition-colors text-yellow-400/70 hover:text-yellow-400"
                            title="Reabrir bracket (Sysadmin)"
                          >
                            <Unlock size={15} />
                          </button>
                        )}
                        {canDeleteBracket(b) && (
                          <button
                            onClick={() => handleDeleteBracket(b.id)}
                            disabled={deletingBracketId === b.id}
                            className="p-2 rounded-lg hover:bg-dojo-red/10 transition-colors text-dojo-red/70 hover:text-dojo-red"
                            title="Eliminar bracket"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );})()}
            </div>
          ) : (
            /* ── Bracket management view ──────────────────────────────── */
            <div className="space-y-4">
              {/* Back + bracket header */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setSelectedBracketId(null); setBracketMatches([]); }}
                  className="p-2 rounded-lg hover:bg-dojo-border transition-colors"
                >
                  <ArrowLeft size={16} className="text-dojo-muted" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-dojo-white">{selectedBracket?.name}</h2>
                    {selectedBracket?.gender === "M" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                                       bg-blue-600/20 text-blue-300 border border-blue-600/30">
                        ♂ Masculino
                      </span>
                    )}
                    {selectedBracket?.gender === "F" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                                       bg-pink-600/20 text-pink-300 border border-pink-600/30">
                        ♀ Femenino
                      </span>
                    )}
                    {selectedBracket && <StatusBadge status={selectedBracket.status} />}
                    {selectedBracket?.bracketLocked && (
                      <span className="badge-green text-xs">Confirmado</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="border-b border-dojo-border flex gap-0">
                <button
                  onClick={() => setBracketSubTab("participants")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                    bracketSubTab === "participants"
                      ? "border-dojo-gold text-dojo-gold"
                      : "border-transparent text-dojo-muted hover:text-dojo-white",
                  )}
                >
                  <Users size={14} /> Participantes ({bracketSelectedIds.size})
                </button>
                <button
                  onClick={() => setBracketSubTab("bracket")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                    bracketSubTab === "bracket"
                      ? "border-dojo-gold text-dojo-gold"
                      : "border-transparent text-dojo-muted hover:text-dojo-white",
                  )}
                >
                  <GitBranch size={14} /> Bracket Visual
                </button>
              </div>

              {/* ── Sub-tab: Participants ───────────────────────────── */}
              {bracketSubTab === "participants" && (
                <div className="space-y-4">
                  {selectedBracket?.bracketLocked ? (
                    // Read-only: show confirmed participants
                    <div className="card space-y-3">
                      <h3 className="font-semibold text-dojo-white">
                        Participantes confirmados ({bracketSelectedIds.size})
                      </h3>
                      {bracketSelectedIds.size === 0 ? (
                        <p className="text-dojo-muted text-sm">Sin participantes registrados.</p>
                      ) : (
                        <ul className="divide-y divide-dojo-border">
                          {tournament.participants
                            .filter(p => p.bracketId === selectedBracketId)
                            .map((p) => {
                              const beltColor = p.student.beltHistory[0]?.beltColor ?? "blanca";
                              return (
                                <li key={p.id} className="py-2.5 flex items-center gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-dojo-white truncate">
                                      {p.student.fullName}
                                    </p>
                                    <p className="text-xs text-dojo-muted">
                                      {calculateAge(p.student.birthDate)} años
                                    </p>
                                  </div>
                                  <BeltBadge beltColor={beltColor} />
                                </li>
                              );
                            })}
                        </ul>
                      )}
                    </div>
                  ) : (
                    // Editable participant selection
                    <div className="space-y-4">
                      {bracketParticipantError && (
                        <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-700/40 rounded-lg">
                          <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-300">{bracketParticipantError}</p>
                        </div>
                      )}

                      {/* Filters */}
                      <div className="card space-y-3">
                        <h3 className="font-semibold text-dojo-white text-sm">Filtros</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input
                            className="form-input"
                            placeholder="Buscar por nombre..."
                            value={searchStudent}
                            onChange={(e) => setSearchStudent(e.target.value)}
                          />
                          <input
                            type="number"
                            className="form-input"
                            placeholder="Edad mínima"
                            value={filterMinAge}
                            onChange={(e) => setFilterMinAge(e.target.value)}
                            min={0}
                          />
                          <input
                            type="number"
                            className="form-input"
                            placeholder="Edad máxima"
                            value={filterMaxAge}
                            onChange={(e) => setFilterMaxAge(e.target.value)}
                            min={0}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {BELT_COLORS.map((b) => (
                            <button
                              key={b.value}
                              onClick={() => {
                                setFilterBelts((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(b.value)) next.delete(b.value);
                                  else next.add(b.value);
                                  return next;
                                });
                              }}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-xs border transition-colors",
                                filterBelts.has(b.value)
                                  ? "border-dojo-gold bg-dojo-gold/20 text-dojo-gold"
                                  : "border-dojo-border text-dojo-muted hover:border-dojo-gold/50",
                              )}
                            >
                              {b.label}
                            </button>
                          ))}
                          {filterBelts.size > 0 && (
                            <button
                              onClick={() => setFilterBelts(new Set())}
                              className="px-2.5 py-1 rounded-full text-xs border border-dojo-red/40 text-dojo-red"
                            >
                              Limpiar cintas
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Counter + save */}
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-dojo-muted">
                          <span className="text-dojo-white font-semibold">{bracketSelectedIds.size}</span>{" "}
                          participante{bracketSelectedIds.size !== 1 ? "s" : ""} seleccionado
                          {bracketSelectedIds.size !== 1 ? "s" : ""}
                        </p>
                        <button
                          onClick={handleSaveBracketParticipants}
                          className="btn-primary"
                          disabled={savingBracketParticipants}
                        >
                          {savingBracketParticipants ? "Guardando..." : "Guardar Selección"}
                        </button>
                      </div>

                      {/* Student list */}
                      {loadingStudents ? (
                        <div className="card py-10 text-center text-dojo-muted animate-pulse">
                          Cargando alumnos...
                        </div>
                      ) : (
                        <div className="card divide-y divide-dojo-border">
                          {filteredStudents.length === 0 && (
                            <p className="py-8 text-center text-dojo-muted text-sm">
                              No se encontraron alumnos con esos filtros.
                            </p>
                          )}
                          {filteredStudents.map((s) => {
                            const beltColor = s.beltHistory[0]?.beltColor ?? "blanca";
                            const checked = bracketSelectedIds.has(s.id);
                            const inOtherBracket = !!studentIdToOtherBracketId[s.id];
                            const otherBracketName = inOtherBracket
                              ? brackets.find(b => b.id === studentIdToOtherBracketId[s.id])?.name ?? "otro bracket"
                              : null;

                            if (inOtherBracket) {
                              return (
                                <div
                                  key={s.id}
                                  className="flex items-center gap-3 py-2.5 px-1 opacity-50 cursor-not-allowed"
                                >
                                  <input
                                    type="checkbox"
                                    checked={false}
                                    disabled
                                    className="w-4 h-4 accent-dojo-gold"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-dojo-white truncate">
                                      {s.fullName}
                                    </p>
                                    <p className="text-xs text-dojo-muted">
                                      {calculateAge(s.birthDate)} años
                                    </p>
                                  </div>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-900/30 text-red-400 border border-red-700/30 flex-shrink-0">
                                    ⚠️ {otherBracketName}
                                  </span>
                                  <BeltBadge beltColor={beltColor} />
                                </div>
                              );
                            }

                            return (
                              <label
                                key={s.id}
                                className="flex items-center gap-3 py-2.5 px-1 cursor-pointer hover:bg-dojo-border/20 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setBracketSelectedIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(s.id)) next.delete(s.id);
                                      else next.add(s.id);
                                      return next;
                                    });
                                  }}
                                  className="w-4 h-4 accent-dojo-gold"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-dojo-white truncate">
                                    {s.fullName}
                                  </p>
                                  <p className="text-xs text-dojo-muted">
                                    {calculateAge(s.birthDate)} años
                                  </p>
                                </div>
                                <BeltBadge beltColor={beltColor} />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Sub-tab: Bracket Visual ─────────────────────────── */}
              {bracketSubTab === "bracket" && (
                <div className="space-y-4">
                  {/* Bracket actions */}
                  {loadingBracketMatches ? (
                    <div className="card py-10 text-center text-dojo-muted animate-pulse">
                      Cargando bracket...
                    </div>
                  ) : bracketMatches.length === 0 && selectedBracket?.status === "draft" ? (
                    <div className="card flex flex-col items-center gap-4 py-16 text-center">
                      <GitBranch className="text-dojo-gold/50" size={40} />
                      <div>
                        <p className="text-dojo-white font-semibold">Bracket no generado</p>
                        <p className="text-dojo-muted text-sm mt-1">
                          Primero selecciona los participantes del bracket y luego genera el bracket.
                        </p>
                        {bracketSelectedIds.size < 2 && (
                          <p className="text-yellow-400 text-xs mt-2">
                            Necesitas al menos 2 participantes en este bracket.
                          </p>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setBracketSubTab("participants")}
                          className="btn-secondary"
                        >
                          Ir a Participantes
                        </button>
                        {tab === "kata" ? (
                          <button
                            onClick={handleGenerateKataOrder}
                            className="btn-primary"
                            disabled={bracketSelectedIds.size < 1 || generatingKataOrder}
                          >
                            {generatingKataOrder ? "Generando..." : "🎲 Generar Orden Aleatorio"}
                          </button>
                        ) : (
                          <button
                            onClick={handleGenerateBracket}
                            className="btn-primary"
                            disabled={bracketSelectedIds.size < 2 || generatingBracket}
                          >
                            {generatingBracket ? "Generando..." : "Generar Bracket"}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Actions row */}
                      <div className="flex items-center gap-3 flex-wrap print-hide">
                        {!selectedBracket?.bracketLocked && (
                          <>
                            {tab === "kata" ? (
                              <button
                                onClick={handleGenerateKataOrder}
                                className="btn-secondary flex items-center gap-2"
                                disabled={generatingKataOrder || bracketSelectedIds.size < 1}
                              >
                                <RefreshCw size={15} />
                                {generatingKataOrder ? "Regenerando..." : "🎲 Regenerar Orden"}
                              </button>
                            ) : (
                              <button
                                onClick={handleGenerateBracket}
                                className="btn-secondary flex items-center gap-2"
                                disabled={generatingBracket || bracketSelectedIds.size < 2}
                              >
                                <RefreshCw size={15} />
                                {generatingBracket ? "Regenerando..." : "Regenerar Bracket"}
                              </button>
                            )}
                            {selectedBracket?.status === "ready" && (
                              <button
                                onClick={handleConfirmBracket}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-medium transition-colors"
                                disabled={confirmingBracket}
                              >
                                <CheckCircle size={15} />
                                {confirmingBracket ? "Confirmando..." : "Confirmar Bracket"}
                              </button>
                            )}
                          </>
                        )}
                        {selectedBracket?.status === "completed" && (
                          <span className="badge-green flex items-center gap-1.5">
                            <Trophy size={13} /> Bracket Completado
                          </span>
                        )}
                        <button
                          onClick={() => window.print()}
                          className="btn-ghost flex items-center gap-2 ml-auto print-hide"
                        >
                          <Printer size={15} /> Imprimir bracket
                        </button>
                      </div>

                      {/* ── KATA: Lista de orden de actuación ── */}
                      {tab === "kata" ? (
                        <KataOrderList
                          participants={kataParticipants}
                          bracketName={selectedBracket?.name ?? ""}
                          tournamentName={tournament.name}
                          locked={selectedBracket?.bracketLocked ?? false}
                        />
                      ) : (
                        /* ── KUMITE: Bracket visual ── */
                        bracketMatches.length > 0 ? (
                          <div className="bracket-print-area card p-4">
                            <div className="bracket-print-header hidden">
                              <h2 style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>
                                {tournament.name}
                              </h2>
                              {selectedBracket && (
                                <p style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>
                                  {selectedBracket.name} · {formatDate(tournament.date)} · {tournament.location}
                                </p>
                              )}
                            </div>
                            <BracketView
                              matches={bracketMatches}
                              participantsMap={participantsMap}
                              onSaveMatch={
                                (selectedBracket?.status === "active" ||
                                 selectedBracket?.status === "completed" ||
                                 tournament.status === "confirmed")
                                  ? handleSaveMatch
                                  : undefined
                              }
                              locked={selectedBracket?.bracketLocked ?? false}
                              saving={savingWinner}
                              showMedals={selectedBracket?.status === "completed"}
                            />
                          </div>
                        ) : (
                          <div className="card py-10 text-center">
                            <p className="text-dojo-muted">No hay matches generados aún.</p>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CONFIG ──────────────────────────────────────────────────── */}
      {tab === "config" && (
        <div className="card max-w-2xl space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Número de Tatami</label>
              <input
                type="number"
                className="form-input"
                value={configForm.tatami}
                onChange={(e) =>
                  setConfigForm((p) => ({ ...p, tatami: e.target.value }))
                }
                min={1}
                placeholder="Ej. 3"
              />
            </div>
            <div>
              <label className="form-label">Fecha y Hora del Torneo</label>
              <input
                type="datetime-local"
                className="form-input"
                value={configForm.scheduledAt}
                onChange={(e) =>
                  setConfigForm((p) => ({ ...p, scheduledAt: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Referees */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label mb-0">Árbitros (máx. 5)</label>
              <span className="text-xs text-dojo-muted">
                {configForm.referees.filter((r) => r.trim()).length}/5
              </span>
            </div>
            <div className="space-y-2">
              {configForm.referees.map((ref, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-dojo-muted w-5 text-right flex-shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    className="form-input flex-1"
                    placeholder={`Árbitro ${idx + 1}`}
                    value={ref}
                    onChange={(e) => {
                      const next = [...configForm.referees];
                      next[idx] = e.target.value;
                      setConfigForm((p) => ({ ...p, referees: next }));
                    }}
                  />
                  {ref.trim() && (
                    <button
                      onClick={() => {
                        const next = [...configForm.referees];
                        next[idx] = "";
                        setConfigForm((p) => ({ ...p, referees: next }));
                      }}
                      className="p-1.5 rounded hover:bg-dojo-border transition-colors"
                    >
                      <X size={14} className="text-dojo-muted" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveConfig}
            className="btn-primary"
            disabled={savingConfig || tournament.status === "confirmed"}
          >
            {savingConfig ? "Guardando..." : "Guardar Configuración"}
          </button>

          {/* ── Checklist + botón Completar Torneo ────────────────────── */}
          <div className="border-t border-dojo-border pt-5 space-y-4">
            <h3 className="font-semibold text-dojo-white flex items-center gap-2">
              <LockKeyhole size={16} className="text-dojo-gold" />
              Completar Torneo
            </h3>

            {tournament.status === "confirmed" ? (
              /* Ya completado */
              <div className="bg-green-900/20 border border-green-600/30 rounded-xl p-4 space-y-3">
                <p className="text-green-300 font-semibold flex items-center gap-2">
                  <CheckCircle size={16} /> Torneo Completado y Bloqueado
                </p>
                <p className="text-xs text-dojo-muted">
                  Las llaves están bloqueadas. Solo se pueden ingresar puntajes en los matches.
                </p>
                {/* Solo sysadmin puede reabrir */}
                {isSysadmin && (
                  <button
                    onClick={handleReopenTournament}
                    disabled={reopeningTournament}
                    className="flex items-center gap-2 text-xs text-yellow-400 hover:text-yellow-300
                               border border-yellow-600/40 hover:border-yellow-500 rounded-lg px-3 py-1.5
                               transition-colors bg-yellow-900/10"
                  >
                    <LockOpen size={13} />
                    {reopeningTournament ? "Reabriendo..." : "Reabrir Torneo (Sysadmin)"}
                  </button>
                )}
              </div>
            ) : (
              /* Checklist de requisitos */
              (() => {
                const validReferees = configForm.referees.filter(r => r.trim());
                const allBracketsConfirmed = brackets.length > 0 && brackets.every(b => b.bracketLocked);
                const hasTatami = !!configForm.tatami;
                const hasReferees = validReferees.length > 0;
                const canComplete = allBracketsConfirmed && hasTatami && hasReferees;

                const checks = [
                  { ok: brackets.length > 0 && allBracketsConfirmed, label: `Todos los brackets confirmados (${brackets.filter(b => b.bracketLocked).length}/${brackets.length})` },
                  { ok: hasTatami, label: `Número de tatami configurado${hasTatami ? ` (${configForm.tatami})` : ""}` },
                  { ok: hasReferees, label: `Árbitros asignados (${validReferees.length})` },
                ];

                return (
                  <div className="space-y-3">
                    <div className="bg-dojo-dark rounded-xl p-4 space-y-2 border border-dojo-border">
                      {checks.map((c, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm">
                          <span className={c.ok ? "text-green-400" : "text-dojo-muted"}>
                            {c.ok ? "✓" : "○"}
                          </span>
                          <span className={c.ok ? "text-dojo-white" : "text-dojo-muted"}>
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleCompleteTournament}
                      disabled={!canComplete || completingTournament}
                      className={[
                        "w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                        canComplete
                          ? "bg-green-700 hover:bg-green-600 text-white shadow-lg shadow-green-900/30"
                          : "bg-dojo-border/40 text-dojo-muted/50 cursor-not-allowed",
                      ].join(" ")}
                    >
                      <LockKeyhole size={16} />
                      {completingTournament ? "Completando..." : "Completar Torneo"}
                    </button>

                    {!canComplete && (
                      <p className="text-xs text-dojo-muted text-center">
                        Completa todos los requisitos para habilitar este botón
                      </p>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ── TAB: INSCRIPCIONES ──────────────────────────────────────────── */}
      {tab === "registrations" && (
        <TournamentSettings
          tournamentId={id}
          tournament={tournament as Parameters<typeof TournamentSettings>[0]["tournament"]}
          onRefresh={loadTournament}
        />
      )}

      {/* ── TAB: STREAM ─────────────────────────────────────────────────── */}
      {tab === "stream" && (
        <TournamentStream
          tournamentId={id}
          publicSlug={(tournament as { publicSlug?: string | null }).publicSlug}
          onRefresh={loadTournament}
        />
      )}

      {/* ── TAB: AJUSTES PRO ────────────────────────────────────────────── */}
      {tab === "settings_pro" && (
        <TournamentSettings
          tournamentId={id}
          tournament={tournament as Parameters<typeof TournamentSettings>[0]["tournament"]}
          onRefresh={loadTournament}
        />
      )}

      {/* ── Modal: New Bracket ────────────────────────────────────────────── */}
      {showNewBracketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-dojo-white flex items-center gap-2">
                {newBracketType === "kumite" ? "⚔️" : "🥋"} Nuevo Bracket de {newBracketType === "kumite" ? "Kumite" : "Kata"}
              </h3>
              <button onClick={closeNewBracketModal} className="p-1 rounded hover:bg-dojo-border transition-colors">
                <X size={16} className="text-dojo-muted" />
              </button>
            </div>

            {/* Nombre */}
            <div>
              <label className="form-label">Nombre del bracket *</label>
              <input
                className="form-input"
                placeholder="Ej. Kata Infantil, Kumite -55kg..."
                value={newBracketName}
                onChange={e => setNewBracketName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateBracket(); }}
                autoFocus
              />
            </div>

            {/* Género */}
            <div>
              <label className="form-label">Género</label>
              <div className="flex gap-2">
                {(["M","F"] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setNewBracketGender(prev => prev === g ? null : g)}
                    className={[
                      "flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all",
                      newBracketGender === g
                        ? g === "M"
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-pink-600 border-pink-500 text-white"
                        : "bg-transparent border-dojo-border text-dojo-muted hover:border-dojo-white hover:text-dojo-white",
                    ].join(" ")}
                  >
                    {g === "M" ? "♂ Masculino" : "♀ Femenino"}
                  </button>
                ))}
              </div>
              {!newBracketGender && (
                <p className="text-xs text-dojo-muted mt-1">Opcional — puedes dejarlo sin especificar</p>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button onClick={closeNewBracketModal} className="btn-secondary" disabled={creatingBracket}>
                Cancelar
              </button>
              <button
                onClick={handleCreateBracket}
                className="btn-primary"
                disabled={!newBracketName.trim() || creatingBracket}
              >
                {creatingBracket ? "Creando..." : "Crear Bracket"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-dojo-muted mb-0.5">{label}</p>
      <p className="text-sm text-dojo-white font-medium">{value}</p>
    </div>
  );
}

