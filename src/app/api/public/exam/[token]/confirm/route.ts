import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type Params = { params: Promise<{ token: string }> };

// POST /api/public/exam/[token]/confirm — el Sensei confirma que es él/ella
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const evaluator = await prisma.examEvaluator.findUnique({ where: { token }, select: { id: true, active: true, confirmedAt: true } });
    if (!evaluator) return NextResponse.json({ error: "Link no válido" }, { status: 404 });
    if (!evaluator.active) return NextResponse.json({ error: "Este link ya no está activo — el examen fue cerrado" }, { status: 403 });

    if (!evaluator.confirmedAt) {
      await prisma.examEvaluator.update({ where: { id: evaluator.id }, data: { confirmedAt: new Date() } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/public/exam/[token]/confirm", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
