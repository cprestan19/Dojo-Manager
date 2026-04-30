import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type SessionUser = { role?: string };

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role } = session.user as SessionUser;
  if (role !== "sysadmin")
    return NextResponse.json({ error: "Solo sysadmin" }, { status: 403 });

  const res = NextResponse.json({ ok: true });
  res.cookies.delete("sx-dojo");
  res.cookies.delete("sx-dojo-name");
  return res;
}
