import { redirect } from "next/navigation";

// El formulario de creación vive en /dashboard/tournaments-pro/new
export default function NewTournamentRedirect() {
  redirect("/dashboard/tournaments-pro/new");
}
