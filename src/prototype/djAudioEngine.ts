import type { PrototypeMediaItem } from './types';

export type DjDeckId = 'A' | 'B';

export type DjFxType =
  | 'cyber_riser'
  | 'sub_drop'
  | 'vinyl_scratch'
  | 'dub_echo'
  | 'laser_strobe'
  | 'velvet_reverb';

export interface DjDeckConfig {
  track: PrototypeMediaItem;
  isPlaying: boolean;
  currentTimeSec: number;
  pitchRate: number; // 0.75 to 1.35
  volume: number; // 0 to 1
  eqLowDb: number; // -12 to +12
  eqMidDb: number; // -12 to +12
  eqHighDb: number; // -12 to +12
  filterSweep: number; // -1 (Low-Pass) to 0 (Neutral) to +1 (High-Pass)
  activeLoopBeats: number | null; // 0.25, 0.5, 1, 4, or null
}

const KEY_ROOT_HZ: Record<string, number> = {
  Am: 110.0,
  Bbm: 116.54,
  Cm: 130.81,
  Dm: 146.83,
  Em: 164.81,
  Fm: 174.61,
  'F#m': 185.0,
  Gm: 196.0
};

function resolveRootFrequency(musicalKey?: string): number {
  if (!musicalKey) return 110.0;
  for (const [k, hz] of Object.entries(KEY_ROOT_HZ)) {
    if (musicalKey.includes(k)) return hz;
  }
  return 123.47;
}

interface InternalDeckAudioNodes {
  lowFilter: BiquadFilterNode;
  midFilter: BiquadFilterNode;
  highFilter: BiquadFilterNode;
  sweepFilter: BiquadFilterNode;
  deckGain: GainNode;
  analyser: AnalyserNode;
  freqData: Uint8Array<ArrayBuffer>;
  nextStepTime: number;
  stepIndex: number;
  mediaAudioEl: HTMLAudioElement;
  mediaSource: MediaElementAudioSourceNode;
  loadedAudioUrl: string | null;
}

class DualDeckWebAudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private deckNodes: Record<DjDeckId, InternalDeckAudioNodes | null> = { A: null, B: null };
  private deckStates: Record<DjDeckId, DjDeckConfig | null> = { A: null, B: null };
  private crossfader = 0; // -1 (Full A) to +1 (Full B)
  private masterVolume = 0.85;
  private muted = false;
  private schedulerTimer: number | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
      this.deckNodes.A = this.createDeckChain(this.ctx, this.masterGain);
      this.deckNodes.B = this.createDeckChain(this.ctx, this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    if (this.schedulerTimer === null) {
      this.schedulerTimer = window.setInterval(() => this.schedulerTick(), 45);
    }
    return this.ctx;
  }

  private createDeckChain(ctx: AudioContext, masterOut: GainNode): InternalDeckAudioNodes {
    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowshelf';
    lowFilter.frequency.value = 130;

    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1050;
    midFilter.Q.value = 0.9;

    const highFilter = ctx.createBiquadFilter();
    highFilter.type = 'highshelf';
    highFilter.frequency.value = 4200;

    const sweepFilter = ctx.createBiquadFilter();
    sweepFilter.type = 'lowpass';
    sweepFilter.frequency.value = 18000;
    sweepFilter.Q.value = 1.4;

    const deckGain = ctx.createGain();
    deckGain.gain.value = 0.75;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.78;

    lowFilter.connect(midFilter);
    midFilter.connect(highFilter);
    highFilter.connect(sweepFilter);
    sweepFilter.connect(deckGain);
    deckGain.connect(analyser);
    analyser.connect(masterOut);

    const mediaAudioEl = new Audio();
    mediaAudioEl.crossOrigin = 'anonymous';
    mediaAudioEl.loop = true;
    mediaAudioEl.preload = 'auto';
    const mediaSource = ctx.createMediaElementSource(mediaAudioEl);
    mediaSource.connect(lowFilter);

    return {
      lowFilter,
      midFilter,
      highFilter,
      sweepFilter,
      deckGain,
      analyser,
      freqData: new Uint8Array(analyser.frequencyBinCount),
      nextStepTime: ctx.currentTime,
      stepIndex: 0,
      mediaAudioEl,
      mediaSource,
      loadedAudioUrl: null
    };
  }

  public syncState(
    deckA: DjDeckConfig,
    deckB: DjDeckConfig,
    crossfader: number,
    masterVolume: number,
    muted: boolean
  ): void {
    this.deckStates.A = deckA;
    this.deckStates.B = deckB;
    this.crossfader = Math.max(-1, Math.min(1, crossfader));
    this.masterVolume = Math.max(0, Math.min(1, masterVolume));
    this.muted = muted;

    if (!deckA.isPlaying && !deckB.isPlaying && !this.ctx) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.masterVolume, now, 0.03);

    this.applyDeckParameters('A', deckA, now);
    this.applyDeckParameters('B', deckB, now);
  }

  private applyDeckParameters(id: DjDeckId, cfg: DjDeckConfig, now: number): void {
    const chain = this.deckNodes[id];
    if (!chain) return;

    chain.lowFilter.gain.setTargetAtTime(cfg.eqLowDb, now, 0.03);
    chain.midFilter.gain.setTargetAtTime(cfg.eqMidDb, now, 0.03);
    chain.highFilter.gain.setTargetAtTime(cfg.eqHighDb, now, 0.03);

    // Filter sweep: -1..0 = Low-Pass down to 180Hz; 0..+1 = High-Pass up to 3200Hz
    if (cfg.filterSweep < -0.04) {
      chain.sweepFilter.type = 'lowpass';
      const cutoff = 180 + Math.pow(1 + cfg.filterSweep, 2) * 16000;
      chain.sweepFilter.frequency.setTargetAtTime(cutoff, now, 0.04);
      chain.sweepFilter.Q.setTargetAtTime(2.6, now, 0.04);
    } else if (cfg.filterSweep > 0.04) {
      chain.sweepFilter.type = 'highpass';
      const cutoff = 40 + Math.pow(cfg.filterSweep, 2) * 3200;
      chain.sweepFilter.frequency.setTargetAtTime(cutoff, now, 0.04);
      chain.sweepFilter.Q.setTargetAtTime(2.2, now, 0.04);
    } else {
      chain.sweepFilter.type = 'lowpass';
      chain.sweepFilter.frequency.setTargetAtTime(19500, now, 0.04);
      chain.sweepFilter.Q.setTargetAtTime(0.7, now, 0.04);
    }

    // Equal-power crossfader curve
    const normX = (this.crossfader + 1) * 0.5; // 0 = full A, 1 = full B
    const xfGain = id === 'A' ? Math.cos(normX * Math.PI * 0.5) : Math.sin(normX * Math.PI * 0.5);
    const effectiveGain = cfg.isPlaying ? cfg.volume * xfGain * (cfg.track.audioUrl ? 1.05 : 0.65) : 0;
    chain.deckGain.gain.setTargetAtTime(effectiveGain, now, 0.03);

    // Sync real local/device HTMLAudioElement stream when track has audioUrl
    if (cfg.track.audioUrl) {
      if (chain.loadedAudioUrl !== cfg.track.audioUrl) {
        chain.mediaAudioEl.src = cfg.track.audioUrl;
        chain.loadedAudioUrl = cfg.track.audioUrl;
        chain.mediaAudioEl.load();
      }
      chain.mediaAudioEl.playbackRate = Math.max(0.5, Math.min(1.6, cfg.pitchRate));
      if (cfg.isPlaying && chain.mediaAudioEl.paused) {
        void chain.mediaAudioEl.play().catch(() => {});
      } else if (!cfg.isPlaying && !chain.mediaAudioEl.paused) {
        chain.mediaAudioEl.pause();
      }
    } else if (chain.loadedAudioUrl) {
      if (!chain.mediaAudioEl.paused) {
        chain.mediaAudioEl.pause();
      }
      chain.mediaAudioEl.removeAttribute('src');
      chain.loadedAudioUrl = null;
    }
  }

  public async setOutputSinkId(sinkId: string): Promise<boolean> {
    try {
      const ctx = this.ensureContext() as (AudioContext & { setSinkId?: (id: string) => Promise<void> }) | null;
      if (ctx && typeof ctx.setSinkId === 'function') {
        await ctx.setSinkId(sinkId);
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  private schedulerTick(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const id of ['A', 'B'] as DjDeckId[]) {
      const cfg = this.deckStates[id];
      const chain = this.deckNodes[id];
      if (!cfg || !chain) continue;

      if (!cfg.isPlaying || Boolean(cfg.track.audioUrl)) {
        chain.nextStepTime = now + 0.05;
        continue;
      }

      const baseBpm = cfg.track.bpm || 110;
      const effectiveBpm = Math.max(45, Math.min(200, baseBpm * cfg.pitchRate));
      const sixteenthSec = 60 / effectiveBpm / 4;
      const loopModulo = cfg.activeLoopBeats
        ? Math.max(1, Math.round(cfg.activeLoopBeats * 4))
        : 16;

      if (chain.nextStepTime < now) {
        chain.nextStepTime = now + 0.01;
      }

      while (chain.nextStepTime < now + 0.11) {
        const step = chain.stepIndex % loopModulo;
        this.triggerStepNote(id, cfg, chain, step, chain.nextStepTime, sixteenthSec);
        chain.nextStepTime += sixteenthSec;
        chain.stepIndex = (chain.stepIndex + 1) % 64;
      }
    }
  }

  private triggerStepNote(
    id: DjDeckId,
    cfg: DjDeckConfig,
    chain: InternalDeckAudioNodes,
    step: number,
    when: number,
    stepDur: number
  ): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const rootHz = resolveRootFrequency(cfg.track.musicalKey) * cfg.pitchRate;
    const domain = cfg.track.mediaType || 'music';

    // 1. Kick / Pulse on 4-on-the-floor or broken beat
    if (step % 4 === 0) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = 'sine';
      const startPitch = domain === 'music' ? 135 : 92;
      kickOsc.frequency.setValueAtTime(startPitch, when);
      kickOsc.frequency.exponentialRampToValueAtTime(36, when + 0.14);

      const amp = domain === 'music' ? 0.42 : 0.22;
      kickGain.gain.setValueAtTime(amp, when);
      kickGain.gain.exponentialRampToValueAtTime(0.001, when + 0.18);

      kickOsc.connect(kickGain);
      kickGain.connect(chain.lowFilter);
      kickOsc.start(when);
      kickOsc.stop(when + 0.19);
    }

    // 2. Melodic Bass / Synth Arpeggio or Binaural Pad
    const minorScaleRatios = [1, 1.1892, 1.3348, 1.4983, 1.5874, 1.7818, 2];
    const ratioIdx = (step + (id === 'B' ? 2 : 0)) % minorScaleRatios.length;
    const noteHz = rootHz * minorScaleRatios[ratioIdx];

    if (domain === 'music' || step % 2 === 0) {
      const synthOsc = ctx.createOscillator();
      const synthGain = ctx.createGain();
      synthOsc.type = id === 'A' ? 'sawtooth' : 'triangle';
      synthOsc.frequency.setValueAtTime(
        step % 2 === 0 ? noteHz : noteHz * 2,
        when
      );

      const noteAmp = domain === 'music' ? 0.14 : 0.08;
      synthGain.gain.setValueAtTime(noteAmp, when);
      synthGain.gain.exponentialRampToValueAtTime(0.001, when + stepDur * 1.65);

      synthOsc.connect(synthGain);
      synthGain.connect(chain.lowFilter);
      synthOsc.start(when);
      synthOsc.stop(when + stepDur * 1.7);
    }
  }

  public triggerFxPad(fx: DjFxType): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    if (fx === 'cyber_riser') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(1480, now + 0.65);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.start(now);
      osc.stop(now + 0.72);
    } else if (fx === 'sub_drop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.75);
      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.82);
    } else if (fx === 'vinyl_scratch') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(980, now + 0.09);
      osc.frequency.linearRampToValueAtTime(190, now + 0.21);
      osc.frequency.linearRampToValueAtTime(760, now + 0.32);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.start(now);
      osc.stop(now + 0.38);
    } else if (fx === 'dub_echo') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(390, now + 0.16);
      osc.frequency.setValueAtTime(260, now + 0.32);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.58);
    } else if (fx === 'laser_strobe') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(1240, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.24);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.start(now);
      osc.stop(now + 0.28);
    } else {
      // velvet_reverb chord swell
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.6);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc.start(now);
      osc.stop(now + 0.68);
    }
  }

  public getDeckSpectrum(id: DjDeckId): Uint8Array | null {
    const chain = this.deckNodes[id];
    if (!chain) return null;
    chain.analyser.getByteFrequencyData(chain.freqData);
    return chain.freqData;
  }

  public getCombinedBassAndSpectrum(): {
    bass: number;
    mid: number;
    high: number;
    isBassHit: boolean;
    bins: Uint8Array | null;
  } {
    const chainA = this.deckNodes.A;
    const chainB = this.deckNodes.B;
    const activeChain =
      this.deckStates.A?.isPlaying && chainA
        ? chainA
        : this.deckStates.B?.isPlaying && chainB
          ? chainB
          : null;

    if (!activeChain) {
      return { bass: 0, mid: 0, high: 0, isBassHit: false, bins: null };
    }

    activeChain.analyser.getByteFrequencyData(activeChain.freqData);
    const data = activeChain.freqData;
    const len = data.length;
    if (len === 0) {
      return { bass: 0, mid: 0, high: 0, isBassHit: false, bins: null };
    }

    // Sub-bass & kick fundamental (first 5 bins)
    let bassSum = 0;
    const bassCount = Math.min(5, len);
    for (let i = 0; i < bassCount; i++) {
      bassSum += data[i];
    }
    const bass = Math.min(1, bassSum / (bassCount * 215));

    // Midrange (bins 5..14)
    let midSum = 0;
    const midEnd = Math.min(15, len);
    for (let i = bassCount; i < midEnd; i++) {
      midSum += data[i];
    }
    const mid = Math.min(1, midSum / Math.max(1, (midEnd - bassCount) * 190));

    // Highs (bins 15..end)
    let highSum = 0;
    for (let i = midEnd; i < len; i++) {
      highSum += data[i];
    }
    const high = Math.min(1, highSum / Math.max(1, (len - midEnd) * 165));

    return {
      bass,
      mid,
      high,
      isBassHit: bass > 0.64,
      bins: data
    };
  }

  public stopAll(): void {
    if (this.deckStates.A) this.deckStates.A.isPlaying = false;
    if (this.deckStates.B) this.deckStates.B.isPlaying = false;
    for (const id of ['A', 'B'] as DjDeckId[]) {
      const chain = this.deckNodes[id];
      if (chain && !chain.mediaAudioEl.paused) {
        chain.mediaAudioEl.pause();
      }
    }
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    }
  }
}

export const djAudioController = new DualDeckWebAudioController();

