import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { sendResubmissionRequest } from "@/lib/email";

type SessionUser = { role?: string; dojoId?: string | null };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    if (role !== "admin" && role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const { id } = await params;
    const pending = await prisma.pendingStudent.findUnique({
      where:  { id },
      select: {
        dojoId: true, status: true, fullName: true,
        motherEmail: true, fatherEmail: true, primaryGuardian: true,
        registrationLinkId: true,
        registrationLink: {
          select: { token: true, dojo: { select: { name: true, email: true, phone: true, slogan: true, logo: true, ownerName: true } } },
        },
      },
    });

    if (!pending || pending.dojoId !== dojoId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    if (pending.status !== "pending") {
      return NextResponse.json({ error: "Esta solicitud ya fue procesada" }, { status: 409 });
    }

    const body = await req.json().catch(() => ({})) as { note?: string; notify?: boolean };
    const note   = typeof body.note === "string" ? body.note.trim() : null;
    const notify = body.notify === true;
    const reviewerId = (session.user as { id?: string }).id ?? "";

    await prisma.$transaction([
      prisma.pendingStudent.update({
        where: { id },
        data: {
          status:        "rejected",
          reviewedBy:    reviewerId,
          reviewedAt:    new Date(),
          rejectionNote: note || null,
          photo:         null, // Borrar foto biométrica del menor al rechazar
        },
      }),
      // Liberar el cupo del link para que el acudiente pueda volver a enviar
      prisma.registrationLink.update({
        where: { id: pending.registrationLinkId },
        data:  { useCount: { decrement: 1 } },
      }),
    ]);

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "PENDING_STUDENT_REJECTED",
      module:       AUDIT_MODULE.STUDENTS,
      resourceType: "PendingStudent",
      resourceId:   id,
      statusCode:   200,
      details:      JSON.stringify({ note: note ?? null, notify }),
    });

    // Enviar link de reenvío con ?reset=1 si el admin lo solicitó
    if (notify) {
      const primaryEmail = pending.primaryGuardian === "mother" ? pending.motherEmail :
                           pending.primaryGuardian === "father" ? pending.fatherEmail : null;
      const to = primaryEmail || pending.motherEmail || pending.fatherEmail;
      if (to) {
        const appUrl  = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
        const linkUrl = `${appUrl}/registro/${pending.registrationLink.token}?reset=1`;
        sendResubmissionRequest({
          to,
          studentName: pending.fullName,
          dojoName:    pending.registrationLink.dojo.name,
          linkUrl,
          dojo:        pending.registrationLink.dojo,
        }).catch(err => console.error("[reject] Resubmission email failed:", err));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/pending-students/[id]/reject error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
