import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Bookmark,
  BookOpen,
  Check,
  Clock,
  Disc3,
  Download,
  Headphones,
  Mic,
  Music,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  ThumbsUp,
  X
} from 'lucide-react';
import type {
  DownloadRecord,
  PlaybackProgress,
  PrototypeMediaItem,
  SystemSimulateState,
  ToastMessage,
  UiLang
} from '../types';
import { inferMediaDomain } from '../prototypeData';
import { useAutoTranslation } from '../i18n';

export type { ToastMessage };

export function formatDuration(seconds: number, _lang?: UiLang): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface CinemaPosterImageProps {
  src?: string;
  item?: PrototypeMediaItem;
  title?: string;
  subtitle?: string;
  year?: number | string;
  quality?: string;
  className?: string;
  imgClassName?: string;
  loading?: 'lazy' | 'eager';
}

export function CinemaPosterImage({
  src,
  item,
  title,
  subtitle,
  className = '',
  imgClassName = '',
  loading = 'lazy'
}: CinemaPosterImageProps) {
  const effectiveSrc = (src || item?.posterUrl || '').trim();
  const displayTitle = title || item?.titleFa || item?.titleEn || 'aipetros-sound';
  const displaySub = subtitle || item?.creatorFa || item?.categoryFa || 'Spatial Audio Master';

  const [imgFailed, setImgFailed] = useState(!effectiveSrc);

  const showFallback = !effectiveSrc || imgFailed;

  return (
    <div className={`relative overflow-hidden bg-[#0A0A0F] select-none ${className}`}>
      {!showFallback && (
        <img
          src={effectiveSrc}
          alt={displayTitle}
          loading={loading}
          onError={() => setImgFailed(true)}
          className={`h-full w-full object-cover ${imgClassName}`}
        />
      )}

      {showFallback && (
        <div className="relative h-full w-full flex flex-col items-center justify-between p-4 text-center bg-gradient-to-b from-[#171324] via-[#0C0E16] to-[#06070B] border border-[#F5B942]/35">
          <div className="w-full flex items-center justify-between text-[10px] font-mono-tabular tracking-widest text-[#F5B942]">
            <span>aipetros-sound</span>
            <span>{item?.bpm ? `${item.bpm} BPM` : '24-BIT'}</span>
          </div>

          <div className="my-auto flex flex-col items-center gap-2.5 px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#F5B942]/45 bg-[#F5B942]/12 shadow-[0_0_24px_rgba(245,185,66,0.28)]">
              <Disc3 className="h-6 w-6 text-[#F5B942]" />
            </div>
            <h4 className="font-bold text-sm sm:text-base text-[#F8FAFC] leading-snug line-clamp-3">
              {displayTitle}
            </h4>
            <p className="text-[11px] font-medium text-[#F5B942]/85 line-clamp-1">{displaySub}</p>
          </div>

          <div className="w-full pt-2 border-t border-[#F5B942]/20 flex items-center justify-center">
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#F5B942]/75 font-mono-tabular">
              SPATIAL SOUND ARCHIVE
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="rounded-[24px] liquid-glass-surface overflow-hidden animate-pulse"
    >
      <div className="aspect-[16/10] w-full bg-white/[0.06]" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-20 rounded-full bg-white/10" />
        <div className="h-5 w-3/4 rounded-full bg-white/15" />
        <div className="h-3 w-full rounded-full bg-white/10" />
      </div>
    </div>
  );
}

export function StateBoundary({
  state,
  lang,
  onResetState,
  children
}: {
  state: SystemSimulateState;
  lang: UiLang;
  onResetState: () => void;
  children: React.ReactNode;
}) {
  const { t } = useAutoTranslation(lang);

  if (state === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 py-6"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (state === 'error' || state === 'offline' || state === 'empty') {
    const isError = state === 'error';
    const isOffline = state === 'offline';
    return (
      <div
        role="alert"
        className="my-10 rounded-[28px] liquid-glass-surface p-8 text-center max-w-xl mx-auto space-y-4"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30">
          {isError ? <AlertTriangle className="h-6 w-6" /> : <RefreshCw className="h-6 w-6" />}
        </div>
        <h3 className="text-lg font-bold text-[#F5F7FA]">
          {isError
            ? t('Audio Stream Interrupted', 'اختلال موقت در ارتباط صوتی')
            : isOffline
              ? t('Offline Audio Mode Active', 'حالت آفلاین فعال است')
              : t('No Matching Audio Found', 'محتوای صوتی منطبق یافت نشد')}
        </h3>
        <button
          type="button"
          onClick={onResetState}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-full liquid-glass-cta-gold px-6 py-2.5 text-sm font-semibold cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          <span>{t('Restore Sonic Feed', 'بازگردانی به حالت عادی')}</span>
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | string;
}) {
  const styles: Record<string, string> = {
    primary: 'liquid-glass-cta-gold font-semibold',
    secondary:
      'liquid-glass-capsule text-[#F5F7FA] hover:border-[#F5B942]/50 hover:bg-white/[0.1]',
    ghost: 'text-[#CBD5E1] hover:text-[#F5F7FA] hover:bg-white/[0.08]',
    danger:
      'border border-[#F87171]/35 bg-[#F87171]/15 backdrop-blur-xl text-[#FCA5A5] hover:bg-[#F87171]/25 font-medium'
  };
  const sizeClass =
    size === 'sm' ? 'min-h-[36px] px-3.5 py-1.5 text-xs' : 'min-h-[42px] px-5 py-2 text-xs sm:text-sm';
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full transition-all cursor-pointer ${sizeClass} ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TextInput({
  label,
  error,
  className = '',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-[#CBD5E1]">{label}</label>}
      <input
        className={`w-full min-h-[44px] rounded-2xl liquid-glass-capsule px-4 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/70 focus:border-[#F5B942]/70 focus:outline-none ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-[#FCA5A5]">{error}</p>}
    </div>
  );
}

export interface MediaCardProps {
  item: PrototypeMediaItem;
  lang: UiLang;
  reasonFa?: string;
  reasonEn?: string;
  progress?: PlaybackProgress;
  isFavorite: boolean;
  isDownloaded?: boolean;
  downloadRecord?: DownloadRecord;
  feedback?: 'more' | 'less' | { sentiment?: string };
  onPlay: (item: PrototypeMediaItem) => void;
  onWatchTrailer?: (item: PrototypeMediaItem) => void;
  onDownload?: (item: PrototypeMediaItem, saveAsFile?: boolean) => void;
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onToggleFavorite: (item: any) => void;
  onFeedback: (item: any, type: any) => void;
  onHide: (item: PrototypeMediaItem) => void;
  onOpenInDj?: (item: PrototypeMediaItem) => void;
  compact?: boolean;
  index?: number;
}

export function MediaCard({
  item,
  lang,
  reasonFa,
  reasonEn,
  progress,
  isFavorite,
  isDownloaded,
  feedback,
  onPlay,
  onDownload,
  onOpenDetail,
  onToggleFavorite,
  onFeedback,
  onOpenInDj,
  index = 0
}: MediaCardProps) {
  const { t } = useAutoTranslation(lang);
  const title = t(item.titleEn, item.titleFa);
  const category = t(item.categoryEn, item.categoryFa);
  const creator = item.creatorFa ? t(item.creatorEn || item.creatorFa, item.creatorFa) : '';
  const reason = reasonEn || reasonFa ? t(reasonEn || reasonFa || '', reasonFa) : '';
  const domain = inferMediaDomain(item);

  const progressPct =
    progress && progress.durationSec > 0
      ? Math.min(100, Math.round((progress.positionSec / progress.durationSec) * 100))
      : 0;

  const DomainIcon =
    domain === 'podcast' ? Mic : domain === 'audiobook' ? BookOpen : Music;

  const domainLabel =
    domain === 'podcast'
      ? t('Podcast', 'پادکست')
      : domain === 'audiobook'
        ? t('Audiobook', 'کتاب صوتی')
        : t('Music', 'موسیقی');

  const accentHex = item.accentHex || '#F5B942';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 22, scale: 0.95, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.08 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{
        type: 'spring',
        stiffness: 320,
        damping: 26,
        delay: Math.min(index, 7) * 0.055
      }}
      className="group relative flex flex-col rounded-[26px] liquid-glass-surface spatial-portal-sheen overflow-hidden transition-all duration-300 hover:border-white/28"
    >
      {/* Subtle Ambient Aura Reflection behind card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -end-10 h-28 w-28 rounded-full blur-2xl opacity-25 group-hover:opacity-55 transition-opacity duration-500"
        style={{ backgroundColor: accentHex }}
      />

      {/* Audio Cover Artwork */}
      <div
        onClick={() => onOpenDetail(item)}
        className="relative aspect-[16/10] w-full overflow-hidden bg-black/40 cursor-pointer"
      >
        <CinemaPosterImage
          item={item}
          title={title}
          subtitle={category}
          className="h-full w-full"
          imgClassName="transition-transform duration-700 ease-out group-hover:scale-105"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080a12]/90 via-transparent to-black/25" />

        {/* Delicate Holographic Micro-Capsules (Zero bulky borders) */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1.5">
          <span className="holo-micro-badge inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-[#F8FAFC]/95">
            <DomainIcon className="h-3 w-3 text-[#F5B942]" />
            <span>{domainLabel}</span>
          </span>

          {item.bpm && (
            <span
              dir="ltr"
              className="holo-micro-badge rounded-full px-2 py-0.5 text-[10px] font-semibold text-[#38BDF8] font-mono-tabular"
            >
              {item.bpm} BPM {item.musicalKey ? `· ${item.musicalKey}` : ''}
            </span>
          )}
        </div>

        {/* Bottom Duration & Offline Micro-Tag */}
        <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between gap-2">
          <span
            dir="ltr"
            className="holo-micro-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono-tabular text-[#E2E8F0]"
          >
            <Clock className="h-2.5 w-2.5 text-[#F5B942]" />
            {formatDuration(item.durationSec, lang)}
          </span>

          {isDownloaded && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/25 backdrop-blur-md border border-[#34D399]/35 px-2 py-0.5 text-[10px] font-semibold text-[#6EE7B7]">
              <Check className="h-3 w-3" />
              {t('Offline', 'آفلاین')}
            </span>
          )}
        </div>

        {/* Hover Quick Play Liquid Glass Orb */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlay(item);
          }}
          aria-label={`${t('Play', 'پخش')} ${title}`}
          className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full liquid-glass-cta-gold transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <Play className="h-5 w-5 fill-current ms-0.5" />
          </span>
        </button>

        {progressPct > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-[3px] bg-white/15">
            <div
              className="h-full shadow-[0_0_8px_rgba(245,185,66,0.7)]"
              style={{ width: `${progressPct}%`, backgroundColor: accentHex }}
            />
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="relative z-10 flex flex-1 flex-col justify-between p-3.5 space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-[#CBD5E1]/75 truncate">
            {creator || category}
          </p>

          <button
            type="button"
            onClick={() => onOpenDetail(item)}
            className="text-start w-full cursor-pointer"
          >
            <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC] group-hover:text-[#F5B942] transition-colors line-clamp-1">
              {title}
            </h3>
          </button>

          {reason && (
            <p className="text-[11px] text-[#F5B942]/85 line-clamp-1 flex items-center gap-1 pt-0.5">
              <Sparkles className="h-3 w-3 shrink-0" />
              <span className="truncate">{reason}</span>
            </p>
          )}
        </div>

        {/* Tactile Liquid Glass Action Bar */}
        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={() => onPlay(item)}
            className="min-h-[36px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#F5B942]/20 to-[#F5B942]/10 border border-[#F5B942]/35 px-3 py-1 text-xs font-bold text-[#F5B942] hover:from-[#F5B942] hover:to-[#E2A124] hover:text-[#06070C] transition-all cursor-pointer"
          >
            <Headphones className="h-3.5 w-3.5" />
            <span>{progressPct > 0 ? t('Resume', 'ادامه شنیدن') : t('Listen', 'پخش صوتی')}</span>
          </button>

          {onOpenInDj && (
            <button
              type="button"
              onClick={() => onOpenInDj(item)}
              title={t('Open in 3D Sonic Room', 'ورود به اتاق صوتی ۳بعدی')}
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#38BDF8] hover:bg-[#00F0FF]/20 transition-colors cursor-pointer"
            >
              <Disc3 className="h-3.5 w-3.5" />
            </button>
          )}

          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(item, true)}
              aria-label={t('Download Audio', 'دانلود صوتی')}
              className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
                isDownloaded
                  ? 'border-[#34D399]/45 bg-[#10B981]/20 text-[#6EE7B7]'
                  : 'border-white/12 bg-white/[0.05] text-[#CBD5E1] hover:text-white hover:bg-white/[0.1]'
              }`}
            >
              {isDownloaded ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => onToggleFavorite(item)}
            aria-label={t('Favorite', 'افزودن به علاقه‌مندی‌ها')}
            aria-pressed={isFavorite}
            className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
              isFavorite
                ? 'border-[#F5B942]/55 bg-[#F5B942]/20 text-[#F5B942]'
                : 'border-white/12 bg-white/[0.05] text-[#CBD5E1] hover:text-white hover:bg-white/[0.1]'
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => onFeedback(item, 'like')}
            aria-label={t('Like', 'پسندیدن')}
            aria-pressed={
              feedback === 'more' || (typeof feedback === 'object' && feedback?.sentiment === 'like')
            }
            className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
              feedback === 'more' || (typeof feedback === 'object' && feedback?.sentiment === 'like')
                ? 'border-[#34D399]/55 bg-[#34D399]/18 text-[#6EE7B7]'
                : 'border-white/12 bg-white/[0.05] text-[#CBD5E1] hover:text-white hover:bg-white/[0.1]'
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

export function ToastBanner({
  toast,
  onDismiss
}: {
  toast: ToastMessage | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;
  const label = toast.actionLabel || toast.undoLabel;
  const action = toast.onAction || toast.onUndo;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-28 md:bottom-8 inset-x-4 z-50 flex justify-center pointer-events-none"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12 }}
        className="pointer-events-auto flex items-center gap-3 rounded-full liquid-glass-capsule px-4 py-2.5 shadow-[0_18px_48px_rgba(0,0,0,0.8)]"
      >
        <span className="text-xs sm:text-sm text-[#F8FAFC] ps-1">{toast.text}</span>
        {label && action && (
          <button
            type="button"
            onClick={() => {
              action();
              onDismiss();
            }}
            className="min-h-[34px] rounded-full liquid-glass-cta-gold px-3.5 py-1 text-xs font-bold cursor-pointer"
          >
            {label}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close notification"
          className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-full text-[#CBD5E1] hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    </div>
  );
}
