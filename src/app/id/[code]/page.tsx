import { notFound } from "next/navigation";
import { Montserrat } from "next/font/google";
import prisma from "@/lib/prisma";
import CardClient from "./CardClient";
import QRCode from "qrcode";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["500", "600", "800"] });

type Params = { params: Promise<{ code: string }> };

export const dynamic = "force-dynamic";

export default async function StudentCardPage({ params }: Params) {
  const { code } = await params;
  const numCode = parseInt(code, 10);
  if (isNaN(numCode)) notFound();

  const student = await prisma.student.findFirst({
    where: { studentCode: numCode },
    select: {
      fullName:    true,
      studentCode: true,
      photo:       true,
      active:      true,
      motherName:  true,
      motherPhone: true,
      fatherName:  true,
      fatherPhone: true,
      beltHistory: {
        orderBy: { changeDate: "desc" },
        take: 1,
        select: { beltColor: true },
      },
      dojo: {
        select: { name: true, slug: true, logo: true, phone: true, slogan: true },
      },
    },
  });

  if (!student) notFound();

  // Solo URLs de Cloudinary — nunca base64 (todas las imágenes deben estar en Cloudinary)
  const photoUrl    = student.photo?.startsWith("http")     ? student.photo     : null;
  const dojoLogoUrl = student.dojo.logo?.startsWith("http")
    ? student.dojo.logo
    : "https://res.cloudinary.com/dkkoivmt6/image/upload/v1777640589/dojo-manager/cmo53x2wm000jfcpzvk3kttxg/logos/qedojyejr9fc0rcl3twp.png";

  // QR que apunta a esta misma página (para que cualquier cámara abra el carnet)
  const base    = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const cardUrl = `${base}/id/${student.studentCode}`;
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

  // Cinta más reciente
  const beltColor = student.beltHistory[0]?.beltColor ?? "blanca";

  // Código del dojo: iniciales de palabras >2 letras, máx 2 palabras
  const words    = student.dojo.name.split(/\s+/).filter(w => w.length > 2);
  const dojoCode = words.slice(0, 2).map(w => w[0].toUpperCase()).join("") || "DJ";
  const studentId = `${dojoCode}-${String(student.studentCode).padStart(4, "0")}`;

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
        student={{ fullName: student.fullName, studentCode: student.studentCode ?? 0, studentId, photo: photoUrl, beltColor, active: student.active }}
        dojo={{ name: student.dojo.name, logo: dojoLogoUrl, phone: student.dojo.phone, slogan: student.dojo.slogan }}
        contact={contact}
        qrDataUrl={qrDataUrl}
      />
    </main>
  );
}
