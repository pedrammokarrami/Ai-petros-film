import React, { useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Disc3,
  FolderOpen,
  HardDriveUpload,
  Music,
  Play,
  Search,
  Sparkles,
  Wand2,
  X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  LanguageCode,
  OfflineDownloadRecord,
  PrototypeMediaItem,
  UserCollection
} from '../types';
import { inferMediaDomain } from '../prototypeData';

export type MusicPickerTab = 'library' | 'device' | 'catalog' | 'ai';

interface RoomMusicPickerModalProps {
  open: boolean;
  onClose: () => void;
  lang: LanguageCode;
  roomId: string;
  roomGlowHex: string;
  catalog: PrototypeMediaItem[];
  collections: UserCollection[];
  favoriteIds: Set<string>;
  downloadsMap: Record<string, OfflineDownloadRecord>;
  deviceTracks: PrototypeMediaItem[];
  onAddDeviceTrack: (item: PrototypeMediaItem) => void;
  onSelectTrackToPlay: (item: PrototypeMediaItem, noteFa?: string) => void;
  activeTrackId: string;
  activeDeviceName: string;
}

const AI_QUICK_PROMPTS = [
  'تکنو دارک ۱۲۸ BPM با بیس سنگین و اتمسفر برلین',
  'موزیک جاز بارانی و آرام کافه با پیانو و ساکسیفون',
  'اجرای زنده پاپ پرانرژی کنسرتی ۱۲۲ BPM',
  'موسیقی فضایی ملایم برای تمرکز و کتابخانه'
];

export function RoomMusicPickerModal({
  open,
  onClose,
  lang,
  roomId,
  roomGlowHex,
  catalog,
  collections,
  favoriteIds,
  downloadsMap,
  deviceTracks,
  onAddDeviceTrack,
  onSelectTrackToPlay,
  activeTrackId,
  activeDeviceName
}: RoomMusicPickerModalProps) {
  const isFa = lang === 'fa';
  const [tab, setTab] = useState<MusicPickerTab>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const libraryItems = useMemo(() => {
    const seen = new Set<string>();
    const list: PrototypeMediaItem[] = [];
    const pushItem = (it?: PrototypeMediaItem) => {
      if (!it || seen.has(it.id)) return;
      seen.add(it.id);
      list.push(it);
    };

    for (const id of favoriteIds) {
      pushItem(catalog.find((c) => c.id === id));
    }
    for (const id of Object.keys(downloadsMap)) {
      pushItem(catalog.find((c) => c.id === id));
    }
    for (const col of collections) {
      for (const id of col.itemIds) {
        pushItem(catalog.find((c) => c.id === id));
      }
    }
    if (list.length === 0) {
      catalog.filter((c) => inferMediaDomain(c) !== 'cinema').slice(0, 8).forEach(pushItem);
    }
    return list;
  }, [catalog, collections, downloadsMap, favoriteIds]);

  const catalogItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const audioPool = catalog.filter((c) => inferMediaDomain(c) !== 'cinema');
    const base = audioPool.length > 0 ? audioPool : catalog;
    if (!q) return base;
    return base.filter((it) =>
      `${it.titleFa} ${it.titleEn} ${it.creatorFa || ''} ${it.creatorEn || ''} ${it.categoryFa} ${it.tags.join(' ')}`
        .toLowerCase()
        .includes(q)
    );
  }, [catalog, searchQuery]);

  const handleDeviceFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const objectUrl = URL.createObjectURL(file);
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');

      let durationSec = 210;
      try {
        durationSec = await new Promise<number>((resolve) => {
          const probe = new Audio();
          probe.preload = 'metadata';
          probe.onloadedmetadata = () => {
            const d = Number.isFinite(probe.duration) && probe.duration > 5 ? Math.round(probe.duration) : 210;
            resolve(d);
          };
          probe.onerror = () => resolve(210);
          probe.src = objectUrl;
        });
      } catch {
        durationSec = 210;
      }

      const template = catalog[0];
      const newTrack: PrototypeMediaItem = {
        ...template,
        id: `device-${Date.now()}-${i}`,
        mediaType: 'music',
        bpm: 118,
        musicalKey: 'Cm',
        audioSpec: `${file.type || 'Audio'} · Local Device`,
        titleFa: cleanTitle,
        titleEn: cleanTitle,
        creatorFa: `${activeDeviceName} (فایل دستگاه)`,
        creatorEn: `${activeDeviceName} (Local File)`,
        categoryFa: 'از دستگاه من',
        categoryEn: 'From My Device',
        durationSec,
        posterUrl: '/assets/aistudio/image_12f14924.png',
        accentHex: roomGlowHex,
        synopsisFa: `فایل صوتی انتخاب‌شده از حافظه دستگاه ${activeDeviceName}`,
        synopsisEn: `Local audio file from ${activeDeviceName}`,
        sourceName: activeDeviceName,
        audioUrl: objectUrl,
        addedByDeviceName: activeDeviceName,
        addedVia: 'local'
      };

      onAddDeviceTrack(newTrack);
      if (i === files.length - 1) {
        onSelectTrackToPlay(newTrack, `فایل «${cleanTitle}» از دستگاه شما پخش شد.`);
        onClose();
      }
    }
  };

  const handleAskAiSelect = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? aiPrompt).trim();
    if (!prompt || aiBusy) return;
    setAiBusy(true);
    setAiFeedback(null);

    try {
      const summary = catalog
        .filter((c) => inferMediaDomain(c) !== 'cinema')
        .slice(0, 20)
        .map((c) => ({
          id: c.id,
          titleFa: c.titleFa,
          titleEn: c.titleEn,
          bpm: c.bpm,
          musicalKey: c.musicalKey,
          categoryFa: c.categoryFa,
          mediaType: c.mediaType,
          tags: c.tags
        }));

      const res = await fetch('/api/rooms/ai-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          roomId,
          catalogSummary: summary
        })
      });

      const data = (await res.json()) as {
        matchedCatalogId?: string;
        titleFa: string;
        titleEn: string;
        creatorFa: string;
        creatorEn: string;
        bpm: number;
        musicalKey: string;
        accentHex: string;
        reasonFa: string;
      };

      const matchedCatalog = data.matchedCatalogId
        ? catalog.find((c) => c.id === data.matchedCatalogId)
        : undefined;

      const selectedItem: PrototypeMediaItem = matchedCatalog
        ? {
            ...matchedCatalog,
            bpm: data.bpm || matchedCatalog.bpm,
            musicalKey: data.musicalKey || matchedCatalog.musicalKey,
            addedByDeviceName: activeDeviceName
          }
        : {
            ...catalog[0],
            id: `ai-track-${Date.now()}`,
            mediaType: roomId === 'audiobook' ? 'audiobook' : roomId === 'podcast' ? 'podcast' : 'music',
            bpm: data.bpm || 116,
            musicalKey: data.musicalKey || 'Cm',
            audioSpec: 'AI Live Mix · Spatial Audio',
            titleFa: data.titleFa,
            titleEn: data.titleEn,
            creatorFa: data.creatorFa,
            creatorEn: data.creatorEn,
            categoryFa: 'انتخاب هوشمند AI',
            categoryEn: 'AI Curated',
            posterUrl: '/assets/aistudio/IMG_4476_612f85f5.png',
            accentHex: data.accentHex || roomGlowHex,
            synopsisFa: data.reasonFa,
            synopsisEn: data.reasonFa,
            sourceName: 'Aether AI Sound Engine',
            addedByDeviceName: activeDeviceName
          };

      setAiFeedback(data.reasonFa);
      onSelectTrackToPlay(selectedItem, data.reasonFa);
      onClose();
    } catch {
      setAiFeedback(
        isFa ? 'خطا در ارتباط با هوش مصنوعی. دوباره تلاش کنید.' : 'Could not reach AI selector.'
      );
    } finally {
      setAiBusy(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        dir={isFa ? 'rtl' : 'ltr'}
        className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[86dvh] flex flex-col rounded-t-[30px] sm:rounded-[30px] border border-white/15 bg-[#080b14]/95 shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <span
                className="h-9 w-9 rounded-2xl flex items-center justify-center border border-white/15"
                style={{ backgroundColor: `${roomGlowHex}22`, color: roomGlowHex }}
              >
                <Music className="h-4.5 w-4.5" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {isFa ? 'انتخاب موسیقی برای اتاق' : 'Select Music for Room'}
                </h3>
                <p className="text-[11px] text-[#94A3B8]">
                  {isFa
                    ? 'هر کسی آهنگ اضافه کند، آخرین آهنگ بلافاصله برای همه دیوایس‌ها پخش می‌شود'
                    : 'Anyone can add music — the last added track plays immediately for everyone'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="h-8 w-8 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 flex items-center justify-center cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 4 Source Tabs */}
          <div className="px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/10 bg-white/[0.02]">
            {(
              [
                { id: 'library', icon: Bookmark, fa: 'از کتابخانه من', en: 'My Library' },
                { id: 'device', icon: HardDriveUpload, fa: 'از دستگاه من', en: 'My Device' },
                { id: 'catalog', icon: Disc3, fa: 'موجودی اپلیکیشن', en: 'App Catalog' },
                { id: 'ai', icon: Sparkles, fa: 'هوش مصنوعی (متن)', en: 'Ask AI' }
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    active ? 'text-[#06070C] font-bold shadow-md' : 'text-[#CBD5E1] hover:bg-white/10'
                  }`}
                  style={active ? { backgroundColor: roomGlowHex } : undefined}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{isFa ? item.fa : item.en}</span>
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
            {tab === 'library' && (
              <div className="space-y-2.5">
                {libraryItems.map((track) => {
                  const isActive = track.id === activeTrackId;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => {
                        onSelectTrackToPlay(track);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between gap-3 rounded-2xl border p-3 text-start transition-all cursor-pointer ${
                        isActive
                          ? 'border-[#F5B942]/70 bg-[#F5B942]/10'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={track.posterUrl}
                          alt={isFa ? track.titleFa : track.titleEn}
                          className="h-11 w-11 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-white truncate">
                            {isFa ? track.titleFa : track.titleEn}
                          </div>
                          <div className="text-[11px] text-[#94A3B8] truncate">
                            {isFa ? track.creatorFa || track.categoryFa : track.creatorEn || track.categoryEn}{' '}
                            · {track.bpm || 110} BPM
                          </div>
                        </div>
                      </div>
                      <span
                        className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold text-[#06070C]"
                        style={{ backgroundColor: roomGlowHex }}
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>{isFa ? 'پخش' : 'Play'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {tab === 'device' && (
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
                  multiple
                  onChange={(e) => void handleDeviceFiles(e.target.files)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-2xl border-2 border-dashed border-white/20 hover:border-[#F5B942]/70 bg-white/[0.03] hover:bg-white/[0.06] p-6 flex flex-col items-center justify-center gap-2.5 text-center transition-all cursor-pointer"
                >
                  <div
                    className="h-12 w-12 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${roomGlowHex}22`, color: roomGlowHex }}
                  >
                    <FolderOpen className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-bold text-white">
                    {isFa ? 'انتخاب فایل صوتی از حافظه دستگاه' : 'Choose Audio File from Device'}
                  </div>
                  <p className="text-[11px] text-[#94A3B8] max-w-sm">
                    {isFa
                      ? 'فرمت‌های MP3، WAV، M4A، OGG و FLAC پشتیبانی می‌شوند و بلافاصله روی استیج و رقص‌نور اتاق پخش می‌شوند.'
                      : 'MP3, WAV, M4A, OGG & FLAC supported — plays natively with full live 3D room reactivity.'}
                  </p>
                </button>

                {deviceTracks.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#CBD5E1]">
                      {isFa ? 'فایل‌های انتخاب‌شده در این نشست' : 'Uploaded Device Tracks'}
                    </div>
                    {deviceTracks.map((track) => (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => {
                          onSelectTrackToPlay(track);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] p-3 text-start cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{track.titleFa}</div>
                          <div className="text-[10px] text-[#94A3B8] truncate">{track.audioSpec}</div>
                        </div>
                        <span
                          className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold text-[#06070C]"
                          style={{ backgroundColor: roomGlowHex }}
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>{isFa ? 'پخش' : 'Play'}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'catalog' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="h-4 w-4 text-[#94A3B8] absolute top-1/2 -translate-y-1/2 start-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isFa ? 'جستجو در موجودی موسیقی و پادکست اپلیکیشن...' : 'Search app catalog...'}
                    className="w-full rounded-2xl border border-white/15 bg-[#04060c] ps-10 pe-4 py-2.5 text-xs text-white placeholder:text-[#64748B] focus:border-[#F5B942] focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  {catalogItems.map((track) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => {
                        onSelectTrackToPlay(track);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between gap-3 rounded-2xl border p-3 text-start transition-all cursor-pointer ${
                        track.id === activeTrackId
                          ? 'border-[#F5B942]/70 bg-[#F5B942]/10'
                          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={track.posterUrl}
                          alt={isFa ? track.titleFa : track.titleEn}
                          className="h-10 w-10 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {isFa ? track.titleFa : track.titleEn}
                          </div>
                          <div className="text-[11px] text-[#94A3B8] truncate">
                            {isFa ? track.categoryFa : track.categoryEn} · {track.bpm || 110} BPM ·{' '}
                            {track.musicalKey || 'Cm'}
                          </div>
                        </div>
                      </div>
                      <span
                        className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold text-[#06070C]"
                        style={{ backgroundColor: roomGlowHex }}
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>{isFa ? 'پخش' : 'Play'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'ai' && (
              <div className="space-y-3.5">
                <div className="rounded-2xl border border-[#34D399]/25 bg-[#34D399]/10 p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#34D399]">
                    <Wand2 className="h-4 w-4" />
                    <span>{isFa ? 'فقط بنویس چه حس‌وحالی می‌خوای!' : 'Just describe what music you want'}</span>
                  </div>
                  <p className="text-[11px] text-[#CBD5E1]/90 leading-relaxed">
                    {isFa
                      ? 'هوش مصنوعی متن شما را تحلیل می‌کند و بهترین قطعه و ریتم هماهنگ با اتمسفر اتاق را بلافاصله برای همه اجرا می‌کند.'
                      : 'AI analyzes your prompt and selects/generates matching tempo, key, and track vibe instantly.'}
                  </p>
                </div>

                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={
                    isFa
                      ? 'مثلاً: یک آهنگ تکنو کوبنده و تاریک برای پارتی آخر شب یا موسیقی جز بارانی برای کافه...'
                      : 'e.g. Dark 128 BPM techno with heavy bass or warm rainy cafe jazz...'
                  }
                  className="w-full rounded-2xl border border-white/15 bg-[#04060c] p-3.5 text-xs text-white placeholder:text-[#64748B] focus:border-[#34D399] focus:outline-none resize-none"
                />

                <div className="flex flex-wrap gap-1.5">
                  {AI_QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setAiPrompt(q);
                        void handleAskAiSelect(q);
                      }}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] text-[#E2E8F0] hover:bg-white/15 cursor-pointer text-start"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {aiFeedback && (
                  <p className="text-xs text-[#34D399] leading-relaxed">{aiFeedback}</p>
                )}

                <button
                  type="button"
                  disabled={aiBusy || !aiPrompt.trim()}
                  onClick={() => void handleAskAiSelect()}
                  className="w-full min-h-[44px] rounded-2xl font-bold text-xs text-[#06070C] flex items-center justify-center gap-2 disabled:opacity-45 cursor-pointer shadow-lg"
                  style={{ backgroundColor: roomGlowHex }}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {aiBusy
                      ? isFa
                        ? 'در حال انتخاب و آماده‌سازی توسط AI...'
                        : 'Selecting with AI...'
                      : isFa
                        ? 'ساخت و پخش فوری در اتاق'
                        : 'Select & Play in Room'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
