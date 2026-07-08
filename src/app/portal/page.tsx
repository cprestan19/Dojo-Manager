export const dynamic = "force-dynamic";

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
import { FamilyMemberAccordion, type FamilyMember } from "@/components/portal/FamilyMemberAccordion";
import PushPrompt from "@/components/push/PushPrompt";
import { DisciplineStarHero } from "@/components/discipline/DisciplineBar";

export default async function PortalProfilePage() {
  const session   = await getServerSession(authOptions);
  const studentId = (session?.user as { studentId?: string | null })?.studentId!;

  const student = await prisma.student.findUnique({
    where:  { id: studentId },
    select: {
      id: true, fullName: true, photo: true, studentCode: true, cardToken: true,
      birthDate: true, gender: true, nationality: true,
      cedula: true, address: true,
      fepakaId: true, ryoBukaiId: true,
      bloodType: true, condition: true,
      hasPrivateInsurance: true, insuranceName: true, insuranceNumber: true,
      motherName: true, motherPhone: true,
      fatherName: true, fatherPhone: true,
      familyId: true, dojoId: true,
      dojo: { select: { name: true, phone: true } },
      inscription: {
        select: {
          inscriptionDate: true, monthlyAmount: true, biweeklyAmount: true,
          discountAmount: true, discountNote: true, paymentPeriod: true,
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
          id: true, date: true, tournament: true, result: true, notes: true,
          kata: { select: { name: true, beltColor: true } },
        },
      },
      payments: {
        where:   { status: { in: ["pending", "late"] } },
        orderBy: { dueDate: "asc" },
        take:    3,
        select:  { id: true, amount: true, dueDate: true, status: true },
      },
      studentSchedules: {
        where:  { removedAt: null },
        select: { schedule: { select: { name: true, days: true, startTime: true, endTime: true } } },
      },
      attendances: {
        orderBy: { markedAt: "desc" },
        take:    10,
        select:  { id: true, type: true, markedAt: true, schedule: { select: { name: true } } },
      },
    },
  });

  if (!student) return null;

  // Fetch siblings — only if this student belongs to a family
  const siblings = student.familyId
    ? await prisma.student.findMany({
        where: {
          familyId: student.familyId,
          dojoId:   student.dojoId,
          id:       { not: student.id },
          active:   true,
        },
        select: {
          id: true, fullName: true, studentCode: true, cardToken: true,
          photo: true, birthDate: true, gender: true, nationality: true,
          cedula: true, address: true,
          bloodType: true, condition: true,
          hasPrivateInsurance: true, insuranceName: true, insuranceNumber: true,
          motherName: true, motherPhone: true,
          fatherName: true, fatherPhone: true,
          inscription: {
            select: {
              inscriptionDate: true, monthlyAmount: true, biweeklyAmount: true,
              discountAmount: true, paymentPeriod: true,
            },
          },
          beltHistory: {
            orderBy: { changeDate: "desc" },
            take:    10,
            select:  { beltColor: true, changeDate: true, isRanking: true, kata: { select: { name: true } } },
          },
          payments: {
            where:   { status: { in: ["pending", "late"] } },
            orderBy: { dueDate: "asc" },
            take:    3,
            select:  { id: true, amount: true, dueDate: true, status: true },
          },
          kataCompetitions: {
            orderBy: { date: "desc" },
            take:    10,
            select:  { id: true, date: true, tournament: true, result: true, kata: { select: { name: true } } },
          },
          studentSchedules: {
            where:  { removedAt: null },
            select: { schedule: { select: { name: true, days: true, startTime: true, endTime: true } } },
          },
          attendances: {
            orderBy: { markedAt: "desc" },
            take:    10,
            select:  { id: true, type: true, markedAt: true, schedule: { select: { name: true } } },
          },
        },
        orderBy: { fullName: "asc" },
      })
    : [];

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function parseDays(raw: string): string[] {
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  }

  function fmtAttendance(d: Date): string {
    return `${d.toLocaleDateString("es-PA", { timeZone: "America/Panama" })} · ${d.toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Panama" })}`;
  }

  type StudentLike = {
    id: string; fullName: string; studentCode: number | null; cardToken: string | null; photo: string | null;
    birthDate: Date; gender: string; nationality: string; cedula: string | null; address: string | null;
    bloodType: string | null; condition: string | null;
    hasPrivateInsurance: boolean; insuranceName: string | null; insuranceNumber: string | null;
    motherName: string | null; motherPhone: string | null;
    fatherName: string | null; fatherPhone: string | null;
    inscription: { inscriptionDate: Date; monthlyAmount: number; biweeklyAmount: number; discountAmount: number; paymentPeriod: string } | null;
    beltHistory:      { beltColor: string; changeDate: Date; isRanking: boolean; kata?: { name: string } | null }[];
    payments:         { id: string; amount: number; dueDate: Date; status: string }[];
    kataCompetitions: { id: string; date: Date; tournament: string | null; result: string | null; kata?: { name: string } | null }[];
    studentSchedules: { schedule: { name: string; days: string; startTime: string; endTime: string } }[];
    attendances:      { id: string; type: string; markedAt: Date; schedule: { name: string } | null }[];
  };

  function buildMember(s: StudentLike, isMain: boolean): FamilyMember {
    const belts = s.beltHistory.map(b => {
      const info = getBeltInfo(b.beltColor);
      return { label: info?.label ?? b.beltColor, hex: info?.hex ?? "#888888", date: formatDate(b.changeDate), isRanking: b.isRanking, kataName: b.kata?.name ?? null };
    });

    const ins = s.inscription;
    const monthlyAmt = ins
      ? ins.paymentPeriod === "biweekly"
        ? ins.biweeklyAmount + ins.discountAmount
        : ins.monthlyAmount  + ins.discountAmount
      : 0;

    return {
      id: s.id, fullName: s.fullName, studentCode: s.studentCode, cardToken: s.cardToken, photo: s.photo, isMain,
      currentBeltLabel: belts[0]?.label ?? null,
      currentBeltHex:   belts[0]?.hex   ?? null,
      beltHistory:      belts,
      payments: s.payments.map(p => ({ id: p.id, amount: p.amount, dueDate: formatDate(p.dueDate), status: p.status })),
      kataCompetitions: s.kataCompetitions.map(k => ({ id: k.id, kataName: k.kata?.name ?? null, tournament: k.tournament, result: k.result, date: formatDate(k.date) })),
      schedules: s.studentSchedules.map(ss => ({ name: ss.schedule.name, days: parseDays(ss.schedule.days), startTime: ss.schedule.startTime, endTime: ss.schedule.endTime })),
      attendances: s.attendances.map(a => ({ id: a.id, type: a.type, markedAt: fmtAttendance(a.markedAt), scheduleName: a.schedule?.name ?? null })),
      birthDate:   formatDate(s.birthDate),
      gender:      s.gender,
      nationality: s.nationality,
      cedula:      s.cedula,
      address:     s.address,
      bloodType:          s.bloodType,
      condition:          s.condition,
      hasPrivateInsurance: s.hasPrivateInsurance,
      insuranceName:      s.insuranceName,
      insuranceNumber:    s.insuranceNumber,
      motherName:  s.motherName,
      motherPhone: s.motherPhone,
      fatherName:  s.fatherName,
      fatherPhone: s.fatherPhone,
      inscription: ins ? { date: formatDate(ins.inscriptionDate), paymentPeriod: ins.paymentPeriod, monthlyAmt, periodLabel: ins.paymentPeriod === "biweekly" ? "quincena" : "mes" } : null,
    };
  }

  const familyMembers: FamilyMember[] = siblings.length > 0
    ? [buildMember(student as StudentLike, true), ...siblings.map(s => buildMember(s as StudentLike, false))]
    : [];

  // ── Computed values for solo profile ─────────────────────────────────────────
  const currentBelt = student.beltHistory[0]?.beltColor;
  const beltInfo    = currentBelt ? getBeltInfo(currentBelt) : null;
  const age         = Math.floor((Date.now() - new Date(student.birthDate).getTime()) / (365.25 * 86400000));
  const monthlyAmt  = student.inscription
    ? student.inscription.paymentPeriod === "biweekly"
      ? student.inscription.biweeklyAmount + student.inscription.discountAmount
      : student.inscription.monthlyAmount  + student.inscription.discountAmount
    : 0;
  const payPeriodLabel = student.inscription?.paymentPeriod === "biweekly" ? "quincena" : "mes";

  const beltHex     = beltInfo?.hex ?? "#C0392B";
  const beltAccent  = beltHex === "#FFFFFF" ? "#cccccc" : beltHex;
  const initials    = student.fullName.split(" ").slice(0, 2).map(w => w[0]).join("");
  const hasLate     = student.payments.some(p => p.status === "late");

  return (
    <div className="space-y-4">

      {/* ── Banner notificaciones push ── */}
      <PushPrompt dojoName={student.dojo?.name} compact />

      {/* ── HERO — foto, nombre, cinta ── */}
      <div className="rounded-2xl overflow-hidden border border-dojo-border bg-dojo-dark">
        {/* Franja de color de la cinta */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${beltAccent}88, ${beltAccent}, ${beltAccent}88)` }} />

        <div className="p-4 flex items-center gap-4">
          {/* Foto con borde del color de cinta */}
          <div
            className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-bold text-dojo-gold shrink-0"
            style={{ background: `${beltAccent}15`, border: `2px solid ${beltAccent}40` }}
          >
            {student.photo?.startsWith("http")
              ? <Image src={student.photo} alt="" width={80} height={80} className="object-cover w-full h-full" unoptimized />
              : <span style={{ color: beltAccent }}>{initials}</span>
            }
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-bold text-dojo-white leading-tight">{student.fullName}</h1>
            <p className="text-dojo-muted text-xs mt-0.5">{age} años · {student.nationality}</p>

            <div className="flex items-center gap-2 flex-wrap mt-2">
              {student.studentCode && (
                <span className="font-mono text-xs text-dojo-muted flex items-center gap-1 bg-dojo-darker px-2 py-0.5 rounded-full border border-dojo-border">
                  <Fingerprint size={10} /> #{student.studentCode}
                </span>
              )}
              {beltInfo && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full"
                  style={{ backgroundColor: `${beltAccent}20`, color: beltAccent, border: `1px solid ${beltAccent}50` }}
                >
                  <span className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: beltHex }} />
                  Cinta {beltInfo.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats rápidos */}
        <div className="grid grid-cols-3 border-t border-dojo-border/60 divide-x divide-dojo-border/60">
          <div className="flex flex-col items-center py-3 px-2">
            <span className="text-lg font-bold font-display" style={{ color: beltAccent }}>
              {student.beltHistory.length}
            </span>
            <span className="text-[10px] text-dojo-muted mt-0.5">Cintas</span>
          </div>
          <div className="flex flex-col items-center py-3 px-2">
            <span className="text-lg font-bold font-display text-dojo-white">
              {student.studentSchedules.length}
            </span>
            <span className="text-[10px] text-dojo-muted mt-0.5">Clases</span>
          </div>
          <div className="flex flex-col items-center py-3 px-2">
            <span className="text-lg font-bold font-display text-dojo-gold">
              {student.kataCompetitions.length}
            </span>
            <span className="text-[10px] text-dojo-muted mt-0.5">Torneos</span>
          </div>
        </div>

        {/* ── Estrella de disciplina — debajo de la foto ── */}
        <DisciplineStarHero />
      </div>

      {/* ── Alerta de pagos pendientes ── */}
      {student.payments.length > 0 && !familyMembers.length && (
        <Link href="/portal/payments" className="block">
          <div className={`rounded-2xl border p-4 ${
            hasLate
              ? "bg-red-950/40 border-red-800/50"
              : "bg-amber-950/30 border-amber-800/40"
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  hasLate ? "bg-red-500/20" : "bg-amber-500/20"
                }`}>
                  <CreditCard size={18} className={hasLate ? "text-red-400" : "text-amber-400"} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${hasLate ? "text-red-300" : "text-amber-300"}`}>
                    {hasLate ? "Tienes pagos atrasados" : "Pagos pendientes"}
                  </p>
                  <p className="text-xs text-dojo-muted mt-0.5">
                    {student.payments.map(p => `$${p.amount.toFixed(2)}`).join(" · ")}
                  </p>
                </div>
              </div>
              <span className={`text-xs font-semibold shrink-0 ${hasLate ? "text-red-400" : "text-amber-400"}`}>
                Ver →
              </span>
            </div>
          </div>
        </Link>
      )}

      {/* ── Familia (acordeón) O vista individual ── */}
      {familyMembers.length > 0 ? (
        <FamilyMemberAccordion members={familyMembers} />
      ) : (
        <>
          {/* ── Accesos rápidos ── */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/portal/payments" className="card flex items-center gap-3 hover:border-dojo-border/80 transition-colors group">
              <div className="w-9 h-9 rounded-xl bg-dojo-red/15 flex items-center justify-center shrink-0">
                <CreditCard size={18} className="text-dojo-red" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-dojo-white">Pagos</p>
                <p className="text-xs text-dojo-muted truncate">Historial</p>
              </div>
            </Link>
            <Link href="/portal/schedules" className="card flex items-center gap-3 hover:border-dojo-border/80 transition-colors group">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                <Calendar size={18} className="text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-dojo-white">Horarios</p>
                <p className="text-xs text-dojo-muted truncate">
                  {student.studentSchedules.length > 0
                    ? `${student.studentSchedules.length} clase${student.studentSchedules.length !== 1 ? "s" : ""}`
                    : "Ver clases"}
                </p>
              </div>
            </Link>
            <Link href="/portal/attendance" className="card flex items-center gap-3 hover:border-dojo-border/80 transition-colors group">
              <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
                <Award size={18} className="text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-dojo-white">Asistencia</p>
                <p className="text-xs text-dojo-muted truncate">Historial</p>
              </div>
            </Link>
            <Link href="/portal/videos" className="card flex items-center gap-3 hover:border-dojo-border/80 transition-colors group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${beltAccent}20` }}>
                <PlayCircle size={18} style={{ color: beltAccent }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-dojo-white">Videos</p>
                <p className="text-xs text-dojo-muted truncate">Mis katas</p>
              </div>
            </Link>
          </div>

          {/* QR */}
          <StudentQR studentCode={student.studentCode} cardToken={student.cardToken} fullName={student.fullName} />

          {/* ── Historial de cintas — timeline visual ── */}
          {student.beltHistory.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-dojo-white flex items-center gap-2">
                  <Award size={15} style={{ color: beltAccent }} /> Historial de Cintas
                </p>
                <Link href="/portal/videos"
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: `${beltAccent}18`, color: beltAccent }}
                >
                  <PlayCircle size={12} /> Videos
                </Link>
              </div>

              <div className="relative pl-5">
                {/* Línea vertical */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-dojo-border/60" />

                <div className="space-y-3">
                  {student.beltHistory.map((b, i) => {
                    const bi = getBeltInfo(b.beltColor);
                    const hex = bi?.hex ?? "#888";
                    const isCurrent = i === 0;
                    return (
                      <div key={b.id} className="flex items-start gap-3 relative">
                        {/* Dot */}
                        <span
                          className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-dojo-darker shrink-0"
                          style={{ backgroundColor: hex, boxShadow: isCurrent ? `0 0 8px ${hex}80` : undefined }}
                        />
                        <div className={`flex-1 min-w-0 p-2.5 rounded-xl ${isCurrent ? "border" : "bg-transparent"}`}
                          style={isCurrent ? { backgroundColor: `${hex}12`, borderColor: `${hex}30` } : undefined}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-dojo-white">{bi?.label ?? b.beltColor}</p>
                              {isCurrent && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ backgroundColor: `${hex}25`, color: hex }}>
                                  Actual
                                </span>
                              )}
                              {b.isRanking && (
                                <span className="badge-gold text-[10px] flex items-center gap-0.5">
                                  <Trophy size={8} /> Ranking
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-dojo-muted shrink-0">{formatDate(b.changeDate)}</p>
                          </div>
                          {b.kata && <p className="text-xs text-dojo-muted mt-0.5">{b.kata.name}</p>}
                          {b.notes && <p className="text-xs text-dojo-muted/70 italic mt-0.5">{b.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Competencias ── */}
          {student.kataCompetitions.length > 0 && (
            <div className="card">
              <p className="text-sm font-bold text-dojo-white flex items-center gap-2 mb-4">
                <Star size={15} className="text-dojo-gold" /> Katas de Competencia
              </p>
              <div className="space-y-2.5">
                {student.kataCompetitions.map(k => {
                  const bi = k.kata ? getBeltInfo(k.kata.beltColor) : null;
                  return (
                    <div key={k.id} className="p-3 rounded-xl border border-dojo-border bg-dojo-darker space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-dojo-white leading-tight">
                            {k.kata?.name ?? <span className="text-dojo-muted italic">Sin kata</span>}
                          </p>
                          {bi && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5"
                              style={{ backgroundColor: `${bi.hex}20`, color: bi.hex === "#FFFFFF" ? "#ccc" : bi.hex }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: bi.hex }} />
                              {bi.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-dojo-muted shrink-0">{formatDate(k.date)}</p>
                      </div>
                      {k.tournament && <p className="text-xs text-dojo-muted">🏟 {k.tournament}</p>}
                      {k.result && <p className="text-xs font-bold text-dojo-gold">🏅 {k.result}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Datos personales (compacto) ── */}
          <div className="card">
            <p className="text-sm font-bold text-dojo-white flex items-center gap-2 mb-3">
              <User size={14} className="text-dojo-muted" /> Datos Personales
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <div>
                <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Nacimiento</dt>
                <dd className="text-dojo-white text-xs mt-0.5">{formatDate(student.birthDate)}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Género</dt>
                <dd className="text-dojo-white text-xs mt-0.5">{student.gender === "M" ? "Masculino" : "Femenino"}</dd>
              </div>
              {student.cedula && (
                <div>
                  <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Cédula</dt>
                  <dd className="text-dojo-white text-xs font-mono mt-0.5">{student.cedula}</dd>
                </div>
              )}
              {student.fepakaId && (
                <div>
                  <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Fepaka</dt>
                  <dd className="text-dojo-white text-xs font-mono mt-0.5">{student.fepakaId}</dd>
                </div>
              )}
              {student.ryoBukaiId && (
                <div>
                  <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Ryo Bukai</dt>
                  <dd className="text-dojo-white text-xs font-mono mt-0.5">{student.ryoBukaiId}</dd>
                </div>
              )}
              {student.address && (
                <div className="col-span-2">
                  <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Dirección</dt>
                  <dd className="text-dojo-white text-xs mt-0.5">{student.address}</dd>
                </div>
              )}
            </dl>

            {/* Salud inline */}
            {(student.bloodType || student.condition || student.hasPrivateInsurance) && (
              <div className="mt-4 pt-3 border-t border-dojo-border/60">
                <p className="text-[10px] text-dojo-muted uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
                  <Heart size={11} /> Salud
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {student.bloodType && (
                    <div>
                      <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Tipo de sangre</dt>
                      <dd className="text-red-300 text-xs font-bold mt-0.5">{student.bloodType}</dd>
                    </div>
                  )}
                  {student.condition && (
                    <div className="col-span-2">
                      <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Condición</dt>
                      <dd className="text-dojo-white text-xs mt-0.5">{student.condition}</dd>
                    </div>
                  )}
                  {student.hasPrivateInsurance && student.insuranceName && (
                    <div>
                      <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Aseguradora</dt>
                      <dd className="text-dojo-white text-xs mt-0.5">{student.insuranceName}</dd>
                    </div>
                  )}
                  {student.hasPrivateInsurance && student.insuranceNumber && (
                    <div>
                      <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Póliza</dt>
                      <dd className="text-dojo-white text-xs font-mono mt-0.5">{student.insuranceNumber}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Acudientes inline */}
            {(student.motherName || student.fatherName) && (
              <div className="mt-4 pt-3 border-t border-dojo-border/60">
                <p className="text-[10px] text-dojo-muted uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
                  <Phone size={11} /> Acudientes
                </p>
                <div className="space-y-2">
                  {student.motherName && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-dojo-border flex items-center justify-center text-[10px] font-bold text-dojo-gold shrink-0">
                        {student.motherName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-dojo-white text-xs font-medium">{student.motherName}
                          <span className="text-dojo-muted font-normal"> · Madre</span>
                        </p>
                        {student.motherPhone && <p className="text-dojo-gold text-[11px] font-mono">{student.motherPhone}</p>}
                      </div>
                    </div>
                  )}
                  {student.fatherName && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-dojo-border flex items-center justify-center text-[10px] font-bold text-dojo-gold shrink-0">
                        {student.fatherName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-dojo-white text-xs font-medium">{student.fatherName}
                          <span className="text-dojo-muted font-normal"> · Padre</span>
                        </p>
                        {student.fatherPhone && <p className="text-dojo-gold text-[11px] font-mono">{student.fatherPhone}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Inscripción inline */}
            {student.inscription && (
              <div className="mt-4 pt-3 border-t border-dojo-border/60">
                <p className="text-[10px] text-dojo-muted uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
                  <Calendar size={11} /> Inscripción
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Fecha</dt>
                    <dd className="text-dojo-white text-xs mt-0.5">{formatDate(student.inscription.inscriptionDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Periodo</dt>
                    <dd className="text-dojo-white text-xs mt-0.5">{student.inscription.paymentPeriod === "biweekly" ? "Quincenal" : "Mensual"}</dd>
                  </div>
                  {monthlyAmt > 0 && (
                    <div>
                      <dt className="text-[10px] text-dojo-muted uppercase tracking-wide">Monto por {payPeriodLabel}</dt>
                      <dd className="text-dojo-gold text-xs font-bold mt-0.5">${monthlyAmt.toFixed(2)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
