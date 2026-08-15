/**
 * Configuración ÚNICA de los templates del CRM "Primera Etapa" — nombre,
 * idioma y estructura de variables EXACTOS confirmados vía
 * GET /{WABA_ID}/message_templates (2026-08-15). Compartida entre el envío
 * de prueba (test-send) y el envío real (send-pending) para que nunca queden
 * desincronizados entre sí.
 *
 * REACTIVATION queda fuera a propósito — descartada por decisión del usuario
 * ("no hagamos el 5 template").
 */
export type LifecycleTriggerType = "WELCOME" | "HELP_NO_STUDENTS" | "FOLLOWUP" | "LAST_ATTEMPT";

export const LIFECYCLE_TEMPLATE_CFG: Record<LifecycleTriggerType, { name: string; language?: string }> = {
  // "bienvenida_dojomaster" quedó aprobado con el nombre "bienvenida_2" (Meta no
  // deja reusar el nombre al recategorizar UTILITY→MARKETING). Se editó de nuevo
  // para sacar la variable del header (>60 chars con nombres de dojo largos).
  WELCOME:          { name: "bienvenida_2" },
  // Quedó aprobado en idioma es_ES, no es_PA como el resto.
  HELP_NO_STUDENTS: { name: "ayuda_primer_alumno", language: "es_ES" },
  // Igual que WELCOME: se editó para sacar la variable del header.
  FOLLOWUP:         { name: "seguimiento_activo" },
  LAST_ATTEMPT:     { name: "ultimo_intento_activacion" },
};

/**
 * bienvenida_2 y seguimiento_activo quedaron SIN NINGUNA variable (ni header
 * ni body) tras la corrección — mensaje genérico. ayuda_primer_alumno lleva
 * el nombre del dojo en el header. ultimo_intento_activacion lleva el nombre
 * en el header y el link del paso a paso en el body.
 */
export function buildLifecycleVars(
  type: LifecycleTriggerType,
  dojoName: string,
  opts?: { helpLink?: string },
): { headerParams?: string[]; bodyParams: string[] } {
  switch (type) {
    case "WELCOME":          return { bodyParams: [] };
    case "FOLLOWUP":         return { bodyParams: [] };
    case "HELP_NO_STUDENTS": return { headerParams: [dojoName], bodyParams: [] };
    // {{1}} del body = link al paso a paso — placeholder hasta tener el link real definitivo.
    case "LAST_ATTEMPT":     return { headerParams: [dojoName], bodyParams: [opts?.helpLink ?? "https://dojomasteronline.com/ayuda"] };
  }
}
