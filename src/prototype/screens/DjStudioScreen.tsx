import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bluetooth,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Footprints,
  Grid2x2,
  Headphones,
  ListMusic,
  Maximize2,
  Mic,
  Minimize2,
  Music,
  Pause,
  Play,
  Plus,
  Radar,
  Radio,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Wand2,
  Wifi,
  Zap
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  LanguageCode,
  OfflineDownloadRecord,
  PrototypeMediaItem,
  TasteVector6D,
  UniverseRealmFilter,
  UserCollection
} from '../types';
import { filterCatalogByRealm, inferMediaDomain } from '../prototypeData';
import { cosineSimilarity6D } from '../tasteEngine';
import {
  djAudioController,
  type DjDeckConfig,
  type DjDeckId,
  type DjFxType
} from '../djAudioEngine';
import {
  SonicRoom3DWorld,
  type RoomCameraPreset,
  type RoomLightingFxMode,
  type RoomMoveInput
} from '../components/SonicRoom3DWorld';
import { RoomMusicPickerModal } from '../components/RoomMusicPickerModal';
import {
  RoomPairAndScanModal,
  type PairAndScanTab
} from '../components/RoomPairAndScanModal';
import { useT } from '../i18n';
import { Button, formatDuration } from '../components/UiPrimitives';
import {
  DEFAULT_ROOM_LIGHTING_PROFILES,
  type CalibrationRoomId,
  type RoomLightingCalibration
} from '../../types/lighting';
import type {
  NearbyRoomScanEntry,
  RoomPeerConnectionType,
  RoomSyncId,
  RoomSyncSessionState
} from '../../types/roomSync';

import roomCafeImg from '../../assets/images/room_cafe_rdr2_pov_1794615520413.jpg';
import roomConcertImg from '../../assets/images/room_concert_pop_pov_1794615522837.jpg';
import roomPartyImg from '../../assets/images/room_party_007_pov_1794615525017.jpg';
import roomLibraryImg from '../../assets/images/room_audiobook_library_pov_1794615526648.jpg';
import roomPodcastImg from '../../assets/images/room_podcast_studio_pov_1794615526850.jpg';

interface DjStudioScreenProps {
  catalog: PrototypeMediaItem[];
  lang: LanguageCode;
  userVector: TasteVector6D;
  collections: UserCollection[];
  favoriteIds: Set<string>;
  downloadsMap: Record<string, OfflineDownloadRecord>;
  initialDeckATrackId?: string;
  initialDeckBTrackId?: string;
  initialStudioTab?: 'dj_console' | 'playlist_studio';
  onPlayTrack: (item: PrototypeMediaItem) => void;
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onDownloadTrack: (item: PrototypeMediaItem) => void;
  onToggleFavorite: (item: PrototypeMediaItem) => void;
  onCreatePlaylist: (playlist: {
    name: string;
    descriptionFa?: string;
    descriptionEn?: string;
    accentHex?: string;
    moodTagFa?: string;
    moodTagEn?: string;
    itemIds: string[];
  }) => void;
  onUpdatePlaylist: (playlistId: string, patch: Partial<UserCollection>) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onRoomThemeChange?: (roomId: SonicRoomId) => void;
  onActivePlaybackChange?: (track: PrototypeMediaItem, isPlaying: boolean) => void;
  isHostVisible?: boolean;
}

export type SonicRoomId = 'cafe' | 'concert' | 'party' | 'audiobook' | 'podcast';

interface SonicRoomDefinition {
  id: SonicRoomId;
  orderLabelFa: string;
  orderLabelEn: string;
  titleFa: string;
  titleEn: string;
  subtitleFa: string;
  subtitleEn: string;
  povDescriptionFa: string;
  povDescriptionEn: string;
  gameWorldTagFa: string;
  gameWorldTagEn: string;
  liveUsers: number;
  hasLiveSignalIcon?: boolean;
  /** Card gradient & border styling */
  bgGradient: string;
  borderHex: string;
  glowHex: string;
  secondaryHex: string;
  /** Pulse physics when hovered/active */
  pulseIntensity: number;
  pulseBpm: number;
  bassWeightLabelFa: string;
  bassWeightLabelEn: string;
  imageUrl: string;
  preferredTrackIds: string[];
  realmFilter: UniverseRealmFilter;
  fxTrigger: DjFxType;
}

const SONIC_ROOMS: SonicRoomDefinition[] = [
  {
    id: 'cafe',
    orderLabelFa: '۱. اتاق کافه وسترن (Red Dead 2 Style)',
    orderLabelEn: '1. Western Cafe Saloon (Red Dead 2 Style)',
    titleFa: 'اتاق کافه',
    titleEn: 'Cafe Room',
    subtitleFa: 'موسیقی دی‌جی و طنین کافه‌ای مداوم',
    subtitleEn: 'Continuous DJ lounge & warm acoustic cafe resonance',
    povDescriptionFa:
      'سالون تمام‌چوبیِ قدیمی و باکیفیت در نور طبیعیِ عصر و غبار، با پیانوی قدیمی و بار چوبی (Unreal 5.8 & Blender Cycles POV).',
    povDescriptionEn:
      'Authentic wooden Western saloon in dusty golden-hour light with antique upright piano and oak bar (Unreal 5.8 & Blender Cycles POV).',
    gameWorldTagFa: 'گرافیک Unreal 5.8 · سالون کافه Red Dead 2 · پیانو و بار چوبی',
    gameWorldTagEn: 'Unreal 5.8 POV · Red Dead 2 Saloon · Antique Piano & Bar',
    hasLiveSignalIcon: true,
    liveUsers: 42,
    bgGradient: 'linear-gradient(100deg, #120F0A 0%, #271E12 52%, #3D2E18 100%)',
    borderHex: '#C89B4B',
    glowHex: '#F5B942',
    secondaryHex: '#FB923C',
    pulseIntensity: 0.58,
    pulseBpm: 96,
    bassWeightLabelFa: 'پالس ملایم کافه · 96 BPM',
    bassWeightLabelEn: 'Warm Cafe Pulse · 96 BPM',
    imageUrl: roomCafeImg,
    preferredTrackIds: ['music-02', 'music-05', 'music-04', 'music-08'],
    realmFilter: 'music',
    fxTrigger: 'velvet_reverb'
  },
  {
    id: 'concert',
    orderLabelFa: '۲. سالن کنسرت پاپ (Pop Concert Stage)',
    orderLabelEn: '2. Pop Concert Arena (Pop Concert Stage)',
    titleFa: 'اتاق کنسرت',
    titleEn: 'Concert Room',
    subtitleFa: 'فول آلبوم‌ها و اجرای زنده خوانندگان محبوب',
    subtitleEn: 'Full albums & live stage performances of beloved artists',
    povDescriptionFa:
      'سن مجهز با افکت‌های نوری و رقص‌نور پیشرفته، ال‌ای‌دی‌های غول‌پیکر منحنی و خواننده روی استیج (Unreal 5.8 Path-Traced POV).',
    povDescriptionEn:
      'Modern arena stage with volumetric light show, giant curved LED walls, and live lead vocalist on stage (Unreal 5.8 Path-Traced POV).',
    gameWorldTagFa: 'گرافیک Unreal 5.8 · استیج کنسرت پاپ · ال‌ای‌دی غول‌پیکر و رقص‌نور',
    gameWorldTagEn: 'Unreal 5.8 POV · Pop Concert Stage · Giant LEDs & Lasers',
    liveUsers: 118,
    bgGradient: 'linear-gradient(100deg, #13091C 0%, #2B1035 52%, #471850 100%)',
    borderHex: '#C048D8',
    glowHex: '#E879F9',
    secondaryHex: '#A855F7',
    pulseIntensity: 0.84,
    pulseBpm: 122,
    bassWeightLabelFa: 'پالس اجرای زنده · 122 BPM',
    bassWeightLabelEn: 'Live Stage Surge · 122 BPM',
    imageUrl: roomConcertImg,
    preferredTrackIds: ['music-04', 'music-01', 'music-07', 'music-02'],
    realmFilter: 'music',
    fxTrigger: 'cyber_riser'
  },
  {
    id: 'party',
    orderLabelFa: '۳. اتاق پارتی و دیسکو (007 First Light / GTA V Style)',
    orderLabelEn: '3. Party & Techno Club (007 First Light / GTA V Style)',
    titleFa: 'اتاق پارتی',
    titleEn: 'Party Room',
    subtitleFa: 'موسیقی‌های بیس‌دار و ریتم مهمانی‌ها',
    subtitleEn: 'Heavy bass-boosted club tracks & party rhythms',
    povDescriptionFa:
      'اتمسفر تاریکِ صنعتی با لیزرهای متحرکِ نئونی، انعکاس کف صیقلی و جمعیتِ در حال رقص در مقابل جایگاه دی‌جی (007 First Light / GTA V).',
    povDescriptionEn:
      'Dark industrial club atmosphere with sweeping neon lasers, ray-traced floor reflections, and crowd dancing before the DJ booth.',
    gameWorldTagFa: 'گرافیک Unreal 5.8 · کلاب تکنو 007 First Light · لیزر نئونی و دی‌جی',
    gameWorldTagEn: 'Unreal 5.8 POV · 007 First Light / GTA V Club · Lasers & DJ',
    liveUsers: 148,
    bgGradient: 'linear-gradient(100deg, #111329 0%, #0F2640 52%, #0E3E54 100%)',
    borderHex: '#22D3EE',
    glowHex: '#00F0FF',
    secondaryHex: '#FF2A85',
    pulseIntensity: 1.0,
    pulseBpm: 128,
    bassWeightLabelFa: 'پالس ساب‌بیس سنگین · 128 BPM',
    bassWeightLabelEn: 'Heavy Sub-Bass Pulse · 128 BPM',
    imageUrl: roomPartyImg,
    preferredTrackIds: ['music-03', 'music-06', 'music-01', 'music-07'],
    realmFilter: 'music',
    fxTrigger: 'sub_drop'
  },
  {
    id: 'audiobook',
    orderLabelFa: '۴. کتابخانه صوتی (Immersive Audio Library)',
    orderLabelEn: '4. Immersive Audio Library (Classical Study)',
    titleFa: 'کتابخانه صوتی',
    titleEn: 'Audio Library',
    subtitleFa: 'جهانی از کتاب‌های صوتی و روایت‌های شنیدنی',
    subtitleEn: 'A universe of spatial audiobooks & immersive narratives',
    povDescriptionFa:
      'سالن دنج و کلاسیک، پر از کتابخانه‌های چوبیِ بلند، نور ملایم چراغ مطالعه، شومینه روشن و کتاب‌های صوتی (Unreal 5.8 Global Illumination).',
    povDescriptionEn:
      'Cozy classical hall lined with towering walnut bookshelves, warm brass reading lamp, crackling fireplace, and spatial audiobooks.',
    gameWorldTagFa: 'گرافیک Unreal 5.8 · تالار کتابخانه کلاسیک · چراغ مطالعه و شومینه',
    gameWorldTagEn: 'Unreal 5.8 POV · Classical Library · Reading Lamp & Hearth',
    liveUsers: 31,
    bgGradient: 'linear-gradient(100deg, #14110B 0%, #281F13 52%, #3E301B 100%)',
    borderHex: '#B88E44',
    glowHex: '#FBBF24',
    secondaryHex: '#D97706',
    pulseIntensity: 0.44,
    pulseBpm: 76,
    bassWeightLabelFa: 'پالس آرام روایت · 76 BPM',
    bassWeightLabelEn: 'Calm Narrative Pulse · 76 BPM',
    imageUrl: roomLibraryImg,
    preferredTrackIds: ['book-01', 'book-02', 'book-03', 'book-04', 'book-05'],
    realmFilter: 'audiobook',
    fxTrigger: 'dub_echo'
  },
  {
    id: 'podcast',
    orderLabelFa: '۵. اتاق پادکست (Interactive Podcast Studio)',
    orderLabelEn: '5. Interactive Podcast Studio (Acoustic Broadcast)',
    titleFa: 'اتاق پادکست',
    titleEn: 'Podcast Room',
    subtitleFa: 'گفتگوهای زنده و پادکست‌های در حال ساخت',
    subtitleEn: 'Live studio conversations & podcasts in the making',
    povDescriptionFa:
      'اتاق ضبط حرفه‌ای و آکوستیک با میکروفون‌های بازویی، هدفون استودیویی، مانیتورهای موج صوتی و تابلوی نوری ON AIR (Unreal 5.8 POV).',
    povDescriptionEn:
      'Professional acoustic recording room with boom-arm condenser microphones, waveform monitors, and glowing ON AIR sign.',
    gameWorldTagFa: 'گرافیک Unreal 5.8 · استودیو آکوستیک پادکست · میکروفون و مانیتور نوری',
    gameWorldTagEn: 'Unreal 5.8 POV · Acoustic Podcast Studio · Boom Mics & Monitors',
    liveUsers: 64,
    bgGradient: 'linear-gradient(100deg, #0F0B1E 0%, #1E1336 52%, #321C4E 100%)',
    borderHex: '#8B5CF6',
    glowHex: '#A78BFA',
    secondaryHex: '#38BDF8',
    pulseIntensity: 0.68,
    pulseBpm: 105,
    bassWeightLabelFa: 'پالس فرکانس استودیو · 105 BPM',
    bassWeightLabelEn: 'Studio Vocal Pulse · 105 BPM',
    imageUrl: roomPodcastImg,
    preferredTrackIds: ['podcast-01', 'podcast-02', 'podcast-03', 'podcast-04', 'podcast-05'],
    realmFilter: 'podcast',
    fxTrigger: 'laser_strobe'
  }
];

const FX_PADS: Array<{
  id: DjFxType;
  labelEn: string;
  labelFa: string;
  subEn: string;
  subFa: string;
  accent: string;
}> = [
  {
    id: 'cyber_riser',
    labelEn: 'Cyber Riser',
    labelFa: 'رایزر سایبری',
    subEn: 'Synth Sweep Up',
    subFa: 'اوج‌گیری نئونی',
    accent: '#00F0FF'
  },
  {
    id: 'sub_drop',
    labelEn: 'Sub Bass Drop',
    labelFa: 'دراپ ساب‌بیس',
    subEn: '808 Club Impact',
    subFa: 'کوبش عمیق بیس',
    accent: '#F5B942'
  },
  {
    id: 'vinyl_scratch',
    labelEn: 'Vinyl Scratch',
    labelFa: 'اسکرچ وینیل',
    subEn: 'Turntable Cut',
    subFa: 'چرخش صفحه گرامافون',
    accent: '#FF2A85'
  },
  {
    id: 'dub_echo',
    labelEn: 'Dub Delay Echo',
    labelFa: 'اکوی داب فضایی',
    subEn: 'Triplet Feedback',
    subFa: 'پژواک سه‌بعدی',
    accent: '#10B981'
  },
  {
    id: 'laser_strobe',
    labelEn: 'Laser Strobe',
    labelFa: 'پالس لیزر',
    subEn: 'Electro Zap',
    subFa: 'ضربه الکترو',
    accent: '#A78BFA'
  },
  {
    id: 'velvet_reverb',
    labelEn: 'Velvet Swell',
    labelFa: 'ریورب مخملی',
    subEn: 'Harmonic Wash',
    subFa: 'فضاسازی گرم',
    accent: '#FB923C'
  }
];

const PLAYLIST_ACCENTS = ['#F5B942', '#00F0FF', '#FF2A85', '#10B981', '#A78BFA'];

function createDefaultDeckConfig(track: PrototypeMediaItem): DjDeckConfig {
  return {
    track,
    isPlaying: false,
    currentTimeSec: 0,
    pitchRate: 1.0,
    volume: 0.88,
    eqLowDb: 0,
    eqMidDb: 0,
    eqHighDb: 0,
    filterSweep: 0,
    activeLoopBeats: null
  };
}

/**
 * Interactive 3D Circular Orb ("کاملاً دایره سه‌بعدی")
 * Pulses in 3D space with radial frequency bars, spherical glass specular lighting,
 * and concentric shockwave rings proportional to the room's bass/beat intensity
 * whenever the user hovers, touches, or activates the card.
 */
function ThreeDCircularRoomOrb({
  room,
  isHovered,
  isPlayingRoom,
  tiltX,
  tiltY
}: {
  room: SonicRoomDefinition;
  isHovered: boolean;
  isPlayingRoom: boolean;
  tiltX: number;
  tiltY: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePulse = isHovered || isPlayingRoom;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();

    const render = (now: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      const elapsedSec = (now - startTime) / 1000;
      const beatFreqHz = room.pulseBpm / 60;
      const phase = elapsedSec * beatFreqHz * Math.PI * 2;

      // Read live audio spectrum if playing, otherwise synthesize exact room bass wave
      const liveSpectrum = isPlayingRoom ? djAudioController.getDeckSpectrum('A') : null;
      let liveBassNorm = 0;
      if (liveSpectrum && liveSpectrum.length > 0) {
        let sum = 0;
        for (let i = 0; i < 8; i++) sum += liveSpectrum[i];
        liveBassNorm = sum / (8 * 255);
      }

      // Compute instantaneous pulse hit (0..1) scaled by room.pulseIntensity
      const rawBeat = Math.pow(Math.max(0, Math.sin(phase)), 2.4);
      const effectiveIntensity = activePulse
        ? room.pulseIntensity * (0.55 + 0.45 * Math.max(rawBeat, liveBassNorm))
        : room.pulseIntensity * 0.18 * Math.max(0.2, Math.sin(phase * 0.5));

      // Draw 3D Concentric Shockwave Rings proportional to room intensity
      const ringCount = room.pulseIntensity >= 0.8 ? 3 : 2;
      for (let r = 0; r < ringCount; r++) {
        const ringProgress = ((elapsedSec * beatFreqHz * 0.85 + r / ringCount) % 1);
        const baseRadius = 46;
        const maxExpansion = activePulse ? 16 + room.pulseIntensity * 18 : 6;
        const radius = baseRadius + ringProgress * maxExpansion;
        const alpha = activePulse
          ? (1 - ringProgress) * (0.35 + room.pulseIntensity * 0.45)
          : (1 - ringProgress) * 0.16;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = r % 2 === 0 ? room.glowHex : room.secondaryHex;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.lineWidth = activePulse ? 1.5 + (1 - ringProgress) * 2.2 * room.pulseIntensity : 1;
        ctx.shadowColor = room.glowHex;
        ctx.shadowBlur = activePulse ? 12 * room.pulseIntensity : 4;
        ctx.stroke();
        ctx.restore();
      }

      // Draw Radial 3D Frequency Bars around the circular perimeter
      const barCount = 36;
      const innerR = 45;
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const specVal = liveSpectrum
          ? liveSpectrum[i % liveSpectrum.length] / 255
          : Math.abs(Math.sin(phase * 1.3 + i * 0.45)) *
            (0.4 + 0.6 * Math.pow(Math.max(0, Math.sin(phase)), 2));

        const barLen = activePulse
          ? 3 + specVal * (6 + room.pulseIntensity * 14)
          : 1.5 + specVal * 2.5;

        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * (innerR + barLen);
        const y2 = cy + Math.sin(angle) * (innerR + barLen);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = i % 3 === 0 ? room.secondaryHex : room.glowHex;
        ctx.globalAlpha = activePulse ? 0.45 + 0.55 * effectiveIntensity : 0.28;
        ctx.lineWidth = activePulse ? 2.2 : 1.4;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [activePulse, isPlayingRoom, room]);

  // Beat duration for CSS/Motion 3D sphere pulse
  const beatDurationSec = 60 / room.pulseBpm;
  const maxScale = activePulse ? 1 + room.pulseIntensity * 0.17 : 1.02;

  return (
    <div
      className="relative h-[108px] w-[108px] sm:h-[124px] sm:w-[124px] shrink-0 flex items-center justify-center select-none"
      style={{ perspective: '750px' }}
    >
      {/* 60fps Radial 3D Shockwave & Bass Spectrum Canvas */}
      <canvas
        ref={canvasRef}
        width={140}
        height={140}
        className="pointer-events-none absolute inset-[-12px] h-[calc(100%+24px)] w-[calc(100%+24px)] z-10"
      />

      {/* Ambient 3D Backlight Aura */}
      <motion.div
        animate={
          activePulse
            ? {
                scale: [1, 1 + room.pulseIntensity * 0.34, 1],
                opacity: [0.35, 0.55 + room.pulseIntensity * 0.4, 0.35]
              }
            : { scale: 1, opacity: 0.22 }
        }
        transition={{
          duration: beatDurationSec,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        className="pointer-events-none absolute inset-1 rounded-full blur-xl"
        style={{
          background: `radial-gradient(circle, ${room.glowHex} 0%, ${room.secondaryHex} 55%, transparent 75%)`
        }}
      />

      {/* True 3D Spherical Orb Container */}
      <motion.div
        animate={
          activePulse
            ? {
                scale: [1, maxScale, 0.97, 1],
                rotateX: tiltY,
                rotateY: tiltX,
                z: [0, room.pulseIntensity * 26, 0]
              }
            : {
                scale: 1,
                rotateX: 0,
                rotateY: 0,
                z: 0
              }
        }
        transition={{
          scale: {
            duration: beatDurationSec,
            repeat: Infinity,
            ease: [0.22, 1, 0.36, 1]
          },
          z: {
            duration: beatDurationSec,
            repeat: Infinity,
            ease: 'easeInOut'
          },
          rotateX: { type: 'spring', stiffness: 260, damping: 20 },
          rotateY: { type: 'spring', stiffness: 260, damping: 20 }
        }}
        style={{
          transformStyle: 'preserve-3d',
          boxShadow: activePulse
            ? `0 14px 34px -8px rgba(0,0,0,0.88), 0 0 ${Math.round(18 + room.pulseIntensity * 26)}px ${room.glowHex}66, inset 0 0 18px rgba(255,255,255,0.28)`
            : `0 10px 24px -6px rgba(0,0,0,0.85), 0 0 12px ${room.borderHex}33, inset 0 0 12px rgba(255,255,255,0.14)`
        }}
        className="relative h-[86px] w-[86px] sm:h-[98px] sm:w-[98px] rounded-full overflow-hidden border-2 z-20"
      >
        {/* Room Scene Artwork */}
        <img
          src={room.imageUrl}
          alt={room.titleFa}
          className="h-full w-full object-cover scale-110 transition-transform duration-500"
          style={{
            borderColor: activePulse ? room.glowHex : room.borderHex,
            filter: activePulse ? 'contrast(1.12) saturate(1.22)' : 'contrast(1.04)'
          }}
        />

        {/* Room-Specific Atmospheric Neon Overlay */}
        <div
          className="pointer-events-none absolute inset-0 mix-blend-screen opacity-45"
          style={{
            background: `radial-gradient(circle at 30% 25%, ${room.glowHex}88 0%, transparent 55%), radial-gradient(circle at 75% 80%, ${room.secondaryHex}77 0%, transparent 60%)`
          }}
        />

        {/* 3D Spherical Glass Specular Dome Highlight & Rim Depth */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 32% 24%, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.12) 22%, rgba(0,0,0,0.05) 54%, rgba(0,0,0,0.68) 100%)',
            boxShadow: `inset 0 2px 6px rgba(255,255,255,0.45), inset 0 -8px 16px rgba(0,0,0,0.75)`
          }}
        />

        {/* Inner 3D Orbital Ring */}
        <div
          className="pointer-events-none absolute inset-[5px] rounded-full border transition-opacity duration-300"
          style={{
            borderColor: activePulse ? `${room.glowHex}AA` : 'rgba(255,255,255,0.18)',
            opacity: activePulse ? 0.95 : 0.45
          }}
        />

        {/* Center Play / Live Pulse Indicator when Hovered or Playing */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            activePulse ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className="h-8 w-8 rounded-full bg-[#06070C]/75 backdrop-blur-md border flex items-center justify-center shadow-lg"
            style={{ borderColor: room.glowHex }}
          >
            {isPlayingRoom ? (
              <Pause className="h-3.5 w-3.5 text-white" />
            ) : (
              <Play className="h-3.5 w-3.5 text-white fill-current ms-0.5" />
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function DjStudioScreen({
  catalog,
  userVector,
  collections,
  favoriteIds,
  downloadsMap,
  initialDeckATrackId,
  initialDeckBTrackId,
  initialStudioTab = 'dj_console',
  onPlayTrack,
  onOpenDetail,
  onDownloadTrack,
  onToggleFavorite,
  onCreatePlaylist,
  onUpdatePlaylist,
  onDeletePlaylist,
  onRoomThemeChange,
  onActivePlaybackChange,
  isHostVisible = true
}: DjStudioScreenProps) {
  const { t, lang } = useT();

  const audioTracks = useMemo(() => {
    const filtered = catalog.filter((item) => inferMediaDomain(item) !== 'cinema');
    return filtered.length >= 2 ? filtered : catalog;
  }, [catalog]);

  // Active Sonic Room & Hovered Room for 3D Circular Pulse
  const [selectedRoomId, setSelectedRoomId] = useState<SonicRoomId>('cafe');
  const [inside3DRoom, setInside3DRoom] = useState<boolean>(false);
  const [portalTransitionRoom, setPortalTransitionRoom] = useState<SonicRoomDefinition | null>(null);
  const portalTimerRef = useRef<number | null>(null);
  const [cameraPreset, setCameraPreset] = useState<RoomCameraPreset>('cinematic');
  const [lightingFxMode, setLightingFxMode] = useState<RoomLightingFxMode>('natural_pt');
  const [fxBurstSeq, setFxBurstSeq] = useState<number>(0);
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);
  const moveInputRef = useRef<RoomMoveInput>({ forward: 0, strafe: 0, jump: false, sprint: false });

  const [hoveredRoomId, setHoveredRoomId] = useState<SonicRoomId | null>(null);
  const [playingRoomId, setPlayingRoomId] = useState<SonicRoomId | null>(null);
  const [pointerTilt, setPointerTilt] = useState<{ roomId: SonicRoomId | null; x: number; y: number }>({
    roomId: null,
    x: 0,
    y: 0
  });
  const [showAdvancedStudio, setShowAdvancedStudio] = useState<boolean>(false);

  // Google ADK (https://adk.dev/) Lighting Director Agent State
  const [lightingProfiles, setLightingProfiles] = useState<
    Record<CalibrationRoomId, RoomLightingCalibration>
  >(() => DEFAULT_ROOM_LIGHTING_PROFILES);
  const [lightingPresets, setLightingPresets] = useState<
    Array<{ id: string; labelFa: string; labelEn: string }>
  >([]);
  const [showAdkLightingPanel, setShowAdkLightingPanel] = useState<boolean>(false);
  const [adkLightingPrompt, setAdkLightingPrompt] = useState<string>('');
  const [adkLightingBusy, setAdkLightingBusy] = useState<boolean>(false);
  const [adkLightingReply, setAdkLightingReply] = useState<string | null>(null);
  const [adkLightingError, setAdkLightingError] = useState<string | null>(null);

  const [studioTab, setStudioTab] = useState<'dj_console' | 'playlist_studio'>(initialStudioTab);

  useEffect(() => {
    setStudioTab(initialStudioTab);
  }, [initialStudioTab]);

  // Standard Game Keyboard WASD / Arrows / Space (Jump) / Shift (Sprint) inside 3D rooms
  useEffect(() => {
    if (!inside3DRoom) {
      moveInputRef.current = { forward: 0, strafe: 0, jump: false, sprint: false };
      return;
    }
    const pressed = new Set<string>();
    const syncKeys = () => {
      const forward =
        (pressed.has('KeyW') || pressed.has('ArrowUp') ? 1 : 0) +
        (pressed.has('KeyS') || pressed.has('ArrowDown') ? -1 : 0);
      const strafe =
        (pressed.has('KeyD') || pressed.has('ArrowRight') ? 1 : 0) +
        (pressed.has('KeyA') || pressed.has('ArrowLeft') ? -1 : 0);
      const sprint = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
      moveInputRef.current.forward = forward;
      moveInputRef.current.strafe = strafe;
      moveInputRef.current.sprint = sprint;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        moveInputRef.current.jump = true;
        return;
      }
      if (
        ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(
          e.code
        )
      ) {
        pressed.add(e.code);
        syncKeys();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (pressed.has(e.code)) {
        pressed.delete(e.code);
        syncKeys();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      moveInputRef.current = { forward: 0, strafe: 0, jump: false, sprint: false };
    };
  }, [inside3DRoom]);

  const defaultTrackA = useMemo(
    () =>
      audioTracks.find((x) => x.id === initialDeckATrackId) ||
      audioTracks.find((x) => x.id === 'music-02') ||
      audioTracks[0],
    [audioTracks, initialDeckATrackId]
  );

  const defaultTrackB = useMemo(
    () =>
      audioTracks.find((x) => x.id === initialDeckBTrackId && x.id !== defaultTrackA?.id) ||
      audioTracks.find((x) => x.id === 'music-03' && x.id !== defaultTrackA?.id) ||
      audioTracks[1] ||
      audioTracks[0],
    [audioTracks, initialDeckBTrackId, defaultTrackA]
  );

  const [deckA, setDeckA] = useState<DjDeckConfig>(() => createDefaultDeckConfig(defaultTrackA));
  const [deckB, setDeckB] = useState<DjDeckConfig>(() => createDefaultDeckConfig(defaultTrackB));
  const [crossfader, setCrossfader] = useState<number>(-0.5);
  const [masterMuted, setMasterMuted] = useState<boolean>(false);
  const [activeFxId, setActiveFxId] = useState<DjFxType | null>(null);
  const [autoTransitioning, setAutoTransitioning] = useState<boolean>(false);

  // Sync when external caller sends a new track into Deck A
  useEffect(() => {
    if (!initialDeckATrackId) return;
    const found = audioTracks.find((x) => x.id === initialDeckATrackId);
    if (found && found.id !== deckA.track.id) {
      setDeckA((prev) => ({
        ...prev,
        track: found,
        currentTimeSec: 0
      }));
    }
  }, [initialDeckATrackId, audioTracks, deckA.track.id]);

  // Sync DualDeckWebAudioController with React state when host tab is visible
  useEffect(() => {
    if (!isHostVisible) return;
    djAudioController.syncState(deckA, deckB, crossfader, 0.9, masterMuted);
  }, [deckA, deckB, crossfader, isHostVisible, masterMuted]);

  useEffect(() => {
    onRoomThemeChange?.(selectedRoomId);
  }, [onRoomThemeChange, selectedRoomId]);

  useEffect(() => {
    if (isHostVisible) {
      onActivePlaybackChange?.(deckA.track, deckA.isPlaying);
    }
  }, [deckA.isPlaying, deckA.track, isHostVisible, onActivePlaybackChange]);

  // Stop audio & timers cleanly on unmount
  useEffect(() => {
    return () => {
      if (portalTimerRef.current) window.clearTimeout(portalTimerRef.current);
      djAudioController.stopAll();
    };
  }, []);

  // Advance playhead timers for active decks
  useEffect(() => {
    if (!deckA.isPlaying && !deckB.isPlaying) return;
    const timer = window.setInterval(() => {
      setDeckA((prev) => {
        if (!prev.isPlaying) return prev;
        const nextSec = prev.currentTimeSec + 0.25 * prev.pitchRate;
        return {
          ...prev,
          currentTimeSec: nextSec >= prev.track.durationSec ? 0 : nextSec
        };
      });
      setDeckB((prev) => {
        if (!prev.isPlaying) return prev;
        const nextSec = prev.currentTimeSec + 0.25 * prev.pitchRate;
        return {
          ...prev,
          currentTimeSec: nextSec >= prev.track.durationSec ? 0 : nextSec
        };
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [deckA.isPlaying, deckB.isPlaying]);

  // Live 60fps Waveform & Spectrum Canvases for Deck A & Deck B
  const canvasARef = useRef<HTMLCanvasElement | null>(null);
  const canvasBRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let rafId = 0;

    const drawDeckCanvas = (
      canvas: HTMLCanvasElement | null,
      deckId: DjDeckId,
      cfg: DjDeckConfig,
      accentHex: string
    ) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      const spectrum = djAudioController.getDeckSpectrum(deckId);
      const barCount = 32;
      const barWidth = Math.max(2, Math.floor((w - barCount * 3) / barCount));
      const progressRatio =
        cfg.track.durationSec > 0 ? cfg.currentTimeSec / cfg.track.durationSec : 0;

      for (let i = 0; i < barCount; i++) {
        const barRatio = i / barCount;
        const seed = Math.sin(i * 0.65 + cfg.track.id.charCodeAt(0)) * 0.5 + 0.5;
        let amp = 0.18 + seed * 0.35;

        if (cfg.isPlaying && spectrum) {
          const specVal = spectrum[i % spectrum.length] / 255;
          amp = Math.max(0.14, Math.min(0.96, specVal * 0.85 + seed * 0.2));
        }

        const barH = Math.max(4, Math.round(amp * (h - 10)));
        const x = i * (barWidth + 3) + 4;
        const y = Math.round((h - barH) / 2);

        if (barRatio <= progressRatio) {
          ctx.fillStyle = accentHex;
        } else if (cfg.isPlaying) {
          ctx.fillStyle = 'rgba(245, 247, 250, 0.38)';
        } else {
          ctx.fillStyle = 'rgba(163, 174, 194, 0.22)';
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 3);
        ctx.fill();
      }
    };

    const tick = () => {
      drawDeckCanvas(canvasARef.current, 'A', deckA, '#00F0FF');
      drawDeckCanvas(canvasBRef.current, 'B', deckB, '#F5B942');
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [deckA, deckB]);

  // Enter a Sonic Room's 3D Game World with Zoom-and-Blur Portal Transition
  const handleEnterRoom = useCallback(
    (
      room: SonicRoomDefinition,
      initialPreset: RoomCameraPreset = 'cinematic',
      initialLighting: RoomLightingFxMode = 'natural_pt'
    ) => {
      if (portalTimerRef.current) {
        window.clearTimeout(portalTimerRef.current);
      }
      setSelectedRoomId(room.id);
      setCameraPreset(initialPreset);
      setLightingFxMode(initialLighting);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      const roomTracks = room.preferredTrackIds
        .map((id) => catalog.find((c) => c.id === id))
        .filter((x): x is PrototypeMediaItem => Boolean(x));

      const primaryTrack = roomTracks[0] || defaultTrackA;
      const secondaryTrack = roomTracks[1] || defaultTrackB;

      setPlayingRoomId(room.id);
      setCrossfader(-0.7);
      setDeckA((prev) => ({
        ...prev,
        track: primaryTrack,
        isPlaying: true,
        eqLowDb: room.id === 'party' ? 6 : room.id === 'concert' ? 3 : 0
      }));
      if (secondaryTrack) {
        setDeckB((prev) => ({
          ...prev,
          track: secondaryTrack
        }));
      }
      djAudioController.triggerFxPad(room.fxTrigger);
      setFxBurstSeq((s) => s + 1);

      if (!inside3DRoom) {
        setPortalTransitionRoom(room);
        setInside3DRoom(true);
        portalTimerRef.current = window.setTimeout(() => {
          setPortalTransitionRoom(null);
        }, 520);
      } else {
        setInside3DRoom(true);
      }
    },
    [catalog, defaultTrackA, defaultTrackB, inside3DRoom]
  );

  // Sync Deck B BPM to Deck A BPM
  const handleSyncBpm = useCallback((targetDeck: DjDeckId) => {
    if (targetDeck === 'B') {
      setDeckB((prevB) => {
        const bpmA = (deckA.track.bpm || 110) * deckA.pitchRate;
        const baseB = prevB.track.bpm || 110;
        const nextRate = Math.max(0.75, Math.min(1.35, Number((bpmA / baseB).toFixed(2))));
        return { ...prevB, pitchRate: nextRate };
      });
    } else {
      setDeckA((prevA) => {
        const bpmB = (deckB.track.bpm || 110) * deckB.pitchRate;
        const baseA = prevA.track.bpm || 110;
        const nextRate = Math.max(0.75, Math.min(1.35, Number((bpmB / baseA).toFixed(2))));
        return { ...prevA, pitchRate: nextRate };
      });
    }
  }, [deckA.pitchRate, deckA.track.bpm, deckB.pitchRate, deckB.track.bpm]);

  // Smooth Auto-Crossfade Transition between Deck A and Deck B
  const handleAutoCrossfade = useCallback(() => {
    if (autoTransitioning) return;
    setAutoTransitioning(true);
    const target = crossfader <= 0 ? 1 : -1;
    const start = crossfader;
    const steps = 28;
    let currentStep = 0;

    if (target > 0 && !deckB.isPlaying) {
      setDeckB((prev) => ({ ...prev, isPlaying: true }));
    } else if (target < 0 && !deckA.isPlaying) {
      setDeckA((prev) => ({ ...prev, isPlaying: true }));
    }

    const interval = window.setInterval(() => {
      currentStep += 1;
      const ratio = currentStep / steps;
      const nextVal = Number((start + (target - start) * ratio).toFixed(2));
      setCrossfader(nextVal);
      if (currentStep >= steps) {
        window.clearInterval(interval);
        setAutoTransitioning(false);
      }
    }, 60);
  }, [autoTransitioning, crossfader, deckA.isPlaying, deckB.isPlaying]);

  const handleTriggerFx = useCallback((fxId: DjFxType) => {
    setActiveFxId(fxId);
    djAudioController.triggerFxPad(fxId);
    setFxBurstSeq((s) => s + 1);
    window.setTimeout(() => {
      setActiveFxId((curr) => (curr === fxId ? null : curr));
    }, 650);
  }, []);

  // ============================================================================
  // SMART PLAYLIST PERSONALIZER STATE
  // ============================================================================
  const [playlistRealm, setPlaylistRealm] = useState<UniverseRealmFilter>('all_audio');
  const [energySlider, setEnergySlider] = useState<number>(Math.round(userVector.pace * 100));
  const [nocturnalSlider, setNocturnalSlider] = useState<number>(Math.round(userVector.nocturnal * 100));
  const [vocalSlider, setVocalSlider] = useState<number>(Math.round(userVector.intimacy * 100));
  const [depthSlider, setDepthSlider] = useState<number>(Math.round(userVector.depth * 100));

  const [newPlaylistName, setNewPlaylistName] = useState<string>('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState<string>('');
  const [newPlaylistAccent, setNewPlaylistAccent] = useState<string>('#F5B942');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(
    collections[0]?.id || ''
  );

  useEffect(() => {
    if (!selectedPlaylistId && collections.length > 0) {
      setSelectedPlaylistId(collections[0].id);
    }
  }, [collections, selectedPlaylistId]);

  const customTasteVector: TasteVector6D = useMemo(
    () => ({
      pace: energySlider / 100,
      tension: Math.min(1, (energySlider * 0.65 + depthSlider * 0.35) / 100),
      nocturnal: nocturnalSlider / 100,
      intimacy: vocalSlider / 100,
      depth: depthSlider / 100,
      surrealism: Math.min(1, (depthSlider * 0.7 + nocturnalSlider * 0.3) / 100)
    }),
    [energySlider, nocturnalSlider, vocalSlider, depthSlider]
  );

  const smartGeneratedTracks = useMemo(() => {
    const pool = filterCatalogByRealm(catalog, playlistRealm);
    return pool
      .map((item) => ({
        item,
        matchPct: Math.max(
          62,
          Math.min(99, Math.round(cosineSimilarity6D(customTasteVector, item.vector) * 100))
        )
      }))
      .sort((a, b) => b.matchPct - a.matchPct)
      .slice(0, 8);
  }, [catalog, playlistRealm, customTasteVector]);

  const handleSaveSmartPlaylist = () => {
    const title =
      newPlaylistName.trim() ||
      t(
        `Aether Smart Mix (${energySlider}% Energy)`,
        `پلی‌لیست هوشمند اِتر (انرژی ${energySlider}٪)`
      );
    const desc =
      newPlaylistDesc.trim() ||
      t(
        'Personalized via 6D Sonic DNA & Mood Sliders',
        'شخصی‌سازی‌شده با موتور ۶بعدی موسیقی، پادکست و کتاب صوتی'
      );

    onCreatePlaylist({
      name: title,
      descriptionFa: desc,
      descriptionEn: desc,
      accentHex: newPlaylistAccent,
      moodTagFa: `انرژی ${energySlider}٪ · شبانه ${nocturnalSlider}٪`,
      moodTagEn: `Energy ${energySlider}% · Nocturnal ${nocturnalSlider}%`,
      itemIds: smartGeneratedTracks.map((x) => x.item.id)
    });
    setNewPlaylistName('');
    setNewPlaylistDesc('');
  };

  const activeCollection = useMemo(
    () => collections.find((c) => c.id === selectedPlaylistId) || collections[0],
    [collections, selectedPlaylistId]
  );

  const handleMoveTrackInPlaylist = (col: UserCollection, index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= col.itemIds.length) return;
    const copy = [...col.itemIds];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    onUpdatePlaylist(col.id, { itemIds: copy });
  };

  const handleRemoveTrackFromPlaylist = (col: UserCollection, itemId: string) => {
    onUpdatePlaylist(col.id, {
      itemIds: col.itemIds.filter((id) => id !== itemId)
    });
  };

  const handleAddTrackToPlaylist = (col: UserCollection, itemId: string) => {
    if (col.itemIds.includes(itemId)) return;
    onUpdatePlaylist(col.id, {
      itemIds: [...col.itemIds, itemId]
    });
  };

  const activeRoom = useMemo(
    () => SONIC_ROOMS.find((r) => r.id === selectedRoomId) || SONIC_ROOMS[0],
    [selectedRoomId]
  );

  const activeRoomTracks = useMemo(() => {
    return activeRoom.preferredTrackIds
      .map((id) => catalog.find((c) => c.id === id))
      .filter((x): x is PrototypeMediaItem => Boolean(x));
  }, [activeRoom, catalog]);

  const triggerPlayerJump = useCallback(() => {
    moveInputRef.current.jump = true;
  }, []);

  // Load persisted ADK Lighting Director profiles & presets from server
  useEffect(() => {
    let cancelled = false;
    fetch('/api/agents/lighting/profiles')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.profiles && typeof data.profiles === 'object') {
          setLightingProfiles((prev) => ({ ...prev, ...data.profiles }));
        }
        if (Array.isArray(data.presets)) {
          setLightingPresets(data.presets);
        }
      })
      .catch(() => {
        // Keep physical defaults if offline
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApplyLightingPreset = useCallback(
    async (presetId: string) => {
      setAdkLightingBusy(true);
      setAdkLightingError(null);
      try {
        const res = await fetch('/api/agents/lighting/preset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: activeRoom.id, presetId })
        });
        const data = await res.json();
        if (!res.ok) {
          setAdkLightingError(data?.error || t('Preset error', 'خطا در اعمال پیش‌تنظیم'));
          return;
        }
        if (data.allProfiles) {
          setLightingProfiles(data.allProfiles);
        }
        setAdkLightingReply(
          data.replyFa || t('Lighting preset applied.', 'پیش‌تنظیم نورپردازی اعمال شد.')
        );
      } catch {
        setAdkLightingError(t('Failed to reach lighting service.', 'ارتباط با سرویس نور برقرار نشد.'));
      } finally {
        setAdkLightingBusy(false);
      }
    },
    [activeRoom.id, t]
  );

  const handleRunAdkLightingTune = useCallback(
    async (customInstruction?: string) => {
      const instruction = (customInstruction ?? adkLightingPrompt).trim();
      if (!instruction || adkLightingBusy) return;
      setAdkLightingBusy(true);
      setAdkLightingError(null);
      try {
        const res = await fetch('/api/agents/lighting/tune', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: activeRoom.id,
            instruction,
            audioContext: {
              isPlaying: deckA.isPlaying,
              bpm: Math.round((deckA.track.bpm || activeRoom.pulseBpm) * deckA.pitchRate),
              trackTitle: deckA.track.titleFa || deckA.track.titleEn,
              lightingFxMode
            }
          })
        });
        const data = await res.json();
        if (!res.ok) {
          setAdkLightingError(
            data?.error || t('ADK Lighting Agent failed.', 'خطا در اجرای ایجنت نورپردازی ADK')
          );
          return;
        }
        if (data.allProfiles) {
          setLightingProfiles(data.allProfiles);
        }
        setAdkLightingReply(
          data.replyFa || t('Scene lighting calibrated by ADK Agent.', 'نور صحنه توسط ایجنت ADK تنظیم شد.')
        );
        if (!customInstruction) {
          setAdkLightingPrompt('');
        }
      } catch {
        setAdkLightingError(
          t('Failed to reach ADK Lighting Agent.', 'ارتباط با ایجنت نورپردازی ADK برقرار نشد.')
        );
      } finally {
        setAdkLightingBusy(false);
      }
    },
    [
      activeRoom.id,
      activeRoom.pulseBpm,
      adkLightingBusy,
      adkLightingPrompt,
      deckA.isPlaying,
      deckA.pitchRate,
      deckA.track.bpm,
      deckA.track.titleEn,
      deckA.track.titleFa,
      lightingFxMode,
      t
    ]
  );

  const handleResetRoomLighting = useCallback(async () => {
    setAdkLightingBusy(true);
    setAdkLightingError(null);
    try {
      const res = await fetch('/api/agents/lighting/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: activeRoom.id })
      });
      const data = await res.json();
      if (!res.ok) {
        setAdkLightingError(data?.error || t('Reset failed.', 'بازگردانی با خطا مواجه شد.'));
        return;
      }
      if (data.allProfiles) {
        setLightingProfiles(data.allProfiles);
      }
      setAdkLightingReply(
        data.replyFa || t('Reset to physical calibration.', 'نور اتاق به کالیبراسیون استاندارد بازگشت.')
      );
    } catch {
      setAdkLightingError(t('Failed to reset lighting.', 'خطا در بازگردانی تنظیمات نور.'));
    } finally {
      setAdkLightingBusy(false);
    }
  }, [activeRoom.id, t]);

  // ============================================================================
  // COLLABORATIVE MULTI-DEVICE SYNC, BLUETOOTH/WI-FI PAIRING, FULLSCREEN & MUSIC PICKER
  // ============================================================================
  const roomViewportRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showMusicPicker, setShowMusicPicker] = useState<boolean>(false);
  const [showPairModal, setShowPairModal] = useState<boolean>(false);
  const [pairModalTab, setPairModalTab] = useState<PairAndScanTab>('pair');
  const [deviceTracks, setDeviceTracks] = useState<PrototypeMediaItem[]>([]);
  const [myDeviceName, setMyDeviceName] = useState<string>(() => {
    if (typeof navigator !== 'undefined') {
      if (/iPhone|iPad/i.test(navigator.userAgent)) return 'iPhone · من';
      if (/Android/i.test(navigator.userAgent)) return 'Android · من';
    }
    return 'دستگاه من';
  });
  const myPeerIdRef = useRef<string>(`peer-${Math.random().toString(36).slice(2, 9)}`);
  const [roomSyncState, setRoomSyncState] = useState<RoomSyncSessionState | null>(null);
  const lastHandledSeqRef = useRef<number>(0);
  const [roomNoticeFa, setRoomNoticeFa] = useState<string | null>(null);
  const roomNoticeTimerRef = useRef<number | null>(null);

  const showRoomNotice = useCallback((msg: string) => {
    setRoomNoticeFa(msg);
    if (roomNoticeTimerRef.current) window.clearTimeout(roomNoticeTimerRef.current);
    roomNoticeTimerRef.current = window.setTimeout(() => {
      setRoomNoticeFa(null);
    }, 4200);
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        // Keep virtual viewport fullscreen only if exited natively by Esc
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (roomNoticeTimerRef.current) window.clearTimeout(roomNoticeTimerRef.current);
    };
  }, [isFullscreen]);

  const handleToggleFullscreen = useCallback(async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    try {
      if (next && roomViewportRef.current?.requestFullscreen && !document.fullscreenElement) {
        await roomViewportRef.current.requestFullscreen();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Viewport fixed overlay handles iOS Safari and iframes seamlessly
    }
  }, [isFullscreen]);

  const applyIncomingSyncState = useCallback(
    (incoming: RoomSyncSessionState) => {
      setRoomSyncState(incoming);
      if (incoming.currentTrack && incoming.playbackSeq > lastHandledSeqRef.current) {
        lastHandledSeqRef.current = incoming.playbackSeq;
        const ct = incoming.currentTrack;
        setPlayingRoomId(incoming.isPlaying ? (incoming.roomId as SonicRoomId) : null);
        setDeckA((prev) => {
          const preservedAudioUrl =
            prev.track.id === ct.id && prev.track.audioUrl ? prev.track.audioUrl : ct.audioUrl;
          const template = catalog.find((c) => c.id === ct.id) || prev.track;
          const nextTrack: PrototypeMediaItem = {
            ...template,
            id: ct.id,
            mediaType: ct.mediaType || template.mediaType || 'music',
            bpm: ct.bpm || template.bpm || 110,
            musicalKey: ct.musicalKey || template.musicalKey || 'Cm',
            titleFa: ct.titleFa,
            titleEn: ct.titleEn || ct.titleFa,
            creatorFa: ct.creatorFa || ct.addedByDeviceName,
            creatorEn: ct.creatorEn || ct.addedByDeviceName,
            posterUrl: ct.posterUrl || template.posterUrl,
            accentHex: ct.accentHex || template.accentHex,
            durationSec: ct.durationSec || template.durationSec,
            audioUrl: preservedAudioUrl,
            addedByDeviceName: ct.addedByDeviceName,
            addedVia: ct.addedVia
          };
          return {
            ...prev,
            track: nextTrack,
            currentTimeSec: 0,
            isPlaying: incoming.isPlaying
          };
        });
      }
    },
    [catalog]
  );

  // Real WebSocket + BroadcastChannel room session sync when inside a 3D room
  useEffect(() => {
    if (!inside3DRoom) return;
    const roomId = selectedRoomId as RoomSyncId;
    lastHandledSeqRef.current = 0;

    let closed = false;
    let ws: WebSocket | null = null;
    const bc =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('aether_room_sync') : null;

    if (bc) {
      bc.onmessage = (ev) => {
        const msg = ev.data as { type?: string; state?: RoomSyncSessionState };
        if (msg?.type === 'room_state' && msg.state?.roomId === roomId) {
          applyIncomingSyncState(msg.state);
        }
      };
    }

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    try {
      ws = new WebSocket(
        `${proto}://${window.location.host}/ws/rooms?roomId=${encodeURIComponent(roomId)}&peerId=${encodeURIComponent(
          myPeerIdRef.current
        )}`
      );
      ws.onmessage = (ev) => {
        if (closed) return;
        try {
          const payload = JSON.parse(String(ev.data)) as {
            type?: string;
            state?: RoomSyncSessionState;
          };
          if (payload.type === 'room_state' && payload.state?.roomId === roomId) {
            applyIncomingSyncState(payload.state);
          }
        } catch {
          // ignore malformed ws message
        }
      };
    } catch {
      // HTTP fallback below still joins cleanly
    }

    void fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        peerId: myPeerIdRef.current,
        deviceName: myDeviceName,
        connectionType: 'wifi',
        isHost: true,
        routed: true
      })
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!closed && data?.state) {
          setRoomSyncState(data.state);
        }
      })
      .catch(() => {});

    return () => {
      closed = true;
      if (ws && ws.readyState <= WebSocket.OPEN) {
        ws.close();
      }
      bc?.close();
    };
  }, [applyIncomingSyncState, inside3DRoom, myDeviceName, selectedRoomId]);

  const handlePushTrackLastWins = useCallback(
    async (track: PrototypeMediaItem, noteFa?: string) => {
      const enriched: PrototypeMediaItem = {
        ...track,
        addedByDeviceName: track.addedByDeviceName || myDeviceName,
        addedVia: track.addedVia || 'wifi'
      };
      setPlayingRoomId(activeRoom.id);
      setDeckA((prev) => ({
        ...prev,
        track: enriched,
        currentTimeSec: 0,
        isPlaying: true
      }));
      showRoomNotice(
        noteFa ||
          `آخرین آهنگ توسط ${enriched.addedByDeviceName}: «${
            lang === 'fa' ? enriched.titleFa : enriched.titleEn
          }»`
      );

      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(activeRoom.id)}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            track: {
              id: enriched.id,
              titleFa: enriched.titleFa,
              titleEn: enriched.titleEn,
              creatorFa: enriched.creatorFa,
              creatorEn: enriched.creatorEn,
              categoryFa: enriched.categoryFa,
              categoryEn: enriched.categoryEn,
              bpm: enriched.bpm || activeRoom.pulseBpm,
              musicalKey: enriched.musicalKey || 'Cm',
              posterUrl: enriched.posterUrl,
              accentHex: enriched.accentHex,
              durationSec: enriched.durationSec,
              mediaType: enriched.mediaType || 'music',
              addedByDeviceName: enriched.addedByDeviceName,
              addedVia: enriched.addedVia || 'wifi'
            }
          })
        });
        const data = await res.json();
        if (res.ok && data?.state) {
          lastHandledSeqRef.current = data.state.playbackSeq;
          setRoomSyncState(data.state);
          if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('aether_room_sync');
            bc.postMessage({ type: 'room_state', state: data.state });
            bc.close();
          }
        }
      } catch {
        // local playback continues smoothly
      }
    },
    [activeRoom.id, activeRoom.pulseBpm, lang, myDeviceName, showRoomNotice]
  );

  const handleJoinPeerDevice = useCallback(
    async (deviceName: string, connectionType: RoomPeerConnectionType) => {
      const cleanName = deviceName.trim();
      if (!cleanName) return;
      const isSelf = cleanName === myDeviceName && connectionType === 'wifi';
      const peerId = isSelf ? myPeerIdRef.current : `friend-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const res = await fetch(`/api/rooms/${encodeURIComponent(activeRoom.id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId,
          deviceName: cleanName,
          connectionType,
          isHost: isSelf,
          routed: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.state) {
          setRoomSyncState(data.state);
          showRoomNotice(
            `${cleanName} (${connectionType === 'bluetooth' ? 'Bluetooth' : 'Wi-Fi'}) به اتاق اضافه شد.`
          );
        }
      }
    },
    [activeRoom.id, myDeviceName, showRoomNotice]
  );

  const handleTogglePeerRoute = useCallback(
    async (peerId: string, routed: boolean) => {
      const res = await fetch(`/api/rooms/${encodeURIComponent(activeRoom.id)}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId, routed })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.state) {
          setRoomSyncState(data.state);
        }
      }
    },
    [activeRoom.id]
  );

  const handlePullSyncedTrackFromNearby = useCallback(
    async (entry: NearbyRoomScanEntry) => {
      for (const peer of entry.peers.slice(0, 3)) {
        await handleJoinPeerDevice(peer.deviceName, peer.connectionType);
      }
      const matched =
        catalog.find((c) => c.titleFa === entry.currentTrackTitleFa || c.titleEn === entry.currentTrackTitleEn) ||
        catalog[0];
      await handlePushTrackLastWins(
        {
          ...matched,
          titleFa: entry.currentTrackTitleFa,
          titleEn: entry.currentTrackTitleEn,
          addedByDeviceName: entry.addedByDeviceName,
          addedVia: entry.signalType
        },
        `همگام‌سازی صوتی از ${entry.titleFa} با دیوایس ${entry.addedByDeviceName} انجام شد.`
      );
    },
    [catalog, handleJoinPeerDevice, handlePushTrackLastWins]
  );

  const connectedPeers = roomSyncState?.peers || [];
  const latestTrackDeviceName =
    roomSyncState?.currentTrack?.addedByDeviceName || deckA.track.addedByDeviceName || myDeviceName;

  const renderDeckCard = (
    deckId: DjDeckId,
    cfg: DjDeckConfig,
    setCfg: React.Dispatch<React.SetStateAction<DjDeckConfig>>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    accentHex: string
  ) => {
    const liveBpm = Math.round((cfg.track.bpm || 110) * cfg.pitchRate * 10) / 10;
    const isFav = favoriteIds.has(cfg.track.id);
    const dlRec = downloadsMap[cfg.track.id];
    const domain = inferMediaDomain(cfg.track);

    return (
      <div
        className="rounded-[28px] liquid-glass-surface p-4 sm:p-5 space-y-4"
        style={{
          boxShadow: cfg.isPlaying ? `0 0 36px -12px ${accentHex}44` : undefined
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-[#06070C]"
              style={{ backgroundColor: accentHex }}
            >
              {deckId}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider text-[#F5F7FA]">
                  {deckId === 'A' ? t('DECK A', 'دک A') : t('DECK B', 'دک B')}
                </span>
                <span className="rounded-md bg-white/8 px-2 py-0.5 text-[10px] text-[#A3AEC2]">
                  {domain === 'music'
                    ? t('Music', 'موسیقی')
                    : domain === 'podcast'
                    ? t('Podcast', 'پادکست')
                    : t('Audiobook', 'کتاب صوتی')}
                </span>
              </div>
              <p dir="ltr" className="text-[11px] font-mono-tabular text-[#A3AEC2]">
                {liveBpm.toFixed(1)} BPM · {cfg.track.musicalKey || 'Am'} ·{' '}
                {formatDuration(Math.floor(cfg.currentTimeSec))} /{' '}
                {formatDuration(cfg.track.durationSec)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSyncBpm(deckId)}
              className="min-h-[36px] rounded-xl border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-3 text-xs font-semibold text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-colors cursor-pointer"
            >
              SYNC BPM
            </button>
            <button
              type="button"
              onClick={() => onToggleFavorite(cfg.track)}
              aria-label={t('Save to Favorites', 'ذخیره در علاقه‌مندی‌ها')}
              className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                isFav
                  ? 'border-[#F5B942]/60 bg-[#F5B942]/15 text-[#F5B942]'
                  : 'border-white/12 bg-white/[0.04] text-[#A3AEC2] hover:text-white'
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${isFav ? 'fill-current' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => onDownloadTrack(cfg.track)}
              aria-label={t('Save Offline', 'ذخیره آفلاین')}
              className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                dlRec?.status === 'completed'
                  ? 'border-[#34D399]/50 bg-[#34D399]/15 text-[#34D399]'
                  : 'border-white/12 bg-white/[0.04] text-[#A3AEC2] hover:text-white'
              }`}
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Track Selector Dropdown */}
        <div>
          <select
            value={cfg.track.id}
            onChange={(e) => {
              const found = audioTracks.find((x) => x.id === e.target.value);
              if (found) {
                setCfg((prev) => ({
                  ...prev,
                  track: found,
                  currentTimeSec: 0
                }));
              }
            }}
            aria-label={deckId === 'A' ? 'Select track for Deck A' : 'Select track for Deck B'}
            className="w-full min-h-[42px] rounded-xl border border-white/12 bg-[#06070C] px-3.5 text-base sm:text-xs text-[#F5F7FA]"
          >
            {audioTracks.map((tr) => {
              const dom = inferMediaDomain(tr);
              const prefix = dom === 'music' ? '🎵' : dom === 'podcast' ? '🎙️' : '📚';
              return (
                <option key={tr.id} value={tr.id}>
                  {prefix} {t(tr.titleEn, tr.titleFa)} ({tr.bpm || 110} BPM)
                </option>
              );
            })}
          </select>
        </div>

        {/* Turntable Platter + Live Waveform Canvas */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center rounded-2xl border border-white/8 bg-[#06070C]/80 p-3">
          <div className="sm:col-span-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCfg((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))}
              className="relative h-16 w-16 shrink-0 rounded-full border-2 p-1 cursor-pointer group"
              style={{ borderColor: cfg.isPlaying ? accentHex : 'rgba(255,255,255,0.18)' }}
            >
              <img
                src={cfg.track.posterUrl}
                alt={t(cfg.track.titleEn, cfg.track.titleFa)}
                className={`h-full w-full rounded-full object-cover ${
                  cfg.isPlaying ? 'animate-spin' : ''
                }`}
                style={{ animationDuration: `${Math.max(2.2, 6 / cfg.pitchRate)}s` }}
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 group-hover:bg-black/60 transition-colors">
                {cfg.isPlaying ? (
                  <Pause className="h-5 w-5 text-white" />
                ) : (
                  <Play className="h-5 w-5 text-white fill-current" />
                )}
              </span>
            </button>

            <div className="min-w-0 sm:hidden">
              <p className="text-sm font-semibold text-[#F5F7FA] truncate">
                {t(cfg.track.titleEn, cfg.track.titleFa)}
              </p>
              <p className="text-xs text-[#A3AEC2] truncate">
                {t(cfg.track.creatorEn || cfg.track.categoryEn, cfg.track.creatorFa || cfg.track.categoryFa)}
              </p>
            </div>
          </div>

          <div className="sm:col-span-8 space-y-1.5">
            <div className="hidden sm:flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onOpenDetail(cfg.track)}
                className="text-xs font-semibold text-[#F5F7FA] hover:text-[#F5B942] truncate cursor-pointer text-start"
              >
                {t(cfg.track.titleEn, cfg.track.titleFa)}
              </button>
              <span className="text-[11px] text-[#A3AEC2] shrink-0">
                {cfg.track.audioSpec || cfg.track.quality}
              </span>
            </div>
            <canvas
              ref={canvasRef}
              width={360}
              height={64}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setCfg((prev) => ({
                  ...prev,
                  currentTimeSec: Math.round(ratio * prev.track.durationSec)
                }));
              }}
              className="w-full h-14 rounded-xl bg-[#090D18] border border-white/10 cursor-pointer"
            />
          </div>
        </div>

        {/* Transport, Hot Cues & Beat Loop Roll Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCfg((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold text-[#06070C] cursor-pointer"
              style={{ backgroundColor: accentHex }}
            >
              {cfg.isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
              <span>{cfg.isPlaying ? t('Pause', 'توقف') : t('Play Deck', 'پخش دک')}</span>
            </button>

            <button
              type="button"
              onClick={() => setCfg((prev) => ({ ...prev, currentTimeSec: 0 }))}
              className="min-h-[40px] rounded-xl border border-white/15 bg-white/[0.05] px-3 text-xs font-mono-tabular text-[#E2E8F0] hover:bg-white/[0.1] cursor-pointer"
            >
              CUE
            </button>
          </div>

          {/* Beat Loop Roll Buttons */}
          <div className="flex items-center gap-1" dir="ltr">
            <span className="text-[11px] text-[#A3AEC2] me-1">LOOP:</span>
            {([0.25, 0.5, 1, 4] as const).map((beats) => {
              const active = cfg.activeLoopBeats === beats;
              return (
                <button
                  key={beats}
                  type="button"
                  onClick={() =>
                    setCfg((prev) => ({
                      ...prev,
                      activeLoopBeats: prev.activeLoopBeats === beats ? null : beats
                    }))
                  }
                  className={`min-h-[34px] rounded-lg px-2.5 text-[11px] font-mono-tabular font-semibold transition-colors cursor-pointer border ${
                    active
                      ? 'border-[#F5B942] bg-[#F5B942] text-[#06070C]'
                      : 'border-white/12 bg-white/[0.04] text-[#CBD5E1] hover:text-white'
                  }`}
                >
                  {beats === 0.25 ? '1/4' : beats === 0.5 ? '1/2' : `${beats}B`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pitch / Tempo Slider + 3-Band EQ (LOW / MID / HIGH) + Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
          <div className="space-y-2.5 rounded-2xl bg-[#06070C]/70 p-3 border border-white/8">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A3AEC2]">{t('Tempo / Pitch', 'سرعت و گام (BPM)')}</span>
                <span dir="ltr" className="font-mono-tabular text-[#F5F7FA]">
                  {Math.round(cfg.pitchRate * 100)}% ({liveBpm} BPM)
                </span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.35}
                step={0.01}
                value={cfg.pitchRate}
                onChange={(e) =>
                  setCfg((prev) => ({ ...prev, pitchRate: Number(e.target.value) }))
                }
                className="w-full aether-slider"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A3AEC2]">{t('Filter Sweep (LPF/HPF)', 'فیلتر فرکانس')}</span>
                <button
                  type="button"
                  onClick={() => setCfg((prev) => ({ ...prev, filterSweep: 0, pitchRate: 1 }))}
                  className="text-[10px] text-[#F5B942] hover:underline cursor-pointer"
                >
                  {t('Reset', 'ریست')}
                </button>
              </div>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.04}
                value={cfg.filterSweep}
                onChange={(e) =>
                  setCfg((prev) => ({ ...prev, filterSweep: Number(e.target.value) }))
                }
                className="w-full aether-slider"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-2xl bg-[#06070C]/70 p-3 border border-white/8">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#E2E8F0]">
                {t('3-Band Equalizer', 'اکولایزر ۳بانده (EQ)')}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCfg((prev) => ({ ...prev, eqLowDb: 0, eqMidDb: 0, eqHighDb: 0 }))
                }
                className="text-[10px] text-[#00F0FF] hover:underline cursor-pointer"
              >
                0 dB
              </button>
            </div>

            {(
              [
                { key: 'eqLowDb', label: 'LOW (Bass)', val: cfg.eqLowDb },
                { key: 'eqMidDb', label: 'MID (Vocal)', val: cfg.eqMidDb },
                { key: 'eqHighDb', label: 'HIGH (Air)', val: cfg.eqHighDb }
              ] as const
            ).map((band) => (
              <div key={band.key} className="flex items-center gap-2">
                <span dir="ltr" className="w-20 text-[10px] font-mono-tabular text-[#A3AEC2]">
                  {band.label}
                </span>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={band.val}
                  onChange={(e) =>
                    setCfg((prev) => ({ ...prev, [band.key]: Number(e.target.value) }))
                  }
                  className="flex-1 aether-slider"
                />
                <span dir="ltr" className="w-10 text-end text-[10px] font-mono-tabular text-[#F5F7FA]">
                  {band.val > 0 ? `+${band.val}` : band.val}dB
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 sm:space-y-7 pb-14">
      {/* VOLUMETRIC ZOOM-AND-BLUR PORTAL TRANSITION WHEN ENTERING 3D ROOM */}
      <AnimatePresence>
        {portalTransitionRoom && (
          <motion.div
            key={`portal-${portalTransitionRoom.id}`}
            initial={{ opacity: 0.95, scale: 0.88 }}
            animate={{ opacity: 0, scale: 1.24 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center backdrop-blur-2xl"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${portalTransitionRoom.glowHex}44 0%, ${portalTransitionRoom.secondaryHex}22 38%, rgba(5,6,11,0.92) 78%)`
            }}
          >
            <div
              className="h-52 w-52 rounded-full border border-white/35 flex items-center justify-center shadow-[0_0_90px_rgba(245,185,66,0.45)]"
              style={{
                borderColor: `${portalTransitionRoom.glowHex}88`,
                boxShadow: `0 0 85px ${portalTransitionRoom.glowHex}66`
              }}
            >
              <span className="font-editorial text-lg font-black tracking-wider text-white">
                {t(portalTransitionRoom.titleEn, portalTransitionRoom.titleFa)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {inside3DRoom ? (
        /* ====================================================================
           FULL 3D GAME-GRADE INTERACTIVE ROOM WORLD (All 5 Sonic Rooms)
           ==================================================================== */
        <div
          ref={roomViewportRef}
          className={
            isFullscreen
              ? 'fixed inset-0 z-[80] w-screen h-[100dvh] bg-[#05060a]'
              : 'relative -mx-3 -mt-4 sm:mx-0 sm:mt-0 w-[calc(100%+1.5rem)] sm:w-full'
          }
        >
          <motion.div
            key={`stage-${activeRoom.id}`}
            initial={{ opacity: 0, scale: 1.06, filter: 'blur(12px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
          >
            <SonicRoom3DWorld
              roomId={activeRoom.id}
              isPlaying={deckA.isPlaying}
              isHostVisible={isHostVisible}
              isFullscreen={isFullscreen}
              connectedPeers={connectedPeers}
              latestTrackDeviceName={latestTrackDeviceName}
              bpm={Math.round((deckA.track.bpm || activeRoom.pulseBpm) * deckA.pitchRate)}
              pulseIntensity={activeRoom.pulseIntensity}
              cameraPreset={cameraPreset}
              lightingFxMode={lightingFxMode}
              lightingCalibration={lightingProfiles[activeRoom.id as CalibrationRoomId]}
              moveInputRef={moveInputRef}
              fxBurstSeq={fxBurstSeq}
              trackTitle={lang === 'fa' ? deckA.track.titleFa : deckA.track.titleEn}
              trackArtist={
                lang === 'fa'
                  ? deckA.track.creatorFa || deckA.track.sourceName
                  : deckA.track.creatorEn || deckA.track.sourceName
              }
              trackCoverUrl={deckA.track.posterUrl}
              trackAccentHex={deckA.track.accentHex}
              roomGlowHex={activeRoom.glowHex}
              onInteractHotspot={(action) => {
                if (action === 'toggle_play') {
                  const nextPlaying = !deckA.isPlaying;
                  setPlayingRoomId(nextPlaying ? activeRoom.id : null);
                  setDeckA((prev) => ({ ...prev, isPlaying: nextPlaying }));
                } else if (action === 'next_track') {
                  if (activeRoomTracks.length > 0) {
                    const currIdx = activeRoomTracks.findIndex((x) => x.id === deckA.track.id);
                    const nextTrack =
                      activeRoomTracks[(currIdx + 1) % activeRoomTracks.length] || activeRoomTracks[0];
                    void handlePushTrackLastWins(nextTrack);
                  }
                } else if (action === 'trigger_fx') {
                  handleTriggerFx(activeRoom.fxTrigger);
                } else if (action === 'open_dj') {
                  setShowAdvancedStudio(true);
                }
              }}
            />
          </motion.div>

          {/* ULTRA-MINIMAL BORDERLESS HOLOGRAPHIC CORNER CONTROLS (Changing rooms ONLY from Outer Menu) */}
          {!hudCollapsed ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.14 }}
                className="pointer-events-none absolute top-14 sm:top-4 inset-x-3 pt-[env(safe-area-inset-top)] z-30 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Exit to Outer 5-Room Menu (ONLY way to switch rooms) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isFullscreen) void handleToggleFullscreen();
                      setInside3DRoom(false);
                    }}
                    className="pointer-events-auto shrink-0 min-h-[36px] inline-flex items-center gap-1.5 rounded-full liquid-glass-capsule px-3 text-[11px] font-semibold text-[#F8FAFC]/95 hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Grid2x2 className="h-3.5 w-3.5 text-[#F5B942]" />
                    <span>{t('Outer Menu', 'منوی اتاق‌ها')}</span>
                  </button>

                  {/* Right Corner Actions: Music Picker + Bluetooth/Wi-Fi Pair + Nearby Scan + Fullscreen */}
                  <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-full liquid-glass-capsule p-1">
                    <button
                      type="button"
                      onClick={() => setShowMusicPicker(true)}
                      className="min-h-[30px] shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold text-[#06070C] cursor-pointer whitespace-nowrap"
                      style={{ backgroundColor: activeRoom.glowHex }}
                    >
                      <Music className="h-3.5 w-3.5" />
                      <span>{t('Music', 'انتخاب موسیقی')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPairModalTab('pair');
                        setShowPairModal(true);
                      }}
                      className="min-h-[30px] shrink-0 inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 px-2.5 text-[11px] font-semibold text-[#38BDF8] cursor-pointer whitespace-nowrap"
                    >
                      <Bluetooth className="h-3.5 w-3.5" />
                      <span>{t('Pair', 'اتصال دوستان')}</span>
                      <span className="rounded-full bg-[#38BDF8]/25 px-1.5 text-[9px] text-white">
                        {connectedPeers.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPairModalTab('scan');
                        setShowPairModal(true);
                      }}
                      title={t('Scan Nearby Rooms', 'اسکن اتاق اطراف')}
                      aria-label={t('Scan Nearby Rooms', 'اسکن اتاق اطراف')}
                      className="min-h-[30px] shrink-0 inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-white/20 px-2.5 text-[11px] font-semibold text-[#34D399] cursor-pointer whitespace-nowrap"
                    >
                      <Radar className="h-3.5 w-3.5" />
                      <span className="hidden xs:inline sm:inline">{t('Scan', 'اسکن')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleToggleFullscreen()}
                      title={t('Fullscreen', 'فول‌اسکرین')}
                      aria-label={t('Fullscreen', 'فول‌اسکرین')}
                      className="h-[30px] w-[30px] shrink-0 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                    >
                      {isFullscreen ? (
                        <Minimize2 className="h-3.5 w-3.5 text-[#F5B942]" />
                      ) : (
                        <Maximize2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Live Attribution Strip: Last-Added Track & Connected Devices */}
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#060810]/70 backdrop-blur-md border border-white/12 px-2.5 py-1 text-[10px] text-[#E2E8F0] max-w-[78vw] truncate">
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0 animate-pulse"
                      style={{ backgroundColor: activeRoom.glowHex }}
                    />
                    <span className="font-bold text-white shrink-0">
                      {t(activeRoom.titleEn, activeRoom.titleFa)}
                    </span>
                    <span className="text-white/40">·</span>
                    <span className="truncate">
                      {lang === 'fa' ? deckA.track.titleFa : deckA.track.titleEn}
                    </span>
                    <span className="text-white/40">·</span>
                    <span className="text-[#34D399] shrink-0 flex items-center gap-1">
                      <Wifi className="h-2.5 w-2.5" />
                      {latestTrackDeviceName}
                    </span>
                  </div>

                  {roomNoticeFa && (
                    <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#34D399]/20 border border-[#34D399]/50 px-3 py-1 text-[10px] font-semibold text-[#A7F3D0] backdrop-blur-md">
                      {roomNoticeFa}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Bottom Ultra-Minimal Holographic Floating Controls (Zero Clipping) */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.22 }}
                className="pointer-events-none absolute bottom-5 sm:bottom-4 inset-x-3 z-30 flex justify-center"
              >
                <div className="pointer-events-auto max-w-[calc(100vw-24px)] flex items-center gap-1 overflow-x-auto no-scrollbar rounded-full liquid-glass-capsule px-2 py-1 shadow-[0_12px_36px_rgba(0,0,0,0.65)]">
                  <button
                    type="button"
                    onClick={() => {
                      const nextPlaying = !deckA.isPlaying;
                      setPlayingRoomId(nextPlaying ? activeRoom.id : null);
                      setDeckA((prev) => ({ ...prev, isPlaying: nextPlaying }));
                    }}
                    className="min-h-[34px] shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 text-[11px] font-bold text-[#06070C] cursor-pointer"
                    style={{ backgroundColor: activeRoom.glowHex }}
                  >
                    {deckA.isPlaying ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    <span>{deckA.isPlaying ? t('Pause', 'توقف') : t('Play', 'پخش')}</span>
                  </button>

                  {/* Camera Mode Switcher */}
                  {(
                    [
                      { id: 'cinematic', en: 'Free', fa: 'آزاد' },
                      { id: 'first_person', en: '1st Person', fa: 'اول‌شخص' },
                      { id: 'stage_closeup', en: 'Close-Up', fa: 'نمای نزدیک' }
                    ] as const
                  ).map((cam) => {
                    const active = cameraPreset === cam.id;
                    return (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => setCameraPreset(cam.id)}
                        className={`min-h-[32px] shrink-0 rounded-full px-2.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'bg-white/90 text-[#06070C]'
                            : 'text-[#F8FAFC]/80 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {t(cam.en, cam.fa)}
                      </button>
                    );
                  })}

                  {cameraPreset === 'first_person' && (
                    <button
                      type="button"
                      onClick={triggerPlayerJump}
                      aria-label={t('Jump', 'پرش')}
                      className="min-h-[32px] shrink-0 inline-flex items-center gap-1 rounded-full bg-white/12 px-2.5 text-[11px] font-semibold text-white active:bg-[#F5B942] active:text-[#06070C] cursor-pointer"
                    >
                      <ArrowUp className="h-3 w-3" />
                      <span>{t('Jump', 'پرش')}</span>
                    </button>
                  )}

                  {/* Holographic Icon Triggers */}
                  <button
                    type="button"
                    onClick={() => {
                      handleTriggerFx(activeRoom.fxTrigger);
                      const modes: RoomLightingFxMode[] = [
                        'natural_pt',
                        'neon_laser',
                        'golden_cinema',
                        'strobe_pulse'
                      ];
                      setLightingFxMode((curr) => modes[(modes.indexOf(curr) + 1) % modes.length]);
                    }}
                    title={t('Pulse FX', 'پالس افکت')}
                    aria-label={t('Pulse FX', 'پالس افکت')}
                    className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full text-[#F5B942] hover:bg-[#F5B942]/20 cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAdkLightingPanel((v) => !v)}
                    title={t('ADK Light', 'نور ADK')}
                    aria-label={t('ADK Light', 'نور ADK')}
                    className={`h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                      showAdkLightingPanel
                        ? 'bg-[#34D399] text-[#06070C]'
                        : 'text-[#34D399] hover:bg-[#34D399]/20'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedStudio((v) => !v)}
                    title={t('DJ Console', 'کنسول دی‌جی')}
                    aria-label={t('DJ Console', 'کنسول دی‌جی')}
                    className={`h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                      showAdvancedStudio
                        ? 'bg-[#00F0FF] text-[#06070C]'
                        : 'text-[#38BDF8] hover:bg-white/15'
                    }`}
                  >
                    <Sliders className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAdkLightingPanel(false);
                      setHudCollapsed(true);
                    }}
                    title={t('Clean View', 'خلوت کردن صحنه')}
                    aria-label={t('Clean View', 'خلوت کردن صحنه')}
                    className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full text-[#F8FAFC]/75 hover:text-white hover:bg-white/15 cursor-pointer"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>

              {/* Floating Frosted-Glass Google ADK Lighting Director Panel */}
              {showAdkLightingPanel && (
                <div className="pointer-events-none absolute bottom-16 inset-x-3 z-30 flex justify-center">
                  <div
                    dir={lang === 'fa' ? 'rtl' : 'ltr'}
                    className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/15 bg-[#070b14]/88 backdrop-blur-xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30">
                          <Wand2 className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#F5F7FA] truncate">
                            {t('ADK Lighting Director', 'کارگردان نور ADK')} ·{' '}
                            <span className="text-[#34D399]">
                              {lightingProfiles[activeRoom.id as CalibrationRoomId]?.presetNameFa ||
                                lightingProfiles[activeRoom.id as CalibrationRoomId]?.presetName}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleResetRoomLighting()}
                        disabled={adkLightingBusy}
                        className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-semibold text-[#CBD5E1] hover:text-white hover:bg-white/10 disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>{t('Reset', 'بازنشانی')}</span>
                      </button>
                    </div>

                    {/* Quick Physical Lighting Presets */}
                    {lightingPresets.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                        {lightingPresets.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            disabled={adkLightingBusy}
                            onClick={() => void handleApplyLightingPreset(preset.id)}
                            className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-[#E2E8F0] hover:border-[#34D399]/50 hover:bg-[#34D399]/15 hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            {lang === 'fa' ? preset.labelFa : preset.labelEn}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Natural-Language Instruction to @google/adk LlmAgent */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleRunAdkLightingTune();
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={adkLightingPrompt}
                        onChange={(e) => setAdkLightingPrompt(e.target.value)}
                        placeholder={t(
                          'e.g. Darker contrast with warm candle bounce...',
                          'مثلاً: سایه‌ها عمیق‌تر و نور پنجره طبیعی‌تر، لیزر هماهنگ با ریتم...'
                        )}
                        disabled={adkLightingBusy}
                        className="flex-1 min-w-0 rounded-xl border border-white/15 bg-[#04060c]/90 px-3 py-2 text-xs text-[#F5F7FA] placeholder:text-[#94A3B8]/70 focus:border-[#34D399] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={adkLightingBusy || !adkLightingPrompt.trim()}
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-[#34D399] px-3 py-2 text-xs font-bold text-[#06070C] hover:bg-[#4ade80] disabled:opacity-45 cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>
                          {adkLightingBusy
                            ? t('Tuning...', 'در حال تنظیم...')
                            : t('Tune', 'تنظیم')}
                        </span>
                      </button>
                    </form>

                    {adkLightingReply && !adkLightingError && (
                      <p className="text-[11px] leading-relaxed text-[#34D399]/95">
                        {adkLightingReply}
                      </p>
                    )}
                    {adkLightingError && (
                      <p className="text-[11px] leading-relaxed text-rose-400">
                        {adkLightingError}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Minimal Corner Pill when Clean Scene ("خلوت کردن صحنه") is active */
            <div className="pointer-events-none absolute top-16 sm:top-4 inset-x-3 z-30 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setInside3DRoom(false)}
                className="pointer-events-auto min-h-[32px] inline-flex items-center gap-1.5 rounded-full backdrop-blur-xl bg-[#070b14]/65 border border-white/15 px-3 text-[11px] font-semibold text-[#F5F7FA] hover:border-white/35 cursor-pointer"
              >
                <Grid2x2 className="h-3.5 w-3.5 text-[#F5B942]" />
                <span>{t('5 Rooms', '۵ اتاق')}</span>
              </button>

              <button
                type="button"
                onClick={() => setHudCollapsed(false)}
                className="pointer-events-auto min-h-[32px] inline-flex items-center gap-1.5 rounded-full backdrop-blur-xl bg-[#070b14]/65 border border-white/15 px-3 text-[11px] font-semibold text-[#F5F7FA] hover:border-white/35 cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5 text-[#00F0FF]" />
                <span>{t('Show HUD', 'نمایش کنترل‌ها')}</span>
              </button>
            </div>
          )}

          {/* Modals Mounted Inside roomViewportRef so they work inside Native Fullscreen too */}
          <RoomMusicPickerModal
            open={showMusicPicker}
            onClose={() => setShowMusicPicker(false)}
            lang={lang}
            roomId={activeRoom.id}
            roomGlowHex={activeRoom.glowHex}
            catalog={catalog}
            collections={collections}
            favoriteIds={favoriteIds}
            downloadsMap={downloadsMap}
            deviceTracks={deviceTracks}
            onAddDeviceTrack={(it) => setDeviceTracks((prev) => [it, ...prev])}
            onSelectTrackToPlay={(item, noteFa) => void handlePushTrackLastWins(item, noteFa)}
            activeTrackId={deckA.track.id}
            activeDeviceName={myDeviceName}
          />

          <RoomPairAndScanModal
            open={showPairModal}
            initialTab={pairModalTab}
            onClose={() => setShowPairModal(false)}
            lang={lang}
            roomId={activeRoom.id as RoomSyncId}
            roomGlowHex={activeRoom.glowHex}
            myDeviceName={myDeviceName}
            onChangeMyDeviceName={setMyDeviceName}
            peers={connectedPeers}
            onJoinPeerDevice={handleJoinPeerDevice}
            onTogglePeerRoute={handleTogglePeerRoute}
            onPullSyncedTrackFromNearby={handlePullSyncedTrackFromNearby}
            onExitToOuterMenu={() => {
              if (isFullscreen) void handleToggleFullscreen();
              setInside3DRoom(false);
            }}
            latestAddedByDevice={latestTrackDeviceName}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ====================================================================
             PRIMARY 5-ROOM SONIC STACK (Clicking any card enters First-Person 3D Game World)
             ==================================================================== */}
          <div className="mx-auto max-w-3xl space-y-3.5 sm:space-y-4">
            {SONIC_ROOMS.map((room, idx) => {
              const isHovered = hoveredRoomId === room.id;
              const isPlayingRoom = playingRoomId === room.id && deckA.isPlaying;
              const isSelected = selectedRoomId === room.id;
              const activePulse = isHovered || isPlayingRoom;
              const tiltX = pointerTilt.roomId === room.id ? pointerTilt.x : 0;
              const tiltY = pointerTilt.roomId === room.id ? pointerTilt.y : 0;

              return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 26, scale: 0.95, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 26,
                    delay: idx * 0.08
                  }}
                  onMouseEnter={() => {
                    setHoveredRoomId(room.id);
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
                    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
                    setPointerTilt({
                      roomId: room.id,
                      x: nx * (10 + room.pulseIntensity * 12),
                      y: -ny * (10 + room.pulseIntensity * 12)
                    });
                  }}
                  onMouseLeave={() => {
                    setHoveredRoomId((curr) => (curr === room.id ? null : curr));
                    setPointerTilt({ roomId: null, x: 0, y: 0 });
                  }}
                  onTouchStart={() => {
                    setHoveredRoomId(room.id);
                  }}
                  onClick={() => handleEnterRoom(room, 'cinematic')}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  style={{
                    boxShadow: activePulse
                      ? `0 24px 54px -14px rgba(0,0,0,0.9), 0 0 ${Math.round(
                          24 + room.pulseIntensity * 34
                        )}px -6px ${room.glowHex}66, inset 0 1px 0 rgba(255,255,255,0.28)`
                      : '0 18px 44px -14px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.16)'
                  }}
                  className="group spatial-portal-sheen relative overflow-hidden rounded-[28px] sm:rounded-[32px] px-4 py-4 sm:px-6 sm:py-5 cursor-pointer transition-all duration-300 backdrop-blur-2xl bg-black/35"
                >
                  {/* Full-Bleed Atmospheric Room Artwork */}
                  <img
                    src={room.imageUrl}
                    alt={t(room.titleEn, room.titleFa)}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-42 group-hover:opacity-58 transition-all duration-700 group-hover:scale-105"
                  />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `linear-gradient(105deg, rgba(6,7,12,0.88) 0%, rgba(10,12,20,0.52) 55%, rgba(6,7,12,0.72) 100%)`
                    }}
                  />
                  {/* Specular Hairline Glass Ring */}
                  <div
                    className={`pointer-events-none absolute inset-0 rounded-[28px] sm:rounded-[32px] transition-all ${
                      activePulse || isSelected
                        ? 'ring-1 ring-inset ring-white/35'
                        : 'ring-1 ring-inset ring-white/12 group-hover:ring-white/25'
                    }`}
                  />

                  {/* Ambient Bass-Reactive Background Pulse Wave when Hovered or Playing */}
                  <motion.div
                    animate={
                      activePulse
                        ? {
                            opacity: [0.16, 0.28 + room.pulseIntensity * 0.35, 0.16],
                            scale: [0.96, 1.04 + room.pulseIntensity * 0.08, 0.96]
                          }
                        : { opacity: 0.1, scale: 1 }
                    }
                    transition={{
                      duration: 60 / room.pulseBpm,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background: `radial-gradient(circle at 18% 50%, ${room.glowHex}55 0%, ${room.secondaryHex}22 42%, transparent 74%)`
                    }}
                  />

                  {/* Card Content Row */}
                  <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 text-start space-y-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Luminous LIVE • [User Count] Badge */}
                        <span className="holo-micro-badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-[#F8FAFC]">
                          <span
                            className="h-1.5 w-1.5 rounded-full animate-pulse"
                            style={{ backgroundColor: '#34D399', boxShadow: '0 0 8px #34D399' }}
                          />
                          <span dir="ltr" className="font-mono-tabular">
                            LIVE • {room.liveUsers}
                          </span>
                        </span>

                        <h2 className="text-xl sm:text-2xl font-bold text-[#F5F7FA] tracking-tight drop-shadow-sm">
                          {t(room.titleEn, room.titleFa)}
                        </h2>

                        {/* 3D Pulse Intensity Pill */}
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono-tabular font-semibold transition-all duration-200 ${
                            activePulse
                              ? 'opacity-100 translate-y-0'
                              : 'opacity-0 sm:group-hover:opacity-100 translate-y-0.5'
                          }`}
                          style={{
                            backgroundColor: `${room.glowHex}22`,
                            color: room.glowHex
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: room.glowHex }}
                          />
                          <span>{t(room.bassWeightLabelEn, room.bassWeightLabelFa)}</span>
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-[#E2E8F0]/90 leading-relaxed flex items-center gap-1.5 flex-wrap">
                        {room.hasLiveSignalIcon && (
                          <Radio
                            className="h-4 w-4 shrink-0"
                            style={{ color: room.glowHex }}
                          />
                        )}
                        <span>{t(room.subtitleEn, room.subtitleFa)}</span>
                      </p>

                      {/* Glowing Holographic Liquid-Glass Enter CTA */}
                      <div className="pt-0.5 flex flex-wrap items-center gap-2.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full liquid-glass-capsule px-3.5 py-1.5 text-[11px] font-bold text-[#F8FAFC] group-hover:brightness-110 transition-all"
                          style={{
                            borderColor: `${room.glowHex}66`,
                            boxShadow: `0 6px 20px -6px ${room.glowHex}66, inset 0 1px 0 rgba(255,255,255,0.28)`
                          }}
                        >
                          <Footprints className="h-3.5 w-3.5" style={{ color: room.glowHex }} />
                          <span>{t('Enter 3D Room', 'وارد اتاق سه‌بعدی شوید')}</span>
                        </span>

                        <div className="hidden sm:flex items-center gap-2 min-w-[140px]">
                          <div className="flex-1 h-1 rounded-full bg-white/12 overflow-hidden">
                            <motion.div
                              animate={
                                activePulse
                                  ? {
                                      width: [
                                        `${Math.round(room.pulseIntensity * 65)}%`,
                                        `${Math.round(room.pulseIntensity * 100)}%`,
                                        `${Math.round(room.pulseIntensity * 65)}%`
                                      ]
                                    }
                                  : { width: `${Math.round(room.pulseIntensity * 55)}%` }
                              }
                              transition={{
                                duration: 60 / room.pulseBpm,
                                repeat: Infinity,
                                ease: 'easeInOut'
                              }}
                              className="h-full rounded-full"
                              style={{
                                background: `linear-gradient(90deg, ${room.glowHex}, ${room.secondaryHex})`
                              }}
                            />
                          </div>
                          <span dir="ltr" className="text-[10px] font-mono-tabular text-[#CBD5E1]/80">
                            {Math.round(room.pulseIntensity * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3D Circular Pulsing Orb */}
                    <ThreeDCircularRoomOrb
                      room={room}
                      isHovered={isHovered}
                      isPlayingRoom={isPlayingRoom}
                      tiltX={tiltX}
                      tiltY={tiltY}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================================================================
          ACTIVE ROOM LIVE STRIP (Liquid Glass Surface)
          ==================================================================== */}
      {!inside3DRoom && (
      <motion.div
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.36 }}
        className="mx-auto max-w-3xl rounded-[28px] liquid-glass-surface spatial-portal-sheen p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-11 w-11 rounded-full border-2 overflow-hidden shrink-0 flex items-center justify-center"
              style={{ borderColor: activeRoom.glowHex }}
            >
              <img
                src={deckA.track.posterUrl}
                alt={t(deckA.track.titleEn, deckA.track.titleFa)}
                className={`h-full w-full object-cover ${deckA.isPlaying ? 'animate-spin' : ''}`}
                style={{ animationDuration: '5s' }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold"
                  style={{ color: activeRoom.glowHex }}
                >
                  {t(activeRoom.titleEn, activeRoom.titleFa)}
                </span>
                <span className="text-[11px] text-[#A3AEC2]">·</span>
                <span dir="ltr" className="text-[11px] font-mono-tabular text-[#A3AEC2]">
                  {activeRoom.pulseBpm} BPM
                </span>
              </div>
              <p className="text-sm font-semibold text-[#F5F7FA] truncate">
                {t(deckA.track.titleEn, deckA.track.titleFa)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!inside3DRoom && (
              <button
                type="button"
                onClick={() => handleEnterRoom(activeRoom)}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full px-4 text-xs font-bold text-[#06070C] cursor-pointer"
                style={{ backgroundColor: activeRoom.glowHex }}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{t('Enter 3D Room World', 'ورود به فضای سه‌بعدی این اتاق')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const nextPlaying = !deckA.isPlaying;
                setPlayingRoomId(nextPlaying ? activeRoom.id : null);
                setDeckA((prev) => ({ ...prev, isPlaying: nextPlaying }));
              }}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 text-xs font-bold text-[#F5F7FA] cursor-pointer"
            >
              {deckA.isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
              <span>
                {deckA.isPlaying
                  ? t('Pause Room', 'توقف پخش اتاق')
                  : t('Play Room Pulse', 'پخش زنده اتاق')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onPlayTrack(deckA.track)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3.5 text-xs font-medium text-[#F5F7FA] hover:bg-white/[0.1] cursor-pointer"
            >
              <Headphones className="h-3.5 w-3.5 text-[#F5B942]" />
              <span>{t('Full Player', 'پلیر کامل')}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedStudio((v) => !v)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full border border-[#F5B942]/45 bg-[#F5B942]/12 px-3.5 text-xs font-semibold text-[#F5B942] hover:bg-[#F5B942]/20 cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>
                {showAdvancedStudio
                  ? t('Hide DJ & Playlist Studio', 'بستن میز دی‌جی و پلی‌لیست')
                  : t('DJ Mixer & Playlist Studio', 'میز دی‌جی (DG) و شخصی‌سازی پلی‌لیست')}
              </span>
              {showAdvancedStudio ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Track Pills inside Active Room */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          {activeRoomTracks.map((tr) => {
            const active = deckA.track.id === tr.id;
            return (
              <button
                key={tr.id}
                type="button"
                onClick={() => {
                  setPlayingRoomId(activeRoom.id);
                  setDeckA((prev) => ({
                    ...prev,
                    track: tr,
                    currentTimeSec: 0,
                    isPlaying: true
                  }));
                }}
                className={`min-h-[36px] shrink-0 inline-flex items-center gap-2 rounded-full border px-3.5 text-xs transition-colors cursor-pointer ${
                  active
                    ? 'border-[#F5B942] bg-[#F5B942]/18 text-[#F5F7FA] font-semibold'
                    : 'border-white/10 bg-[#06070C] text-[#A3AEC2] hover:text-white'
                }`}
              >
                <img
                  src={tr.posterUrl}
                  alt={t(tr.titleEn, tr.titleFa)}
                  className="h-5 w-5 rounded-full object-cover"
                />
                <span>{t(tr.titleEn, tr.titleFa)}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
      )}

      {/* ====================================================================
          EXPANDABLE DUAL-DECK DJ CONSOLE & SMART PLAYLIST PERSONALIZER
          ==================================================================== */}
      <AnimatePresence>
        {showAdvancedStudio && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="space-y-6 pt-2"
          >
            {/* Segmented Mode Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] liquid-glass-surface p-4 sm:p-5">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-bold text-[#F5F7FA]">
                  {t(
                    'Dual-Deck DJ Mixer & Smart Playlist Personalizer',
                    'میز دی‌جی دوگانه (امکانات DG) و مهندسی پلی‌لیست شخصی'
                  )}
                </h2>
                <p className="text-xs text-[#CBD5E1]/75">
                  {t(
                    'Mix any two tracks with 3-band EQ, BPM sync, live FX pads, or customize your 6D playlist.',
                    'میکس هم‌زمان دو اثر صوتی با اکولایزر ۳بانده، تطبیق خودکار BPM، افکت‌های زنده و ساخت پلی‌لیست هوشمند.'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5 rounded-full liquid-glass-capsule p-1.5">
                <button
                  type="button"
                  onClick={() => setStudioTab('dj_console')}
                  className={`min-h-[38px] inline-flex items-center gap-2 rounded-full px-3.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    studioTab === 'dj_console'
                      ? 'liquid-glass-cta-gold font-bold'
                      : 'text-[#CBD5E1] hover:text-white'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>{t('Dual-Deck DJ Console', 'کنسول دی‌جی (امکانات DG)')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStudioTab('playlist_studio')}
                  className={`min-h-[38px] inline-flex items-center gap-2 rounded-full px-3.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    studioTab === 'playlist_studio'
                      ? 'bg-[#00F0FF] text-[#06070C] font-bold'
                      : 'text-[#CBD5E1] hover:text-white'
                  }`}
                >
                  <ListMusic className="h-3.5 w-3.5" />
                  <span>{t('Playlist Personalizer', 'شخصی‌سازی پلی‌لیست')}</span>
                </button>
              </div>
            </div>

            {studioTab === 'dj_console' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {renderDeckCard('A', deckA, setDeckA, canvasARef, '#00F0FF')}
                  {renderDeckCard('B', deckB, setDeckB, canvasBRef, '#F5B942')}
                </div>

                {/* Center Master Crossfader & Live FX Trigger Console */}
                <div className="rounded-[28px] liquid-glass-surface p-5 sm:p-6 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-7 space-y-2.5 rounded-2xl border border-white/10 bg-[#06070C] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#00F0FF]">
                          ◀ DECK A ({Math.round((1 - (crossfader + 1) * 0.5) * 100)}%)
                        </span>
                        <button
                          type="button"
                          onClick={handleAutoCrossfade}
                          className="min-h-[34px] inline-flex items-center gap-1.5 rounded-xl border border-[#F5B942]/45 bg-[#F5B942]/15 px-3 text-xs font-semibold text-[#F5B942] hover:bg-[#F5B942]/25 transition-colors cursor-pointer"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          <span>
                            {autoTransitioning
                              ? t('Crossfading...', 'در حال میکس خودکار...')
                              : t('Auto DJ Transition', 'ترنزیشن هوشمند دی‌جی')}
                          </span>
                        </button>
                        <span className="text-xs font-semibold text-[#F5B942]">
                          DECK B ({Math.round((crossfader + 1) * 0.5 * 100)}%) ▶
                        </span>
                      </div>

                      <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.02}
                        value={crossfader}
                        onChange={(e) => setCrossfader(Number(e.target.value))}
                        aria-label="Master Crossfader Deck A to Deck B"
                        className="w-full aether-slider"
                      />

                      <div className="flex items-center justify-between text-[11px] text-[#A3AEC2]">
                        <button
                          type="button"
                          onClick={() => setCrossfader(-1)}
                          className="hover:text-white cursor-pointer"
                        >
                          {t('Full Deck A', 'فقط دک A')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCrossfader(0)}
                          className="hover:text-white cursor-pointer"
                        >
                          {t('Center 50/50 Mix', 'میکس وسط ۵۰/۵۰')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCrossfader(1)}
                          className="hover:text-white cursor-pointer"
                        >
                          {t('Full Deck B', 'فقط دک B')}
                        </button>
                      </div>
                    </div>

                    <div className="lg:col-span-5 flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-[#06070C] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setMasterMuted((m) => !m)}
                          className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-xs text-[#F5F7FA] cursor-pointer"
                        >
                          {masterMuted ? (
                            <VolumeX className="h-4 w-4 text-[#EF4444]" />
                          ) : (
                            <Volume2 className="h-4 w-4 text-[#00F0FF]" />
                          )}
                          <span>{t('Master Out', 'خروجی مستر')}</span>
                        </button>

                        <Button
                          size="sm"
                          onClick={() => {
                            const mixName = `${t('DJ Live Mix:', 'میکس دی‌جی:')} ${t(
                              deckA.track.titleEn,
                              deckA.track.titleFa
                            )} × ${t(deckB.track.titleEn, deckB.track.titleFa)}`;
                            onCreatePlaylist({
                              name: mixName,
                              descriptionFa: 'ذخیره‌شده از میز دی‌جی دوگانه',
                              descriptionEn: 'Saved from Dual-Deck DJ Console',
                              accentHex: '#00F0FF',
                              moodTagFa: `${Math.round(
                                (deckA.track.bpm || 110) * deckA.pitchRate
                              )} BPM DJ Set`,
                              moodTagEn: `${Math.round(
                                (deckA.track.bpm || 110) * deckA.pitchRate
                              )} BPM DJ Set`,
                              itemIds: [deckA.track.id, deckB.track.id]
                            });
                          }}
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                          <span>{t('Save DJ Mix to Playlist', 'ذخیره میکس در پلی‌لیست')}</span>
                        </Button>
                      </div>

                      <p className="text-[11px] text-[#A3AEC2]">
                        {t(
                          'Tip: Tap any FX Pad below to inject live synthesized risers, sub drops, or vinyl scratches.',
                          'نکته: با لمس پدهای افکت زیر، رایزر نئونی، دراپ بیس یا اسکرچ زنده به میکس اضافه کنید.'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* 6 Live Sound FX Pads */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#E2E8F0] inline-flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-[#F5B942]" />
                        {t('Live DJ Sound FX Pads', 'پدهای افکت صوتی زنده دی‌جی (FX Pads)')}
                      </span>
                      <span className="text-[11px] text-[#A3AEC2]">
                        {t('Real-Time Web Audio Synthesizer', 'موتور سنتز زنده وب‌اودیو')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      {FX_PADS.map((pad) => {
                        const active = activeFxId === pad.id;
                        return (
                          <button
                            key={pad.id}
                            type="button"
                            onClick={() => handleTriggerFx(pad.id)}
                            className="min-h-[68px] rounded-2xl border p-3 text-start transition-all cursor-pointer flex flex-col justify-between"
                            style={{
                              borderColor: active ? pad.accent : 'rgba(255,255,255,0.12)',
                              backgroundColor: active ? `${pad.accent}28` : '#06070C',
                              boxShadow: active ? `0 0 24px ${pad.accent}55` : undefined
                            }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: pad.accent }}
                              />
                              <span className="text-[10px] font-mono-tabular text-[#A3AEC2]">
                                FX
                              </span>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#F5F7FA]">
                                {t(pad.labelEn, pad.labelFa)}
                              </p>
                              <p className="text-[10px] text-[#A3AEC2]">
                                {t(pad.subEn, pad.subFa)}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ====================================================================
                 SMART PLAYLIST PERSONALIZER & CUSTOM PLAYLIST EDITOR
                 ==================================================================== */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 rounded-[28px] liquid-glass-surface p-5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-[#00F0FF] inline-flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        {t('AI 6D Playlist Generator', 'موتور هوشمند شخصی‌سازی پلی‌لیست')}
                      </span>
                      <h3 className="text-lg font-bold text-[#F5F7FA]">
                        {t(
                          'Tune Mood, Tempo & Domain to Generate Your Playlist',
                          'تنظیم حال‌وهوا، انرژی و قلمرو برای ساخت پلی‌لیست اختصاصی'
                        )}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {(
                      [
                        { id: 'all_audio', en: 'All Audio', fa: 'همه آثار صوتی', icon: <Headphones className="h-3.5 w-3.5" /> },
                        { id: 'music', en: 'Music Only', fa: 'فقط موسیقی', icon: <Music className="h-3.5 w-3.5" /> },
                        { id: 'podcast', en: 'Podcasts', fa: 'فقط پادکست', icon: <Mic className="h-3.5 w-3.5" /> },
                        { id: 'audiobook', en: 'Audiobooks', fa: 'فقط کتاب صوتی', icon: <Radio className="h-3.5 w-3.5" /> }
                      ] as const
                    ).map((tab) => {
                      const active = playlistRealm === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setPlaylistRealm(tab.id)}
                          className={`min-h-[38px] shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 text-xs font-medium border transition-colors cursor-pointer ${
                            active
                              ? 'border-[#00F0FF] bg-[#00F0FF] text-[#06070C] font-semibold'
                              : 'border-white/12 bg-[#06070C] text-[#A3AEC2] hover:text-white'
                          }`}
                        >
                          {tab.icon}
                          <span>{t(tab.en, tab.fa)}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-[#06070C] p-4">
                    {[
                      {
                        labelEn: 'Energy & BPM Pace',
                        labelFa: 'انرژی و سرعت ریتم (BPM)',
                        val: energySlider,
                        setVal: setEnergySlider
                      },
                      {
                        labelEn: 'Nocturnal & Late-Night Vibe',
                        labelFa: 'اتمسفر شبانه و نئونی',
                        val: nocturnalSlider,
                        setVal: setNocturnalSlider
                      },
                      {
                        labelEn: 'Vocal Warmth & Intimacy',
                        labelFa: 'گرمای کلام و صمیمیت',
                        val: vocalSlider,
                        setVal: setVocalSlider
                      },
                      {
                        labelEn: 'Philosophical Depth & Mystery',
                        labelFa: 'عمق معنایی و رازآلودگی',
                        val: depthSlider,
                        setVal: setDepthSlider
                      }
                    ].map((s) => (
                      <div key={s.labelEn} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#CBD5E1]">{t(s.labelEn, s.labelFa)}</span>
                          <span dir="ltr" className="font-mono-tabular font-semibold text-[#F5B942]">
                            {s.val}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          value={s.val}
                          onChange={(e) => s.setVal(Number(e.target.value))}
                          className="w-full aether-slider"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-white/10 bg-[#06070C] p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        placeholder={t(
                          'Custom Playlist Name (e.g. Midnight Cyber Mix)...',
                          'نام پلی‌لیست سفارشی (مثلاً: میکس نیمه‌شب تهران)...'
                        )}
                        className="min-h-[42px] rounded-xl border border-white/12 bg-[#0D101A] px-3.5 text-base sm:text-xs text-[#F5F7FA]"
                      />
                      <input
                        type="text"
                        value={newPlaylistDesc}
                        onChange={(e) => setNewPlaylistDesc(e.target.value)}
                        placeholder={t(
                          'Mood note or description...',
                          'توضیح کوتاه یا حال‌وهوای پلی‌لیست...'
                        )}
                        className="min-h-[42px] rounded-xl border border-white/12 bg-[#0D101A] px-3.5 text-base sm:text-xs text-[#F5F7FA]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#A3AEC2]">
                          {t('Cover Accent:', 'رنگ تم پلی‌لیست:')}
                        </span>
                        {PLAYLIST_ACCENTS.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => setNewPlaylistAccent(hex)}
                            className="h-6 w-6 rounded-full border-2 flex items-center justify-center cursor-pointer"
                            style={{
                              backgroundColor: hex,
                              borderColor: newPlaylistAccent === hex ? '#FFFFFF' : 'transparent'
                            }}
                          >
                            {newPlaylistAccent === hex && <Check className="h-3 w-3 text-[#06070C]" />}
                          </button>
                        ))}
                      </div>

                      <Button onClick={handleSaveSmartPlaylist}>
                        <Plus className="h-4 w-4" />
                        <span>
                          {t(
                            `Save Smart Playlist (${smartGeneratedTracks.length} Tracks)`,
                            `ذخیره پلی‌لیست هوشمند (${smartGeneratedTracks.length} اثر)`
                          )}
                        </span>
                      </Button>
                    </div>
                  </div>

                  {/* Preview of Smart-Matched Tracks */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-semibold text-[#A3AEC2]">
                      {t(
                        'Live Matched Tracks for Your Sliders:',
                        'قطعات پیشنهادشده لحظه‌ای بر اساس اسلایدرهای شما:'
                      )}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {smartGeneratedTracks.map(({ item, matchPct }) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2.5 rounded-2xl border border-white/10 bg-[#06070C]/90 p-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={item.posterUrl}
                              alt={t(item.titleEn, item.titleFa)}
                              className="h-11 w-11 rounded-xl object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#F5F7FA] truncate">
                                {t(item.titleEn, item.titleFa)}
                              </p>
                              <p dir="ltr" className="text-[10px] font-mono-tabular text-[#00F0FF]">
                                {matchPct}% MATCH · {item.bpm || 100} BPM
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setDeckA((prev) => ({
                                  ...prev,
                                  track: item,
                                  currentTimeSec: 0,
                                  isPlaying: true
                                }));
                                setStudioTab('dj_console');
                              }}
                              title={t('Load in Deck A', 'بارگذاری در دک A')}
                              className="min-h-[32px] rounded-lg border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-2 text-[10px] font-bold text-[#00F0FF] hover:bg-[#00F0FF]/20 cursor-pointer"
                            >
                              +A
                            </button>
                            <button
                              type="button"
                              onClick={() => onPlayTrack(item)}
                              aria-label="Play"
                              className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg bg-[#F5B942] text-[#06070C] cursor-pointer"
                            >
                              <Play className="h-3.5 w-3.5 fill-current" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Saved Playlists Manager */}
                <div className="lg:col-span-5 rounded-[28px] liquid-glass-surface p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-[#F5B942]">
                        {t('Your Saved Playlists', 'پلی‌لیست‌های ذخیره‌شده شما')}
                      </span>
                      <h3 className="text-lg font-bold text-[#F5F7FA]">
                        {t('Edit, Reorder & Add Tracks', 'مدیریت، تغییر ترتیب و افزودن اثر')}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    {collections.map((col) => {
                      const active = activeCollection?.id === col.id;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setSelectedPlaylistId(col.id)}
                          className={`min-h-[38px] shrink-0 inline-flex items-center gap-2 rounded-full px-3.5 text-xs font-semibold border transition-colors cursor-pointer ${
                            active
                              ? 'border-[#F5B942] bg-[#F5B942] text-[#06070C]'
                              : 'border-white/12 bg-[#06070C] text-[#A3AEC2] hover:text-white'
                          }`}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: col.accentHex || '#F5B942' }}
                          />
                          <span>{col.name}</span>
                          <span dir="ltr" className="text-[10px] opacity-80">
                            ({col.itemIds.length})
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {activeCollection ? (
                    <div className="space-y-4">
                      <div
                        className="rounded-2xl border p-4 space-y-2"
                        style={{
                          borderColor: `${activeCollection.accentHex || '#F5B942'}55`,
                          backgroundColor: '#06070C'
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-[#F5F7FA]">
                              {activeCollection.name}
                            </h4>
                            {(activeCollection.descriptionFa || activeCollection.descriptionEn) && (
                              <p className="text-xs text-[#A3AEC2]">
                                {t(
                                  activeCollection.descriptionEn || activeCollection.descriptionFa || '',
                                  activeCollection.descriptionFa || activeCollection.descriptionEn || ''
                                )}
                              </p>
                            )}
                          </div>
                          {collections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onDeletePlaylist(activeCollection.id)}
                              className="text-xs text-[#FCA5A5] hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>{t('Delete', 'حذف')}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {activeCollection.itemIds.length === 0 ? (
                          <p className="text-xs text-[#A3AEC2] py-4 text-center">
                            {t(
                              'This playlist is empty. Add tracks from the catalog below.',
                              'این پلی‌لیست خالی است. از فهرست پایین آثار دلخواه را اضافه کنید.'
                            )}
                          </p>
                        ) : (
                          activeCollection.itemIds.map((id, idx) => {
                            const item = catalog.find((c) => c.id === id);
                            if (!item) return null;
                            return (
                              <div
                                key={`${activeCollection.id}-${id}`}
                                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#06070C] p-2.5"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    dir="ltr"
                                    className="w-5 text-center text-[11px] font-mono-tabular text-[#A3AEC2]"
                                  >
                                    {idx + 1}
                                  </span>
                                  <img
                                    src={item.posterUrl}
                                    alt={t(item.titleEn, item.titleFa)}
                                    className="h-10 w-10 rounded-lg object-cover shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-[#F5F7FA] truncate">
                                      {t(item.titleEn, item.titleFa)}
                                    </p>
                                    <p dir="ltr" className="text-[10px] font-mono-tabular text-[#A3AEC2]">
                                      {formatDuration(item.durationSec)} · {item.bpm || 100} BPM
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveTrackInPlaylist(activeCollection, idx, -1)}
                                    disabled={idx === 0}
                                    aria-label="Move Up"
                                    className="min-h-[30px] min-w-[30px] inline-flex items-center justify-center rounded-lg border border-white/10 text-[#A3AEC2] hover:text-white disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveTrackInPlaylist(activeCollection, idx, 1)}
                                    disabled={idx === activeCollection.itemIds.length - 1}
                                    aria-label="Move Down"
                                    className="min-h-[30px] min-w-[30px] inline-flex items-center justify-center rounded-lg border border-white/10 text-[#A3AEC2] hover:text-white disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onPlayTrack(item)}
                                    aria-label="Play"
                                    className="min-h-[30px] min-w-[30px] inline-flex items-center justify-center rounded-lg bg-[#F5B942]/20 text-[#F5B942] hover:bg-[#F5B942]/30 cursor-pointer"
                                  >
                                    <Play className="h-3.5 w-3.5 fill-current" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTrackFromPlaylist(activeCollection, item.id)}
                                    aria-label="Remove"
                                    className="min-h-[30px] min-w-[30px] inline-flex items-center justify-center rounded-lg text-[#A3AEC2] hover:text-[#FCA5A5] cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <label className="block text-xs font-semibold text-[#A3AEC2]">
                          {t(
                            'Quick-Add Any Audio Track to This Playlist:',
                            'افزودن سریع موسیقی، پادکست یا کتاب صوتی به این پلی‌لیست:'
                          )}
                        </label>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            handleAddTrackToPlaylist(activeCollection, e.target.value);
                            e.target.value = '';
                          }}
                          className="w-full min-h-[40px] rounded-xl border border-white/12 bg-[#06070C] px-3 text-base sm:text-xs text-[#F5F7FA]"
                        >
                          <option value="" disabled>
                            {t('+ Select a track to add...', '+ انتخاب اثر برای افزودن به پلی‌لیست...')}
                          </option>
                          {audioTracks
                            .filter((tr) => !activeCollection.itemIds.includes(tr.id))
                            .map((tr) => (
                              <option key={tr.id} value={tr.id}>
                                {t(tr.titleEn, tr.titleFa)} ({formatDuration(tr.durationSec)})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
