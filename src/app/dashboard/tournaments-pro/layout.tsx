import { Wrench } from "lucide-react";

export default function TournamentsProLayout({ children }: { children: React.ReactNode }) {
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
