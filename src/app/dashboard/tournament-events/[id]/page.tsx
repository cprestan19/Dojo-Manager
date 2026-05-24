"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, QrCode, Search, Check, X, ChevronRight, Pencil, Printer, UserPlus } from "lucide-react";
import { KATA_OPTIONS, RESULT_OPTIONS, type TEventDetail, type TEventParticipant } from "@/lib/tournament-events";
import { getBeltInfo } from "@/lib/utils";

function printParticipantList(data: TEventDetail) {
  const dateStr = new Date(data.date).toLocaleDateString("es-PA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const today = new Date().toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" });

  const rows = data.participants.map((p, i) => {
    const arrived  = p.arrived
      ? `<span style="color:#16a34a;font-weight:700">✓ Presente</span>`
      : `<span style="color:#9ca3af">Pendiente</span>`;
    const result = (p.kataResult || p.kumiteResult)
      ? `<span style="color:#b45309">🏅 ${[p.kataResult, p.kumiteResult].filter(Boolean).join(" · ")}</span>`
      : "—";
    return `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
        <td style="padding:6px 8px;text-align:center;color:#6b7280;font-size:11px">${i + 1}</td>
        <td style="padding:6px 8px;font-family:monospace;font-size:12px;color:#92400e;font-weight:700">${p.studentCode ? `#${p.studentCode}` : "—"}</td>
        <td style="padding:6px 8px;font-weight:600">${p.fullName}</td>
        <td style="padding:6px 8px;color:#555;font-size:12px">${p.belt || "—"}</td>
        <td style="padding:6px 8px;text-align:center;color:#555;font-size:12px">${p.age > 0 ? `${p.age} a.` : "—"}</td>
        <td style="padding:6px 8px;font-size:12px">${arrived}</td>
        <td style="padding:6px 8px;font-size:11px;color:#6b7280">${p.category || "—"}</td>
        <td style="padding:6px 8px;font-size:11px">${result}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${data.name} — Lista de Participantes</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; }
    h1 { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
    .sub { font-size: 12px; color: #555; margin-bottom: 4px; }
    .meta { font-size: 11px; color: #888; margin-bottom: 18px; }
    .stats { display: flex; gap: 16px; margin-bottom: 18px; }
    .stat { background: #f3f4f6; border-radius: 8px; padding: 10px 16px; text-align: center; }
    .stat .n { font-size: 22px; font-weight: 900; }
    .stat .l { font-size: 10px; color: #6b7280; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead tr { background: #f0f0f0; }
    th { padding: 6px 8px; text-align: left; font-weight: 700; font-size: 11px; color: #333; }
    td { border-bottom: 1px solid #f0f0f0; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>🏆 ${data.name}</h1>
  <p class="sub">📍 ${data.location} &nbsp;·&nbsp; 📅 ${dateStr}</p>
  <p class="meta">Generado el ${today}</p>
  <div class="stats">
    <div class="stat"><div class="n">${data.totalStudents}</div><div class="l">Inscritos</div></div>
    <div class="stat" style="color:#16a34a"><div class="n" style="color:#16a34a">${data.arrivedCount}</div><div class="l" style="color:#555">Llegaron</div></div>
    <div class="stat"><div class="n" style="color:#9ca3af">${data.totalStudents - data.arrivedCount}</div><div class="l">Pendientes</div></div>
    <div class="stat"><div class="n" style="color:#b45309">${data.resultsCount}</div><div class="l">Con resultado</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>ID</th><th>Alumno</th><th>Cinta</th>
        <th>Edad</th><th>Asistencia</th><th>Categoría</th><th>Resultado</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

function parseMedal(result: string | null): "gold" | "silver" | "bronze" | null {
  if (!result) return null;
  if (result.includes("Oro"))    return "gold";
  if (result.includes("Plata"))  return "silver";
  if (result.includes("Bronce")) return "bronze";
  return null;
}

function printEventStats(data: TEventDetail) {
  const dateStr = new Date(data.date).toLocaleDateString("es-PA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const today = new Date().toLocaleDateString("es-PA", { day: "numeric", month: "long", year: "numeric" });

  type MedalEntry = { fullName: string; studentCode: number | null; belt: string; age: number; categories: string[]; gold: number; silver: number; bronze: number };
  const map = new Map<string, MedalEntry>();

  for (const p of data.participants) {
    if (!map.has(p.studentId)) {
      map.set(p.studentId, { fullName: p.fullName, studentCode: p.studentCode, belt: p.belt, age: p.age, categories: [], gold: 0, silver: 0, bronze: 0 });
    }
    const e = map.get(p.studentId)!;
    if (p.category?.trim() && !e.categories.includes(p.category.trim())) e.categories.push(p.category.trim());
    for (const r of [p.kataResult, p.kumiteResult]) {
      const m = parseMedal(r);
      if (m === "gold")   e.gold++;
      if (m === "silver") e.silver++;
      if (m === "bronze") e.bronze++;
    }
  }

  const all = [...map.values()].filter(e => e.gold + e.silver + e.bronze > 0);
  const goldList   = all.filter(e => e.gold > 0)  .sort((a, b) => b.gold - a.gold   || b.silver - a.silver || b.bronze - a.bronze);
  const silverList = all.filter(e => e.gold === 0 && e.silver > 0).sort((a, b) => b.silver - a.silver || b.bronze - a.bronze);
  const bronzeList = all.filter(e => e.gold === 0 && e.silver === 0 && e.bronze > 0).sort((a, b) => b.bronze - a.bronze);

  const totalGold   = all.reduce((s, e) => s + e.gold,   0);
  const totalSilver = all.reduce((s, e) => s + e.silver, 0);
  const totalBronze = all.reduce((s, e) => s + e.bronze, 0);

  function rows(list: MedalEntry[]) {
    return list.map((e, i) => `
      <tr style="background:${i % 2 === 0 ? "#fff" : "#f9f9f9"}">
        <td style="padding:7px 10px;font-family:monospace;font-size:12px;color:#92400e;font-weight:700">${e.studentCode ? `#${e.studentCode}` : "—"}</td>
        <td style="padding:7px 10px;font-weight:600">${e.fullName}</td>
        <td style="padding:7px 10px;color:#555;font-size:12px">${e.belt || "—"}</td>
        <td style="padding:7px 10px;color:#555;text-align:center;font-size:12px">${e.age > 0 ? `${e.age} años` : "—"}</td>
        <td style="padding:7px 10px;color:#555;font-size:12px">${e.categories.length > 0 ? e.categories.join(", ") : "—"}</td>
        <td style="padding:7px 10px;text-align:center">
          ${e.gold   > 0 ? `🥇 ${e.gold}  ` : ""}${e.silver > 0 ? `🥈 ${e.silver}  ` : ""}${e.bronze > 0 ? `🥉 ${e.bronze}` : ""}
        </td>
      </tr>`).join("");
  }

  function section(emoji: string, label: string, color: string, list: MedalEntry[]) {
    if (list.length === 0) return "";
    return `
      <h3 style="color:${color};margin:22px 0 8px;font-size:15px">${emoji} ${label} <span style="font-size:12px;color:#888">(${list.length} alumno${list.length !== 1 ? "s" : ""})</span></h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:6px">
        <thead>
          <tr style="background:#f0f0f0;color:#333">
            <th style="padding:7px 10px;text-align:left">ID</th>
            <th style="padding:7px 10px;text-align:left">Alumno</th>
            <th style="padding:7px 10px;text-align:left">Cinta</th>
            <th style="padding:7px 10px;text-align:center">Edad</th>
            <th style="padding:7px 10px;text-align:left">Categoría</th>
            <th style="padding:7px 10px;text-align:center">Medallas</th>
          </tr>
        </thead>
        <tbody>${rows(list)}</tbody>
      </table>`;
  }

  const noMedals = all.length === 0
    ? `<p style="color:#888;font-size:13px;margin-top:20px">No hay resultados con medallas registrados para este torneo.</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Estadísticas — ${data.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Nunito', Arial, sans-serif; padding: 28px; color: #1a1a1a; }
    h1 { font-size: 20px; font-weight: 800; margin-bottom: 2px; }
    .sub { font-size: 12px; color: #555; margin-bottom: 2px; }
    .date { font-size: 11px; color: #aaa; margin-bottom: 20px; }
    .medals { display: flex; gap: 14px; margin-bottom: 24px; }
    .medal-card { flex: 1; text-align: center; padding: 16px 8px; border-radius: 12px; }
    .medal-card .emoji { font-size: 26px; }
    .medal-card .count { font-size: 28px; font-weight: 900; margin: 4px 0; }
    .medal-card .lbl { font-size: 11px; color: #666; font-weight: 600; }
    .gold-card   { background: #fffbeb; border: 1px solid #fde68a; }
    .silver-card { background: #f9fafb; border: 1px solid #e5e7eb; }
    .bronze-card { background: #fff7ed; border: 1px solid #fed7aa; }
    @media print { body { padding: 14px; } }
  </style>
</head>
<body>
  <h1>🏆 ${data.name}</h1>
  <p class="sub">📍 ${data.location} &nbsp;·&nbsp; 📅 ${dateStr}</p>
  <p class="date">Estadísticas de Medallas · Generado el ${today}</p>

  <div class="medals">
    <div class="medal-card gold-card">
      <div class="emoji">🥇</div>
      <div class="count" style="color:#b45309">${totalGold}</div>
      <div class="lbl">Medallas de Oro</div>
    </div>
    <div class="medal-card silver-card">
      <div class="emoji">🥈</div>
      <div class="count" style="color:#6b7280">${totalSilver}</div>
      <div class="lbl">Medallas de Plata</div>
    </div>
    <div class="medal-card bronze-card">
      <div class="emoji">🥉</div>
      <div class="count" style="color:#c2410c">${totalBronze}</div>
      <div class="lbl">Medallas de Bronce</div>
    </div>
  </div>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:18px">

  ${noMedals}
  ${section("🥇", "Con Medalla de Oro",    "#b45309", goldList)}
  ${section("🥈", "Con Medalla de Plata",  "#6b7280", silverList)}
  ${section("🥉", "Con Medalla de Bronce", "#c2410c", bronzeList)}

  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

export default function TournamentEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [data,    setData]    = useState<TEventDetail | null>(null);
  const [filter,  setFilter]  = useState<"all" | "arrived" | "pending" | "withResults">("all");
  const [search,  setSearch]  = useState("");
  const [modal,   setModal]   = useState<TEventParticipant | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [saveOk,  setSaveOk]  = useState(false);
  const [editForm, setEditForm] = useState<Partial<TEventParticipant>>({});
  const pollingRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Agregar alumno a último momento ────────────────────────────
  type StudentResult = { id: string; fullName: string; studentCode: number | null; belt: string | null };
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [addSearch,     setAddSearch]     = useState("");
  const [addResults,    setAddResults]    = useState<StudentResult[]>([]);
  const [addSearching,  setAddSearching]  = useState(false);
  const [adding,        setAdding]        = useState<string | null>(null); // studentId en proceso
  const [addErr,        setAddErr]        = useState("");
  const [addOkName,     setAddOkName]     = useState("");

  function openAddModal() {
    setAddSearch(""); setAddResults([]); setAddErr(""); setAddOkName(""); setAdding(null);
    setShowAddModal(true);
  }
  function closeAddModal() {
    setShowAddModal(false);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }

  function handleAddSearch(val: string) {
    setAddSearch(val);
    setAddErr("");
    setAddOkName("");
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (val.trim().length < 2) { setAddResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setAddSearching(true);
      try {
        const r = await fetch(`/api/tournament-events/${id}/participants?search=${encodeURIComponent(val.trim())}`);
        if (r.ok) setAddResults(await r.json());
      } catch { /* silenciar */ }
      finally { setAddSearching(false); }
    }, 350);
  }

  async function addStudent(student: StudentResult) {
    setAdding(student.id);
    setAddErr("");
    try {
      const r = await fetch(`/api/tournament-events/${id}/participants`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ studentId: student.id }),
      });
      const json = await r.json().catch(() => ({})) as { error?: string; alreadyEnrolled?: boolean };
      if (!r.ok) {
        setAddErr(json.error ?? `Error al agregar (${r.status})`);
        return;
      }
      setAddOkName(student.fullName);
      setAddSearch("");
      setAddResults([]);
      await load(); // refresca la lista principal
    } catch {
      setAddErr("Error de conexión");
    } finally {
      setAdding(null);
    }
  }

  // ── Edición del evento ──────────────────────────────────────────
  const [editEvent,     setEditEvent]     = useState(false);
  const [eventForm,     setEventForm]     = useState({ name: "", date: "", location: "", notes: "" });
  const [savingEvent,   setSavingEvent]   = useState(false);
  const [eventFormErr,  setEventFormErr]  = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/tournament-events/${id}`);
      if (r.ok) setData(await r.json());
    } catch { /* red temporalmente no disponible */ }
  }, [id]);

  useEffect(() => {
    load();
    pollingRef.current = setInterval(load, 6000); // polling cada 6s para múltiples escáneres
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [load]);

  function openModal(p: TEventParticipant) {
    setSaveErr("");
    setSaveOk(false);
    setModal(p);
    setEditForm({
      arrived:          p.arrived,
      category:         p.category ?? "",
      kataName:         p.kataName   ?? "",
      kataResult:       p.kataResult ?? "",
      kumiteResult:     p.kumiteResult ?? "",
      competitionNotes: p.competitionNotes ?? "",
    });
  }
  function closeModal() { setModal(null); setEditForm({}); setSaveErr(""); setSaveOk(false); }

  async function saveResult() {
    if (!modal) return;
    setSaving(true);
    setSaveErr("");
    setSaveOk(false);
    try {
      const res  = await fetch(`/api/tournament-events/${id}/participants/${modal.participantId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(editForm),
      });
      const json = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setSaveErr(json.error ?? `Error al guardar (${res.status})`);
        return;
      }
      await load();
      setSaveOk(true);
      setTimeout(closeModal, 1500);
    } catch (e) {
      setSaveErr(`Error de conexión: ${e instanceof Error ? e.message : "verifica tu red"}`);
    } finally {
      setSaving(false);
    }
  }

  function openEditEvent() {
    if (!data) return;
    // datetime-local necesita "YYYY-MM-DDThh:mm"
    const localDate = new Date(data.date);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${localDate.getFullYear()}-${pad(localDate.getMonth()+1)}-${pad(localDate.getDate())}T${pad(localDate.getHours())}:${pad(localDate.getMinutes())}`;
    setEventForm({ name: data.name, date: dateStr, location: data.location, notes: data.notes ?? "" });
    setEventFormErr("");
    setEditEvent(true);
  }

  async function saveEvent() {
    if (!eventForm.name.trim() || !eventForm.date || !eventForm.location.trim()) {
      setEventFormErr("Nombre, fecha y lugar son requeridos");
      return;
    }
    setSavingEvent(true);
    setEventFormErr("");
    try {
      const res = await fetch(`/api/tournament-events/${id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(eventForm),
      });
      const json = await res.json();
      if (!res.ok) { setEventFormErr(json.error ?? "Error al guardar"); return; }
      await load();
      setEditEvent(false);
    } catch {
      setEventFormErr("Error de conexión");
    } finally {
      setSavingEvent(false);
    }
  }

  const participants = (data?.participants ?? []).filter(p => {
    if (filter === "arrived"     && !p.arrived) return false;
    if (filter === "pending"     && p.arrived)  return false;
    if (filter === "withResults" && !(p.arrived && (p.kataResult || p.kumiteResult))) return false;
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
        <button onClick={() => { router.refresh(); router.push("/dashboard/tournament-events"); }}
          className="p-2 rounded-lg hover:bg-dojo-border transition-colors text-dojo-muted hover:text-dojo-white mt-1 shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-dojo-white leading-tight">{data.name}</h1>
            <button onClick={openEditEvent}
              className="text-dojo-muted hover:text-dojo-white transition-colors shrink-0"
              title="Editar torneo">
              <Pencil size={14} />
            </button>
          </div>
          <p className="text-dojo-muted text-sm mt-0.5 capitalize">{dateStr}</p>
          <p className="text-dojo-muted text-xs">{data.location}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => data && printParticipantList(data)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-dojo-card border border-dojo-border text-dojo-muted hover:text-dojo-white transition-colors"
            title="Imprimir lista de participantes"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Lista</span>
          </button>
          <button
            onClick={() => data && printEventStats(data)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-dojo-gold/10 border border-dojo-gold/30 text-dojo-gold hover:bg-dojo-gold/20 transition-colors"
            title="Imprimir estadísticas de medallas"
          >
            <Printer size={14} />
            <span className="hidden sm:inline">Estadísticas</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-dojo-card border border-dojo-border text-dojo-muted hover:text-dojo-white hover:border-dojo-white/30 transition-colors"
            title="Agregar alumno al torneo"
          >
            <UserPlus size={14} />
            <span className="hidden sm:inline">Agregar</span>
          </button>
          <a href={`/dashboard/tournament-events/${id}/scan`}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl text-white"
            style={{ background: "#C0392B" }}>
            <QrCode size={14} /> <span className="hidden sm:inline">Escanear QR</span><span className="sm:hidden">QR</span>
          </a>
        </div>
      </div>

      {/* Stats — clicables */}
      <div className="grid grid-cols-3 gap-3">
        {/* Inscritos → todos */}
        <button
          onClick={() => setFilter("all")}
          className={`card text-center py-3 transition-all border ${
            filter === "all"
              ? "border-dojo-white/40 bg-dojo-white/5"
              : "border-dojo-border hover:border-dojo-white/30"
          }`}
        >
          <p className="text-2xl font-bold text-dojo-white">{data.totalStudents}</p>
          <p className="text-dojo-muted text-xs mt-0.5">Inscritos</p>
        </button>

        {/* Llegaron → filtra llegados */}
        <button
          onClick={() => setFilter(filter === "arrived" ? "all" : "arrived")}
          className={`card text-center py-3 transition-all border ${
            filter === "arrived"
              ? "border-green-500/50 bg-green-500/10"
              : "border-dojo-border hover:border-green-500/30"
          }`}
        >
          <p className="text-2xl font-bold text-green-400">{data.arrivedCount}</p>
          <p className="text-dojo-muted text-xs mt-0.5">Llegaron</p>
        </button>

        {/* Resultados → filtra llegados con resultados */}
        <button
          onClick={() => setFilter(filter === "withResults" ? "all" : "withResults")}
          className={`card text-center py-3 transition-all border ${
            filter === "withResults"
              ? "border-dojo-gold/50 bg-dojo-gold/10"
              : "border-dojo-border hover:border-dojo-gold/30"
          }`}
        >
          <p className="text-2xl font-bold text-dojo-gold">{data.resultsCount}</p>
          <p className="text-dojo-muted text-xs mt-0.5">Resultados</p>
        </button>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
          <input className="form-input pl-8 text-sm w-full" placeholder="Buscar alumno..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all","arrived","withResults","pending"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                filter === f
                  ? "bg-dojo-white text-dojo-darker border-transparent"
                  : "bg-dojo-card text-dojo-muted border-dojo-border hover:border-dojo-border/60"
              }`}>
              {f === "all"         ? "Todos"
               : f === "arrived"     ? "✅ Llegaron"
               : f === "withResults" ? "🏅 Con resultado"
               :                      "⏳ Pendiente"}
            </button>
          ))}
        </div>
        <p className="text-xs text-dojo-muted">🔄 Actualización automática cada 6 seg.</p>
      </div>

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
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {p.studentCode && (
                    <span className="text-xs font-mono font-bold text-dojo-gold bg-dojo-gold/10 px-1.5 py-0.5 rounded leading-none">
                      #{p.studentCode}
                    </span>
                  )}
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
                {p.category && (
                  <p className="text-xs text-dojo-muted mt-0.5">
                    🏷️ {p.category}
                  </p>
                )}
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
          <div className="text-center py-10 text-dojo-muted space-y-1">
            <p className="text-2xl">{filter === "withResults" ? "🏅" : filter === "arrived" ? "✅" : "🔍"}</p>
            <p className="text-sm">
              {filter === "withResults"
                ? "Ningún alumno llegado tiene resultados aún"
                : filter === "arrived"
                ? "Ningún alumno ha llegado todavía"
                : filter === "pending"
                ? "Todos los alumnos ya llegaron"
                : "Sin resultados para este filtro"}
            </p>
          </div>
        )}
      </div>

      {/* ══ MODAL AGREGAR ALUMNO ══ */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) closeAddModal(); }}
        >
          <div className="bg-dojo-card border border-dojo-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-5 space-y-4">
              <div className="w-10 h-1 bg-dojo-border rounded mx-auto sm:hidden" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-dojo-white">➕ Agregar Alumno</p>
                  <p className="text-xs text-dojo-muted mt-0.5">Busca por nombre o código (#)</p>
                </div>
                <button onClick={closeAddModal} className="text-dojo-muted hover:text-dojo-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Búsqueda */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dojo-muted" />
                <input
                  autoFocus
                  className="form-input pl-8 text-sm w-full"
                  placeholder="Nombre o código del alumno..."
                  value={addSearch}
                  onChange={e => handleAddSearch(e.target.value)}
                />
                {addSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-dojo-red border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Resultado de éxito */}
              {addOkName && (
                <div className="flex items-center gap-2 bg-green-500/15 border border-green-500/40 rounded-xl px-4 py-3">
                  <Check size={15} className="text-green-400 shrink-0" />
                  <p className="text-green-400 text-sm font-semibold">{addOkName} agregado exitosamente</p>
                </div>
              )}

              {/* Error */}
              {addErr && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  {addErr}
                </p>
              )}

              {/* Resultados de búsqueda */}
              {addResults.length > 0 && (
                <div className="space-y-1.5">
                  {addResults.map(s => (
                    <button
                      key={s.id}
                      onClick={() => addStudent(s)}
                      disabled={adding === s.id}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-dojo-darker border border-dojo-border hover:border-dojo-red/50 hover:bg-dojo-red/5 transition-all text-left disabled:opacity-60"
                    >
                      <div className="w-8 h-8 rounded-lg bg-dojo-card flex items-center justify-center shrink-0">
                        <span className="text-dojo-gold font-bold text-xs">
                          {s.fullName.split(" ").slice(0, 2).map(w => w[0]).join("")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-dojo-white truncate">{s.fullName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.studentCode && (
                            <span className="text-xs font-mono text-dojo-gold">#{s.studentCode}</span>
                          )}
                          {s.belt && (
                            <span className="text-xs text-dojo-muted">{s.belt}</span>
                          )}
                        </div>
                      </div>
                      {adding === s.id
                        ? <div className="w-4 h-4 border-2 border-dojo-red border-t-transparent rounded-full animate-spin shrink-0" />
                        : <UserPlus size={15} className="text-dojo-muted shrink-0" />
                      }
                    </button>
                  ))}
                </div>
              )}

              {/* Estado vacío */}
              {addSearch.trim().length >= 2 && !addSearching && addResults.length === 0 && !addErr && !addOkName && (
                <p className="text-center text-dojo-muted text-sm py-4">
                  No se encontraron alumnos disponibles para inscribir
                </p>
              )}

              {addSearch.trim().length < 2 && !addOkName && (
                <p className="text-xs text-dojo-muted text-center py-2">
                  Escribe al menos 2 caracteres para buscar
                </p>
              )}

              <button onClick={closeAddModal} className="btn-secondary w-full justify-center">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL EDITAR EVENTO ══ */}
      {editEvent && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditEvent(false); }}
        >
          <div className="bg-dojo-card border border-dojo-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="p-5 space-y-4">
              <div className="w-10 h-1 bg-dojo-border rounded mx-auto sm:hidden" />

              <div className="flex items-center justify-between">
                <p className="font-bold text-dojo-white">✏️ Editar Torneo</p>
                <button onClick={() => setEditEvent(false)} className="text-dojo-muted hover:text-dojo-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div>
                <label className="form-label">Nombre del Torneo *</label>
                <input className="form-input" placeholder="Nombre del torneo"
                  value={eventForm.name}
                  onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Fecha *</label>
                  <input type="datetime-local" className="form-input"
                    value={eventForm.date}
                    onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Sede / Lugar *</label>
                  <input className="form-input" placeholder="Lugar del torneo"
                    value={eventForm.location}
                    onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="form-label">Notas (opcional)</label>
                <textarea className="form-input resize-none min-h-[60px]"
                  placeholder="Observaciones del evento..."
                  value={eventForm.notes}
                  onChange={e => setEventForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {eventFormErr && <p className="text-red-400 text-sm">{eventFormErr}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditEvent(false)} className="btn-secondary flex-1 justify-center">
                  Cancelar
                </button>
                <button onClick={saveEvent} disabled={savingEvent} className="btn-primary flex-1 justify-center">
                  {savingEvent ? "Guardando..." : "💾 Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL DE RESULTADOS ══ */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-dojo-card border border-dojo-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="p-5 space-y-4">
              <div className="w-10 h-1 bg-dojo-border rounded mx-auto sm:hidden" />

              {/* Título del panel */}
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-dojo-muted uppercase tracking-wider">🏆 Registro de Competencia</p>
                <button onClick={closeModal} className="text-dojo-muted hover:text-dojo-white transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Cabecera alumno */}
              <div className="flex items-center gap-3 bg-dojo-darker rounded-xl p-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-dojo-card flex items-center justify-center shrink-0">
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

              {/* ── CATEGORÍA ── */}
              <div>
                <label className="form-label">Categoría de Competencia</label>
                <input
                  className="form-input"
                  placeholder="Ej: Cadete -57kg, Infantil A Kata, Senior Masculino..."
                  value={editForm.category ?? ""}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                />
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

              {/* Mensaje de éxito */}
              {saveOk && (
                <div className="flex items-center gap-2 bg-green-500/15 border border-green-500/40 rounded-xl px-4 py-3">
                  <Check size={16} className="text-green-400 shrink-0" />
                  <p className="text-green-400 text-sm font-semibold">¡Guardado exitosamente!</p>
                </div>
              )}

              {/* Mensaje de error */}
              {saveErr && (
                <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/40 rounded-xl px-4 py-3">
                  <X size={16} className="text-red-400 shrink-0" />
                  <p className="text-red-400 text-sm">{saveErr}</p>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 pt-1">
                <button onClick={closeModal} disabled={saving} className="btn-secondary flex-1 justify-center">
                  Cancelar
                </button>
                <button onClick={saveResult} disabled={saving || saveOk} className="btn-primary flex-1 justify-center">
                  {saving ? "Guardando..." : saveOk ? "✓ Guardado" : "💾 Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
