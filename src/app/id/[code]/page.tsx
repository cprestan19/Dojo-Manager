import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Montserrat } from "next/font/google";
import prisma from "@/lib/prisma";
import CardClient from "./CardClient";
import QRCode from "qrcode";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "600", "800"] });

type Params = { params: Promise<{ code: string }> };

export const dynamic = "force-dynamic";

export default async function StudentCardPage({ params }: Params) {
  const { code } = await params;

  // El carnet público se busca por cardToken (token impredecible),
  // no por studentCode (secuencial y por lo tanto enumerable).
  const student = await prisma.student.findFirst({
    where: { cardToken: code },
    select: {
      fullName:    true,
      photo:       true,
      motherName:  true,
      motherPhone: true,
      fatherName:  true,
      fatherPhone: true,
      dojo: {
        select: { id: true, name: true, logo: true, slogan: true, cardPrimaryColor: true, cardSecondaryColor: true },
      },
    },
  });

  if (!student) notFound();

  // Solo URLs de Cloudinary — nunca base64 (todas las imágenes deben estar en Cloudinary)
  const photoUrl    = student.photo?.startsWith("http") ? student.photo    : null;
  const dojoLogoUrl = student.dojo.logo?.startsWith("http") ? student.dojo.logo : null;

  // QR que apunta a esta misma página (para que cualquier cámara abra el carnet)
  // Usa NEXTAUTH_URL si está disponible; si no, deriva la URL del host de la petición
  const reqHeaders = await headers();
  const host       = reqHeaders.get("host") ?? "";
  const proto      = host.startsWith("localhost") ? "http" : "https";
  const base       = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "") || `${proto}://${host}`;
  const cardUrl    = `${base}/id/${code}`;
  const qrDataUrl = await QRCode.toDataURL(cardUrl, {
    width: 420,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0A0A0A", light: "#FFFFFF" },
  });

  // Contacto: prioridad madre → padre
  const contact = {
    name:  student.motherName?.trim()  || student.fatherName?.trim()  || null,
    phone: student.motherPhone?.trim() || student.fatherPhone?.trim() || null,
  };

  return (
    <main
      className={montserrat.className}
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        gap: 24,
      }}
    >
      <CardClient
        student={{ fullName: student.fullName, photo: photoUrl }}
        dojo={{
          id: student.dojo.id,
          name: student.dojo.name,
          logo: dojoLogoUrl,
          slogan: student.dojo.slogan,
          primaryColor: student.dojo.cardPrimaryColor,
          secondaryColor: student.dojo.cardSecondaryColor,
        }}
        contact={contact}
        qrDataUrl={qrDataUrl}
      />
    </main>
  );
}
