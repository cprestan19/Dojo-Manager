/**
 * GET /api/superadmin/whatsapp-inbound
 * Lista las respuestas de WhatsApp de dueños de dojo (dojoId != null — ver
 * match en src/lib/whatsapp/webhookHandlers.ts) — incluye taps de los botones
 * de respuesta rápida del template ayuda_primer_alumno ("Sí, ayúdame" /
 * "Ya lo tengo controlado") y cualquier texto libre que respondan.
 * No incluye respuestas de acudientes de alumnos (studentId) — eso es un
 * inbox aparte, fuera del alcance de este panel de CRM.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string };

async function guardSysadmin(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };
  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return { error: NextResponse.json({ error: "Solo sysadmin puede acceder" }, { status: 403 }), session: null };
  return { error: null, session };
}

export async function GET(req: NextRequest) {
  const { error } = await guardSysadmin(req);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const handledParam = searchParams.get("handled");

  const messages = await prisma.whatsAppInboundMessage.findMany({
    where: {
      dojoId: { not: null },
      ...(handledParam !== null ? { handled: handledParam === "true" } : {}),
    },
    include: { dojo: { select: { name: true, phone: true } } },
    orderBy: { receivedAt: "desc" },
    take: 300,
  });

  return NextResponse.json(messages, { headers: { "Cache-Control": "no-store" } });
}
