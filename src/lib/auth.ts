import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { logAudit } from "@/lib/audit";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 }, // 24 h — previene sesiones huérfanas en dispositivos compartidos
  pages: { signIn: "/login" },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",      type: "email"    },
        password: { label: "Contraseña", type: "password" },
        dojoSlug: { label: "Dojo",       type: "text"     }, // opcional — login por página de dojo
      },
      async authorize(credentials, req) {
        const ip        = (req?.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
                       ?? (req?.headers?.["x-real-ip"] as string | undefined)
                       ?? "unknown";
        const userAgent = (req?.headers?.["user-agent"] as string | undefined) ?? null;

        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where:   { email: credentials.email.toLowerCase().trim() },
          include: { student: { select: { photo: true } } },
        });

        if (!user) {
          await logAudit({ action: "LOGIN_FAILED", userEmail: credentials.email, ip, userAgent, details: "Usuario no encontrado" });
          return null;
        }
        if (!user.active) {
          await logAudit({ action: "LOGIN_FAILED", userEmail: user.email, userId: user.id, dojoId: user.dojoId, ip, userAgent, details: "Usuario inactivo" });
          return null;
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);
        if (!passwordMatch) {
          await logAudit({ action: "LOGIN_FAILED", userEmail: user.email, userId: user.id, dojoId: user.dojoId, ip, userAgent, details: "Contraseña incorrecta" });
          return null;
        }

        // ── Validación de acceso por página de dojo ────────────────
        if (credentials.dojoSlug) {
          const slug = credentials.dojoSlug.trim().toLowerCase();
          const dojo = await prisma.dojo.findUnique({
            where:  { slug, active: true },
            select: { id: true },
          });

          // Dojo no existe o inactivo
          if (!dojo) {
            await logAudit({ action: "LOGIN_FAILED", userEmail: user.email, userId: user.id, dojoId: user.dojoId, ip, userAgent, details: `Dojo '${slug}' no encontrado` });
            return null;
          }

          // Sysadmin PUEDE entrar por cualquier página de dojo (acceso global)
          // Solo se registra como evento informativo para auditoría
          if (user.role === "sysadmin") {
            await logAudit({
              action:   "SYSADMIN_DOJO_LOGIN",
              userId:    user.id,
              userEmail: user.email,
              ip,
              userAgent,
              details:  `Sysadmin accedió vía página del dojo '${slug}'`,
            });
            // No retorna null — el sysadmin continúa con login normal
          } else {
            // El usuario debe pertenecer a ESTE dojo exactamente
            if (user.dojoId !== dojo.id) {
              await logAudit({
                action:   "SECURITY_ANOMALY",
                userId:    user.id,
                userEmail: user.email,
                dojoId:    user.dojoId,
                ip,
                userAgent,
                details:  `⚠️ Intento de acceso al dojo '${slug}' por usuario de OTRO dojo. IP: ${ip}`,
              });
              return null;
            }
          }
        }
        // ────────────────────────────────────────────────────────────

        await logAudit({ action: "LOGIN_SUCCESS", userId: user.id, userEmail: user.email, dojoId: user.dojoId, ip, userAgent });

        return {
          id:                 user.id,
          email:              user.email,
          name:               user.name,
          role:               user.role,
          dojoId:             user.dojoId,
          studentId:          user.studentId ?? null,
          mustChangePassword: user.mustChangePassword,
          photoUrl:           user.photo ?? user.student?.photo ?? null,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { role?: string; dojoId?: string | null; studentId?: string | null; mustChangePassword?: boolean; photoUrl?: string | null };
        token.id                 = user.id;
        token.role               = u.role      ?? "user";
        token.dojoId             = u.dojoId    ?? null;
        token.studentId          = u.studentId ?? null;
        token.mustChangePassword = u.mustChangePassword ?? false;
        // UUID fijo por sesión — correlaciona todos los eventos del mismo login en el audit log
        token.sessionId          = randomUUID();
        // Only store URL-based photos in JWT — base64 strings exceed the 4 KB cookie limit
        const raw = u.photoUrl ?? null;
        token.picture = raw?.startsWith("http") ? raw : null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as {
          id?: string; role?: string; dojoId?: string | null; studentId?: string | null;
          mustChangePassword?: boolean; sessionId?: string;
        };
        u.id                 = token.id        as string;
        u.role               = token.role      as string;
        u.dojoId             = token.dojoId    as string | null;
        u.studentId          = token.studentId as string | null;
        u.mustChangePassword = token.mustChangePassword as boolean;
        u.sessionId          = token.sessionId as string | undefined;
        session.user.image   = (token.picture  as string | null) ?? null;
      }
      return session;
    },
  },
};
