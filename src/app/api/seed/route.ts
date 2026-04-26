/**
 * @file        seed/route.ts
 * @module      DojoManager SaaS — Setup Inicial
 * @description Crea usuario sysadmin y catálogo de katas por defecto
 * @author      Ing. Cristhian Paul Prestán
 * @copyright   © 2025-2026 Ing. Cristhian Paul Prestán. Todos los derechos reservados.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

const DEFAULT_KATAS = [
  { name: "Taikyoku Shodan",   beltColor: "blanca",       order: 1,  description: "Primer kata básico" },
  { name: "Taikyoku Nidan",    beltColor: "blanca",       order: 2,  description: "Segundo kata básico" },
  { name: "Taikyoku Sandan",   beltColor: "amarilla",     order: 3,  description: "Tercer kata básico" },
  { name: "Heian Shodan",      beltColor: "amarilla",     order: 4,  description: "Primera forma pacífica" },
  { name: "Heian Nidan",       beltColor: "naranja",      order: 5,  description: "Segunda forma pacífica" },
  { name: "Heian Sandan",      beltColor: "naranja",      order: 6,  description: "Tercera forma pacífica" },
  { name: "Heian Yondan",      beltColor: "verde",        order: 7,  description: "Cuarta forma pacífica" },
  { name: "Heian Godan",       beltColor: "verde",        order: 8,  description: "Quinta forma pacífica" },
  { name: "Tekki Shodan",      beltColor: "azul",         order: 9,  description: "Primera jinete de hierro" },
  { name: "Tekki Nidan",       beltColor: "azul",         order: 10, description: "Segunda jinete de hierro" },
  { name: "Tekki Sandan",      beltColor: "morada",       order: 11, description: "Tercera jinete de hierro" },
  { name: "Bassai Dai",        beltColor: "café",         order: 12, description: "Asalto a la fortaleza" },
  { name: "Bassai Sho",        beltColor: "café-1-raya",  order: 13, description: "Asalto menor" },
  { name: "Kanku Dai",         beltColor: "café-2-rayas", order: 14, description: "Ver el cielo" },
  { name: "Kanku Sho",         beltColor: "café-3-rayas", order: 15, description: "Ver el cielo menor" },
  { name: "Jion",              beltColor: "negra",        order: 16, description: "Kata del templo" },
  { name: "Jitte",             beltColor: "negra-1-dan",  order: 17, description: "Diez manos" },
  { name: "Empi",              beltColor: "negra-2-dan",  order: 18, description: "Vuelo de la golondrina" },
  { name: "Sochin",            beltColor: "negra-3-dan",  order: 19, description: "Serenidad y fuerza" },
  { name: "Nijushiho",         beltColor: "negra-3-dan",  order: 20, description: "Veinticuatro pasos" },
];

export async function POST() {
  try {
    // Crear usuario sysadmin
    const existing = await prisma.user.findUnique({
      where: { email: "admin@dojomanager.com" },
    });

    if (!existing) {
      const hashed = await bcrypt.hash("Admin123!", 12);
      await prisma.user.create({
        data: {
          name:     "Administrador",
          email:    "admin@dojomanager.com",
          password: hashed,
          role:     "sysadmin",
        },
      });
    }

    // Crear catálogo de katas (upsert — idempotente)
    for (const k of DEFAULT_KATAS) {
      await prisma.kata.upsert({
        where:  { name: k.name },
        create: k,
        update: k,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Setup completado. Usuario: admin@dojomanager.com / Admin123!",
      katas: DEFAULT_KATAS.length,
    });
  } catch (err) {
    console.error("[SEED ERROR]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
