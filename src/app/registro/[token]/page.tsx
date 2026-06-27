import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import RegistroForm from "./RegistroForm";

interface Props {
  params:      Promise<{ token: string }>;
  searchParams: Promise<{ reset?: string }>;
}

export const dynamic = "force-dynamic";

export default async function RegistroPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { reset }  = await searchParams;

  const link = await prisma.registrationLink.findUnique({
    where:  { token },
    select: {
      id: true, isActive: true, activatesAt: true, expiresAt: true, maxUses: true, useCount: true,
      dojo: { select: { name: true } },
    },
  });

  const now = new Date();
  const isValid =
    link &&
    link.isActive &&
    (!link.activatesAt || link.activatesAt <= now) &&
    (!link.expiresAt   || link.expiresAt   >= now) &&
    (link.maxUses == null || link.useCount < link.maxUses);

  if (!isValid) {
    return (
      <main className="min-h-screen bg-dojo-darker flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold text-dojo-white font-display">Enlace no disponible</h1>
          <p className="text-dojo-muted text-sm">
            Este enlace de inscripción no está activo, ha expirado o ya no está disponible.
            Contacta al dojo para obtener un nuevo enlace.
          </p>
        </div>
      </main>
    );
  }

  const dojoName = link.dojo.name;

  return (
    <main className="min-h-screen bg-dojo-darker flex flex-col items-center justify-start p-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-dojo-white font-display">
            Inscripción en {dojoName}
          </h1>
          <p className="text-dojo-muted text-sm mt-1">
            Completa el formulario. El dojo revisará tu solicitud antes de activar tu cuenta.
          </p>
        </div>

        {/* Form */}
        <div className="card">
          <RegistroForm token={token} dojoName={dojoName} reset={reset === "1"} />
        </div>

        <p className="text-xs text-dojo-muted text-center mt-4">
          Powered by{" "}
          <a href="https://dojomasteronline.com" target="_blank" rel="noopener noreferrer"
            className="hover:text-dojo-white transition-colors">
            dojomasteronline.com
          </a>
        </p>
      </div>
    </main>
  );
}
