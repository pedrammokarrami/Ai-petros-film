import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Coffee,
  Compass,
  Disc3,
  Mic,
  Music,
  Play,
  Radio,
  Volume2,
  Zap
} from 'lucide-react';
import type {
  DownloadRecord,
  PlaybackProgress,
  PrototypeMediaItem,
  TasteVector,
  UiLang,
  UniverseRealmFilter
} from '../types';
import { CinemaPosterImage, formatDuration, MediaCard } from '../components/UiPrimitives';
import { inferMediaDomain } from '../prototypeData';
import { computeMatchScore, explainRecommendation } from '../tasteEngine';
import { useAutoTranslation } from '../i18n';

import roomCafeImg from '../../assets/images/room_cafe_rdr2_pov_1794615520413.jpg';
import roomConcertImg from '../../assets/images/room_concert_pop_pov_1794615522837.jpg';
import roomPartyImg from '../../assets/images/room_party_007_pov_1794615525017.jpg';
import roomLibraryImg from '../../assets/images/room_audiobook_library_pov_1794615526648.jpg';

interface LivingHomeScreenProps {
  catalog: PrototypeMediaItem[];
  lang: UiLang;
  userVector: TasteVector;
  personalizationEnabled: boolean;
  favoriteIds: Set<string>;
  hiddenIds: Set<string>;
  downloadsMap: Record<string, DownloadRecord>;
  progressMap: Record<string, PlaybackProgress>;
  feedbackMap: Record<string, any>;
  onPlay: (item: PrototypeMediaItem) => void;
  onWatchTrailer?: (item: PrototypeMediaItem) => void;
  onDownload: (item: PrototypeMediaItem, saveAsFile?: boolean) => void;
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onToggleFavorite: (itemOrId: any) => void;
  onFeedback: (itemOrId: any, type: any) => void;
  onHide: (item: PrototypeMediaItem) => void;
  onGoDiscover: () => void;
  onOpenInDj?: (
    item?: PrototypeMediaItem,
    tab?: 'dj_console' | 'concert_stage' | 'cafe_room' | 'party_room' | 'library_room' | 'playlist_studio'
  ) => void;
}

const SONIC_ROOM_CARDS = [
  {
    id: 'cafe_room' as const,
    titleFa: 'اتاق کافه (وسترن)',
    titleEn: 'Western Saloon Cafe',
    subtitleFa: 'سالن چوبی وسترن با پیانو زنده، گیتار آکوستیک و نور گرم شمع',
    subtitleEn: '19th-century Western Saloon with live piano, acoustic guitar & candle glow',
    accentHex: '#F5B942',
    liveUsers: 42,
    icon: Coffee,
    imageUrl: roomCafeImg,
    trackId: 'music-02'
  },
  {
    id: 'concert_stage' as const,
    titleFa: 'اتاق کنسرت',
    titleEn: 'Live Concert Arena',
    subtitleFa: 'اجرای زنده روی استیج با نورپردازی حجمی و صدای فراگیر تالار',
    subtitleEn: 'Full live stage performance with volumetric arena beams & spatial sound',
    accentHex: '#E879F9',
    liveUsers: 118,
    icon: Music,
    imageUrl: roomConcertImg,
    trackId: 'music-04'
  },
  {
    id: 'party_room' as const,
    titleFa: 'اتاق پارتی',
    titleEn: '3D Club & Rave',
    subtitleFa: 'کلاب شبانه با رقص نور لیزری حساس به بیس و میکس دی‌جی',
    subtitleEn: 'Bass-reactive laser club lighting & non-stop DJ mixes',
    accentHex: '#00F0FF',
    liveUsers: 148,
    icon: Zap,
    imageUrl: roomPartyImg,
    trackId: 'music-03'
  },
  {
    id: 'library_room' as const,
    titleFa: 'کتابخانه صوتی',
    titleEn: '3D Audiobook Sanctuary',
    subtitleFa: 'تالار چوبی کلاسیک برای شنیدن کتاب‌های صوتی و داستان‌های عمیق',
    subtitleEn: 'Warm wooden library hall for narrated audiobooks & stories',
    accentHex: '#FBBF24',
    liveUsers: 31,
    icon: BookOpen,
    imageUrl: roomLibraryImg,
    trackId: 'book-01'
  }
];

export function LivingHomeScreen({
  catalog,
  lang,
  userVector,
  personalizationEnabled,
  favoriteIds,
  hiddenIds,
  downloadsMap,
  progressMap,
  feedbackMap,
  onPlay,
  onDownload,
  onOpenDetail,
  onToggleFavorite,
  onFeedback,
  onHide,
  onGoDiscover,
  onOpenInDj
}: LivingHomeScreenProps) {
  const { t } = useAutoTranslation(lang);
  const [activeRealm, setActiveRealm] = useState<UniverseRealmFilter>('all_audio');
  const [heroIndex, setHeroIndex] = useState(0);

  const visibleItems = useMemo(
    () => catalog.filter((item) => !hiddenIds.has(item.id)),
    [catalog, hiddenIds]
  );

  const rankedAudioItems = useMemo(() => {
    const scored = visibleItems.map((item) => ({
      item,
      score: personalizationEnabled ? computeMatchScore(userVector, item.vector) : 92,
      reason: explainRecommendation(userVector, item, lang)
    }));
    return scored.sort((a, b) => b.score - a.score);
  }, [visibleItems, userVector, personalizationEnabled, lang]);

  const musicItems = useMemo(
    () => rankedAudioItems.filter(({ item }) => inferMediaDomain(item) === 'music'),
    [rankedAudioItems]
  );

  const podcastItems = useMemo(
    () => rankedAudioItems.filter(({ item }) => inferMediaDomain(item) === 'podcast'),
    [rankedAudioItems]
  );

  const audiobookItems = useMemo(
    () => rankedAudioItems.filter(({ item }) => inferMediaDomain(item) === 'audiobook'),
    [rankedAudioItems]
  );

  const heroPool = useMemo(() => {
    if (musicItems.length > 0) return musicItems.slice(0, 5).map((r) => r.item);
    return rankedAudioItems.slice(0, 5).map((r) => r.item);
  }, [musicItems, rankedAudioItems]);

  const heroItem = heroPool[heroIndex % Math.max(1, heroPool.length)] || visibleItems[0];

  if (!heroItem) return null;

  const heroTitle = t(heroItem.titleEn, heroItem.titleFa);
  const heroSynopsis = t(heroItem.synopsisEn, heroItem.synopsisFa);
  const heroCategory = t(heroItem.categoryEn, heroItem.categoryFa);
  const heroCreator = heroItem.creatorFa
    ? t(heroItem.creatorEn || heroItem.creatorFa, heroItem.creatorFa)
    : '';

  return (
    <div className="space-y-12 pb-20">
      {/* =================================================================== */}
      {/* 1. VOLUMETRIC HERO STAGE (BORDERLESS ATMOSPHERIC DEPTH + GLASS CTA) */}
      {/* =================================================================== */}
      <motion.section
        initial={{ opacity: 0, y: 20, scale: 0.97, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="relative rounded-[32px] spatial-portal-sheen overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.8)]"
      >
        {/* Specular Hairline Rim without heavy frame */}
        <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/15 z-20" />

        <div className="relative min-h-[400px] sm:min-h-[450px] w-full flex flex-col justify-end p-6 sm:p-10">
          {/* Deep Atmospheric Artwork Layer blending into Living Canvas */}
          <div className="absolute inset-0 z-0">
            <CinemaPosterImage
              item={heroItem}
              title={heroTitle}
              loading="eager"
              className="h-full w-full"
              imgClassName="scale-105 object-cover opacity-65 transition-transform duration-1000"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05060B] via-[#05060B]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-l from-[#05060B]/88 via-[#05060B]/35 to-transparent" />
            <div
              className="pointer-events-none absolute -bottom-24 start-12 h-64 w-64 rounded-full blur-[95px] opacity-40"
              style={{ backgroundColor: heroItem.accentHex || '#F5B942' }}
            />
          </div>

          <motion.div
            key={heroItem.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26, delay: 0.08 }}
            className="relative z-10 max-w-2xl space-y-4"
          >
            {/* Delicate Holographic Audio Spec Micro-Capsule */}
            <div className="inline-flex flex-wrap items-center gap-2 holo-micro-badge rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-[#F8FAFC]/90">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399] shadow-[0_0_10px_#34D399]" />
              <Radio className="h-3.5 w-3.5 text-[#38BDF8]" />
              <span className="text-[#F5B942]">
                {t('SONIC UNIVERSE · SPATIAL 3D', 'جهان صوتی سه‌بعدی · صدای فضایی')}
              </span>
              {heroItem.bpm && (
                <>
                  <span className="opacity-35">·</span>
                  <span dir="ltr" className="font-mono-tabular text-[#38BDF8]">
                    {heroItem.bpm} BPM · {heroItem.musicalKey || 'Am'}
                  </span>
                </>
              )}
              {heroItem.audioSpec && (
                <>
                  <span className="opacity-35 hidden sm:inline">·</span>
                  <span dir="ltr" className="font-mono-tabular text-[#E2E8F0]/80 hidden sm:inline">
                    {heroItem.audioSpec}
                  </span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-[#F8FAFC] leading-tight">
              {heroTitle}
            </h1>

            <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-[#E2E8F0]/85">
              <span className="font-bold text-[#F5B942]">{heroCategory}</span>
              {heroCreator && (
                <>
                  <span className="opacity-40">•</span>
                  <span>{heroCreator}</span>
                </>
              )}
              <span className="opacity-40">•</span>
              <span dir="ltr" className="font-mono-tabular">
                {formatDuration(heroItem.durationSec, lang)}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#D2DAE8]/90 leading-relaxed line-clamp-2 max-w-xl">
              {heroSynopsis}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onPlay(heroItem)}
                className="min-h-[48px] inline-flex items-center gap-2.5 rounded-full liquid-glass-cta-gold px-6 py-2.5 text-sm font-black cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{t('Play Master Audio', 'پخش قطعه صوتی')}</span>
              </button>

              {onOpenInDj && (
                <button
                  type="button"
                  onClick={() => onOpenInDj(heroItem, 'dj_console')}
                  className="min-h-[48px] inline-flex items-center gap-2 rounded-full liquid-glass-capsule px-5 py-2.5 text-xs sm:text-sm font-bold text-[#38BDF8] hover:border-[#38BDF8]/60 hover:bg-[#38BDF8]/10 transition-all cursor-pointer"
                >
                  <Disc3 className="h-4 w-4" />
                  <span>{t('Enter 3D Sonic Rooms', 'وارد اتاق سه‌بعدی شوید')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onGoDiscover}
                className="min-h-[48px] inline-flex items-center gap-2 rounded-full liquid-glass-capsule px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#F8FAFC] hover:border-[#F5B942]/50 transition-all cursor-pointer"
              >
                <Compass className="h-4 w-4 text-[#F5B942]" />
                <span>{t('3D Sonic Explore', 'کاوش ۳بعدی صدا')}</span>
              </button>
            </div>
          </motion.div>

          {/* Hero Track Switcher Dots */}
          {heroPool.length > 1 && (
            <div className="relative z-10 mt-6 flex items-center gap-2">
              {heroPool.map((h, idx) => {
                const active = idx === heroIndex % heroPool.length;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHeroIndex(idx)}
                    aria-label={t(h.titleEn, h.titleFa)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      active
                        ? 'w-8 bg-[#F5B942] shadow-[0_0_12px_rgba(245,185,66,0.8)]'
                        : 'w-2 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                );
              })}
            </div>
          )}
        </div>
      </motion.section>

      {/* =================================================================== */}
      {/* 2. 3D LIVE ROOM PORTALS (HIGH-DEPTH ARTWORK + LIVE BADGE + GLASS CTA) */}
      {/* =================================================================== */}
      {onOpenInDj && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08 }}
          transition={{ type: 'spring', stiffness: 290, damping: 26, delay: 0.06 }}
          className="space-y-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl liquid-glass-capsule text-[#F5B942]">
                <Disc3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
                  {t('3D Live Sonic Rooms', 'اتاق‌های صوتی سه‌بعدی زنده')}
                </h2>
                <p className="text-xs text-[#CBD5E1]/75">
                  {t(
                    'Step inside Western Saloon Cafe, Live Concert Arena, 3D Club, or Audiobook Hall',
                    'تجربه زنده در سالون کافه وسترن، استیج کنسرت، کلاب پارتی و کتابخانه صوتی'
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SONIC_ROOM_CARDS.map((room, idx) => {
              const Icon = room.icon;
              const matchingTrack = catalog.find((c) => c.id === room.trackId) || catalog[0];
              return (
                <motion.button
                  key={room.id}
                  type="button"
                  initial={{ opacity: 0, y: 24, scale: 0.94, filter: 'blur(6px)' }}
                  whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                  viewport={{ once: true, amount: 0.08 }}
                  whileHover={{ y: -4, scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{
                    type: 'spring',
                    stiffness: 320,
                    damping: 26,
                    delay: idx * 0.075
                  }}
                  onClick={() => onOpenInDj(matchingTrack, 'dj_console')}
                  className="group spatial-portal-sheen relative text-start rounded-[26px] overflow-hidden min-h-[220px] p-4 flex flex-col justify-between cursor-pointer shadow-[0_22px_52px_-14px_rgba(0,0,0,0.85)]"
                >
                  {/* Full-bleed Volumetric Room Artwork */}
                  <img
                    src={room.imageUrl}
                    alt={t(room.titleEn, room.titleFa)}
                    className="absolute inset-0 h-full w-full object-cover opacity-55 transition-transform duration-700 group-hover:scale-108"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#05060B]/95 via-[#05060B]/55 to-black/25" />
                  {/* Dynamic Room Color Backlight */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-10 -end-10 h-32 w-32 rounded-full blur-2xl opacity-45 group-hover:opacity-75 transition-opacity"
                    style={{ backgroundColor: room.accentHex }}
                  />
                  {/* Specular Glass Rim */}
                  <div className="pointer-events-none absolute inset-0 rounded-[26px] ring-1 ring-inset ring-white/18 group-hover:ring-white/35 transition-all" />

                  {/* Top Row: Tiny Luminous LIVE • [User Count] Badge + Room Icon */}
                  <div className="relative z-10 flex items-center justify-between gap-2 w-full">
                    <span className="holo-micro-badge inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-[#F8FAFC]">
                      <span
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor: '#34D399',
                          boxShadow: '0 0 8px #34D399'
                        }}
                      />
                      <span dir="ltr" className="font-mono-tabular tracking-wide">
                        LIVE • {room.liveUsers}
                      </span>
                    </span>

                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full liquid-glass-capsule"
                      style={{ color: room.accentHex }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>

                  {/* Bottom Room Title & Glowing Holographic CTA */}
                  <div className="relative z-10 space-y-2.5 pt-8">
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-[#F8FAFC] group-hover:text-[#F5B942] transition-colors">
                        {t(room.titleEn, room.titleFa)}
                      </h3>
                      <p className="text-[11px] text-[#E2E8F0]/80 line-clamp-2 leading-relaxed">
                        {t(room.subtitleEn, room.subtitleFa)}
                      </p>
                    </div>

                    <div
                      className="inline-flex items-center gap-1.5 rounded-full liquid-glass-capsule px-3 py-1.5 text-[11px] font-bold text-[#F8FAFC] transition-all group-hover:brightness-110"
                      style={{
                        borderColor: `${room.accentHex}55`,
                        boxShadow: `0 6px 20px -6px ${room.accentHex}66, inset 0 1px 0 rgba(255,255,255,0.28)`
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: room.accentHex }}
                      />
                      <span>{t('Enter 3D Room', 'وارد اتاق سه‌بعدی شوید')}</span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* =================================================================== */}
      {/* 3. FLOATING LIQUID GLASS REALM SWITCHER                             */}
      {/* =================================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full liquid-glass-capsule p-1.5">
          {(
            [
              {
                id: 'all_audio',
                fa: 'همه اصوات',
                en: 'All Audio',
                icon: <Volume2 className="h-4 w-4" />
              },
              {
                id: 'music',
                fa: `موسیقی (${musicItems.length})`,
                en: `Music (${musicItems.length})`,
                icon: <Music className="h-4 w-4" />
              },
              {
                id: 'podcast',
                fa: `پادکست (${podcastItems.length})`,
                en: `Podcasts (${podcastItems.length})`,
                icon: <Mic className="h-4 w-4" />
              },
              {
                id: 'audiobook',
                fa: `کتاب صوتی (${audiobookItems.length})`,
                en: `Audiobooks (${audiobookItems.length})`,
                icon: <BookOpen className="h-4 w-4" />
              }
            ] as const
          ).map((tab) => {
            const active = activeRealm === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveRealm(tab.id)}
                className={`relative min-h-[38px] shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                  active ? 'text-[#06070C]' : 'text-[#CBD5E1] hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="homeRealmGlassPill"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-full liquid-glass-cta-gold"
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  {tab.icon}
                  <span>{t(tab.en, tab.fa)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* =================================================================== */}
      {/* 4. MUSIC & NIGHT MIXES ROW                                          */}
      {/* =================================================================== */}
      {(activeRealm === 'all_audio' || activeRealm === 'music') && musicItems.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08 }}
          transition={{ type: 'spring', stiffness: 290, damping: 26 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Music className="h-5 w-5 text-[#F5B942]" />
              <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
                {t('Music & Late-Night Sonic Mixes', 'موسیقی و میکس‌های شبانه')}
              </h2>
            </div>
            <span className="text-xs font-mono-tabular text-[#CBD5E1]/70">
              {musicItems.length} {t('tracks', 'قطعه')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {musicItems.map(({ item, reason }, idx) => (
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
                onOpenInDj={onOpenInDj ? (it) => onOpenInDj(it, 'dj_console') : undefined}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* =================================================================== */}
      {/* 5. PODCASTS & DEEP CONVERSATIONS ROW                                */}
      {/* =================================================================== */}
      {(activeRealm === 'all_audio' || activeRealm === 'podcast') && podcastItems.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08 }}
          transition={{ type: 'spring', stiffness: 290, damping: 26 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Mic className="h-5 w-5 text-[#38BDF8]" />
              <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
                {t('Podcasts & Deep Studio Talks', 'پادکست‌ها و گفتگوهای استودیویی')}
              </h2>
            </div>
            <span className="text-xs font-mono-tabular text-[#CBD5E1]/70">
              {podcastItems.length} {t('episodes', 'اپیزود')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {podcastItems.map(({ item, reason }, idx) => (
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
                onOpenInDj={onOpenInDj ? (it) => onOpenInDj(it, 'dj_console') : undefined}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* =================================================================== */}
      {/* 6. 3D AUDIOBOOKS & NARRATED STORIES ROW                             */}
      {/* =================================================================== */}
      {(activeRealm === 'all_audio' || activeRealm === 'audiobook') && audiobookItems.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08 }}
          transition={{ type: 'spring', stiffness: 290, damping: 26 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-5 w-5 text-[#A855F7]" />
              <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
                {t('Spatial Audiobooks & Noir Stories', 'کتاب‌های صوتی و روایت‌های سه‌بعدی')}
              </h2>
            </div>
            <span className="text-xs font-mono-tabular text-[#CBD5E1]/70">
              {audiobookItems.length} {t('audiobooks', 'کتاب صوتی')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {audiobookItems.map(({ item, reason }, idx) => (
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
                onOpenInDj={onOpenInDj ? (it) => onOpenInDj(it, 'dj_console') : undefined}
              />
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}
