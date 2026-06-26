"use client";
import { useState, useCallback, useEffect } from "react";
import { ClipboardList, LogIn, LogOut, Search, Users } from "lucide-react";

interface FamilyMember { id: string; fullName: string; isMe: boolean; }

interface AttendanceRow {
  id: string; type: string; markedAt: string;
  student:  { id: string; fullName: string };
  schedule: { name: string } | null;
  corrected: boolean;
}

const TZ = "America/Panama";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PA", { timeZone: TZ });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PA", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

export default function PortalAttendancePage() {
  const now       = new Date();
  const pad       = (n: number) => String(n).padStart(2, "0");
  const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const defFrom   = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const defTo     = localDate(now);

  const [from,             setFrom]            = useState(defFrom);
  const [to,               setTo]              = useState(defTo);
  const [rows,             setRows]            = useState<AttendanceRow[]>([]);
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
    p.set("dateFrom", `${from}T00:00:00-05:00`);
    p.set("dateTo",   `${to}T23:59:59-05:00`);
    if (isFamily && selectedId) p.set("studentId", selectedId);
    const r = await fetch(`/api/portal/attendance?${p}`);
    if (r.ok) setRows(await r.json());
    setLoading(false);
    setLoaded(true);
  }, [from, to, selectedId, isFamily]);

  const showStudentName = isFamily && selectedId === "all";

  const entries = rows.filter(r => r.type === "entry").length;
  const exits   = rows.filter(r => r.type === "exit").length;

  return (
    <div className="space-y-5">
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
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total",    value: rows.length, color: "text-dojo-white" },
              { label: "Entradas", value: entries,     color: "text-green-400"  },
              { label: "Salidas",  value: exits,       color: "text-red-400"    },
            ].map(s => (
              <div key={s.label} className="card text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-dojo-muted">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="card p-0 overflow-hidden">
            {rows.length === 0 ? (
              <div className="text-center py-10 text-dojo-muted">
                <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin marcaciones en este período.</p>
              </div>
            ) : (
              <div className="divide-y divide-dojo-border">
                {rows.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      a.type === "entry" ? "bg-green-900/40" : "bg-red-900/40"
                    }`}>
                      {a.type === "entry"
                        ? <LogIn  size={14} className="text-green-400" />
                        : <LogOut size={14} className="text-red-400"   />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-dojo-white">
                        {fmtDate(a.markedAt)} · {fmtTime(a.markedAt)}
                      </p>
                      <p className="text-xs text-dojo-muted truncate">
                        {showStudentName && (
                          <span className="font-semibold text-dojo-white/70">{a.student.fullName}{" · "}</span>
                        )}
                        {a.schedule?.name}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      a.type === "entry" ? "text-green-400 bg-green-900/30" : "text-red-400 bg-red-900/30"
                    }`}>
                      {a.type === "entry" ? "Entrada" : "Salida"}
                    </span>
                    {a.corrected && <span className="badge-yellow text-xs">Corregida</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
