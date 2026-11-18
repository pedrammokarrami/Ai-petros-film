import { GoogleGenAI, Type } from '@google/genai';

export interface AiMusicSelectionInput {
  prompt: string;
  roomId: string;
  catalogSummary: Array<{
    id: string;
    titleFa: string;
    titleEn: string;
    bpm?: number;
    musicalKey?: string;
    categoryFa: string;
    mediaType?: string;
    tags: string[];
  }>;
}

export interface AiMusicSelectionResult {
  matchedCatalogId?: string;
  titleFa: string;
  titleEn: string;
  creatorFa: string;
  creatorEn: string;
  bpm: number;
  musicalKey: string;
  accentHex: string;
  reasonFa: string;
  aiPowered: boolean;
}

const ROOM_DEFAULTS: Record<string, { bpm: number; key: string; accent: string }> = {
  cafe: { bpm: 96, key: 'Cm', accent: '#F5B942' },
  concert: { bpm: 122, key: 'F#m', accent: '#E879F9' },
  party: { bpm: 128, key: 'Fm', accent: '#00F0FF' },
  audiobook: { bpm: 78, key: 'Dm', accent: '#FBBF24' },
  podcast: { bpm: 102, key: 'Am', accent: '#A78BFA' }
};

function heuristicFallbackSelect(input: AiMusicSelectionInput): AiMusicSelectionResult {
  const q = input.prompt.toLowerCase();
  const roomDef = ROOM_DEFAULTS[input.roomId] || ROOM_DEFAULTS.cafe;

  const bpmMatch = q.match(/(\d{2,3})\s*bpm/);
  let targetBpm = bpmMatch ? Math.max(60, Math.min(175, Number(bpmMatch[1]))) : roomDef.bpm;

  if (/آروم|ملایم|شبانه|رمانتیک|بارون|جز|کافه|chill|lofi|jazz|slow|ambient/.test(q)) {
    targetBpm = 88;
  } else if (/پارتی|بیس|تکنو|شاد|کوبنده|انرژی|رپ|party|techno|house|bass|edm|dance/.test(q)) {
    targetBpm = 128;
  } else if (/کنسرت|پاپ|زنده|گیتار|راک|pop|live|rock|concert/.test(q)) {
    targetBpm = 118;
  }

  let best = input.catalogSummary[0];
  let bestScore = -1;
  for (const item of input.catalogSummary) {
    let score = 0;
    const text = `${item.titleFa} ${item.titleEn} ${item.categoryFa} ${item.tags.join(' ')}`.toLowerCase();
    for (const token of q.split(/\s+/).filter((w) => w.length > 1)) {
      if (text.includes(token)) score += 3;
    }
    if (item.bpm) {
      score += Math.max(0, 2 - Math.abs(item.bpm - targetBpm) / 30);
    }
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  const trimmed = input.prompt.trim().slice(0, 42);
  return {
    matchedCatalogId: bestScore >= 3 ? best?.id : undefined,
    titleFa: trimmed ? `انتخاب هوشمند: ${trimmed}` : best?.titleFa || 'موج صوتی هوشمند',
    titleEn: `AI Mix: ${trimmed || best?.titleEn || 'aipetros-sound Session'}`,
    creatorFa: 'استودیو هوشمند آیپتروس ساند',
    creatorEn: 'aipetros-sound Engine',
    bpm: targetBpm,
    musicalKey: roomDef.key,
    accentHex: roomDef.accent,
    reasonFa: `ترکیب نغمه‌های ${targetBpm} BPM متناسب با حس‌وحال درخواست شما در این اتاق آماده و پخش شد.`,
    aiPowered: false
  };
}

export async function selectMusicByPrompt(
  input: AiMusicSelectionInput
): Promise<AiMusicSelectionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return heuristicFallbackSelect(input);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const compactCatalog = input.catalogSummary.slice(0, 18).map((c) => ({
      id: c.id,
      titleFa: c.titleFa,
      titleEn: c.titleEn,
      bpm: c.bpm || 110,
      key: c.musicalKey || 'Cm',
      cat: c.categoryFa,
      type: c.mediaType || 'music'
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [
        `Active 3D Room: ${input.roomId}`,
        `User Request: "${input.prompt.trim()}"`,
        `Catalog Options: ${JSON.stringify(compactCatalog)}`,
        'Return a JSON object picking either the closest matchedCatalogId (only if clearly matching) or crafting custom synthesized track metadata with realistic BPM (65-155), musicalKey (Am/Bbm/Cm/Dm/Em/Fm/F#m/Gm), vibrant hex accentHex, Persian titleFa & creatorFa, and a short Persian reasonFa (max 18 words).'
      ].join('\n'),
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchedCatalogId: { type: Type.STRING, nullable: true },
            titleFa: { type: Type.STRING },
            titleEn: { type: Type.STRING },
            creatorFa: { type: Type.STRING },
            creatorEn: { type: Type.STRING },
            bpm: { type: Type.NUMBER },
            musicalKey: { type: Type.STRING },
            accentHex: { type: Type.STRING },
            reasonFa: { type: Type.STRING }
          },
          required: [
            'titleFa',
            'titleEn',
            'creatorFa',
            'creatorEn',
            'bpm',
            'musicalKey',
            'accentHex',
            'reasonFa'
          ]
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}') as Partial<AiMusicSelectionResult>;
    const roomDef = ROOM_DEFAULTS[input.roomId] || ROOM_DEFAULTS.cafe;
    const validCatalogHit = parsed.matchedCatalogId
      ? input.catalogSummary.find((x) => x.id === parsed.matchedCatalogId)?.id
      : undefined;

    return {
      matchedCatalogId: validCatalogHit,
      titleFa: String(parsed.titleFa || input.prompt.slice(0, 36)),
      titleEn: String(parsed.titleEn || 'Aether AI Session'),
      creatorFa: String(parsed.creatorFa || 'دستیار موسیقی هوشمند'),
      creatorEn: String(parsed.creatorEn || 'Aether Sound Director'),
      bpm: Math.max(60, Math.min(175, Math.round(Number(parsed.bpm) || roomDef.bpm))),
      musicalKey: String(parsed.musicalKey || roomDef.key),
      accentHex: /^#[0-9A-Fa-f]{6}$/.test(String(parsed.accentHex || ''))
        ? String(parsed.accentHex)
        : roomDef.accent,
      reasonFa: String(
        parsed.reasonFa || 'قطعه بر اساس متن درخواست شما طراحی و روی صحنه پخش شد.'
      ),
      aiPowered: true
    };
  } catch (err) {
    console.warn('AI music selector fallback used:', err instanceof Error ? err.message : String(err));
    return heuristicFallbackSelect(input);
  }
}
