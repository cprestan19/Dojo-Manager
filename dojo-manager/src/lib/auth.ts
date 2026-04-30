import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/audit";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",      type: "email"    },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, req) {
        const ip        = (req?.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
                       ?? (req?.headers?.["x-real-ip"] as string | undefined)
                       ?? "unknown";
        const userAgent = (req?.headers?.["user-agent"] as string | undefined) ?? null;

        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where:   { email: credentials.email },
          include: { student: { select: { photo: true } } },
          // user.photo for admin/user roles; student.photo for student role
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
        // Only store URL-based photos in JWT — base64 strings exceed the 4 KB cookie limit
        const raw = u.photoUrl ?? null;
        token.picture = raw?.startsWith("http") ? raw : null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as {
          id?: string; role?: string; dojoId?: string | null; studentId?: string | null; mustChangePassword?: boolean;
        };
        u.id                 = token.id        as string;
        u.role               = token.role      as string;
        u.dojoId             = token.dojoId    as string | null;
        u.studentId          = token.studentId as string | null;
        u.mustChangePassword = token.mustChangePassword as boolean;
        session.user.image   = (token.picture  as string | null) ?? null;
      }
      return session;
    },
  },
};
