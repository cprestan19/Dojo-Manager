/**
 * AKA (RED) / AO (BLUE) color assignment for karate tournament brackets.
 *
 * Rules:
 *  - Slot 1 of every match = AKA (red)
 *  - Slot 2 of every match = AO  (blue)
 *  - Conflict resolution: if a winner advancing into the next round would create
 *    a color clash (both AKA or both AO), the later-arriving competitor flips color.
 *
 * Since each match always has one P1 slot and one P2 slot, and we assign
 * AKA to P1 and AO to P2, conflicts can only arise if we track colors by
 * competitor identity rather than slot. This utility tracks BOTH approaches:
 *
 *  · getSlotColor   – instant, conflict-free (slot-based)
 *  · buildColorMap  – competitor-identity tracking with conflict resolution
 */

export type BracketColor = 'AKA' | 'AO';

export interface ColorCfg {
  bg:       string;   // solid background color
  dim:      string;   // dimmed version for loser
  label:    string;   // 'AKA' | 'AO'
  printBg:  string;   // light version for print
  contrast: string;   // darker text alternative (unused but kept for flexibility)
}

export const COLOR_CFG: Record<BracketColor, ColorCfg> = {
  AKA: { bg: '#CC0000', dim: '#7a0000', label: 'AKA', printBg: '#ffe5e5', contrast: '#CC0000' },
  AO:  { bg: '#0044CC', dim: '#002077', label: 'AO',  printBg: '#e5eeff', contrast: '#0044CC' },
};

export function opposite(c: BracketColor): BracketColor {
  return c === 'AKA' ? 'AO' : 'AKA';
}

/**
 * Instant slot-based color: participant1 = AKA, participant2 = AO.
 * Guaranteed conflict-free — the standard approach used throughout the bracket.
 */
export function getSlotColor(
  participantId: string,
  match: { participant1Id: string | null; participant2Id: string | null },
): BracketColor {
  return participantId === match.participant2Id ? 'AO' : 'AKA';
}

/**
 * Builds a full competitor→color map for the bracket applying the
 * conflict-resolution rule: when a winner advances and both competitors
 * in the destination match would have the same color, the later-arriving
 * one flips.
 *
 * Returns: Record<participantId, BracketColor>
 */
export function buildColorMap(
  matches: Array<{
    id: string;
    round: number;
    matchNumber: number;
    participant1Id: string | null;
    participant2Id: string | null;
    winnerId: string | null;
  }>,
): Record<string, BracketColor> {
  const colors: Record<string, BracketColor> = {};

  // Sort matches by round then matchNumber so we process in order
  const sorted = [...matches].sort(
    (a, b) => a.round !== b.round ? a.round - b.round : a.matchNumber - b.matchNumber,
  );

  for (const match of sorted) {
    const p1 = match.participant1Id;
    const p2 = match.participant2Id;

    // Assign slot-based colors if not already assigned (first time seeing this participant here)
    if (p1 && !colors[p1]) colors[p1] = 'AKA';
    if (p2 && !colors[p2]) colors[p2] = 'AO';

    // If both present and conflict, the later-arriving one (p2 if they advanced last) flips
    if (p1 && p2 && colors[p1] && colors[p2] && colors[p1] === colors[p2]) {
      // p2 is considered "later-arriving" (advances from even matchNumber)
      colors[p2] = opposite(colors[p2]);
    }
  }

  return colors;
}
