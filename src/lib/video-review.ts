// Utilidades para el sistema de Video Review.
// YouTube Live tiene ~30 segundos de latencia inherente.
// La grabación local de OBS no tiene latencia — usar siempre como fuente primaria.

export const YOUTUBE_LATENCY_BUFFER_SECS = 35; // 30s latencia + ~5s reacción del árbitro

/**
 * Calcula el offset en segundos desde el inicio del combate
 * hasta el momento en que se solicitó la revisión.
 */
export function calculateReviewOffset(
  matchStartedAt: Date,
  reviewRequestedAt: Date,
): number {
  const diff = reviewRequestedAt.getTime() - matchStartedAt.getTime();
  return Math.max(0, Math.floor(diff / 1000));
}

/**
 * Calcula el segundo al que debe saltar el player de YouTube
 * para mostrar el momento correcto, compensando la latencia del live stream.
 *
 * Si el offset del review es 65s y YouTube va 35s atrás,
 * el evento ocurrió en el segundo 65 del combate pero en el stream
 * de YouTube solo aparece en el segundo 30 del buffer visible.
 *
 * Nota: YouTube DVR no soporta seek exacto via URL; se usa
 * la YouTube IFrame API con seekTo() en el cliente.
 */
export function calculateYouTubeSeekSeconds(offsetSeconds: number): number {
  return Math.max(0, offsetSeconds - YOUTUBE_LATENCY_BUFFER_SECS);
}

/**
 * Genera la URL del embed de YouTube para la pantalla de review.
 * enablejsapi=1 permite controlar el player con IFrame API (seekTo).
 */
export function buildYouTubeEmbedUrl(youtubeVideoId: string): string {
  return `https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1&autoplay=1&rel=0&modestbranding=1`;
}

/**
 * Formato legible del offset para mostrar al árbitro.
 * Ejemplo: 65 → "1:05 desde el inicio del combate"
 */
export function formatReviewOffset(offsetSeconds: number): string {
  const min = Math.floor(offsetSeconds / 60);
  const sec = offsetSeconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")} desde el inicio del combate`;
}

/**
 * Instrucción para el árbitro cuando usa grabación local de OBS.
 * El árbitro busca manualmente el segundo en el archivo MP4.
 */
export function buildOBSSeekInstruction(
  offsetSeconds: number,
  obsRecordingPath: string | null | undefined,
): string {
  const path = obsRecordingPath ?? "la grabación de OBS";
  const formatted = formatReviewOffset(offsetSeconds);
  return `En ${path} → busca el segundo ${offsetSeconds} (${formatted})`;
}

/** Posibles decisiones del árbitro tras la revisión. */
export type ReviewDecision = "confirmed" | "reversed" | "no_contest";

/** Posibles solicitantes de la revisión. */
export type ReviewRequestedBy = "ao" | "aka" | "referee";

/** Estados del proceso de video review. */
export type ReviewStatus = "none" | "requested" | "reviewing" | "confirmed" | "reversed";
