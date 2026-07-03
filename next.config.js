/** @type {import('next').NextConfig} */

// CSP: tightened for DojoManager's actual asset sources
const ContentSecurityPolicy = [
  "default-src 'self'",
  // Scripts: self + inline (Next.js hydration requires unsafe-inline) + eval (webpack dev source maps)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
  // Styles: self + inline (Tailwind inline styles) + Google Fonts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Fonts: self + Google Fonts CDN
  "font-src 'self' https://fonts.gstatic.com",
  // Images: self + Cloudinary + DiceBear avatars + data URIs (avatars/fallbacks)
  "img-src 'self' https://res.cloudinary.com https://api.dicebear.com data: blob:",
  // Media: Cloudinary videos
  "media-src 'self' https://res.cloudinary.com blob:",
  // API/fetch connections: self + Google Analytics + Cloudinary + Sentry error reporting
  "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://api.cloudinary.com https://*.ingest.us.sentry.io https://*.ingest.sentry.io",
  // Frames: YouTube embeds permitidos (portal/live, overlay, página pública torneo)
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  // Workers (html5-qrcode uses a blob worker)
  "worker-src 'self' blob:",
].join("; ");

const nextConfig = {
  // Compresión gzip — reduce tamaño de respuestas ~70%
  compress: true,

  eslint: {
    // true = Next.js ignores ESLint during `next build`.
    // Enforce separately with: npx next lint (must pass in CI before deploy).
    ignoreDuringBuilds: true,
  },

  typescript: {
    // `npm run typecheck` (tsc --noEmit) pasa limpio y corre en CI — exigirlo también en build.
    ignoreBuildErrors: false,
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
    dangerouslyAllowSVG: false,
  },

  // Packages with native Node.js APIs — exclude from webpack bundling
  serverExternalPackages: [
    "pg",
    "nodemailer",
    "bcryptjs",
    "@prisma/client",
    "@prisma/adapter-pg",
    "html5-qrcode",
    "cloudinary",
    "exceljs",
    "web-push",
  ],

  // Security headers applied to all routes
  async headers() {
    return [
      // ── Service Worker — sin cache + permitir scope raíz ─────────────────
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control",          value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type",           value: "application/javascript" },
        ],
      },
      // ── Portal privado del coach — no indexar, no cachear ────────────────
      {
        source: "/coach/:path*",
        headers: [
          { key: "Cache-Control",  value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "X-Robots-Tag",   value: "noindex, nofollow, noarchive, nosnippet" },
          { key: "Pragma",         value: "no-cache" },
        ],
      },
      // ── Páginas de overlay y acreditación — no indexar ───────────────────
      {
        source: "/tournament/:path*",
        headers: [
          { key: "X-Robots-Tag",   value: "noindex, nofollow" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          // Clickjacking — deny all framing
          { key: "X-Frame-Options",         value: "DENY" },
          // MIME sniffing prevention
          { key: "X-Content-Type-Options",   value: "nosniff" },
          // Referrer info — only send origin on cross-origin requests
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          // camera=(self) — permite cámara solo al propio dominio (necesario para Scanner QR)
          { key: "Permissions-Policy",       value: "camera=(self), microphone=(), geolocation=(), payment=()" },
          // HSTS — force HTTPS for 2 years once visited (Vercel handles HTTPS, but explicit is better)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // XSS protection — CSP is the main defense; this is a legacy fallback
          { key: "X-XSS-Protection",         value: "1; mode=block" },
          // Content Security Policy
          { key: "Content-Security-Policy",  value: ContentSecurityPolicy },
        ],
      },
    ];
  },
};

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  // Sin SENTRY_AUTH_TOKEN, el plugin omite la subida de source maps sin fallar el build.
  treeshake: { removeDebugLogging: true },
});
