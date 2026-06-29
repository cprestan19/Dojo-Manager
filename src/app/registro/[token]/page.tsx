import { notFound } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import RegistroForm from "./RegistroForm";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";

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
      id: true, dojoId: true, isActive: true, activatesAt: true, expiresAt: true, maxUses: true, useCount: true,
      dojo: { select: { name: true, logo: true, contractPolicy: true } },
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

  const dojoName       = link.dojo.name;
  const dojoLogo       = link.dojo.logo?.startsWith("http") ? link.dojo.logo : null;
  const expiresAt      = link.expiresAt?.toISOString() ?? null;
  const contractPolicy = link.dojo.contractPolicy ?? null;

  // Log form view (fire-and-forget — no bloquea el render)
  const h = await headers();
  const viewIp = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  logAudit({
    action:       "REGISTRATION_FORM_VIEWED",
    module:       AUDIT_MODULE.REGISTROS,
    dojoId:       link.dojoId,
    resourceType: "RegistrationLink",
    resourceId:   link.id,
    ip:           viewIp,
    userAgent:    h.get("user-agent"),
    details:      JSON.stringify({ reset: reset === "1" }),
  }).catch(() => {});

  return (
    <main className="min-h-screen bg-dojo-darker flex flex-col items-center justify-start p-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Form */}
        <div className="card">
          <RegistroForm
            token={token}
            dojoName={dojoName}
            dojoLogo={dojoLogo}
            expiresAt={expiresAt}
            reset={reset === "1"}
            contractPolicy={contractPolicy}
          />
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
