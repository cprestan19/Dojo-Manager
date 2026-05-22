/**
 * Distribución de participantes en brackets respetando seeds WKF.
 *
 * Regla: los atletas con rankingSeed no se enfrentan entre sí hasta semifinal.
 * - Seed 1 y Seed 2: cuartos opuestos → se enfrentan en la FINAL
 * - Seed 3 y Seed 4: cuartos opuestos → se enfrentan en SEMIFINAL
 */

// Posiciones fijas por tamaño de bracket (posición 1 = primer slot)
const SEED_POSITIONS: Record<number, Record<number, number>> = {
  4:  { 1: 1, 2: 4 },
  8:  { 1: 1, 2: 8, 3: 5, 4: 4 },
  16: { 1: 1, 2: 16, 3: 9, 4: 8 },
  32: { 1: 1, 2: 32, 3: 17, 4: 16 },
  64: { 1: 1, 2: 64, 3: 33, 4: 32 },
};

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Distribuye participantes en las posiciones del bracket.
 * Los seeds 1-4 van a posiciones fijas; el resto se distribuye aleatoriamente.
 *
 * @param participants - Lista de participantes con su ID y seed (0 = sin seed)
 * @param bracketSize  - Tamaño del bracket (debe ser potencia de 2)
 * @returns Array ordenado por posición (1..bracketSize), solo incluye IDs con participantes
 */
export function distributeParticipantsWithSeeds(
  participants: Array<{ id: string; seed: number }>,
  bracketSize: number,
): Array<{ id: string; position: number }> {
  const seeded   = participants.filter(p => p.seed > 0).sort((a, b) => a.seed - b.seed);
  const unseeded = shuffleArray(participants.filter(p => p.seed === 0));

  const positions = SEED_POSITIONS[bracketSize] ?? {};
  const result: Array<{ id: string; position: number }> = [];
  const usedPositions = new Set<number>();

  // Colocar seeds en posiciones fijas
  for (const s of seeded) {
    const pos = positions[s.seed];
    if (pos && !usedPositions.has(pos)) {
      result.push({ id: s.id, position: pos });
      usedPositions.add(pos);
    } else {
      // Seed > 4 o posición ya ocupada → tratar como no-seed
      unseeded.push(s);
    }
  }

  // Llenar posiciones restantes con no-seeds en orden aleatorio
  let nextPos = 1;
  for (const u of unseeded) {
    while (usedPositions.has(nextPos)) nextPos++;
    if (nextPos > bracketSize) break;
    result.push({ id: u.id, position: nextPos });
    usedPositions.add(nextPos);
    nextPos++;
  }

  return result.sort((a, b) => a.position - b.position);
}
