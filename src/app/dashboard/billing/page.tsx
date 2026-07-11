import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDojoSubscription, isDojoReadOnly } from "@/lib/billing/subscription";
import { SubscriptionStatus } from "@prisma/client";
import { CheckCircle2, AlertTriangle, Clock, CreditCard, RefreshCw } from "lucide-react";
import { PlanSelector } from "@/components/billing/PlanSelector";
import { InvoiceHistory } from "@/components/billing/InvoiceHistory";

type SessionUser = { role?: string; dojoId?: string | null };

const STATUS_BADGE: Record<string, string> = {
  TRIAL:         "badge-blue",
  ACTIVE:        "badge-green",
  PAST_DUE:      "badge-yellow",
  CANCELED:      "badge-red",
  READ_ONLY:     "badge-red",
  COMPLIMENTARY: "bg-dojo-gold/20 text-dojo-gold border border-dojo-gold/40 px-2 py-0.5 rounded-full text-xs font-semibold",
};

const STATUS_LABEL: Record<string, string> = {
  TRIAL:         "Período de prueba",
  ACTIVE:        "Activa",
  PAST_DUE:      "Pago pendiente",
  CANCELED:      "Cancelada",
  READ_ONLY:     "Solo lectura",
  COMPLIMENTARY: "Acceso especial",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  TRIAL:         Clock,
  ACTIVE:        CheckCircle2,
  PAST_DUE:      AlertTriangle,
  CANCELED:      AlertTriangle,
  READ_ONLY:     AlertTriangle,
  COMPLIMENTARY: CreditCard,
};

const GATEWAY_LABEL: Record<string, string> = {
  PAYPAL:       "PayPal",
  MERCADOPAGO:  "MercadoPago",
  PAGUELOFACIL: "PagueloFacil",
};

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;

  // Solo el sysadmin de dojomasteronline puede acceder a facturación
  if (role !== "sysadmin") redirect("/dashboard");

  // Resolve effective dojoId (sysadmin uses sx-dojo cookie)
  const cookieStore = await cookies();
  const dojoId = role === "sysadmin"
    ? (cookieStore.get("sx-dojo")?.value ?? null)
    : (sessionDojoId ?? null);

  if (!dojoId) {
    return (
      <div className="space-y-4 max-w-4xl">
        <h1 className="font-display text-2xl font-bold text-dojo-white">Facturación</h1>
        <div className="card text-center py-10">
          <CreditCard size={32} className="mx-auto mb-2 text-dojo-muted opacity-40" />
          <p className="text-dojo-muted text-sm">Selecciona un dojo para ver la facturación.</p>
        </div>
      </div>
    );
  }

  const sub      = await getDojoSubscription(dojoId);
  const readOnly = sub ? await isDojoReadOnly(dojoId) : false;

  const isComplimentary = sub?.status === SubscriptionStatus.COMPLIMENTARY;
  const isInTrial       = sub?.status === SubscriptionStatus.TRIAL;
  const isActive        = sub?.status === SubscriptionStatus.ACTIVE;

  const StatusIcon = sub?.status ? (STATUS_ICON[sub.status] ?? CreditCard) : CreditCard;
  // No mostrar planes si tiene acceso especial o está activo
  const showPlans  = !isComplimentary && (!sub || isInTrial || readOnly || sub.status === SubscriptionStatus.CANCELED);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-dojo-white mb-1">Facturación</h1>
        <p className="text-dojo-muted text-sm">Gestiona tu suscripción y consulta el historial de facturas.</p>
      </div>

      {/* ── Sección 1 — Estado actual ──────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-dojo-border/60 text-dojo-muted">
              <StatusIcon size={20} />
            </div>
            <div>
              <p className="text-xs text-dojo-muted font-medium uppercase tracking-wider">
                Estado de suscripción
              </p>
              <p className="font-semibold text-lg text-dojo-white">
                {sub?.status ? (STATUS_LABEL[sub.status] ?? sub.status) : "Sin suscripción"}
              </p>
            </div>
          </div>
          {sub?.status && (
            <span className={STATUS_BADGE[sub.status] ?? "text-dojo-muted"}>
              {STATUS_LABEL[sub.status] ?? sub.status}
            </span>
          )}
        </div>

        {/* Read-only warning */}
        {readOnly && (
          <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3">
            <p className="text-amber-300 font-medium text-sm flex items-center gap-2">
              <AlertTriangle size={14} /> Tu dojo está en modo lectura.
            </p>
            <p className="text-amber-400/70 text-xs mt-1">
              No puedes crear ni editar datos hasta que reactives tu suscripción.
            </p>
          </div>
        )}

        {/* Active subscription details */}
        {sub && isActive && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-dojo-border">
            {sub.plan && (
              <div>
                <p className="text-xs text-dojo-muted">Plan activo</p>
                <p className="text-dojo-white font-semibold">{sub.plan.name}</p>
              </div>
            )}
            {sub.currentPeriodEnd && (
              <div>
                <p className="text-xs text-dojo-muted">Próxima renovación</p>
                <p className="text-dojo-white font-semibold">
                  {sub.currentPeriodEnd.toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "2-digit", year: "numeric" })}
                </p>
              </div>
            )}
            {sub.gateway && (
              <div>
                <p className="text-xs text-dojo-muted">Pasarela de pago</p>
                <p className="text-dojo-white font-semibold">
                  {GATEWAY_LABEL[sub.gateway] ?? sub.gateway}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sección 2 — Planes disponibles ───────────────────────── */}
      {showPlans && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-dojo-gold" />
            <h2 className="font-display text-lg font-bold text-dojo-white">
              {isInTrial ? "Elige tu plan" : readOnly ? "Reactivar suscripción" : "Planes disponibles"}
            </h2>
          </div>
          <PlanSelector />
        </div>
      )}

      {/* ── Sección 3 — Historial de facturas ─────────────────────── */}
      <div className="space-y-4">
        <h2 className="font-display text-lg font-bold text-dojo-white">Historial de facturas</h2>
        <InvoiceHistory />
      </div>
    </div>
  );
}
