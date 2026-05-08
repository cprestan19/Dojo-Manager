/**
 * Runtime validation of required environment variables.
 * Called once when the Prisma client is first created so the error
 * appears immediately at startup, not buried in a request handler.
 *
 * Add new required vars here as the project grows.
 */

interface EnvVar { key: string; description: string }

const REQUIRED: EnvVar[] = [
  {
    key:         "DATABASE_URL",
    description: "PostgreSQL connection string — e.g. postgresql://user:pass@host/db?sslmode=require",
  },
  {
    key:         "NEXTAUTH_SECRET",
    description: "JWT signing secret. Generate with: openssl rand -base64 32",
  },
  {
    key:         "ENCRYPTION_KEY",
    description: "AES-256 key (32 bytes base64) for SMTP password encryption. " +
                 "Generate with: node -e \"require('crypto').randomBytes(32).toString('base64')|console.log\"",
  },
  {
    key:         "CLOUDINARY_CLOUD_NAME",
    description: "Cloudinary cloud name (dashboard.cloudinary.com → Settings → Account)",
  },
  {
    key:         "CLOUDINARY_API_KEY",
    description: "Cloudinary API key",
  },
  {
    key:         "CLOUDINARY_API_SECRET",
    description: "Cloudinary API secret — keep server-side only",
  },
];

export function validateEnv(): void {
  const missing = REQUIRED.filter(({ key }) => !process.env[key]?.trim());

  if (missing.length === 0) return;

  const list = missing
    .map(({ key, description }) => `  • ${key}\n      ${description}`)
    .join("\n");

  throw new Error(
    `[env] ${missing.length} required environment variable(s) are not set:\n\n${list}\n\n` +
    `Copy .env.example → .env.local and fill in the values, then restart the server.`,
  );
}
