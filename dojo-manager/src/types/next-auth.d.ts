import "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    dojoId?: string | null;
    studentId?: string | null;
    mustChangePassword?: boolean;
  }
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      dojoId?: string | null;
      studentId?: string | null;
      mustChangePassword?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    dojoId?: string | null;
    studentId?: string | null;
    mustChangePassword?: boolean;
  }
}
