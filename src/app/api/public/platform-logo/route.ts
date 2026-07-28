import { NextResponse } from "next/server";
import { getCachedPlatformLogo } from "@/lib/queries";

// GET /api/public/platform-logo — sin autenticación, usado por landing/login/sidebar
// como fallback cuando un dojo no tiene logo propio.
export async function GET() {
  try {
    const logo = await getCachedPlatformLogo();
    return NextResponse.json({ logo }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("GET /api/public/platform-logo error:", err);
    return NextResponse.json({ logo: null }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
