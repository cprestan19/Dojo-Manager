import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "sysadmin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      createdAt: { lt: threeDaysAgo }, // cuenta de más de 3 días
      OR: [
        { lastActiveAt: null },
        { lastActiveAt: { lt: threeDaysAgo } },
      ],
    },
    select: {
      id: true, name: true, email: true, role: true, active: true,
      createdAt: true, lastActiveAt: true, lastSeenNewsAt: true,
      dojo: { select: { id: true, name: true } },
    },
    orderBy: [
      { lastActiveAt: "asc" },
      { dojo: { name: "asc" } },
    ],
  });

  const now = Date.now();
  const result = users.map(u => ({
    ...u,
    daysSinceActive: u.lastActiveAt
      ? Math.floor((now - new Date(u.lastActiveAt).getTime()) / 86_400_000)
      : null,
    daysSinceCreated: Math.floor((now - new Date(u.createdAt).getTime()) / 86_400_000),
  }));

  return NextResponse.json(result);
}
