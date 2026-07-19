import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";

const getCachedFeaturedDojos = unstable_cache(
  async () => prisma.dojo.findMany({
    where: { featured: true, active: true, logo: { not: null } },
    orderBy: { name: "asc" },
    select: { name: true, slug: true, logo: true },
  }),
  ["public-featured-dojos"],
  { tags: ["public-featured-dojos"], revalidate: 300 },
);

// GET /api/public/featured-dojos — sin autenticación, usado por la landing page
// para la barra de logos "confían en nosotros". Solo dojos activos, marcados
// como destacados y con logo real (Cloudinary) subido.
export async function GET() {
  try {
    const dojos = await getCachedFeaturedDojos();
    const withHttpLogo = dojos.filter(d => d.logo?.startsWith("http"));
    return NextResponse.json(withHttpLogo, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("GET /api/public/featured-dojos error:", err);
    return NextResponse.json([], { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
