"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

interface Plan {
  id:           string;
  name:         string;
  description:  string | null;
  monthlyPrice: number;
  annualPrice:  number;
  maxStudents:  number | null;
  features:     string; // JSON string
}

export function PlanSelector() {
  const router = useRouter();
  const [plans,    setPlans]    = useState<Plan[]>([]);
  const [cycle,    setCycle]    = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [paying,   setPaying]   = useState<string | null>(null);
  const [error,    setError]    = useState("");

  useEffect(() => {
    fetch("/api/billing/plans")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Plan[]) => setPlans(Array.isArray(data) ? data : []))
      .catch(e => setError(`Error al cargar planes: ${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  // First paid plan — used for annual discount badge
  const firstPaid = plans.find(p => p.monthlyPrice > 0);

  async function checkout(planId: string, gateway: "paypal" | "mercadopago") {
    setPaying(`${planId}-${gateway}`);
    setError("");
    try {
      const res = await fetch(`/api/billing/checkout/${gateway}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planId, cycle }),
      });
      const data = await res.json() as { approveUrl?: string; initPoint?: string; error?: string };
      if (!res.ok) { setError(data.error ?? "Error al procesar el pago"); return; }
      const url = data.approveUrl ?? data.initPoint;
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
          const isSelected = selected === plan.id;

          return (
            <div
              key={plan.id}
              className={`card border-2 transition-colors cursor-pointer ${
                isSelected ? "border-dojo-red" : "border-dojo-border hover:border-dojo-border/80"
              }`}
              onClick={() => setSelected(isSelected ? null : plan.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-display text-lg font-bold text-dojo-white">{plan.name}</h3>
                {cycle === "ANNUAL" && savings > 0 && (
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

              {isSelected && !isFree && (
                <div className="space-y-2 pt-3 border-t border-dojo-border">
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
                  <button
                    type="button"
                    disabled={paying !== null}
                    onClick={e => { e.stopPropagation(); void checkout(plan.id, "mercadopago"); }}
                    className="w-full btn-secondary text-sm justify-center disabled:opacity-50"
                  >
                    {paying === `${plan.id}-mercadopago`
                      ? <><Loader2 size={14} className="animate-spin" /> Procesando...</>
                      : "Pagar con MercadoPago"}
                  </button>
                </div>
              )}

              {isSelected && isFree && (
                <div className="pt-3 border-t border-dojo-border">
                  <p className="text-xs text-dojo-muted text-center">
                    El plan Bronce se activa automáticamente al registrar tu dojo.
                    Contacta a soporte si necesitas ajustar tu plan.
                  </p>
                </div>
              )}

              {!isSelected && (
                <button type="button" className="w-full btn-secondary text-sm justify-center mt-auto">
                  {isFree ? "Plan incluido" : "Seleccionar"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
