import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Maximize2, Pause, Play } from 'lucide-react';
import type { PrototypeMediaItem, UiLang } from '../types';
import { useAutoTranslation } from '../i18n';
import { djAudioController } from '../djAudioEngine';

interface SpatialCommandCenterProps {
  item: PrototypeMediaItem | null;
  isPlaying: boolean;
  lang: UiLang;
  accentHex?: string;
  onTogglePlay: () => void;
  onOpenFullPlayer: () => void;
}

const BAR_COUNT = 10;

export function SpatialCommandCenter({
  item,
  isPlaying,
  lang,
  accentHex = '#F5B942',
  onTogglePlay,
  onOpenFullPlayer
}: SpatialCommandCenterProps) {
  const { t } = useAutoTranslation(lang);
  const [bars, setBars] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, (_, i) => 0.25 + ((i * 3) % 5) * 0.12)
  );

  useEffect(() => {
    if (!item || !isPlaying) {
      setBars(Array.from({ length: BAR_COUNT }, (_, i) => 0.22 + ((i * 2) % 4) * 0.1));
      return;
    }

    let rafId = 0;
    let lastTick = 0;
    const updateWave = (now: number) => {
      rafId = requestAnimationFrame(updateWave);
      if (document.hidden || now - lastTick < 65) return;
      lastTick = now;

      const spectrum = djAudioController.getDeckSpectrum('A');
      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        const specVal = spectrum ? spectrum[(i * 2) % spectrum.length] / 255 : 0;
        const syntheticWave = 0.42 + 0.36 * Math.sin(now * 0.008 + i * 0.85);
        return Math.max(0.18, Math.min(1, specVal > 0.05 ? specVal * 0.85 + 0.15 : syntheticWave));
      });
      setBars(next);
    };

    rafId = requestAnimationFrame(updateWave);
    return () => cancelAnimationFrame(rafId);
  }, [item, isPlaying]);

  if (!item) return null;

  const title = t(item.titleEn, item.titleFa);
  const artist = t(item.creatorEn || item.sourceName, item.creatorFa || item.sourceName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-30 w-[min(420px,calc(100vw-18px))]"
    >
      <div
        className="liquid-glass-capsule rounded-full px-2.5 py-1.5 flex items-center gap-2.5 shadow-[0_18px_42px_rgba(0,0,0,0.75)]"
        style={{
          borderColor: isPlaying ? `${accentHex}55` : undefined,
          boxShadow: isPlaying
            ? `0 16px 38px -10px rgba(0,0,0,0.85), 0 0 24px -8px ${accentHex}55, inset 0 1px 0 rgba(255,255,255,0.28)`
            : undefined
        }}
      >
        {/* Spinning Holographic Artwork Disc */}
        <button
          type="button"
          onClick={onOpenFullPlayer}
          aria-label={t('Open Full Player', 'باز کردن پخش‌کننده کامل')}
          className="relative h-10 w-10 shrink-0 rounded-full overflow-hidden border border-white/25 shadow-md cursor-pointer"
          style={{
            boxShadow: isPlaying ? `0 0 14px ${accentHex}66` : undefined
          }}
        >
          <img
            src={item.posterUrl}
            alt={title}
            className={`h-full w-full object-cover ${isPlaying ? 'animate-spin' : ''}`}
            style={{ animationDuration: '6s' }}
          />
          <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/25" />
          <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-[#06070C]/85 border border-white/40" />
        </button>

        {/* Track Title & Artist */}
        <button
          type="button"
          onClick={onOpenFullPlayer}
          className="min-w-0 flex-1 text-start cursor-pointer py-0.5"
        >
          <p className="text-xs font-bold text-[#F8FAFC] truncate leading-tight">{title}</p>
          <p className="text-[10px] text-[#CBD5E1]/80 truncate leading-tight">
            {artist} {item.bpm ? `· ${item.bpm} BPM` : ''}
          </p>
        </button>

        {/* Kinetic Equalizer Waveform */}
        <div
          aria-hidden="true"
          onClick={onOpenFullPlayer}
          className="hidden xs:flex sm:flex items-center gap-[2px] h-5 px-1 cursor-pointer shrink-0"
        >
          {bars.map((amp, idx) => (
            <span
              key={idx}
              className="w-[2.5px] rounded-full transition-[height] duration-75"
              style={{
                height: `${Math.round(4 + amp * 14)}px`,
                backgroundColor: isPlaying ? accentHex : 'rgba(226, 232, 240, 0.35)'
              }}
            />
          ))}
        </div>

        {/* Expand to Full Player Button */}
        <button
          type="button"
          onClick={onOpenFullPlayer}
          aria-label={t('Expand Player', 'نمای کامل پخش‌کننده')}
          className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full text-[#CBD5E1] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>

        {/* Miniature Liquid-Glass Play/Pause Button */}
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? t('Pause', 'توقف') : t('Play', 'پخش')}
          className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full text-[#06070C] shadow-md transition-transform active:scale-95 cursor-pointer"
          style={{
            background: `linear-gradient(135deg, #FEF3C7 0%, ${accentHex} 75%)`,
            boxShadow: `0 4px 16px ${accentHex}66`
          }}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current ms-0.5" />
          )}
        </button>
      </div>
    </motion.div>
  );
}
