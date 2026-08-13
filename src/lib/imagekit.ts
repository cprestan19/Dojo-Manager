import { ImageKit } from "@imagekit/nodejs";

export interface ImageKitUploadResult {
  url:    string;
  fileId: string;
}

// Cliente construido perezosamente (no al importar el módulo) — igual
// convención que src/lib/cloudinary.ts, cuyo .config() nunca lanza aunque
// falten las credenciales. El constructor de ImageKit sí valida privateKey
// y lanza si falta, así que si se instanciara a nivel de módulo, cualquier
// ruta que importe este archivo (aunque sea transitivamente, ej. /api/payments
// vía receiptPdf.ts) fallaría al cargar en cualquier entorno sin
// IMAGEKIT_PRIVATE_KEY configurado — no solo la función que de verdad la usa.
let imagekit: ImageKit | null = null;
function getClient(): ImageKit {
  if (!imagekit) imagekit = new ImageKit({ privateKey: process.env.IMAGEKIT_PRIVATE_KEY });
  return imagekit;
}

/**
 * Sube un buffer a ImageKit — reemplazo de src/lib/cloudinary.ts para todo
 * upload NUEVO (Cloudinary se mantiene solo para lo que ya vivía ahí). A
 * diferencia de Cloudinary, ImageKit no restringe por defecto la entrega de
 * PDFs/raw files vía URL pública.
 */
export async function uploadBuffer(
  buffer:   Buffer,
  fileName: string,
  folder:   string,
  mimeType: string = "application/octet-stream",
): Promise<ImageKitUploadResult> {
  const file = await ImageKit.toFile(buffer, fileName, { type: mimeType });
  const result = await getClient().files.upload({ file, fileName, folder, useUniqueFileName: true });
  if (!result.url || !result.fileId) throw new Error("ImageKit upload sin url/fileId en la respuesta");
  return { url: result.url, fileId: result.fileId };
}

export async function deleteFile(fileId: string): Promise<void> {
  await getClient().files.delete(fileId);
}
