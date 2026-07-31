import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasFeature } from "@/lib/billing/featureGate";
import { NAV_KEYS } from "@/lib/permissions";
import { sendPushToDojoAdminOnlyAsync } from "@/lib/push";

type PortalUser = { role?: string; studentId?: string | null };

async function resolveFamily(studentId: string) {
  const me = await prisma.student.findUnique({
    where:  { id: studentId },
    select: { id: true, fullName: true, familyId: true, dojoId: true },
  });
  if (!me) return null;

  if (!me.familyId) return { me, dojoId: me.dojoId, members: [{ id: me.id, fullName: me.fullName }] };

  const members = await prisma.student.findMany({
    where:   { familyId: me.familyId, dojoId: me.dojoId, active: true },
    select:  { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
  return { me, dojoId: me.dojoId, members };
}

// GET /api/portal/store — catálogo activo del dojo + miembros de la familia
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as PortalUser;
  if (user.role !== "student" || !user.studentId)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const family = await resolveFamily(user.studentId);
  if (!family) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

  const storeEnabled = await hasFeature(family.dojoId, NAV_KEYS.STORE);
  if (!storeEnabled) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const products = await prisma.storeProduct.findMany({
    where:   { dojoId: family.dojoId, active: true },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, name: true, description: true, price: true, currency: true,
      imageUrl: true, sizes: true,
    },
  });

  return NextResponse.json({
    products,
    members: family.members.map(m => ({ id: m.id, fullName: m.fullName, isMe: m.id === family.me.id })),
  });
}

// POST /api/portal/store — solicitar compra de un producto (para sí mismo o un hermano)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = session.user as PortalUser;
  if (user.role !== "student" || !user.studentId)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  try {
    const { productId, size, notes: rawNotes, studentId: targetId } = await req.json() as {
      productId:  string;
      size?:      string;
      notes?:     string;
      studentId?: string;
    };
    if (!productId) return NextResponse.json({ error: "productId requerido" }, { status: 400 });
    const notes = typeof rawNotes === "string" ? rawNotes.trim().slice(0, 500) : null;

    const family = await resolveFamily(user.studentId);
    if (!family) return NextResponse.json({ error: "Alumno no encontrado" }, { status: 404 });

    const storeEnabled = await hasFeature(family.dojoId, NAV_KEYS.STORE);
    if (!storeEnabled) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    // Validar que el destinatario es el alumno en sesión o un miembro de su familia
    const buyerStudentId = targetId ?? user.studentId;
    const buyer = family.members.find(m => m.id === buyerStudentId);
    if (!buyer) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId, dojoId: family.dojoId, active: true },
    });
    if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

    const request_ = await prisma.storePurchaseRequest.create({
      data: {
        dojoId:    family.dojoId,
        productId: product.id,
        studentId: buyerStudentId,
        size:      size?.trim() || null,
        notes,
      },
    });

    sendPushToDojoAdminOnlyAsync(family.dojoId, {
      title: "🛒 Nueva solicitud de compra",
      body:  `${buyer.fullName} quiere comprar "${product.name}"${size ? ` (talla ${size})` : ""}`,
      url:   "/dashboard/store",
      tag:   `store-request-${request_.id}`,
    }, { type: "store_request" });

    return NextResponse.json(request_, { status: 201 });
  } catch (err) {
    console.error("POST /api/portal/store error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
