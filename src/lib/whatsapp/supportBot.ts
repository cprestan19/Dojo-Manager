/**
 * Chatbot de soporte por WhatsApp — basado en reglas/menú, NO en IA.
 * Reacciona dentro del webhook (ver webhookHandlers.ts) cuando el dueño de
 * un dojo toca "Sí, ayúdame" (botón del template ayuda_primer_alumno) o
 * escribe algo pidiendo soporte — le manda un menú de opciones, y según lo
 * que elija, responde el guion correspondiente o escala a soporte humano.
 *
 * Contenido verificado contra el flujo real de la app (no inventado) —
 * 2026-08-16.
 */

// Número personal de soporte de Cristhian — el mismo que ya aparece en el
// template bienvenida_2 ("Escríbenos a Soporte: +507 6626-1768").
export const SUPPORT_PHONE = "+50766261768";

export interface SupportTopic {
  id: string; title: string; description: string; body: string;
}

export const SUPPORT_TOPICS: SupportTopic[] = [
  {
    id: "topic_student", title: "Agregar un alumno", description: "Manual o que se registren ellos",
    body: "Agregar un alumno es fácil, tenés 2 formas:\n\n1️⃣ Manual: Alumnos → Nuevo Alumno, llenás los datos y listo.\n2️⃣ Que se registren ellos: generás un link de autoregistro (opción \"Link de autoregistro\" del menú) y se los compartís — ellos llenan sus datos y a vos te llega para aprobar.",
  },
  {
    id: "topic_reglink", title: "Link de autoregistro", description: "Para que los alumnos se registren solos",
    body: "Andá a Auto-registro (menú lateral) → pestaña \"Mis enlaces\" → botón \"Nuevo enlace\". Le ponés un nombre y listo, te genera un link para compartir. Cuando alguien lo llena, te llega la solicitud a \"Solicitudes pendientes\" para que la apruebes.",
  },
  {
    id: "topic_approve", title: "Aprobar solicitudes", description: "Revisar autoregistros pendientes",
    body: "En Auto-registro → pestaña \"Solicitudes pendientes\" ves cada formulario que llenaron. Revisás los datos y le das \"Aprobar e inscribir\" (o \"Rechazar\"). Si el sistema detecta un alumno parecido ya existente, te avisa antes de aprobar.",
  },
  {
    id: "topic_schedule", title: "Crear un horario", description: "Días, hora y nombre de la clase",
    body: "Andá a Horarios → \"Nuevo horario\", elegís días, hora de inicio y fin, le ponés un nombre (ej. \"Infantil Lun-Mié-Vie\") y guardás. Después asignás alumnos a ese horario desde su perfil.",
  },
  {
    id: "topic_attendance", title: "Marcar asistencia", description: "Con el Scanner QR",
    body: "La forma rápida es el Scanner QR: desde Asistencia le das \"Abrir Scanner\" (o entrás directo a /scanner desde el celular) y escaneás el carnet del alumno. En Asistencia después ves, corregís o exportás el historial.",
  },
  {
    id: "topic_paygen", title: "Generar un pago", description: "Mensualidades del mes",
    body: "En Pagos → botón \"Generar Mensualidades\" — te crea automáticamente el pago del mes para cada alumno activo con mensualidad configurada. Un clic al mes.",
  },
  {
    id: "topic_receipts", title: "Recibos y recordatorios", description: "Cómo y cuándo salen por WhatsApp",
    body: "📄 *Recibo de pago*: sale automático por WhatsApp UNA sola vez, justo cuando marcás el pago como \"pagado\". No hay botón para reenviarlo por WhatsApp — el botón \"Enviar Recibo\" solo reenvía por correo, las veces que quieras.\n\n⏰ *Aviso de atraso*: no sale el mismo día que vence — sale recién después de que el pago supera los \"Días de tolerancia\" que configurás en Ajustes → Parámetros de Recordatorios de Pago. Lo disparás manual (\"Recordatorio\" por fila, o \"Recordatorios Masivos\"), o activás el checkbox \"Activar envío automático de recordatorios\" en esa misma sección para que salgan solos todos los días.\n\n⚠️ El aviso de atraso por WhatsApp TAMBIÉN sale una sola vez por pago — si le das \"Re-enviar\", el correo se manda de nuevo pero el WhatsApp no se repite.\n\nEn ambos casos: hace falta que el alumno tenga teléfono cargado y el check de notificaciones de WhatsApp activado en su perfil, si no, ese canal se salta solo (el correo sigue funcionando igual).",
  },
];

export const SUPPORT_ROW_ID = "support_human";

/** Fila del menú siempre presente, además de los 7 temas. */
export const SUPPORT_MENU_ROWS = [
  ...SUPPORT_TOPICS.map(t => ({ id: t.id, title: t.title, description: t.description })),
  { id: SUPPORT_ROW_ID, title: "Hablar con soporte", description: "Te contacta soporte directo" },
];

export const SUPPORT_MENU_BODY =
  "¡Hola! Elegí qué necesitás y te ayudo al toque 👇";
export const SUPPORT_MENU_BUTTON = "Ver opciones";

// Frases EXACTAS de los botones de respuesta rápida del template
// ayuda_primer_alumno — comparación por igualdad normalizada (sin acentos/
// mayúsculas), igual criterio que isOptOutText en webhookHandlers.ts.
// Nota: normalize() quita la coma — la frase de referencia va sin ella.
const HELP_BUTTON_PHRASES = new Set(["si ayudame"]);
const ALREADY_OK_PHRASES  = new Set(["ya lo tengo controlado"]);

// Palabras sueltas que también disparan el menú si alguien las escribe libre
// (no solo tocando el botón del template).
const HELP_KEYWORDS = new Set(["ayuda", "ayudame", "necesito ayuda", "menu", "opciones"]);

// Palabras que piden hablar con una persona directamente, sin pasar por el menú.
const SUPPORT_KEYWORDS = new Set(["soporte", "hablar con soporte", "hablar con alguien", "quiero hablar con alguien", "humano"]);

function normalize(text: string): string {
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[¡!¿?.,]/g, "")
    .trim();
}

export function triggersMenu(text: string | undefined): boolean {
  if (!text) return false;
  const n = normalize(text);
  return HELP_BUTTON_PHRASES.has(n) || HELP_KEYWORDS.has(n);
}

/** "Ya lo tengo controlado" — respuesta válida, no debe caerle el catch-all de "no entendí". */
export function isAlreadyOk(text: string | undefined): boolean {
  if (!text) return false;
  return ALREADY_OK_PHRASES.has(normalize(text));
}

export function triggersSupportEscalation(text: string | undefined): boolean {
  if (!text) return false;
  return SUPPORT_KEYWORDS.has(normalize(text));
}

export function findTopic(id: string): SupportTopic | undefined {
  return SUPPORT_TOPICS.find(t => t.id === id);
}
