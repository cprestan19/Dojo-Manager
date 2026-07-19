"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Eye, LogOut, Loader2, Receipt } from "lucide-react";
import { useAppContext } from "@/lib/context/AppContext";

interface Props {
  dojoName: string;
  mode:     "maintenance" | "preview";
}

export function DojoBanner({ dojoName, mode }: Props) {
  const router        = useRouter();
  const { refreshPerms, refreshDojo } = useAppContext();
  const [busy, setBusy]  = useState(false);
  const isPreview = mode === "preview";

  async function exit() {
    setBusy(true);
    await fetch("/api/sysadmin/exit-dojo", { method: "POST" });
    refreshPerms(); // update sidebar nav items immediately
    refreshDojo();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-2 text-sm shrink-0"
      style={isPreview
        ? { background: "#0A1A2A", borderBottom: "1px solid rgba(59,130,246,0.35)" }
        : { background: "#1A0A00", borderBottom: "1px solid rgba(229,57,53,0.35)" }
      }
    >
      <div className="flex items-center gap-2">
        {isPreview
          ? <Eye size={14} className="text-blue-400 shrink-0" />
          : <Building2 size={14} className="text-dojo-red shrink-0" />
        }
        <span style={{ color: isPreview ? "#60A5FA" : "#F59E0B" }} className="font-semibold">
          {isPreview ? "Vista previa:" : "Mantenimiento:"}
        </span>
        <span className="text-white">{dojoName}</span>
        {isPreview && (
          <span className="text-xs text-white/40">— viendo como lo vería el admin del dojo</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* SISTEMA (incl. Pagos SaaS) se oculta en Vista Previa para que se
            vea exactamente lo que ve el admin real — este acceso directo es
            chrome exclusivo de sysadmin (nunca lo ve el admin), así que no
            rompe esa vista previa. */}
        {isPreview && (
          <Link
            href="/dashboard/superadmin/billing"
            className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <Receipt size={12} /> Pagos SaaS
          </Link>
        )}
        <button
          onClick={exit}
          disabled={busy}
          className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
            isPreview
              ? "border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
              : "border-dojo-red/40 text-dojo-red hover:bg-dojo-red/10"
          }`}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
          {isPreview ? "Salir de la vista previa" : "Salir del Dojo"}
        </button>
      </div>
    </div>
  );
}
