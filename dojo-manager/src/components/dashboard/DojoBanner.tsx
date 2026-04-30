"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, LogOut, Loader2 } from "lucide-react";
import { useAppContext } from "@/lib/context/AppContext";

interface Props {
  dojoName: string;
}

export function DojoBanner({ dojoName }: Props) {
  const router        = useRouter();
  const { refreshPerms } = useAppContext();
  const [busy, setBusy]  = useState(false);

  async function exit() {
    setBusy(true);
    await fetch("/api/sysadmin/exit-dojo", { method: "POST" });
    refreshPerms(); // update sidebar nav items immediately
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-2 text-sm shrink-0"
      style={{ background: "#1A0A00", borderBottom: "1px solid rgba(229,57,53,0.35)" }}
    >
      <div className="flex items-center gap-2">
        <Building2 size={14} className="text-dojo-red shrink-0" />
        <span style={{ color: "#F59E0B" }} className="font-semibold">Mantenimiento:</span>
        <span className="text-white">{dojoName}</span>
      </div>
      <button
        onClick={exit}
        disabled={busy}
        className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg border border-dojo-red/40 text-dojo-red hover:bg-dojo-red/10 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
        Salir del Dojo
      </button>
    </div>
  );
}
