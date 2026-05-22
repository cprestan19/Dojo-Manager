"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, QrCode, Search, Check, X, ChevronRight } from "lucide-react";
import { KATA_OPTIONS, RESULT_OPTIONS, type TEventDetail, type TEventParticipant } from "@/lib/tournament-events";
import { getBeltInfo } from "@/lib/utils";

export default function TournamentEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [data,    setData]    = useState<TEventDetail | null>(null);
  const [filter,  setFilter]  = useState<"all" | "arrived" | "pending">("all");
  const [search,  setSearch]  = useState("");
  const [modal,   setModal]   = useState<TEventParticipant | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [editForm, setEditForm] = useState<Partial<TEventParticipant>>({});
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/tournament-events/${id}`);
    if (r.ok) setData(await r.json());
  }, [id]);

  useEffect(() => {
    load();
    pollingRef.current = setInterval(load, 6000); // polling cada 6s para múltiples escáneres
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [load]);

  function openModal(p: TEventParticipant) {
    setModal(p);
    setEditForm({
      arrived:          p.arrived,
      kataName:         p.kataName   ?? "",
      kataResult:       p.kataResult ?? "",
      kumiteResult:     p.kumiteResult ?? "",
      competitionNotes: p.competitionNotes ?? "",
    });
  }
  function closeModal() { setModal(null); setEditForm({}); }

  async function saveResult() {
    if (!modal) return;
    setSaving(true);
    try {
      await fetch(`/api/tournament-events/${id}/participants/${modal.participantId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(editForm),
      });
      await load();
      closeModal();
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  const participants = (data?.participants ?? []).filter(p => {
    if (filter === "arrived" && !p.arrived) return false;
    if (filter === "pending" && p.arrived)  return false;
    if (search && !p.fullName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (!data) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-4 border-dojo-red border-t-transparent animate-spin" />
    </div>
  );

  const dateStr = new Date(data.date).toLocaleDateString("es-PA", {
    weekday:"long", day:"numeric", month:"long", year:"numeric",
  });

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Cabecera */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push("/dashboard/tournament-events")}
          className="p-2 rounded-lg hover:bg-dojo-border transition-colors text-dojo-muted hover:text-dojo-white mt-1 shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold text-dojo-white leading-tight">{data.name}</h1>
          <p className="text-dojo-muted text-sm mt-0.5 capitalize">{dateStr}</p>
          <p className="text-dojo-muted text-xs">{data.location}</p>
        </div>
        <a href={`/dashboard/tournament-events/${id}/scan`}
          className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl text-white"
          style={{ background: "#C0392B" }}>
          <QrCode size={14} /> Escanear QR
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Inscritos",  value: data.totalStudents, color:"text-dojo-white"  },
          { label:"Llegaron",   value: data.arrivedCount,  color:"text-green-400"  },
          { label:"Resultados", value: data.resultsCount,  color:"text-dojo-gold"  },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-dojo-muted text-xs mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
          <input className="form-input pl-8 text-sm" placeholder="Buscar alumno..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {(["all","arrived","pending"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              filter === f
                ? "bg-dojo-white text-dojo-darker border-transparent"
                : "bg-dojo-card text-dojo-muted border-dojo-border hover:border-dojo-border/60"
            }`}>
            {f === "all" ? "Todos" : f === "arrived" ? "✅ Llegaron" : "⏳ Pendientes"}
          </button>
        ))}
      </div>
      <p className="text-xs text-dojo-muted -mt-2">🔄 Actualización automática cada 6 seg.</p>

      {/* Lista de participantes */}
      <div className="space-y-2">
        {participants.map(p => {
          const bInfo = p.belt ? getBeltInfo(p.belt) : null;
          const hasResult = p.kataResult || p.kumiteResult;
          return (
            <div
              key={p.participantId}
              onClick={() => openModal(p)}
              className={`card flex items-center gap-3 cursor-pointer hover:border-dojo-red/50 transition-all py-3 ${
                p.arrived ? "border-green-700/40" : "border-dojo-border"
              }`}
            >
              {/* Indicador llegada */}
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                p.arrived ? "bg-green-500" : "bg-dojo-border"
              }`} />

              {/* Foto/iniciales */}
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-dojo-darker flex items-center justify-center shrink-0">
                {p.photo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.photo} alt={p.fullName} className="w-full h-full object-cover" />
                  : <span className="text-dojo-gold font-bold text-xs">
                      {p.fullName.split(" ").slice(0,2).map(w=>w[0]).join("")}
                    </span>
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-dojo-white">{p.fullName}</span>
                  {p.arrived
                    ? <span className="text-xs text-green-400 font-medium">✓ Presente</span>
                    : <span className="text-xs text-dojo-muted">Pendiente</span>
                  }
                  {hasResult && <span className="text-xs bg-dojo-gold/20 text-dojo-gold px-1.5 py-0.5 rounded-full">Resultado</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {bInfo && (
                    <span className="flex items-center gap-1 text-xs text-dojo-muted">
                      <span className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor: bInfo.hex }} />
                      {bInfo.label}
                    </span>
                  )}
                  <span className="text-xs text-dojo-muted">{p.age} años</span>
                  {p.arrivedAt && (
                    <span className="text-xs text-dojo-muted">
                      Llegó: {new Date(p.arrivedAt).toLocaleTimeString("es-PA", { hour:"2-digit", minute:"2-digit" })}
                    </span>
                  )}
                </div>
                {p.kataName && (
                  <p className="text-xs text-dojo-muted mt-0.5">
                    🥋 {p.kataName}{p.kataResult ? ` · ${p.kataResult}` : ""}
                  </p>
                )}
                {p.kumiteResult && <p className="text-xs text-dojo-muted">🥊 Kumite: {p.kumiteResult}</p>}
              </div>
              <ChevronRight size={16} className="text-dojo-muted shrink-0" />
            </div>
          );
        })}

        {participants.length === 0 && (
          <div className="text-center py-10 text-dojo-muted">
            <p className="text-sm">Sin resultados para este filtro</p>
          </div>
        )}
      </div>

      {/* ══ MODAL DE RESULTADOS ══ */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-dojo-card border border-dojo-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="p-5 space-y-4">
              <div className="w-10 h-1 bg-dojo-border rounded mx-auto sm:hidden" />

              {/* Cabecera alumno */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-dojo-darker flex items-center justify-center">
                  {modal.photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={modal.photo} alt="" className="w-full h-full object-cover" />
                    : <span className="text-dojo-gold font-bold text-xs">
                        {modal.fullName.split(" ").slice(0,2).map(w=>w[0]).join("")}
                      </span>
                  }
                </div>
                <div>
                  <p className="font-bold text-dojo-white">{modal.fullName}</p>
                  <p className="text-dojo-muted text-xs">{modal.belt} · {modal.age} años</p>
                </div>
              </div>

              {/* Toggle llegada */}
              <div
                className="flex items-center justify-between bg-dojo-darker rounded-xl p-3 cursor-pointer"
                onClick={() => setEditForm(f => ({ ...f, arrived: !f.arrived }))}
              >
                <span className="text-sm text-dojo-white font-medium">
                  {editForm.arrived ? "✅ Llegó al torneo" : "⏳ Pendiente de llegada"}
                </span>
                <div className={`w-12 h-6 rounded-full relative transition-colors ${editForm.arrived ? "bg-green-500" : "bg-dojo-border"}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${editForm.arrived ? "left-6" : "left-0.5"}`} />
                </div>
              </div>

              {/* ── SECCIÓN KATA ── */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-dojo-muted uppercase tracking-wider">🥋 Kata</p>
                <div>
                  <label className="form-label">Kata ejecutado</label>
                  <select className="form-input"
                    value={editForm.kataName ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, kataName: e.target.value }))}>
                    <option value="">— Seleccionar kata —</option>
                    {KATA_OPTIONS.map(g => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map(k => <option key={k}>{k}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Resultado en Kata</label>
                  <select className="form-input"
                    value={editForm.kataResult ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, kataResult: e.target.value }))}>
                    <option value="">— Sin resultado —</option>
                    {RESULT_OPTIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* ── SECCIÓN KUMITE ── */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-dojo-muted uppercase tracking-wider">🥊 Kumite</p>
                <div>
                  <label className="form-label">Resultado en Kumite</label>
                  <select className="form-input"
                    value={editForm.kumiteResult ?? ""}
                    onChange={e => setEditForm(f => ({ ...f, kumiteResult: e.target.value }))}>
                    <option value="">— Sin resultado —</option>
                    {RESULT_OPTIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="form-label">Notas (opcional)</label>
                <textarea className="form-input resize-none min-h-[60px]"
                  placeholder="Observaciones..."
                  value={editForm.competitionNotes ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, competitionNotes: e.target.value }))} />
              </div>

              <p className="text-xs text-dojo-muted bg-dojo-darker rounded-lg px-3 py-2">
                💡 Los resultados se guardarán automáticamente en el historial de competencias del alumno.
              </p>

              {/* Botones */}
              <div className="flex gap-3 pt-1">
                <button onClick={closeModal} className="btn-secondary flex-1 justify-center">
                  Cancelar
                </button>
                <button onClick={saveResult} disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? "Guardando..." : "💾 Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
