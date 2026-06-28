// Dimensiones CR80 @ 300 DPI — backward compat
export const CARD_W = 638;
export const CARD_H = 1009;

// ── Presets de dimensiones ────────────────────────────────────────────────────
export const CARD_PRESETS = [
  { key: "portrait",  label: "Vertical — 638 × 1009 px",  w: 638,  h: 1009 },
  { key: "landscape", label: "Horizontal — 1009 × 638 px", w: 1009, h: 638  },
] as const;

export type CardPreset = typeof CARD_PRESETS[number]["key"];

export function getCardDimensions(preset: CardPreset): { w: number; h: number } {
  const p = CARD_PRESETS.find(p => p.key === preset);
  return p ? { w: p.w, h: p.h } : { w: CARD_W, h: CARD_H };
}

// ── Fuentes disponibles ───────────────────────────────────────────────────────
export const CARD_FONTS = [
  { key: "Montserrat",       label: "Montserrat",       google: "Montserrat:wght@700;800;900"       },
  { key: "Oswald",           label: "Oswald",           google: "Oswald:wght@600;700"               },
  { key: "Bebas Neue",       label: "Bebas Neue",       google: "Bebas+Neue"                        },
  { key: "Rajdhani",         label: "Rajdhani",         google: "Rajdhani:wght@600;700"             },
  { key: "Barlow Condensed", label: "Barlow Condensed", google: "Barlow+Condensed:wght@700;800"     },
  { key: "Roboto Condensed", label: "Roboto Condensed", google: "Roboto+Condensed:wght@700;800"     },
  { key: "Cinzel",           label: "Cinzel",           google: "Cinzel:wght@700;900"               },
  { key: "Exo 2",            label: "Exo 2",            google: "Exo+2:wght@700;800;900"            },
] as const;

export type CardFontKey = typeof CARD_FONTS[number]["key"];

export function getFontStack(key: CardFontKey | string): string {
  return `'${key}','Montserrat','Segoe UI',Arial,sans-serif`;
}

export function getGoogleFontsUrl(keys: string[]): string {
  const families = CARD_FONTS
    .filter(f => keys.includes(f.key))
    .map(f => `family=${f.google}`)
    .join("&");
  return families ? `https://fonts.googleapis.com/css2?${families}&display=swap` : "";
}

// ── Sub-interfaces del layout ─────────────────────────────────────────────────

export interface CardPhotoLayout {
  x: number;
  y: number;
  diameter: number;
  shape: "circle" | "rectangle";
  borderColor: string;    // "" = sin borde personalizado
  borderWidth: number;    // 0 = sin borde
}

export interface CardQrLayout {
  x: number;           // posición izquierda del bloque QR
  y: number;
  w: number;           // ancho del bloque QR
  height: number;
  frameBorderColor: string;   // "" = sin marco personalizado
  frameBorderWidth: number;   // 0 = sin marco
  bgTransparent: boolean;
}

export interface CardNameLayout {
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  letterSpacing: number;     // centésimas de em: 10 → 0.10em
  shadowEnabled: boolean;
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  outlineEnabled: boolean;
  outlineColor: string;
  outlineWidth: number;      // px
}

export interface CardTeamLayout {
  y: number;
  color: string;
}

export interface CardSloganLayout {
  text: string;              // "" = usar dojo.slogan
  fontSize: number;
  color: string;
  fontFamily: string;
}

export interface CardFooterLayout {
  y: number;
  background: string;
}

export interface CardLayout {
  preset:       CardPreset;
  photo:        CardPhotoLayout;
  qr:           CardQrLayout;
  name:         CardNameLayout;
  team:         CardTeamLayout;
  slogan:       CardSloganLayout;
  footer:       CardFooterLayout;
  contactColor: string;
}

// ── Valores por defecto ───────────────────────────────────────────────────────
export const DEFAULT_CARD_LAYOUT: CardLayout = {
  preset: "portrait",
  photo: { x: 109, y: 120, diameter: 420, shape: "circle", borderColor: "#CC0000", borderWidth: 4 },
  qr:    { x: 128, y: 624, w: 340, height: 310, frameBorderColor: "", frameBorderWidth: 2, bgTransparent: false },
  name:  {
    y: 552, fontSize: 38, color: "#000000", fontFamily: "Montserrat",
    letterSpacing: 0,
    shadowEnabled: false, shadowColor: "#000000", shadowX: 2, shadowY: 2, shadowBlur: 4,
    outlineEnabled: false, outlineColor: "#FFFFFF", outlineWidth: 1,
  },
  team:   { y: 600, color: "#CC0000" },
  slogan: { text: "", fontSize: 15, color: "#ffffff", fontFamily: "Montserrat" },
  footer: { y: 940, background: "#000000" },
  contactColor: "#000000",
};

export const DEFAULT_LANDSCAPE_LAYOUT: CardLayout = {
  preset: "landscape",
  photo: { x: 375, y: 50, diameter: 250, shape: "circle", borderColor: "#CC0000", borderWidth: 4 },
  qr:    { x: 10, y: 390, w: 200, height: 195, frameBorderColor: "", frameBorderWidth: 2, bgTransparent: false },
  name:  {
    y: 315, fontSize: 30, color: "#000000", fontFamily: "Montserrat",
    letterSpacing: 0,
    shadowEnabled: false, shadowColor: "#000000", shadowX: 2, shadowY: 2, shadowBlur: 4,
    outlineEnabled: false, outlineColor: "#FFFFFF", outlineWidth: 1,
  },
  team:   { y: 355, color: "#CC0000" },
  slogan: { text: "", fontSize: 12, color: "#ffffff", fontFamily: "Montserrat" },
  footer: { y: 590, background: "#000000" },
  contactColor: "#000000",
};

// ── Parse desde DB con deep-merge a defaults (backward compatible) ─────────────
export function parseCardLayout(raw: unknown): CardLayout | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    const r  = raw as Record<string, unknown>;
    const d  = DEFAULT_CARD_LAYOUT;
    const ph = (r.photo  && typeof r.photo  === "object") ? r.photo  as Record<string, unknown> : {};
    const qr = (r.qr     && typeof r.qr     === "object") ? r.qr     as Record<string, unknown> : {};
    const nm = (r.name   && typeof r.name   === "object") ? r.name   as Record<string, unknown> : {};
    const tm = (r.team   && typeof r.team   === "object") ? r.team   as Record<string, unknown> : {};
    const sl = (r.slogan && typeof r.slogan === "object") ? r.slogan as Record<string, unknown> : {};
    const ft = (r.footer && typeof r.footer === "object") ? r.footer as Record<string, unknown> : {};
    const n  = (v: unknown): v is number  => typeof v === "number";
    const s  = (v: unknown): v is string  => typeof v === "string";
    const b  = (v: unknown): v is boolean => typeof v === "boolean";
    return {
      preset: r.preset === "landscape" ? "landscape" : "portrait",
      photo: {
        x:           n(ph.x)           ? ph.x           : d.photo.x,
        y:           n(ph.y)           ? ph.y           : d.photo.y,
        diameter:    n(ph.diameter)    ? ph.diameter    : d.photo.diameter,
        shape:       ph.shape === "rectangle" ? "rectangle" : "circle",
        borderColor: s(ph.borderColor) ? ph.borderColor : d.photo.borderColor,
        borderWidth: n(ph.borderWidth) ? ph.borderWidth : d.photo.borderWidth,
      },
      qr: {
        x:                n(qr.x)                ? qr.x                : d.qr.x,
        y:                n(qr.y)                ? qr.y                : d.qr.y,
        w:                n(qr.w)                ? qr.w                : d.qr.w,
        height:           n(qr.height)           ? qr.height           : d.qr.height,
        frameBorderColor: s(qr.frameBorderColor) ? qr.frameBorderColor : d.qr.frameBorderColor,
        frameBorderWidth: n(qr.frameBorderWidth) ? qr.frameBorderWidth : d.qr.frameBorderWidth,
        bgTransparent:    b(qr.bgTransparent)    ? qr.bgTransparent    : d.qr.bgTransparent,
      },
      name: {
        y:              n(nm.y)              ? nm.y              : d.name.y,
        fontSize:       n(nm.fontSize)       ? nm.fontSize       : d.name.fontSize,
        color:          s(nm.color)          ? nm.color          : d.name.color,
        fontFamily:     s(nm.fontFamily)     ? nm.fontFamily     : d.name.fontFamily,
        letterSpacing:  n(nm.letterSpacing)  ? nm.letterSpacing  : d.name.letterSpacing,
        shadowEnabled:  b(nm.shadowEnabled)  ? nm.shadowEnabled  : d.name.shadowEnabled,
        shadowColor:    s(nm.shadowColor)    ? nm.shadowColor    : d.name.shadowColor,
        shadowX:        n(nm.shadowX)        ? nm.shadowX        : d.name.shadowX,
        shadowY:        n(nm.shadowY)        ? nm.shadowY        : d.name.shadowY,
        shadowBlur:     n(nm.shadowBlur)     ? nm.shadowBlur     : d.name.shadowBlur,
        outlineEnabled: b(nm.outlineEnabled) ? nm.outlineEnabled : d.name.outlineEnabled,
        outlineColor:   s(nm.outlineColor)   ? nm.outlineColor   : d.name.outlineColor,
        outlineWidth:   n(nm.outlineWidth)   ? nm.outlineWidth   : d.name.outlineWidth,
      },
      team: {
        y:     n(tm.y)     ? tm.y     : d.team.y,
        color: s(tm.color) ? tm.color : d.team.color,
      },
      slogan: {
        text:       s(sl.text)       ? sl.text       : d.slogan.text,
        fontSize:   n(sl.fontSize)   ? sl.fontSize   : d.slogan.fontSize,
        color:      s(sl.color)      ? sl.color      : d.slogan.color,
        fontFamily: s(sl.fontFamily) ? sl.fontFamily : d.slogan.fontFamily,
      },
      footer: {
        y:          n(ft.y)          ? ft.y          : d.footer.y,
        background: s(ft.background) ? ft.background : d.footer.background,
      },
      contactColor: s(r.contactColor) ? r.contactColor : d.contactColor,
    };
  } catch {
    return null;
  }
}
