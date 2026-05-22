// Reglas de seguridad multi-tenant para torneos.
// Importar en TODAS las APIs de torneos para evitar acceso cruzado entre dojos.

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string; dojoId?: string | null; id?: string; email?: string };

// ── Rate limiting simple por IP ──────────────────────────────

const _rlMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Verifica que no se exceda el límite de peticiones por IP.
 * Returns true si la petición está dentro del límite.
 */
export function checkRateLimit(
  ip: string,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const mapKey = `${key}:${ip}`;
  const now    = Date.now();
  const entry  = _rlMap.get(mapKey);

  if (!entry || now > entry.resetAt) {
    _rlMap.set(mapKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ── Verificación de propiedad del torneo ─────────────────────

type OwnershipOk    = { ok: true;  dojoId: string; error?: never };
type OwnershipError = { ok: false; dojoId: null;   error: string };

/**
 * Verifica que el torneo pertenece al dojo activo del usuario autenticado.
 * Usar en TODA API admin que recibe tournamentId en la URL.
 * NUNCA confiar en el tournamentId del cliente — siempre validar contra la BD.
 */
export async function verifyTournamentOwnership(
  tournamentId: string,
  req: NextRequest,
): Promise<OwnershipOk | OwnershipError> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, dojoId: null, error: "No autenticado" };
  }

  const user    = session.user as SessionUser;
  const dojoId  = getEffectiveDojoId(user.role, user.dojoId, req);
  if (!dojoId) {
    return { ok: false, dojoId: null, error: "Sin contexto de dojo" };
  }

  const tournament = await prisma.tournament.findFirst({
    where:  { id: tournamentId, dojoId },
    select: { id: true, dojoId: true },
  });

  if (!tournament) {
    // Log intento de acceso cruzado sin revelar al cliente si el torneo existe
    console.warn(
      `[SECURITY] cross-dojo attempt: user=${user.id} tried tournament=${tournamentId} from dojo=${dojoId}`,
    );
    return { ok: false, dojoId: null, error: "Torneo no encontrado" };
  }

  return { ok: true, dojoId: tournament.dojoId };
}

/**
 * Verifica que el ExternalClub pertenece al torneo y dojo correctos.
 * Usar en APIs de gestión de clubs para evitar que admin A acceda al club de admin B.
 */
export async function verifyClubOwnership(
  clubId:       string,
  dojoId:       string,
  tournamentId: string,
): Promise<boolean> {
  const club = await prisma.externalClub.findFirst({
    where:  { id: clubId, dojoId, tournamentId },
    select: { id: true },
  });
  return !!club;
}

/**
 * Verifica que el ExternalAthlete pertenece al club y dojo correctos.
 * Usar en APIs del coach antes de editar o eliminar un atleta.
 */
export async function verifyAthleteOwnership(
  athleteId: string,
  clubId:    string,
  dojoId:    string,
): Promise<boolean> {
  const athlete = await prisma.externalAthlete.findFirst({
    where:  { id: athleteId, externalClubId: clubId, dojoId },
    select: { id: true },
  });
  return !!athlete;
}

/**
 * Extrae la IP del cliente de la request.
 * Usa x-forwarded-for cuando hay proxy/load balancer.
 */
export function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
