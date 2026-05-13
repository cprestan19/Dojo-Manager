function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch {
    return null;
  }
}

export function playBuzzer(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(220, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.5);

  gainNode.gain.setValueAtTime(0.8, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.6);
}

export function playScoreSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator1 = ctx.createOscillator();
  const oscillator2 = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator1.connect(gainNode);
  oscillator2.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator1.type = "sine";
  oscillator1.frequency.setValueAtTime(523.25, ctx.currentTime);

  oscillator2.type = "sine";
  oscillator2.frequency.setValueAtTime(659.25, ctx.currentTime);
  oscillator2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1);

  gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

  oscillator1.start(ctx.currentTime);
  oscillator1.stop(ctx.currentTime + 0.35);
  oscillator2.start(ctx.currentTime);
  oscillator2.stop(ctx.currentTime + 0.35);
}
