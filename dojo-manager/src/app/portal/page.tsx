import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatDate, getBeltInfo } from "@/lib/utils";
import { Award, CreditCard, Calendar, Fingerprint } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default async function PortalProfilePage() {
  const session   = await getServerSession(authOptions);
  const studentId = (session?.user as { studentId?: string | null })?.studentId!;

  const student = await prisma.student.findUnique({
    where:   { id: studentId },
    include: {
      inscription: true,
      beltHistory: { orderBy: { changeDate: "desc" }, take: 5, include: { kata: true } },
      payments:    { where: { status: { in: ["pending", "late"] } }, orderBy: { dueDate: "asc" }, take: 3 },
    },
  });

  if (!student) return null;

  const currentBelt = student.beltHistory[0]?.beltColor;
  const beltInfo    = currentBelt ? getBeltInfo(currentBelt) : null;
  const age = Math.floor((Date.now() - new Date(student.birthDate).getTime()) / (365.25 * 86400000));

  return (
    <div className="space-y-5">
      <div className="card flex items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-dojo-border overflow-hidden flex items-center justify-center text-2xl font-bold text-dojo-gold shrink-0">
          {student.photo
            ? <Image src={student.photo} alt="" width={80} height={80} className="object-cover w-full h-full" unoptimized />
            : student.fullName.split(" ").slice(0,2).map(w=>w[0]).join("")
          }
        </div>
        <div>
          <h1 className="font-display text-xl font-bold text-dojo-white">{student.fullName}</h1>
          <p className="text-dojo-muted text-sm">{age} años · {student.nationality}</p>
          {student.studentCode && (
            <span className="font-mono text-xs text-dojo-gold flex items-center gap-1 mt-1">
              <Fingerprint size={11} /> #{student.studentCode}
            </span>
          )}
          {beltInfo && (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
              style={{ backgroundColor: beltInfo.hex + "25", color: beltInfo.hex === "#FFFFFF" ? "#ccc" : beltInfo.hex, border: `1px solid ${beltInfo.hex}40` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: beltInfo.hex }} />
              Cinta {beltInfo.label}
            </span>
          )}
        </div>
      </div>

      {student.payments.length > 0 && (
        <div className="card border border-yellow-800/40 bg-yellow-900/10">
          <p className="text-xs font-bold text-yellow-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CreditCard size={13} /> Pagos pendientes
          </p>
          <div className="space-y-2">
            {student.payments.map(p => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-dojo-muted">{formatDate(p.dueDate)}</span>
                <span className={p.status === "late" ? "text-red-400 font-semibold" : "text-yellow-400"}>
                  ${p.amount.toFixed(2)} {p.status === "late" ? "· Atrasado" : "· Pendiente"}
                </span>
              </div>
            ))}
          </div>
          <Link href="/portal/payments" className="block mt-3 text-xs text-dojo-red hover:underline text-center">
            Ver historial completo →
          </Link>
        </div>
      )}

      {student.inscription && (
        <div className="card">
          <p className="section-title flex items-center gap-2 mb-3"><Calendar size={13}/>Inscripción</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-dojo-muted">Inscripción</span>
              <span>{formatDate(student.inscription.inscriptionDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dojo-muted">Mensualidad</span>
              <span className="text-dojo-gold">${(student.inscription.monthlyAmount + student.inscription.discountAmount).toFixed(2)}/mes</span>
            </div>
          </div>
        </div>
      )}

      {student.beltHistory.length > 0 && (
        <div className="card">
          <p className="section-title flex items-center gap-2 mb-3"><Award size={13}/>Historial de Cintas</p>
          <div className="space-y-2">
            {student.beltHistory.map((b, i) => {
              const bi = getBeltInfo(b.beltColor);
              return (
                <div key={b.id} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0 border border-white/20" style={{ backgroundColor: bi?.hex }} />
                  <div className="flex-1">
                    <p className="text-sm text-dojo-white">{bi?.label ?? b.beltColor}</p>
                    {b.kata && <p className="text-xs text-dojo-muted">{b.kata.name}</p>}
                  </div>
                  <p className="text-xs text-dojo-muted">{formatDate(b.changeDate)}</p>
                  {i === 0 && <span className="badge-blue text-xs">Actual</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
