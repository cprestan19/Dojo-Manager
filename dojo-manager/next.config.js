/** @type {import('next').NextConfig} */

// CSP: tightened for DojoManager's actual asset sources
const ContentSecurityPolicy = [
  "default-src 'self'",
  // Scripts: self + inline (Next.js hydration requires unsafe-inline)
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Styles: self + inline (Tailwind inline styles) + Google Fonts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Fonts: self + Google Fonts CDN
  "font-src 'self' https://fonts.gstatic.com",
  // Images: self + Cloudinary + data URIs (avatars/fallbacks)
  "img-src 'self' https://res.cloudinary.com data: blob:",
  // Media: Cloudinary videos
  "media-src 'self' https://res.cloudinary.com blob:",
  // API/fetch connections: self only
  "connect-src 'self'",
  // Frames: deny all (no iframes)
  "frame-src 'none'",
  "frame-ancestors 'none'",
  // Workers (html5-qrcode uses a blob worker)
  "worker-src 'self' blob:",
].join("; ");

const nextConfig = {
  eslint: {
    // true = Next.js ignores ESLint during `next build`.
    // Enforce separately with: npx next lint (must pass in CI before deploy).
    ignoreDuringBuilds: true,
  },

  typescript: {
    // true = Next.js ignores TS errors during `next build`.
    // Enforce separately with: npx tsc --noEmit (must pass in CI before deploy).
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    dangerouslyAllowSVG: true,
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
  ],

  // Security headers applied to all routes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Clickjacking — deny all framing
          { key: "X-Frame-Options",         value: "DENY" },
          // MIME sniffing prevention
          { key: "X-Content-Type-Options",   value: "nosniff" },
          // Referrer info — only send origin on cross-origin requests
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          // Disable browser features not used by this app
          { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=(), payment=()" },
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

module.exports = nextConfig;
