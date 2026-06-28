// Dimensiones CR80 @ 300 DPI — fuente de verdad compartida con CardClient y el editor
export const CARD_W = 638;
export const CARD_H = 1009;

// ── Fuentes disponibles para el editor ───────────────────────────────────────
export const CARD_FONTS = [
  { key: "Montserrat",       label: "Montserrat",       google: "Montserrat:wght@700;800;900"          },
  { key: "Oswald",           label: "Oswald",           google: "Oswald:wght@600;700"                  },
  { key: "Bebas Neue",       label: "Bebas Neue",       google: "Bebas+Neue"                           },
  { key: "Rajdhani",         label: "Rajdhani",         google: "Rajdhani:wght@600;700"                },
  { key: "Barlow Condensed", label: "Barlow Condensed", google: "Barlow+Condensed:wght@700;800"        },
  { key: "Roboto Condensed", label: "Roboto Condensed", google: "Roboto+Condensed:wght@700;800"        },
  { key: "Cinzel",           label: "Cinzel",           google: "Cinzel:wght@700;900"                  },
  { key: "Exo 2",            label: "Exo 2",            google: "Exo+2:wght@700;800;900"               },
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
  return families
    ? `https://fonts.googleapis.com/css2?${families}&display=swap`
    : "";
}

// ── Sub-interfaces del layout ─────────────────────────────────────────────────

export interface CardPhotoLayout {
  x: number;        // px desde borde izquierdo
  y: number;        // px desde borde superior
  diameter: number; // ancho = alto de la foto
}

export interface CardQrLayout {
  y: number;      // top de la fila QR
  height: number; // altura de la fila QR
}

export interface CardNameLayout {
  y: number;
  fontSize: number;
  color: string;      // hex #RRGGBB
  fontFamily: string; // clave de CARD_FONTS
}

export interface CardTeamLayout {
  y: number;
  color: string; // hex
}

export interface CardSloganLayout {
  fontSize: number;
  color: string;
  fontFamily: string;
}

export interface CardFooterLayout {
  y: number;          // top del bloque footer (negro)
  background: string; // hex
}

// Layout completo — almacenado en Dojo.cardLayout (Json?)
export interface CardLayout {
  photo:        CardPhotoLayout;
  qr:           CardQrLayout;
  name:         CardNameLayout;
  team:         CardTeamLayout;
  slogan:       CardSloganLayout;
  footer:       CardFooterLayout;
  contactColor: string; // hex — color del nombre/teléfono del acudiente
}

// ── Valores por defecto (no-Natsuki, con plantilla de fondo) ─────────────────
// Coinciden exactamente con las constantes de CardClient.tsx para dojos sin layout custom.
// PY=120, PD=420, PX=Math.floor((638-420)/2)=109
// NT=PY+PD+12=552, TT=NT+48=600, QT=TT+24=624, QH=310, FT=QT+310+6=940
export const DEFAULT_CARD_LAYOUT: CardLayout = {
  photo: {
    x:        109,
    y:        120,
    diameter: 420,
  },
  qr: {
    y:      624,
    height: 310,
  },
  name: {
    y:          552,
    fontSize:   38,
    color:      "#000000",
    fontFamily: "Montserrat",
  },
  team: {
    y:     600,
    color: "#CC0000",
  },
  slogan: {
    fontSize:   15,
    color:      "#ffffff",
    fontFamily: "Montserrat",
  },
  footer: {
    y:          940,
    background: "#000000",
  },
  contactColor: "#000000",
};

// Valida que un objeto sea un CardLayout válido (para parsear desde DB)
export function parseCardLayout(raw: unknown): CardLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!r.photo || !r.qr || !r.name || !r.team || !r.slogan || !r.footer) return null;
  return raw as CardLayout;
}
