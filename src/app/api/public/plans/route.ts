import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";

const getCachedPlans = unstable_cache(
  async () => prisma.plan.findMany({
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
  }),
  ["public-plans"],
  // revalidate: 300 — red de seguridad además de revalidateTag(). Sin esto, un
  // cambio de planes hecho fuera de PATCH /api/billing/plans (ej. directo en
  // BD) deja este caché desactualizado indefinidamente, como ya pasó una vez.
  { tags: ["public-plans"], revalidate: 300 }
);

// GET /api/public/plans — sin autenticación, usado por la landing page.
// Cache-Control: no-store impide que CDN/browser cacheen la respuesta HTTP;
// el caché real vive en unstable_cache (servidor) y se invalida con revalidateTag.
export async function GET() {
  try {
    const plans = await getCachedPlans();
    return NextResponse.json(plans, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("GET /api/public/plans error:", err);
    return NextResponse.json([], { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
