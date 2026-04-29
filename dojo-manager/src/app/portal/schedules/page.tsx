import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Clock } from "lucide-react";

const DAY_LABELS: Record<string, string> = {
  lunes:"Lun", martes:"Mar", miercoles:"Mié", jueves:"Jue",
  viernes:"Vie", sabado:"Sáb", domingo:"Dom",
};

export default async function PortalSchedulesPage() {
  const session   = await getServerSession(authOptions);
  const studentId = (session?.user as { studentId?: string | null })?.studentId!;

  const assignments = await prisma.studentSchedule.findMany({
    where:   { studentId, removedAt: null },
    include: { schedule: true },
    orderBy: { assignedAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-bold text-dojo-white">Mis Horarios</h1>

      {assignments.length === 0 ? (
        <div className="card text-center py-12 text-dojo-muted">
          <Clock size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tienes horarios asignados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            let days: string[] = [];
            try { days = JSON.parse(a.schedule.days); } catch { days = []; }

            return (
              <div key={a.id} className="card">
                <p className="font-semibold text-dojo-white">{a.schedule.name}</p>
                <p className="text-dojo-gold font-mono text-sm mt-1">
                  {a.schedule.startTime} – {a.schedule.endTime}
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
                {a.schedule.description && (
                  <p className="text-xs text-dojo-muted mt-2">{a.schedule.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
