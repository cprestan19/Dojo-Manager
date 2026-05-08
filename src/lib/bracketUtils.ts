import type { BracketColor } from "@/lib/bracketColors";

/** Siguiente potencia de 2 mayor o igual a n */
export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Número de BYEs necesarios para completar el bracket */
export function byeCount(n: number): number {
  return nextPowerOf2(n) - n;
}

/** Asigna colores AKA/AO alternados a una lista de participantes */
export function assignInitialColors(
  participantIds: string[],
): Array<{ id: string; color: BracketColor }> {
  return participantIds.map((id, i) => ({
    id,
    color: i % 2 === 0 ? "AKA" : "AO",
  }));
}

/**
 * Resuelve conflicto de color: si ambos tienen el mismo color, p2 cambia.
 * Retorna los colores finales para p1 y p2.
 */
export function resolveColorConflict(
  p1Color: BracketColor,
  p2Color: BracketColor,
): { p1: BracketColor; p2: BracketColor } {
  if (p1Color !== p2Color) return { p1: p1Color, p2: p2Color };
  // Conflicto — p2 (último en llegar) cambia
  return { p1: p1Color, p2: p1Color === "AKA" ? "AO" : "AKA" };
}

/**
 * Recalcula los colores de toda la llave basándose en el slot:
 * participant1 → AKA, participant2 → AO, con resolución de conflictos.
 */
export function recalculateBracketColors(
  matches: Array<{
    matchNumber: number;
    participant1Id: string | null;
    participant2Id: string | null;
  }>,
): Record<string, BracketColor> {
  const colors: Record<string, BracketColor> = {};

  // Ordenar por matchNumber para procesar en orden
  const sorted = [...matches].sort((a, b) => a.matchNumber - b.matchNumber);

  for (const m of sorted) {
    const p1 = m.participant1Id;
    const p2 = m.participant2Id;

    const c1: BracketColor = p1 && colors[p1] ? colors[p1] : "AKA";
    const c2: BracketColor = p2 && colors[p2] ? colors[p2] : "AO";

    const resolved = resolveColorConflict(c1, c2);
    if (p1) colors[p1] = resolved.p1;
    if (p2) colors[p2] = resolved.p2;
  }

  return colors;
}
