import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// One-time seed endpoint — protected by a secret token.
// Call: POST /api/dev/seed-plans  with header  x-seed-secret: dojomasterplanes2024
// Safe to leave deployed — does nothing if plans already exist.

const SECRET = "dojomasterplanes2024";

const PLANS = [
  {
    name:         "Bronce",
    description:  "Plan gratuito para dojos pequeños — hasta 15 alumnos",
    monthlyPrice: 0,
    annualPrice:  0,
    maxStudents:  15,
    features: [
      "Hasta 15 alumnos activos",
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
    description:  "Para dojos en crecimiento — hasta 40 alumnos",
    monthlyPrice: 29,
    annualPrice:  290,
    maxStudents:  40,
    features: [
      "Hasta 40 alumnos activos",
      "Todo lo del plan Bronce",
      "Página web profesional del dojo incluida",
      "CRM de prospectos",
      "Reportes avanzados",
    ],
    isActive: true,
  },
  {
    name:         "Gold",
    description:  "Solución completa — alumnos ilimitados + torneos Pro",
    monthlyPrice: 59,
    annualPrice:  590,
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
  if (secret !== SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const results: { name: string; action: "created" | "exists" }[] = [];

  for (const plan of PLANS) {
    const existing = await prisma.plan.findFirst({
      where:  { name: plan.name },
      select: { id: true, name: true },
    });

    if (existing) {
      results.push({ name: plan.name, action: "exists" });
      continue;
    }

    await prisma.plan.create({
      data: {
        ...plan,
        features: JSON.stringify(plan.features),
      },
    });
    results.push({ name: plan.name, action: "created" });
  }

  return NextResponse.json({ ok: true, results });
}
