/**
 * Utilidades de moneda — isomorfas (seguras en cliente y servidor).
 *
 * El dojo guarda solo el código ISO 4217 en `Dojo.currency` (ej. "USD", "COP").
 * El símbolo NUNCA se guarda aparte — Intl.NumberFormat lo deriva automáticamente
 * del código, evitando que símbolo y código queden desincronizados.
 *
 * Aplica solo a dinero que paga el ALUMNO (mensualidades, tienda, exámenes,
 * inscripciones a torneo). La facturación del dojo hacia DojoManager (Plan,
 * Subscription, Invoice) siempre es en USD — ver src/components/billing/*.
 */

export const DEFAULT_CURRENCY = "USD";

export const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "USD", label: "Dólar estadounidense (USD $)" },
  { value: "PAB", label: "Balboa panameño (PAB B/.)" },
  { value: "COP", label: "Peso colombiano (COP $)" },
  { value: "PEN", label: "Sol peruano (PEN S/)" },
  { value: "VES", label: "Bolívar venezolano (VES Bs.)" },
  { value: "BOB", label: "Boliviano (BOB Bs.)" },
  { value: "DOP", label: "Peso dominicano (DOP RD$)" },
  { value: "CLP", label: "Peso chileno (CLP $)" },
  { value: "ARS", label: "Peso argentino (ARS $)" },
  { value: "MXN", label: "Peso mexicano (MXN $)" },
  { value: "GTQ", label: "Quetzal guatemalteco (GTQ Q)" },
  { value: "CRC", label: "Colón costarricense (CRC ₡)" },
  { value: "HNL", label: "Lempira hondureño (HNL L)" },
  { value: "NIO", label: "Córdoba nicaragüense (NIO C$)" },
  { value: "BRL", label: "Real brasileño (BRL R$)" },
  { value: "UYU", label: "Peso uruguayo (UYU $)" },
  { value: "PYG", label: "Guaraní paraguayo (PYG ₲)" },
  { value: "EUR", label: "Euro (EUR €)" },
];

/** Formatea un monto con el símbolo correcto según el código de moneda del dojo. */
export function formatCurrency(amount: number, currency: string = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Solo el símbolo (ej. "$", "Bs.", "S/") — para adornos de input, sin formatear un monto. */
export function getCurrencySymbol(currency: string = DEFAULT_CURRENCY): string {
  const part = new Intl.NumberFormat("es-PA", { style: "currency", currency })
    .formatToParts(0)
    .find(p => p.type === "currency");
  return part?.value ?? currency;
}

/**
 * padding-left (px) para un <input> con el símbolo de moneda superpuesto a la izquierda.
 * Símbolos de más de un carácter (ej. "S/", "Bs.", "RD$") necesitan más espacio que "$"
 * para no encimarse con el monto — escala según el largo real del símbolo.
 */
export function currencyInputPadding(symbol: string): string {
  return `${28 + Math.max(0, symbol.length - 1) * 8}px`;
}
