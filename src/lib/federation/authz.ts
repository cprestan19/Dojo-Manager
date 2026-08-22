import { randomInt } from "crypto";
import prisma from "@/lib/prisma";

// ── Vínculo padre/hijo entre dojos (Evaluaciones cross-dojo) ────────────────
// Única capa que decide si un dojo padre puede ver/tocar algo de un dojo
// hijo. Todo endpoint nuevo de federación (y cualquier endpoint futuro que
// exponga datos de un hijo a su padre, ej. candidatos de Evaluaciones) debe
// pasar por assertActiveParentAccess() — nunca reimplementar el check inline.
//
// Regla de negocio (confirmada por el dueño del producto): un dojo hijo solo
// puede tener UN padre vigente/pendiente a la vez. Un padre sí puede tener
// muchos hijos. Ver comentario en el modelo DojoParentLink (schema.prisma).

export const FEDERATION_GENERIC_ERROR = "Código inválido o expirado.";
export const FEDERATION_NO_LINK_ERROR = "No hay ninguna vinculación pendiente.";

// ── Código de invitación ─────────────────────────────────────────────────
// 10 dígitos numéricos, generado con crypto.randomInt (no Math.random).
// Regenerar sobreescribe el código anterior — el viejo deja de funcionar de
// inmediato porque la búsqueda es siempre por el valor actual de la columna.
export async function generateFederationCode(dojoId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(randomInt(1_000_000_000, 10_000_000_000)); // 10 dígitos, nunca empieza en 0
    const clash = await prisma.dojo.findUnique({ where: { federationCode: code }, select: { id: true } });
    if (clash) continue; // colisión (~1 en 9B) — reintenta con otro código
    await prisma.dojo.update({
      where: { id: dojoId },
      data:  { federationCode: code, federationCodeGeneratedAt: new Date() },
    });
    return code;
  }
  throw new Error("No se pudo generar un código único — intenta de nuevo.");
}

// ── Verificar código + crear solicitud PENDING ───────────────────────────
// Nunca revela si el código existe o no — mismo error genérico en todos los
// casos de rechazo (no permite enumerar códigos por fuerza bruta más allá
// del rate limit del middleware).
type VerifyResult =
  | { ok: true; childDojoId: string; childDojoName: string }
  | { ok: false; error: string };

export async function verifyAndRequestLink(
  parentDojoId: string,
  code: string,
  requestedByUserId: string,
): Promise<VerifyResult> {
  const trimmed = code.trim();
  if (!/^\d{10}$/.test(trimmed)) return { ok: false, error: FEDERATION_GENERIC_ERROR };

  const child = await prisma.dojo.findUnique({
    where:  { federationCode: trimmed },
    select: { id: true, name: true },
  });
  if (!child) return { ok: false, error: FEDERATION_GENERIC_ERROR };
  if (child.id === parentDojoId) return { ok: false, error: FEDERATION_GENERIC_ERROR }; // no auto-vinculación

  const existing = await prisma.dojoParentLink.findUnique({ where: { childDojoId: child.id } });

  if (existing && existing.status !== "REVOKED") {
    // Ya tiene un padre vigente o una solicitud pendiente (de este mismo
    // padre u otro) — el hijo debe revocar primero. No se distingue el motivo
    // exacto en el mensaje para no filtrar con quién está vinculado.
    return { ok: false, error: "Este dojo ya tiene una vinculación activa o pendiente." };
  }

  if (existing) {
    // Reutiliza la misma fila (estaba REVOKED) — nunca crea una segunda,
    // childDojoId es @unique.
    await prisma.dojoParentLink.update({
      where: { id: existing.id },
      data: {
        parentDojoId,
        status:      "PENDING",
        requestedAt: new Date(),
        requestedBy: requestedByUserId,
        acceptedAt:  null,
        acceptedBy:  null,
        revokedAt:   null,
        revokedBy:   null,
      },
    });
  } else {
    await prisma.dojoParentLink.create({
      data: {
        childDojoId: child.id,
        parentDojoId,
        status:      "PENDING",
        requestedBy: requestedByUserId,
      },
    });
  }

  return { ok: true, childDojoId: child.id, childDojoName: child.name };
}

// ── Aceptar (solo el hijo) ────────────────────────────────────────────────
type AcceptResult = { ok: true; parentDojoName: string } | { ok: false; error: string };

export async function acceptLink(childDojoId: string, acceptedByUserId: string): Promise<AcceptResult> {
  const link = await prisma.dojoParentLink.findUnique({
    where:  { childDojoId },
    select: { id: true, status: true, parent: { select: { name: true } } },
  });
  if (!link || link.status !== "PENDING") return { ok: false, error: FEDERATION_NO_LINK_ERROR };

  await prisma.dojoParentLink.update({
    where: { id: link.id },
    data:  { status: "ACTIVE", acceptedAt: new Date(), acceptedBy: acceptedByUserId },
  });
  return { ok: true, parentDojoName: link.parent.name };
}

// ── Revocar (solo el hijo, en cualquier estado PENDING/ACTIVE) ──────────────
// Corta acceso futuro de inmediato. Nunca borra la fila (queda como
// histórico REVOKED) ni toca resultados/puntajes ya registrados por el padre
// en otras tablas — eso está fuera del alcance de esta función a propósito.
type RevokeResult = { ok: true } | { ok: false; error: string };

export async function revokeLink(childDojoId: string, revokedByUserId: string): Promise<RevokeResult> {
  const link = await prisma.dojoParentLink.findUnique({
    where:  { childDojoId },
    select: { id: true, status: true },
  });
  if (!link || link.status === "REVOKED") return { ok: false, error: FEDERATION_NO_LINK_ERROR };

  await prisma.dojoParentLink.update({
    where: { id: link.id },
    data:  { status: "REVOKED", revokedAt: new Date(), revokedBy: revokedByUserId },
  });
  return { ok: true };
}

// ── Gate de autorización para endpoints futuros (ej. candidatos cross-dojo) ─
// Única función que debe usarse para decidir si parentDojoId puede ver/tocar
// datos de childDojoId. Nunca reimplementar este check con un
// "if (x.dojoId !== y)" inline en un endpoint — eso es solo UX, no seguridad.
export async function assertActiveParentAccess(parentDojoId: string, childDojoId: string): Promise<boolean> {
  const link = await prisma.dojoParentLink.findUnique({
    where:  { childDojoId },
    select: { parentDojoId: true, status: true },
  });
  return !!link && link.status === "ACTIVE" && link.parentDojoId === parentDojoId;
}
