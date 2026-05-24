/**
 * GET /api/tournament-events/stats
 * Agrega medallas (Oro, Plata, Bronce) de todos los torneos del dojo
 * y devuelve totales + ranking de alumnos.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

function parseMedal(result: string | null): "gold" | "silver" | "bronze" | null {
  if (!result) return null;
  if (result.includes("Oro"))    return "gold";
  if (result.includes("Plata"))  return "silver";
  if (result.includes("Bronce")) return "bronze";
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  // Obtener todos los event IDs del dojo primero
  const events = await prisma.tournamentEvent.findMany({
    where:  { dojoId },
    select: { id: true },
  });
  const eventIds = events.map(e => e.id);

  // Todos los participantes de todos los torneos del dojo.
  // category se lee via SQL directo (cliente cacheado puede no conocer el campo aún)
  const participants = eventIds.length > 0
    ? await prisma.$queryRaw<{ studentId: string; kataResult: string | null; kumiteResult: string | null; category: string | null }[]>`
        SELECT student_id AS "studentId", kata_result AS "kataResult",
               kumite_result AS "kumiteResult", category
        FROM tournament_event_participants
        WHERE event_id = ANY(${eventIds}::text[])
      `
    : [];

  // Acumular medallas y categorías por alumno
  const medalMap    = new Map<string, { gold: number; silver: number; bronze: number }>();
  const categoryMap = new Map<string, Set<string>>();
  let totalGold = 0, totalSilver = 0, totalBronze = 0;

  for (const p of participants) {
    if (!medalMap.has(p.studentId))
      medalMap.set(p.studentId, { gold: 0, silver: 0, bronze: 0 });

    if (p.category?.trim()) {
      if (!categoryMap.has(p.studentId)) categoryMap.set(p.studentId, new Set());
      categoryMap.get(p.studentId)!.add(p.category.trim());
    }

    const entry = medalMap.get(p.studentId)!;
    for (const result of [p.kataResult, p.kumiteResult]) {
      const m = parseMedal(result);
      if (m === "gold")   { entry.gold++;   totalGold++; }
      if (m === "silver") { entry.silver++; totalSilver++; }
      if (m === "bronze") { entry.bronze++; totalBronze++; }
    }
  }

  // Solo alumnos con al menos una medalla
  const medalistIds = [...medalMap.entries()]
    .filter(([, v]) => v.gold + v.silver + v.bronze > 0)
    .map(([id]) => id);

  const [students, belts] = medalistIds.length > 0
    ? await Promise.all([
        prisma.student.findMany({
          where:  { id: { in: medalistIds }, dojoId },
          select: { id: true, fullName: true, studentCode: true, birthDate: true },
        }),
        prisma.beltHistory.findMany({
          where:   { studentId: { in: medalistIds } },
          orderBy: { changeDate: "desc" },
          select:  { studentId: true, beltColor: true },
        }),
      ])
    : [[], []];

  // Cinta más reciente por alumno
  const latestBelt = new Map<string, string>();
  for (const b of belts) {
    if (!latestBelt.has(b.studentId)) latestBelt.set(b.studentId, b.beltColor);
  }

  const studentMap = new Map(students.map(s => [s.id, s]));

  function computeAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  }

  const rankedStudents = medalistIds
    .map(id => {
      const medals  = medalMap.get(id)!;
      const student = studentMap.get(id);
      return {
        studentId:   id,
        fullName:    student?.fullName ?? "Alumno",
        studentCode: student?.studentCode ?? null,
        belt:        latestBelt.get(id) ?? "blanca",
        age:         student?.birthDate ? computeAge(student.birthDate) : 0,
        categories:  categoryMap.has(id) ? [...categoryMap.get(id)!] : [],
        gold:        medals.gold,
        silver:      medals.silver,
        bronze:      medals.bronze,
      };
    })
    // Orden: más oro → más plata → más bronce → alfabético
    .sort((a, b) =>
      b.gold - a.gold ||
      b.silver - a.silver ||
      b.bronze - a.bronze ||
      a.fullName.localeCompare(b.fullName)
    );

  return NextResponse.json({ totalGold, totalSilver, totalBronze, students: rankedStudents });
}
