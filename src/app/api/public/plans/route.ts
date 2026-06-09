import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/public/plans — sin autenticación, usado por la landing page.
// Solo devuelve planes activos con precio >= 0, ordenados por precio ASC.
export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where:   { isActive: true },
      orderBy: { monthlyPrice: "asc" },
      select: {
        id:           true,
        name:         true,
        description:  true,
        monthlyPrice: true,
        annualPrice:  true,
        maxStudents:  true,
        features:     true,
      },
    });

    return NextResponse.json(plans, {
      headers: {
        // Cache 5 minutos en CDN — invalida automáticamente si se cambia un plan
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("GET /api/public/plans error:", err);
    return NextResponse.json([], { status: 200 }); // Retorna [] en vez de 500 para no romper la landing
  }
}
