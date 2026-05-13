"use client";
import { BeltBadge } from "@/components/ui/BeltBadge";

interface KataParticipant {
  id:          string;
  seed:        number;
  studentId:   string;
  student: {
    fullName:    string;
    photo:       string | null;
    beltHistory: { beltColor: string }[];
  };
}

interface KataOrderListProps {
  participants: KataParticipant[];
  bracketName:  string;
  tournamentName?: string;
  locked:       boolean;
}

function Avatar({ photo, name }: { photo: string | null; name: string }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase();
  const url = photo?.startsWith("http") ? photo : null;
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center
                    text-xs font-bold text-dojo-gold bg-dojo-border">
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt={name} className="w-full h-full object-cover" />
        : initials || "?"}
    </div>
  );
}

export function KataOrderList({ participants, bracketName, tournamentName, locked }: KataOrderListProps) {
  const sorted = [...participants].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));

  if (sorted.length === 0) {
    return (
      <div className="card py-12 text-center text-dojo-muted">
        <p className="text-sm">No hay participantes en esta categoría.</p>
        <p className="text-xs mt-1">Agrega participantes desde el sub-tab "Participantes".</p>
      </div>
    );
  }

  return (
    <div className="bracket-print-area card p-4 space-y-3">
      {/* Print header */}
      <div className="bracket-print-header hidden">
        {tournamentName && <h2 style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>{tournamentName}</h2>}
        <p style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
          🥋 Kata — {bracketName} · Orden de actuación ({sorted.length} competidores)
        </p>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between print-hide">
        <div>
          <p className="text-xs text-dojo-muted uppercase tracking-wider font-semibold">
            🥋 Orden de Actuación
          </p>
          <p className="text-sm text-dojo-white font-semibold mt-0.5">
            {sorted.length} competidor{sorted.length !== 1 ? "es" : ""}
          </p>
        </div>
        {locked && (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-900/20 text-green-400 border border-green-700/30">
            🔒 Confirmado
          </span>
        )}
      </div>

      {/* Participant list */}
      <div className="divide-y divide-dojo-border/40 rounded-xl overflow-hidden border border-dojo-border">
        {sorted.map((p, idx) => {
          const belt = p.student.beltHistory[0]?.beltColor ?? null;
          const isFirst  = idx === 0;
          const isLast   = idx === sorted.length - 1;

          return (
            <div
              key={p.id}
              className={[
                "flex items-center gap-3 px-4 py-3 transition-colors",
                isFirst ? "bg-dojo-gold/5" : "hover:bg-dojo-border/10",
              ].join(" ")}
            >
              {/* Order number */}
              <div className={[
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0",
                isFirst  ? "bg-dojo-gold text-black"
                : idx === 1 ? "bg-dojo-muted/30 text-dojo-muted"
                : idx === 2 ? "bg-orange-900/30 text-orange-400"
                : "bg-dojo-border/40 text-dojo-muted",
              ].join(" ")}>
                {p.seed}
              </div>

              {/* Avatar */}
              <Avatar photo={p.student.photo} name={p.student.fullName} />

              {/* Name + belt */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-dojo-white truncate">
                  {p.student.fullName}
                </p>
                {belt && (
                  <div className="mt-0.5">
                    <BeltBadge beltColor={belt} size="sm" />
                  </div>
                )}
              </div>

              {/* Position medal for print */}
              {isFirst && <span className="text-lg print-hide">🥇</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
