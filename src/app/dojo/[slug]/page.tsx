import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import { DojoPublicPage } from "./DojoPublicPage";

interface Props { params: Promise<{ slug: string }> }

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const dojo = await prisma.dojo.findUnique({
    where:  { slug, active: true },
    select: { name: true, slogan: true, logo: true },
  });
  if (!dojo) return { title: "Dojo no encontrado" };
  return {
    title:       `${dojo.name} — Dojo Master`,
    description: dojo.slogan ?? `Conoce ${dojo.name}, un dojo de karate profesional.`,
    openGraph: {
      title:       dojo.name,
      description: dojo.slogan ?? "",
      images:      dojo.logo?.startsWith("http") ? [dojo.logo] : [],
    },
  };
}

export default async function DojoPublicPageRoute({ params }: Props) {
  const { slug } = await params;

  const dojo = await prisma.dojo.findUnique({
    where:  { slug, active: true },
    select: {
      id: true, name: true, slug: true, slogan: true,
      phone: true, email: true, instagramUrl: true,
      logo: true,
      schedules: {
        where:   { active: true },
        select:  { id: true, name: true, days: true, startTime: true, endTime: true, description: true },
        orderBy: { startTime: "asc" },
      },
      dojoPage: true,
    },
  });

  if (!dojo || !dojo.dojoPage?.published) notFound();

  return (
    <DojoPublicPage
      dojo={{
        ...dojo,
        logo: dojo.logo?.startsWith("http") ? dojo.logo : null,
        dojoPage: {
          ...dojo.dojoPage,
          aboutImage: dojo.dojoPage.aboutImage?.startsWith("http") ? dojo.dojoPage.aboutImage : null,
        },
      }}
    />
  );
}
