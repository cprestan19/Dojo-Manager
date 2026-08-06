// Generación de llave por pools (round-robin, todos-contra-todos) — alternativa
// a la eliminación simple para brackets de kumite. Un pool = un grupo donde
// cada atleta enfrenta a todos los demás del mismo grupo una vez.

export interface PoolAssignment {
  participantId: string;
  poolNumber: number;
}

/**
 * Distribuye participantes en N pools tipo "serpiente" (1,2,3,...N,N,...3,2,1,1,2,...)
 * para que, si vienen ordenados por seed, los mejores sembrados queden repartidos
 * entre pools distintos en vez de acumulados en el primero.
 */
export function assignPools(participantIds: string[], poolCount: number): PoolAssignment[] {
  const n = Math.max(1, poolCount);
  const result: PoolAssignment[] = [];
  let pool = 0;
  let direction = 1;
  for (const participantId of participantIds) {
    result.push({ participantId, poolNumber: pool + 1 });
    if (n > 1) {
      pool += direction;
      if (pool === n - 1 || pool === 0) direction *= -1;
    }
  }
  return result;
}

export interface PoolMatch {
  poolNumber: number;
  matchNumber: number;
  participant1Id: string;
  participant2Id: string;
}

/** Genera todos los combates posibles (todos contra todos) dentro de un pool. */
export function generatePoolMatches(poolNumber: number, participantIds: string[]): PoolMatch[] {
  const matches: PoolMatch[] = [];
  let matchNumber = 1;
  for (let i = 0; i < participantIds.length; i++) {
    for (let j = i + 1; j < participantIds.length; j++) {
      matches.push({ poolNumber, matchNumber: matchNumber++, participant1Id: participantIds[i], participant2Id: participantIds[j] });
    }
  }
  return matches;
}

export interface StandingsRow {
  participantId: string;
  poolNumber: number;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  rank: number;
}

export interface StandingsMatchLike {
  poolNumber: number | null;
  participant1Id: string | null;
  participant2Id: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  isBye: boolean;
}

/**
 * Calcula la tabla de posiciones de cada pool a partir de los combates ya
 * jugados (winnerId asignado). Orden: victorias desc, luego diferencial de
 * puntos desc. Sin desempate por enfrentamiento directo en esta versión.
 */
export function computeStandings(
  participantsByPool: Record<number, string[]>,
  matches: StandingsMatchLike[],
): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();
  for (const [poolStr, ids] of Object.entries(participantsByPool)) {
    const poolNumber = Number(poolStr);
    for (const participantId of ids) {
      rows.set(participantId, {
        participantId, poolNumber, played: 0, wins: 0, losses: 0,
        pointsFor: 0, pointsAgainst: 0, pointsDiff: 0, rank: 0,
      });
    }
  }

  for (const m of matches) {
    if (m.isBye || !m.participant1Id || !m.participant2Id || !m.winnerId) continue;
    const r1 = rows.get(m.participant1Id);
    const r2 = rows.get(m.participant2Id);
    if (!r1 || !r2) continue;
    const s1 = m.score1 ?? 0, s2 = m.score2 ?? 0;
    r1.played++; r2.played++;
    r1.pointsFor += s1; r1.pointsAgainst += s2;
    r2.pointsFor += s2; r2.pointsAgainst += s1;
    if (m.winnerId === m.participant1Id) { r1.wins++; r2.losses++; }
    else { r2.wins++; r1.losses++; }
  }

  const all = Array.from(rows.values());
  for (const r of all) r.pointsDiff = r.pointsFor - r.pointsAgainst;

  // Rankear dentro de cada pool
  const byPool = new Map<number, StandingsRow[]>();
  for (const r of all) {
    if (!byPool.has(r.poolNumber)) byPool.set(r.poolNumber, []);
    byPool.get(r.poolNumber)!.push(r);
  }
  for (const poolRows of byPool.values()) {
    poolRows.sort((a, b) => b.wins - a.wins || b.pointsDiff - a.pointsDiff);
    poolRows.forEach((r, i) => { r.rank = i + 1; });
  }

  return all.sort((a, b) => a.poolNumber - b.poolNumber || a.rank - b.rank);
}
