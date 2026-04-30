import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendUserWelcome } from "@/lib/email";

type SessionUser = { role?: string; dojoId?: string | null };

const ROLE_LABELS: Record<string, string> = {
  sysadmin: "Super Administrador",
  admin:    "Administrador",
  user:     "Usuario",
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId } = session.user as SessionUser;
    if (role !== "sysadmin" && role !== "admin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const users = await prisma.user.findMany({
      where: role === "sysadmin"
        ? { role: { not: "student" } }
        : { dojoId: dojoId ?? undefined, role: { not: "student" } },
      select: {
        id: true, name: true, email: true, role: true, active: true,
        photo: true, dojoId: true, createdAt: true,
        dojo: { select: { name: true, slug: true } },
      },
      orderBy: [{ name: "asc" }],
    });
    return NextResponse.json(users);
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId: sessionDojoId } = session.user as SessionUser;
    if (role !== "sysadmin" && role !== "admin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
    }

    const name     = String(body.name     ?? "").trim();
    const email    = String(body.email    ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const userRole = String(body.role     ?? "user");

    if (!name)          return NextResponse.json({ error: "El nombre es requerido" },                         { status: 400 });
    if (!email)         return NextResponse.json({ error: "El correo electrónico es requerido" },             { status: 400 });
    if (!password)      return NextResponse.json({ error: "La contraseña es requerida" },                     { status: 400 });
    if (password.length < 8)
                        return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "El correo ya está registrado por otro usuario" }, { status: 409 });

    // Determine target dojo:
    // - admin       → their own dojo (immutable from session)
    // - sysadmin    → body.dojoId if provided, else sx-dojo cookie context, else null (global)
    let targetDojoId: string | null;
    if (role === "sysadmin") {
      const bodyDojo = typeof body.dojoId === "string" ? body.dojoId : null;
      const ctxDojo  = req.cookies.get("sx-dojo")?.value ?? null;
      targetDojoId   = bodyDojo ?? ctxDojo ?? null;
    } else {
      targetDojoId = sessionDojoId ?? null;
    }

    const hashed = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password:           hashed,
        role:               userRole,
        dojoId:             targetDojoId,
        photo:              typeof body.photo === "string" ? body.photo : null,
        mustChangePassword: true,
      },
      select: {
        id: true, name: true, email: true, role: true,
        active: true, photo: true, dojoId: true, createdAt: true,
        dojo: { select: { name: true, slug: true } },
      },
    });

    // Fetch dojo branding for welcome email (exclude large base64 logo)
    const dojo = targetDojoId
      ? await prisma.dojo.findUnique({
          where:  { id: targetDojoId },
          select: { name: true, email: true, phone: true, slogan: true, ownerName: true },
        })
      : null;

    // Fire-and-forget — never blocks response
    sendUserWelcome({
      to:           newUser.email,
      name:         newUser.name,
      loginEmail:   newUser.email,
      tempPassword: password,
      roleLabel:    ROLE_LABELS[newUser.role] ?? newUser.role,
      dojo:         dojo ?? undefined,
    }).catch(err => console.error("[email] sendUserWelcome failed:", err));

    return NextResponse.json(newUser, { status: 201 });
  } catch (err) {
    console.error("POST /api/users error:", err);
    const message = err instanceof Error ? err.message : "Error interno al crear el usuario";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
