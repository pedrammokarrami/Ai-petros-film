import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Compass,
  Headphones,
  Mic,
  Music,
  Radio,
  Search,
  Sparkles,
  Volume2,
  X
} from 'lucide-react';
import type {
  DownloadRecord,
  PlaybackProgress,
  PrototypeMediaItem,
  TasteVector,
  UiLang,
  UniverseRealmFilter
} from '../types';
import { MediaCard } from '../components/UiPrimitives';
import { inferMediaDomain } from '../prototypeData';
import { explainRecommendation, semanticMoodSearch } from '../tasteEngine';
import { useAutoTranslation } from '../i18n';

interface IntelligentSearchScreenProps {
  catalog: PrototypeMediaItem[];
  lang: UiLang;
  userVector: TasteVector;
  recentSearches: string[];
  favoriteIds: Set<string>;
  hiddenIds: Set<string>;
  downloadsMap: Record<string, DownloadRecord>;
  progressMap: Record<string, PlaybackProgress>;
  feedbackMap: Record<string, any>;
  onAddRecentSearch: (q: string) => void;
  onClearRecentSearches: () => void;
  onPlay: (item: PrototypeMediaItem) => void;
  onWatchTrailer?: (item: PrototypeMediaItem) => void;
  onDownload: (item: PrototypeMediaItem, saveAsFile?: boolean) => void;
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onToggleFavorite: (itemOrId: any) => void;
  onFeedback: (itemOrId: any, type: any) => void;
  onHide: (item: PrototypeMediaItem) => void;
}

interface SonicMoodPreset {
  id: string;
  titleFa: string;
  titleEn: string;
  subtitleFa: string;
  subtitleEn: string;
  query: string;
  tags: string[];
  auraGradient: string;
  accentHex: string;
  icon: React.ReactNode;
}

const SONIC_MOOD_PRESETS: SonicMoodPreset[] = [
  {
    id: 'cafe-jazz-rain',
    titleFa: 'جاز کافه و باران شبانه',
    titleEn: 'Cafe Jazz & Midnight Rain',
    subtitleFa: 'ساکسیفون، پیانو آکوستیک و فضای گرم کافه',
    subtitleEn: 'Tenor saxophone, acoustic piano & warm saloon ambience',
    query: 'jazz rain piano acoustic calm',
    tags: ['jazz', 'rain', 'calm', 'acoustic', 'piano', 'classic'],
    auraGradient: 'radial-gradient(circle at 18% 20%, rgba(245,185,66,0.28), rgba(24,18,10,0.45) 68%)',
    accentHex: '#F5B942',
    icon: <Headphones className="h-5 w-5 text-[#F5B942]" />
  },
  {
    id: 'synthwave-club',
    titleFa: 'سینت‌ویو و کلاب الکترونیک',
    titleEn: 'Synthwave & Club Bass',
    subtitleFa: 'قطعات ۱۲۲ تا ۱۲۶ BPM مخصوص میکس دی‌جی و اتاق پارتی',
    subtitleEn: '122–126 BPM synthwave & deep house for DJ decks',
    query: 'synthwave techno club dj bass electronic',
    tags: ['synthwave', 'techno', 'dj-ready', 'club', 'house', 'electronic'],
    auraGradient: 'radial-gradient(circle at 18% 20%, rgba(0,240,255,0.26), rgba(10,18,32,0.45) 68%)',
    accentHex: '#00F0FF',
    icon: <Radio className="h-5 w-5 text-[#00F0FF]" />
  },
  {
    id: 'deep-podcasts',
    titleFa: 'پادکست‌های عمیق و گفتگو',
    titleEn: 'Deep Studio Podcasts',
    subtitleFa: 'فلسفه صدا، مهندسی دی‌جی و روایت‌های مستند شبانه',
    subtitleEn: 'Sound architecture, DJ masterclasses & nocturnal talks',
    query: 'podcast studio talk mystery literature',
    tags: ['podcast', 'sound-design', 'mystery', 'literature'],
    auraGradient: 'radial-gradient(circle at 18% 20%, rgba(168,85,247,0.28), rgba(18,11,28,0.45) 68%)',
    accentHex: '#A855F7',
    icon: <Mic className="h-5 w-5 text-[#A855F7]" />
  },
  {
    id: 'spatial-audiobooks',
    titleFa: 'کتاب‌های صوتی و داستان‌های سه‌بعدی',
    titleEn: '3D Spatial Audiobooks',
    subtitleFa: 'ادبیات علمی‌تخیلی، سورئال و رمان‌های معمایی با صدای فضایی',
    subtitleEn: 'Unabridged sci-fi, surrealist & noir mystery audiobooks',
    query: 'audiobook book story scifi surreal mystery',
    tags: ['audiobook', 'book', 'scifi', 'surreal', 'mystery'],
    auraGradient: 'radial-gradient(circle at 18% 20%, rgba(52,211,153,0.24), rgba(10,22,18,0.45) 68%)',
    accentHex: '#34D399',
    icon: <BookOpen className="h-5 w-5 text-[#34D399]" />
  }
];

export function IntelligentSearchScreen({
  catalog,
  lang,
  userVector,
  favoriteIds,
  hiddenIds,
  downloadsMap,
  progressMap,
  feedbackMap,
  onAddRecentSearch,
  onPlay,
  onDownload,
  onOpenDetail,
  onToggleFavorite,
  onFeedback,
  onHide
}: IntelligentSearchScreenProps) {
  const { t } = useAutoTranslation(lang);
  const [query, setQuery] = useState('');
  const [selectedMoodId, setSelectedMoodId] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<UniverseRealmFilter>('all_audio');

  const visibleCatalog = useMemo(
    () =>
      catalog.filter((item) => {
        if (hiddenIds.has(item.id)) return false;
        if (domainFilter === 'all_audio' || domainFilter === 'all') return true;
        return inferMediaDomain(item) === domainFilter;
      }),
    [catalog, hiddenIds, domainFilter]
  );

  const activeMood = useMemo(
    () => SONIC_MOOD_PRESETS.find((m) => m.id === selectedMoodId) ?? null,
    [selectedMoodId]
  );

  const filteredItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (trimmed.length > 0) {
      const directMatches = visibleCatalog.filter((item) => {
        const hay = [
          item.titleFa,
          item.titleEn,
          item.categoryFa,
          item.categoryEn,
          item.synopsisFa,
          item.synopsisEn,
          item.creatorFa || '',
          item.creatorEn || '',
          item.audioSpec || '',
          ...item.tags,
          ...item.tagsFa
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(trimmed);
      });

      if (directMatches.length > 0) return directMatches;
      return semanticMoodSearch(trimmed, visibleCatalog, userVector).map((r) => r.item);
    }

    if (activeMood) {
      const moodMatches = visibleCatalog.filter((item) =>
        item.tags.some((tg) => activeMood.tags.includes(tg.toLowerCase()))
      );
      if (moodMatches.length > 0) return moodMatches;
      return semanticMoodSearch(activeMood.query, visibleCatalog, userVector).map((r) => r.item);
    }

    return visibleCatalog;
  }, [query, activeMood, visibleCatalog, userVector]);

  return (
    <div className="space-y-9 pb-20">
      {/* Floating Borderless Liquid-Glass Search Capsule & Mood Canvas */}
      <section className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="space-y-1.5 text-center sm:text-start"
        >
          <h1 className="text-2xl sm:text-3xl font-black text-[#F8FAFC]">
            {t(
              'Smart Sonic Search',
              'سرچ هوشمند جهان صوتی'
            )}
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1]/75">
            {t(
              'Search by track name, artist, BPM, musical key, or tap a resonant acoustic mood.',
              'جستجوی زنده بر اساس نام قطعه، هنرمند، BPM، گام موسیقی یا لمس حال‌وهوای شنیداری.'
            )}
          </p>
        </motion.div>

        {/* Floating Search Input as Liquid Glass Capsule */}
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 310, damping: 26, delay: 0.06 }}
          className="relative max-w-3xl"
        >
          <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-5 h-5 w-5 text-[#F5B942] z-10" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length > 2) {
                onAddRecentSearch(e.target.value.trim());
              }
            }}
            placeholder={t(
              'Search tracks, podcasts, audiobooks, BPM, artist...',
              'جستجوی نام آهنگ، پادکست، کتاب صوتی، هنرمند یا BPM...'
            )}
            className="w-full min-h-[56px] rounded-full liquid-glass-capsule ps-14 pe-14 py-3 text-sm sm:text-base text-[#F8FAFC] placeholder:text-[#94A3B8]/80 focus:border-[#F5B942]/70 focus:shadow-[0_14px_42px_rgba(245,185,66,0.18)] focus:outline-none transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('Clear search', 'پاک‌کردن جستجو')}
              className="absolute top-1/2 -translate-y-1/2 end-3.5 h-9 w-9 inline-flex items-center justify-center rounded-full bg-white/10 text-[#E2E8F0] hover:bg-white/20 hover:text-white cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </motion.div>

        {/* Translucent Domain Switcher Capsule */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 310, damping: 26, delay: 0.11 }}
          className="flex items-center gap-2 overflow-x-auto no-scrollbar"
        >
          <div className="inline-flex items-center gap-1 rounded-full liquid-glass-capsule p-1.5">
            {(
              [
                { id: 'all_audio', fa: 'همه اصوات', en: 'All Audio', icon: <Volume2 className="h-3.5 w-3.5" /> },
                { id: 'music', fa: 'موسیقی', en: 'Music', icon: <Music className="h-3.5 w-3.5" /> },
                { id: 'podcast', fa: 'پادکست', en: 'Podcasts', icon: <Mic className="h-3.5 w-3.5" /> },
                { id: 'audiobook', fa: 'کتاب صوتی', en: 'Audiobooks', icon: <BookOpen className="h-3.5 w-3.5" /> }
              ] as const
            ).map((dom) => {
              const active = domainFilter === dom.id;
              return (
                <button
                  key={dom.id}
                  type="button"
                  onClick={() => setDomainFilter(dom.id)}
                  className={`relative min-h-[36px] shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    active ? 'text-[#06070C]' : 'text-[#CBD5E1] hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="searchDomainGlassPill"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-full liquid-glass-cta-gold"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {dom.icon}
                    <span>{t(dom.en, dom.fa)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* 4 Borderless Organic Spatial Mood Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#F5B942] flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {t('AI SONIC MOOD PRESETS', 'پیشنهادات و حال‌وهوای صوتی هوش مصنوعی')}
            </span>
            {selectedMoodId && (
              <button
                type="button"
                onClick={() => setSelectedMoodId(null)}
                className="text-xs font-semibold text-[#CBD5E1] hover:text-[#F5B942] cursor-pointer"
              >
                {t('Show All Audio', 'نمایش همه اصوات')}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SONIC_MOOD_PRESETS.map((mood, idx) => {
              const isSelected = selectedMoodId === mood.id;
              return (
                <motion.button
                  key={mood.id}
                  type="button"
                  initial={{ opacity: 0, y: 22, scale: 0.94, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  whileHover={{ y: -4, scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{
                    type: 'spring',
                    stiffness: 320,
                    damping: 26,
                    delay: 0.14 + idx * 0.065
                  }}
                  onClick={() => {
                    setSelectedMoodId((prev) => (prev === mood.id ? null : mood.id));
                    setQuery('');
                  }}
                  style={{
                    background: mood.auraGradient,
                    boxShadow: isSelected
                      ? `0 18px 44px -12px ${mood.accentHex}55, inset 0 1px 0 rgba(255,255,255,0.28)`
                      : '0 16px 38px -14px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.16)'
                  }}
                  className="group spatial-portal-sheen relative text-start rounded-[24px] backdrop-blur-2xl p-4.5 transition-all cursor-pointer overflow-hidden"
                >
                  {/* Specular Ring */}
                  <div
                    className={`pointer-events-none absolute inset-0 rounded-[24px] transition-all ${
                      isSelected ? 'ring-1 ring-inset ring-white/40' : 'ring-1 ring-inset ring-white/10 group-hover:ring-white/25'
                    }`}
                  />

                  <div className="relative z-10 flex items-center justify-between mb-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl liquid-glass-capsule">
                      {mood.icon}
                    </span>
                    {isSelected && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[10px] font-black text-[#06070C]"
                        style={{ backgroundColor: mood.accentHex }}
                      >
                        {t('ACTIVE', 'فعال')}
                      </span>
                    )}
                  </div>
                  <h3 className="relative z-10 text-base font-black text-[#F8FAFC] mb-1 group-hover:text-[#F5B942] transition-colors">
                    {t(mood.titleEn, mood.titleFa)}
                  </h3>
                  <p className="relative z-10 text-xs text-[#E2E8F0]/75 line-clamp-2 leading-relaxed">
                    {t(mood.subtitleEn, mood.subtitleFa)}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Results Grid */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ type: 'spring', stiffness: 290, damping: 26, delay: 0.16 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-[#F5B942]" />
            <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
              {query.trim()
                ? `${t('Results for', 'نتایج برای')} «${query.trim()}»`
                : activeMood
                  ? t(activeMood.titleEn, activeMood.titleFa)
                  : t('All Spatial Audio Works', 'همه آثار صوتی، پادکست‌ها و کتاب‌های صوتی')}
            </h2>
          </div>
          <span className="text-xs font-mono-tabular text-[#CBD5E1]/75">
            {filteredItems.length} {t('tracks', 'اثر صوتی')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredItems.map((item, idx) => {
            const reason = explainRecommendation(userVector, item, lang);
            return (
              <MediaCard
                key={item.id}
                index={idx}
                item={item}
                lang={lang}
                reasonFa={reason}
                reasonEn={reason}
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
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}
