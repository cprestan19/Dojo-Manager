import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { deleteResource } from "@/lib/cloudinary";

type Params = { params: Promise<{ id: string }> };

// GET /api/exam-applications/[id]
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;

    const application = await prisma.examApplication.findFirst({
      where: { id, dojoId },
      include: {
        invitees: {
          select: {
            id:            true,
            studentId:     true,
            beltToPresent: true,
            response:      true,
            responseNote:  true,
            respondedAt:   true,
            paymentStatus: true,
            paidAt:        true,
            attended:      true,
            passed:        true,
            student: {
              select: {
                id:          true,
                fullName:    true,
                studentCode: true,
              },
            },
            certificate: {
              select: {
                id:        true,
                status:    true,
                pdfUrl:    true,
                issuedDate: true,
              },
            },
          },
          orderBy: { student: { fullName: "asc" } },
        },
      },
    });

    if (!application) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    return NextResponse.json(application);
  } catch (err) {
    console.error("GET /api/exam-applications/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PUT /api/exam-applications/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;

    const existing = await prisma.examApplication.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    if (existing.status === "FINALIZED") {
      return NextResponse.json({ error: "No se puede editar una postulación finalizada" }, { status: 400 });
    }

    const body = await req.json() as {
      title?:       string;
      location?:    string;
      examDate?:    string;
      examTime?:    string;
      deadline?:    string | null;
      amount?:      number;
      description?: string | null;
    };

    const updated = await prisma.examApplication.update({
      where: { id },
      data: {
        ...(body.title       != null ? { title:       body.title.trim() }       : {}),
        ...(body.location    != null ? { location:    body.location.trim() }    : {}),
        ...(body.examDate    != null ? { examDate:    new Date(body.examDate) }  : {}),
        ...(body.examTime    != null ? { examTime:    body.examTime.trim() }     : {}),
        ...(body.deadline    !== undefined ? { deadline: body.deadline ? new Date(body.deadline) : null } : {}),
        ...(body.amount      != null ? { amount:      body.amount }             : {}),
        ...(body.description !== undefined ? { description: body.description?.trim() ?? null } : {}),
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_APPLICATION_UPDATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamApplication",
      resourceId:   id,
      statusCode:   200,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/exam-applications/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/exam-applications/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const { id } = await params;

    const existing = await prisma.examApplication.findFirst({ where: { id, dojoId } });
    if (!existing) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    // Limpiar PDFs de Cloudinary antes de borrar (el schema cascade elimina los registros)
    const certs = await prisma.generatedCertificate.findMany({
      where:  { invitee: { applicationId: id } },
      select: { pdfPublicId: true },
    });
    await Promise.allSettled(
      certs.filter(c => c.pdfPublicId).map(c => deleteResource(c.pdfPublicId!, "image"))
    );

    await prisma.examApplication.delete({ where: { id } });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_APPLICATION_DELETED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamApplication",
      resourceId:   id,
      statusCode:   200,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/exam-applications/[id]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
