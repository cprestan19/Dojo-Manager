"use client";
import { useRef, useState } from "react";
import type { ImportSummary } from "@/lib/student-import";
import { Upload, Download, RefreshCw, CheckCircle, AlertTriangle, XCircle, FileSpreadsheet } from "lucide-react";

export default function ImportStudentsPage() {
  const [file,    setFile]    = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File | null) {
    if (!f) return;
    if (!f.name.endsWith(".xlsx")) { setError("Solo se aceptan archivos .xlsx"); return; }
    if (f.size > 10 * 1024 * 1024) { setError("El archivo no puede superar 10 MB"); return; }
    setError(null);
    setSummary(null);
    setFile(f);
  }

  async function runImport(mode: "create" | "update" = "create") {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    const fd = new FormData();
    fd.append("file", file);
    if (mode === "update") fd.append("mode", "update");
    try {
      const res = await fetch("/api/students/import", { method: "POST", body: fd });

      // Verificar que la respuesta es JSON antes de parsear
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        setError(`Error del servidor (HTTP ${res.status}). Reinicia el servidor de desarrollo y vuelve a intentarlo.`);
        return;
      }

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al procesar el archivo"); return; }
      setSummary(data.summary);
    } catch {
      setError("Error de red — verifica tu conexión");
    } finally { setLoading(false); }
  }

  const handleImport = () => runImport("create");

  function downloadReport() {
    if (!summary) return;
    const headers = ["Fila","Estado","Nombre","Cédula","Cód. Alumno","Motivo"];
    const rowData = summary.rows.map(r => [
      r.row,
      r.status === "created" ? "CREADO" : r.status === "skipped" ? "OMITIDO" : "ERROR",
      r.fullName ?? "",
      r.cedula ?? "",
      r.status === "created" ? r.studentCode : "",
      r.status !== "created" ? r.reason : "",
    ]);
    const csv = [headers, ...rowData].map(r => r.map(v => `"${String(v).replace(/"/g, "''")}"` ).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const a    = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "reporte_importacion.csv";
    a.click();
  }

  function reset() { setSummary(null); setFile(null); setError(null); }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-dojo-white flex items-center gap-2">
          <FileSpreadsheet size={22} className="text-dojo-gold" />
          Importar Alumnos
        </h1>
        <p className="text-sm text-dojo-muted mt-1">
          Carga masiva desde archivo Excel · La cédula es la llave única por alumno en este dojo
        </p>
      </div>

      {/* Paso 1: Plantilla */}
      {!summary && (
        <div className="card space-y-3">
          <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest">Paso 1 — Descarga la plantilla</p>
          <p className="text-sm text-dojo-white/80">
            La plantilla tiene todos los campos del sistema con instrucciones. Los campos en{" "}
            <span className="text-dojo-red font-semibold">rojo</span> son obligatorios.
          </p>
          <a
            href="/api/students/import/template"
            className="btn-primary flex items-center gap-2 w-fit"
          >
            <Download size={16} /> Descargar Plantilla Excel
          </a>
          <p className="text-xs text-dojo-muted">
            Llena la hoja "Alumnos" desde la fila 3 · Guarda como .xlsx · Hasta 500 alumnos por archivo
          </p>
        </div>
      )}

      {/* Paso 2: Subir archivo */}
      {!summary && (
        <div className="card space-y-4">
          <p className="text-xs font-bold text-dojo-muted uppercase tracking-widest">Paso 2 — Sube el archivo completado</p>

          {/* Dropzone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              file
                ? "border-dojo-red/60 bg-dojo-red/5"
                : "border-dojo-border hover:border-dojo-muted/60"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0] ?? null); }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => handleFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="space-y-1">
                <p className="text-dojo-red font-semibold flex items-center justify-center gap-2">
                  <FileSpreadsheet size={18} /> {file.name}
                </p>
                <p className="text-xs text-dojo-muted">{(file.size / 1024).toFixed(1)} KB · haz clic para cambiar</p>
              </div>
            ) : (
              <div className="text-dojo-muted space-y-2">
                <Upload size={32} className="mx-auto opacity-50" />
                <p className="text-sm">Arrastra el archivo .xlsx aquí o haz clic para seleccionar</p>
                <p className="text-xs">Solo archivos .xlsx · Máximo 10 MB · Hasta 500 alumnos</p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center gap-2">
              <XCircle size={16} /> {error}
            </div>
          )}

          {file && !loading && (
            <div className="space-y-2">
              <button onClick={handleImport} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                <CheckCircle size={16} /> Procesar Importación
              </button>
              <button
                onClick={() => runImport("update")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all border border-dojo-gold/40 text-dojo-gold hover:bg-dojo-gold/10"
                title="Actualiza los datos de alumnos existentes sin crear duplicados. Útil para corregir fechas u otros campos."
              >
                <RefreshCw size={15} /> Corregir datos existentes (re-importar)
              </button>
              <p className="text-xs text-dojo-muted text-center">
                "Corregir" actualiza campos (incluyendo fechas) de alumnos ya importados, sin duplicar.
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-4 space-y-2">
              <RefreshCw size={24} className="mx-auto animate-spin text-dojo-gold" />
              <p className="text-dojo-white font-semibold">Procesando importación...</p>
              <p className="text-xs text-dojo-muted">Esto puede tomar unos segundos</p>
            </div>
          )}
        </div>
      )}

      {/* Resumen */}
      {summary && (
        <div className="card space-y-5">
          {/* Header del resumen */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-bold text-dojo-white flex items-center gap-2">
              <CheckCircle size={18} className="text-green-400" /> Importación Finalizada
            </h2>
            <div className="flex gap-2 flex-wrap">
              <button onClick={downloadReport} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                <Download size={12} /> Reporte CSV
              </button>
              <button onClick={reset} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                <RefreshCw size={12} /> Nueva importación
              </button>
            </div>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Creados",  value: summary.created, color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
              { label: "Omitidos", value: summary.skipped, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
              { label: "Errores",  value: summary.errors,  color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20"    },
              { label: "Total",    value: summary.total,   color: "text-dojo-white", bg: "bg-dojo-darker",   border: "border-dojo-border"   },
            ].map(m => (
              <div key={m.label} className={`rounded-xl p-4 text-center border ${m.bg} ${m.border}`}>
                <div className={`text-3xl font-black font-display ${m.color}`}>{m.value}</div>
                <div className="text-xs text-dojo-muted mt-1 uppercase tracking-wide">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Tabla de resultados */}
          <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
            {/* Creados */}
            {summary.rows.filter(r => r.status === "created").length > 0 && (
              <section>
                <p className="text-xs font-bold text-green-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <CheckCircle size={12} /> Creados exitosamente ({summary.created})
                </p>
                <div className="space-y-0.5">
                  {summary.rows.filter(r => r.status === "created").map((r, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-dojo-border/30">
                      <span className="text-dojo-muted w-12 shrink-0">Fila {r.row}</span>
                      <span className="text-dojo-white flex-1 truncate">{r.fullName}</span>
                      <span className="text-dojo-muted font-mono shrink-0">{r.cedula}</span>
                      {r.status === "created" && (
                        <span className="text-green-400 font-mono shrink-0">Cód: {r.studentCode}</span>
                      )}
                      <CheckCircle size={12} className="text-green-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Omitidos */}
            {summary.rows.filter(r => r.status === "skipped").length > 0 && (
              <section>
                <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> Omitidos — cédula duplicada ({summary.skipped})
                </p>
                <div className="space-y-0.5">
                  {summary.rows.filter(r => r.status === "skipped").map((r, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-dojo-border/30">
                      <span className="text-dojo-muted w-12 shrink-0">Fila {r.row}</span>
                      <span className="text-dojo-white flex-1 truncate">{r.fullName ?? "—"}</span>
                      <span className="text-dojo-muted font-mono shrink-0">{r.cedula ?? "—"}</span>
                      <span className="text-yellow-400 shrink-0">
                        {r.status === "skipped" ? r.reason : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Errores */}
            {summary.rows.filter(r => r.status === "error").length > 0 && (
              <section>
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <XCircle size={12} /> No importados — campos faltantes ({summary.errors})
                </p>
                <div className="space-y-0.5">
                  {summary.rows.filter(r => r.status === "error").map((r, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-dojo-border/30">
                      <span className="text-dojo-muted w-12 shrink-0">Fila {r.row}</span>
                      <span className="text-dojo-white flex-1 truncate">{r.fullName ?? "(sin nombre)"}</span>
                      <span className="text-dojo-muted font-mono shrink-0">{r.cedula ?? "(sin cédula)"}</span>
                      <span className="text-red-400 shrink-0">
                        {r.status === "error" ? r.reason : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
