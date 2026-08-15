import { Wrench } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type SessionUser = { role?: string };

// Mantenimiento activo para todos MENOS sysadmin — el usuario quiere poder
// probar el módulo real en producción sin abrir la puerta a los demás
// mientras sigue "en mejora". El gate es la sesión NextAuth (login con
// usuario/contraseña) + rol; nunca un query param ni nada adivinable.
export default async function TournamentsProLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role;

  if (role === "sysadmin") return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md rounded-xl border border-dojo-gold/30 bg-dojo-gold/10 px-6 py-8 text-center">
        <Wrench size={28} className="mx-auto mb-3 text-dojo-gold" />
        <h2 className="mb-2 font-display text-lg font-semibold text-dojo-gold">
          Torneo Pro no está disponible por ahora
        </h2>
        <p className="text-sm text-dojo-white">
          Estamos mejorando este módulo. Vuelve a intentarlo más adelante.
        </p>
      </div>
    </div>
  );
}
