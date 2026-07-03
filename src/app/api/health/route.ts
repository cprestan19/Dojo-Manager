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
  const allSet = VARS.every((k) => !!(process.env[k]?.trim()));
  return NextResponse.json({ ok: allSet }, { status: allSet ? 200 : 500 });
}
