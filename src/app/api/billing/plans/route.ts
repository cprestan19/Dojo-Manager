import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

type SessionUser = { role?: string };

// GET — authenticated: all active plans (sysadmin sees all)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role } = session.user as SessionUser;
    const isSysadmin = role === "sysadmin";

    const plans = await prisma.plan.findMany({
      where:   isSysadmin ? undefined : { isActive: true },
      orderBy: { monthlyPrice: "asc" },
    });

    return NextResponse.json(plans);
  } catch (err) {
    console.error("GET /api/billing/plans error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST — sysadmin only
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role } = session.user as SessionUser;
    if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

    const { name, description, monthlyPrice, annualPrice, maxStudents, features, isActive } = body as {
      name: string; description?: string;
      monthlyPrice: number; annualPrice: number;
      maxStudents?: number; features: string[]; isActive: boolean;
    };

    if (!name || monthlyPrice == null || annualPrice == null) {
      return NextResponse.json({ error: "name, monthlyPrice y annualPrice son requeridos" }, { status: 400 });
    }
    if (monthlyPrice < 0 || annualPrice < 0) {
      return NextResponse.json({ error: "Los precios no pueden ser negativos" }, { status: 400 });
    }

    const plan = await prisma.plan.create({
      data: {
        name,
        description:  description ?? null,
        monthlyPrice,
        annualPrice,
        maxStudents:  maxStudents ?? null,
        features:     JSON.stringify(features ?? []),
        isActive:     isActive ?? true,
      },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    console.error("POST /api/billing/plans error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH — sysadmin only
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role } = session.user as SessionUser;
    if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body?.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const { id } = body as { id: string };

    // Whitelist — only these fields may be updated
    const data: Record<string, unknown> = {};
    if (body.name        != null) data.name         = String(body.name).trim();
    if ("description" in body)    data.description  = body.description ? String(body.description).trim() : null;
    if (body.monthlyPrice != null) data.monthlyPrice = Number(body.monthlyPrice);
    if (body.annualPrice  != null) data.annualPrice  = Number(body.annualPrice);
    if ("maxStudents" in body)     data.maxStudents  = body.maxStudents != null ? Number(body.maxStudents) : null;
    if (Array.isArray(body.features)) data.features  = JSON.stringify(body.features as string[]);
    if (body.isActive     != null) data.isActive     = Boolean(body.isActive);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay campos válidos para actualizar" }, { status: 400 });
    }

    const plan = await prisma.plan.update({ where: { id }, data });
    return NextResponse.json(plan);
  } catch (err) {
    console.error("PATCH /api/billing/plans error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE — sysadmin only (soft delete)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role } = session.user as SessionUser;
    if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body?.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    await prisma.plan.update({
      where: { id: body.id as string },
      data:  { isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/billing/plans error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
