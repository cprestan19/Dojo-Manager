import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ news: [] });

  const role      = (session.user as { role?: string; id?: string })?.role ?? "user";
  const uid       = (session.user as { id?: string })?.id;
  const userEmail = session.user?.email ?? null;

  // El sysadmin no recibe el modal — él crea las novedades
  if (role === "sysadmin" || !uid) return NextResponse.json({ news: [] });

  // Audiencia: estudiantes ven "all" + "students"; admins/users ven "all" + "admins"
  const audienceFilter =
    role === "student"
      ? { in: ["all", "students"] as string[] }
      : { in: ["all", "admins"] as string[] };

  try {
    const user = await prisma.user.findUnique({
      where:  { id: uid },
      select: { lastSeenNewsAt: true },
    });

    const since = user?.lastSeenNewsAt ?? null;

    const news = await prisma.systemNews.findMany({
      where: {
        OR: [
          // Publicadas: respetan audiencia y fecha de "visto"
          {
            status:   "published",
            audience: audienceFilter,
            ...(since ? { publishedAt: { gt: since } } : {}),
          },
          // Borradores: solo para el usuario de prueba asignado, sin filtro de fecha
          {
            status:        "draft",
            testUserEmail: userEmail,
          },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
    });

    return NextResponse.json({ news });
  } catch {
    return NextResponse.json({ news: [] });
  }
}
