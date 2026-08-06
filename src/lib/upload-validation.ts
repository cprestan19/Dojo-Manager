// Validación compartida de archivos subidos (magic bytes + límites de tamaño).
// Usado por /api/upload (staff autenticado) y por los endpoints públicos
// de subida del coach externo (token, sin sesión NextAuth).

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

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
