import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// One-time seed endpoint — protected by a secret token.
// Call: POST /api/dev/seed-plans  with header  x-seed-secret: dojomasterplanes2024
// Safe to leave deployed — does nothing if plans already exist.

const SECRET = process.env.SEED_PLANS_SECRET ?? "";

const PLANS = [
  {
    name:         "Bronce",
    description:  "Plan gratuito para dojos pequeños — hasta 20 alumnos",
    monthlyPrice: 0,
    annualPrice:  0,
    maxStudents:  20,
    features: [
      "Hasta 20 alumnos activos",
      "Control de asistencia con QR",
      "Gestión de pagos y mensualidades",
      "Recordatorios automáticos por correo",
      "Portal del alumno (historial, cintas, videos)",
      "Historial de cintas y katas",
    ],
    isActive: true,
  },
  {
    name:         "Silver",
    description:  "Para dojos en crecimiento — hasta 60 alumnos",
    monthlyPrice: 60,
    annualPrice:  500,
    maxStudents:  60,
    features: [
      "Hasta 60 alumnos activos",
      "Todo lo del plan Bronce",
      "Diseño de carnet digital para cada alumno",
      "Diplomas automáticos en cada ascenso de cinta",
      "Módulo de eventos y postulaciones a torneos",
      "Push de notificaciones a alumnos",
      "Página web profesional del dojo incluida",
      "CRM de prospectos",
      "Reportes avanzados",
    ],
    isActive: true,
  },
  {
    name:         "Gold",
    description:  "Solución completa — alumnos ilimitados + torneos Pro",
    monthlyPrice: 80,
    annualPrice:  700,
    maxStudents:  null,
    features: [
      "Alumnos ilimitados",
      "Todo lo del plan Silver",
      "Módulo de Torneos Pro",
      "Streaming en vivo a YouTube / OBS",
      "Brackets automáticos Kumite y Kata",
      "Múltiples tatamis y jueces simultáneos",
      "Overlay profesional para transmisión",
    ],
    isActive: true,
  },
];

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-seed-secret");
  if (!SECRET || secret !== SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const results: { name: string; action: "created" | "exists" }[] = [];

  for (const plan of PLANS) {
    const existing = await prisma.plan.findFirst({
      where:  { name: plan.name },
      select: { id: true },
    });

    const data = { ...plan, features: JSON.stringify(plan.features) };

    if (existing) {
      await prisma.plan.update({ where: { id: existing.id }, data });
      results.push({ name: plan.name, action: "exists" });
    } else {
      await prisma.plan.create({ data });
      results.push({ name: plan.name, action: "created" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
