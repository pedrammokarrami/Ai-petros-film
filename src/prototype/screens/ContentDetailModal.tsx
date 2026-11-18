import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bookmark,
  Check,
  Clock,
  Download,
  Headphones,
  Radio,
  X
} from 'lucide-react';
import type {
  DownloadRecord,
  PlaybackProgress,
  PrototypeMediaItem,
  UiLang,
  UserCollection
} from '../types';
import { CinemaPosterImage, formatDuration } from '../components/UiPrimitives';
import { formatBytes } from '../downloadEngine';
import { useAutoTranslation } from '../i18n';

interface ContentDetailModalProps {
  item: PrototypeMediaItem | null;
  catalog: PrototypeMediaItem[];
  lang: UiLang;
  isFavorite: boolean;
  downloadRecord?: DownloadRecord;
  progress?: PlaybackProgress;
  feedback?: any;
  collections: UserCollection[];
  reducedMotion?: boolean;
  onClose: () => void;
  onPlay: (item: PrototypeMediaItem) => void;
  onWatchTrailer?: (item: PrototypeMediaItem) => void;
  onDownload?: (
    item: PrototypeMediaItem,
    saveAsFile?: boolean,
    selectedQuality?: { id: string; resolution: string; label: string; estimatedSizeMb: number }
  ) => void;
  onSelectItem: (item: PrototypeMediaItem) => void;
  onToggleFavorite: (itemOrId: any) => void;
  onToggleCollectionItem: (collectionId: string, contentId: string) => void;
  onFeedback: (itemOrId: any, type: any) => void;
  onHide: (item: PrototypeMediaItem) => void;
  onSubmitReport: (item: PrototypeMediaItem, reason: string) => void;
  onOpenLanguagePicker?: () => void;
}

export function ContentDetailModal({
  item,
  lang,
  isFavorite,
  downloadRecord,
  progress,
  onClose,
  onPlay,
  onDownload,
  onToggleFavorite
}: ContentDetailModalProps) {
  const { t } = useAutoTranslation(lang);

  useEffect(() => {
    if (!item) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [item, onClose]);

  if (!item) return null;

  const title = t(item.titleEn, item.titleFa);
  const synopsis = t(item.synopsisEn, item.synopsisFa);
  const category = t(item.categoryEn, item.categoryFa);
  const creator = item.creatorFa
    ? t(item.creatorEn || item.creatorFa, item.creatorFa)
    : t('Aether Sonic Lab', 'آزمایشگاه صوتی اِتر');

  const hasProgress = progress && progress.positionSec > 5 && !progress.completed;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl border border-[#F5B942]/35 bg-[#0A0A0F] overflow-hidden shadow-[0_28px_90px_rgba(0,0,0,0.95)] max-h-[90vh] flex flex-col"
        >
          {/* Header Cover */}
          <div className="relative h-60 sm:h-68 w-full shrink-0 overflow-hidden bg-[#06070C]">
            <CinemaPosterImage item={item} title={title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/55 to-black/25" />

            <button
              type="button"
              onClick={onClose}
              aria-label={t('Close', 'بستن')}
              className="absolute top-4 end-4 z-20 h-10 w-10 inline-flex items-center justify-center rounded-full border border-white/15 bg-black/65 backdrop-blur-md text-white hover:border-[#F5B942] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="absolute bottom-4 inset-x-6 z-20 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {item.bpm && (
                  <span
                    dir="ltr"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#00F0FF]/20 border border-[#00F0FF]/45 px-2.5 py-1 text-xs font-bold text-[#00F0FF] font-mono-tabular"
                  >
                    <Radio className="h-3 w-3" />
                    {item.bpm} BPM {item.musicalKey ? `· ${item.musicalKey}` : ''}
                  </span>
                )}

                <span
                  dir="ltr"
                  className="inline-flex items-center gap-1 rounded-lg bg-black/75 border border-white/10 px-2.5 py-1 text-xs text-[#E2E8F0] font-mono-tabular"
                >
                  <Clock className="h-3 w-3 text-[#F5B942]" />
                  {formatDuration(item.durationSec, lang)}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-[#F8FAFC] leading-tight">
                {title}
              </h2>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPlay(item);
                }}
                className="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F5B942] to-[#C98A1C] px-6 py-3 text-sm font-black text-[#06070C] shadow-[0_0_32px_rgba(245,185,66,0.4)] hover:brightness-110 transition-all cursor-pointer"
              >
                <Headphones className="h-5 w-5" />
                <span>
                  {hasProgress
                    ? t('Resume Audio Track', 'ادامه پخش قطعه صوتی')
                    : t('Play Spatial Audio', 'پخش قطعه صوتی')}
                </span>
              </button>

              {onDownload && (
                <button
                  type="button"
                  onClick={() => onDownload(item, true)}
                  className={`min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    downloadRecord
                      ? 'border-[#10B981]/50 bg-[#10B981]/15 text-[#34D399]'
                      : 'border-white/15 bg-white/[0.05] text-[#F8FAFC] hover:border-[#F5B942]'
                  }`}
                >
                  {downloadRecord ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  <span>
                    {downloadRecord
                      ? formatBytes(downloadRecord.fileSizeBytes)
                      : t('Offline Save', 'ذخیره آفلاین')}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onToggleFavorite(item)}
                aria-label={t('Favorite', 'افزودن به علاقه‌مندی‌ها')}
                className={`min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                  isFavorite
                    ? 'border-[#F5B942] bg-[#F5B942]/20 text-[#F5B942]'
                    : 'border-white/15 bg-white/[0.04] text-[#CBD5E1] hover:text-white'
                }`}
              >
                <Bookmark className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>

            <p className="text-sm sm:text-base text-[#E2E8F0] leading-relaxed">{synopsis}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-[#06070C] p-4 text-xs">
              <div>
                <span className="block text-[#94A3B8] mb-1">
                  {t('Artist / Creator', 'هنرمند / سازنده')}
                </span>
                <strong className="font-bold text-[#F8FAFC]">{creator}</strong>
              </div>
              <div>
                <span className="block text-[#94A3B8] mb-1">
                  {t('Audio Format', 'فرمت صوتی')}
                </span>
                <strong className="font-bold text-[#00F0FF]">
                  {item.audioSpec || 'Lossless 24-Bit · Spatial'}
                </strong>
              </div>
              <div>
                <span className="block text-[#94A3B8] mb-1">{t('Category', 'دسته‌بندی')}</span>
                <strong className="font-bold text-[#F5B942]">{category}</strong>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
