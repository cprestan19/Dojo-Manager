"use client";
import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";

interface NewsItem {
  text:     string;
  category: "feature" | "improvement" | "fix" | "security";
}

interface SystemNews {
  id:          string;
  version:     string;
  title:       string;
  items:       NewsItem[];
  audience:    string;
  publishedAt: string;
}

const CATEGORY_EMOJI: Record<NewsItem["category"], string> = {
  feature:     "🚀",
  improvement: "⚡",
  fix:         "🐛",
  security:    "🔒",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PA", {
    day:   "numeric",
    month: "long",
    year:  "numeric",
    timeZone: "America/Panama",
  });
}

const LS_KEY = "dmo_news_seen_ids";

function getSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markSeen(ids: string[]) {
  try {
    const merged = [...getSeenIds(), ...ids];
    // Limitar a 100 entradas para no crecer indefinidamente
    localStorage.setItem(LS_KEY, JSON.stringify(merged.slice(-100)));
  } catch {}
}

export default function SystemNewsModal() {
  const [newsList, setNewsList] = useState<SystemNews[]>([]);
  const [visible,  setVisible]  = useState(false);
  const [closing,  setClosing]  = useState(false);
  const [current,  setCurrent]  = useState(0); // índice si hay varias

  useEffect(() => {
    const seenIds = getSeenIds();

    fetch("/api/system/news/unread")
      .then(r => r.ok ? r.json() : { news: [] })
      .then(({ news }: { news: SystemNews[] }) => {
        // Filtrar las que el usuario ya vio localmente (refresh, botón atrás)
        const unseen = news.filter(n => !seenIds.has(n.id));
        if (unseen.length > 0) {
          setNewsList(unseen);
          setVisible(true);
        }
      })
      .catch(() => null);
  }, []);

  function dismiss() {
    // Guardar en localStorage SINCRÓNICAMENTE antes de cerrar — sin depender de la red
    markSeen(newsList.map(n => n.id));

    setClosing(true);
    // Actualizar también el servidor (para filtrar por fecha en sesiones nuevas)
    fetch("/api/system/news/seen", { method: "PATCH" }).catch(() => null);
    setTimeout(() => { setVisible(false); setClosing(false); }, 300);
  }

  if (!visible || newsList.length === 0) return null;

  const news = newsList[current];

  return (
    <div className={`fixed inset-0 z-[9000] flex items-center justify-center p-4 transition-all duration-300 ${
      closing ? "opacity-0 pointer-events-none" : "opacity-100"
    }`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className={`relative z-10 w-full max-w-md max-h-[90vh] flex flex-col transition-all duration-300 ${
        closing ? "scale-95 opacity-0" : "scale-100 opacity-100"
      }`}>
        {/* Línea dorada superior */}
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-dojo-gold/60 via-dojo-gold to-dojo-gold/60 shrink-0" />

        <div className="bg-dojo-dark border-x border-b border-dojo-border/80 rounded-b-2xl shadow-2xl shadow-black/60 flex flex-col min-h-0 overflow-hidden flex-1">

          {/* Header — fijo */}
          <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-dojo-gold/10 border border-dojo-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={18} className="text-dojo-gold" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black tracking-widest text-dojo-gold uppercase">
                    Dojo Master Online
                  </span>
                  <span className="text-[10px] bg-dojo-gold/15 text-dojo-gold border border-dojo-gold/30 px-2 py-0.5 rounded-full font-bold">
                    {news.version}
                  </span>
                </div>
                <p className="text-base font-bold text-dojo-white mt-0.5 leading-snug">
                  {news.title}
                </p>
                <p className="text-[11px] text-dojo-muted mt-0.5">
                  {formatDate(news.publishedAt)}
                </p>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="p-1.5 text-dojo-muted hover:text-dojo-white transition-colors shrink-0 mt-0.5"
            >
              <X size={16} />
            </button>
          </div>

          {/* Divider */}
          <div className="mx-5 h-px bg-dojo-border/60 shrink-0" />

          {/* Items — área con scroll */}
          <ul className="px-5 py-4 space-y-2.5 overflow-y-auto flex-1 min-h-0">
            {(news.items as NewsItem[]).map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-base leading-none mt-0.5 shrink-0">
                  {CATEGORY_EMOJI[item.category] ?? "✨"}
                </span>
                <span className="text-sm text-dojo-white/90 leading-snug">{item.text}</span>
              </li>
            ))}
          </ul>

          {/* Paginación si hay varias novedades sin ver */}
          {newsList.length > 1 && (
            <div className="px-5 pb-1 flex items-center justify-between shrink-0">
              <div className="flex gap-1">
                {newsList.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === current ? "bg-dojo-gold" : "bg-dojo-border"
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-dojo-muted">
                {current + 1} de {newsList.length}
              </span>
            </div>
          )}

          {/* Footer — fijo */}
          <div className="px-5 pb-5 pt-3 flex items-center gap-3 shrink-0 border-t border-dojo-border/40 mt-1">
            {newsList.length > 1 && current < newsList.length - 1 ? (
              <>
                <button
                  onClick={() => setCurrent(c => c + 1)}
                  className="flex-1 btn-secondary text-sm py-2.5"
                >
                  Siguiente →
                </button>
                <button onClick={dismiss} className="flex-1 btn-primary text-sm py-2.5">
                  ¡Entendido!
                </button>
              </>
            ) : (
              <button onClick={dismiss} className="flex-1 btn-primary text-sm py-2.5 font-semibold">
                ¡Entendido!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
