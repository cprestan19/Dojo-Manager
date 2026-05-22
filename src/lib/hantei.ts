/**
 * Sistema Hantei (判定) — Decisión por empate en Kumite WKF
 *
 * Reglamento WKF 2024:
 * - Se llama cuando el combate termina empatado (mismo puntaje, sin senshu)
 * - El panel (árbitro + jueces) vota simultáneamente: AO (azul) o AKA (rojo)
 * - Gana quien tiene mayoría simple
 * - En empate 2-2: el árbitro principal decide (voto de desempate)
 */

export type HanteiVote = "ao" | "aka";

export interface HanteiResult {
  winnerId:    string | null;
  winnerSide:  "ao" | "aka" | null;
  votesAo:     number;
  votesAka:    number;
  method:      "majority" | "referee_tiebreak" | "insufficient_votes";
  description: string;
}

/** Tamaños de panel típicos por tipo de torneo */
export const HANTEI_PANEL_SIZES = {
  standard: 4,   // 1 árbitro + 3 jueces (torneos WKF federados)
  small:    3,   // 1 árbitro + 2 jueces (torneos locales)
  minimal:  1,   // Solo árbitro (exhibiciones / torneos muy pequeños)
} as const;

/**
 * Determina si un combate requiere Hantei.
 * Se requiere cuando:
 *   - No hay ganador por puntos (score1 === score2)
 *   - No hay senshu (nadie anotó primero)
 *   - No es un bye
 *   - No hay ya un ganador registrado
 */
export function requiresHantei(match: {
  score1:   number | null;
  score2:   number | null;
  senshu:   string | null;
  winnerId: string | null;
  isBye:    boolean;
}): boolean {
  if (match.isBye)     return false;
  if (match.winnerId)  return false;

  const s1 = match.score1 ?? 0;
  const s2 = match.score2 ?? 0;

  if (s1 !== s2)   return false; // hay ganador claro por puntos
  if (match.senshu) return false; // hay senshu — gana por esa regla

  return true; // empate total → Hantei
}

/**
 * Calcula el resultado del Hantei a partir de los votos registrados.
 *
 * @param votes        - Votos emitidos (pueden ser parciales si se fuerza el cierre)
 * @param participant1Id - ID del competidor AO (azul, posición 1)
 * @param participant2Id - ID del competidor AKA (rojo, posición 2)
 * @param totalExpected - Total de jueces esperados (default 4)
 * @param force        - Si true, calcula con los votos disponibles aunque falten jueces
 */
export function calculateHanteiResult(
  votes:           Array<{ vote: HanteiVote; isReferee: boolean }>,
  participant1Id:  string,
  participant2Id:  string,
  totalExpected:   number = 4,
  force:           boolean = false,
): HanteiResult | null {
  if (votes.length === 0) return null;

  // Si no está completo y no se fuerza, esperar
  if (!force && votes.length < totalExpected) return null;

  const votesAo  = votes.filter(v => v.vote === "ao").length;
  const votesAka = votes.filter(v => v.vote === "aka").length;

  // Mayoría clara
  if (votesAo > votesAka) {
    return {
      winnerId:    participant1Id,
      winnerSide:  "ao",
      votesAo, votesAka,
      method:      "majority",
      description: `AO gana por Hantei ${votesAo}-${votesAka}`,
    };
  }

  if (votesAka > votesAo) {
    return {
      winnerId:    participant2Id,
      winnerSide:  "aka",
      votesAo, votesAka,
      method:      "majority",
      description: `AKA gana por Hantei ${votesAka}-${votesAo}`,
    };
  }

  // Empate → árbitro decide
  const refereeVote = votes.find(v => v.isReferee);
  if (!refereeVote) {
    // Árbitro no votó todavía
    return null;
  }

  const winnerId = refereeVote.vote === "ao" ? participant1Id : participant2Id;
  return {
    winnerId,
    winnerSide:  refereeVote.vote,
    votesAo, votesAka,
    method:      "referee_tiebreak",
    description: `Empate ${votesAo}-${votesAka} — Árbitro decide por ${refereeVote.vote.toUpperCase()}`,
  };
}

/**
 * Texto para mostrar en pantalla TV y overlay OBS.
 */
export function getHanteiDisplayText(result: HanteiResult): string {
  if (!result.winnerId) return "HANTEI — En proceso";
  const side = result.winnerSide?.toUpperCase() ?? "";
  if (result.method === "referee_tiebreak") {
    return `${side} GANA POR HANTEI\nDecisión del árbitro (${result.votesAo}-${result.votesAka})`;
  }
  return `${side} GANA POR HANTEI\n${result.method === "majority"
    ? (result.winnerSide === "ao" ? result.votesAo : result.votesAka)
    : 0}-${result.method === "majority"
      ? (result.winnerSide === "ao" ? result.votesAka : result.votesAo)
      : 0} votos`;
}

/**
 * Los brackets Kumite siempre usan eliminación directa — Hantei obligatorio en empate.
 */
export function isBracketElimination(bracketType: string): boolean {
  return bracketType === "kumite";
}
