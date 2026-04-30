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

/** Clears all next-auth cookies on a response — used to break stale/oversized session loops */
function clearAuthCookies(req: NextRequest, res: NextResponse): void {
  req.cookies.getAll()
    .filter(c => c.name.startsWith("next-auth.") || c.name.startsWith("__Secure-next-auth."))
    .forEach(c => res.cookies.delete(c.name));
}

/** Read the JWT; handles both single-cookie and chunked-cookie sessions */
async function readToken(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  // In development (HTTP) the cookie is NOT marked Secure
  const secureCookie =
    process.env.NODE_ENV === "production" &&
    (process.env.NEXTAUTH_URL ?? "").startsWith("https");

  return getToken({ req, secret, secureCookie });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip           = getClientIp(req);

  // ── Rate limit: scanner QR ───────────────────────────────────
  if (pathname.startsWith("/api/scan")) {
    if (!rateLimit(`scan:${ip}`, 60, 60_000))
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera un momento." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
  }

  // ── Rate limit: asistencia ───────────────────────────────────
  if (pathname === "/api/attendance" && req.method === "POST") {
    if (!rateLimit(`attendance:${ip}`, 120, 60_000))
      return NextResponse.json(
        { error: "Demasiadas solicitudes. Espera un momento." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
  }

  // ── Rate limit: login brute-force ────────────────────────────
  if (pathname.startsWith("/api/auth/callback/credentials") && req.method === "POST") {
    if (!rateLimit(`login:${ip}`, 10, 15 * 60_000))
      return NextResponse.json(
        { error: "Demasiados intentos de inicio de sesión. Espera 15 minutos." },
        { status: 429, headers: { "Retry-After": "900" } },
      );
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
      // Clear potentially stale/oversized session cookies so the next login starts fresh
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
    "/api/scan",
    "/api/scan/:path*",
    "/api/attendance",
    "/api/auth/callback/credentials",
  ],
};
