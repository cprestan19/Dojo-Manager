import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatDate, getBeltInfo } from "@/lib/utils";
import {
  Award, CreditCard, Calendar, Fingerprint, PlayCircle,
  Heart, Phone, User, Trophy, Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { StudentQR } from "@/components/students/StudentQR";

export default async function PortalProfilePage() {
  const session   = await getServerSession(authOptions);
  const studentId = (session?.user as { studentId?: string | null })?.studentId!;

  const student = await prisma.student.findUnique({
    where:   { id: studentId },
    select: {
      id: true, fullName: true, photo: true, studentCode: true,
      birthDate: true, gender: true, nationality: true,
      cedula: true, fepakaId: true, ryoBukaiId: true,
      bloodType: true, condition: true,
      hasPrivateInsurance: true, insuranceName: true, insuranceNumber: true,
      motherName: true, motherPhone: true,
      fatherName: true, fatherPhone: true,
      address: true,
      dojo: { select: { name: true, phone: true } },
      inscription: {
        select: {
          inscriptionDate: true, monthlyAmount: true,
          discountAmount: true, paymentPeriod: true, biweeklyAmount: true,
        },
      },
      beltHistory: {
        orderBy: { changeDate: "desc" },
        select: {
          id: true, beltColor: true, changeDate: true,
          isRanking: true, notes: true,
          kata: { select: { name: true } },
        },
      },
      kataCompetitions: {
        orderBy: { date: "desc" },
        select: {
          id: true, date: true, tournament: true,
          result: true, notes: true,
          kata: { select: { name: true, beltColor: true } },
        },
      },
      payments: {
        where:   { status: { in: ["pending", "late"] } },
        orderBy: { dueDate: "asc" },
        take:    3,
        select:  { id: true, amount: true, dueDate: true, status: true },
      },
    },
  });

  if (!student) return null;

  const currentBelt = student.beltHistory[0]?.beltColor;
  const beltInfo    = currentBelt ? getBeltInfo(currentBelt) : null;
  const age = Math.floor((Date.now() - new Date(student.birthDate).getTime()) / (365.25 * 86400000));

  const monthlyAmt = student.inscription
    ? student.inscription.paymentPeriod === "biweekly"
      ? student.inscription.biweeklyAmount + student.inscription.discountAmount
      : student.inscription.monthlyAmount  + student.inscription.discountAmount
    : 0;
  const payPeriodLabel = student.inscription?.paymentPeriod === "biweekly" ? "quincena" : "mes";

  return (
    <div className="space-y-4">

      {/* ── Avatar + nombre ── */}
      <div className="card flex items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-dojo-border overflow-hidden flex items-center justify-center text-2xl font-bold text-dojo-gold shrink-0">
          {student.photo
            ? <Image src={student.photo} alt="" width={80} height={80} className="object-cover w-full h-full" unoptimized />
            : student.fullName.split(" ").slice(0,2).map(w=>w[0]).join("")
          }
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-dojo-white">{student.fullName}</h1>
          <p className="text-dojo-muted text-sm">{age} años · {student.nationality}</p>
          {student.studentCode && (
            <span className="font-mono text-xs text-dojo-gold flex items-center gap-1 mt-1">
              <Fingerprint size={11} /> #{student.studentCode}
            </span>
          )}
          {beltInfo && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
              style={{ backgroundColor: beltInfo.hex+"25", color: beltInfo.hex==="#FFFFFF"?"#ccc":beltInfo.hex, border:`1px solid ${beltInfo.hex}40` }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: beltInfo.hex }} />
              Cinta {beltInfo.label}
            </span>
          )}
        </div>
      </div>

      {/* ── QR de identificación ── */}
      <StudentQR
        studentCode={student.studentCode}
        fullName={student.fullName}
        cedula={student.cedula}
        address={student.address}
        motherName={student.motherName}
        motherPhone={student.motherPhone}
        fatherName={student.fatherName}
        fatherPhone={student.fatherPhone}
        dojoName={student.dojo?.name ?? "Dojo Master"}
        dojoPhone={student.dojo?.phone ?? null}
      />

      {/* ── Pagos pendientes ── */}
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

      {/* ── Datos personales ── */}
      <div className="card space-y-3">
        <p className="section-title flex items-center gap-2 mb-0"><User size={13}/>Datos Personales</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-dojo-muted text-xs">Nacimiento</dt>
            <dd className="text-dojo-white">{formatDate(student.birthDate)}</dd>
          </div>
          <div>
            <dt className="text-dojo-muted text-xs">Género</dt>
            <dd className="text-dojo-white">{student.gender === "M" ? "Masculino" : "Femenino"}</dd>
          </div>
          {student.cedula && (
            <div>
              <dt className="text-dojo-muted text-xs">Cédula</dt>
              <dd className="text-dojo-white font-mono">{student.cedula}</dd>
            </div>
          )}
          {student.fepakaId && (
            <div>
              <dt className="text-dojo-muted text-xs">Fepaka</dt>
              <dd className="text-dojo-white font-mono">{student.fepakaId}</dd>
            </div>
          )}
          {student.ryoBukaiId && (
            <div>
              <dt className="text-dojo-muted text-xs">Ryo Bukai</dt>
              <dd className="text-dojo-white font-mono">{student.ryoBukaiId}</dd>
            </div>
          )}
          {student.address && (
            <div className="col-span-2">
              <dt className="text-dojo-muted text-xs">Dirección</dt>
              <dd className="text-dojo-white">{student.address}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* ── Salud y Seguro ── */}
      {(student.bloodType || student.condition || student.hasPrivateInsurance) && (
        <div className="card space-y-3">
          <p className="section-title flex items-center gap-2 mb-0"><Heart size={13}/>Salud</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {student.bloodType && (
              <div>
                <dt className="text-dojo-muted text-xs">Tipo de sangre</dt>
                <dd className="text-dojo-white font-semibold">{student.bloodType}</dd>
              </div>
            )}
            {student.condition && (
              <div className="col-span-2">
                <dt className="text-dojo-muted text-xs">Condición de salud</dt>
                <dd className="text-dojo-white">{student.condition}</dd>
              </div>
            )}
            {student.hasPrivateInsurance && (
              <>
                {student.insuranceName && (
                  <div>
                    <dt className="text-dojo-muted text-xs">Aseguradora</dt>
                    <dd className="text-dojo-white">{student.insuranceName}</dd>
                  </div>
                )}
                {student.insuranceNumber && (
                  <div>
                    <dt className="text-dojo-muted text-xs">Póliza</dt>
                    <dd className="text-dojo-white font-mono">{student.insuranceNumber}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </div>
      )}

      {/* ── Acudientes ── */}
      {(student.motherName || student.fatherName) && (
        <div className="card space-y-3">
          <p className="section-title flex items-center gap-2 mb-0"><Phone size={13}/>Acudientes</p>
          <div className="space-y-3 text-sm">
            {student.motherName && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-dojo-border flex items-center justify-center text-xs font-bold text-dojo-gold shrink-0 mt-0.5">
                  {student.motherName[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-dojo-white font-medium">{student.motherName}</p>
                  <p className="text-dojo-muted text-xs">Madre / Tutora</p>
                  {student.motherPhone && <p className="text-dojo-gold text-xs font-mono mt-0.5">{student.motherPhone}</p>}
                </div>
              </div>
            )}
            {student.fatherName && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-dojo-border flex items-center justify-center text-xs font-bold text-dojo-gold shrink-0 mt-0.5">
                  {student.fatherName[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-dojo-white font-medium">{student.fatherName}</p>
                  <p className="text-dojo-muted text-xs">Padre / Tutor</p>
                  {student.fatherPhone && <p className="text-dojo-gold text-xs font-mono mt-0.5">{student.fatherPhone}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Inscripción ── */}
      {student.inscription && (
        <div className="card space-y-2">
          <p className="section-title flex items-center gap-2 mb-0"><Calendar size={13}/>Inscripción</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mt-2">
            <div>
              <dt className="text-dojo-muted text-xs">Fecha inscripción</dt>
              <dd className="text-dojo-white">{formatDate(student.inscription.inscriptionDate)}</dd>
            </div>
            <div>
              <dt className="text-dojo-muted text-xs">Periodo de pago</dt>
              <dd className="text-dojo-white capitalize">
                {student.inscription.paymentPeriod === "biweekly" ? "Quincenal" : "Mensual"}
              </dd>
            </div>
            {monthlyAmt > 0 && (
              <div>
                <dt className="text-dojo-muted text-xs">Monto por {payPeriodLabel}</dt>
                <dd className="text-dojo-gold font-semibold">${monthlyAmt.toFixed(2)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* ── Historial de Cintas ── */}
      {student.beltHistory.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title flex items-center gap-2 mb-0"><Award size={13}/>Historial de Cintas</p>
            <Link href="/portal/videos"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: "rgba(229,57,53,0.12)", color: "#E53935" }}>
              <PlayCircle size={13} /> Ver Videos
            </Link>
          </div>
          <div className="space-y-2">
            {student.beltHistory.map((b, i) => {
              const bi = getBeltInfo(b.beltColor);
              return (
                <div key={b.id} className="flex items-start gap-3 py-1.5 border-b border-dojo-border/30 last:border-0">
                  <span className="w-3 h-3 rounded-full shrink-0 border border-white/20 mt-1" style={{ backgroundColor: bi?.hex }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-dojo-white font-medium">{bi?.label ?? b.beltColor}</p>
                      {i === 0 && <span className="badge-blue text-xs">Actual</span>}
                      {b.isRanking && <span className="badge-gold text-xs flex items-center gap-1"><Trophy size={9}/>Ranking</span>}
                    </div>
                    {b.kata && <p className="text-xs text-dojo-muted">{b.kata.name}</p>}
                    {b.notes && <p className="text-xs text-dojo-muted italic">{b.notes}</p>}
                  </div>
                  <p className="text-xs text-dojo-muted shrink-0">{formatDate(b.changeDate)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Katas de Competencia ── */}
      {student.kataCompetitions.length > 0 && (
        <div className="card">
          <p className="section-title flex items-center gap-2 mb-3">
            <Star size={13} className="text-dojo-gold"/>Katas de Competencia
          </p>
          <div className="space-y-3">
            {student.kataCompetitions.map(k => {
              const bi = k.kata ? getBeltInfo(k.kata.beltColor) : null;
              return (
                <div key={k.id} className="p-3 rounded-lg border border-dojo-border bg-dojo-dark space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-dojo-white">
                        {k.kata?.name ?? <span className="text-dojo-muted italic">Sin kata</span>}
                      </p>
                      {bi && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5"
                          style={{ backgroundColor: bi.hex+"20", color: bi.hex==="#FFFFFF"?"#ccc":bi.hex }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: bi.hex }} />
                          {bi.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-dojo-muted shrink-0">{formatDate(k.date)}</p>
                  </div>
                  {k.tournament && (
                    <p className="text-xs text-dojo-muted flex items-center gap-1">
                      🏟 {k.tournament}
                    </p>
                  )}
                  {k.result && (
                    <p className="text-xs font-semibold text-dojo-gold flex items-center gap-1">
                      🏅 {k.result}
                    </p>
                  )}
                  {k.notes && <p className="text-xs text-dojo-muted italic">{k.notes}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
