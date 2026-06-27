"use client";
import { useState } from "react";
import { Link2, Users } from "lucide-react";
import RegistrationLinksManager from "@/components/registros/RegistrationLinksManager";
import PendingStudentsQueue     from "@/components/registros/PendingStudentsQueue";

export default function RegistrosPage() {
  const [tab, setTab]       = useState<"links" | "queue">("queue");
  const [pending, setPending] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-dojo-white">Auto-registro</h1>
        <p className="text-dojo-muted text-sm mt-1">
          Genera links para que alumnos y padres envíen sus datos. Aprueba o rechaza cada solicitud antes de inscribirlos.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dojo-darker p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("queue")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "queue" ? "bg-dojo-card text-dojo-white shadow-sm" : "text-dojo-muted hover:text-dojo-white"
          }`}
        >
          <Users size={14} />
          Solicitudes pendientes
          {pending > 0 && (
            <span className="bg-dojo-red text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{pending}</span>
          )}
        </button>
        <button
          onClick={() => setTab("links")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "links" ? "bg-dojo-card text-dojo-white shadow-sm" : "text-dojo-muted hover:text-dojo-white"
          }`}
        >
          <Link2 size={14} />
          Mis enlaces
        </button>
      </div>

      {tab === "queue" && (
        <PendingStudentsQueue onCountChange={setPending} />
      )}
      {tab === "links" && (
        <RegistrationLinksManager />
      )}
    </div>
  );
}
