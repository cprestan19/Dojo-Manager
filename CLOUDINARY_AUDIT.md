# Inventario de código relacionado con Cloudinary — DojoMaster Online

Generado por auditoría de solo lectura. No se modificó ningún archivo.

Repo: `C:\Proyectos\dojo-manager\dojo-manager`

---

## 0. Infraestructura compartida (usada por los 5 tipos de asset)

### SDK de Cloudinary — configuración y helpers genéricos

**`src/lib/cloudinary.ts`**
```ts
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

export type UploadType = "image" | "video" | "raw";

export interface UploadResult {
  url:      string;
  publicId: string;
}

export async function uploadBuffer(
  buffer:   Buffer,
  folder:   string,
  type:     UploadType = "image",
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: type,
        // Auto-quality and format for images; preserve originals for video/raw
        ...(type === "image" ? { quality: "auto", fetch_format: "auto" } : {}),
        ...(type === "video" ? { video_codec: "auto" } : {}),
        ...(type === "raw"   ? { format: "pdf" } : {}),
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    ).end(buffer);
  });
}

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

export default cloudinary;
```

**Únicas transformaciones eager configuradas en todo el repo** (dentro de `uploadBuffer`, arriba): `quality: "auto"` + `fetch_format: "auto"` para imágenes; `video_codec: "auto"` para video; `format: "pdf"` para el tipo `"raw"` (certificados). **No existe ningún resize/crop/eager-transformation server-side de Cloudinary** — todo el recorte de fotos (círculo del carnet) se hace client-side con `<canvas>` antes de subir (ver sección 1).

### Validación compartida de archivos

**`src/lib/upload-validation.ts`**
```ts
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
```

### Endpoint genérico de subida (staff autenticado)

**`src/app/api/upload/route.ts`** — punto de entrada único para fotos, logos, fondos de login, plantillas de carnet y plantillas de certificado. Requiere sesión `admin`/`sysadmin`. El `purpose` determina la subcarpeta:

```ts
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

  // El logo de plataforma es global (no de un dojo) — solo sysadmin puede subirlo.
  if (purpose === "platform-logo" && role !== "sysadmin")
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
    : purpose === "login-bg"                      ? "login-backgrounds"
    : purpose === "card-template"                 ? "card-templates"
    : purpose === "event-image"                   ? "events"
    : purpose === "platform-logo"                 ? "platform"
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
```

**⚠️ Observación**: el `switch` de `subfolder` no tiene caso para `purpose === "card-logo"` (usado por el editor de carnet, ver sección 2) ni para llamadas sin `purpose` (usado por el editor de certificados, ver sección 5) — ambos caen en el folder por defecto `"users"`. No es un problema de seguridad, solo de organización de carpetas en Cloudinary.

### Subida firmada directa al navegador (para videos grandes)

**`src/app/api/upload/video-signature/route.ts`** — el único caso donde el navegador sube **directo a Cloudinary**, sin pasar por el servidor de la app (evita el límite de 4.5 MB de body en Vercel):
```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import cloudinary from "@/lib/cloudinary";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

// Returns a short-lived Cloudinary signature so the browser can upload
// videos directly to Cloudinary, bypassing Vercel's 4.5 MB body limit.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const timestamp = Math.round(Date.now() / 1000);
  const folder    = `dojo-manager/${dojoId}/belt-videos`;

  const signature = cloudinary.utils.api_sign_request(
    { folder, timestamp },
    process.env.CLOUDINARY_API_SECRET!,
  );

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    apiKey:    process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
}
```

---

## 1. FOTOS DE ESTUDIANTES

### Flujo completo
1. El usuario selecciona/toma una foto → se recorta client-side (canvas, circular, máx 800px, JPEG calidad 0.82) → se sube a `/api/upload` (`purpose=student-photo`) → la URL resultante se guarda en `Student.photo`.
2. En el autoregistro público (`/registro/[token]`), el flujo es distinto: el navegador manda el recorte como **base64** en el body JSON, y el **servidor** lo sube a Cloudinary al aprobar al alumno.

### Componente de recorte (dashboard — alta/edición desde staff)

**`src/components/ui/PhotoCropper.tsx`**
```tsx
"use client";
import { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { X, ZoomIn, ZoomOut, RotateCw, Check, Camera } from "lucide-react";

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = url;
  });
}

function toRad(deg: number) { return (deg * Math.PI) / 180; }

function rotatedBoundingBox(w: number, h: number, deg: number) {
  const r = toRad(deg);
  return {
    width:  Math.abs(Math.cos(r) * w) + Math.abs(Math.sin(r) * h),
    height: Math.abs(Math.sin(r) * w) + Math.abs(Math.cos(r) * h),
  };
}

async function cropImage(imageSrc: string, pixelCrop: Area, rotation: number): Promise<string> {
  const image = await createImage(imageSrc);
  const rotRad = toRad(rotation);
  const { width: bW, height: bH } = rotatedBoundingBox(image.width, image.height, rotation);

  // Canvas 1: imagen entera rotada sobre su bounding box exacto
  const rot = document.createElement("canvas");
  rot.width  = bW;
  rot.height = bH;
  const rCtx = rot.getContext("2d")!;
  rCtx.translate(bW / 2, bH / 2);
  rCtx.rotate(rotRad);
  rCtx.translate(-image.width / 2, -image.height / 2);
  rCtx.drawImage(image, 0, 0);

  // Canvas 2: recorte 1:1 escalado a máx 800 px
  const size = Math.min(pixelCrop.width, 800);
  const crop = document.createElement("canvas");
  crop.width  = size;
  crop.height = size;
  crop.getContext("2d")!.drawImage(
    rot,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, size, size,
  );

  return crop.toDataURL("image/jpeg", 0.82);
}

// Componente completo: <Cropper> de react-easy-crop, cropShape="round", aspect={1}.
// onSave(croppedBase64) — ver StudentForm.tsx para qué hace con ese resultado.
```
(Existe un segundo componente casi idéntico en `src/app/registro/[token]/PhotoCropper.tsx`, mismo recorte circular 800px/0.82 JPEG, duplicado para el flujo público de autoregistro.)

### Subida desde el dashboard (staff)

**`src/components/students/StudentForm.tsx`** (líneas 207–233)
```tsx
async function handleCropSave(croppedBase64: string) {
  setRawPhoto(null);
  setPhotoUploading(true);
  setPhotoError("");
  try {
    // Convertir base64 → Blob → File (sin fetch para máxima compatibilidad)
    const [header, b64data] = croppedBase64.split(",");
    const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
    const bytes = atob(b64data);
    const arr   = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob  = new Blob([arr], { type: mime });
    const file  = new File([blob], "photo.jpg", { type: mime });
    const fd    = new FormData();
    fd.append("file", file);
    fd.append("type", "image");
    fd.append("purpose", "student-photo");
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error al subir imagen");
    setPhoto(data.url);
  } catch (err: unknown) {
    setPhotoError(err instanceof Error ? err.message : "Error al subir imagen");
  } finally {
    setPhotoUploading(false);
  }
}
```
El `photo` resultante (URL de Cloudinary, nunca base64) se manda luego en el `POST`/`PUT` a `/api/students`.

### El servidor rechaza fotos base64 en el alta directa

**`src/app/api/students/route.ts`** (líneas 116–122)
```ts
const raw = await req.json().catch(() => null);
if (!raw) return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });

// Rechazar fotos base64 — deben subirse a Cloudinary antes de guardar
if (raw.photo && typeof raw.photo === "string" && raw.photo.startsWith("data:")) {
  return NextResponse.json({ error: "La foto debe subirse a Cloudinary antes de guardar." }, { status: 400 });
}
```
Y en el `select` de listado (línea 44–53): `photo: true,  // URL Cloudinary — segura en lista (es solo un string corto)`, con saneo posterior:
```ts
// Filtrar base64 legacy — solo retornar URLs de Cloudinary
const withPhoto = students.map(s => ({
  ...s,
  photo: s.photo?.startsWith("http") ? s.photo : null,
}));
```

### Subida server-side desde base64 (autoregistro público → aprobación)

**`src/app/api/pending-students/[id]/approve/route.ts`** (líneas 1–30, 123–130)
```ts
import { uploadBuffer } from "@/lib/cloudinary";
import { validateBase64Image } from "@/lib/file-validation";

/** Sube un base64 de foto a Cloudinary. Retorna la URL o null si falla o el contenido es inválido. */
async function uploadBase64Photo(base64: string, dojoId: string): Promise<string | null> {
  try {
    // Validar magic bytes antes de subir — rechaza archivos maliciosos disfrazados de imagen
    if (!validateBase64Image(base64)) return null;
    const commaIdx = base64.indexOf(",");
    const b64data  = commaIdx >= 0 ? base64.slice(commaIdx + 1) : base64;
    if (!b64data) return null;
    const buffer = Buffer.from(b64data, "base64");
    const folder = `dojo-manager/${dojoId}/students`;
    const result = await uploadBuffer(buffer, folder, "image");
    return result.url;
  } catch {
    return null;
  }
}

// ... dentro del handler POST, justo antes de crear el Student:
// Si la foto es base64, subirla a Cloudinary antes de crear el alumno
let photoUrl: string | null = pending.photo || null;
if (photoUrl?.startsWith("data:")) {
  photoUrl = await uploadBase64Photo(photoUrl, dojoId) ?? null;
}
```

### Migración de fotos legacy (herramienta de limpieza, sysadmin)

**`src/app/api/admin/migrate-photos/route.ts`** (completo)
```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadBuffer } from "@/lib/cloudinary";

type SessionUser = { role?: string };

async function base64ToCloudinary(base64: string, folder: string): Promise<string | null> {
  try {
    const [header, b64data] = base64.split(",");
    if (!b64data) return null;
    const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) return null;
    const buffer = Buffer.from(b64data, "base64");
    if (buffer.length < 100) return null; // datos inválidos
    const result = await uploadBuffer(buffer, folder, "image");
    return result.url;
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/migrate-photos
 * Sysadmin only. Encuentra todos los registros con fotos base64 en la BD
 * y los sube a Cloudinary, actualizando el campo con la URL resultante.
 *
 * Body (opcional): { dryRun: true } → solo reporta sin migrar.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin") return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { dryRun?: boolean };
  const dryRun = body.dryRun === true;

  const stats = {
    students:  { found: 0, migrated: 0, failed: 0 },
    users:     { found: 0, migrated: 0, failed: 0 },
  };

  // Students con foto base64 (where photo startsWith "data:") → uploadBuffer a
  // `dojo-manager/{dojoId}/students`; si falla la subida, limpia el campo a null.
  // Users con foto base64 → uploadBuffer a `dojo-manager/{dojoId|global}/users`.
  // (ver código completo en el archivo — misma lógica que base64ToCloudinary arriba)

  return NextResponse.json({ ok: true, dryRun, stats, message: "..." });
}
```
*(Nota: ya se confirmó en una auditoría previa de esta sesión que, a la fecha, `Student.photo`, `User.photo` y `Dojo.logo` tienen **0 filas** en formato base64 legacy — la migración ya no tiene nada pendiente que hacer.)*

### Modelo Prisma
`Student.photo String? @db.Text`, `User.photo String? @db.Text` — ambos guardan directamente la URL de Cloudinary (`https://res.cloudinary.com/...`) como string. Sin campo `publicId` separado para estos dos (a diferencia de videos/certificados) — el `public_id` se deriva on-demand con `extractCloudinaryPublicId()` cuando hace falta borrar.

---

## 2. CARNETS / ID CARDS (formato CR80)

**No hay generación de imagen server-side ni transformaciones de Cloudinary para el carnet** — el carnet se compone 100% client-side (React + CSS absolute-positioning sobre la imagen de fondo), superponiendo: imagen de fondo (subida a Cloudinary), foto del alumno (Cloudinary), QR code (generado client-side, no es un asset de Cloudinary), texto y logo overlay (Cloudinary). El único rol de Cloudinary aquí es alojar la imagen de fondo y el logo — ninguna transformación de imagen ocurre en la URL.

### Definición de layout y dimensiones (CR80 @ 300 DPI)

**`src/lib/card-layout.ts`** (completo — 245 líneas, incluido aquí íntegro por ser el corazón del sistema de carnet)
```ts
// Dimensiones CR80 @ 300 DPI — backward compat
export const CARD_W = 638;
export const CARD_H = 1009;

// ── Presets de dimensiones ────────────────────────────────────────────────────
export const CARD_PRESETS = [
  { key: "portrait",  label: "Vertical — 638 × 1009 px",  w: 638,  h: 1009 },
  { key: "landscape", label: "Horizontal — 1009 × 638 px", w: 1009, h: 638  },
] as const;

export type CardPreset = typeof CARD_PRESETS[number]["key"];

export function getCardDimensions(preset: CardPreset): { w: number; h: number } {
  const p = CARD_PRESETS.find(p => p.key === preset);
  return p ? { w: p.w, h: p.h } : { w: CARD_W, h: CARD_H };
}

// ── Fuentes disponibles ───────────────────────────────────────────────────────
export const CARD_FONTS = [
  { key: "Montserrat",       label: "Montserrat",       google: "Montserrat:wght@700;800;900"       },
  { key: "Oswald",           label: "Oswald",           google: "Oswald:wght@600;700"               },
  { key: "Bebas Neue",       label: "Bebas Neue",       google: "Bebas+Neue"                        },
  { key: "Rajdhani",         label: "Rajdhani",         google: "Rajdhani:wght@600;700"             },
  { key: "Barlow Condensed", label: "Barlow Condensed", google: "Barlow+Condensed:wght@700;800"     },
  { key: "Roboto Condensed", label: "Roboto Condensed", google: "Roboto+Condensed:wght@700;800"     },
  { key: "Cinzel",           label: "Cinzel",           google: "Cinzel:wght@700;900"               },
  { key: "Exo 2",            label: "Exo 2",            google: "Exo+2:wght@700;800;900"            },
] as const;

export interface CardPhotoLayout {
  x: number; y: number; diameter: number;
  shape: "circle" | "rectangle";
  borderColor: string; borderWidth: number;
}
export interface CardQrLayout {
  x: number; y: number; w: number; height: number;
  frameBorderColor: string; frameBorderWidth: number; bgTransparent: boolean;
}
export interface CardNameLayout {
  y: number; fontSize: number; color: string; fontFamily: string;
  letterSpacing: number;
  shadowEnabled: boolean; shadowColor: string; shadowX: number; shadowY: number; shadowBlur: number;
  outlineEnabled: boolean; outlineColor: string; outlineWidth: number;
}
export interface CardLogoOverlayLayout {
  url:     string;   // URL Cloudinary — vacío = sin logo
  x: number; y: number; width: number;
  visible: boolean;
}
export interface CardLayout {
  preset: CardPreset;
  photo: CardPhotoLayout; qr: CardQrLayout; name: CardNameLayout;
  team: { y: number; color: string };
  slogan: { text: string; fontSize: number; color: string; fontFamily: string };
  footer: { y: number; background: string };
  contact: { x: number; y: number; width: number };
  contactColor: string;
  logoOverlay: CardLogoOverlayLayout;
}

// ── Valores por defecto (portrait) ──────────────────────────────────────────
export const DEFAULT_CARD_LAYOUT: CardLayout = {
  preset: "portrait",
  photo: { x: 109, y: 120, diameter: 420, shape: "circle", borderColor: "#CC0000", borderWidth: 4 },
  qr:    { x: 128, y: 624, w: 340, height: 310, frameBorderColor: "", frameBorderWidth: 2, bgTransparent: false },
  name:  { y: 552, fontSize: 38, color: "#000000", fontFamily: "Montserrat", letterSpacing: 0,
    shadowEnabled: false, shadowColor: "#000000", shadowX: 2, shadowY: 2, shadowBlur: 4,
    outlineEnabled: false, outlineColor: "#FFFFFF", outlineWidth: 1 },
  team:    { y: 600, color: "#CC0000" },
  slogan:  { text: "", fontSize: 15, color: "#ffffff", fontFamily: "Montserrat" },
  footer:  { y: 940, background: "#000000" },
  contact: { x: 476, y: 624, width: 158 },
  contactColor: "#000000",
  logoOverlay: { url: "", x: 20, y: 20, width: 120, visible: false },
};
// DEFAULT_LANDSCAPE_LAYOUT análogo, con dimensiones 1009×638.

// parseCardLayout(raw): deep-merge del JSON guardado en BD con los defaults
// (backward compatible si se agregan campos nuevos al layout con el tiempo).
```

### Subida de la imagen de fondo del carnet (hasta 3 plantillas por dojo)

**`src/app/dashboard/settings/card-template/page.tsx`** (líneas 858–927)
```tsx
// ── Subir imagen de fondo ─────────────────────────────────────────────────
async function handleTplFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert("El archivo supera 5 MB"); return; }
  const tabAtStart = currentTab; // capturar tab al inicio (async-safe)
  setTplError(""); setTplUploading(true);
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "image");
    fd.append("purpose", "card-template");
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      const idx = tabAtStart - 1;
      setSlots(prev => {
        const next = [...prev] as [CardSlot, CardSlot, CardSlot];
        next[idx] = { ...next[idx], templateUrl: data.url };
        return next;
      });
    } else {
      setTplError(data.error ?? "Error al subir la imagen");
    }
  } catch {
    setTplError("Error de conexión");
  } finally {
    setTplUploading(false);
    if (tplFileRef.current) tplFileRef.current.value = "";
  }
}

// ── Subir logo overlay ────────────────────────────────────────────────────
async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert("El archivo supera 5 MB"); return; }
  const tabAtStart = currentTab;
  setLogoError(""); setLogoUploading(true);
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "image");
    fd.append("purpose", "card-logo");   // ⚠️ ver observación de la sección 0 — no mapea a subcarpeta propia
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) {
      const idx = tabAtStart - 1;
      setSlots(prev => {
        const next = [...prev] as [CardSlot, CardSlot, CardSlot];
        next[idx] = {
          ...next[idx],
          layout: { ...next[idx].layout, logoOverlay: { ...next[idx].layout.logoOverlay, url: data.url, visible: true } },
        };
        return next;
      });
    } else {
      setLogoError(data.error ?? "Error al subir el logo");
    }
  } catch {
    setLogoError("Error de conexión");
  } finally {
    setLogoUploading(false);
    if (logoFileRef.current) logoFileRef.current.value = "";
  }
}

// ── Guardar todo (persiste en Dojo vía PUT /api/dojo) ────────────────────
async function handleSave() {
  setSaving(true); setSaved(false);
  const url = role === "sysadmin" && selectedId ? `/api/dojo?id=${selectedId}` : "/api/dojo";
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cardTemplateImage:  slots[0].templateUrl,
      cardLayout:         slots[0].layout,
      cardTemplateImage2: slots[1].templateUrl,
      cardLayout2:        slots[1].layout,
      cardTemplateImage3: slots[2].templateUrl,
      cardLayout3:        slots[2].layout,
      activeCardSlot:     activeSlot,
    }),
  });
}
```

### Renderizado del carnet público

**`src/app/id/[code]/page.tsx`** + **`src/app/id/[code]/CardClient.tsx`** — página pública gateada por `Student.cardToken` (UUID no adivinable). Confirmado por grep: **no contienen ninguna referencia a `cloudinary` ni construyen URLs de transformación** — solo consumen `cardTemplateImage`/`logoOverlay.url`/`Student.photo` como `<img src>` planos, posicionados con CSS absoluto según `CardLayout`.

### Guardado / borrado en `Dojo` (con limpieza automática de Cloudinary)

**`src/app/api/dojo/route.ts`** (líneas 114–133 — lógica de borrado de imágenes reemplazadas)
```ts
// Borrar imágenes antiguas de Cloudinary cuando se reemplazan o eliminan
const IMAGE_FIELDS = ["logo", "loginBgImage", "cardTemplateImage", "cardTemplateImage2", "cardTemplateImage3"] as const;
const hasImageChange = IMAGE_FIELDS.some(f => f in body);
if (hasImageChange) {
  const current = await prisma.dojo.findUnique({
    where:  { id: targetId },
    select: { logo: true, loginBgImage: true, cardTemplateImage: true, cardTemplateImage2: true, cardTemplateImage3: true },
  });
  if (current) {
    const toDelete: string[] = [];
    for (const field of IMAGE_FIELDS) {
      if (field in body && body[field] !== current[field]) {
        const pid = extractCloudinaryPublicId(current[field]);
        if (pid) toDelete.push(pid);
      }
    }
    if (toDelete.length > 0)
      Promise.all(toDelete.map(pid => deleteResource(pid).catch(() => {})));
  }
}
```
(`cardTemplateImage2`/`3` se guardan en el `data:` del `update()`, pero **no** están en el `IMAGE_FIELDS` de borrado — ver detalle: sí están, se agregaron correctamente en el array de arriba. `cardLayout`/`cardLayout2`/`cardLayout3` (JSON del layout) y `activeCardSlot` se persisten sin pasar por Cloudinary — son datos puramente estructurales.)

### Modelos Prisma involucrados
`Student.cardToken String? @unique` (token del link público `/id/[code]`), más los campos `card*` de `Dojo` (ver resumen de schema al final).

---

## 3. VIDEOS DE KATA

Dos videos por registro: el kata principal (`videoUrl`/`publicId`) y opcionalmente el "Tachi Kata" (`tachiKataUrl`/`tachiKataPublicId`). Sube directo del navegador a Cloudinary (firma temporal), con soporte de **subida por partes (chunked)** para archivos grandes.

### Subida directa firmada + chunked (cliente)

**`src/app/dashboard/settings/videos/page.tsx`** (líneas 88–184)
```tsx
// Cloudinary corta la conexión (sin responder) cuando un solo POST supera
// los 100 MB — el navegador lo reporta como "Failed to fetch". Por eso los
// archivos grandes se dividen en partes usando su API de subida chunked.
// 6 MB — tamaño de referencia de la propia documentación de Cloudinary,
// más confiable en conexiones lentas que partes de 20 MB.
const CLOUDINARY_CHUNK_SIZE = 6 * 1024 * 1024;

type CloudinaryUploadResponse = { secure_url?: string; public_id?: string; error?: { message: string } };

// Sube un video directamente a Cloudinary desde el navegador usando una
// firma temporal del servidor — evita el límite de 4.5 MB de Vercel.
async function uploadVideoToCloudinary(file: File): Promise<{ url: string; publicId: string }> {
  // 1. Pedir firma al servidor
  const sigRes = await fetch("/api/upload/video-signature");
  if (!sigRes.ok) throw new Error("No se pudo iniciar la subida. Intenta de nuevo.");
  const { signature, timestamp, folder, apiKey, cloudName } =
    await sigRes.json() as { signature: string; timestamp: number; folder: string; apiKey: string; cloudName: string };

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

  const baseForm = () => {
    const fd = new FormData();
    fd.append("api_key",   apiKey);
    fd.append("timestamp", String(timestamp));
    fd.append("signature", signature);
    fd.append("folder",    folder);
    return fd;
  };

  // Archivo pequeño: subida simple, un solo request
  if (file.size <= CLOUDINARY_CHUNK_SIZE) {
    const fd = baseForm();
    fd.append("file", file);
    const cloudRes  = await fetch(uploadUrl, { method: "POST", body: fd });
    const cloudData = await cloudRes.json() as CloudinaryUploadResponse;
    if (!cloudRes.ok) throw new Error(cloudData.error?.message ?? "Error al subir el video a Cloudinary");
    return { url: cloudData.secure_url!, publicId: cloudData.public_id! };
  }

  // Archivo grande: subida por partes (chunked upload de Cloudinary)
  const uploadId = crypto.randomUUID();
  let start = 0;
  let lastData: CloudinaryUploadResponse | null = null;

  while (start < file.size) {
    const end   = Math.min(start + CLOUDINARY_CHUNK_SIZE, file.size);
    const fd    = baseForm();
    fd.append("file", file.slice(start, end), file.name);

    const cloudRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Unique-Upload-Id": uploadId,
        "Content-Range":      `bytes ${start}-${end - 1}/${file.size}`,
      },
      body: fd,
    });
    lastData = await cloudRes.json() as CloudinaryUploadResponse;
    if (!cloudRes.ok) throw new Error(lastData?.error?.message ?? "Error al subir el video a Cloudinary");
    start = end;
  }

  if (!lastData?.secure_url || !lastData?.public_id) throw new Error("Error al subir el video a Cloudinary");
  return { url: lastData.secure_url, publicId: lastData.public_id };
}

async function handleVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  setUploadErr(""); setUploading(true);
  try {
    const { url, publicId } = await uploadVideoToCloudinary(file);
    setEditing(p => ({ ...p, videoUrl: url, publicId }));
  } catch (err: unknown) {
    setUploadErr(err instanceof Error ? err.message : "Error al subir video");
  } finally {
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }
}
// handleTachiFile: idéntico, para el segundo video (tachiKataUrl/tachiKataPublicId)
```

### API de metadatos (crear / listar)

**`src/app/api/belt-videos/route.ts`** (completo)
```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";
import { sendPushToStudentIdsAsync } from "@/lib/push";
import { withPlanFeatureGuard } from "@/lib/billing/planFeatureGuard";
import { NAV_KEYS } from "@/lib/permissions";
import { sanitizeStudentAllowlist } from "@/lib/belt-videos";
import { logAudit, buildAuditCtx, AUDIT_MODULE } from "@/lib/audit";

type SessionUser = { role?: string; dojoId?: string | null };

async function _GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const beltColor = new URL(req.url).searchParams.get("beltColor");
  const videos = await prisma.beltVideo.findMany({
    where:   { dojoId, ...(beltColor ? { beltColor } : {}) },
    orderBy: [{ beltColor: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(videos);
}

async function _POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const body = await req.json();
  if (!body.title?.trim()) return NextResponse.json({ error: "Título requerido" }, { status: 400 });
  if (!body.beltColor)     return NextResponse.json({ error: "Cinta requerida" }, { status: 400 });
  if (!body.videoUrl && !body.tachiKataUrl)
    return NextResponse.json({ error: "Se requiere al menos un video (kata o tachi kata)" }, { status: 400 });

  let visibleToStudentIds;
  try {
    visibleToStudentIds = await sanitizeStudentAllowlist(body.visibleToStudentIds, dojoId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Selección de alumnos inválida" }, { status: 400 });
  }

  const video = await prisma.beltVideo.create({
    data: {
      dojoId,
      beltColor:         body.beltColor,
      title:             body.title.trim(),
      description:       body.description?.trim() || null,
      videoUrl:          body.videoUrl          || null,
      publicId:          body.publicId          || null,
      tachiKataUrl:      body.tachiKataUrl      || null,
      tachiKataPublicId: body.tachiKataPublicId || null,
      order:             Number(body.order) || 0,
      visibleToStudentIds,
    },
  });

  // ... logAudit + notificación push a alumnos con acceso al video (fire-and-forget)
  return NextResponse.json(video, { status: 201 });
}

export const GET  = withPlanFeatureGuard(NAV_KEYS.SETTINGS_VIDEOS, _GET);
export const POST = withPlanFeatureGuard(NAV_KEYS.SETTINGS_VIDEOS, _POST);
```

### Borrado en Cloudinary al reemplazar/eliminar

**`src/app/api/belt-videos/[id]/route.ts`** (líneas 1–45, 85–121)
```ts
import { deleteResource } from "@/lib/cloudinary";

async function _PUT(req: NextRequest, ctx?: unknown) {
  // ...
  const existing = await prisma.beltVideo.findFirst({ where: { id, dojoId } });
  if (!existing) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });

  // If a new main video was uploaded, delete the old one from Cloudinary
  if (body.videoUrl && body.publicId && body.publicId !== existing.publicId && existing.publicId) {
    try { await deleteResource(existing.publicId, "video"); } catch { /* continue */ }
  }
  // If a new Tachi Kata video was uploaded, delete the old one from Cloudinary
  if (body.tachiKataPublicId && body.tachiKataPublicId !== existing.tachiKataPublicId && existing.tachiKataPublicId) {
    try { await deleteResource(existing.tachiKataPublicId, "video"); } catch { /* continue */ }
  }
  // If Tachi Kata was explicitly cleared (null sent), delete from Cloudinary
  if (body.tachiKataUrl === null && existing.tachiKataPublicId) {
    try { await deleteResource(existing.tachiKataPublicId, "video"); } catch { /* continue */ }
  }
  // ... prisma.beltVideo.update(...)
}

async function _DELETE(req: NextRequest, ctx?: unknown) {
  // ...
  const existing = await prisma.beltVideo.findFirst({ where: { id, dojoId } });
  if (!existing) return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });

  // Delete main video and Tachi Kata from Cloudinary, then from DB
  if (existing.publicId) {
    try { await deleteResource(existing.publicId, "video"); } catch { /* continue */ }
  }
  if (existing.tachiKataPublicId) {
    try { await deleteResource(existing.tachiKataPublicId, "video"); } catch { /* continue */ }
  }
  await prisma.beltVideo.delete({ where: { id } });
}

export const PUT    = withPlanFeatureGuard(NAV_KEYS.SETTINGS_VIDEOS, _PUT);
export const DELETE = withPlanFeatureGuard(NAV_KEYS.SETTINGS_VIDEOS, _DELETE);
```

### Consumo en el portal del alumno

`src/app/api/portal/belt-videos/route.ts` y `src/app/portal/videos/page.tsx` — filtran por cintas obtenidas (`BeltHistory`) o por `visibleToStudentIds` allowlist; **confirmado sin ninguna referencia a `cloudinary`** — reproducen `videoUrl`/`tachiKataUrl` directo en un `<video>` HTML, sin transformación.

### Modelo Prisma
`BeltVideo` — ver schema completo al final. Campos Cloudinary: `videoUrl`, `publicId`, `tachiKataUrl`, `tachiKataPublicId` (los 4 opcionales, ninguno con `@db.Text` porque las URLs de video no llevan base64 embebido).

---

## 4. LOGOS (de dojos y de la plataforma)

Tres niveles: logo del **dojo** individual (`Dojo.logo`), logo de la **plataforma** global (`PlatformSettings.logo`, un solo registro `id="singleton"`), y logo de **organización/federación** (`DojoOrganization.logoUrl`, subido desde el portal del coach externo — ver más abajo).

### Logo del dojo — subida (dashboard/settings)

**`src/app/dashboard/settings/page.tsx`** (líneas 98–182)
```tsx
async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { alert("El archivo supera 2 MB"); return; }
  setLogoError(""); setLogoUploading(true);
  try {
    const fd = new FormData();
    fd.append("file",    file);
    fd.append("type",    "image");
    fd.append("purpose", "dojo-logo");
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) setLogo(data.url);
    else        setLogoError(data.error ?? "Error al subir el logo");
  } catch {
    setLogoError("Error de conexión al subir el logo");
  } finally {
    setLogoUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }
}

async function handleSave() {
  setSaving(true); setSaved(false);
  const url = role === "sysadmin" && selectedId ? `/api/dojo?id=${selectedId}` : "/api/dojo";
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name, email, ownerName, phone, slogan, logo,
      reminderToleranceDays: toleranceDays,
      lateInterestPct: interestPct,
      autoRemindersEnabled, locale,
    }),
  });
  // ...
}

// Fondo de login (mismo patrón, purpose="login-bg", máx 5 MB):
async function handleBgFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert("El archivo supera 5 MB"); return; }
  setBgError(""); setBgUploading(true);
  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "image");
    fd.append("purpose", "login-bg");
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok) setLoginBgImage(data.url);
    else        setBgError(data.error ?? "Error al subir la imagen");
  } finally {
    setBgUploading(false);
  }
}
```

### Logo del dojo — GET/PUT y saneo de respuesta

**`src/app/api/dojo/route.ts`** (completo, 192 líneas — incluye la lógica de borrado ya mostrada en la sección 2)
```ts
import { deleteResource, extractCloudinaryPublicId } from "@/lib/cloudinary";

export async function GET(req: NextRequest) {
  // ...
  const dojo = await prisma.dojo.findUnique({
    where: { id: targetId },
    select: {
      // ...
      logo:             true,              // siempre — es URL corta de Cloudinary
      loginBgImage:     includeLoginBg,     // solo cuando Settings lo pide
      cardTemplateImage: includeLoginBg,
      // ...
    },
  });
  if (!dojo) return NextResponse.json({ error: "Dojo no encontrado" }, { status: 404 });

  // Sanitize: never return base64 — only Cloudinary URLs
  return NextResponse.json({
    ...dojo,
    logo:               dojo.logo               ? (dojo.logo.startsWith("http")               ? dojo.logo               : null) : null,
    loginBgImage:       dojo.loginBgImage       ? (dojo.loginBgImage.startsWith("http")       ? dojo.loginBgImage       : null) : null,
    cardTemplateImage:  dojo.cardTemplateImage  ? (dojo.cardTemplateImage.startsWith("http")  ? dojo.cardTemplateImage  : null) : null,
    cardTemplateImage2: dojo.cardTemplateImage2 ? (dojo.cardTemplateImage2.startsWith("http") ? dojo.cardTemplateImage2 : null) : null,
    cardTemplateImage3: dojo.cardTemplateImage3 ? (dojo.cardTemplateImage3.startsWith("http") ? dojo.cardTemplateImage3 : null) : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
// PUT: ver sección 2 (mismo endpoint, misma lógica de borrado de IMAGE_FIELDS).
```

### Logo global de la plataforma (sysadmin)

**`src/components/superadmin/PlatformBrandingForm.tsx`** (líneas 1–56)
```tsx
export function PlatformBrandingForm() {
  const [logo, setLogo] = useState<string | null>(null);
  // ...
  useEffect(() => {
    fetch("/api/superadmin/platform-settings")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setLogo(data.logo ?? null); })
      .finally(() => setLoading(false));
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("El archivo supera 2 MB"); return; }
    setUploadError(""); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file",    file);
      fd.append("type",    "image");
      fd.append("purpose", "platform-logo");   // solo sysadmin — ver /api/upload/route.ts línea 34
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) setLogo(data.url);
      else        setUploadError(data.error ?? "Error al subir el logo");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true); setSaved(false);
    const res = await fetch("/api/superadmin/platform-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logo }),
    });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  }
}
```

### Logo de club externo (torneos — mencionado por completitud)
`ExternalClub.logoUrl` se sube desde el portal del coach externo vía `src/app/api/public/tournament-club/[token]/upload/route.ts` — mismo `uploadBuffer`/`checkMagicBytes` que el endpoint autenticado, con validación de pertenencia al club por token JWT (no requiere sesión NextAuth).

### Modelos Prisma
`Dojo.logo`, `Dojo.loginBgImage`, `PlatformSettings.logo` (todos `String? @db.Text`), `DojoOrganization.logoUrl` (`String? @db.Text`).

---

## 5. DIPLOMAS / CERTIFICADOS

El único de los 5 tipos donde Cloudinary almacena un **PDF** (no imagen/video) como resultado final, generado server-side a partir de una plantilla + datos del alumno. Dos modelos: `CertificateTemplate` (la plantilla, imagen de fondo + posiciones de texto) y `GeneratedCertificate` (el PDF final por alumno).

### Subida de la imagen de fondo de la plantilla

**`src/app/dashboard/settings/certificados/page.tsx`** (líneas 197–218)
```tsx
async function handleImageUpload(file: File) {
  setUploading(true);
  setError("");
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("type", "image");
    // ⚠️ no se envía "purpose" — cae en el default "user-photo" del endpoint (ver sección 0)
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const d   = await res.json() as { url?: string; publicId?: string; error?: string };
    if (!res.ok) { setError(d.error ?? "Error al subir imagen"); return; }
    setSelected({
      id: "", name: file.name.replace(/\.[^.]+$/, ""),
      imageUrl: d.url!, imagePublicId: d.publicId!,
      canvasWidth: 1000, canvasHeight: 700,
      elements: [], active: true,
    });
  } finally { setUploading(false); }
}
```

### Guardado de la plantilla (con validación anti-SSRF)

**`src/app/api/certificate-templates/route.ts`** (completo)
```ts
import { isOwnCloudinaryUrl } from "@/lib/upload-validation";

// POST /api/certificate-templates — crear plantilla
export async function POST(req: NextRequest) {
  // ... auth admin/sysadmin, dojoId de sesión ...
  const body = await req.json() as {
    name: string; imageUrl: string; imagePublicId: string;
    canvasWidth?: number; canvasHeight?: number; elements: unknown;
  };

  if (!body.name?.trim())        return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  if (!body.imageUrl?.trim())    return NextResponse.json({ error: "imageUrl requerida" }, { status: 400 });
  if (!body.imagePublicId?.trim()) return NextResponse.json({ error: "imagePublicId requerido" }, { status: 400 });
  // Debe ser una URL del propio Cloudinary del proyecto (subida vía /api/upload) —
  // nunca una URL arbitraria: el servidor la va a fetchear al emitir certificados.
  if (!isOwnCloudinaryUrl(body.imageUrl.trim())) {
    return NextResponse.json({ error: "imageUrl inválida — debe ser una imagen subida a Cloudinary" }, { status: 400 });
  }

  const template = await prisma.certificateTemplate.create({
    data: {
      dojoId,
      name: body.name.trim(),
      imageUrl: body.imageUrl.trim(),
      imagePublicId: body.imagePublicId.trim(),
      canvasWidth: body.canvasWidth ?? 1000,
      canvasHeight: body.canvasHeight ?? 700,
      elements: body.elements ?? [],
    },
  });
  return NextResponse.json(template, { status: 201 });
}
```
`PUT /api/certificate-templates/[id]` (mismo archivo, `[id]/route.ts`) **no acepta `imageUrl`** en el body — solo `name`/`elements`/`canvasWidth`/`canvasHeight`. La imagen de fondo no se puede cambiar después de creada la plantilla (hay que crear una nueva).

### Generación del PDF (el único "transformador de imagen/PDF" propio del proyecto, fuera de Cloudinary)

**`src/lib/certificate-render.ts`** (completo — no usa transformaciones de Cloudinary; usa `jsPDF` para componer imagen de fondo + texto en un PDF)
```ts
import { jsPDF } from "jspdf";

export interface CertElement {
  id: string;
  type: "studentName" | "belt" | "date" | "instructor" | "customText";
  label: string; xPct: number; yPct: number; fontSize: number;
  fontFamily: string; color: string;
  fontWeight: "normal" | "bold"; fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline"; textAlign: "left" | "center" | "right";
  rotation: number;
}

export async function renderCertificatePdf(
  template: { imageUrl: string; canvasWidth: number; canvasHeight: number; elements: CertElement[] },
  values:   { studentName: string; belt: string; date: string; instructor: string },
): Promise<Buffer> {
  // 1. Descarga la imagen de fondo YA subida a Cloudinary (fetch directo a la URL)
  const imgRes = await fetch(template.imageUrl);
  if (!imgRes.ok) throw new Error("No se pudo descargar la imagen de la plantilla");
  const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
  const format   = detectImageFormat(imgBytes); // sniff de magic bytes: PNG/JPEG/WEBP

  // 2. Compone el PDF con jsPDF: imagen de fondo + cada elemento de texto posicionado por %
  const doc = new jsPDF({ unit: "px", format: [template.canvasWidth, template.canvasHeight], compress: true });
  doc.addImage(imgBytes, format, 0, 0, template.canvasWidth, template.canvasHeight);

  for (const el of template.elements) {
    const text = elementText(el, values);
    if (!text) continue;
    const font = mapFont(el.fontFamily); // aproxima Google Fonts → helvetica/times (sin embedding)
    doc.setFont(font.name, /* bold/italic */ "normal");
    doc.setFontSize(el.fontSize);
    doc.setTextColor(el.color);
    const x = (el.xPct / 100) * template.canvasWidth;
    const y = (el.yPct / 100) * template.canvasHeight;
    doc.text(text, x, y, { align: el.textAlign, baseline: "middle", angle: el.rotation ? -el.rotation : undefined });
    // + subrayado manual con doc.line() si textDecoration === "underline"
  }

  return Buffer.from(doc.output("arraybuffer")); // Buffer del PDF final, listo para subir
}
```

### Subida del PDF generado a Cloudinary (`resource_type: "raw"`) y emisión

**`src/app/api/generated-certificates/[id]/issue/route.ts`** (completo)
```ts
import { renderCertificatePdf, type CertElement } from "@/lib/certificate-render";
import { uploadBuffer } from "@/lib/cloudinary";
import { getBeltInfo } from "@/lib/utils";

// POST /api/generated-certificates/[id]/issue — renderiza el PDF real y
// pasa el certificado de DRAFT a ISSUED. Solo alcanza a certificados
// DRAFT del propio dojo, cuyo postulado siga ACCEPTED + passed=true.
export async function POST(req: NextRequest, { params }: Params) {
  // ... auth admin/sysadmin, scoping estricto por dojoId ...
  const cert = await prisma.generatedCertificate.findFirst({
    where: { id, dojoId },
    include: {
      student:  { select: { id: true, fullName: true, dojoId: true } },
      invitee:  { select: { id: true, response: true, passed: true } },
      template: { select: { imageUrl: true, canvasWidth: true, canvasHeight: true, elements: true } },
    },
  });
  if (!cert) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (cert.status !== "DRAFT")
    return NextResponse.json({ error: "Solo se pueden emitir certificados en estado DRAFT" }, { status: 400 });

  const issuedDate = cert.issuedDate.toLocaleDateString("es-PA", { timeZone: "America/Panama", day: "2-digit", month: "long", year: "numeric" });

  const pdfBuffer = await renderCertificatePdf(
    {
      imageUrl: cert.template.imageUrl, canvasWidth: cert.template.canvasWidth,
      canvasHeight: cert.template.canvasHeight, elements: cert.template.elements as unknown as CertElement[],
    },
    {
      studentName: cert.student.fullName,
      belt: `Cinta ${getBeltInfo(cert.beltColor).label}`,
      date: issuedDate,
      instructor: cert.instructorName ?? "",
    },
  );

  // Sube el PDF con resource_type "raw" (uploadBuffer detecta el tipo por el 3er argumento)
  const { url, publicId } = await uploadBuffer(pdfBuffer, `dojo-manager/${dojoId}/certificates`, "raw");

  const updated = await prisma.generatedCertificate.update({
    where: { id },
    data:  { status: "ISSUED", pdfUrl: url, pdfPublicId: publicId },
  });
  return NextResponse.json(updated);
}
```
*(`uploadBuffer` con `type: "raw"` fija `format: "pdf"` en las opciones del `upload_stream` — ver sección 0.)*

### Consumo (admin y portal del alumno)
`src/app/api/generated-certificates/route.ts` (lista, con `take: 1000`) y `src/app/api/portal/certificates/route.ts` (portal del alumno — solo `status: "ISSUED"`) devuelven `pdfUrl` directo, sin transformación; el link "Descargar PDF" es un `<a href={pdfUrl}>` plano.

### Modelos Prisma
`CertificateTemplate` y `GeneratedCertificate` — ver schema completo al final.

---

## Resumen — campos de Prisma involucrados (schema completo de los modelos)

```prisma
model Dojo {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  logo      String?  @db.Text
  // ...
  loginBgImage          String? @map("login_bg_image") @db.Text

  // Colores de marca para el carnet digital del alumno (hex). null = paleta roja/negra por defecto.
  cardPrimaryColor   String? @map("card_primary_color")
  cardSecondaryColor String? @map("card_secondary_color")
  cardTertiaryColor  String? @map("card_tertiary_color")
  cardTemplateImage  String? @map("card_template_image") @db.Text
  cardLayout         Json?   @map("card_layout")
  cardLayout2        Json?   @map("card_layout_2")
  cardTemplateImage2 String? @map("card_template_image_2") @db.Text
  cardLayout3        Json?   @map("card_layout_3")
  cardTemplateImage3 String? @map("card_template_image_3") @db.Text
  activeCardSlot     Int     @default(1) @map("active_card_slot")

  certificateTemplates    CertificateTemplate[]
  generatedCertificates   GeneratedCertificate[]
  beltVideos              BeltVideo[]
  students                Student[]
  // ...
  @@map("dojos")
}

model DojoOrganization {
  id     String @id @default(cuid())
  dojoId String @map("dojo_id")
  name    String
  logoUrl String? @map("logo_url") @db.Text // Cloudinary URL
  order   Int     @default(0)
}

model Student {
  id          String  @id @default(cuid())
  studentCode Int?    @unique
  cardToken   String? @unique @map("card_token") // token impredecible para /id/[code] (carnet público)
  dojoId String @map("dojo_id")
  fullName    String   @default("") @map("full_name")
  photo       String?  @db.Text
  // ... (resto de campos personales, sin relación a Cloudinary)
}

model User {
  id    String @id @default(cuid())
  email String @unique
  name  String
  role  String @default("user")
  photo String? @db.Text
  dojoId String? @map("dojo_id")
}

model PlatformSettings {
  id        String   @id @default("singleton")
  logo      String?  @db.Text // URL de Cloudinary
  updatedAt DateTime @updatedAt
  @@map("platform_settings")
}

model BeltVideo {
  id                  String   @id @default(cuid())
  dojoId              String   @map("dojo_id")
  beltColor           String   @map("belt_color")
  title               String
  description         String?  @db.Text
  videoUrl            String?  @map("video_url")
  publicId            String?  @map("public_id")
  tachiKataUrl        String?  @map("tachi_kata_url")
  tachiKataPublicId   String?  @map("tachi_kata_public_id")
  order               Int      @default(0)
  visibleToStudentIds Json?    @map("visible_to_student_ids")
  active              Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([dojoId])
  @@index([dojoId, beltColor])
  @@map("belt_videos")
}

model CertificateTemplate {
  id            String   @id @default(cuid())
  dojoId        String   @map("dojo_id")
  name          String
  imageUrl      String   @map("image_url") @db.Text
  imagePublicId String   @map("image_public_id")
  canvasWidth   Int      @default(1000) @map("canvas_width")
  canvasHeight  Int      @default(700) @map("canvas_height")
  elements      Json
  active        Boolean  @default(true)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  dojo         Dojo                   @relation(fields: [dojoId], references: [id], onDelete: Cascade)
  certificates GeneratedCertificate[]

  @@index([dojoId, active])
  @@map("certificate_templates")
}

model GeneratedCertificate {
  id             String    @id @default(cuid())
  dojoId         String    @map("dojo_id")
  studentId      String    @map("student_id")
  inviteeId      String?   @unique @map("invitee_id")
  templateId     String    @map("template_id")
  title          String
  beltColor      String    @map("belt_color")
  issuedDate     DateTime  @map("issued_date")
  instructorName String?   @map("instructor_name")
  pdfUrl         String?   @map("pdf_url") @db.Text
  pdfPublicId    String?   @map("pdf_public_id")
  status         String    @default("DRAFT")
  revokedReason  String?   @map("revoked_reason") @db.Text
  revokedAt      DateTime? @map("revoked_at")
  createdAt      DateTime  @default(now()) @map("created_at")

  dojo     Dojo                    @relation(fields: [dojoId], references: [id], onDelete: Cascade)
  student  Student                 @relation(fields: [studentId], references: [id], onDelete: Restrict)
  invitee  ExamApplicationInvitee? @relation(fields: [inviteeId], references: [id], onDelete: Cascade)
  template CertificateTemplate     @relation(fields: [templateId], references: [id], onDelete: Restrict)

  @@index([studentId])
  @@index([dojoId, status])
  @@index([dojoId, beltColor])
  @@index([dojoId, createdAt])
  @@map("generated_certificates")
}
```

---

## Variables de entorno relacionadas a Cloudinary

De `.env.example` (solo nombres, sin valores reales):

```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Validadas como obligatorias al arranque en `src/lib/env.ts` (líneas 26, 30, 34) — la app falla explícitamente si faltan, no hay fallback silencioso.

---

## Webhooks / notificaciones de Cloudinary

**No existen.** Se buscó explícitamente `notification_url` y cualquier referencia cruzada `cloudinary`+`webhook` en todo `src/` y `prisma/` — cero resultados. Los únicos webhooks del proyecto son de pasarelas de pago (`src/app/api/webhooks/{mercadopago,paypal,paguelofacil}`), sin relación con Cloudinary.

---

## Notas finales

- **No hay transformaciones de imagen en la URL** (ni `w_`, `h_`, `c_fill`, `e_`, ni eager transformations en Cloudinary) en ningún lugar del código — todo el recorte/composición visual (foto circular, carnet, PDF de certificado) se hace client-side (canvas) o server-side con `jsPDF`, nunca vía parámetros de transformación de Cloudinary.
- El único uso de `resource_type: "raw"` es para los PDFs de certificados; todo lo demás usa `"image"` o `"video"`.
- Patrón de borrado consistente: cada vez que un campo de Cloudinary se reemplaza o se limpia, el código intenta `deleteResource()` en Cloudinary antes o junto con el update en BD, para no dejar huérfanos — implementado de forma independiente (no centralizada) en `dojo/route.ts`, `belt-videos/[id]/route.ts`, y ausente en `students`/`users` (las fotos de alumnos/usuarios viejas NO se borran de Cloudinary al reemplazarse — posible acumulación de huérfanos, mencionado por completitud, no evaluado como hallazgo de seguridad).
