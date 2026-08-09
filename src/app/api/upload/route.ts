import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadBuffer } from "@/lib/cloudinary";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";
import {
  MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, checkMagicBytes,
} from "@/lib/upload-validation";

type SessionUser = { role?: string; dojoId?: string | null };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formato de solicitud inválido" }, { status: 400 });
  }

  const file    = formData.get("file")    as File | null;
  const type    = (formData.get("type")    as string | null) ?? "image";
  // purpose: "student-photo" | "user-photo" | "belt-video"
  const purpose = (formData.get("purpose") as string | null) ?? "user-photo";

  // El logo de plataforma y el logo de la vitrina "confían en nosotros" son
  // globales/editoriales (no pertenecen al dojo destino) — solo sysadmin puede subirlos.
  if ((purpose === "platform-logo" || purpose === "featured-logo") && role !== "sysadmin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
  if (type !== "image" && type !== "video")
    return NextResponse.json({ error: "Tipo inválido (image|video)" }, { status: 400 });

  const uploadType = type as "image" | "video";
  const maxBytes   = uploadType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const allowed    = uploadType === "video" ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;

  if (!allowed.includes(file.type))
    return NextResponse.json({ error: `Tipo de archivo no permitido: ${file.type}` }, { status: 400 });
  if (file.size > maxBytes)
    return NextResponse.json({ error: `Archivo demasiado grande (máx ${maxBytes / 1024 / 1024} MB)` }, { status: 400 });

  const scope  = dojoId ?? "global";
  const subfolder = purpose === "student-photo"   ? "students"
    : purpose === "belt-video"                    ? "belt-videos"
    : purpose === "dojo-logo"                     ? "logos"
    : purpose === "card-template"                 ? "card-templates"
    : purpose === "event-image"                   ? "events"
    : purpose === "platform-logo"                 ? "platform"
    : purpose === "featured-logo"                 ? "featured-logos"
    :                                               "users";
  const folder = `dojo-manager/${scope}/${subfolder}`;

  try {
    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!checkMagicBytes(buffer, uploadType))
      return NextResponse.json({ error: "El contenido del archivo no corresponde al tipo declarado" }, { status: 400 });

    const result = await uploadBuffer(buffer, folder, uploadType);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 });
  }
}
