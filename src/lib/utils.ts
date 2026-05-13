import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInYears, format } from "date-fns";
import { es } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateAge(birthDate: Date | string): number {
  return differenceInYears(new Date(), new Date(birthDate));
}

export function formatDate(date: Date | string, fmt = "dd/MM/yyyy"): string {
  return format(new Date(date), fmt, { locale: es });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export const BELT_COLORS = [
  { value: "blanca",           label: "Blanca",            hex: "#FFFFFF", textColor: "#000" },
  { value: "blanca-celeste",  label: "Blanca Celeste",   hex: "#87CEEB", textColor: "#000" },
  { value: "blanco-amarillo", label: "Blanco Amarillo",  hex: "#FFE566", textColor: "#000" },
  { value: "amarilla",        label: "Amarilla",          hex: "#FFD700", textColor: "#000" },
  { value: "naranja",         label: "Naranja",          hex: "#FF8C00", textColor: "#FFF" },
  { value: "verde",           label: "Verde",            hex: "#228B22", textColor: "#FFF" },
  { value: "azul",            label: "Azul",             hex: "#1E3A8A", textColor: "#FFF" },
  { value: "morada",          label: "Morada",           hex: "#6B21A8", textColor: "#FFF" },
  { value: "roja",            label: "Roja",             hex: "#CC0000", textColor: "#FFF" },
  { value: "café",            label: "Marrón",           hex: "#7B4F2E", textColor: "#FFF" },
  { value: "café-1-raya",     label: "Marrón 1 Kiu",     hex: "#7B4F2E", textColor: "#FFF" },
  { value: "café-2-rayas",    label: "Marrón 2 Kiu",     hex: "#7B4F2E", textColor: "#FFF" },
  { value: "café-3-rayas",    label: "Marrón 3 Kiu",     hex: "#7B4F2E", textColor: "#FFF" },
  { value: "negra",           label: "Negra",            hex: "#1A1A1A", textColor: "#FFD700" },
  { value: "negra-1-dan",     label: "Negra 1er Dan",    hex: "#1A1A1A", textColor: "#FFD700" },
  { value: "negra-2-dan",     label: "Negra 2do Dan",    hex: "#1A1A1A", textColor: "#FFD700" },
  { value: "negra-3-dan",     label: "Negra 3er Dan",    hex: "#1A1A1A", textColor: "#FFD700" },
];

export function getBeltInfo(value: string) {
  return BELT_COLORS.find((b) => b.value === value) ?? BELT_COLORS[0];
}

export const GENDERS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
];

export const NATIONALITIES = [
  "Panameña", "Colombiana", "Venezolana", "Costarricense", "Guatemalteca",
  "Hondureña", "Salvadoreña", "Nicaragüense", "Mexicana", "Cubana",
  "Dominicana", "Estadounidense", "Española", "Italiana", "Otra",
];

// Cintas que permiten registrar hasta 5 katas por cambio de cinta
export const MULTI_KATA_BELTS = new Set([
  "roja",
  "café", "café-1-raya", "café-2-rayas", "café-3-rayas",
  "negra", "negra-1-dan", "negra-2-dan", "negra-3-dan",
]);

export const PAYMENT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "badge-yellow" },
  paid:    { label: "Pagado",    className: "badge-green"  },
  late:    { label: "Atrasado",  className: "badge-red"    },
};

export const TOURNAMENT_STATUS = {
  draft:               { label: "Borrador",               color: "#8892A4", bg: "bg-gray-700/30",   text: "text-gray-400",   border: "border-gray-600/50"   },
  registration_open:   { label: "Inscripciones Abiertas", color: "#27AE60", bg: "bg-green-900/30",  text: "text-green-400",  border: "border-green-700/50"  },
  registration_closed: { label: "Inscripciones Cerradas", color: "#F39C12", bg: "bg-yellow-900/30", text: "text-yellow-400", border: "border-yellow-700/50" },
  in_progress:         { label: "En Progreso",            color: "#2980B9", bg: "bg-blue-900/30",   text: "text-blue-400",   border: "border-blue-700/50"   },
  finished:            { label: "Finalizado",             color: "#8892A4", bg: "bg-gray-700/30",   text: "text-gray-400",   border: "border-gray-600/50"   },
  cancelled:           { label: "Cancelado",              color: "#C0392B", bg: "bg-red-900/30",    text: "text-red-400",    border: "border-red-700/50"    },
} as const;

export const JUDGE_ROLES = {
  chief_judge:  { label: "Juez Principal",     color: "text-yellow-400" },
  judge:        { label: "Juez",               color: "text-blue-400"   },
  timekeeper:   { label: "Cronometrador",      color: "text-green-400"  },
  score_keeper: { label: "Anotador",           color: "text-purple-400" },
  announcer:    { label: "Locutor/Presentador",color: "text-orange-400" },
  coordinator:  { label: "Coordinador",        color: "text-teal-400"   },
} as const;

export const SCHEDULE_EVENT_TYPES = {
  opening:      { label: "Ceremonia de apertura",  icon: "🎌" },
  kumite:       { label: "Kumite",                 icon: "🥊" },
  kata:         { label: "Kata",                   icon: "🥋" },
  team_kumite:  { label: "Kumite por equipos",     icon: "👥" },
  team_kata:    { label: "Kata por equipos",       icon: "👥" },
  break:        { label: "Receso",                 icon: "☕" },
  awards:       { label: "Premiación",             icon: "🏆" },
  closing:      { label: "Ceremonia de clausura",  icon: "🎉" },
  registration: { label: "Registro de atletas",    icon: "📋" },
  warmup:       { label: "Calentamiento",          icon: "🏃" },
  weigh_in:     { label: "Pesaje",                 icon: "⚖️"  },
} as const;

export const STREAM_STATUS = {
  offline:  { label: "Sin transmisión", color: "text-gray-400"  },
  live:     { label: "EN VIVO",         color: "text-red-400"   },
  finished: { label: "Finalizado",      color: "text-green-400" },
} as const;

export function getTournamentStatusFlow(currentStatus: string): string[] {
  const flows: Record<string, string[]> = {
    draft:               ["registration_open", "cancelled"],
    registration_open:   ["registration_closed", "cancelled"],
    registration_closed: ["in_progress", "registration_open"],
    in_progress:         ["finished"],
    finished:            [],
    cancelled:           [],
  };
  return flows[currentStatus] ?? [];
}
