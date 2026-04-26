import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "belt";

  if (type === "belt") {
    // Report: students grouped by current belt color
    const students = await prisma.student.findMany({
      where: { active: true },
      include: {
        beltHistory: { orderBy: { changeDate: "desc" }, take: 1, include: { kata: true } },
      },
    });

    const grouped: Record<string, typeof students> = {};
    for (const s of students) {
      const belt = s.beltHistory[0]?.beltColor ?? "sin-cinta";
      if (!grouped[belt]) grouped[belt] = [];
      grouped[belt].push(s);
    }
    return NextResponse.json(grouped);
  }

  if (type === "age") {
    // Report: students grouped by age range
    const students = await prisma.student.findMany({ where: { active: true } });
    const ranges: Record<string, typeof students> = {
      "< 8 años": [], "8–12 años": [], "13–17 años": [],
      "18–25 años": [], "26–40 años": [], "> 40 años": [],
    };

    for (const s of students) {
      const age = Math.floor((Date.now() - new Date(s.birthDate).getTime()) / (365.25 * 86400000));
      if      (age < 8)  ranges["< 8 años"].push(s);
      else if (age <= 12) ranges["8–12 años"].push(s);
      else if (age <= 17) ranges["13–17 años"].push(s);
      else if (age <= 25) ranges["18–25 años"].push(s);
      else if (age <= 40) ranges["26–40 años"].push(s);
      else                ranges["> 40 años"].push(s);
    }
    return NextResponse.json(ranges);
  }

  if (type === "payments") {
    // Report: payment summary
    const [pending, paid, late] = await Promise.all([
      prisma.payment.count({ where: { status: "pending" } }),
      prisma.payment.count({ where: { status: "paid"    } }),
      prisma.payment.count({ where: { status: "late"    } }),
    ]);
    const totalCollected = await prisma.payment.aggregate({
      where: { status: "paid" },
      _sum: { amount: true },
    });
    const totalPending = await prisma.payment.aggregate({
      where: { status: { in: ["pending", "late"] } },
      _sum: { amount: true },
    });
    return NextResponse.json({
      pending, paid, late,
      totalCollected: totalCollected._sum.amount ?? 0,
      totalPending:   totalPending._sum.amount ?? 0,
    });
  }

  if (type === "ranking") {
    // Report: students with ranking flag
    const rankings = await prisma.beltHistory.findMany({
      where: { isRanking: true },
      include: {
        student: { select: { firstName: true, lastName: true, birthDate: true } },
        kata: true,
      },
      orderBy: { changeDate: "desc" },
    });
    return NextResponse.json(rankings);
  }

  return NextResponse.json({ error: "Tipo de reporte inválido" }, { status: 400 });
}
