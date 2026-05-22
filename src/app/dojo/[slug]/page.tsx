import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import { DojoPublicPage } from "./DojoPublicPage";

interface Props {
  params:       Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

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

export default async function DojoPublicPageRoute({ params, searchParams }: Props) {
  const { slug }    = await params;
  const { preview } = await searchParams;
  const isPreview   = preview === "1";

  // Verificar rol del visitante — sysadmin y admin pueden ver páginas no publicadas
  const session  = await getServerSession(authOptions);
  const role     = (session?.user as { role?: string })?.role;
  const isSysadmin = role === "sysadmin";
  const isAdmin    = role === "admin";

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
      organizations: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select:  { id: true, name: true, logoUrl: true },
      },
      dojoPage: true,
    },
  });

  if (!dojo) notFound();

  // Sysadmin ve cualquier dojo; admin ve su propio dojo; público solo páginas publicadas
  const canPreview = isSysadmin || isAdmin;
  if (!canPreview && !dojo.dojoPage?.published) notFound();

  // Defaults si todavía no se guardó la configuración
  const defaultPage = {
    id: null, published: false,
    heroTitle: null, heroSubtitle: null, heroImage: null,
    aboutText: null, aboutImage: null,
    primaryColor: "#C0392B",
    showFreeTrial: true, showSchedules: true, showContact: true, showStore: false,
    address: null, galleryImages: null, stats: null, testimonials: null, sensei: null,
    createdAt: new Date(), updatedAt: new Date(),
  };

  const page = dojo.dojoPage ?? defaultPage;

  // JSON-LD para SEO local (Google Maps, búsquedas locales)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type":    "SportsClub",
    "name":     dojo.name,
    ...(dojo.slogan      && { "description": dojo.slogan }),
    ...(dojo.phone       && { "telephone":   dojo.phone }),
    ...(dojo.email       && { "email":       dojo.email }),
    ...(page.address     && { "address": { "@type": "PostalAddress", "streetAddress": page.address } }),
    ...(dojo.logo        && { "image": dojo.logo }),
    ...(dojo.instagramUrl && { "sameAs": [dojo.instagramUrl] }),
    "sport": "Karate",
    "openingHoursSpecification": dojo.schedules.map(s => {
      let days: string[] = [];
      try { days = JSON.parse(s.days); } catch { days = []; }
      const dayMap: Record<string,string> = {
        lunes:"Monday", martes:"Tuesday", miercoles:"Wednesday",
        jueves:"Thursday", viernes:"Friday", sabado:"Saturday", domingo:"Sunday",
      };
      return days.map(d => ({
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": dayMap[d] ?? d,
        "opens":  s.startTime,
        "closes": s.endTime,
      }));
    }).flat(),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Banner de vista previa — visible para admin/sysadmin cuando la página no está publicada */}
      {canPreview && !page.published && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-4 px-4 py-2.5 text-sm font-semibold"
          style={{ background: "#F59E0B", color: "#111" }}>
          <span>⚠️ Vista previa — esta página aún NO está publicada al público</span>
          <a href="/dashboard/settings/public-page" className="underline hover:opacity-70 transition-opacity">
            ← Ir al editor
          </a>
        </div>
      )}
      <div style={isPreview ? { marginTop: "44px" } : undefined}>
        <DojoPublicPage
          dojo={{
            ...dojo,
            logo: dojo.logo?.startsWith("http") ? dojo.logo : null,
            dojoPage: {
              ...page,
              aboutImage: page.aboutImage?.startsWith("http") ? page.aboutImage : null,
              heroImage:  page.heroImage?.startsWith("http")  ? page.heroImage  : null,
            },
          }}
        />
      </div>
    </>
  );
}
