import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import Script from "next/script";

const GA_ID = "G-KTK190P7T3";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? "https://dojomasteronline.com"),
  title: "Dojo Master — Software para Dojos de Karate",
  description: "Gestiona alumnos, pagos, asistencia QR y torneos profesionales. Incluye página web gratis para tu dojo. 120+ dojos en Latinoamérica. Empieza gratis.",
  keywords: ["software karate", "gestión dojo", "asistencia QR", "pagos karate", "torneos karate", "dojo master"],
  openGraph: {
    title: "Dojo Master — Software para Dojos de Karate",
    description: "120+ dojos en Latinoamérica. Alumnos, pagos, QR, torneos y página web incluida. Empieza gratis.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
    type: "website",
    locale: "es_PA",
    siteName: "Dojo Master",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dojo Master — Software para Dojos de Karate",
    description: "120+ dojos en Latinoamérica. Empieza gratis.",
    images: ["/og-image.jpg"],
  },
  icons: {
    icon:    "/logo.png",
    shortcut:"/logo.png",
    apple:   "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Nunito:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-dojo-darker text-dojo-white antialiased">
        <Providers>{children}</Providers>

        {/* Google Analytics 4 — carga después de que la página es interactiva */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              page_path: window.location.pathname,
            });
          `}
        </Script>
      </body>
    </html>
  );
}
