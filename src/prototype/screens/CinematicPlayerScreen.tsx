import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Disc3,
  Download,
  Headphones,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  Subtitles,
  Volume2,
  VolumeX
} from 'lucide-react';
import type {
  DownloadRecord,
  PlaybackProgress,
  PrototypeMediaItem,
  SubtitleCue,
  SubtitleLang,
  UiLang
} from '../types';
import { CinemaPosterImage, formatDuration } from '../components/UiPrimitives';
import { formatBytes } from '../downloadEngine';
import { generateAiSyncedSubtitles, type AiSyncedSubtitleResult } from '../subtitleAiEngine';
import { useAutoTranslation } from '../i18n';

interface CinematicPlayerScreenProps {
  item: PrototypeMediaItem | null;
  catalog: PrototypeMediaItem[];
  lang: UiLang;
  playbackMode?: 'movie' | 'trailer';
  progress?: PlaybackProgress;
  isFavorite: boolean;
  isDownloaded?: boolean;
  downloadRecord?: DownloadRecord;
  defaultSubtitleLang: SubtitleLang;
  defaultSpeed: number;
  preferredQuality: string;
  reducedMotion?: boolean;
  onUpdateProgress: (
    contentId: string,
    positionSec: number,
    durationSec: number,
    completed?: boolean
  ) => void;
  onSelectItem: (item: PrototypeMediaItem) => void;
  onSwitchPlaybackMode?: (mode: 'movie' | 'trailer') => void;
  onDownloadItem?: (
    item: PrototypeMediaItem,
    saveAsFile?: boolean,
    selectedQuality?: { id: string; resolution: string; label: string; estimatedSizeMb: number }
  ) => void;
  onToggleFavorite: (itemOrId: any) => void;
  onBackToBrowse: () => void;
  onOpenLanguagePicker?: () => void;
  onOpenInDj?: (
    item?: PrototypeMediaItem,
    tab?: 'dj_console' | 'concert_stage' | 'cafe_room' | 'party_room' | 'library_room' | 'playlist_studio'
  ) => void;
}

export function CinematicPlayerScreen({
  item,
  lang,
  progress,
  isDownloaded,
  downloadRecord,
  defaultSubtitleLang,
  defaultSpeed,
  onUpdateProgress,
  onDownloadItem,
  onBackToBrowse,
  onOpenInDj
}: CinematicPlayerScreenProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(progress?.positionSec ?? 0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState<number>(defaultSpeed || 1);
  const [subLang, setSubLang] = useState<SubtitleLang>(defaultSubtitleLang || 'fa');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [aiSyncedSub, setAiSyncedSub] = useState<AiSyncedSubtitleResult | null>(null);

  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const effectiveDuration = item?.durationSec ?? 300;

  useEffect(() => {
    if (!item) return;
    setCurrentTime(progress?.positionSec ?? 0);
    setIsPlaying(true);
    const synced = generateAiSyncedSubtitles(item, 'fa', item.durationSec);
    setAiSyncedSub(synced);
  }, [item?.id]);

  // Playback timer
  useEffect(() => {
    if (!item || !isPlaying) return;
    const interval = window.setInterval(() => {
      setCurrentTime((prev: number) => {
        const next = prev + 0.25 * speed;
        if (next >= effectiveDuration) {
          setIsPlaying(false);
          onUpdateProgress(item.id, effectiveDuration, effectiveDuration, true);
          return effectiveDuration;
        }
        if (Math.floor(next) % 3 === 0) {
          onUpdateProgress(item.id, Math.floor(next), effectiveDuration, false);
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [item, isPlaying, speed, effectiveDuration, onUpdateProgress]);

  // Sonic Audio Visualizer Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !item) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const posterImg = new Image();
    posterImg.crossOrigin = 'anonymous';
    posterImg.src = item.posterUrl;

    let animId = 0;
    let phase = 0;

    const renderFrame = () => {
      phase += isPlaying ? 0.045 * speed : 0.004;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (posterImg.complete && posterImg.naturalWidth > 0) {
        const zoom = 1.05 + Math.sin(phase * 0.25) * 0.025;
        const sw = w * zoom;
        const sh = h * zoom;
        ctx.drawImage(posterImg, (w - sw) / 2, (h - sh) / 2, sw, sh);
      }

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(6, 7, 12, 0.45)');
      grad.addColorStop(0.55, 'rgba(6, 7, 12, 0.72)');
      grad.addColorStop(1, 'rgba(6, 7, 12, 0.96)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Draw Live Sonic Frequency Bars
      const barCount = 56;
      const totalWidth = w * 0.72;
      const startX = (w - totalWidth) / 2;
      const barW = totalWidth / barCount - 4;
      const baseY = h * 0.68;

      for (let i = 0; i < barCount; i++) {
        const wave =
          isPlaying && !muted
            ? Math.abs(Math.sin(phase * 1.8 + i * 0.28) * Math.cos(phase * 0.9 - i * 0.14))
            : 0.08;
        const barH = Math.max(6, wave * 130);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(245, 185, 66, 0.85)' : 'rgba(0, 240, 255, 0.75)';
        ctx.beginPath();
        ctx.roundRect(startX + i * (barW + 4), baseY - barH / 2, barW, barH, 3);
        ctx.fill();
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [item?.id, item?.posterUrl, isPlaying, speed, muted]);

  const toggleFullscreen = () => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const { t } = useAutoTranslation(lang);

  if (!item) {
    return (
      <div className="my-12 rounded-3xl border border-white/10 bg-[#0A0A0F] p-8 text-center max-w-lg mx-auto space-y-4">
        <p className="text-base font-semibold text-[#F8FAFC]">
          {t('No audio track selected', 'هنوز قطعه صوتی انتخاب نشده است')}
        </p>
        <button
          type="button"
          onClick={onBackToBrowse}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#F5B942] px-5 py-2.5 text-sm font-bold text-[#06070C] cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          <span>{t('Back to Sonic Universe', 'بازگشت به جهان صوتی')}</span>
        </button>
      </div>
    );
  }

  const title = t(item.titleEn, item.titleFa);
  const synopsis = t(item.synopsisEn, item.synopsisFa);
  const category = t(item.categoryEn, item.categoryFa);

  const activeCue: SubtitleCue | undefined = useMemo(() => {
    if (subLang === 'off') return undefined;
    const cuePool: SubtitleCue[] = aiSyncedSub?.cues ?? item.subtitles;
    return cuePool.find((c: SubtitleCue) => currentTime >= c.startSec && currentTime <= c.endSec);
  }, [subLang, currentTime, aiSyncedSub, item.subtitles]);

  const cycleSpeeds: number[] = [0.75, 1, 1.25, 1.5];

  return (
    <div className="max-w-5xl mx-auto space-y-7 pb-16">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-3.5">
        <button
          type="button"
          onClick={onBackToBrowse}
          className="min-h-[42px] inline-flex items-center gap-2.5 rounded-xl border border-white/12 bg-[#0A0A0F] px-4 py-2 text-sm font-bold text-[#F8FAFC] hover:border-[#F5B942] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-[#F5B942]" />
          <span className="truncate max-w-[260px] sm:max-w-md">{title}</span>
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-[#F5B942]/35 bg-[#0A0A0F] px-4 py-2 text-xs sm:text-sm font-bold text-[#F5B942] hover:bg-[#F5B942]/15 transition-colors cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          <span>{t('Fullscreen', 'تمام‌صفحه')}</span>
        </button>
      </header>

      {/* Master Audio Visualizer Stage */}
      <div
        ref={playerContainerRef}
        className="relative rounded-[28px] border border-[#F5B942]/35 bg-[#05060A] overflow-hidden shadow-[0_28px_90px_rgba(0,0,0,0.92)]"
      >
        <div className="relative aspect-video w-full bg-black overflow-hidden">
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            onClick={() => setIsPlaying((p) => !p)}
            className="h-full w-full object-cover cursor-pointer"
          />

          {/* Synchronized Lyrics / Transcript Overlay */}
          <AnimatePresence>
            {activeCue && subLang !== 'off' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="pointer-events-none absolute bottom-28 inset-x-4 z-20 flex justify-center"
              >
                <div className="max-w-2xl rounded-xl bg-black/80 backdrop-blur-md border border-[#F5B942]/30 px-5 py-2.5 text-center shadow-2xl">
                  <p className="text-sm sm:text-base font-medium text-[#F8FAFC] leading-relaxed">
                    {subLang === 'fa' ? activeCue.fa : activeCue.en}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Audio Playback Scrubber */}
          <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#05060A]/95 via-[#05060A]/75 to-transparent px-4 sm:px-6 pb-4 pt-10 space-y-3">
            <div className="flex items-center gap-3" dir="ltr">
              <span className="text-xs font-mono-tabular text-[#E2E8F0] min-w-[42px]">
                {formatDuration(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={effectiveDuration}
                step={1}
                value={Math.floor(currentTime)}
                onChange={(e) => setCurrentTime(Number(e.target.value))}
                className="flex-1 accent-[#F5B942] h-1.5 bg-white/20 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono-tabular text-[#94A3B8] min-w-[42px] text-right">
                {formatDuration(effectiveDuration)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/12 bg-[#0A0A0F]/85 backdrop-blur-xl px-3.5 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="min-h-[38px] inline-flex items-center gap-2 rounded-xl bg-[#F5B942] px-4 py-1.5 text-xs sm:text-sm font-black text-[#06070C] hover:bg-[#F7C762] transition-colors cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4 fill-current" />
                      <span>{t('Pause', 'توقف')}</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" />
                      <span>{t('Play', 'پخش')}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#E2E8F0] hover:text-white cursor-pointer"
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-4 w-4 text-[#F87171]" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-[#F5B942]" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSubLang((prev) => (prev === 'fa' ? 'en' : prev === 'en' ? 'off' : 'fa'))
                  }
                  className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                    subLang !== 'off'
                      ? 'border-[#F5B942]/50 bg-[#F5B942]/15 text-[#F5B942]'
                      : 'border-white/10 bg-white/[0.04] text-[#94A3B8]'
                  }`}
                >
                  <Subtitles className="h-3.5 w-3.5" />
                  <span>
                    {subLang === 'fa'
                      ? t('Lyrics FA', 'متن فارسی')
                      : subLang === 'en'
                        ? 'Lyrics EN'
                        : t('Lyrics Off', 'متن خاموش')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = (cycleSpeeds.indexOf(speed) + 1) % cycleSpeeds.length;
                    setSpeed(cycleSpeeds[nextIdx]);
                  }}
                  dir="ltr"
                  className="min-h-[36px] rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1 text-xs font-bold text-[#F8FAFC] font-mono-tabular hover:border-[#F5B942] cursor-pointer"
                >
                  {speed}x
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Track Metadata & Actions */}
      <section className="rounded-[28px] border border-[#F5B942]/30 bg-gradient-to-b from-[#0E111B] to-[#090B12] p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.75)] space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-[#F8FAFC]">{title}</h1>
              {item.bpm && (
                <span
                  dir="ltr"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#00F0FF]/15 border border-[#00F0FF]/40 px-3 py-1 text-xs font-black text-[#00F0FF] font-mono-tabular"
                >
                  <Radio className="h-3.5 w-3.5" />
                  {item.bpm} BPM {item.musicalKey ? `· ${item.musicalKey}` : ''}
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-[#94A3B8]">
              {category} ·{' '}
              <span dir="ltr" className="font-mono-tabular text-[#F5B942]">
                {item.audioSpec || 'Lossless 24-Bit / 192kHz'}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onOpenInDj && (
              <button
                type="button"
                onClick={() => onOpenInDj(item, 'dj_console')}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[#00F0FF]/45 bg-[#00F0FF]/12 px-4 py-2 text-xs sm:text-sm font-bold text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-colors cursor-pointer"
              >
                <Disc3 className="h-4 w-4" />
                <span>{t('Open in 3D Sonic Rooms', 'ورود به اتاق‌های صوتی ۳بعدی')}</span>
              </button>
            )}

            {onDownloadItem && (
              <button
                type="button"
                onClick={() => onDownloadItem(item, true)}
                className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs sm:text-sm font-black transition-all cursor-pointer ${
                  isDownloaded
                    ? 'border border-[#10B981]/50 bg-[#10B981]/15 text-[#34D399]'
                    : 'bg-gradient-to-r from-[#F5B942] to-[#C98A1C] text-[#06070C]'
                }`}
              >
                {isDownloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                <span>
                  {isDownloaded
                    ? t(
                        `Saved Offline (${downloadRecord ? formatBytes(downloadRecord.fileSizeBytes) : 'Ready'})`,
                        'ذخیره‌شده در آرشیو آفلاین'
                      )
                    : t('Download Offline Audio', 'دانلود فایل صوتی آفلاین')}
                </span>
              </button>
            )}
          </div>
        </div>

        <p className="text-sm sm:text-base text-[#E2E8F0] leading-relaxed">{synopsis}</p>

        {/* Cue Points / Audio Chapters */}
        {item.chapters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {item.chapters.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setCurrentTime(ch.timeSec)}
                className="min-h-[36px] rounded-xl border border-white/10 bg-[#121624] px-3.5 py-1.5 text-xs text-[#F8FAFC] hover:border-[#F5B942]/60 transition-colors cursor-pointer"
              >
                <span dir="ltr" className="font-mono-tabular text-[#F5B942] me-1.5">
                  {formatDuration(ch.timeSec)}
                </span>
                {t(ch.labelEn, ch.labelFa)}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
