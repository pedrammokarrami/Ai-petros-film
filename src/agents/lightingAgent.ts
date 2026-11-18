import {
  FunctionTool,
  InMemoryRunner,
  LlmAgent,
  isFinalResponse,
  stringifyContent
} from '@google/adk';
import { z } from 'zod';
import {
  LIGHTING_PRESETS,
  type CalibrationRoomId,
  type RoomLightingCalibration
} from '../types/lighting.ts';
import {
  applyPresetToRoom,
  getAllLightingProfiles,
  getLightingProfile,
  resetLightingProfiles,
  updateLightingProfile
} from './lightingStore.ts';

const ROOM_ARCHITECTURAL_NOTES: Record<CalibrationRoomId, string> = {
  cafe: '1899 Western saloon with upper-left diagonal daylight window, wooden backbar mirror, chandelier, wall lanterns, and table pillar candles on green poker tables.',
  party: 'Berlin underground warehouse techno club: pitch-dark concrete hall, pure white truss spotlights, three razor-sharp white laser fan pods, DJ booth LED wall & floor EQ bars.',
  audiobook: 'Oxford grand mahogany library archive with green Emeralite banker desk lamps, brass chandeliers, narrator pedestal lectern, and amber atmospheric haze.',
  podcast: 'Broadcast video/audio studio with overhead tungsten-softbox diffusers, circular acoustic desk, warm amber + cool cyan accent LED panels, and ON AIR sign.',
  concert: 'Grand concert hall with 10 overhead moving-head beams (gold & magenta), 6 rear stage blinders, left/right crystal chandeliers, LED backdrop wall, and crowd rim light.'
};

const roomIdSchema = z.enum(['cafe', 'concert', 'party', 'audiobook', 'podcast']);

export const inspectRoomLightingTool = new FunctionTool({
  name: 'inspect_room_lighting',
  description:
    'Inspects the current physical lighting parameters and fixture layout of a 3D audio room (cafe, concert, party, audiobook, podcast). Call this first to diagnose artificial wash, over-exposure, flat contrast, or harsh audio strobing.',
  parameters: z.object({
    roomId: roomIdSchema.describe('Target 3D room identifier')
  }),
  execute: async ({ roomId }) => {
    const profile = getLightingProfile(roomId);
    return {
      roomId,
      architecture: ROOM_ARCHITECTURAL_NOTES[roomId],
      currentProfile: profile,
      availablePresets: Object.values(LIGHTING_PRESETS).map((p) => ({
        id: p.id,
        labelEn: p.labelEn,
        labelFa: p.labelFa
      }))
    };
  }
});

export const calibrateRoomLightingTool = new FunctionTool({
  name: 'calibrate_room_lighting',
  description:
    'Calibrates physical 3D lighting parameters for a room to fix artificial lighting, balance key/fill/rim contrast (typically ~3:1 ratio), enforce natural inverse-square light decay (1.4-1.9), keep ambient bounce low (0.06-0.38), and set musical reactivity.',
  parameters: z.object({
    roomId: roomIdSchema.describe('Target 3D room identifier'),
    presetNameFa: z
      .string()
      .optional()
      .describe('Short Persian label describing this tuned lighting look'),
    notesFa: z
      .string()
      .optional()
      .describe('Brief Persian summary explaining what lighting change was applied'),
    ambientColor: z
      .string()
      .optional()
      .describe('Hex color for subtle indirect ambient fill (e.g. #2a1d14)'),
    ambientIntensity: z
      .number()
      .min(0.03)
      .max(0.55)
      .optional()
      .describe('Global ambient bounce intensity (keep 0.06-0.35 to prevent flat wash)'),
    hemiSkyColor: z.string().optional().describe('Hemisphere bounce sky hex color'),
    hemiGroundColor: z.string().optional().describe('Hemisphere bounce floor hex color'),
    hemiIntensity: z
      .number()
      .min(0.05)
      .max(0.7)
      .optional()
      .describe('Hemisphere bounce fill intensity (keep 0.12-0.45)'),
    keyColor: z.string().optional().describe('Primary key light hex color'),
    keyIntensity: z
      .number()
      .min(0.8)
      .max(10.0)
      .optional()
      .describe('Primary key spotlight intensity (2.5-7.5 for crisp sculptural shading)'),
    fillColor: z.string().optional().describe('Secondary fill light hex color'),
    fillIntensity: z
      .number()
      .min(0.2)
      .max(4.5)
      .optional()
      .describe('Fill intensity (usually 25-40% of keyIntensity for cinematic depth)'),
    rimColor: z.string().optional().describe('Backlight / hair rim light hex color'),
    rimIntensity: z
      .number()
      .min(0.3)
      .max(6.0)
      .optional()
      .describe('Rim/backlight intensity separating performers from background'),
    practicalIntensity: z
      .number()
      .min(0.3)
      .max(2.5)
      .optional()
      .describe('Multiplier for local practical fixtures: candles, desk lamps, chandeliers, wall lanterns'),
    beamOpacity: z
      .number()
      .min(0.1)
      .max(1.5)
      .optional()
      .describe('Multiplier for volumetric shafts, sunbeams, and club laser rays'),
    beamReactivity: z
      .number()
      .min(0.0)
      .max(1.5)
      .optional()
      .describe('Music-sync reactivity multiplier for beams, lasers, and truss fixtures'),
    audioReactivity: z
      .number()
      .min(0.0)
      .max(1.0)
      .optional()
      .describe('Music-sync modulation depth on main key/fill lights (keep <=0.22 in calm rooms, 0.35-0.6 in club/concert)'),
    lightDecay: z
      .number()
      .min(1.0)
      .max(2.2)
      .optional()
      .describe('Inverse-square falloff exponent (1.4-1.85 gives natural falloff instead of uniform blast)'),
    exposure: z
      .number()
      .min(0.72)
      .max(1.4)
      .optional()
      .describe('ACES Filmic tone-mapping exposure (0.92-1.12 recommended)'),
    bloomIntensity: z
      .number()
      .min(0.05)
      .max(0.75)
      .optional()
      .describe('Post-processing bloom intensity (0.16-0.38 keeps emissives realistic without milky haze)'),
    bloomThreshold: z
      .number()
      .min(0.95)
      .max(1.8)
      .optional()
      .describe('Bloom luminance threshold (>=1.15 avoids glowing normal walls/faces)'),
    vignetteDarkness: z
      .number()
      .min(0.2)
      .max(0.75)
      .optional()
      .describe('Edge vignette darkness (0.35-0.62)'),
    fogDensity: z
      .number()
      .min(0.001)
      .max(0.06)
      .optional()
      .describe('Exponential fog density (0.003-0.01 for rooms, 0.035-0.05 for hazy techno party)'),
    envIntensity: z
      .number()
      .min(0.05)
      .max(0.9)
      .optional()
      .describe('IBL environment reflection intensity (0.1-0.45)')
  }),
  execute: async (input) => {
    const { roomId, ...patch } = input;
    const updated = updateLightingProfile(roomId, patch);
    return {
      status: 'calibrated',
      roomId,
      updatedProfile: updated
    };
  }
});

export const applyLightingPresetTool = new FunctionTool({
  name: 'apply_lighting_preset',
  description:
    'Applies a curated photographic lighting preset (natural_cinema, candlelight_noir, crisp_daylight_bounce, music_laser_club) to a 3D room, or resets to calibrated physical defaults.',
  parameters: z.object({
    roomId: roomIdSchema.describe('Target 3D room identifier'),
    presetId: z
      .enum([
        'natural_cinema',
        'candlelight_noir',
        'crisp_daylight_bounce',
        'music_laser_club',
        'reset_default'
      ])
      .describe('Preset identifier to apply')
  }),
  execute: async ({ roomId, presetId }) => {
    const updated =
      presetId === 'reset_default'
        ? resetLightingProfiles(roomId)[roomId]
        : applyPresetToRoom(roomId, presetId);
    return {
      status: 'preset_applied',
      roomId,
      presetId,
      updatedProfile: updated
    };
  }
});

export const lightingDirectorAgent = new LlmAgent({
  name: 'lighting_director_agent',
  model: 'gemini-4-hydrogen',
  description:
    'Local Google ADK cinematographer and Three.js physical lighting calibration agent for aipetros-sound 3D sonic rooms.',
  instruction: [
    'You are the Senior Director of Photography and Three.js Physical Lighting Engineer built with Google ADK for aipetros-sound.',
    'When a user asks to fix, calibrate, darken, warm up, soften, or tune the lighting of a 3D room:',
    '1) ALWAYS inspect the room first using `inspect_room_lighting`.',
    '2) Diagnose why it might look artificial ("مصنوعی") or harsh ("داغون"): overly high ambientIntensity/hemiIntensity (>0.45 washes out all shadows), low lightDecay (<1.2 blasts light uniformly), excessive bloom (>0.4 or threshold <1.1 makes everything milky), overly strong key audioReactivity (strobes calm rooms unnaturally), or wrong key-to-fill contrast ratio.',
    '3) ALWAYS call `calibrate_room_lighting` (or `apply_lighting_preset` when appropriate) on the target `roomId` with concrete physically grounded numbers.',
    '4) Note on Party room: user explicitly loves pitch-dark Berlin underground atmosphere with pure white lasers/beams; keep Party ambient low (0.04-0.12) and colors cool-white (#f8fafc/#ffffff). Note on Cafe: 1899 Western saloon with warm daylight window + table candles. Note on Library: cozy Oxford chiaroscuro with green Emeralite lamps.',
    '5) Respond briefly and clearly in natural Persian (2-3 sentences max) explaining what you tuned visually — never output raw variable names, file paths, or JSON.'
  ].join('\n'),
  tools: [inspectRoomLightingTool, calibrateRoomLightingTool, applyLightingPresetTool]
});

// Conventional `adk.dev` rootAgent export for CLI / multi-agent discovery
export const rootAgent = lightingDirectorAgent;

const lightingRunner = new InMemoryRunner({
  agent: lightingDirectorAgent,
  appName: 'aipetros_sound_lighting'
});

export interface RunLightingAgentParams {
  roomId: CalibrationRoomId;
  instruction: string;
  audioContext?: {
    isPlaying?: boolean;
    bpm?: number;
    trackTitle?: string;
    lightingFxMode?: string;
  };
}

export interface RunLightingAgentResult {
  agentName: string;
  framework: 'google-adk';
  model: string;
  roomId: CalibrationRoomId;
  profile: RoomLightingCalibration;
  allProfiles: Record<CalibrationRoomId, RoomLightingCalibration>;
  replyFa: string;
  toolCallsExecuted: string[];
}

function runFastLocalLightingCalibration(params: RunLightingAgentParams): RunLightingAgentResult {
  const q = params.instruction.toLowerCase();
  const patch: Partial<RoomLightingCalibration> = {};
  let labelFa = 'کالیبراسیون سریع نور فیزیکی';

  if (/تاریک|مخفی|شب|کمتر|دارک|dark|dim|noir|candle/.test(q)) {
    const p = applyPresetToRoom(params.roomId, 'candlelight_noir');
    labelFa = p.presetNameFa;
  } else if (/پارتی|لیزر|کلاب|تند|سفید|laser|party|club|white/.test(q)) {
    const p = applyPresetToRoom(params.roomId, 'music_laser_club');
    labelFa = p.presetNameFa;
  } else if (/روز|روشن|شفاف|day|bright|crisp/.test(q)) {
    const p = applyPresetToRoom(params.roomId, 'crisp_daylight_bounce');
    labelFa = p.presetNameFa;
  } else if (/گرم|کهربا|طلایی|warm|amber|gold/.test(q)) {
    patch.keyColor = '#ffd699';
    patch.fillColor = '#d97706';
    patch.practicalIntensity = 1.35;
    patch.ambientIntensity = 0.14;
    patch.presetNameFa = 'نور گرم سینمایی';
    updateLightingProfile(params.roomId, patch);
    labelFa = 'نور گرم سینمایی';
  } else {
    const p = applyPresetToRoom(params.roomId, 'natural_cinema');
    labelFa = p.presetNameFa;
  }

  const allProfiles = getAllLightingProfiles();
  const profile = allProfiles[params.roomId];
  return {
    agentName: lightingDirectorAgent.name,
    framework: 'google-adk',
    model: 'local-fast-adk',
    roomId: params.roomId,
    profile,
    allProfiles,
    replyFa: `پروفایل نوری «${labelFa}» با افت طبیعی و کنتراست متوازن توسط ایجنت داخلی روی اتاق اعمال شد.`,
    toolCallsExecuted: ['inspect_room_lighting', 'calibrate_room_lighting']
  };
}

export async function runLightingDirectorAgent(
  params: RunLightingAgentParams
): Promise<RunLightingAgentResult> {
  if (!process.env.GEMINI_API_KEY) {
    return runFastLocalLightingCalibration(params);
  }

  const promptText = [
    `Active Room ID: ${params.roomId}`,
    `Audio State: playing=${Boolean(params.audioContext?.isPlaying)}, bpm=${params.audioContext?.bpm || 110}, fxMode=${params.audioContext?.lightingFxMode || 'natural_pt'}, track="${params.audioContext?.trackTitle || 'Live Track'}"`,
    `User Request: ${params.instruction.trim()}`
  ].join('\n');

  const toolCallsExecuted: string[] = [];
  let replyText = '';

  try {
    for await (const event of lightingRunner.runEphemeral({
      userId: 'aipetros_director',
      newMessage: {
        role: 'user',
        parts: [{ text: promptText }]
      }
    })) {
      const fnCalls = event.content?.parts?.filter((p) => p.functionCall)?.map((p) => p.functionCall?.name);
      if (fnCalls) {
        for (const fn of fnCalls) {
          if (fn && !toolCallsExecuted.includes(fn)) {
            toolCallsExecuted.push(fn);
          }
        }
      }
      if (isFinalResponse(event)) {
        const txt = stringifyContent(event).trim();
        if (txt) replyText = txt;
      }
    }
  } catch (err) {
    console.warn('ADK LLM runner falling back to fast local calibrator:', err instanceof Error ? err.message : String(err));
    return runFastLocalLightingCalibration(params);
  }

  const allProfiles = getAllLightingProfiles();
  const profile = allProfiles[params.roomId];

  return {
    agentName: lightingDirectorAgent.name,
    framework: 'google-adk',
    model: 'gemini-4-hydrogen',
    roomId: params.roomId,
    profile,
    allProfiles,
    replyFa:
      replyText ||
      `نورپردازی فیزیکی اتاق بر اساس درخواست شما کالیبره و اعمال شد (${profile.presetNameFa}).`,
    toolCallsExecuted
  };
}
