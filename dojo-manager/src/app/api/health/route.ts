import { NextResponse } from "next/server";

const VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "ENCRYPTION_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "NEXT_PUBLIC_APP_URL",
];

export async function GET() {
  const status: Record<string, boolean> = {};
  for (const key of VARS) {
    status[key] = !!(process.env[key]?.trim());
  }
  const missing = Object.entries(status).filter(([, ok]) => !ok).map(([k]) => k);
  return NextResponse.json({ ok: missing.length === 0, missing, set: Object.keys(status).filter(k => status[k]) },
    { status: missing.length === 0 ? 200 : 500 });
}
