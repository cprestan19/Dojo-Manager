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
  return bucket.count <= maxRequests;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function clearAuthCookies(req: NextRequest, res: NextResponse): void {
  req.cookies.getAll()
    .filter(c => c.name.startsWith("next-auth.") || c.name.startsWith("__Secure-next-auth."))
    .forEach(c => res.cookies.delete(c.name));
}

async function readToken(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  const secureCookie =
    process.env.NODE_ENV === "production" &&
    (process.env.NEXTAUTH_URL ?? "").startsWith("https");
  return getToken({ req, secret, secureCookie });
}

function tooManyRequests(retryAfter = "60") {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Espera un momento." },
    { status: 429, headers: { "Retry-After": retryAfter } },
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip           = getClientIp(req);

  // ── Rate limits — public / unauthenticated endpoints ─────────
  // Scanner QR: generous limit for legitimate fast scans
  if (pathname.startsWith("/api/scan")) {
    if (!rateLimit(`scan:${ip}`, 60, 60_000)) return tooManyRequests("60");
  }

  // Attendance POST: public, high-traffic during class entry/exit
  if (pathname === "/api/attendance" && req.method === "POST") {
    if (!rateLimit(`attendance:${ip}`, 120, 60_000)) return tooManyRequests("60");
  }

  // Login brute-force protection
  if (pathname.startsWith("/api/auth/callback/credentials") && req.method === "POST") {
    if (!rateLimit(`login:${ip}`, 10, 15 * 60_000)) return tooManyRequests("900");
  }

  // ── Rate limits — authenticated data endpoints ────────────────
  // Students list: prevent enumeration / scraping
  if (pathname === "/api/students" || pathname.startsWith("/api/students/")) {
    if (!rateLimit(`students:${ip}`, 100, 60_000)) return tooManyRequests("60");
  }

  // Payments: financial data — stricter limit
  if (pathname === "/api/payments" || pathname.startsWith("/api/payments/")) {
    if (!rateLimit(`payments:${ip}`, 60, 60_000)) return tooManyRequests("60");
  }

  // Users: prevent enumeration attacks
  if (pathname === "/api/users" || pathname.startsWith("/api/users/")) {
    if (!rateLimit(`users:${ip}`, 30, 60_000)) return tooManyRequests("60");
  }

  // File uploads: prevent Cloudinary quota exhaustion
  if (pathname === "/api/upload" && req.method === "POST") {
    if (!rateLimit(`upload:${ip}`, 10, 60_000)) return tooManyRequests("60");
  }

  // ── Protect /portal ──────────────────────────────────────────
  if (pathname.startsWith("/portal")) {
    const token       = await readToken(req);
    const isChangePwd = pathname === "/portal/change-password";

    if (!token) {
      const res = NextResponse.redirect(new URL("/login", req.url));
      clearAuthCookies(req, res);
      return res;
    }
    if (token.role !== "student")
      return NextResponse.redirect(new URL("/dashboard", req.url));
    if (!isChangePwd && token.mustChangePassword)
      return NextResponse.redirect(new URL("/portal/change-password", req.url));
  }

  // ── Protect /dashboard ───────────────────────────────────────
  if (pathname.startsWith("/dashboard")) {
    const token       = await readToken(req);
    const isChangePwd = pathname === "/dashboard/change-password";

    if (!token) {
      const res = NextResponse.redirect(new URL("/login", req.url));
      clearAuthCookies(req, res);
      return res;
    }

    if (token.role === "student")
      return NextResponse.redirect(new URL("/portal", req.url));

    if (!isChangePwd && token.mustChangePassword)
      return NextResponse.redirect(new URL("/dashboard/change-password", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/portal/:path*",
    // Public API endpoints with rate limits
    "/api/scan",
    "/api/scan/:path*",
    "/api/attendance",
    "/api/auth/callback/credentials",
    // Authenticated data endpoints with rate limits
    "/api/students",
    "/api/students/:path*",
    "/api/payments",
    "/api/payments/:path*",
    "/api/users",
    "/api/users/:path*",
    "/api/upload",
  ],
};
