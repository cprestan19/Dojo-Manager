import { defineConfig } from "prisma/config";

// Solo cargar .env.local en desarrollo local (en Vercel las variables llegan directo de process.env)
if (!process.env.VERCEL && !process.env.DATABASE_URL) {
  const dotenv  = require("dotenv");
  const path    = require("path");
  dotenv.config({ path: path.join(process.cwd(), ".env.local") });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
