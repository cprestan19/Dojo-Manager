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
 * Proveedor de medios para TODO upload nuevo de la app (fotos de alumno,
 * fotos de usuario, logos, videos de cinta, imágenes de eventos, plantillas
 * de carnet, certificados, torneos, recibos de WhatsApp). Cloudinary
 * (src/lib/cloudinary.ts) queda congelado — solo sirve los archivos que ya
 * estaban ahí antes de esta migración; nada nuevo debe subirse allí porque
 * es significativamente más caro que ImageKit.
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

export interface BrowserUploadAuth {
  token:      string;
  expire:     number;
  signature:  string;
  publicKey:  string;
  urlEndpoint: string;
}

/**
 * Parámetros de autenticación para que el navegador suba un archivo
 * directamente a ImageKit (sin pasar por nuestro servidor/Vercel) — usado
 * para videos grandes de cinta, igual propósito que la firma temporal de
 * Cloudinary que reemplaza. La clave privada nunca sale del servidor; solo
 * viaja la firma HMAC ya calculada.
 */
export function getBrowserUploadAuth(): BrowserUploadAuth {
  const { token, expire, signature } = getClient().helper.getAuthenticationParameters();
  return {
    token, expire, signature,
    publicKey:   process.env.IMAGEKIT_PUBLIC_KEY!,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
  };
}
