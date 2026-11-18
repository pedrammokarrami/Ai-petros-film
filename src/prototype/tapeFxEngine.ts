// Synthesizes crisp mechanical analog cassette sounds (latch, flip, rewind whir, pen stamp) via Web Audio API

let fxCtx: AudioContext | null = null;

function getFxContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!fxCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    fxCtx = new AudioCtx();
  }
  if (fxCtx.state === 'suspended') {
    void fxCtx.resume().catch(() => {});
  }
  return fxCtx;
}

export function playCassetteLatchSound(kind: 'load' | 'eject' | 'flip' | 'rewind' | 'stamp'): void {
  const ctx = getFxContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const clickBurst = (t: number, freq: number, dur: number, vol: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(45, freq * 0.35), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  };

  if (kind === 'load') {
    clickBurst(now, 280, 0.045, 0.14);
    clickBurst(now + 0.14, 160, 0.06, 0.18);
    clickBurst(now + 0.24, 420, 0.035, 0.11);
  } else if (kind === 'eject') {
    clickBurst(now, 360, 0.04, 0.14);
    clickBurst(now + 0.08, 210, 0.055, 0.12);
  } else if (kind === 'flip') {
    clickBurst(now, 310, 0.04, 0.1);
    clickBurst(now + 0.22, 460, 0.04, 0.11);
  } else if (kind === 'rewind') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.32);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.72);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.78);
  } else if (kind === 'stamp') {
    clickBurst(now, 520, 0.03, 0.09);
    clickBurst(now + 0.09, 680, 0.035, 0.08);
  }
}
