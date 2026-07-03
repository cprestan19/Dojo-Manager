import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "sysadmin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const [news, users] = await Promise.all([
    prisma.systemNews.findMany({
      where:   { status: "published" },
      orderBy: { publishedAt: "desc" },
      take:    20,
      select:  { id: true, version: true, title: true, publishedAt: true, audience: true },
    }),
    prisma.user.findMany({
      select: {
        id: true, name: true, email: true, role: true,
        lastSeenNewsAt: true, lastActiveAt: true,
        dojo: { select: { name: true } },
      },
      orderBy: [{ dojo: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  const result = news.map(n => {
    const pub = new Date(n.publishedAt).getTime();
    const seen    = users.filter(u => u.lastSeenNewsAt && new Date(u.lastSeenNewsAt).getTime() >= pub);
    const notSeen = users.filter(u => !u.lastSeenNewsAt || new Date(u.lastSeenNewsAt).getTime() < pub);
    return {
      ...n,
      totalUsers:  users.length,
      seenCount:   seen.length,
      notSeenCount: notSeen.length,
      seenUsers:   seen.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, dojoName: u.dojo?.name ?? null, lastSeenAt: u.lastSeenNewsAt })),
      notSeenUsers: notSeen.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, dojoName: u.dojo?.name ?? null, lastActiveAt: u.lastActiveAt })),
    };
  });

  return NextResponse.json(result);
}
