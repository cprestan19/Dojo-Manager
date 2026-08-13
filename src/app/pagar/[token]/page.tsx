import prisma from "@/lib/prisma";
import { logAudit, AUDIT_MODULE } from "@/lib/audit";
import { headers } from "next/headers";

interface Props {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

// Página pública enlazada desde el botón "Pagar ahora" del aviso de atraso
// por WhatsApp. No existe una pasarela de pago online para mensualidades en
// este sistema (el cobro lo cierra el dojo manualmente) — esta página es
// deliberadamente informativa: muestra el monto/vencimiento y un enlace
// directo a WhatsApp del dojo para coordinar el pago.
export default async function PagarPage({ params }: Props) {
  const { token } = await params;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const payment = await prisma.payment.findUnique({
    where: { payToken: token },
    select: {
      amount: true, dueDate: true, status: true,
      student: {
        select: {
          firstName: true,
          dojo: { select: { id: true, name: true, phone: true, email: true } },
        },
      },
    },
  });

  if (!payment) {
    await logAudit({
      action: "PAY_TOKEN_INVALID", module: AUDIT_MODULE.WHATSAPP,
      resourceType: "Payment", ip, statusCode: 404,
    });
    return (
      <main className="min-h-screen bg-dojo-darker flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-sm">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold text-dojo-white font-display">Enlace no disponible</h1>
          <p className="text-dojo-muted text-sm">
            Este enlace de pago no es válido. Comunícate directamente con tu dojo.
          </p>
        </div>
      </main>
    );
  }

  await logAudit({
    action: "PAY_TOKEN_VIEWED", module: AUDIT_MODULE.WHATSAPP,
    resourceType: "Payment", dojoId: payment.student.dojo.id, ip, statusCode: 200,
    details: JSON.stringify({ status: payment.status }),
  });

  const dojo    = payment.student.dojo;
  const isPaid  = payment.status === "paid";
  const dueDate = new Date(payment.dueDate).toLocaleDateString("es-PA", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  const waHref = dojo.phone
    ? `https://wa.me/${dojo.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hola, quiero coordinar el pago de mi mensualidad en ${dojo.name}.`,
      )}`
    : null;

  return (
    <main className="min-h-[100dvh] bg-dojo-darker flex items-center justify-center p-4">
      <div className="card max-w-sm w-full text-center space-y-5 p-6">
        <h1 className="text-lg font-bold text-dojo-white font-display">{dojo.name}</h1>

        {isPaid ? (
          <>
            <div className="text-5xl">✅</div>
            <p className="text-dojo-white font-semibold">Este pago ya fue registrado. ¡Gracias!</p>
          </>
        ) : (
          <>
            <div className="bg-dojo-card border border-dojo-border rounded-lg p-4 space-y-2">
              <p className="text-dojo-muted text-xs uppercase tracking-wide">Monto pendiente</p>
              <p className="text-3xl font-bold text-dojo-gold">${payment.amount.toFixed(2)}</p>
              <p className="text-dojo-muted text-xs">Vencimiento: {dueDate}</p>
            </div>
            <p className="text-dojo-muted text-sm">
              El pago se coordina directamente con el dojo — no se procesa en esta página.
            </p>
            {waHref && (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn-primary block">
                Escribir por WhatsApp al dojo
              </a>
            )}
            {dojo.email && (
              <p className="text-dojo-muted text-xs">o escribe a {dojo.email}</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
