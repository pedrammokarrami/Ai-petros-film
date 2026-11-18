import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bookmark,
  Disc3,
  Download,
  EyeOff,
  Headphones,
  History,
  ListMusic,
  Play,
  Plus,
  Trash2
} from 'lucide-react';
import type {
  DownloadRecord,
  PlaybackProgress,
  PrototypeMediaItem,
  UiLang,
  UserCollection
} from '../types';
import { CinemaPosterImage, formatDuration, MediaCard } from '../components/UiPrimitives';
import { formatBytes } from '../downloadEngine';
import { useAutoTranslation } from '../i18n';

interface LibraryScreenProps {
  catalog: PrototypeMediaItem[];
  lang: UiLang;
  favoriteIds: Set<string>;
  hiddenIds: Set<string>;
  downloadsMap: Record<string, DownloadRecord>;
  progressMap: Record<string, PlaybackProgress>;
  feedbackMap: Record<string, any>;
  collections: UserCollection[];
  onPlay: (item: PrototypeMediaItem) => void;
  onWatchTrailer?: (item: PrototypeMediaItem) => void;
  onDownload: (item: PrototypeMediaItem, saveAsFile?: boolean) => void;
  onRemoveDownload: (contentId: string) => void;
  onClearAllDownloads: () => void;
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onToggleFavorite: (itemOrId: any) => void;
  onFeedback: (itemOrId: any, type: any) => void;
  onHide: (item: PrototypeMediaItem) => void;
  onUnhide: (id: string) => void;
  onCreateCollection: (name: string) => void;
  onDeleteCollection: (id: string) => void;
  onRemoveFromCollection: (collectionId: string, contentId: string) => void;
  onClearHistory: () => void;
  onOpenInDj?: (
    item?: PrototypeMediaItem,
    tab?: 'dj_console' | 'concert_stage' | 'cafe_room' | 'party_room' | 'library_room' | 'playlist_studio'
  ) => void;
  onOpenPlaylistStudio?: () => void;
}

export function LibraryScreen({
  catalog,
  lang,
  favoriteIds,
  hiddenIds,
  downloadsMap,
  progressMap,
  feedbackMap,
  collections,
  onPlay,
  onDownload,
  onClearAllDownloads,
  onOpenDetail,
  onToggleFavorite,
  onFeedback,
  onHide,
  onUnhide,
  onCreateCollection,
  onDeleteCollection,
  onClearHistory,
  onOpenInDj,
  onOpenPlaylistStudio
}: LibraryScreenProps) {
  const { t } = useAutoTranslation(lang);
  const [activeTab, setActiveTab] = useState<
    'favorites' | 'collections' | 'downloads' | 'history' | 'hidden'
  >('favorites');
  const [newCollectionName, setNewCollectionName] = useState('');

  const favoriteItems = useMemo(() => {
    const favs = catalog.filter((item) => favoriteIds.has(item.id) && !hiddenIds.has(item.id));
    if (favs.length > 0) return favs;
    return catalog.filter((item) => !hiddenIds.has(item.id)).slice(0, 6);
  }, [catalog, favoriteIds, hiddenIds]);

  const downloadedItems = useMemo(
    () =>
      catalog
        .filter((item) => Boolean(downloadsMap[item.id]))
        .sort((a, b) =>
          String(downloadsMap[b.id]?.downloadedAt || '').localeCompare(
            String(downloadsMap[a.id]?.downloadedAt || '')
          )
        ),
    [catalog, downloadsMap]
  );

  const totalDownloadedBytes = useMemo(
    () =>
      Object.values(downloadsMap).reduce((sum, rec) => sum + (rec?.fileSizeBytes ?? 0), 0),
    [downloadsMap]
  );

  const historyItems = useMemo(
    () =>
      catalog
        .filter((item) => progressMap[item.id] && progressMap[item.id].positionSec > 0)
        .sort((a, b) =>
          String(progressMap[b.id]?.lastWatchedAt || '').localeCompare(
            String(progressMap[a.id]?.lastWatchedAt || '')
          )
        ),
    [catalog, progressMap]
  );

  const hiddenItems = useMemo(
    () => catalog.filter((item) => hiddenIds.has(item.id)),
    [catalog, hiddenIds]
  );

  const handleAddCollection = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    onCreateCollection(trimmed);
    setNewCollectionName('');
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Airy Frosted Glass Library Banner */}
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="relative rounded-[28px] liquid-glass-surface spatial-portal-sheen p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 overflow-hidden"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -start-12 h-48 w-48 rounded-full bg-[#F5B942]/18 blur-[72px]"
        />
        <div className="relative z-10 space-y-1.5">
          <span className="holo-micro-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold text-[#F5B942]">
            <Headphones className="h-3.5 w-3.5" />
            <span>{t('SONIC AUDIO LIBRARY', 'کتابخانه شخصی جهان صوتی')}</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#F8FAFC]">
            {t('Saved Tracks, DJ Playlists & Offline Archive', 'قطعات محبوب، پلی‌لیست‌ها و آرشیو آفلاین')}
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1]/80">
            {t(
              'Curate personal spatial playlists, offline masters, and your listening history.',
              'دسترسی سریع به موسیقی‌ها، پادکست‌ها، کتاب‌های صوتی و پلی‌لیست‌های دی‌جی شما.'
            )}
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          {onOpenPlaylistStudio && (
            <button
              type="button"
              onClick={onOpenPlaylistStudio}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-full liquid-glass-capsule px-4 py-2 text-xs font-bold text-[#38BDF8] hover:border-[#38BDF8]/55 transition-all cursor-pointer"
            >
              <Disc3 className="h-4 w-4" />
              <span>{t('Open 3D Sonic Rooms', 'ورود به اتاق‌های صوتی')}</span>
            </button>
          )}
        </div>
      </motion.section>

      {/* Delicate Translucent Holographic Glass Sub-Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.08 }}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full liquid-glass-capsule p-1.5">
          {(
            [
              {
                id: 'favorites',
                fa: `علاقه‌مندی‌ها (${favoriteItems.length})`,
                en: `Favorites (${favoriteItems.length})`,
                icon: Bookmark
              },
              {
                id: 'collections',
                fa: `پلی‌لیست‌ها (${collections.length})`,
                en: `Playlists (${collections.length})`,
                icon: ListMusic
              },
              {
                id: 'downloads',
                fa: `آفلاین (${downloadedItems.length})`,
                en: `Offline (${downloadedItems.length})`,
                icon: Download
              },
              {
                id: 'history',
                fa: `سابقه شنیدن (${historyItems.length})`,
                en: `History (${historyItems.length})`,
                icon: History
              },
              ...(hiddenItems.length > 0
                ? [
                    {
                      id: 'hidden' as const,
                      fa: `مخفی‌شده (${hiddenItems.length})`,
                      en: `Hidden (${hiddenItems.length})`,
                      icon: EyeOff
                    }
                  ]
                : [])
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative min-h-[38px] shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  active ? 'text-[#06070C]' : 'text-[#CBD5E1] hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="libraryHoloSubTab"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    className="absolute inset-0 rounded-full liquid-glass-cta-gold"
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <motion.span
                    animate={active ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                    transition={{ duration: 0.35 }}
                  >
                    <IconComp className="h-3.5 w-3.5" />
                  </motion.span>
                  <span>{t(tab.en, tab.fa)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
      {/* TAB 1: FAVORITE TRACKS */}
      {activeTab === 'favorites' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {favoriteItems.map((item, idx) => (
            <MediaCard
              key={item.id}
              index={idx}
              item={item}
              lang={lang}
              progress={progressMap[item.id]}
              isFavorite={favoriteIds.has(item.id)}
              isDownloaded={Boolean(downloadsMap[item.id])}
              downloadRecord={downloadsMap[item.id]}
              feedback={feedbackMap[item.id]}
              onPlay={onPlay}
              onDownload={onDownload}
              onOpenDetail={onOpenDetail}
              onToggleFavorite={onToggleFavorite}
              onFeedback={onFeedback}
              onHide={onHide}
              onOpenInDj={onOpenInDj ? (it) => onOpenInDj(it, 'dj_console') : undefined}
            />
          ))}
        </div>
      )}

      {/* TAB 2: PLAYLISTS / FROSTED GLASS ARCHIVE SHOWCASE CARDS */}
      {activeTab === 'collections' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddCollection}
            className="rounded-full liquid-glass-capsule p-2 ps-4 flex flex-col sm:flex-row gap-2.5 max-w-2xl"
          >
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder={t(
                'New playlist name (e.g. Late Night Cafe Jazz)...',
                'نام پلی‌لیست جدید (مثلاً: جاز شبانه کافه)...'
              )}
              className="flex-1 min-h-[42px] bg-transparent px-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/80 focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-full liquid-glass-cta-gold px-5 py-2 text-xs sm:text-sm font-black cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{t('Create Playlist', 'ساخت پلی‌لیست')}</span>
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {collections.map((col, idx) => {
              const colItems = catalog.filter((c) => col.itemIds.includes(c.id));
              const accent = col.accentHex || '#F5B942';
              const collageCovers = (colItems.length > 0 ? colItems : favoriteItems).slice(0, 4);

              return (
                <motion.div
                  key={col.id}
                  initial={{ opacity: 0, y: 20, scale: 0.96, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  transition={{
                    type: 'spring',
                    stiffness: 310,
                    damping: 26,
                    delay: idx * 0.075
                  }}
                  className="group spatial-portal-sheen relative rounded-[28px] liquid-glass-surface p-5 sm:p-6 space-y-5 overflow-hidden"
                >
                  {/* Dynamic Ambient Backlight */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-12 -end-12 h-44 w-44 rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition-opacity"
                    style={{ backgroundColor: accent }}
                  />

                  <div className="relative z-10 flex items-center justify-between gap-4">
                    {/* Artistic 2x2 Cover Collage */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-16 w-16 shrink-0 rounded-2xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-[1.5px] bg-white/10 p-[1.5px] shadow-lg">
                        {collageCovers.map((coverItem) => (
                          <div key={coverItem.id} className="h-full w-full overflow-hidden rounded-sm">
                            <CinemaPosterImage
                              item={coverItem}
                              title={t(coverItem.titleEn, coverItem.titleFa)}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-lg font-black text-[#F8FAFC] truncate">
                          {t(col.name)}
                        </h3>
                        <p className="text-xs text-[#CBD5E1]/75 font-mono-tabular">
                          {colItems.length} {t('tracks', 'قطعه صوتی')}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteCollection(col.id)}
                      aria-label={t('Delete Playlist', 'حذف پلی‌لیست')}
                      className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full liquid-glass-capsule text-[#CBD5E1] hover:text-[#FCA5A5] cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {colItems.length > 0 ? (
                    <div className="relative z-10 space-y-2">
                      {colItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => onOpenDetail(item)}
                          className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] backdrop-blur-md p-2.5 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-11 w-11 rounded-xl overflow-hidden shrink-0 shadow">
                              <CinemaPosterImage
                                item={item}
                                title={t(item.titleEn, item.titleFa)}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#F8FAFC] truncate">
                                {t(item.titleEn, item.titleFa)}
                              </p>
                              <p className="text-[10px] font-mono-tabular text-[#CBD5E1]/75">
                                {item.bpm ? `${item.bpm} BPM · ` : ''}
                                {formatDuration(item.durationSec, lang)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlay(item);
                            }}
                            aria-label={t('Play', 'پخش')}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-full liquid-glass-cta-gold shrink-0 cursor-pointer"
                          >
                            <Play className="h-3.5 w-3.5 fill-current ms-0.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="relative z-10 text-xs text-[#CBD5E1]/70">
                      {t('No audio tracks added yet.', 'هنوز قطعه‌ای به این پلی‌لیست اضافه نشده است.')}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: OFFLINE DOWNLOADS */}
      {activeTab === 'downloads' && (
        <div className="space-y-5">
          {downloadedItems.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] liquid-glass-surface p-4">
              <p className="text-xs sm:text-sm text-[#E2E8F0]">
                {t('Offline Audio Storage:', 'حجم کل فایل‌های صوتی آفلاین:')}{' '}
                <strong dir="ltr" className="font-mono-tabular text-[#34D399]">
                  {formatBytes(totalDownloadedBytes)}
                </strong>
              </p>
              <button
                type="button"
                onClick={onClearAllDownloads}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-full border border-[#F87171]/35 bg-[#F87171]/15 px-3.5 py-1.5 text-xs font-bold text-[#FCA5A5] cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t('Clear All Offline Audio', 'حذف همه فایل‌های آفلاین')}</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {(downloadedItems.length > 0 ? downloadedItems : favoriteItems.slice(0, 4)).map(
              (item, idx) => (
                <MediaCard
                  key={item.id}
                  index={idx}
                  item={item}
                  lang={lang}
                  progress={progressMap[item.id]}
                  isFavorite={favoriteIds.has(item.id)}
                  isDownloaded={Boolean(downloadsMap[item.id])}
                  downloadRecord={downloadsMap[item.id]}
                  feedback={feedbackMap[item.id]}
                  onPlay={onPlay}
                  onDownload={onDownload}
                  onOpenDetail={onOpenDetail}
                  onToggleFavorite={onToggleFavorite}
                  onFeedback={onFeedback}
                  onHide={onHide}
                />
              )
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LISTENING HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {historyItems.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClearHistory}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full border border-[#F87171]/35 bg-[#F87171]/15 px-4 py-1.5 text-xs font-bold text-[#FCA5A5] cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t('Clear Listening History', 'پاک‌کردن سابقه شنیدن')}</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {(historyItems.length > 0 ? historyItems : favoriteItems.slice(0, 4)).map((item, idx) => (
              <MediaCard
                key={item.id}
                index={idx}
                item={item}
                lang={lang}
                progress={progressMap[item.id]}
                isFavorite={favoriteIds.has(item.id)}
                isDownloaded={Boolean(downloadsMap[item.id])}
                downloadRecord={downloadsMap[item.id]}
                feedback={feedbackMap[item.id]}
                onPlay={onPlay}
                onDownload={onDownload}
                onOpenDetail={onOpenDetail}
                onToggleFavorite={onToggleFavorite}
                onFeedback={onFeedback}
                onHide={onHide}
              />
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: HIDDEN ITEMS */}
      {activeTab === 'hidden' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {hiddenItems.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 310, damping: 26, delay: idx * 0.06 }}
              className="rounded-[24px] liquid-glass-surface p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0">
                  <CinemaPosterImage item={item} title={t(item.titleEn, item.titleFa)} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#F8FAFC] truncate">
                    {t(item.titleEn, item.titleFa)}
                  </p>
                  <p className="text-xs text-[#CBD5E1]/75">
                    {t(item.categoryEn, item.categoryFa)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUnhide(item.id)}
                className="min-h-[38px] rounded-full liquid-glass-cta-gold px-4 py-1.5 text-xs font-black cursor-pointer"
              >
                {t('Restore', 'بازگردانی')}
              </button>
            </motion.div>
          ))}
        </div>
      )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
