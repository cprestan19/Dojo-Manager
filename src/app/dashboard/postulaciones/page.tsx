import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";
import PostulacionesClient from "./PostulacionesClient";
import type { NextRequest } from "next/server";

export default async function PostulacionesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as { role?: string; dojoId?: string | null };
  if (user.role !== "admin" && user.role !== "sysadmin") redirect("/dashboard");

  // Para server components usamos un NextRequest simulado vacío
  const mockReq = { cookies: { get: () => undefined }, nextUrl: { searchParams: new URLSearchParams() } } as unknown as NextRequest;
  const dojoId = getEffectiveDojoId(user.role, user.dojoId, mockReq);

  let initialData: {
    id: string;
    title: string;
    location: string;
    examDate: Date;
    examTime: string;
    deadline: Date | null;
    amount: number;
    status: string;
    archivedAt: Date | null;
    createdAt: Date;
    totalInvitees: number;
    accepted: number;
    rejected: number;
    pending: number;
  }[] = [];

  if (dojoId) {
    const apps = await prisma.examApplication.findMany({
      where:   { dojoId },
      orderBy: { examDate: "desc" },
      select: {
        id: true, title: true, location: true, examDate: true,
        examTime: true, deadline: true, amount: true, status: true,
        archivedAt: true, createdAt: true,
        _count:   { select: { invitees: true } },
        invitees: { select: { response: true } },
      },
    });

    initialData = apps.map(a => ({
      id:            a.id,
      title:         a.title,
      location:      a.location,
      examDate:      a.examDate,
      examTime:      a.examTime,
      deadline:      a.deadline,
      amount:        a.amount,
      status:        a.status,
      archivedAt:    a.archivedAt,
      createdAt:     a.createdAt,
      totalInvitees: a._count.invitees,
      accepted:      a.invitees.filter(i => i.response === "ACCEPTED").length,
      rejected:      a.invitees.filter(i => i.response === "REJECTED").length,
      pending:       a.invitees.filter(i => i.response === "PENDING").length,
    }));
  }

  return <PostulacionesClient initialData={initialData} />;
}
