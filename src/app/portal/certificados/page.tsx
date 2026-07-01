"use client";
import { useState, useEffect } from "react";
import { formatDate, getBeltInfo } from "@/lib/utils";
import { Loader2, Award, Download } from "lucide-react";

interface Certificate {
  id:             string;
  title:          string;
  beltColor:      string;
  issuedDate:     string;
  pdfUrl:         string | null;
  instructorName: string | null;
}

export default function PortalCertificadosPage() {
  const [certs,   setCerts]   = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/certificates")
      .then(r => r.ok ? r.json() as Promise<Certificate[]> : [])
      .then(setCerts)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 size={24} className="animate-spin text-dojo-gold" />
      </div>
    );
  }

  if (!certs.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 px-4">
        <Award size={48} className="text-dojo-border" />
        <p className="text-dojo-white font-semibold text-lg">No tienes diplomas disponibles aún</p>
        <p className="text-dojo-muted text-sm">Tus certificados y diplomas aparecerán aquí cuando sean emitidos.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <h1 className="font-display font-bold text-dojo-white text-xl">Mis Diplomas</h1>
      <div className="space-y-3">
        {certs.map(cert => {
          const beltInfo = getBeltInfo(cert.beltColor);
          return (
            <div key={cert.id} className="card flex items-center gap-4">
              {/* Icono con color de cinta */}
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: beltInfo.hex + "25", border: `2px solid ${beltInfo.hex}50` }}>
                <span className="text-2xl">🏅</span>
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-dojo-white text-sm truncate">{cert.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: beltInfo.hex + "25", color: beltInfo.hex === "#FFFFFF" ? "#aaa" : beltInfo.hex }}>
                    {beltInfo.label}
                  </span>
                  <span className="text-xs text-dojo-muted">{formatDate(cert.issuedDate)}</span>
                  {cert.instructorName && (
                    <span className="text-xs text-dojo-muted">Instructor: {cert.instructorName}</span>
                  )}
                </div>
              </div>
              {/* Descarga */}
              {cert.pdfUrl ? (
                <a
                  href={cert.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex items-center gap-2 text-xs shrink-0"
                >
                  <Download size={13} />
                  Descargar PDF
                </a>
              ) : (
                <span className="text-xs px-2 py-1 rounded bg-dojo-border text-dojo-muted shrink-0">
                  En proceso
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
