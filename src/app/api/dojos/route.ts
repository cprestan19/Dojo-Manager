import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";
import { getOrCreateDefaultPlan, createFreeMonthSubscription } from "@/lib/billing/subscription";
import { notifyAdmin, buildDojoCreatedEmail } from "@/lib/admin-notifications";

type SessionUser = { role?: string; id?: string; email?: string };


export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const [dojos, activity] = await Promise.all([
    prisma.dojo.findMany({
      select: {
        id: true, name: true, slug: true, email: true, phone: true,
        active: true, tournamentPro: true, featured: true, createdAt: true, updatedAt: true,
        // logo y loginBgImage excluidos — son base64 de varios KB/MB
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            trialEndsAt: true,
            plan: { select: { id: true, name: true, maxStudents: true } },
          },
        },
        _count: {
          select: {
            users:    { where: { role: { not: "student" }, active: true } },
            students: { where: { active: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    // Última fecha de entrada por dojo — max(lastActiveAt) entre todos sus usuarios
    // (staff y alumnos), una sola query agregada en vez de N+1.
    prisma.user.groupBy({
      by:     ["dojoId"],
      where:  { dojoId: { not: null } },
      _max:   { lastActiveAt: true },
    }),
  ]);

  const lastActiveByDojo = new Map(activity.map(a => [a.dojoId, a._max.lastActiveAt]));

  return NextResponse.json(
    dojos.map(d => ({ ...d, lastActiveAt: lastActiveByDojo.get(d.id) ?? null })),
  );
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

  // Otorgar 1 mes gratis — el link de pago se genera y envía automáticamente al vencer
  const defaultPlan = await getOrCreateDefaultPlan();
  await createFreeMonthSubscription(dojo.id, defaultPlan.id);

  // Copiar katas del dojo natusuki como plantilla base
  const templateDojo = await prisma.dojo.findFirst({
    where:   { slug: { contains: "natusuki" } },
    select:  { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (templateDojo) {
    const templateKatas = await prisma.kata.findMany({
      where:   { dojoId: templateDojo.id, active: true },
      select:  { name: true, beltColor: true, order: true, description: true },
      orderBy: { order: "asc" },
    });
    if (templateKatas.length > 0) {
      await prisma.kata.createMany({
        data:           templateKatas.map(k => ({ ...k, dojoId: dojo.id })),
        skipDuplicates: true,
      });
    }
  }

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

  const ip      = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
               ?? req.headers.get("x-real-ip")
               ?? "unknown";
  const country = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null;
  const city    = req.headers.get("x-vercel-ip-city")    ?? null;
  const region  = req.headers.get("x-vercel-ip-region")  ?? null;

  await logAudit({
    action:       "DOJO_CREATED",
    module:       "SYSADMIN",
    resourceType: "Dojo",
    resourceId:   dojo.id,
    userId:       creatorId,
    userEmail:    creatorEmail,
    dojoId:       dojo.id,
    dojoSlug:     dojo.slug,
    ip,
    country,
    city,
    region,
    userAgent:    req.headers.get("user-agent"),
    statusCode:   201,
    details:      JSON.stringify({ dojoName: dojo.name, adminEmail }),
  });

  // Notificación al propietario de la plataforma (fire-and-forget)
  notifyAdmin(
    `🏯 Nuevo dojo creado — ${dojo.name}`,
    buildDojoCreatedEmail(dojo.name, adminEmail, creatorEmail ?? "sysadmin"),
  ).catch(() => {});

  return NextResponse.json({
    ...dojo,
    adminEmail,
    adminId: adminUser.id,
  }, { status: 201 });
}
