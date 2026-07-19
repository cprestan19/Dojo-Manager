"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, Loader2 } from "lucide-react";

const PAGUELOFACIL_SANDBOX = process.env.NEXT_PUBLIC_PAGUELOFACIL_MODE !== "production";

// PayPal aún no está listo para producción — se oculta del selector sin
// borrar la integración. checkout(planId, "paypal") sigue funcionando si
// se reactiva este flag más adelante.
const PAYPAL_ENABLED = false;

const WA_SUPPORT_NUMBER = "50766261768";
function buildDowngradeWhatsApp(fromPlan: string, toPlan: string): string {
  const text = `Hola, quiero bajar mi dojo del plan "${fromPlan}" al plan "${toPlan}". ¿Me ayudan con el cambio?`;
  return `https://wa.me/${WA_SUPPORT_NUMBER}?text=${encodeURIComponent(text)}`;
}

interface Plan {
  id:           string;
  name:         string;
  description:  string | null;
  monthlyPrice: number;
  annualPrice:  number;
  maxStudents:  number | null;
  features:     string; // JSON string
  isActive:     boolean;
}

interface PlanSelectorProps {
  /** Plan actualmente contratado — null si el dojo nunca pagó (trial sin plan previo). */
  currentPlanId?: string | null;
}

export function PlanSelector({ currentPlanId = null }: PlanSelectorProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isSysadmin = (session?.user as { role?: string } | undefined)?.role === "sysadmin";
  const [plans,    setPlans]    = useState<Plan[]>([]);
  const [cycle,    setCycle]    = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [paying,   setPaying]   = useState<string | null>(null);
  const [error,    setError]    = useState("");
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    fetch("/api/billing/plans")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Plan[]) => setPlans(Array.isArray(data) ? data.filter(p => p.isActive) : []))
      .catch(e => setError(`Error al cargar planes: ${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  // First paid plan — used for annual discount badge
  const firstPaid = plans.find(p => p.monthlyPrice > 0);

  // Plan contratado actualmente — si no aparece (ej. plan legado ya
  // desactivado), no se puede comparar y cada tarjeta se trata como venta nueva.
  const currentPlan = currentPlanId ? plans.find(p => p.id === currentPlanId) ?? null : null;

  async function checkout(planId: string, gateway: "paypal" | "paguelofacil") {
    setPaying(`${planId}-${gateway}`);
    setError("");
    try {
      const res = await fetch(`/api/billing/checkout/${gateway}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planId, cycle }),
      });
      const data = await res.json() as { approveUrl?: string; url?: string; trial?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Error al procesar el pago"); return; }
      if (data.trial) { setActivated(true); router.refresh(); return; }
      const url = data.approveUrl ?? data.url;
      if (url) router.push(url);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setPaying(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={28} className="animate-spin text-dojo-muted" />
      </div>
    );
  }

  if (plans.length === 0) {
    return <p className="text-dojo-muted text-sm">No hay planes disponibles.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Cycle toggle */}
      <div className="flex items-center gap-1 bg-dojo-dark border border-dojo-border rounded-lg p-1 w-fit">
        {(["MONTHLY", "ANNUAL"] as const).map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCycle(c)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              cycle === c ? "bg-dojo-red text-white" : "text-dojo-muted hover:text-dojo-white"
            }`}
          >
            {c === "MONTHLY" ? "Mensual" : "Anual"}
            {c === "ANNUAL" && firstPaid && firstPaid.monthlyPrice > 0 && (
              <span className="ml-1.5 text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">
                -{Math.round((1 - firstPaid.annualPrice / (firstPaid.monthlyPrice * 12)) * 100)}%
              </span>
            )}
          </button>
        ))}
      </div>

      {activated && (
        <p className="text-sm text-green-400 bg-green-900/20 border border-green-800/40 rounded-lg px-3 py-2">
          Tu suscripción quedó activada.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map(plan => {
          const isFree    = plan.monthlyPrice === 0;
          const price     = cycle === "MONTHLY" ? plan.monthlyPrice : plan.annualPrice;
          const savings   = (!isFree && plan.monthlyPrice > 0)
            ? Math.round((1 - plan.annualPrice / (plan.monthlyPrice * 12)) * 100)
            : 0;
          let features: string[] = [];
          try { features = JSON.parse(plan.features) as string[]; } catch { /* ignore */ }
          const isSelected  = selected === plan.id;
          const isCurrent   = !!currentPlan && currentPlan.id === plan.id;
          const isDowngrade = !!currentPlan && !isCurrent && plan.monthlyPrice < currentPlan.monthlyPrice;

          return (
            <div
              key={plan.id}
              className={`card border-2 transition-colors cursor-pointer ${
                isCurrent ? "border-dojo-gold" : isSelected ? "border-dojo-red" : "border-dojo-border hover:border-dojo-border/80"
              }`}
              onClick={() => setSelected(isSelected ? null : plan.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-display text-lg font-bold text-dojo-white">{plan.name}</h3>
                {isCurrent ? (
                  <span className="text-[10px] font-bold bg-dojo-gold/20 text-dojo-gold px-2 py-0.5 rounded-full">
                    Plan actual
                  </span>
                ) : cycle === "ANNUAL" && savings > 0 && (
                  <span className="text-[10px] font-bold bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                    Ahorra {savings}%
                  </span>
                )}
              </div>

              {plan.description && (
                <p className="text-xs text-dojo-muted mb-3">{plan.description}</p>
              )}

              <div className="mb-4">
                {isFree ? (
                  <span className="text-3xl font-bold text-green-400">Gratis</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-dojo-white">${price.toFixed(0)}</span>
                    <span className="text-dojo-muted text-sm ml-1">/ {cycle === "MONTHLY" ? "mes" : "año"}</span>
                  </>
                )}
              </div>

              <ul className="space-y-1.5 mb-4">
                {features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-dojo-muted">
                    <Check size={12} className="text-green-400 shrink-0" /> {f}
                  </li>
                ))}
                <li className="flex items-center gap-2 text-xs text-dojo-muted">
                  <Check size={12} className="text-green-400 shrink-0" />
                  {plan.maxStudents ? `Hasta ${plan.maxStudents} alumnos` : "Alumnos ilimitados"}
                </li>
              </ul>

              {isSelected && isCurrent && (
                <div className="pt-3 border-t border-dojo-border">
                  <p className="text-xs text-dojo-muted text-center">
                    Ya tienes este plan activo.
                  </p>
                </div>
              )}

              {isSelected && !isCurrent && !isFree && isDowngrade && (
                <div className="pt-3 border-t border-dojo-border space-y-2">
                  <p className="text-xs text-dojo-muted text-center">
                    Para bajar de plan te ayudamos por WhatsApp — no queremos cobrarte de más
                    ni cancelar tu suscripción actual sin confirmarlo contigo primero.
                  </p>
                  <a
                    href={buildDowngradeWhatsApp(currentPlan?.name ?? "actual", plan.name)}
                    target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="w-full btn-secondary text-sm justify-center flex items-center gap-2"
                  >
                    Bajar a {plan.name} por WhatsApp
                  </a>
                </div>
              )}

              {isSelected && !isCurrent && !isFree && !isDowngrade && (
                <div className="space-y-2 pt-3 border-t border-dojo-border">
                  {PAYPAL_ENABLED && (
                    <button
                      type="button"
                      disabled={paying !== null}
                      onClick={e => { e.stopPropagation(); void checkout(plan.id, "paypal"); }}
                      className="w-full btn-primary text-sm justify-center disabled:opacity-50"
                    >
                      {paying === `${plan.id}-paypal`
                        ? <><Loader2 size={14} className="animate-spin" /> Procesando...</>
                        : "Pagar con PayPal"}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={paying !== null}
                    onClick={e => { e.stopPropagation(); void checkout(plan.id, "paguelofacil"); }}
                    className="w-full btn-primary text-sm justify-center disabled:opacity-50"
                  >
                    {paying === `${plan.id}-paguelofacil`
                      ? <><Loader2 size={14} className="animate-spin" /> Procesando...</>
                      : "Pagar con PagueloFacil (Visa/Mastercard)"}
                  </button>
                  {isSysadmin && PAGUELOFACIL_SANDBOX && (
                    <p className="text-[10px] text-center text-amber-400/80">
                      Ambiente de pruebas — PagueloFacil Sandbox
                    </p>
                  )}
                </div>
              )}

              {isSelected && isFree && (
                <div className="pt-3 border-t border-dojo-border">
                  <p className="text-xs text-dojo-muted text-center">
                    Este plan se activa automáticamente al registrar tu dojo, con 1 mes gratis.
                    Contacta a soporte si necesitas ajustar tu plan.
                  </p>
                </div>
              )}

              {!isSelected && (
                <button type="button" className="w-full btn-secondary text-sm justify-center mt-auto disabled:opacity-60"
                  disabled={isCurrent}>
                  {isCurrent ? "Plan actual" : isFree ? "Plan incluido" : isDowngrade ? "Bajar a este plan" : "Seleccionar"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
