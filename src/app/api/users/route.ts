import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendUserWelcome } from "@/lib/email";
import { CreateUserSchema, validationError } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null; id?: string; email?: string };

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

    const { role, dojoId: sessionDojoId, id: sessionUserId, email: sessionEmail } = session.user as SessionUser;
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

    // Protección contra escalada de privilegios:
    // admin puede crear admin o user/student/custom — nunca sysadmin
    // sysadmin puede crear admin y user — nunca otro sysadmin vía API
    if (role === "admin" && userRole === "sysadmin") {
      return NextResponse.json({ error: "No tienes permisos para asignar ese rol" }, { status: 403 });
    }
    if (role === "sysadmin" && userRole === "sysadmin") {
      return NextResponse.json({ error: "No se puede crear otro sysadmin vía API" }, { status: 403 });
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

    const dojoRaw = targetDojoId
      ? await prisma.dojo.findUnique({
          where:  { id: targetDojoId },
          select: { name: true, email: true, phone: true, logo: true, slogan: true, ownerName: true },
        })
      : null;
    const dojo = dojoRaw
      ? { ...dojoRaw, logo: dojoRaw.logo?.startsWith("http") ? dojoRaw.logo : null }
      : null;

    await logAudit({
      action:    "USER_CREATED",
      userId:    sessionUserId,
      userEmail: sessionEmail,
      dojoId:    targetDojoId,
      details:   JSON.stringify({
        newUserId:    newUser.id,
        newUserEmail: newUser.email,
        newUserName:  newUser.name,
        newUserRole:  newUser.role,
        createdBy:    sessionEmail,
      }),
    });

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
