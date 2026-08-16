"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ArrowRight } from "lucide-react";

// Mismo mapeo visual (emoji/color/badge/CTA) que usa la sección de Planes
// del home (src/app/page.tsx, const PLAN_VISUAL) — para que se vean iguales.
// Precios/límites/features vienen de la BD via /api/public/plans, igual que
// en el home — no se hardcodean acá.
const GOLD = "#F59E0B";
const PRIMARY = "#C0392B";

type PlanVisual = { emoji: string; color: string; highlight: boolean; badge: string | null; cta: string };

const PLAN_VISUAL: Record<string, PlanVisual> = {
  "Academia": {
    emoji: "🥋", color: "#94A3B8", highlight: false, badge: null,
    cta: "Empezar con Academia",
  },
  "Academia y padres": {
    emoji: "🥈", color: GOLD, highlight: true, badge: "Más popular",
    cta: "Empezar con Academia y padres",
  },
  "Academia, padres y Torneo": {
    emoji: "🥇", color: "#F59E0B", highlight: false, badge: "Más completo",
    cta: "Empezar con el plan completo",
  },
};

const PLAN_VISUAL_DEFAULT: PlanVisual = {
  emoji: "⭐", color: PRIMARY, highlight: false, badge: null, cta: "Comenzar",
};

interface DbPlan {
  id: string; name: string; monthlyPrice: number; maxStudents: number | null; features: string;
}

/**
 * Carrusel deslizable por touch (una tarjeta centrada a la vez, con las
 * vecinas asomando en los bordes) — misma fuente (GET /api/public/plans) y
 * mismo estilo visual que el home. Puntitos abajo indican y permiten saltar
 * a cada plan; se sincronizan con el swipe vía scroll-snap + onScroll.
 */
export default function PlansCarousel() {
  const [plans,  setPlans]  = useState<DbPlan[]>([]);
  const [active, setActive] = useState(0);
  const trackRef  = useRef<HTMLDivElement>(null);
  const cardRefs  = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRaf = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/public/plans")
      .then(r => r.ok ? r.json() : [])
      .then((data: DbPlan[]) => { if (Array.isArray(data)) setPlans(data); })
      .catch(() => {});
  }, []);

  function handleScroll() {
    if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
    scrollRaf.current = requestAnimationFrame(() => {
      const track = trackRef.current;
      const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
      if (!track || !cards.length) return;
      const trackCenter = track.scrollLeft + track.clientWidth / 2;
      let closest = 0, closestDist = Infinity;
      cards.forEach((card, i) => {
        const dist = Math.abs((card.offsetLeft + card.offsetWidth / 2) - trackCenter);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      setActive(closest);
    });
  }

  function goTo(i: number) {
    const track = trackRef.current;
    const card  = cardRefs.current[i];
    if (!track || !card) return;
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior: "smooth" });
  }

  if (!plans.length) return null;

  return (
    <div className="max-w-xl mx-auto">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-8 pt-3 pb-2 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {plans.map((plan, i) => {
          const visual  = PLAN_VISUAL[plan.name] ?? PLAN_VISUAL_DEFAULT;
          const isFree  = plan.monthlyPrice === 0;
          const price   = isFree ? "$0" : `$${plan.monthlyPrice}`;
          const period  = isFree ? "gratis" : "/mes";
          const limit   = plan.maxStudents ? `Hasta ${plan.maxStudents} alumnos` : "Alumnos ilimitados";
          let features: string[] = [];
          try { features = JSON.parse(plan.features) as string[]; } catch { /* ignore */ }

          return (
            <div
              key={plan.id}
              ref={el => { cardRefs.current[i] = el; }}
              className="snap-center shrink-0 w-[74%] sm:w-[260px] rounded-2xl p-4 relative flex flex-col transition-opacity duration-300"
              style={{
                background: visual.highlight ? "#111827" : "#0D1117",
                border: `2px solid ${visual.highlight ? visual.color : "rgba(255,255,255,.08)"}`,
                boxShadow: visual.highlight ? `0 0 30px ${visual.color}25` : "none",
                opacity: active === i ? 1 : 0.4,
              }}
            >
              {visual.badge && (
                <span
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap text-white"
                  style={{ background: visual.color }}
                >
                  {visual.badge}
                </span>
              )}
              <div className="flex items-center gap-2 mb-2 mt-1">
                <span className="text-lg">{visual.emoji}</span>
                <span className="font-black text-sm" style={{ color: visual.color }}>{plan.name}</span>
              </div>
              <div className="flex items-end gap-1 mb-1">
                <span className="font-black text-2xl text-white leading-none">{price}</span>
                <span className="text-[11px] text-white/35 mb-0.5">{period}</span>
              </div>
              <p className="text-[11px] text-white/40 font-semibold mb-3">{limit}</p>
              <ul className="space-y-1.5 mb-3 flex-1">
                {features.map(f => (
                  <li key={f} className="flex items-start gap-1.5 text-[11px] text-white/65 leading-snug">
                    <Check size={11} style={{ color: visual.color }} className="shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
              <a
                href="#registro"
                className="flex items-center justify-center text-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                style={{
                  color:      visual.highlight ? "#fff" : visual.color,
                  background: visual.highlight ? visual.color : "transparent",
                  border:     visual.highlight ? "none" : `1.5px solid ${visual.color}60`,
                }}
              >
                {visual.cta} <ArrowRight size={12} />
              </a>
            </div>
          );
        })}
      </div>

      {/* Puntitos — reflejan la tarjeta activa y permiten saltar a cualquiera */}
      <div className="flex items-center justify-center gap-2 mt-3">
        {plans.map((plan, i) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Ver plan ${plan.name}`}
            className="h-2 rounded-full transition-all duration-300"
            style={{ width: active === i ? 20 : 8, background: active === i ? PRIMARY : "rgba(255,255,255,.2)" }}
          />
        ))}
      </div>
    </div>
  );
}
