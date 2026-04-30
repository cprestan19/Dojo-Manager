import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { Users, Award, Building2, UserCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { AttendanceChart } from "@/components/dashboard/AttendanceChart";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user    = session?.user as { dojoId?: string | null; role?: string; name?: string } | undefined;
  const role    = user?.role ?? "user";

  // sysadmin uses cookie context; all other roles use their session dojoId
  const cookieStore = await cookies();
  const sxDojo  = role === "sysadmin" ? (cookieStore.get("sx-dojo")?.value ?? null) : null;
  const dojoId  = role === "sysadmin" ? sxDojo : (user?.dojoId ?? null);

  /* ── Sysadmin without dojo context → global platform view ── */
  if (role === "sysadmin" && !dojoId) {
    const [totalDojos, activeDojos, totalUsers] = await Promise.all([
      prisma.dojo.count(),
      prisma.dojo.count({ where: { active: true } }),
      prisma.user.count({ where: { role: { not: "student" } } }),
    ]);

    const recentDojos = await prisma.dojo.findMany({
      orderBy: { createdAt: "desc" },
      take:    6,
      select:  { id: true, name: true, slug: true, active: true, createdAt: true, _count: { select: { students: true, users: true } } },
    });

    return (
      <div className="space-y-6 lg:space-y-8">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-white tracking-wide">
            Panel de Plataforma,{" "}
            <span style={{ color: "#E53935" }}>{session?.user?.name}</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#7A97B0" }}>
            Vista global · Para ver datos de un dojo, entra en él desde{" "}
            <Link href="/dashboard/dojos" className="text-dojo-red hover:underline">Gestión de Dojos</Link>.
          </p>
        </div>

        {/* Global stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "Dojos activos",  value: activeDojos,  sub: `${totalDojos} total`,          icon: Building2, color: "#3B82F6" },
            { label: "Usuarios",       value: totalUsers,   sub: "todos los dojos",               icon: UserCheck, color: "#10B981" },
            { label: "Dojos inactivos",value: totalDojos - activeDojos, sub: "requieren atención",icon: Users,     color: "#F59E0B" },
          ].map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="card p-5"
                style={{ border: `1px solid ${card.color}30` }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: card.color + "18" }}>
                    <Icon size={16} style={{ color: card.color }} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: card.color }}>{card.label}</span>
                </div>
                <p className="text-3xl font-bold text-white">{card.value}</p>
                <p className="text-xs mt-1" style={{ color: "#7A97B0" }}>{card.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Recent dojos */}
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: "#7A97B0" }}>
            <Building2 size={13} style={{ color: "#E53935" }} /> Dojos recientes
          </p>
          <div className="space-y-1">
            {recentDojos.map((d, idx) => (
              <div key={d.id}
                className="flex items-center justify-between px-3 py-2.5"
                style={{ borderBottom: idx < recentDojos.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "rgba(229,57,53,0.12)", color: "#E53935" }}>
                    {d.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{d.name}</p>
                    <p className="text-xs font-mono" style={{ color: "#7A97B0" }}>{d.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs" style={{ color: "#7A97B0" }}>
                  <span>{d._count.students} alumnos</span>
                  <span className={d.active ? "badge-green" : "badge-red"}>{d.active ? "Activo" : "Inactivo"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Normal dojo dashboard (admin / user / sysadmin with context) ── */
  const baseStudentWhere = dojoId ? { dojoId } : { id: "NEVER_MATCH" };
  const basePaymentWhere = dojoId ? { student: { dojoId } } : { id: "NEVER_MATCH" };

  const now            = new Date();
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
  const absenceCutoff  = new Date(now.getTime() - 14 * 86_400_000);
  const upcomingCutoff = new Date(now.getTime() +  7 * 86_400_000);

  const [
    totalStudents, activeStudents, pendingPayments, latePayments,
    collectedThisMonth, pendingAggregate, recentStudents,
    lateStudentsRaw, absentStudentsRaw, upcomingPaymentsRaw,
  ] = await Promise.all([
    prisma.student.count({ where: baseStudentWhere }),
    prisma.student.count({ where: { ...baseStudentWhere, active: true } }),
    prisma.payment.count({ where: { ...basePaymentWhere, status: "pending" } }),
    prisma.payment.count({ where: { ...basePaymentWhere, status: "late" } }),
    prisma.payment.aggregate({
      where: { ...basePaymentWhere, status: "paid", paidDate: { gte: monthStart } },
      _sum:  { amount: true },
    }),
    prisma.payment.aggregate({
      where: { ...basePaymentWhere, status: { in: ["pending", "late"] } },
      _sum:  { amount: true },
    }),
    prisma.student.findMany({
      where: baseStudentWhere, take: 6, orderBy: { createdAt: "desc" },
      select: {
        id: true, fullName: true, birthDate: true, photo: true,
        beltHistory: { orderBy: { changeDate: "desc" }, take: 1, select: { beltColor: true } },
      },
    }),
    prisma.payment.findMany({
      where: { ...basePaymentWhere, status: { in: ["pending", "late"] } },
      include: { student: { select: { id: true, fullName: true, motherEmail: true, fatherEmail: true } } },
      orderBy: { dueDate: "asc" }, take: 100,
    }),
    // N+1 fix: two queries instead of 1+N (one subquery per student).
    // Step 1 fetches absent student IDs; step 2 fetches their last attendance
    // in a single IN query. Combined in-memory below.
    prisma.student.findMany({
      where:   { ...baseStudentWhere, active: true, attendances: { none: { markedAt: { gte: absenceCutoff }, type: "entry" } } },
      select:  { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take:    100,
    }),
    prisma.payment.findMany({
      where: { ...basePaymentWhere, status: "pending", dueDate: { gte: now, lte: upcomingCutoff } },
      include: { student: { select: { id: true, fullName: true } } },
      orderBy: { dueDate: "asc" }, take: 50,
    }),
  ]);

  const lateStudents = lateStudentsRaw.map(p => ({
    id: p.id, amount: p.amount, dueDate: p.dueDate.toISOString(), status: p.status, student: p.student,
  }));

  // N+1 fix: fetch last attendance for absent students in a single IN query
  const absentIds = absentStudentsRaw.map(s => s.id);
  const lastAttendances = absentIds.length > 0
    ? await prisma.attendance.findMany({
        where:   { studentId: { in: absentIds }, type: "entry" },
        orderBy: { markedAt: "desc" },
        distinct: ["studentId"],
        select:  { studentId: true, markedAt: true },
      })
    : [];
  const lastSeenMap = new Map(lastAttendances.map(a => [a.studentId, a.markedAt]));
  const absentStudents = absentStudentsRaw.map(s => ({
    id: s.id, fullName: s.fullName,
    lastSeen: lastSeenMap.get(s.id)?.toISOString() ?? null,
  }));

  const upcomingPayments = upcomingPaymentsRaw.map(p => ({
    id: p.id, amount: p.amount, dueDate: p.dueDate.toISOString(), student: p.student,
  }));
  const alertCount       = latePayments + absentStudents.length + upcomingPayments.length;

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-white tracking-wide">
          Bienvenido, <span style={{ color: "#E53935" }}>{session?.user?.name}</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#7A97B0" }}>Panel de control del Dojo</p>
      </div>

      <DashboardStats
        activeStudents={activeStudents} totalStudents={totalStudents}
        paidThisMonth={collectedThisMonth._sum.amount ?? 0}
        pendingCount={pendingPayments + latePayments}
        pendingAmount={pendingAggregate._sum.amount ?? 0}
        lateCount={latePayments} alertCount={alertCount}
        lateStudents={lateStudents} absentStudents={absentStudents}
        upcomingPayments={upcomingPayments}
      />

      {/* Chart + Recent students — side by side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Attendance chart */}
        <AttendanceChart />

        {/* Recent students */}
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: "#7A97B0" }}>
            <Users size={13} style={{ color: "#E53935" }} /> Alumnos Recientes
          </p>
          <div className="space-y-1">
            {recentStudents.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: "#7A97B0" }}>No hay alumnos registrados aún.</p>
            )}
            {recentStudents.map((s, idx) => {
              const belt     = s.beltHistory[0]?.beltColor ?? "sin cinta";
              const age      = Math.floor((Date.now() - new Date(s.birthDate).getTime()) / (365.25 * 86_400_000));
              const initials = s.fullName.split(" ").slice(0, 2).map(w => w[0]).join("");
              const isUrl    = s.photo?.startsWith("http");
              return (
                <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
                  style={{ borderBottom: idx < recentStudents.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-bold"
                      style={{ background: "rgba(229,57,53,0.12)", color: "#E53935" }}>
                      {isUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.photo!} alt={s.fullName} className="w-full h-full object-cover" />
                      ) : initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{s.fullName}</p>
                      <p className="text-xs" style={{ color: "#7A97B0" }}>{age} años</p>
                    </div>
                  </div>
                  <span className="text-xs capitalize px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(255,255,255,0.06)", color: "#7A97B0" }}>
                    {belt}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {totalStudents === 0 && (
        <div className="rounded-xl p-4 flex gap-3"
          style={{ background: "rgba(229,57,53,0.08)", border: "1px solid rgba(229,57,53,0.22)" }}>
          <Award style={{ color: "#E53935" }} className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold text-sm" style={{ color: "#E53935" }}>¡Sistema listo!</p>
            <p className="text-xs mt-1" style={{ color: "#7A97B0" }}>
              Empieza creando alumnos en el módulo de <strong className="text-white">Alumnos</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
