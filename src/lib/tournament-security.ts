// Reglas de seguridad multi-tenant para torneos.
// Importar en TODAS las APIs de torneos para evitar acceso cruzado entre dojos.

import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";
import prisma from "@/lib/prisma";
import { timingSafeEqual } from "crypto";

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
 * Extrae la IP del cliente de la request. x-real-ip lo fija el edge de
 * Vercel (no falsificable); si no está, toma el ÚLTIMO valor de
 * x-forwarded-for — nunca el primero, que el cliente puede anteponer para
 * evadir el rate limit rotando IPs falsas.
 */
export function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "unknown";
}

// ── Comparación de PIN segura contra timing attacks ───────────

export function constantTimeStringEqual(expected: string, actual: unknown): boolean {
  if (typeof actual !== "string" || !actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── PIN de la App del Juez ────────────────────────────────────

/**
 * Verifica el PIN de jueces del torneo (Tournament.judgePin) contra el valor
 * recibido, con comparación segura contra timing attacks.
 *
 * Si el torneo aún no tiene judgePin configurado (torneos creados antes de
 * este control, o el admin no lo configuró), se permite el acceso — mismo
 * comportamiento que tenía la app del juez antes de este fix, para no
 * romper un torneo en curso. El admin debe configurar el PIN en la pestaña
 * Info del torneo para cerrar el hueco.
 */
export async function verifyJudgePin(tournamentId: string, pin: unknown): Promise<boolean> {
  const tournament = await prisma.tournament.findUnique({
    where:  { id: tournamentId },
    select: { judgePin: true },
  });
  if (!tournament) return false;
  if (!tournament.judgePin) return true;

  return constantTimeStringEqual(tournament.judgePin, pin);
}
