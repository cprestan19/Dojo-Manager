/**
 * POST /api/public/tournament-club/[token]/upload
 * Subida de imágenes del portal del coach externo (foto de atleta, logo de club,
 * comprobante de pago). Sin sesión NextAuth — igual que el resto del portal,
 * autenticado con el JWT del club (requireCoachToken). El endpoint genérico
 * /api/upload exige rol admin/sysadmin y por eso NO sirve aquí.
 */
import { NextRequest, NextResponse } from "next/server";
import { uploadBuffer } from "@/lib/imagekit";
import { requireCoachToken } from "@/lib/coach-token";
import { checkRateLimit, getClientIp, verifyClubOwnership } from "@/lib/tournament-security";
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES, checkMagicBytes } from "@/lib/upload-validation";

type Params = { params: Promise<{ token: string }> };

const PURPOSES = ["athlete-photo", "club-logo", "payment-proof"] as const;
type Purpose = (typeof PURPOSES)[number];

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, "coach-upload", 20, 60_000)) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const auth = await requireCoachToken(token);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { clubId, dojoId, tournamentId } = auth.payload;
  const ok = await verifyClubOwnership(clubId, dojoId, tournamentId);
  if (!ok) return NextResponse.json({ error: "Club no encontrado" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formato de solicitud inválido" }, { status: 400 });
  }

  const file    = formData.get("file") as File | null;
  const purpose = formData.get("purpose") as string | null;

  if (!file) return NextResponse.json({ error: "No se recibió archivo" }, { status: 400 });
  if (!purpose || !PURPOSES.includes(purpose as Purpose)) {
    return NextResponse.json({ error: "purpose inválido" }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Tipo de archivo no permitido: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: `Archivo demasiado grande (máx ${MAX_IMAGE_BYTES / 1024 / 1024} MB)` }, { status: 400 });
  }

  const subfolder = purpose === "athlete-photo" ? "athlete-photos"
    : purpose === "club-logo"                   ? "club-logos"
    :                                              "payment-proofs";
  const folder = `dojo-manager/${dojoId}/tournaments/${tournamentId}/${subfolder}`;

  try {
    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!checkMagicBytes(buffer, "image")) {
      return NextResponse.json({ error: "El contenido del archivo no corresponde al tipo declarado" }, { status: 400 });
    }

    const { url, fileId } = await uploadBuffer(buffer, file.name, folder, file.type);
    return NextResponse.json({ url, publicId: fileId }, { status: 201 });
  } catch (err) {
    console.error("[coach upload] ImageKit error:", err);
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 });
  }
}
