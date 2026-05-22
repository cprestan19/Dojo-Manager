"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// Todo el detalle del torneo está en Torneo Pro
export default function TournamentDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/tournaments-pro/${id}`);
  }, [id, router]);
  return (
    <div className="flex items-center justify-center h-32">
      <p className="text-dojo-muted text-sm animate-pulse">Redirigiendo a Torneo Pro...</p>
    </div>
  );
}
