import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST() {
  try {
    // 1. Crear dojo por defecto
    const dojo = await prisma.dojo.upsert({
      where:  { slug: "dojo-principal" },
      create: { name: "Dojo Principal", slug: "dojo-principal" },
      update: {},
    });

    // 2. Crear usuario sysadmin (sin dojo — acceso global)
    const hashed = await bcrypt.hash("Admin123!", 12);
    await prisma.user.upsert({
      where:  { email: "admin@dojomaster.com" },
      create: { name: "Administrador", email: "admin@dojomaster.com", password: hashed, role: "sysadmin", dojoId: null },
      update: {},
    });

    // 3. Crear usuario admin del dojo
    const hashedAdmin = await bcrypt.hash("Admin123!", 12);
    await prisma.user.upsert({
      where:  { email: "admin@dojo-principal.com" },
      create: { name: "Admin Dojo Principal", email: "admin@dojo-principal.com", password: hashedAdmin, role: "admin", dojoId: dojo.id },
      update: {},
    });

    // 4. Crear katas del dojo
    const katas = [
      { name: "Taikyoku Shodan",  beltColor: "blanca",       order: 1  },
      { name: "Taikyoku Nidan",   beltColor: "blanca",       order: 2  },
      { name: "Heian Shodan",     beltColor: "amarilla",     order: 3  },
      { name: "Heian Nidan",      beltColor: "naranja",      order: 4  },
      { name: "Heian Sandan",     beltColor: "naranja",      order: 5  },
      { name: "Heian Yondan",     beltColor: "verde",        order: 6  },
      { name: "Heian Godan",      beltColor: "verde",        order: 7  },
      { name: "Tekki Shodan",     beltColor: "azul",         order: 8  },
      { name: "Tekki Nidan",      beltColor: "azul",         order: 9  },
      { name: "Tekki Sandan",     beltColor: "morada",       order: 10 },
      { name: "Bassai Dai",       beltColor: "café",         order: 11 },
      { name: "Bassai Sho",       beltColor: "café-1-raya",  order: 12 },
      { name: "Kanku Dai",        beltColor: "café-2-rayas", order: 13 },
      { name: "Kanku Sho",        beltColor: "café-3-rayas", order: 14 },
      { name: "Jion",             beltColor: "negra",        order: 15 },
      { name: "Jitte",            beltColor: "negra-1-dan",  order: 16 },
      { name: "Empi",             beltColor: "negra-2-dan",  order: 17 },
      { name: "Sochin",           beltColor: "negra-3-dan",  order: 18 },
    ];

    for (const k of katas) {
      await prisma.kata.upsert({
        where:  { name_dojoId: { name: k.name, dojoId: dojo.id } },
        create: { ...k, dojoId: dojo.id },
        update: k,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Setup completado.",
      logins: {
        sysadmin: "admin@dojomaster.com / Admin123!  (acceso global)",
        admin:    `admin@dojo-principal.com / Admin123!  (dojo: ${dojo.name})`,
        loginUrl: `/login?dojo=dojo-principal`,
      },
    });

  } catch (err) {
    console.error("SEED ERROR:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
