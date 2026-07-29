"use client";
import { useState, useEffect, useCallback } from "react";
import { formatDate, getBeltInfo } from "@/lib/utils";
import { Loader2, Award, Download, Users } from "lucide-react";

interface FamilyMember { id: string; fullName: string; isMe: boolean; }

interface Certificate {
  id:             string;
  title:          string;
  beltColor:      string;
  issuedDate:     string;
  pdfUrl:         string | null;
  instructorName: string | null;
  student:        { id: string; fullName: string };
}

export default function PortalCertificadosPage() {
  const [certs,         setCerts]         = useState<Certificate[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedId,    setSelectedId]    = useState<string>("");

  // Cargar familia al montar — solo muestra selector si hay 2+ miembros
  useEffect(() => {
    fetch("/api/portal/family")
      .then(r => r.ok ? r.json() : [])
      .then((members: FamilyMember[]) => {
        setFamilyMembers(members);
        if (members.length > 1) setSelectedId("all");
      })
      .catch(() => { /* sin familia, comportamiento normal */ });
  }, []);

  const isFamily = familyMembers.length > 1;

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (isFamily && selectedId) p.set("studentId", selectedId);
    fetch(`/api/portal/certificates?${p}`)
      .then(r => r.ok ? r.json() as Promise<Certificate[]> : [])
      .then(setCerts)
      .finally(() => setLoading(false));
  }, [isFamily, selectedId]);

  useEffect(() => {
    if (!isFamily || selectedId) load();
  }, [load, isFamily, selectedId]);

  const showStudentName = isFamily && selectedId === "all";

  const selector = isFamily ? (
    <div className="space-y-1">
      <label className="form-label text-xs flex items-center gap-1.5">
        <Users size={12} /> Alumno
      </label>
      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="form-input"
        style={{ fontSize: "16px" }}
      >
        <option value="all">Todos</option>
        {familyMembers.map(m => (
          <option key={m.id} value={m.id}>
            {m.fullName}{m.isMe ? " (yo)" : ""}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {selector}
        <div className="flex justify-center items-center py-16">
          <Loader2 size={24} className="animate-spin text-dojo-gold" />
        </div>
      </div>
    );
  }

  if (!certs.length) {
    return (
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {selector}
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 px-4">
          <Award size={48} className="text-dojo-border" />
          <p className="text-dojo-white font-semibold text-lg">No hay diplomas disponibles aún</p>
          <p className="text-dojo-muted text-sm">Los certificados y diplomas aparecerán aquí cuando sean emitidos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <h1 className="font-display font-bold text-dojo-white text-xl">Diplomas</h1>
      {selector}
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
                {showStudentName && (
                  <p className="text-xs text-dojo-gold font-semibold mb-0.5">👤 {cert.student.fullName}</p>
                )}
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
