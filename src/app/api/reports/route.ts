import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "belt";

  // Log de exportación (solo para tipos válidos — se registra antes de cada return)
  const VALID_TYPES = ["belt", "age", "payments", "ranking"];
  const auditCtx = buildAuditCtx(session, req, { dojoId });
  const auditReport = () => logAudit({
    ...auditCtx, action: "REPORT_EXPORTED", module: AUDIT_MODULE.STUDENTS,
    statusCode: 200, details: JSON.stringify({ reportType: type }),
  });

  if (type === "belt") {
    // Select only the fields shown in the report — skip photo, contacts, address, etc.
    const students = await prisma.student.findMany({
      where: { dojoId, active: true },
      select: {
        id: true, fullName: true, firstName: true, lastName: true, birthDate: true,
        beltHistory: {
          orderBy: { changeDate: "desc" },
          take: 1,
          select: { beltColor: true, kata: { select: { name: true } } },
        },
      },
    });

    const grouped: Record<string, typeof students> = {};
    for (const s of students) {
      const belt = s.beltHistory[0]?.beltColor ?? "sin-cinta";
      (grouped[belt] ??= []).push(s);
    }
    await auditReport();
    return NextResponse.json(grouped);
  }

  if (type === "age") {
    // Only need birthDate, firstName, lastName for the age chart — nothing else
    const students = await prisma.student.findMany({
      where: { dojoId, active: true },
      select: { id: true, fullName: true, firstName: true, lastName: true, birthDate: true, gender: true },
    });

    const ranges: Record<string, typeof students> = {
      "< 8 años": [], "8–12 años": [], "13–17 años": [],
      "18–25 años": [], "26–40 años": [], "> 40 años": [],
    };
    for (const s of students) {
      const age = Math.floor((Date.now() - new Date(s.birthDate).getTime()) / (365.25 * 86400000));
      if      (age < 8)   ranges["< 8 años"].push(s);
      else if (age <= 12) ranges["8–12 años"].push(s);
      else if (age <= 17) ranges["13–17 años"].push(s);
      else if (age <= 25) ranges["18–25 años"].push(s);
      else if (age <= 40) ranges["26–40 años"].push(s);
      else                ranges["> 40 años"].push(s);
    }
    await auditReport();
    return NextResponse.json(ranges);
  }

  if (type === "payments") {
    // One groupBy query replaces 3 counts + 2 aggregates (was 5 round-trips, now 1)
    const rows = await prisma.payment.groupBy({
      by: ["status"],
      where: { student: { dojoId } },
      _count: { id: true },
      _sum:   { amount: true },
    });

    const byStatus = Object.fromEntries(rows.map(r => [r.status, r]));
    const get = (s: string) => byStatus[s] ?? { _count: { id: 0 }, _sum: { amount: 0 } };

    await auditReport();
    return NextResponse.json({
      pending:        get("pending")._count.id,
      paid:           get("paid")._count.id,
      late:           get("late")._count.id,
      totalCollected: get("paid")._sum.amount ?? 0,
      totalPending:   (get("pending")._sum.amount ?? 0) + (get("late")._sum.amount ?? 0),
    });
  }

  if (type === "ranking") {
    const rankings = await prisma.beltHistory.findMany({
      where: { isRanking: true, student: { dojoId } },
      select: {
        id: true, beltColor: true, changeDate: true, notes: true, kataIds: true,
        student: { select: { fullName: true, firstName: true, lastName: true, birthDate: true } },
        kata:    { select: { name: true, beltColor: true } },
      },
      orderBy: { changeDate: "desc" },
    });

    // Resolver nombres de katas adicionales (kataIds[1..])
    const extraIds = [...new Set(
      rankings.flatMap(r => {
        const ids = Array.isArray(r.kataIds) ? (r.kataIds as string[]) : [];
        return ids.slice(1);
      })
    )];
    const extraKatas = extraIds.length > 0
      ? await prisma.kata.findMany({ where: { id: { in: extraIds } }, select: { id: true, name: true } })
      : [];
    const kataMap = Object.fromEntries(extraKatas.map(k => [k.id, k.name]));

    const result = rankings.map(r => {
      const ids: string[] = Array.isArray(r.kataIds) ? (r.kataIds as string[]) : r.kata ? [r.kata.name] : [];
      const kataNames = ids.length > 0
        ? [r.kata?.name ?? kataMap[ids[0]] ?? null, ...ids.slice(1).map(id => kataMap[id] ?? null)].filter(Boolean)
        : r.kata ? [r.kata.name] : [];
      return { ...r, kataNames };
    });

    await auditReport();
    return NextResponse.json(result);
  }

  void VALID_TYPES; // evitar warning de variable no usada
  return NextResponse.json({ error: "Tipo de reporte inválido" }, { status: 400 });
}
