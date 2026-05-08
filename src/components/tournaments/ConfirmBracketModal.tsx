"use client";
import { CheckCircle } from "lucide-react";

interface Props {
  bracketName: string;
  onConfirm:   () => void;
  onClose:     () => void;
  loading:     boolean;
}

export function ConfirmBracketModal({ bracketName, onConfirm, onClose, loading }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card max-w-md w-full space-y-4 shadow-2xl z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
            <CheckCircle size={20} className="text-green-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-dojo-white">Confirmar Bracket</h2>
            <p className="text-xs text-dojo-muted">{bracketName}</p>
          </div>
        </div>

        <p className="text-sm text-dojo-muted leading-relaxed">
          ¿Confirmar el bracket de{" "}
          <span className="text-dojo-white font-semibold">{bracketName}</span>?
          Una vez confirmado, no podrá editarse sin permisos de administrador.
        </p>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} disabled={loading} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <CheckCircle size={15} />
            {loading ? "Confirmando..." : "Confirmar Bracket"}
          </button>
        </div>
      </div>
    </div>
  );
}
