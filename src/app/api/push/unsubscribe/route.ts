import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// DELETE /api/push/unsubscribe — elimina la suscripción del dispositivo actual
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json() as { endpoint?: string };
    if (!body.endpoint) {
      return NextResponse.json({ error: "endpoint requerido" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/push/unsubscribe", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
