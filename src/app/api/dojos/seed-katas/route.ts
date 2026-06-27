import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string };

/**
 * POST /api/dojos/seed-katas
 * Copia las katas del dojo natusuki a todos los dojos que aún no tengan katas.
 * Solo sysadmin. Idempotente — usa skipDuplicates.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { targetDojoId?: string };

  // Buscar el dojo plantilla (natusuki)
  const template = await prisma.dojo.findFirst({
    where:   { slug: { contains: "natusuki" } },
    select:  { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  if (!template) {
    return NextResponse.json({ error: "No se encontró el dojo natusuki." }, { status: 404 });
  }

  const templateKatas = await prisma.kata.findMany({
    where:   { dojoId: template.id, active: true },
    select:  { name: true, beltColor: true, order: true, description: true },
    orderBy: { order: "asc" },
  });

  if (templateKatas.length === 0) {
    return NextResponse.json({ error: "El dojo natusuki no tiene katas." }, { status: 404 });
  }

  // Si se especificó un dojo concreto, solo migrar ese
  if (body.targetDojoId) {
    const count = await prisma.kata.createMany({
      data:           templateKatas.map(k => ({ ...k, dojoId: body.targetDojoId! })),
      skipDuplicates: true,
    });
    return NextResponse.json({
      ok:       true,
      template: template.slug,
      results:  [{ dojoId: body.targetDojoId, created: count.count }],
    });
  }

  // Sin targetDojoId → migrar todos los dojos sin katas (excepto natusuki)
  const allDojos = await prisma.dojo.findMany({
    where:  { id: { not: template.id } },
    select: {
      id:   true,
      name: true,
      slug: true,
      _count: { select: { katas: true } },
    },
  });

  const dojosSinKatas = allDojos.filter(d => d._count.katas === 0);

  if (dojosSinKatas.length === 0) {
    return NextResponse.json({
      ok:       true,
      template: template.slug,
      message:  "Todos los dojos ya tienen katas.",
      results:  [],
    });
  }

  const results: { dojo: string; created: number }[] = [];

  for (const dojo of dojosSinKatas) {
    const { count } = await prisma.kata.createMany({
      data:           templateKatas.map(k => ({ ...k, dojoId: dojo.id })),
      skipDuplicates: true,
    });
    results.push({ dojo: dojo.slug, created: count });
  }

  return NextResponse.json({
    ok:       true,
    template: template.slug,
    katasTemplate: templateKatas.length,
    results,
  });
}
