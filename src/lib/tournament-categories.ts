// Catálogo completo de categorías WKF
// NUNCA modificar los valores de AGE_GROUPS sin revisar calculateAgeGroup() y WEIGHT_CATEGORIES

export const AGE_GROUPS = [
  { value: "mini_4_5",   label: "Mini 4-5 años",    minAge: 4,  maxAge: 5,   wkfOfficial: false },
  { value: "mini_6_7",   label: "Mini 6-7 años",    minAge: 6,  maxAge: 7,   wkfOfficial: false },
  { value: "infantil_a", label: "Infantil 8-9",      minAge: 8,  maxAge: 9,   wkfOfficial: false },
  { value: "infantil_b", label: "Infantil 10-11",    minAge: 10, maxAge: 11,  wkfOfficial: false },
  { value: "pre_cadete", label: "Pre-Cadete 11-12",  minAge: 11, maxAge: 12,  wkfOfficial: true  },
  { value: "cadete",     label: "Cadete 13-15",      minAge: 13, maxAge: 15,  wkfOfficial: true  },
  { value: "junior",     label: "Junior 16-17",      minAge: 16, maxAge: 17,  wkfOfficial: true  },
  { value: "sub21",      label: "Sub-21",            minAge: 18, maxAge: 20,  wkfOfficial: true  },
  { value: "senior",     label: "Senior",            minAge: 18, maxAge: 999, wkfOfficial: true  },
  { value: "master35",   label: "Master 35+",        minAge: 35, maxAge: 999, wkfOfficial: true  },
  { value: "master45",   label: "Master 45+",        minAge: 45, maxAge: 999, wkfOfficial: true  },
  { value: "open",       label: "Open",              minAge: 0,  maxAge: 999, wkfOfficial: false },
] as const;

export type AgeGroupValue = typeof AGE_GROUPS[number]["value"];

// Categorías de peso WKF por grupo de edad y género
export const WEIGHT_CATEGORIES: Record<string, Record<string, string[]>> = {
  senior: {
    M: ["-60kg", "-67kg", "-75kg", "-84kg", "+84kg", "open"],
    F: ["-50kg", "-55kg", "-61kg", "-68kg", "+68kg", "open"],
  },
  sub21: {
    M: ["-60kg", "-67kg", "-75kg", "-84kg", "+84kg", "open"],
    F: ["-50kg", "-55kg", "-61kg", "-68kg", "+68kg", "open"],
  },
  junior: {
    M: ["-55kg", "-61kg", "-68kg", "-76kg", "+76kg", "open"],
    F: ["-48kg", "-53kg", "-59kg", "-66kg", "+66kg", "open"],
  },
  cadete: {
    M: ["-52kg", "-57kg", "-63kg", "-70kg", "+70kg", "open"],
    F: ["-47kg", "-54kg", "+54kg", "open"],
  },
  pre_cadete: {
    M: ["-40kg", "-45kg", "-50kg", "-55kg", "+55kg", "open"],
    F: ["-40kg", "-45kg", "-50kg", "+50kg", "open"],
  },
  infantil_a:  { M: ["open"], F: ["open"] },
  infantil_b:  { M: ["open"], F: ["open"] },
  mini_4_5:    { M: ["open"], F: ["open"] },
  mini_6_7:    { M: ["open"], F: ["open"] },
  master35: {
    M: ["-70kg", "-80kg", "+80kg", "open"],
    F: ["-60kg", "+60kg", "open"],
  },
  master45:    { M: ["open"], F: ["open"] },
  open:        { M: ["open"], F: ["open"] },
};

// Para torneos locales/internos por cinta
export const BELT_CATEGORIES = [
  {
    value: "principiantes",
    label: "Principiantes",
    belts: ["blanca", "blanca-celeste", "blanco-amarillo", "amarilla", "naranja"],
  },
  {
    value: "intermedios",
    label: "Intermedios",
    belts: ["verde", "azul"],
  },
  {
    value: "avanzados",
    label: "Avanzados",
    belts: ["morada", "roja", "café", "café-1-raya", "café-2-rayas", "café-3-rayas"],
  },
  {
    value: "elite",
    label: "Élite",
    belts: ["negra", "negra-1-dan", "negra-2-dan", "negra-3-dan"],
  },
] as const;

// Presets de resolución para el overlay OBS
export const OVERLAY_PRESETS = [
  { value: "1920x1080", label: "Full HD 1080p (OBS estándar)",   width: 1920, height: 1080 },
  { value: "1280x720",  label: "HD 720p (conexión lenta)",       width: 1280, height: 720  },
  { value: "3840x2160", label: "4K UHD (pantalla sala)",         width: 3840, height: 2160 },
  { value: "1080x1920", label: "Portrait 1080×1920 (vertical)",  width: 1080, height: 1920 },
  { value: "1366x768",  label: "Proyector estándar 1366×768",    width: 1366, height: 768  },
] as const;

// Restricciones para categorías de menores
export const MINI_CATEGORY_RULES: Record<string, {
  kumiteAllowed: boolean;
  kataAllowed: boolean;
  teamKataAllowed: boolean;
  note: string;
}> = {
  mini_4_5: {
    kumiteAllowed: false,
    kataAllowed: true,
    teamKataAllowed: false,
    note: "Solo Kata individual — competencia de demostración, sin contacto",
  },
  mini_6_7: {
    kumiteAllowed: true,
    kataAllowed: true,
    teamKataAllowed: true,
    note: "Kumite de control suave — árbitro con reglas adaptadas",
  },
};

/**
 * Genera el label de categoría automáticamente.
 * Usar en lugar de construir el string manualmente.
 */
export function buildCategoryLabel(
  type: "kumite" | "kata",
  gender: string | null,
  ageGroup: string | null,
  weightCategory: string | null,
  isTeamKata: boolean,
): string {
  const ageLabel = AGE_GROUPS.find(a => a.value === ageGroup)?.label ?? ageGroup ?? "";
  const parts: string[] = [];

  if (type === "kumite") {
    parts.push("Kumite");
    if (ageLabel) parts.push(ageLabel);
    if (weightCategory && weightCategory !== "open") parts.push(weightCategory);
    else if (weightCategory === "open") parts.push("Open");
    if (gender === "M") parts.push("Masculino");
    else if (gender === "F") parts.push("Femenino");
  } else {
    parts.push(isTeamKata ? "Kata en Equipo" : "Kata Individual");
    if (ageLabel) parts.push(ageLabel);
    if (gender === "M") parts.push("Masculino");
    else if (gender === "F") parts.push("Femenino");
  }

  return parts.join(" ");
}

/**
 * Calcula el grupo de edad de un atleta en función de la fecha del torneo.
 * La edad que cuenta es la que tiene en el año del torneo (norma WKF estándar).
 */
export function calculateAgeGroup(birthDate: Date, tournamentDate: Date): AgeGroupValue {
  const birthYear = birthDate.getFullYear();
  const tournYear = tournamentDate.getFullYear();
  // WKF usa la edad cumplida durante el año del torneo
  const age = tournYear - birthYear;

  if (age <= 5)  return "mini_4_5";
  if (age <= 7)  return "mini_6_7";
  if (age <= 9)  return "infantil_a";
  if (age <= 11) return "infantil_b";
  if (age <= 12) return "pre_cadete";
  if (age <= 15) return "cadete";
  if (age <= 17) return "junior";
  if (age <= 20) return "sub21";
  if (age >= 45) return "master45";
  if (age >= 35) return "master35";
  return "senior";
}

/**
 * Filtra los brackets compatibles para un atleta según género, edad y peso.
 * Usar en el portal del coach al seleccionar categorías.
 */
export function getCompatibleCategories<T extends {
  id: string;
  type: string;
  gender: string | null;
  ageGroup: string | null;
  weightCategory: string | null;
  isTeamKata: boolean;
}>(
  brackets: T[],
  athlete: { gender: string; ageGroup: AgeGroupValue; weight: number | null },
): T[] {
  return brackets.filter(b => {
    // Género
    if (b.gender && b.gender !== athlete.gender) return false;

    // Grupo de edad
    if (b.ageGroup && b.ageGroup !== "open" && b.ageGroup !== athlete.ageGroup) return false;

    // Peso (solo kumite con categoría específica)
    if (b.type === "kumite" && b.weightCategory && b.weightCategory !== "open" && athlete.weight) {
      if (b.weightCategory.startsWith("+")) {
        const limit = parseFloat(b.weightCategory.slice(1));
        if (athlete.weight < limit) return false;
      } else {
        const limit = parseFloat(b.weightCategory.slice(1));
        if (athlete.weight > limit) return false;
      }
    }

    // Mini 4-5 solo kata
    const miniRules = MINI_CATEGORY_RULES[athlete.ageGroup ?? ""];
    if (miniRules && !miniRules.kumiteAllowed && b.type === "kumite") return false;

    return true;
  });
}

/**
 * Devuelve el label de ronda para mostrar en overlay y pantalla TV.
 */
export function getRoundLabel(round: number, totalRounds: number): string {
  const remaining = totalRounds - round + 1;
  if (remaining === 1) return "FINAL";
  if (remaining === 2) return "SEMIFINAL";
  if (remaining === 3) return "CUARTOS DE FINAL";
  if (remaining === 4) return "OCTAVOS DE FINAL";
  return `RONDA ${round}`;
}

/**
 * Texto legible de la razón de victoria para overlay y pantalla TV.
 */
export function getWinnerReasonText(reason: string, locale: "es" | "en" = "es"): string {
  const map: Record<string, Record<string, string>> = {
    es: {
      points:  "Victoria por Puntos",
      ippon:   "Victoria por IPPON",
      wazaari: "Victoria por WAZA-ARI",
      hansoku: "Victoria por HANSOKU del contrario",
      kiken:   "Victoria por KIKEN (lesión/ausencia)",
      senshu:  "Victoria por SENSHU (primer anotador)",
    },
    en: {
      points:  "Win by Points",
      ippon:   "Win by IPPON",
      wazaari: "Win by WAZA-ARI",
      hansoku: "Win by opponent HANSOKU",
      kiken:   "Win by KIKEN (injury/absence)",
      senshu:  "Win by SENSHU (first scorer)",
    },
  };
  return map[locale]?.[reason] ?? reason;
}
