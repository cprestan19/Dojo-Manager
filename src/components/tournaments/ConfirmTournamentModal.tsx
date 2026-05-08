"use client";
import { Trophy, AlertTriangle, Mail } from "lucide-react";

interface PendingBracket { id: string; name: string }

interface Props {
  tournamentName: string;
  pendingBrackets: PendingBracket[];
  onConfirm:  () => void;
  onClose:    () => void;
  loading:    boolean;
}

export function ConfirmTournamentModal({
  tournamentName, pendingBrackets, onConfirm, onClose, loading,
}: Props) {
  const hasPending = pendingBrackets.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card max-w-lg w-full space-y-4 shadow-2xl z-10">

        <div className="flex items-center gap-3">
          <div className={[
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            hasPending ? "bg-yellow-500/10" : "bg-dojo-gold/10",
          ].join(" ")}>
            {hasPending
              ? <AlertTriangle size={20} className="text-yellow-400" />
              : <Trophy size={20} className="text-dojo-gold" />
            }
          </div>
          <div>
            <h2 className="font-display font-bold text-dojo-white">Confirmar Torneo</h2>
            <p className="text-xs text-dojo-muted truncate max-w-[280px]">{tournamentName}</p>
          </div>
        </div>

        {hasPending ? (
          /* Hay brackets sin confirmar */
          <div className="space-y-3">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-sm text-yellow-300 font-semibold mb-2">
                Faltan {pendingBrackets.length} bracket(s) por confirmar:
              </p>
              <ul className="space-y-1">
                {pendingBrackets.map(b => (
                  <li key={b.id} className="text-xs text-yellow-200/80 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                    {b.name}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs text-dojo-muted">
              Confirma todos los brackets antes de confirmar el torneo completo.
            </p>
            <button onClick={onClose} className="btn-secondary w-full">Cerrar</button>
          </div>
        ) : (
          /* Todos confirmados — listo para confirmar torneo */
          <div className="space-y-4">
            <p className="text-sm text-dojo-muted leading-relaxed">
              ¿Confirmar el torneo completo? Esto cerrará todos los brackets y{" "}
              <span className="text-dojo-white font-semibold">
                enviará el programa oficial con los brackets
              </span>{" "}
              a todos los participantes registrados.
            </p>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2">
              <Mail size={14} className="text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300">
                Los correos se envían de forma automática al confirmar. Asegúrate de que los
                participantes tengan correo registrado en su perfil.
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} disabled={loading} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Trophy size={15} />
                {loading ? "Confirmando..." : "Confirmar y Enviar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
