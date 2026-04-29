import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

interface RateBucket { count: number; resetAt: number }
const rateLimitStore = new Map<string, RateBucket>();

function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now    = Date.now();
  const bucket = rateLimitStore.get(key);

  if (!bucket || now > bucket.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  bucket.count += 1;
  if (bucket.count > maxRequests) return false;
  return true;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip           = getClientIp(req);

  // ── Rate limit: scanner QR (público) ────────────────────────
  // 60 scans por minuto por IP — suficiente para uso legítimo
  if (pathname.startsWith("/api/scan")) {
    const allowed = rateLimit(`scan:${ip}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera un momento." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // ── Rate limit: asistencia (público) ────────────────────────
  // 120 marcaciones por minuto por IP — scanner de alto tráfico
  if (pathname === "/api/attendance" && req.method === "POST") {
    const allowed = rateLimit(`attendance:${ip}`, 120, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera un momento." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // ── Rate limit: login — anti brute force ─────────────────────
  // 10 intentos por 15 minutos por IP
  if (pathname.startsWith("/api/auth/callback/credentials") && req.method === "POST") {
    const allowed = rateLimit(`login:${ip}`, 10, 15 * 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos de inicio de sesión. Espera 15 minutos." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }
  }

  // ── Proteger /portal — solo role: student ───────────────────
  if (pathname.startsWith("/portal")) {
    const token          = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const isChangePwd    = pathname === "/portal/change-password";
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (token.role !== "student") return NextResponse.redirect(new URL("/dashboard", req.url));
    if (!isChangePwd && token.mustChangePassword)
      return NextResponse.redirect(new URL("/portal/change-password", req.url));
  }

  // ── Proteger rutas del dashboard ─────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    const token       = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const isChangePwd = pathname === "/dashboard/change-password";

    if (!token) return NextResponse.redirect(new URL("/login", req.url));

    if (token.role === "student") {
      return NextResponse.redirect(new URL("/portal", req.url));
    }

    if (!isChangePwd && token.mustChangePassword) {
      return NextResponse.redirect(new URL("/dashboard/change-password", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/portal/:path*",
    "/api/scan",
    "/api/scan/:path*",
    "/api/attendance",
    "/api/auth/callback/credentials",
  ],
};
