/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [],
    dangerouslyAllowSVG: true,
  },

  // Packages that use native Node.js / browser APIs — exclude from webpack bundling
  serverExternalPackages: [
    "pg",
    "nodemailer",
    "bcryptjs",
    "@prisma/client",
    "@prisma/adapter-pg",
    "html5-qrcode",
  ],

  webpack(config, { isServer }) {
    if (!isServer) {
      // Browser bundles don't need Node.js built-ins
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs:     false,
        net:    false,
        tls:    false,
        dns:    false,
        child_process: false,
        crypto: false,
      };
    }
    // html5-qrcode uses browser APIs — never bundle it server-side
    if (isServer) {
      config.externals = [...(config.externals || []), "html5-qrcode"];
    }
    return config;
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",         value: "DENY" },
          { key: "X-Content-Type-Options",   value: "nosniff" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
