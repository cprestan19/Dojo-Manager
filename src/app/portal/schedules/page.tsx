import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatTimeStr } from "@/lib/utils";
import { Clock, Users } from "lucide-react";

const DAY_LABELS: Record<string, string> = {
  lunes: "Lun", martes: "Mar", miercoles: "Mié", jueves: "Jue",
  viernes: "Vie", sabado: "Sáb", domingo: "Dom",
};

type Assignment = {
  id: string;
  studentId: string;
  schedule: {
    name: string;
    startTime: string;
    endTime: string;
    days: string;
    description: string | null;
  };
};

function ScheduleCard({ assignment }: { assignment: Assignment }) {
  let days: string[] = [];
  try { days = JSON.parse(assignment.schedule.days); } catch { days = []; }

  return (
    <div className="card min-w-0">
      <p className="font-semibold text-dojo-white break-words">{assignment.schedule.name}</p>
      <p className="text-dojo-gold font-mono text-sm mt-1">
        {formatTimeStr(assignment.schedule.startTime)} – {formatTimeStr(assignment.schedule.endTime)}
      </p>
      {days.length > 0 && (
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {days.map(d => (
            <span key={d} className="bg-dojo-border text-dojo-white text-xs px-2 py-0.5 rounded-full">
              {DAY_LABELS[d] ?? d}
            </span>
          ))}
        </div>
      )}
      {assignment.schedule.description && (
        <p className="text-xs text-dojo-muted mt-2 break-words">{assignment.schedule.description}</p>
      )}
    </div>
  );
}

export default async function PortalSchedulesPage() {
  const session   = await getServerSession(authOptions);
  const studentId = (session?.user as { studentId?: string | null })?.studentId!;

  // Resolver contexto de familia
  const me = await prisma.student.findUnique({
    where:  { id: studentId },
    select: { id: true, fullName: true, familyId: true, dojoId: true },
  });
  if (!me) return null;

  let members: { id: string; fullName: string; isMe: boolean }[];

  if (me.familyId) {
    const siblings = await prisma.student.findMany({
      where:   { familyId: me.familyId, dojoId: me.dojoId, active: true },
      select:  { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    });
    members = siblings.map(m => ({ ...m, isMe: m.id === me.id }));
  } else {
    members = [{ id: me.id, fullName: me.fullName, isMe: true }];
  }

  const isFamily = members.length > 1;

  const assignments = await prisma.studentSchedule.findMany({
    where:   { studentId: { in: members.map(m => m.id) }, removedAt: null },
    include: { schedule: true },
    orderBy: { assignedAt: "desc" },
  });

  const totalCount = assignments.length;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-bold text-dojo-white">
        {isFamily ? "Horarios de la Familia" : "Mis Horarios"}
      </h1>

      {totalCount === 0 ? (
        <div className="card text-center py-12 text-dojo-muted">
          <Clock size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay horarios asignados.</p>
        </div>
      ) : isFamily ? (
        // Vista familia: horarios agrupados por miembro
        <div className="space-y-6">
          {members.map(member => {
            const memberAssignments = assignments.filter(a => a.studentId === member.id);
            if (memberAssignments.length === 0) return null;
            return (
              <div key={member.id} className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-dojo-border/50">
                  <Users size={13} className="text-dojo-muted shrink-0" />
                  <span className="text-sm font-semibold text-dojo-white">
                    {member.fullName}
                    {member.isMe && (
                      <span className="text-dojo-muted font-normal text-xs ml-1.5">(yo)</span>
                    )}
                  </span>
                  <span className="text-xs text-dojo-muted ml-auto">
                    {memberAssignments.length} horario{memberAssignments.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {memberAssignments.map(a => (
                  <ScheduleCard key={a.id} assignment={a} />
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        // Vista individual
        <div className="space-y-3">
          {assignments.map(a => (
            <ScheduleCard key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  );
}
