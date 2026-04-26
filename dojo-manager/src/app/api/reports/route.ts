import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string; dojoId?: string | null };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { dojoId } = session.user as SessionUser;
  if (!dojoId) return NextResponse.json({ error: "Sin dojo asignado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "belt";

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
        id: true, beltColor: true, changeDate: true, notes: true,
        student: { select: { fullName: true, firstName: true, lastName: true, birthDate: true } },
        kata:    { select: { name: true, beltColor: true } },
      },
      orderBy: { changeDate: "desc" },
    });
    return NextResponse.json(rankings);
  }

  return NextResponse.json({ error: "Tipo de reporte inválido" }, { status: 400 });
}
