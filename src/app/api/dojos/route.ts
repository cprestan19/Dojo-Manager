import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { getOrCreateDefaultPlan, createTrialSubscription } from "@/lib/billing/subscription";

type SessionUser = { role?: string; id?: string; email?: string };


export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const dojos = await prisma.dojo.findMany({
    select: {
      id: true, name: true, slug: true, email: true, phone: true,
      active: true, createdAt: true, updatedAt: true,
      // logo y loginBgImage excluidos — son base64 de varios KB/MB
      _count: {
        select: {
          users:    { where: { role: { not: "student" }, active: true } },
          students: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(dojos);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, id: creatorId, email: creatorEmail } = session.user as SessionUser;
  if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body          = await req.json();
  const slug          = (body.slug as string).toLowerCase().replace(/\s+/g, "-");
  const adminPassword = body.adminPassword as string | undefined;

  if (!adminPassword || adminPassword.length < 8)
    return NextResponse.json({ error: "La contraseña del admin debe tener al menos 8 caracteres." }, { status: 400 });

  const existing = await prisma.dojo.findUnique({ where: { slug } });
  if (existing) return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });

  const dojo = await prisma.dojo.create({
    data: { name: body.name, slug, logo: body.logo ?? null },
  });

  // Iniciar trial de 14 días automáticamente
  const defaultPlan = await getOrCreateDefaultPlan();
  await createTrialSubscription(dojo.id, defaultPlan.id);

  const adminEmail     = `admin@${slug}.com`;
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.create({
    data: {
      name:               `Admin ${dojo.name}`,
      email:              adminEmail,
      password:           hashedPassword,
      role:               "admin",
      dojoId:             dojo.id,
      mustChangePassword: true,
    },
  });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
          ?? req.headers.get("x-real-ip")
          ?? "unknown";

  await logAudit({
    action:    "DOJO_CREATED",
    userId:    creatorId,
    userEmail: creatorEmail,
    dojoId:    dojo.id,
    dojoSlug:  dojo.slug,
    ip,
    details:   `Dojo "${dojo.name}" creado. Admin: ${adminEmail}`,
  });

  return NextResponse.json({
    ...dojo,
    adminEmail,
    adminId: adminUser.id,
  }, { status: 201 });
}
