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
  { value: "blanca",          label: "Blanca",          hex: "#FFFFFF", textColor: "#000" },
  { value: "amarilla",        label: "Amarilla",         hex: "#FFD700", textColor: "#000" },
  { value: "naranja",         label: "Naranja",          hex: "#FF8C00", textColor: "#FFF" },
  { value: "verde",           label: "Verde",            hex: "#228B22", textColor: "#FFF" },
  { value: "azul",            label: "Azul",             hex: "#1E3A8A", textColor: "#FFF" },
  { value: "morada",          label: "Morada",           hex: "#6B21A8", textColor: "#FFF" },
  { value: "café",            label: "Café",             hex: "#7B4F2E", textColor: "#FFF" },
  { value: "café-1-raya",     label: "Café 1 Raya",      hex: "#7B4F2E", textColor: "#FFF" },
  { value: "café-2-rayas",    label: "Café 2 Rayas",     hex: "#7B4F2E", textColor: "#FFF" },
  { value: "café-3-rayas",    label: "Café 3 Rayas",     hex: "#7B4F2E", textColor: "#FFF" },
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

export const PAYMENT_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "badge-yellow" },
  paid:    { label: "Pagado",    className: "badge-green"  },
  late:    { label: "Atrasado",  className: "badge-red"    },
};
