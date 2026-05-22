// Tokens JWT para acceso temporal de coaches externos.
// Usa NEXTAUTH_SECRET para firmar — sin NextAuth, validación propia.

import { SignJWT, jwtVerify } from "jose";

export interface CoachTokenPayload {
  clubId:       string;
  tournamentId: string;
  dojoId:       string;   // dojo anfitrión — SIEMPRE presente para aislamiento multi-tenant
  coachEmail:   string;
  type:         "coach_access";
}

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET no configurado");
  return new TextEncoder().encode(secret);
}

export async function generateCoachToken(payload: CoachTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("dojomanager-coach")
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function validateCoachToken(token: string): Promise<CoachTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "dojomanager-coach",
    });
    if (payload.type !== "coach_access") return null;
    return payload as unknown as CoachTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Helper para usar en el handler de cada API del coach.
 * Valida el token y retorna el payload o un error claro.
 */
export async function requireCoachToken(token: string): Promise<
  | { ok: true;  payload: CoachTokenPayload; error?: never }
  | { ok: false; payload: null;              error: string }
> {
  if (!token || token.length < 20) {
    return { ok: false, payload: null, error: "Token inválido" };
  }
  const payload = await validateCoachToken(token);
  if (!payload) {
    return { ok: false, payload: null, error: "Token expirado o inválido" };
  }
  if (!payload.dojoId || !payload.clubId || !payload.tournamentId) {
    return { ok: false, payload: null, error: "Token malformado" };
  }
  return { ok: true, payload };
}
