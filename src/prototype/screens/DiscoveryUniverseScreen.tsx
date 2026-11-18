import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AudioLines,
  Bookmark,
  Camera,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Volume2,
  Wand2
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  DownloadRecord,
  PlaybackProgress,
  PrototypeMediaItem,
  TasteVector,
  UiLang
} from '../types';
import { CinemaPosterImage, MediaCard } from '../components/UiPrimitives';
import {
  RealStudioExplore3DCanvas,
  type StudioCameraPreset,
  type TapeEditState
} from '../components/RealStudioExplore3DCanvas';
import { computeMatchScore, explainRecommendation } from '../tasteEngine';
import { useAutoTranslation } from '../i18n';
import { djAudioController } from '../djAudioEngine';
import { playCassetteLatchSound } from '../tapeFxEngine';

interface DiscoveryUniverseScreenProps {
  catalog: PrototypeMediaItem[];
  lang: UiLang;
  userVector: TasteVector;
  personalizationEnabled: boolean;
  liteMode: boolean;
  favoriteIds: Set<string>;
  hiddenIds: Set<string>;
  downloadsMap: Record<string, DownloadRecord>;
  progressMap: Record<string, PlaybackProgress>;
  feedbackMap: Record<string, any>;
  onToggleLiteMode: (lite: boolean) => void;
  onPlay: (item: PrototypeMediaItem) => void;
  onWatchTrailer?: (item: PrototypeMediaItem) => void;
  onDownload: (item: PrototypeMediaItem, saveAsFile?: boolean) => void;
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onToggleFavorite: (itemOrId: any) => void;
  onFeedback: (itemOrId: any, type: any) => void;
  onHide: (item: PrototypeMediaItem) => void;
  onOpenInDj?: (
    item?: PrototypeMediaItem,
    tab?: 'dj_console' | 'concert_stage' | 'cafe_room' | 'party_room' | 'library_room' | 'playlist_studio'
  ) => void;
  onActivePlaybackChange?: (track: PrototypeMediaItem, isPlaying: boolean) => void;
  isHostVisible?: boolean;
}

const DEFAULT_TAPE_EDIT: TapeEditState = {
  speed: 1.0,
  warmth: 0.25,
  echo: 0.2,
  isSideB: false
};

export function DiscoveryUniverseScreen({
  catalog,
  lang,
  userVector,
  personalizationEnabled,
  liteMode,
  favoriteIds,
  hiddenIds,
  downloadsMap,
  progressMap,
  feedbackMap,
  onToggleLiteMode,
  onPlay,
  onDownload,
  onOpenDetail,
  onToggleFavorite,
  onFeedback,
  onHide,
  onActivePlaybackChange,
  isHostVisible = true
}: DiscoveryUniverseScreenProps) {
  const { t } = useAutoTranslation(lang);

  const visibleItems = useMemo(
    () => catalog.filter((item) => !hiddenIds.has(item.id)),
    [catalog, hiddenIds]
  );

  // Featured singer cassettes on the real studio desk (preserve user's distinct artists first)
  const deskTapes = useMemo(() => {
    const musicFirst = [
      ...visibleItems.filter((x) => x.mediaType === 'music'),
      ...visibleItems.filter((x) => x.mediaType !== 'music')
    ];
    return musicFirst.slice(0, 7);
  }, [visibleItems]);

  const [selectedTapeId, setSelectedTapeId] = useState<string>(
    () => deskTapes[1]?.id || deskTapes[0]?.id || ''
  );
  const [isTapePlaying, setIsTapePlaying] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<StudioCameraPreset>('desk_studio');
  const [showEditDrawer, setShowEditDrawer] = useState<boolean>(false);

  const [tapeEdits, setTapeEdits] = useState<Record<string, TapeEditState>>({});
  const [flipSeq, setFlipSeq] = useState<number>(0);
  const [rewindSeq, setRewindSeq] = useState<number>(0);
  const [stampSeq, setStampSeq] = useState<number>(0);

  useEffect(() => {
    if (deskTapes.length > 0 && !deskTapes.some((x) => x.id === selectedTapeId)) {
      setSelectedTapeId(deskTapes[0].id);
    }
  }, [deskTapes, selectedTapeId]);

  const selectedItem = useMemo(
    () => deskTapes.find((x) => x.id === selectedTapeId) || deskTapes[0] || null,
    [deskTapes, selectedTapeId]
  );

  const activeEdit: TapeEditState = useMemo(
    () => (selectedItem && tapeEdits[selectedItem.id]) || DEFAULT_TAPE_EDIT,
    [selectedItem, tapeEdits]
  );

  useEffect(() => {
    if (isHostVisible && selectedItem) {
      onActivePlaybackChange?.(selectedItem, isTapePlaying);
    }
  }, [isHostVisible, isTapePlaying, onActivePlaybackChange, selectedItem]);

  // Sync live cassette playback + tape edits with Web Audio Engine
  useEffect(() => {
    if (!isHostVisible) return;
    if (!selectedItem || !isTapePlaying) {
      djAudioController.stopAll();
      return;
    }

    const activeCfg = {
      track: selectedItem,
      isPlaying: true,
      currentTimeSec: 0,
      pitchRate: activeEdit.speed,
      volume: 0.88,
      eqLowDb: Math.round(activeEdit.warmth * 6),
      eqMidDb: activeEdit.isSideB ? 2 : 0,
      eqHighDb: Math.round(activeEdit.echo * 3 - activeEdit.warmth * 4),
      filterSweep: -activeEdit.warmth * 0.62,
      activeLoopBeats: activeEdit.isSideB ? 4 : null
    };

    const idleB = { ...activeCfg, isPlaying: false };
    djAudioController.syncState(activeCfg, idleB, -1, 0.85, false);
  }, [activeEdit, isHostVisible, isTapePlaying, selectedItem]);

  useEffect(() => {
    if (!isHostVisible && isTapePlaying) {
      setIsTapePlaying(false);
    }
  }, [isHostVisible, isTapePlaying]);

  // Stop Web Audio cleanly when leaving Discovery screen
  useEffect(() => {
    return () => {
      djAudioController.stopAll();
    };
  }, []);

  const updateActiveTapeEdit = useCallback(
    (patch: Partial<TapeEditState>) => {
      if (!selectedItem) return;
      setTapeEdits((prev) => ({
        ...prev,
        [selectedItem.id]: {
          ...(prev[selectedItem.id] || DEFAULT_TAPE_EDIT),
          ...patch
        }
      }));
    },
    [selectedItem]
  );

  const handleToggleTapePlay = useCallback(() => {
    setIsTapePlaying((prev) => {
      const next = !prev;
      playCassetteLatchSound(next ? 'load' : 'eject');
      return next;
    });
  }, []);

  const handleFlipCassetteSide = useCallback(() => {
    playCassetteLatchSound('flip');
    setFlipSeq((s) => s + 1);
    updateActiveTapeEdit({ isSideB: !activeEdit.isSideB });
  }, [activeEdit.isSideB, updateActiveTapeEdit]);

  const handleRewindCassette = useCallback(() => {
    playCassetteLatchSound('rewind');
    setRewindSeq((s) => s + 1);
  }, []);

  const handleStampTapeEdit = useCallback(() => {
    playCassetteLatchSound('stamp');
    setStampSeq((s) => s + 1);
    updateActiveTapeEdit({
      editedLabel: `${activeEdit.speed.toFixed(2)}x ${activeEdit.isSideB ? 'B-EDIT' : 'MASTER'}`
    });
  }, [activeEdit.isSideB, activeEdit.speed, updateActiveTapeEdit]);

  const handleAgentTuneTape = useCallback(async () => {
    if (!selectedItem) return;
    playCassetteLatchSound('stamp');
    try {
      const res = await fetch('/api/agents/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'cassette',
          query: `${selectedItem.titleEn} ${selectedItem.categoryEn || ''}`
        })
      });
      if (res.ok) {
        const data = (await res.json()) as {
          sound?: {
            tapeEditPreset?: { speed: number; warmth: number; echo: number; labelFa: string };
          };
        };
        const preset = data.sound?.tapeEditPreset;
        if (preset) {
          setStampSeq((s) => s + 1);
          updateActiveTapeEdit({
            speed: preset.speed,
            warmth: preset.warmth,
            echo: preset.echo,
            editedLabel: preset.labelFa
          });
        }
      }
    } catch {
      // keep existing tape edit cleanly offline
    }
  }, [selectedItem, updateActiveTapeEdit]);

  const handleStepSingerTape = useCallback(
    (dir: -1 | 1) => {
      if (deskTapes.length === 0) return;
      const idx = deskTapes.findIndex((x) => x.id === selectedTapeId);
      const nextIdx = (idx + dir + deskTapes.length) % deskTapes.length;
      playCassetteLatchSound('eject');
      setSelectedTapeId(deskTapes[nextIdx].id);
    },
    [deskTapes, selectedTapeId]
  );

  const cycleCameraPreset = useCallback(() => {
    const order: StudioCameraPreset[] = ['desk_studio', 'cassette_deck', 'notebook_focus'];
    setCameraPreset((curr) => order[(order.indexOf(curr) + 1) % order.length]);
  }, []);

  const aiReasonText = useMemo(() => {
    if (!selectedItem) return '';
    return explainRecommendation(userVector, selectedItem, lang);
  }, [selectedItem, userVector, lang]);

  const matchScore = useMemo(() => {
    if (!selectedItem) return 99;
    return personalizationEnabled ? computeMatchScore(userVector, selectedItem.vector) : 99;
  }, [selectedItem, userVector, personalizationEnabled]);

  if (!selectedItem) return null;

  const selectedTitle = t(selectedItem.titleEn, selectedItem.titleFa);
  const selectedArtist = t(
    selectedItem.creatorEn || selectedItem.sourceName,
    selectedItem.creatorFa || selectedItem.sourceName
  );
  const selectedCategory = t(selectedItem.categoryEn, selectedItem.categoryFa);

  if (liteMode) {
    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-[#F5F7FA]">
            {t('Explore Sonic Catalog', 'کاوش آثار صوتی')}
          </h1>
          <button
            type="button"
            onClick={() => onToggleLiteMode(false)}
            className="min-h-[40px] inline-flex items-center gap-2 rounded-full liquid-glass-capsule px-4 text-xs font-semibold text-[#F5B942] cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{t('3D Studio View', 'نمای استودیو سه‌بعدی')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {visibleItems.map((item) => {
            const reason = explainRecommendation(userVector, item, lang);
            return (
              <MediaCard
                key={item.id}
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
      </div>
    );
  }

  return (
    <div className="relative -mx-3 sm:mx-0 -mt-5 sm:mt-0">
      <motion.section
        initial={{ opacity: 0, scale: 1.04, filter: 'blur(10px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-[calc(100dvh-7.4rem)] min-h-[590px] max-h-[860px] w-full sm:rounded-[34px] overflow-hidden bg-transparent shadow-[0_24px_80px_rgba(0,0,0,0.85)] select-none"
      >
        {/* Specular hairline rim on desktop */}
        <div className="pointer-events-none hidden sm:block absolute inset-0 rounded-[34px] ring-1 ring-inset ring-white/15 z-20" />

        {/* REAL-WORLD 3D PENTHOUSE MUSIC STUDIO DESK CANVAS */}
        <RealStudioExplore3DCanvas
          tapes={deskTapes}
          selectedTapeId={selectedItem.id}
          isPlaying={isTapePlaying}
          cameraPreset={cameraPreset}
          tapeEdits={tapeEdits}
          flipSeq={flipSeq}
          rewindSeq={rewindSeq}
          stampSeq={stampSeq}
          isActive={isHostVisible}
          onSelectTape={(id) => {
            playCassetteLatchSound('eject');
            setSelectedTapeId(id);
          }}
          onTogglePlay={handleToggleTapePlay}
          onInteractProp={(prop) => {
            if (prop === 'notebook') {
              setCameraPreset((c) => (c === 'notebook_focus' ? 'desk_studio' : 'notebook_focus'));
            } else if (prop === 'headphones' || prop === 'orb') {
              setCameraPreset('desk_studio');
            }
          }}
        />

        {/* Subtle gradient vignette only at very top & bottom edges for glass card contrast */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* TOP LIQUID-GLASS AI MATCH CAPSULE */}
        <motion.div
          initial={{ opacity: 0, y: -18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.1 }}
          className="pointer-events-none absolute top-3 inset-x-3 z-20 flex justify-center"
        >
          <div className="pointer-events-auto w-full max-w-md rounded-[28px] liquid-glass-capsule spatial-portal-sheen px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleStepSingerTape(-1)}
                aria-label={t('Previous Cassette', 'کاست قبلی')}
                className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full text-[#E2E8F0]/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {lang === 'fa' ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>

              <div className="min-w-0 flex-1 text-center space-y-0.5">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span
                    dir="ltr"
                    className="holo-micro-badge inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-[#F5B942] font-mono-tabular"
                  >
                    ♪ {matchScore}% MATCH
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#F5B942] truncate">
                    <Sparkles className="h-3 w-3 shrink-0" />
                    <span>{t('AI Sonic Match', 'تحلیل تطابق صوتی هوش مصنوعی')}</span>
                  </span>
                </div>
                <p className="text-[11px] text-[#E2E8F0]/88 truncate px-1">{aiReasonText}</p>
              </div>

              <button
                type="button"
                onClick={() => handleStepSingerTape(1)}
                aria-label={t('Next Cassette', 'کاست بعدی')}
                className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full text-white/90 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <AudioLines className="h-4 w-4 text-[#f5efe6]" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* ULTRA-MINIMAL BORDERLESS HOLOGRAPHIC CORNER VIEW CONTROLS */}
        <motion.div
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.16 }}
          className="absolute top-[5.8rem] end-3 z-20 flex flex-col gap-1.5"
        >
          <button
            type="button"
            onClick={cycleCameraPreset}
            aria-label={t('Switch Studio Camera', 'تغییر زاویه دوربین استودیو')}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-white/[0.06] backdrop-blur-xl text-[#F8FAFC]/85 hover:text-[#F5B942] hover:bg-white/[0.14] transition-colors cursor-pointer"
          >
            <Camera className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onToggleLiteMode(true)}
            aria-label={t('2D Grid View', 'نمای شبکه‌ای')}
            className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-white/[0.06] backdrop-blur-xl text-[#F8FAFC]/85 hover:text-[#F5B942] hover:bg-white/[0.14] transition-colors cursor-pointer"
          >
            <Layers className="h-4 w-4" />
          </button>
        </motion.div>

        {/* BOTTOM LIQUID-GLASS OVERLAY STACK */}
        <div className="absolute bottom-[4.85rem] sm:bottom-5 inset-x-3 z-20 flex flex-col items-center gap-2.5">
          {/* ANIMATED CASSETTE EDITOR DRAWER */}
          <AnimatePresence>
            {showEditDrawer && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                dir={lang === 'fa' ? 'rtl' : 'ltr'}
                className="w-full max-w-md rounded-[26px] liquid-glass-surface p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Wand2 className="h-3.5 w-3.5 text-[#F5B942] shrink-0" />
                    <span className="text-xs font-bold text-[#F5F7FA] truncate">
                      {t('Cassette Tape Edit', 'ادیت زنده نوار کاست')} · {selectedArtist}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleAgentTuneTape()}
                      className="inline-flex items-center gap-1 rounded-full liquid-glass-capsule px-2.5 py-1 text-[10px] font-semibold text-[#00F0FF] hover:bg-white/15 cursor-pointer"
                    >
                      <span>{t('ADK Auto', 'تنظیم ایجنت')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleRewindCassette}
                      className="inline-flex items-center gap-1 rounded-full liquid-glass-capsule px-2.5 py-1 text-[10px] font-semibold text-[#F5B942] hover:bg-white/15 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>{t('Rewind', 'عقب‌زدن')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStampTapeEdit}
                      className="inline-flex items-center gap-1 rounded-full liquid-glass-cta-gold px-3 py-1 text-[10px] font-bold cursor-pointer"
                    >
                      <span>{t('Stamp & Save', 'ثبت در دفترچه')}</span>
                    </button>
                  </div>
                </div>

                {/* Singer Quick Selector Chips inside Editor */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {deskTapes.map((tp) => {
                    const active = tp.id === selectedItem.id;
                    return (
                      <button
                        key={tp.id}
                        type="button"
                        onClick={() => {
                          playCassetteLatchSound('eject');
                          setSelectedTapeId(tp.id);
                        }}
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer ${
                          active
                            ? 'liquid-glass-cta-gold font-bold'
                            : 'holo-micro-badge text-[#CBD5E1] hover:text-white'
                        }`}
                      >
                        {t(tp.creatorEn || tp.sourceName, tp.creatorFa || tp.sourceName)}
                      </button>
                    );
                  })}
                </div>

                {/* Tactile Analog Sliders controlling 3D Brass Deck Knobs & Tape Spin Speed */}
                <div className="grid grid-cols-3 gap-2.5">
                  <label className="space-y-1 block">
                    <div className="flex items-center justify-between text-[10px] text-[#E2E8F0]">
                      <span>{t('Speed', 'سرعت نوار')}</span>
                      <span dir="ltr" className="font-mono-tabular text-[#F5B942]">
                        {activeEdit.speed.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.75}
                      max={1.25}
                      step={0.05}
                      value={activeEdit.speed}
                      onChange={(e) => updateActiveTapeEdit({ speed: Number(e.target.value) })}
                      className="w-full aether-slider"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <div className="flex items-center justify-between text-[10px] text-[#E2E8F0]">
                      <span>{t('Warmth', 'گرمای آنالوگ')}</span>
                      <span dir="ltr" className="font-mono-tabular text-[#F5B942]">
                        {Math.round(activeEdit.warmth * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={activeEdit.warmth}
                      onChange={(e) => updateActiveTapeEdit({ warmth: Number(e.target.value) })}
                      className="w-full aether-slider"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <div className="flex items-center justify-between text-[10px] text-[#E2E8F0]">
                      <span>{t('Echo', 'اکو استودیو')}</span>
                      <span dir="ltr" className="font-mono-tabular text-[#F5B942]">
                        {Math.round(activeEdit.echo * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={activeEdit.echo}
                      onChange={(e) => updateActiveTapeEdit({ echo: Number(e.target.value) })}
                      className="w-full aether-slider"
                    />
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3 LIQUID-GLASS ACTION CAPSULES */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.2 }}
            className="w-full max-w-md flex items-center justify-center gap-2"
          >
            <button
              type="button"
              onClick={handleToggleTapePlay}
              className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-full px-3.5 text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isTapePlaying
                  ? 'border border-[#F5B942]/65 bg-[#F5B942]/20 backdrop-blur-2xl text-[#F5B942] shadow-[0_0_20px_rgba(245,185,66,0.28)]'
                  : 'liquid-glass-capsule text-[#F5F7FA] hover:border-white/35'
              }`}
            >
              <Volume2 className="h-3.5 w-3.5 shrink-0" />
              <span>
                {isTapePlaying
                  ? t('Tape Playing', 'در حال پخش کاست')
                  : t('Insert & Play', 'گذاشتن در ضبط')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleFlipCassetteSide}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full liquid-glass-capsule px-3.5 text-[11px] font-semibold text-[#F5F7FA] hover:border-white/35 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Disc3 className="h-3.5 w-3.5 shrink-0 text-[#f3e5ab]" />
              <span>
                {activeEdit.isSideB
                  ? t('Side B · Flip A', 'روی B · برگرداندن')
                  : t('Side A · Flip B', 'روی A · برگرداندن')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowEditDrawer((v) => !v)}
              className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-full px-3.5 text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                showEditDrawer
                  ? 'border border-[#F5B942] bg-[#F5B942]/20 backdrop-blur-2xl text-[#F5B942]'
                  : 'liquid-glass-capsule text-[#F5F7FA] hover:border-white/35'
              }`}
            >
              <Sliders className="h-3.5 w-3.5 shrink-0" />
              <span>{t('Edit Tape', 'ادیت کاست')}</span>
            </button>
          </motion.div>

          {/* BOTTOM LIQUID-GLASS SELECTED SINGER CASSETTE CARD */}
          <motion.div
            key={selectedItem.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.24 }}
            className="w-full max-w-md rounded-[28px] liquid-glass-surface spatial-portal-sheen p-3.5"
          >
            <div className="flex items-center gap-3.5">
              {/* Cover Artwork Thumbnail */}
              <button
                type="button"
                onClick={() => onOpenDetail(selectedItem)}
                className="relative h-[94px] w-[94px] shrink-0 rounded-2xl overflow-hidden border border-white/20 shadow-lg cursor-pointer"
              >
                <CinemaPosterImage
                  item={selectedItem}
                  title={selectedTitle}
                  className="h-full w-full object-cover"
                />
              </button>

              {/* Singer Metadata + Glowing 3D Golden-Glass CTA + Bookmark */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    dir="ltr"
                    className="holo-micro-badge inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-[#38BDF8] font-mono-tabular"
                  >
                    ⚡ {Math.round((selectedItem.bpm || 92) * activeEdit.speed)} BPM ·{' '}
                    {selectedItem.musicalKey || 'Cm'}
                  </span>
                  <span className="text-[10px] text-[#CBD5E1]/80 truncate">
                    {selectedCategory}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC] truncate">
                  {selectedTitle}
                </h3>

                <p className="text-[11px] text-[#CBD5E1]/85 truncate">
                  {selectedArtist} ·{' '}
                  {activeEdit.isSideB
                    ? `Side B (${activeEdit.speed.toFixed(2)}x)`
                    : selectedItem.audioSpec || 'Master FLAC 24-Bit'}
                </p>

                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onPlay(selectedItem)}
                    className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-2 rounded-full liquid-glass-cta-gold px-4 text-xs font-black cursor-pointer whitespace-nowrap"
                  >
                    {isTapePlaying ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    <span>{t('Open Player', 'پخش قطعه صوتی')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleFavorite(selectedItem)}
                    aria-label={t('Favorite', 'افزودن به علاقه‌مندی‌ها')}
                    className={`h-[40px] w-[40px] shrink-0 inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                      favoriteIds.has(selectedItem.id)
                        ? 'border border-[#F5B942]/70 bg-[#F5B942]/20 backdrop-blur-xl text-[#F5B942]'
                        : 'liquid-glass-capsule text-[#F5F7FA]'
                    }`}
                  >
                    <Bookmark
                      className={`h-4 w-4 ${favoriteIds.has(selectedItem.id) ? 'fill-current' : ''}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
}
