import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

// GET /api/exam-applications — lista postulaciones del dojo
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null; id?: string };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const statusFilter = req.nextUrl.searchParams.get("status");
    const view         = req.nextUrl.searchParams.get("view"); // "active" | "history"
    const now          = new Date();

    // Filtro por vista: activas vs historial
    // Activas  : archivedAt IS NULL AND examDate >= hoy
    // Historial: archivedAt IS NOT NULL OR examDate < hoy
    let viewWhere: Record<string, unknown> = {};
    if (view === "active") {
      viewWhere = { archivedAt: null, examDate: { gte: now } };
    } else if (view === "history") {
      viewWhere = { OR: [{ archivedAt: { not: null } }, { examDate: { lt: now } }] };
    }

    const applications = await prisma.examApplication.findMany({
      where: {
        dojoId,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...viewWhere,
      },
      orderBy: { examDate: "desc" },
      select: {
        id:          true,
        title:       true,
        location:    true,
        examDate:    true,
        examTime:    true,
        deadline:    true,
        amount:      true,
        status:      true,
        archivedAt:  true,
        createdAt:   true,
        _count: { select: { invitees: true } },
        invitees: { select: { response: true } },
      },
    });

    const result = applications.map(a => {
      const accepted = a.invitees.filter(i => i.response === "ACCEPTED").length;
      const rejected = a.invitees.filter(i => i.response === "REJECTED").length;
      const pending  = a.invitees.filter(i => i.response === "PENDING").length;
      return {
        id:          a.id,
        title:       a.title,
        location:    a.location,
        examDate:    a.examDate,
        examTime:    a.examTime,
        deadline:    a.deadline,
        amount:      a.amount,
        status:      a.status,
        archivedAt:  a.archivedAt,
        createdAt:   a.createdAt,
        totalInvitees: a._count.invitees,
        accepted,
        rejected,
        pending,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/exam-applications", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST /api/exam-applications — crear postulación
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const user = session.user as { role?: string; dojoId?: string | null; id?: string; name?: string };
    if (user.role !== "admin" && user.role !== "sysadmin") {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }

    const dojoId = getEffectiveDojoId(user.role, user.dojoId, req);
    if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

    const body = await req.json() as {
      title:          string;
      location:       string;
      examDate:       string;
      examTime:       string;
      deadline?:      string | null;
      amount?:        number;
      description?:   string | null;
      imageUrl?:      string | null;
      imagePublicId?: string | null;
      invitees?:      { studentId: string; beltToPresent: string }[];
    };

    if (!body.title?.trim())    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    if (!body.location?.trim()) return NextResponse.json({ error: "Lugar requerido" }, { status: 400 });
    if (!body.examDate)         return NextResponse.json({ error: "Fecha requerida" }, { status: 400 });
    if (!body.examTime?.trim()) return NextResponse.json({ error: "Hora requerida" }, { status: 400 });

    const application = await prisma.examApplication.create({
      data: {
        dojoId,
        title:       body.title.trim(),
        location:    body.location.trim(),
        examDate:    new Date(body.examDate),
        examTime:    body.examTime.trim(),
        deadline:    body.deadline ? new Date(body.deadline) : null,
        amount:      body.amount ?? 0,
        description:   body.description?.trim() ?? null,
        imageUrl:      body.imageUrl ?? null,
        imagePublicId: body.imagePublicId ?? null,
        status:        "DRAFT",
        createdById: user.id ?? "",
        invitees: body.invitees?.length
          ? {
              create: body.invitees.map(inv => ({
                studentId:     inv.studentId,
                beltToPresent: inv.beltToPresent,
              })),
            }
          : undefined,
      },
    });

    const ctx = buildAuditCtx(session, req, { dojoId });
    await logAudit({
      ...ctx,
      action:       "EXAM_APPLICATION_CREATED",
      module:       AUDIT_MODULE.SETTINGS,
      resourceType: "ExamApplication",
      resourceId:   application.id,
      statusCode:   201,
    });

    return NextResponse.json(application, { status: 201 });
  } catch (err) {
    console.error("POST /api/exam-applications", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
