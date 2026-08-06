import crypto from "crypto";

const CBC_ALGORITHM = "aes-256-cbc"; // formato legado — solo lo usa decrypt()
const GCM_ALGORITHM = "aes-256-gcm"; // formato actual — encrypt() siempre escribe esto
const IV_LENGTH_GCM = 12;            // tamaño de IV recomendado para GCM
const GCM_PREFIX     = "gcm:";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY not set in environment variables");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
  return buf;
}

// AES-256-GCM: cifrado AUTENTICADO — a diferencia del CBC anterior, si el
// ciphertext fue manipulado el decrypt() falla en vez de devolver basura o
// quedar expuesto a bit-flipping. encrypt() siempre escribe este formato
// nuevo (prefijo "gcm:"); decrypt() sigue leyendo el formato CBC viejo sin
// prefijo para no romper contraseñas SMTP ya guardadas en la BD con el
// esquema anterior — se re-cifran solas en GCM la próxima vez que se
// guarden desde el panel de correo.
export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const iv     = crypto.randomBytes(IV_LENGTH_GCM);
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, getKey(), iv);
  const enc    = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return GCM_PREFIX + iv.toString("hex") + ":" + tag.toString("hex") + ":" + enc.toString("hex");
}

function decryptGcm(body: string): string {
  const [ivHex, tagHex, encHex] = body.split(":");
  if (!ivHex || !tagHex || !encHex) return "";
  const decipher = crypto.createDecipheriv(GCM_ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}

function decryptCbc(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(":");
  if (!ivHex || !encHex) return "";
  const decipher = crypto.createDecipheriv(CBC_ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext) return "";
  if (ciphertext.startsWith(GCM_PREFIX)) return decryptGcm(ciphertext.slice(GCM_PREFIX.length));
  return decryptCbc(ciphertext);
}

export function isEncrypted(value: string): boolean {
  if (value.startsWith(GCM_PREFIX)) return /^gcm:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/.test(value);
  return /^[0-9a-f]{32}:[0-9a-f]+$/.test(value); // formato CBC legado
}
