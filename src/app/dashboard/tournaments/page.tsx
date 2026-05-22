import { redirect } from "next/navigation";

// La gestión de torneos está unificada en Torneo Pro
export default function TournamentsRedirect() {
  redirect("/dashboard/tournaments-pro");
}
