import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadBuffer, UploadType } from "@/lib/cloudinary";
import { getEffectiveDojoId } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];

/** Verifica magic bytes para que el contenido real coincida con el tipo declarado. */
function checkMagicBytes(buf: Buffer, type: "image" | "video"): boolean {
  if (buf.length < 12) return false;
  if (type === "image") {
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true;                          // JPEG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true;       // PNG
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true;       // GIF
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&                  // WebP (RIFF....WEBP)
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true;
    return false;
  }
  // video
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return true;         // WebM
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return true;         // MP4/MOV (ftyp box)
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&                    // AVI (RIFF....AVI )
      buf[8] === 0x41 && buf[9] === 0x56 && buf[10] === 0x49 && buf[11] === 0x20) return true;
  return false;
}

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

  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
  if (type !== "image" && type !== "video")
    return NextResponse.json({ error: "Tipo inválido (image|video)" }, { status: 400 });

  const uploadType = type as UploadType;
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
    : purpose === "login-bg"                      ? "login-backgrounds"
    : purpose === "card-template"                 ? "card-templates"
    : purpose === "event-image"                   ? "events"
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
