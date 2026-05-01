import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const slug = new URL(req.url).searchParams.get("slug");

  const dojo = slug
    ? await prisma.dojo.findUnique({
        where: { slug, active: true },
        select: { loginBgImage: true, name: true },
      })
    : await prisma.dojo.findFirst({
        where: { active: true },
        select: { loginBgImage: true, name: true },
      });

  // Only return Cloudinary URLs — never legacy base64 (would bloat the login page)
  const bg = dojo?.loginBgImage;
  return NextResponse.json({
    loginBgImage: bg?.startsWith("http") ? bg : null,
    dojoName:     dojo?.name ?? "Dojo Master",
  });
}
