import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { sendResubmissionRequest } from "@/lib/email";

type SessionUser = { role?: string; dojoId?: string | null };
type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "admin" && role !== "sysadmin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const pending = await prisma.pendingStudent.findUnique({
      where:  { id },
      select: {
        id: true, dojoId: true, fullName: true,
        motherEmail: true, fatherEmail: true,
        registrationLink: {
          select: { token: true, label: true, dojo: { select: { name: true, email: true, phone: true, slogan: true, logo: true, ownerName: true } } },
        },
      },
    });

    if (!pending || pending.dojoId !== dojoId)
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const body = await req.json().catch(() => ({})) as { notify?: boolean };

    await prisma.pendingStudent.delete({ where: { id } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "PENDING_STUDENT_DELETED",
      module:       AUDIT_MODULE.STUDENTS,
      resourceType: "PendingStudent",
      resourceId:   id,
      statusCode:   200,
      details:      JSON.stringify({ fullName: pending.fullName, notify: !!body.notify }),
    });

    // Enviar solicitud de reenvío al padre/madre si se indicó
    if (body.notify) {
      const to = pending.motherEmail || pending.fatherEmail;
      if (to) {
        const appUrl  = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
        const linkUrl = `${appUrl}/registro/${pending.registrationLink.token}?reset=1`;
        sendResubmissionRequest({
          to,
          studentName: pending.fullName,
          dojoName:    pending.registrationLink.dojo.name,
          linkUrl,
          dojo:        pending.registrationLink.dojo,
        }).catch(err => console.error("[pending-students] Resubmission email failed:", err));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/pending-students/[id] error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
