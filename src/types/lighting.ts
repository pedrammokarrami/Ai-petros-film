export type CalibrationRoomId = 'cafe' | 'concert' | 'party' | 'audiobook' | 'podcast';

export interface RoomLightingCalibration {
  roomId: CalibrationRoomId;
  presetName: string;
  presetNameFa: string;
  notesFa: string;
  ambientColor: string;
  ambientIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  keyColor: string;
  keyIntensity: number;
  fillColor: string;
  fillIntensity: number;
  rimColor: string;
  rimIntensity: number;
  practicalIntensity: number;
  beamOpacity: number;
  beamReactivity: number;
  audioReactivity: number;
  lightDecay: number;
  exposure: number;
  bloomIntensity: number;
  bloomThreshold: number;
  vignetteDarkness: number;
  fogDensity: number;
  envIntensity: number;
  updatedAt?: string;
}

export const DEFAULT_ROOM_LIGHTING_PROFILES: Record<CalibrationRoomId, RoomLightingCalibration> = {
  cafe: {
    roomId: 'cafe',
    presetName: 'Natural Saloon Chiaroscuro',
    presetNameFa: 'نور طبیعی کافه و شمع گرم',
    notesFa: 'حذف نور تخت و مصنوعی؛ نور مورب پنجره، کنتراست سایه و درخشش طبیعی شمع‌ها روی میز پوکر',
    ambientColor: '#2a1d14',
    ambientIntensity: 0.24,
    hemiSkyColor: '#d9c6aa',
    hemiGroundColor: '#1e150e',
    hemiIntensity: 0.34,
    keyColor: '#fff1d6',
    keyIntensity: 6.4,
    fillColor: '#c9d6e8',
    fillIntensity: 1.5,
    rimColor: '#ffb76b',
    rimIntensity: 1.65,
    practicalIntensity: 1.35,
    beamOpacity: 0.72,
    beamReactivity: 0.32,
    audioReactivity: 0.14,
    lightDecay: 1.55,
    exposure: 1.02,
    bloomIntensity: 0.2,
    bloomThreshold: 1.25,
    vignetteDarkness: 0.48,
    fogDensity: 0.0085,
    envIntensity: 0.42
  },
  party: {
    roomId: 'party',
    presetName: 'Berlin Pitch-Dark White Laser',
    presetNameFa: 'پارتی تاریک زیرزمینی با لیزر سفید',
    notesFa: 'تاریکی مطلق زیرزمینی؛ لیزرهای سفید متصل به لنز پرژکتورها بدون نور پخش مصنوعی',
    ambientColor: '#050608',
    ambientIntensity: 0.08,
    hemiSkyColor: '#94a3b8',
    hemiGroundColor: '#020203',
    hemiIntensity: 0.14,
    keyColor: '#f8fafc',
    keyIntensity: 3.1,
    fillColor: '#cbd5e1',
    fillIntensity: 1.15,
    rimColor: '#ffffff',
    rimIntensity: 2.1,
    practicalIntensity: 1.0,
    beamOpacity: 0.95,
    beamReactivity: 1.0,
    audioReactivity: 0.42,
    lightDecay: 1.7,
    exposure: 0.98,
    bloomIntensity: 0.32,
    bloomThreshold: 1.15,
    vignetteDarkness: 0.62,
    fogDensity: 0.044,
    envIntensity: 0.1
  },
  audiobook: {
    roomId: 'audiobook',
    presetName: 'Oxford Reading Chiaroscuro',
    presetNameFa: 'نور مطالعه گرم کتابخانه سلطنتی',
    notesFa: 'کاهش نور محیطی تخت تا چراغ‌های رومیزی سبز زمردی و لوسترها عمق واقعی ایجاد کنند',
    ambientColor: '#1f150c',
    ambientIntensity: 0.22,
    hemiSkyColor: '#e9c893',
    hemiGroundColor: '#140c06',
    hemiIntensity: 0.28,
    keyColor: '#ffe3c2',
    keyIntensity: 4.8,
    fillColor: '#9bb4cc',
    fillIntensity: 1.4,
    rimColor: '#ff9e52',
    rimIntensity: 2.6,
    practicalIntensity: 1.3,
    beamOpacity: 0.78,
    beamReactivity: 0.38,
    audioReactivity: 0.15,
    lightDecay: 1.5,
    exposure: 1.0,
    bloomIntensity: 0.22,
    bloomThreshold: 1.25,
    vignetteDarkness: 0.5,
    fogDensity: 0.0055,
    envIntensity: 0.36
  },
  podcast: {
    roomId: 'podcast',
    presetName: 'Softbox Studio Key & Contrast',
    presetNameFa: 'نورپردازی سافت‌باکس استودیو پادکست',
    notesFa: 'تفکیک سه‌نقطه‌ای حرفه‌ای چهره مجریان (کی گرم + فیل سرد + ریم پشت) بدون شست‌وشوی تخت تصویر',
    ambientColor: '#181922',
    ambientIntensity: 0.2,
    hemiSkyColor: '#dcd6cb',
    hemiGroundColor: '#121017',
    hemiIntensity: 0.26,
    keyColor: '#ffead6',
    keyIntensity: 5.2,
    fillColor: '#cbd8e8',
    fillIntensity: 1.65,
    rimColor: '#ff9c54',
    rimIntensity: 2.9,
    practicalIntensity: 1.15,
    beamOpacity: 0.65,
    beamReactivity: 0.35,
    audioReactivity: 0.16,
    lightDecay: 1.55,
    exposure: 1.0,
    bloomIntensity: 0.2,
    bloomThreshold: 1.3,
    vignetteDarkness: 0.46,
    fogDensity: 0.004,
    envIntensity: 0.38
  },
  concert: {
    roomId: 'concert',
    presetName: 'Grand Arena Concert Stage',
    presetNameFa: 'کنسرت آرنا با کنتراست صحنه',
    notesFa: 'کنتراست عمیق صحنه با پرتوهای متصل به پروژکتورها و ریم‌لایت شفاف روی خواننده و جمعیت',
    ambientColor: '#07080d',
    ambientIntensity: 0.14,
    hemiSkyColor: '#64748b',
    hemiGroundColor: '#09070f',
    hemiIntensity: 0.26,
    keyColor: '#fff0d6',
    keyIntensity: 5.4,
    fillColor: '#ffddaa',
    fillIntensity: 2.4,
    rimColor: '#ff4db8',
    rimIntensity: 2.5,
    practicalIntensity: 1.1,
    beamOpacity: 0.92,
    beamReactivity: 0.95,
    audioReactivity: 0.36,
    lightDecay: 1.55,
    exposure: 1.02,
    bloomIntensity: 0.38,
    bloomThreshold: 1.18,
    vignetteDarkness: 0.44,
    fogDensity: 0.0065,
    envIntensity: 0.28
  }
};

export interface LightingQuickPresetSpec {
  id: string;
  labelFa: string;
  labelEn: string;
  instruction: string;
  patch: Partial<RoomLightingCalibration>;
}

export const LIGHTING_PRESETS: Record<string, LightingQuickPresetSpec> = {
  natural_cinema: {
    id: 'natural_cinema',
    labelFa: 'طبیعی و سینمایی (استاندارد)',
    labelEn: 'Natural Cinema',
    instruction: 'Apply balanced photographic 3:1 key-to-fill contrast with natural inverse-square decay.',
    patch: {
      ambientIntensity: 0.22,
      hemiIntensity: 0.28,
      lightDecay: 1.55,
      audioReactivity: 0.18,
      beamOpacity: 0.78,
      exposure: 1.0,
      bloomIntensity: 0.22,
      bloomThreshold: 1.25
    }
  },
  candlelight_noir: {
    id: 'candlelight_noir',
    labelFa: 'نوار تاریک و شمع گرم',
    labelEn: 'Candlelight Noir',
    instruction: 'Deepen shadows, reduce ambient bounce, and warm practicals and candle glow.',
    patch: {
      ambientIntensity: 0.14,
      hemiIntensity: 0.18,
      keyColor: '#ffdfaa',
      fillColor: '#7c93b3',
      fillIntensity: 1.05,
      rimColor: '#ff9642',
      practicalIntensity: 1.55,
      lightDecay: 1.75,
      exposure: 0.96,
      vignetteDarkness: 0.58,
      bloomIntensity: 0.26
    }
  },
  crisp_daylight_bounce: {
    id: 'crisp_daylight_bounce',
    labelFa: 'نور پنجره شفاف و ملایم',
    labelEn: 'Crisp Daylight Bounce',
    instruction: 'Clean natural daylight balance with gentle cool ambient bounce and soft shadows.',
    patch: {
      ambientIntensity: 0.3,
      hemiIntensity: 0.38,
      keyColor: '#fff6e8',
      fillColor: '#d4e2f4',
      fillIntensity: 1.85,
      lightDecay: 1.45,
      exposure: 1.06,
      bloomIntensity: 0.16,
      bloomThreshold: 1.35,
      vignetteDarkness: 0.38
    }
  },
  music_laser_club: {
    id: 'music_laser_club',
    labelFa: 'تاریکِ کلاب + پالس موسیقی',
    labelEn: 'Dark Laser Pulse',
    instruction: 'Keep room ultra-dark while maximizing volumetric beam punch and synchronized music pulse.',
    patch: {
      ambientIntensity: 0.07,
      hemiIntensity: 0.12,
      fillIntensity: 0.9,
      beamOpacity: 1.12,
      beamReactivity: 1.2,
      audioReactivity: 0.45,
      fogDensity: 0.042,
      bloomIntensity: 0.36,
      bloomThreshold: 1.12,
      vignetteDarkness: 0.64
    }
  }
};

export function clampRoomLightingCalibration(
  input: RoomLightingCalibration
): RoomLightingCalibration {
  const clamp = (val: number, min: number, max: number) =>
    Number(Math.min(max, Math.max(min, Number.isFinite(val) ? val : min)).toFixed(3));
  return {
    ...input,
    ambientIntensity: clamp(input.ambientIntensity, 0.03, 0.55),
    hemiIntensity: clamp(input.hemiIntensity, 0.05, 0.7),
    keyIntensity: clamp(input.keyIntensity, 0.8, 10.0),
    fillIntensity: clamp(input.fillIntensity, 0.2, 4.5),
    rimIntensity: clamp(input.rimIntensity, 0.3, 6.0),
    practicalIntensity: clamp(input.practicalIntensity, 0.3, 2.5),
    beamOpacity: clamp(input.beamOpacity, 0.1, 1.5),
    beamReactivity: clamp(input.beamReactivity, 0.0, 1.5),
    audioReactivity: clamp(input.audioReactivity, 0.0, 1.0),
    lightDecay: clamp(input.lightDecay, 1.0, 2.2),
    exposure: clamp(input.exposure, 0.72, 1.4),
    bloomIntensity: clamp(input.bloomIntensity, 0.05, 0.75),
    bloomThreshold: clamp(input.bloomThreshold, 0.95, 1.8),
    vignetteDarkness: clamp(input.vignetteDarkness, 0.2, 0.75),
    fogDensity: clamp(input.fogDensity, 0.001, 0.06),
    envIntensity: clamp(input.envIntensity, 0.05, 0.9)
  };
}
