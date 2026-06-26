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
  { tags: ["public-plans"] }
);

// GET /api/public/plans — sin autenticación, usado por la landing page.
export async function GET() {
  try {
    const plans = await getCachedPlans();
    return NextResponse.json(plans);
  } catch (err) {
    console.error("GET /api/public/plans error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
