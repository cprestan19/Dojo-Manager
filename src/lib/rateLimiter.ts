const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, max = 10, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs });
    return true; // permitido
  }

  if (entry.count >= max) return false; // bloqueado

  entry.count++;
  return true; // permitido
}
