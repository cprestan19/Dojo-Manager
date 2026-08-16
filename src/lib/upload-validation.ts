// Validación compartida de archivos subidos (magic bytes + límites de tamaño).
// Usado por /api/upload (staff autenticado) y por los endpoints públicos
// de subida del coach externo (token, sin sesión NextAuth).

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;  // 5 MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB — videos ya subidos con más peso se mantienen igual

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];

/** Verifica magic bytes para que el contenido real coincida con el tipo declarado. */
export function checkMagicBytes(buf: Buffer, type: "image" | "video"): boolean {
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

/**
 * Verifica que una URL apunte al propio cloud de Cloudinary del proyecto.
 * Usar SIEMPRE que se acepte una `imageUrl`/`videoUrl` con origen del
 * cliente (en vez del resultado de `/api/upload`) y que el servidor luego
 * vaya a hacer `fetch()` sobre ella — evita SSRF hacia hosts internos.
 */
export function isOwnCloudinaryUrl(url: string): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.startsWith(`/${cloudName}/`);
  } catch {
    return false;
  }
}

/** Igual que isOwnCloudinaryUrl() pero para ImageKit (uploads nuevos, ver src/lib/imagekit.ts). */
export function isOwnImageKitUrl(url: string): boolean {
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  if (!urlEndpoint) return false;
  try {
    const parsed   = new URL(url);
    const endpoint = new URL(urlEndpoint);
    const basePath = endpoint.pathname === "/" ? "/" : `${endpoint.pathname}/`;
    return parsed.protocol === "https:" &&
      parsed.hostname === endpoint.hostname &&
      parsed.pathname.startsWith(basePath);
  } catch {
    return false;
  }
}

/**
 * Cloudinary (legado) o ImageKit (nuevo) — los únicos dos proveedores de
 * medios propios de la app. Usar SIEMPRE que se acepte una URL de imagen con
 * origen del cliente (en vez del resultado directo de /api/upload o del SDK
 * de ImageKit) y que el servidor luego vaya a hacer fetch() sobre ella —
 * evita que un campo tipo "logo" se use como vector de SSRF hacia hosts
 * internos o el metadata service de la nube.
 */
export function isOwnMediaUrl(url: string): boolean {
  return isOwnCloudinaryUrl(url) || isOwnImageKitUrl(url);
}

/**
 * Agrega `?tr=orig-true` a una URL de video de ImageKit para que entregue
 * el archivo tal cual está guardado, sin re-transformarlo — el video ya se
 * comprimió antes de subirlo, así que dejar que ImageKit lo vuelva a
 * transformar en cada entrega solo consume la cuota (limitada) de
 * transformaciones de video del plan, sin ningún beneficio. No afecta URLs
 * de Cloudinary (legado). Usa un chequeo simple del hostname (no
 * isOwnImageKitUrl, que depende de una env var solo disponible en el
 * servidor) para poder llamarse también desde componentes de cliente.
 */
export function videoNoTransform(url: string): string {
  if (!url.includes("ik.imagekit.io")) return url;
  return url.includes("?") ? `${url}&tr=orig-true` : `${url}?tr=orig-true`;
}
