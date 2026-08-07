"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { ClipboardList, LogIn, LogOut, Search, Users } from "lucide-react";
import { DisciplineBarPortal } from "@/components/discipline/DisciplineBar";
import { formatLateTotal } from "@/lib/utils";
import { getLateMinutes, ymdInTz, ymdToUtc, computeAttendanceEffectiveness, type ScheduleAssignment } from "@/lib/timezone";
import { usePortalTimeZone } from "@/lib/context/PortalTimeZoneContext";

interface FamilyMember { id: string; fullName: string; isMe: boolean; }

interface AttendanceRow {
  id: string; type: string; markedAt: string;
  student:  { id: string; fullName: string };
  schedule: { name: string; startTime: string } | null;
  corrected: boolean;
}

type StudentScheduleRow = ScheduleAssignment & { studentId: string };

export default function PortalAttendancePage() {
  const tz = usePortalTimeZone();
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: tz });

  const today   = ymdInTz(new Date(), tz);
  const defFrom = today.slice(0, 7) + "-01"; // YYYY-MM-01
  const defTo   = today;

  const [from,             setFrom]            = useState(defFrom);
  const [to,               setTo]              = useState(defTo);
  const [rows,             setRows]            = useState<AttendanceRow[]>([]);
  const [studentSchedules, setStudentSchedules] = useState<StudentScheduleRow[]>([]);
  const [lateToleranceMinutes, setLateToleranceMinutes] = useState(10);
  const [loading,          setLoading]         = useState(false);
  const [loaded,           setLoaded]          = useState(false);
  const [familyMembers,    setFamilyMembers]   = useState<FamilyMember[]>([]);
  const [selectedId,       setSelectedId]      = useState<string>("");

  // Cargar familia al montar — solo muestra selector si hay 2+ miembros
  useEffect(() => {
    fetch("/api/portal/family")
      .then(r => r.ok ? r.json() : [])
      .then((members: FamilyMember[]) => {
        setFamilyMembers(members);
        if (members.length > 1) {
          const me = members.find(m => m.isMe);
          if (me) setSelectedId(me.id);
        }
      })
      .catch(() => { /* sin familia, comportamiento normal */ });
  }, []);

  const isFamily = familyMembers.length > 1;

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    p.set("dateFrom", ymdToUtc(from, tz).toISOString());
    p.set("dateTo",   ymdToUtc(to, tz, 23, 59, 59).toISOString());
    if (isFamily && selectedId) p.set("studentId", selectedId);
    const r = await fetch(`/api/portal/attendance?${p}`);
    if (r.ok) {
      const data = await r.json();
      setRows(data.rows ?? []);
      setStudentSchedules(data.studentSchedules ?? []);
      setLateToleranceMinutes(data.lateToleranceMinutes ?? 10);
    }
    setLoading(false);
    setLoaded(true);
  }, [from, to, selectedId, isFamily, tz]);

  const showStudentName = isFamily && selectedId === "all";

  const entries = rows.filter(r => r.type === "entry").length;
  const exits   = rows.filter(r => r.type === "exit").length;
  const lateTotalMinutes = useMemo(() => {
    return rows
      .filter(r => r.type === "entry")
      .reduce((sum, r) => sum + getLateMinutes(r.markedAt, r.schedule?.startTime ?? null, lateToleranceMinutes, tz), 0);
  }, [rows, lateToleranceMinutes, tz]);

  // Total de clases esperadas según horario(s) asignado(s) y rango de fechas filtrado
  const expectedTotal = useMemo(() => {
    if (studentSchedules.length === 0) return null;
    const byStudent = new Map<string, ScheduleAssignment[]>();
    for (const s of studentSchedules) {
      if (!byStudent.has(s.studentId)) byStudent.set(s.studentId, []);
      byStudent.get(s.studentId)!.push(s);
    }
    let total = 0;
    let any = false;
    for (const [studentId, schedules] of byStudent) {
      const attendedYMDs = new Set(
        rows.filter(r => r.type === "entry" && r.student.id === studentId).map(r => ymdInTz(r.markedAt, tz))
      );
      const res = computeAttendanceEffectiveness(schedules, from, to, attendedYMDs, tz);
      if (res) { total += res.expected; any = true; }
    }
    return any ? total : null;
  }, [studentSchedules, rows, from, to, tz]);

  // Agrupa entrada + salida del mismo alumno/día en una sola fila para que la lista no sea tan larga
  const rowsByDay = useMemo(() => {
    const map = new Map<string, { key: string; studentName: string; ymd: string; entry?: AttendanceRow; exit?: AttendanceRow }>();
    for (const r of rows) {
      const ymd = ymdInTz(r.markedAt, tz);
      const key = `${r.student.id}|${ymd}`;
      if (!map.has(key)) map.set(key, { key, studentName: r.student.fullName, ymd });
      const g = map.get(key)!;
      if (r.type === "entry") g.entry = r; else g.exit = r;
    }
    return Array.from(map.values()).sort((a, b) => b.ymd.localeCompare(a.ymd) || a.studentName.localeCompare(b.studentName));
  }, [rows, tz]);

  return (
    <div className="space-y-5">
      {/* Disciplina del mes — siempre muestra el mes en curso */}
      <DisciplineBarPortal />

      <h1 className="font-display text-xl font-bold text-dojo-white">Mi Asistencia</h1>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">

        {/* Selector de alumno — solo cuando hay familia */}
        {isFamily && (
          <div className="w-full space-y-1">
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
        )}

        <div className="flex-1 space-y-1">
          <label className="form-label text-xs">Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input" style={{ fontSize: "16px" }} />
        </div>
        <div className="flex-1 space-y-1">
          <label className="form-label text-xs">Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="form-input" style={{ fontSize: "16px" }} />
        </div>
        <div className="flex items-end">
          <button onClick={load} disabled={loading} className="btn-primary w-full sm:w-auto">
            <Search size={15} /> {loading ? "..." : "Buscar"}
          </button>
        </div>
      </div>

      {loaded && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card text-center" title={expectedTotal !== null ? "Clases esperadas según horario asignado en este período" : "Sin horario asignado en este período"}>
              <p className={`text-2xl font-bold ${expectedTotal !== null ? "text-dojo-white" : "text-dojo-muted"}`}>
                {expectedTotal !== null ? expectedTotal : "N/D"}
              </p>
              <p className="text-xs text-dojo-muted">Total</p>
            </div>
            {[
              { label: "Entradas", value: entries,     color: "text-green-400"  },
              { label: "Salidas",  value: exits,       color: "text-red-400"    },
            ].map(s => (
              <div key={s.label} className="card text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-dojo-muted">{s.label}</p>
              </div>
            ))}
            <div className="card text-center" title={`Tolerancia configurada: ${lateToleranceMinutes} min`}>
              <p className={`text-2xl font-bold ${lateTotalMinutes > 0 ? "text-yellow-400" : "text-dojo-white"}`}>
                {formatLateTotal(lateTotalMinutes)}
              </p>
              <p className="text-xs text-dojo-muted">Tiempo en tardanzas</p>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            {rowsByDay.length === 0 ? (
              <div className="text-center py-10 text-dojo-muted">
                <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin marcaciones en este período.</p>
              </div>
            ) : (
              <div className="divide-y divide-dojo-border max-h-[420px] overflow-y-auto">
                {rowsByDay.map(g => {
                  const lateMin = g.entry ? getLateMinutes(g.entry.markedAt, g.entry.schedule?.startTime ?? null, lateToleranceMinutes, tz) : 0;
                  const scheduleName = g.entry?.schedule?.name ?? g.exit?.schedule?.name;
                  const [y, m, d] = g.ymd.split("-");
                  return (
                  <div key={g.key} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-sm text-dojo-white">
                        {showStudentName && (
                          <span className="font-semibold text-dojo-white/70">{g.studentName}{" · "}</span>
                        )}
                        {d}/{m}/{y}
                      </p>
                      {scheduleName && <p className="text-xs text-dojo-muted truncate">{scheduleName}</p>}
                    </div>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-green-900/40">
                          <LogIn size={13} className="text-green-400" />
                        </div>
                        <span className="text-sm text-dojo-white">{g.entry ? fmtTime(g.entry.markedAt) : "—"}</span>
                        {lateMin > 0 && <span className="badge-gold text-xs">Tardanza +{lateMin} min</span>}
                        {g.entry?.corrected && <span className="badge-yellow text-xs">Corregida</span>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-red-900/40">
                          <LogOut size={13} className="text-red-400" />
                        </div>
                        <span className="text-sm text-dojo-white">{g.exit ? fmtTime(g.exit.markedAt) : "—"}</span>
                        {g.exit?.corrected && <span className="badge-yellow text-xs">Corregida</span>}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
