import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadBuffer } from "@/lib/cloudinary";

type SessionUser = { role?: string };

async function base64ToCloudinary(base64: string, folder: string): Promise<string | null> {
  try {
    const [header, b64data] = base64.split(",");
    if (!b64data) return null;
    const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) return null;
    const buffer = Buffer.from(b64data, "base64");
    if (buffer.length < 100) return null; // datos inválidos
    const result = await uploadBuffer(buffer, folder, "image");
    return result.url;
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/migrate-photos
 * Sysadmin only. Encuentra todos los registros con fotos base64 en la BD
 * y los sube a Cloudinary, actualizando el campo con la URL resultante.
 *
 * Body (opcional): { dryRun: true } → solo reporta sin migrar.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { dryRun?: boolean };
  const dryRun = body.dryRun === true;

  const stats = {
    students:  { found: 0, migrated: 0, failed: 0 },
    users:     { found: 0, migrated: 0, failed: 0 },
  };

  // ── 1. Students con foto base64 ───────────────────────────────────────────
  const studentsWithBase64 = await prisma.student.findMany({
    where: { photo: { startsWith: "data:" } },
    select: { id: true, dojoId: true, photo: true, fullName: true },
  });

  stats.students.found = studentsWithBase64.length;

  if (!dryRun) {
    for (const student of studentsWithBase64) {
      const url = await base64ToCloudinary(
        student.photo!,
        `dojo-manager/${student.dojoId}/students`,
      );
      if (url) {
        await prisma.student.update({
          where: { id: student.id },
          data:  { photo: url },
        });
        stats.students.migrated++;
      } else {
        // Si no se puede subir, limpiar el base64 para no degradar rendimiento
        await prisma.student.update({
          where: { id: student.id },
          data:  { photo: null },
        });
        stats.students.failed++;
      }
    }
  }

  // ── 2. Users con foto base64 ──────────────────────────────────────────────
  const usersWithBase64 = await prisma.user.findMany({
    where: { photo: { startsWith: "data:" } },
    select: { id: true, dojoId: true, photo: true, name: true },
  });

  stats.users.found = usersWithBase64.length;

  if (!dryRun) {
    for (const user of usersWithBase64) {
      const folder = user.dojoId
        ? `dojo-manager/${user.dojoId}/users`
        : `dojo-manager/global/users`;
      const url = await base64ToCloudinary(user.photo!, folder);
      if (url) {
        await prisma.user.update({
          where: { id: user.id },
          data:  { photo: url },
        });
        stats.users.migrated++;
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data:  { photo: null },
        });
        stats.users.failed++;
      }
    }
  }

  return NextResponse.json({
    ok:     true,
    dryRun,
    stats,
    message: dryRun
      ? "Simulación completada. Llama sin dryRun para ejecutar la migración."
      : "Migración completada. Todas las fotos base64 fueron subidas a Cloudinary o eliminadas.",
  });
}
