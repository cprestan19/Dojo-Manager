import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBrowserUploadAuth } from "@/lib/imagekit";
import { getDojoUploadFolder } from "@/lib/media";
import { getEffectiveDojoId, NO_DOJO_CONTEXT_ERROR } from "@/lib/sysadmin-context";

type SessionUser = { role?: string; dojoId?: string | null };

// Returns short-lived ImageKit auth params so the browser can upload
// videos directly to ImageKit, bypassing Vercel's 4.5 MB body limit.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { role, dojoId: sessionDojoId } = session.user as SessionUser;
  if (role !== "sysadmin" && role !== "admin")
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

  const dojoId = getEffectiveDojoId(role, sessionDojoId, req);
  if (!dojoId) return NextResponse.json({ error: NO_DOJO_CONTEXT_ERROR }, { status: 403 });

  const folder = `dojo-manager/${await getDojoUploadFolder(dojoId)}/belt-videos`;
  const auth   = getBrowserUploadAuth();

  return NextResponse.json({ ...auth, folder });
}
