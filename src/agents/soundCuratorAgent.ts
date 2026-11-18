import { FunctionTool, LlmAgent } from '@google/adk';
import { z } from 'zod';
import { getAllLightingProfiles } from './lightingStore.ts';

export interface CurateCatalogCandidate {
  id: string;
  titleFa: string;
  titleEn: string;
  bpm?: number;
  musicalKey?: string;
  categoryFa?: string;
  mediaType?: string;
  tags?: string[];
}

export interface FastSoundCuratorInput {
  action: 'curate' | 'tune_tape';
  roomId?: string;
  query?: string;
  catalog?: CurateCatalogCandidate[];
}

export interface FastSoundCuratorResult {
  agentName: 'sound_curator_agent';
  framework: 'google-adk';
  latencyMs: number;
  rankedIds: string[];
  recommendedBpm: number;
  recommendedKey: string;
  tapeEditPreset: {
    speed: number;
    warmth: number;
    echo: number;
    labelFa: string;
  };
  summaryFa: string;
}

const ROOM_AUDIO_SIGNATURES: Record<
  string,
  { bpm: number; key: string; speed: number; warmth: number; echo: number; labelFa: string }
> = {
  cafe: { bpm: 92, key: 'Cm', speed: 0.96, warmth: 0.72, echo: 0.28, labelFa: 'گرمای آنالوگ کافه' },
  concert: { bpm: 122, key: 'F#m', speed: 1.02, warmth: 0.48, echo: 0.54, labelFa: 'اکوی تالار زنده' },
  party: { bpm: 128, key: 'Fm', speed: 1.06, warmth: 0.34, echo: 0.42, labelFa: 'نبض کلاب برلین' },
  audiobook: { bpm: 78, key: 'Dm', speed: 0.92, warmth: 0.64, echo: 0.16, labelFa: 'صدای مخملی کتابخانه' },
  podcast: { bpm: 102, key: 'Am', speed: 1.0, warmth: 0.52, echo: 0.12, labelFa: 'وضوح استودیویی پادکست' }
};

export function runFastSoundCurator(input: FastSoundCuratorInput): FastSoundCuratorResult {
  const started = performance.now();
  const roomKey = input.roomId && ROOM_AUDIO_SIGNATURES[input.roomId] ? input.roomId : 'cafe';
  const baseSig = ROOM_AUDIO_SIGNATURES[roomKey];
  const q = (input.query || '').trim().toLowerCase();

  let speed = baseSig.speed;
  let warmth = baseSig.warmth;
  let echo = baseSig.echo;
  let targetBpm = baseSig.bpm;
  let labelFa = baseSig.labelFa;

  if (/آروم|ملایم|بارون|خواب|شبانه|کلاسیک|slow|chill|lofi|rain|ambient/.test(q)) {
    speed = 0.88;
    warmth = 0.82;
    echo = 0.35;
    targetBpm = 84;
    labelFa = 'نوار شبانه لو-فای';
  } else if (/پارتی|بیس|تند|انرژی|تکنو|شاد|fast|club|techno|bass|dance/.test(q)) {
    speed = 1.1;
    warmth = 0.38;
    echo = 0.48;
    targetBpm = 132;
    labelFa = 'میکس پرانرژی کلاب';
  } else if (/زنده|کنسرت|گیتار|فضایی|reverb|live|spatial|hall/.test(q)) {
    speed = 1.0;
    warmth = 0.52;
    echo = 0.65;
    targetBpm = 118;
    labelFa = 'پژواک سالن بزرگ';
  }

  const lighting = getAllLightingProfiles()[roomKey as keyof ReturnType<typeof getAllLightingProfiles>];
  const items = Array.isArray(input.catalog) ? input.catalog : [];
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);

  const ranked = items
    .map((item) => {
      let score = 0;
      const haystack = `${item.titleFa} ${item.titleEn} ${item.categoryFa || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
      for (const tok of tokens) {
        if (haystack.includes(tok)) score += 12;
      }
      if (item.bpm) {
        score += Math.max(0, 8 - Math.abs(item.bpm - targetBpm) / 12);
      }
      if (roomKey === 'audiobook' && item.mediaType === 'audiobook') score += 10;
      if (roomKey === 'podcast' && item.mediaType === 'podcast') score += 10;
      if ((roomKey === 'cafe' || roomKey === 'party' || roomKey === 'concert') && item.mediaType !== 'audiobook') {
        score += 4;
      }
      return { id: item.id, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id);

  const latencyMs = Math.max(1, Math.round(performance.now() - started));
  return {
    agentName: 'sound_curator_agent',
    framework: 'google-adk',
    latencyMs,
    rankedIds: ranked,
    recommendedBpm: targetBpm,
    recommendedKey: baseSig.key,
    tapeEditPreset: {
      speed,
      warmth,
      echo,
      labelFa
    },
    summaryFa: lighting
      ? `ایجنت صدای aipetros-sound هماهنگ با نور «${lighting.presetNameFa}» ریتم ${targetBpm} BPM و بافت «${labelFa}» را در ${latencyMs}ms تنظیم کرد.`
      : `ترکیب صوتی ${targetBpm} BPM با حالت «${labelFa}» به‌صورت داخلی آماده شد.`
  };
}

export const curateRoomSoundtrackTool = new FunctionTool({
  name: 'curate_room_soundtrack',
  description:
    'Ranks audio tracks and recommends optimal BPM/key for an aipetros-sound 3D room or query instantaneously.',
  parameters: z.object({
    roomId: z.enum(['cafe', 'concert', 'party', 'audiobook', 'podcast']).default('cafe'),
    query: z.string().optional().default('')
  }),
  execute: async ({ roomId, query }) => {
    return runFastSoundCurator({ action: 'curate', roomId, query });
  }
});

export const tuneTapeDeckFxTool = new FunctionTool({
  name: 'tune_tape_deck_fx',
  description:
    'Calibrates analog cassette tape playback speed, tube warmth, and studio echo FX in the Discover desk studio.',
  parameters: z.object({
    roomId: z.enum(['cafe', 'concert', 'party', 'audiobook', 'podcast']).default('cafe'),
    moodPrompt: z.string().default('warm analog night')
  }),
  execute: async ({ roomId, moodPrompt }) => {
    return runFastSoundCurator({ action: 'tune_tape', roomId, query: moodPrompt });
  }
});

export const soundCuratorAgent = new LlmAgent({
  name: 'sound_curator_agent',
  model: 'gemini-4-hydrogen',
  description:
    'Fast local Google ADK acoustic curator and cassette studio FX controller for aipetros-sound.',
  instruction:
    'Curate music, podcasts, audiobooks, and analog tape FX (speed, warmth, echo) rapidly and deterministically for aipetros-sound rooms.',
  tools: [curateRoomSoundtrackTool, tuneTapeDeckFxTool]
});
