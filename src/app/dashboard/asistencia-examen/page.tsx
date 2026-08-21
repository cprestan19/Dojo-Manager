"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { QrCode, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface PostulacionItem {
  id:         string;
  title:      string;
  location:   string;
  examDate:   string;
  status:     string;
  accepted:   number;
  attended:   number;
}

const STATUS_LABELS: Record<string, string> = { CLOSED: "Cerrada", FINALIZED: "Finalizada" };
const STATUS_BADGE: Record<string, string> = {
  CLOSED:    "bg-orange-900/40 text-orange-400 border border-orange-800/50",
  FINALIZED: "bg-blue-900/40 text-blue-400 border border-blue-800/50",
};

export default function AsistenciaExamenPage() {
  const [items,   setItems]   = useState<PostulacionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exam-applications")
      .then(r => r.ok ? r.json() as Promise<PostulacionItem[]> : [])
      .then(d => setItems(d.filter(i => i.status === "CLOSED" || i.status === "FINALIZED")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 flex justify-center"><Loader2 size={24} className="animate-spin text-dojo-gold" /></div>;

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-display font-bold text-dojo-white flex items-center gap-2">
          <QrCode size={20} className="text-dojo-red" /> Asistencia de Examen
        </h1>
        <p className="text-sm text-dojo-muted mt-1">
          Marca quién llegó al examen — con escáner QR o manualmente. Solo aparecen postulaciones con inscripciones cerradas.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-12">
          <QrCode size={36} className="text-dojo-border mx-auto mb-3" />
          <p className="text-dojo-muted text-sm">
            Todavía no hay postulaciones con inscripciones cerradas. Cierra una desde Postulaciones para que aparezca aquí.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dojo-border divide-y divide-dojo-border overflow-hidden">
          {items.map(item => {
            const noParticipo = item.accepted - item.attended;
            return (
              <Link key={item.id} href={`/dashboard/asistencia-examen/${item.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-dojo-border/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-dojo-white truncate">{item.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_BADGE[item.status]}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <p className="text-xs text-dojo-muted">📍 {item.location} · 📅 {formatDate(item.examDate)}</p>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-xs shrink-0">
                  <span className="text-dojo-white">{item.accepted} <span className="text-dojo-muted">inscritos</span></span>
                  <span className="text-green-400">{item.attended} <span className="text-dojo-muted">asistieron</span></span>
                  <span className="text-red-400">{noParticipo} <span className="text-dojo-muted">no participaron</span></span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
