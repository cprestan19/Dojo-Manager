/**
 * Shared file content validation using magic bytes (file signatures).
 * Prevents disguised malicious files (e.g., executable labeled as image/jpeg).
 * Used by the upload endpoint and the self-registration approval flow.
 */

export type AllowedFileType = "image" | "video";

export function checkMagicBytes(buf: Buffer, type: AllowedFileType): boolean {
  if (buf.length < 12) return false;

  if (type === "image") {
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true; // JPEG
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true; // PNG
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true; // GIF
    if (
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) return true; // WebP (RIFF....WEBP)
    return false;
  }

  // video
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return true; // WebM
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return true; // MP4/MOV (ftyp box)
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x41 && buf[9] === 0x56 && buf[10] === 0x49 && buf[11] === 0x20
  ) return true; // AVI (RIFF....AVI )
  return false;
}

/**
 * Decodes a base64 data URI and validates its magic bytes as an image.
 * Accepts "data:image/jpeg;base64,..." or raw base64.
 * Returns false if the content doesn't match a known image signature.
 */
export function validateBase64Image(base64: string): boolean {
  try {
    const commaIdx = base64.indexOf(",");
    const b64data  = commaIdx >= 0 ? base64.slice(commaIdx + 1) : base64;
    if (!b64data) return false;
    const buffer = Buffer.from(b64data, "base64");
    return checkMagicBytes(buffer, "image");
  } catch {
    return false;
  }
}
