import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { UpdateUserSchema, validationError } from "@/lib/validation";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";
import { deleteResource, extractCloudinaryPublicId } from "@/lib/cloudinary";

type Params = { params: Promise<{ id: string }> };
type SessionUser = { role?: string; dojoId?: string | null; id?: string; email?: string };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId, id: sessionUserId, email: sessionEmail } = session.user as SessionUser;
    if (role !== "sysadmin" && role !== "admin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (role === "admin" && target.dojoId !== dojoId)
      return NextResponse.json({ error: "Sin permisos sobre este usuario" }, { status: 403 });

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

    const parsed = UpdateUserSchema.safeParse(rawBody);
    if (!parsed.success) return validationError(parsed.error);
    const body = parsed.data;

    if (target.role === "sysadmin") {
      const sysadminCount = await prisma.user.count({ where: { role: "sysadmin", active: true } });
      if (sysadminCount <= 1 && (body.active === false || (body.role !== undefined && body.role !== "sysadmin")))
        return NextResponse.json({ error: "No puedes desactivar o cambiar el último sysadmin" }, { status: 400 });
    }

    // Protección contra escalada de privilegios en cambio de rol:
    // admin puede asignar admin o user/custom — nunca sysadmin
    // sysadmin no puede elevar otro usuario a sysadmin vía API
    if (body.role !== undefined) {
      if (role === "admin" && body.role === "sysadmin") {
        return NextResponse.json({ error: "No tienes permisos para asignar ese rol" }, { status: 403 });
      }
      if (role === "sysadmin" && body.role === "sysadmin" && target.role !== "sysadmin") {
        return NextResponse.json({ error: "No se puede asignar el rol sysadmin vía API" }, { status: 403 });
      }
    }

    const data: Record<string, unknown> = {};
    if (body.name  !== undefined) data.name  = body.name;
    if (body.email !== undefined) {
      const existing = await prisma.user.findFirst({ where: { email: body.email, NOT: { id } } });
      if (existing) return NextResponse.json({ error: "Email ya registrado por otro usuario" }, { status: 409 });
      data.email = body.email;
    }
    if (body.role               !== undefined) data.role               = body.role;
    if (body.active             !== undefined) data.active             = body.active;
    if (body.photo !== undefined) {
      data.photo = body.photo ?? null;
      // Borrar foto anterior de Cloudinary si se reemplaza o elimina
      if (body.photo !== target.photo && target.photo) {
        const pid = extractCloudinaryPublicId(target.photo);
        if (pid) deleteResource(pid).catch(() => {});
      }
    }
    if (body.mustChangePassword !== undefined) data.mustChangePassword = body.mustChangePassword;

    const passwordChanged = !!body.password;
    if (body.password) data.password = await bcrypt.hash(body.password, 12);

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true, role: true, active: true,
        photo: true, dojoId: true, createdAt: true,
        dojo: { select: { name: true, slug: true } },
      },
    });

    // ── Audit log ────────────────────────────────────────────────────────────
    const changes: string[] = [];
    if (body.active  !== undefined && body.active  !== target.active)
      changes.push(`activo: ${target.active} → ${body.active}`);
    if (body.role    !== undefined && body.role    !== target.role)
      changes.push(`rol: ${target.role} → ${body.role}`);
    if (body.name    !== undefined && body.name    !== target.name)
      changes.push(`nombre: "${target.name}" → "${body.name}"`);
    if (body.email   !== undefined && body.email   !== target.email)
      changes.push(`email: ${target.email} → ${body.email}`);
    if (passwordChanged) changes.push("contraseña cambiada");

    const action = passwordChanged && changes.length === 1
      ? "USER_PASSWORD_CHANGED"
      : body.active === false && changes.length === 1
        ? "USER_DEACTIVATED"
        : body.active === true  && changes.length === 1
          ? "USER_ACTIVATED"
          : "USER_UPDATED";

    const ctx = buildAuditCtx(session, req, { dojoId: dojoId ?? target.dojoId });
    await logAudit({
      ...ctx,
      action,
      module:       AUDIT_MODULE.USERS,
      resourceType: "User",
      resourceId:   id,
      targetId:     id,
      targetEmail:  target.email,
      statusCode:   200,
      details:      JSON.stringify({
        before:  { name: target.name, email: target.email, role: target.role, active: target.active },
        after:   { name: body.name ?? target.name, email: body.email ?? target.email, role: body.role ?? target.role, active: body.active ?? target.active },
        changes,
      }),
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PUT /api/users/[id] error:", err);
    const message = err instanceof Error ? err.message : "Error interno al actualizar el usuario";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { role, dojoId, id: sessionUserId, email: sessionEmail } = session.user as SessionUser;
    if (role !== "sysadmin" && role !== "admin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    if (id === sessionUserId)
      return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    if (role === "admin" && target.dojoId !== dojoId)
      return NextResponse.json({ error: "Sin permisos sobre este usuario" }, { status: 403 });

    // Admin no puede eliminar usuarios sysadmin bajo ninguna circunstancia
    if (role === "admin" && target.role === "sysadmin")
      return NextResponse.json({ error: "No puedes eliminar un Super Administrador" }, { status: 403 });

    if (target.role === "sysadmin") {
      const count = await prisma.user.count({ where: { role: "sysadmin" } });
      if (count <= 1)
        return NextResponse.json({ error: "No puedes eliminar el último sysadmin" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });

    // Borrar foto de Cloudinary fuera de la transacción (no bloquea si falla)
    if (target.photo) {
      const pid = extractCloudinaryPublicId(target.photo);
      if (pid) deleteResource(pid).catch(() => {});
    }

    const ctx2 = buildAuditCtx(session, req, { dojoId: dojoId ?? target.dojoId });
    await logAudit({
      ...ctx2,
      action:       "USER_DELETED",
      module:       AUDIT_MODULE.USERS,
      resourceType: "User",
      resourceId:   id,
      targetId:     id,
      targetEmail:  target.email,
      statusCode:   200,
      details:      JSON.stringify({
        before: { name: target.name, email: target.email, role: target.role },
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/users/[id] error:", err);
    const message = err instanceof Error ? err.message : "Error interno al eliminar el usuario";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
