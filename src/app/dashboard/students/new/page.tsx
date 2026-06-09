import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import StudentForm from "@/components/students/StudentForm";

type SessionUser = { role?: string; dojoId?: string | null };

export default async function NewStudentPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, dojoId } = session.user as SessionUser;

  if (!dojoId && role !== "sysadmin") redirect("/dashboard/students");

  if (dojoId) {
    const sub = await prisma.subscription.findUnique({
      where:  { dojoId },
      select: {
        status: true,
        plan: { select: { name: true, maxStudents: true } },
      },
    });

    const maxStudents    = sub?.plan?.maxStudents ?? null;
    const isComplimentary = sub?.status === "COMPLIMENTARY";

    if (maxStudents != null && !isComplimentary) {
      const activeCount = await prisma.student.count({
        where: { dojoId, active: true },
      });

      if (activeCount >= maxStudents) {
        return (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <Link
                href="/dashboard/students"
                className="inline-flex items-center gap-2 text-dojo-muted hover:text-dojo-white transition-colors text-sm mb-4"
              >
                <ArrowLeft size={16} /> Volver a Alumnos
              </Link>
              <h1 className="font-display text-2xl font-bold text-dojo-white">Nuevo Alumno</h1>
            </div>

            <div className="card border-red-800/50 bg-red-900/10 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-bold text-red-300 text-lg mb-1">
                    Límite de alumnos alcanzado
                  </h2>
                  <p className="text-dojo-muted text-sm leading-relaxed">
                    Tu plan <strong className="text-dojo-white">{sub?.plan?.name ?? "actual"}</strong> permite
                    hasta <strong className="text-dojo-white">{maxStudents}</strong> alumnos activos.
                    Ya tienes <strong className="text-red-300">{activeCount}</strong> registrados.
                  </p>
                  <p className="text-dojo-muted text-sm mt-2">
                    Puedes seguir consultando, registrando asistencia, gestionando pagos
                    y usando todas las funciones de tu plan actual.
                    Para agregar más alumnos, actualiza a un plan superior.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-dojo-border">
                <Link href="/dashboard/billing" className="btn-primary justify-center">
                  Ver planes y actualizar
                </Link>
                <Link href="/dashboard/students" className="btn-secondary justify-center">
                  Volver a mis alumnos
                </Link>
              </div>
            </div>

            <div className="card space-y-3">
              <p className="text-sm font-semibold text-dojo-white">
                ¿Qué puedes hacer con el plan {sub?.plan?.name}?
              </p>
              <ul className="space-y-2 text-sm text-dojo-muted">
                {[
                  "Consultar y editar alumnos existentes",
                  "Registrar asistencia con QR",
                  "Gestionar y generar pagos y mensualidades",
                  "Enviar recordatorios automáticos de mora",
                  "Ver historial de cintas y katas",
                  "Portal del alumno activo",
                ].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      }
    }
  }

  return <StudentForm />;
}
