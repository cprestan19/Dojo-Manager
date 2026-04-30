import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendUserWelcome } from "@/lib/email";
import { CreateUserSchema, validationError } from "@/lib/validation";

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
    const sanitized = users.map(u => ({
      ...u,
      photo: u.photo?.startsWith("http") ? u.photo : null,
    }));
    return NextResponse.json(sanitized);
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

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const parsed = CreateUserSchema.safeParse(rawBody);
    if (!parsed.success) return validationError(parsed.error);
    const { name, email, password, role: userRole, photo, dojoId: bodyDojoId } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "El correo ya está registrado por otro usuario" }, { status: 409 });

    // Determine target dojo:
    // - admin       → their own dojo (immutable from session)
    // - sysadmin    → body.dojoId if provided, else sx-dojo cookie context, else null (global)
    let targetDojoId: string | null;
    if (role === "sysadmin") {
      const ctxDojo = req.cookies.get("sx-dojo")?.value ?? null;
      targetDojoId  = bodyDojoId ?? ctxDojo ?? null;
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
        photo:              photo ?? null,
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
