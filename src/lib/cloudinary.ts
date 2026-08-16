import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// Cloudinary está CONGELADO — solo sirve/borra lo que ya se subió antes de
// la migración a ImageKit (src/lib/imagekit.ts). No se expone ningún
// uploadBuffer() acá a propósito: nada nuevo debe subirse a Cloudinary
// (es significativamente más caro). Toda subida nueva va a ImageKit.

export type UploadType = "image" | "video" | "raw";

export async function deleteResource(publicId: string, type: UploadType = "image"): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: type });
}

// Extrae el public_id de una URL de Cloudinary para poder borrarla.
// Soporta URLs con transformaciones (q_auto,f_auto), versión (v123456) y extensión.
export function extractCloudinaryPublicId(url: string | null | undefined): string | null {
  if (!url?.startsWith("https://res.cloudinary.com/")) return null;
  const afterUpload = url.split("/upload/")[1];
  if (!afterUpload) return null;
  const withoutVersion = afterUpload.replace(/^v\d+\//, "");
  const withoutExt     = withoutVersion.replace(/\.[^./]+$/, "");
  const segments       = withoutExt.split("/");
  const publicParts: string[] = [];
  let pastTransforms = false;
  for (const seg of segments) {
    if (!pastTransforms && /^[a-z]+_/.test(seg)) continue; // segmento de transformación
    pastTransforms = true;
    publicParts.push(seg);
  }
  return publicParts.join("/") || null;
}
