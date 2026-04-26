"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Users, Plus, Search, Edit, Eye } from "lucide-react";
import { BeltBadge } from "@/components/ui/BeltBadge";
import { calculateAge, formatDate } from "@/lib/utils";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  birthDate: string;
  gender: string;
  nationality: string;
  active: boolean;
  beltHistory: { beltColor: string }[];
  payments: { status: string; dueDate: string }[];
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/students?search=${encodeURIComponent(search)}&active=true`);
    if (res.ok) setStudents(await res.json());
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchStudents, 300);
    return () => clearTimeout(t);
  }, [fetchStudents]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-dojo-white tracking-wide flex items-center gap-3">
            <Users size={24} className="text-dojo-red" /> Alumnos
          </h1>
          <p className="text-dojo-muted text-sm mt-1">{students.length} alumno(s) activo(s)</p>
        </div>
        <Link href="/dashboard/students/new" className="btn-primary">
          <Plus size={18} /> Nuevo Alumno
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input pl-9 max-w-sm"
          placeholder="Buscar por nombre o apellido..."
        />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dojo-border">
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-6 py-3">Alumno</th>
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">Edad</th>
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">Cinta</th>
              <th className="text-left text-xs font-semibold text-dojo-muted uppercase tracking-wider px-4 py-3">Estado Pago</th>
              <th className="text-right text-xs font-semibold text-dojo-muted uppercase tracking-wider px-6 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center py-12 text-dojo-muted">Cargando...</td></tr>
            )}
            {!loading && students.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-dojo-muted">
                No se encontraron alumnos.{" "}
                <Link href="/dashboard/students/new" className="text-dojo-red hover:underline">Crear el primero</Link>
              </td></tr>
            )}
            {students.map((s) => {
              const belt    = s.beltHistory[0]?.beltColor;
              const payment = s.payments[0];
              const age     = calculateAge(s.birthDate);

              return (
                <tr key={s.id} className="border-b border-dojo-border/50 hover:bg-dojo-border/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-dojo-border rounded-full flex items-center justify-center text-xs font-bold text-dojo-gold shrink-0">
                        {s.firstName[0]}{s.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-dojo-white">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-dojo-muted">{s.nationality} · {s.gender === "M" ? "Masculino" : "Femenino"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-dojo-muted">{age} años</td>
                  <td className="px-4 py-4">
                    {belt ? <BeltBadge beltColor={belt} /> : <span className="text-dojo-muted text-xs">Sin cinta</span>}
                  </td>
                  <td className="px-4 py-4">
                    {payment ? (
                      <span className={
                        payment.status === "late"    ? "badge-red" :
                        payment.status === "pending" ? "badge-yellow" : "badge-green"
                      }>
                        {payment.status === "late" ? "Atrasado" : payment.status === "pending" ? `Vence ${formatDate(payment.dueDate)}` : "Al día"}
                      </span>
                    ) : (
                      <span className="badge-green">Al día</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/dashboard/students/${s.id}`} className="btn-ghost p-2 text-dojo-muted">
                        <Eye size={16}/>
                      </Link>
                      <Link href={`/dashboard/students/${s.id}/edit`} className="btn-ghost p-2 text-dojo-muted">
                        <Edit size={16}/>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
