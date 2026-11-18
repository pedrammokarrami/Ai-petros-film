import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Compass,
  Disc3,
  Globe2,
  Home,
  Search,
  Settings
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import type {
  FeedbackRecord,
  LanguageCode,
  LibraryTab,
  OfflineDownloadRecord,
  PrototypeMediaItem,
  PrototypeRoute,
  SearchFilterState,
  TasteVector6D,
  UiSimulationState,
  UniverseRealmFilter,
  UserAccountState,
  UserCollection,
  WatchProgressEntry
} from './types';
import {
  filterCatalogByRealm,
  INITIAL_USER_STATE,
  PROTOTYPE_MEDIA_CATALOG
} from './prototypeData';
import {
  blendVector,
  calibrateColdStartVector,
  DEFAULT_TASTE_VECTOR
} from './tasteEngine';
import {
  clearVaultSnapshot,
  getVaultByteSize,
  loadVaultFromIndexedDb,
  loadVaultSnapshot,
  saveVaultSnapshot
} from './localVault';
import {
  deleteOfflineMediaBlob,
  formatBytes,
  generateDownloadableMediaClip,
  loadOfflineMediaBlob,
  saveOfflineMediaBlob,
  triggerBrowserDownload
} from './downloadEngine';
import {
  getLanguageDirection,
  I18nProvider,
  LanguagePickerModal,
  useT
} from './i18n';
import type { BackendStreamQuality } from './filmDetailsClient';
import { StateBoundary, ToastBanner, ToastMessage } from './components/UiPrimitives';
import {
  LivingAmbientCanvas,
  type AmbientThemeId
} from './components/LivingAmbientCanvas';
import { SpatialCommandCenter } from './components/SpatialCommandCenter';
import { EntryFlow } from './screens/EntryFlow';
import { LivingHomeScreen } from './screens/LivingHomeScreen';
import { DiscoveryUniverseScreen } from './screens/DiscoveryUniverseScreen';
import { DjStudioScreen, type SonicRoomId } from './screens/DjStudioScreen';
import { IntelligentSearchScreen } from './screens/IntelligentSearchScreen';
import { ContentDetailModal } from './screens/ContentDetailModal';
import { CinematicPlayerScreen } from './screens/CinematicPlayerScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { djAudioController, type DjDeckConfig } from './djAudioEngine';
import { scheduleIdleRoomAssetWarming } from '../services/roomAssetPreloader';

const INITIAL_PROGRESS_SEED: Record<string, WatchProgressEntry> = {
  'music-01': {
    contentId: 'music-01',
    positionSec: 92,
    durationSec: 348,
    completed: false,
    lastWatchedAt: new Date(Date.now() - 1800_000).toISOString()
  },
  'music-02': {
    contentId: 'music-02',
    positionSec: 140,
    durationSec: 412,
    completed: false,
    lastWatchedAt: new Date(Date.now() - 2400_000).toISOString()
  },
  'podcast-01': {
    contentId: 'podcast-01',
    positionSec: 640,
    durationSec: 2880,
    completed: false,
    lastWatchedAt: new Date(Date.now() - 3200_000).toISOString()
  },
  'book-01': {
    contentId: 'book-01',
    positionSec: 1120,
    durationSec: 3420,
    completed: false,
    lastWatchedAt: new Date(Date.now() - 5400_000).toISOString()
  }
};

const INITIAL_COLLECTIONS_SEED: UserCollection[] = [
  {
    id: 'col-cyber-dj-set',
    name: 'میکس دی‌جی سایبرپانک و نئون (DJ Set)',
    descriptionFa: 'قطعات سینث‌ویو، تکنو ملودیک و امبینت هماهنگ با BPM برای میکس دوگانه',
    descriptionEn: 'BPM-matched synthwave, melodic techno & ambient tracks ready for dual-deck mixing',
    itemIds: ['music-01', 'music-03', 'music-06', 'music-04', 'music-07'],
    createdAt: new Date().toISOString(),
    accentHex: '#F5B942',
    moodTagFa: 'انرژی بالا · میکس دی‌جی',
    moodTagEn: 'High Energy · DJ Mix',
    isSmartGenerated: true
  },
  {
    id: 'col-podcast-audiobook',
    name: 'پادکست‌ها و کتاب‌های صوتی آخر شب',
    descriptionFa: 'معماری ذهن، فلسفه صدا و روایت‌های صوتی عمیق برای تمرکز شبانه',
    descriptionEn: 'Deep nocturnal podcasts and spatial audiobooks for late-night focus',
    itemIds: ['podcast-01', 'book-01', 'podcast-02', 'book-03', 'podcast-04'],
    createdAt: new Date().toISOString(),
    accentHex: '#38BDF8',
    moodTagFa: 'گفت‌وگو و کتاب صوتی',
    moodTagEn: 'Podcasts & Audiobooks',
    isSmartGenerated: false
  },
  {
    id: 'col-late-night',
    name: 'شب‌های بارانی و جَز کافه',
    descriptionFa: 'ترکیب موسیقی جَز نوآر، لو-فای و روایت‌های آرام شبانه',
    descriptionEn: 'Velvet nocturnal jazz, rain lo-fi, and late-night audio stories',
    itemIds: ['music-02', 'music-05', 'book-02', 'book-04', 'podcast-04'],
    createdAt: new Date().toISOString(),
    accentHex: '#A855F7',
    moodTagFa: 'خلوت شبانه',
    moodTagEn: 'Late Night Mood',
    isSmartGenerated: false
  }
];

const INITIAL_SEARCH_FILTERS: SearchFilterState = {
  query: '',
  mode: 'all',
  mediaDomain: 'all_audio',
  excludeTags: [],
  maxDurationMin: null,
  minQuality: 'all',
  unwatchedOnly: false,
  sortBy: 'relevance'
};

function mergeCatalogWithDefaults(savedCatalog?: PrototypeMediaItem[]): PrototypeMediaItem[] {
  if (!savedCatalog || savedCatalog.length === 0) {
    return PROTOTYPE_MEDIA_CATALOG;
  }
  const map = new Map<string, PrototypeMediaItem>();
  for (const item of PROTOTYPE_MEDIA_CATALOG) {
    map.set(item.id, item);
  }
  for (const saved of savedCatalog) {
    // Strip any cinema/movie items that may have been cached in localStorage
    if (
      saved.mediaType === 'cinema' ||
      saved.id.startsWith('proto-') ||
      saved.id.startsWith('cinema-')
    ) {
      continue;
    }
    if (!map.has(saved.id)) {
      map.set(saved.id, saved);
    }
  }
  return Array.from(map.values());
}

function mergeCollectionsWithDefaults(savedCollections?: UserCollection[]): UserCollection[] {
  if (!savedCollections || savedCollections.length === 0) {
    return INITIAL_COLLECTIONS_SEED;
  }
  const existingIds = new Set(savedCollections.map((c) => c.id));
  const merged = [...savedCollections];
  for (const seed of INITIAL_COLLECTIONS_SEED) {
    if (!existingIds.has(seed.id)) {
      merged.push(seed);
    }
  }
  return merged;
}

function sanitizeLoadedDownloads(
  raw?: Record<string, OfflineDownloadRecord>
): Record<string, OfflineDownloadRecord> {
  if (!raw) return {};
  const cleaned: Record<string, OfflineDownloadRecord> = {};
  for (const [id, rec] of Object.entries(raw)) {
    if (rec && rec.status === 'completed' && !id.startsWith('proto-')) {
      cleaned[id] = rec;
    }
  }
  return cleaned;
}

function buildDownloadFilename(item: PrototypeMediaItem, mimeType: string): string {
  const slug =
    item.titleEn
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || item.id;
  if (mimeType.includes('webm')) return `${slug}.webm`;
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return `${slug}.jpg`;
  if (mimeType.includes('png')) return `${slug}.png`;
  return `${slug}-offline.json`;
}

export function UniversePrototype() {
  const initialVault = useMemo(() => loadVaultSnapshot(), []);
  const [lang, setLang] = useState<LanguageCode>(() => initialVault?.lang ?? 'fa');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = getLanguageDirection(lang);
  }, [lang]);

  return (
    <I18nProvider lang={lang} onChangeLang={setLang}>
      <UniversePrototypeShell initialVault={initialVault} lang={lang} setLang={setLang} />
    </I18nProvider>
  );
}

function UniversePrototypeShell({
  initialVault,
  lang,
  setLang
}: {
  initialVault: ReturnType<typeof loadVaultSnapshot>;
  lang: LanguageCode;
  setLang: React.Dispatch<React.SetStateAction<LanguageCode>>;
}) {
  const { t, languageInfo } = useT();

  const [onboardingDone, setOnboardingDone] = useState<boolean>(true);
  const [route, setRoute] = useState<PrototypeRoute>('dj');
  const [visitedDjTab, setVisitedDjTab] = useState<boolean>(true);
  const [visitedDiscoverTab, setVisitedDiscoverTab] = useState<boolean>(false);
  const [realmFilter, setRealmFilter] = useState<UniverseRealmFilter>('all_audio');
  const [djStudioTab, setDjStudioTab] = useState<'dj_console' | 'playlist_studio'>('dj_console');
  const [djDeckATrackId, setDjDeckATrackId] = useState<string>('music-01');
  const [djDeckBTrackId, setDjDeckBTrackId] = useState<string>('music-03');

  const [uiState, setUiState] = useState<UiSimulationState>('normal');
  const [libraryTabRequest, setLibraryTabRequest] = useState<LibraryTab | undefined>(undefined);
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  useEffect(() => {
    if (route === 'dj') setVisitedDjTab(true);
    if (route === 'discover') setVisitedDiscoverTab(true);
  }, [route]);

  // Download & persistently cache all 3D models, Poly Haven textures, HDRIs, and graphics right after launch
  useEffect(() => {
    scheduleIdleRoomAssetWarming();
  }, []);

  const [catalog, setCatalog] = useState<PrototypeMediaItem[]>(() =>
    mergeCatalogWithDefaults(initialVault?.catalog)
  );
  const [user, setUser] = useState<UserAccountState>(() => initialVault?.user ?? INITIAL_USER_STATE);
  const [userVector, setUserVector] = useState<TasteVector6D>(
    () => initialVault?.userVector ?? DEFAULT_TASTE_VECTOR
  );

  const [progressMap, setProgressMap] = useState<Record<string, WatchProgressEntry>>(
    () => ({ ...INITIAL_PROGRESS_SEED, ...(initialVault?.progressMap ?? {}) })
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () =>
      new Set(
        (initialVault?.favoriteIds ?? ['music-01', 'music-02', 'podcast-01', 'book-01']).filter(
          (id) => !id.startsWith('proto-')
        )
      )
  );
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => new Set(initialVault?.hiddenIds ?? [])
  );
  const [recentIds, setRecentIds] = useState<string[]>(
    () =>
      (initialVault?.recentIds ?? ['music-01', 'music-02', 'podcast-01', 'book-01']).filter(
        (id) => !id.startsWith('proto-')
      )
  );
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackRecord>>(
    () => initialVault?.feedbackMap ?? {}
  );
  const [collections, setCollections] = useState<UserCollection[]>(() =>
    mergeCollectionsWithDefaults(initialVault?.collections)
  );
  const [downloadsMap, setDownloadsMap] = useState<Record<string, OfflineDownloadRecord>>(() =>
    sanitizeLoadedDownloads(initialVault?.downloads)
  );
  const downloadsMapRef = useRef(downloadsMap);
  downloadsMapRef.current = downloadsMap;

  const [searchFilters, setSearchFilters] = useState<SearchFilterState>(
    () => ({ ...INITIAL_SEARCH_FILTERS, ...(initialVault?.searchFilters ?? {}) })
  );
  const [selectedDetailItem, setSelectedDetailItem] = useState<PrototypeMediaItem | null>(null);
  const [playingItem, setPlayingItem] = useState<PrototypeMediaItem | null>(null);
  const [miniPlayerTrack, setMiniPlayerTrack] = useState<PrototypeMediaItem | null>(
    () => catalog[0] ?? null
  );
  const [miniPlayerPlaying, setMiniPlayerPlaying] = useState<boolean>(false);
  const [activeDjRoomTheme, setActiveDjRoomTheme] = useState<SonicRoomId>('cafe');
  const [playingQualityId, setPlayingQualityId] = useState<string | undefined>(undefined);
  const [playingPlaybackMode, setPlayingPlaybackMode] = useState<'movie' | 'trailer'>('movie');
  const [previousRouteBeforeWatch, setPreviousRouteBeforeWatch] =
    useState<PrototypeRoute>('universe');

  const [vaultSizeBytes, setVaultSizeBytes] = useState<number>(() => getVaultByteSize());
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // If localStorage was empty on boot, recover from IndexedDB backup if available
  useEffect(() => {
    if (initialVault) return;
    let active = true;
    void loadVaultFromIndexedDb().then((idbSnap) => {
      if (!active || !idbSnap) return;
      setLang(idbSnap.lang);
      setOnboardingDone(Boolean(idbSnap.onboardingDone || idbSnap.user?.ageVerified));
      if (idbSnap.onboardingDone || idbSnap.user?.ageVerified) {
        setRoute('universe');
      }
      setCatalog(mergeCatalogWithDefaults(idbSnap.catalog));
      setUser(idbSnap.user);
      setUserVector(idbSnap.userVector);
      setProgressMap({ ...INITIAL_PROGRESS_SEED, ...idbSnap.progressMap });
      setFavoriteIds(new Set(idbSnap.favoriteIds));
      setHiddenIds(new Set(idbSnap.hiddenIds));
      setRecentIds(idbSnap.recentIds);
      setFeedbackMap(idbSnap.feedbackMap);
      setCollections(mergeCollectionsWithDefaults(idbSnap.collections));
      setDownloadsMap(sanitizeLoadedDownloads(idbSnap.downloads));
      setSearchFilters({ ...INITIAL_SEARCH_FILTERS, ...idbSnap.searchFilters });
    });
    return () => {
      active = false;
    };
  }, [initialVault, setLang]);

  // Persist everything inside the application automatically on any change
  useEffect(() => {
    const snapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      lang,
      onboardingDone,
      user,
      userVector,
      progressMap,
      favoriteIds: Array.from(favoriteIds),
      hiddenIds: Array.from(hiddenIds),
      recentIds,
      feedbackMap,
      collections,
      downloads: sanitizeLoadedDownloads(downloadsMap),
      searchFilters,
      catalog
    };
    void saveVaultSnapshot(snapshot).then(() => {
      setVaultSizeBytes(getVaultByteSize());
    });
  }, [
    lang,
    onboardingDone,
    user,
    userVector,
    progressMap,
    favoriteIds,
    hiddenIds,
    recentIds,
    feedbackMap,
    collections,
    downloadsMap,
    searchFilters,
    catalog
  ]);

  // Global keyboard shortcut: Cmd/Ctrl + K jumps directly to Intelligent Search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setRoute('search');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((text: string, undoLabel?: string, onUndo?: () => void) => {
    setToast({ id: `${Date.now()}`, text, undoLabel, onUndo });
  }, []);

  const navigateTo = useCallback((nextRoute: PrototypeRoute) => {
    if (nextRoute !== 'library') {
      setLibraryTabRequest(undefined);
    }
    setRoute(nextRoute);
  }, []);

  const handleUpdateUser = useCallback((patch: Partial<UserAccountState>) => {
    setUser((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleApplyOnboardingPresets = useCallback(
    (presets: string[], blockedTopics: string[]) => {
      setUserVector(calibrateColdStartVector(presets));
      setUser((prev) => ({ ...prev, blockedTopics }));
      setOnboardingDone(true);
    },
    []
  );

  const handleQuickEnterUniverse = useCallback(() => {
    setUser((prev) => ({
      ...prev,
      ageVerified: true
    }));
    setOnboardingDone(true);
    setRoute('universe');
  }, []);

  const handleOpenDetail = useCallback((item: PrototypeMediaItem) => {
    setSelectedDetailItem(item);
    setRecentIds((prev) => [item.id, ...prev.filter((x) => x !== item.id)].slice(0, 12));
  }, []);

  const handlePlayItem = useCallback(
    (item: PrototypeMediaItem, selectedQuality?: BackendStreamQuality) => {
      setSelectedDetailItem(null);
      if (route !== 'watch') {
        setPreviousRouteBeforeWatch(route);
      }
      setPlayingItem(item);
      setMiniPlayerTrack(item);
      setMiniPlayerPlaying(true);
      setPlayingQualityId(selectedQuality?.id);
      setPlayingPlaybackMode('movie');
      setRecentIds((prev) => [item.id, ...prev.filter((x) => x !== item.id)].slice(0, 12));
      setRoute('watch');
      if (user.personalizationEnabled) {
        setUserVector((prev) => blendVector(prev, item.vector, 0.12));
      }
    },
    [route, user.personalizationEnabled]
  );

  const handleToggleMiniPlayer = useCallback(() => {
    if (!miniPlayerTrack) return;
    setMiniPlayerPlaying((prev) => {
      const next = !prev;
      if (next) {
        const cfg: DjDeckConfig = {
          track: miniPlayerTrack,
          isPlaying: true,
          currentTimeSec: 0,
          pitchRate: 1,
          volume: 0.9,
          eqLowDb: 0,
          eqMidDb: 0,
          eqHighDb: 0,
          filterSweep: 0,
          activeLoopBeats: null
        };
        djAudioController.syncState(cfg, { ...cfg, isPlaying: false }, -1, 0.9, false);
      } else {
        djAudioController.stopAll();
      }
      return next;
    });
  }, [miniPlayerTrack]);

  const handleWatchTrailer = useCallback(
    (item: PrototypeMediaItem, selectedQuality?: BackendStreamQuality) => {
      setSelectedDetailItem(null);
      if (route !== 'watch') {
        setPreviousRouteBeforeWatch(route);
      }
      setPlayingItem(item);
      setPlayingQualityId(selectedQuality?.id);
      setPlayingPlaybackMode('trailer');
      setRoute('watch');
    },
    [route]
  );

  // Offline Download Engine (In-App IndexedDB Vault + Direct Save to Device)
  const handleDownloadItem = useCallback(
    async (
      item: PrototypeMediaItem,
      saveFileToDevice = false,
      selectedQuality?: Partial<BackendStreamQuality>
    ) => {
      const existing = downloadsMapRef.current[item.id];
      if (existing?.status === 'downloading') return;
      const itemTitle = t(item.titleEn, item.titleFa);
      const effectiveQuality = selectedQuality?.resolution || item.quality;

      if (existing?.status === 'completed') {
        const cachedBlob = await loadOfflineMediaBlob(item.id);
        if (cachedBlob) {
          if (saveFileToDevice) {
            triggerBrowserDownload(cachedBlob, buildDownloadFilename(item, existing.mimeType));
            showToast(`${itemTitle} — ${t('Saved to your device.', 'در دستگاه شما ذخیره شد.')}`);
          } else {
            showToast(
              `${itemTitle} — ${t('Already saved in Offline Library.', 'قبلاً در کتابخانه آفلاین ذخیره شده است.')}`,
              t('Open Downloads', 'مشاهده دانلودها'),
              () => {
                setLibraryTabRequest('downloads');
                setRoute('library');
              }
            );
          }
          return;
        }
      }

      setDownloadsMap((prev) => ({
        ...prev,
        [item.id]: {
          contentId: item.id,
          titleFa: item.titleFa,
          titleEn: item.titleEn,
          quality: effectiveQuality,
          fileSizeBytes: 0,
          mimeType: 'video/webm',
          downloadedAt: new Date().toISOString(),
          status: 'downloading',
          progressPct: 8
        }
      }));

      let lastPct = 8;
      const result = await generateDownloadableMediaClip(item, (pct) => {
        if (pct - lastPct < 10 && pct < 100) return;
        lastPct = pct;
        setDownloadsMap((prev) => {
          const cur = prev[item.id];
          if (!cur || cur.status !== 'downloading') return prev;
          return {
            ...prev,
            [item.id]: { ...cur, progressPct: pct }
          };
        });
      });

      await saveOfflineMediaBlob(item.id, result.blob);

      setDownloadsMap((prev) => ({
        ...prev,
        [item.id]: {
          contentId: item.id,
          titleFa: item.titleFa,
          titleEn: item.titleEn,
          quality: effectiveQuality,
          fileSizeBytes: result.blob.size,
          mimeType: result.mimeType,
          downloadedAt: new Date().toISOString(),
          status: 'completed',
          progressPct: 100
        }
      }));

      if (saveFileToDevice) {
        triggerBrowserDownload(result.blob, result.filename);
      }

      showToast(
        `${t('Downloaded', 'دانلود کامل شد')}: ${itemTitle} (${formatBytes(result.blob.size)})`,
        t('Downloads', 'دانلودهای من'),
        () => {
          setLibraryTabRequest('downloads');
          setRoute('library');
        }
      );
    },
    [showToast, t]
  );

  const handleSaveDownloadToDevice = useCallback(
    async (item: PrototypeMediaItem) => {
      const existing = downloadsMapRef.current[item.id];
      const blob = await loadOfflineMediaBlob(item.id);
      if (blob) {
        triggerBrowserDownload(blob, buildDownloadFilename(item, existing?.mimeType || blob.type));
        showToast(
          `${t(item.titleEn, item.titleFa)} — ${t('Saved file to device.', 'فایل روی دستگاه دانلود شد.')}`
        );
        return;
      }
      await handleDownloadItem(item, true);
    },
    [handleDownloadItem, showToast, t]
  );

  const handleDeleteDownload = useCallback(
    (contentId: string) => {
      void deleteOfflineMediaBlob(contentId);
      setDownloadsMap((prev) => {
        const next = { ...prev };
        delete next[contentId];
        return next;
      });
      showToast(t('Offline download deleted.', 'فایل آفلاین حذف شد.'));
    },
    [showToast, t]
  );

  const handleToggleFavorite = useCallback(
    (itemOrId: PrototypeMediaItem | string) => {
      const resolvedItem =
        typeof itemOrId === 'string'
          ? catalog.find((c) => c.id === itemOrId)
          : itemOrId;
      const targetId = typeof itemOrId === 'string' ? itemOrId : itemOrId.id;
      const wasFavorite = favoriteIds.has(targetId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) {
          next.delete(targetId);
        } else {
          next.add(targetId);
        }
        return next;
      });
      if (wasFavorite) {
        showToast(t('Removed from Archive', 'از آرشیو حذف شد'));
      } else {
        showToast(t('Saved to VIP Archive', 'در آرشیو بلیت‌های VIP ذخیره شد'));
        if (user.personalizationEnabled && resolvedItem) {
          setUserVector((v) => blendVector(v, resolvedItem.vector, 0.16));
        }
      }
    },
    [catalog, favoriteIds, showToast, t, user.personalizationEnabled]
  );

  const handleFeedback = useCallback(
    (item: PrototypeMediaItem, sentiment: 'like' | 'dislike' | 'less_like_this') => {
      const prevRecord = feedbackMap[item.id];
      const prevVec = userVector;
      setFeedbackMap((prev) => ({
        ...prev,
        [item.id]: { contentId: item.id, sentiment, updatedAt: new Date().toISOString() }
      }));

      if (user.personalizationEnabled) {
        if (sentiment === 'like') {
          setUserVector((v) => blendVector(v, item.vector, 0.24));
        } else {
          const invertedTarget: TasteVector6D = {
            tension: 1 - item.vector.tension,
            pace: 1 - item.vector.pace,
            surrealism: 1 - item.vector.surrealism,
            nocturnal: 1 - item.vector.nocturnal,
            intimacy: 1 - item.vector.intimacy,
            depth: 1 - item.vector.depth
          };
          setUserVector((v) => blendVector(v, invertedTarget, 0.18));
        }
      }

      showToast(
        sentiment === 'like'
          ? t('Taste calibrated (More like this)', 'سلیقه شما به‌روزرسانی شد (مشابه این بیشتر)')
          : t('Feed tuned down for this style', 'رتبه‌بندی تطبیق داده شد (کمتر از این سبک)'),
        t('Undo', 'بازگردانی'),
        () => {
          setFeedbackMap((curr) => {
            const copy = { ...curr };
            if (prevRecord) copy[item.id] = prevRecord;
            else delete copy[item.id];
            return copy;
          });
          setUserVector(prevVec);
        }
      );
    },
    [feedbackMap, userVector, user.personalizationEnabled, showToast, t]
  );

  const handleHideItem = useCallback(
    (item: PrototypeMediaItem) => {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
      showToast(
        t('Item hidden from your feeds', 'این مورد از فید شما مخفی شد'),
        t('Undo', 'لغو مخفی‌سازی'),
        () => {
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }
      );
    },
    [showToast, t]
  );

  const handleSaveProgress = useCallback(
    (contentId: string, positionSec: number, durationSec: number, completed = false) => {
      setProgressMap((prev) => ({
        ...prev,
        [contentId]: {
          contentId,
          positionSec,
          durationSec,
          completed,
          lastWatchedAt: new Date().toISOString()
        }
      }));
    },
    []
  );

  const handlePersonalizeTasteFromSearch = useCallback(
    (targetVector: TasteVector6D, alpha = 0.32) => {
      if (!user.personalizationEnabled) return;
      setUserVector((prev) => blendVector(prev, targetVector, alpha));
    },
    [user.personalizationEnabled]
  );

  const handleOpenInDj = useCallback(
    (item?: PrototypeMediaItem, studioTab: any = 'dj_console') => {
      if (item) {
        if (item.id === djDeckATrackId) {
          // already on Deck A
        } else if (item.id === djDeckBTrackId) {
          // already on Deck B
        } else {
          setDjDeckATrackId(item.id);
        }
        setRecentIds((prev) => [item.id, ...prev.filter((x) => x !== item.id)].slice(0, 12));
      }
      setDjStudioTab(studioTab === 'playlist_studio' ? 'playlist_studio' : 'dj_console');
      setRoute('dj');
    },
    [djDeckATrackId, djDeckBTrackId]
  );

  const handleCreatePlaylist = useCallback(
    (
      name: string,
      itemIds: string[] = [],
      meta?: {
        descriptionFa?: string;
        descriptionEn?: string;
        accentHex?: string;
        moodTagFa?: string;
        moodTagEn?: string;
        isSmartGenerated?: boolean;
      }
    ) => {
      const newCol: UserCollection = {
        id: `col-${Date.now()}`,
        name,
        itemIds,
        createdAt: new Date().toISOString(),
        descriptionFa: meta?.descriptionFa,
        descriptionEn: meta?.descriptionEn,
        accentHex: meta?.accentHex ?? '#F5B942',
        moodTagFa: meta?.moodTagFa,
        moodTagEn: meta?.moodTagEn,
        isSmartGenerated: meta?.isSmartGenerated
      };
      setCollections((prev) => [newCol, ...prev]);
      showToast(
        `${t('Playlist saved', 'پلی‌لیست ذخیره شد')}: ${name} (${itemIds.length} ${t('tracks', 'اثر')})`,
        t('Open Library', 'مشاهده کتابخانه'),
        () => {
          setLibraryTabRequest('collections');
          setRoute('library');
        }
      );
    },
    [showToast, t]
  );

  const handleReorderPlaylistItems = useCallback((colId: string, nextItemIds: string[]) => {
    setCollections((prev) =>
      prev.map((c) => (c.id === colId ? { ...c, itemIds: nextItemIds } : c))
    );
  }, []);

  const handleToggleCollectionItem = useCallback((colId: string, contentId: string) => {
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id !== colId) return c;
        const exists = c.itemIds.includes(contentId);
        return {
          ...c,
          itemIds: exists
            ? c.itemIds.filter((x) => x !== contentId)
            : [...c.itemIds, contentId]
        };
      })
    );
  }, []);

  const handleExportPersonalData = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      storageEngine: 'In-App Local Vault (localStorage + IndexedDB)',
      userAccount: user,
      tasteVector6D: userVector,
      watchProgress: progressMap,
      favoriteIds: Array.from(favoriteIds),
      collections,
      downloads: downloadsMap,
      feedbackMap
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personal-universe-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      t('Personal JSON archive downloaded.', 'خروجی داده‌های شما در قالب فایل JSON دانلود شد.')
    );
  }, [user, userVector, progressMap, favoriteIds, collections, downloadsMap, feedbackMap, showToast, t]);

  const handleResetPrototype = useCallback(() => {
    Object.keys(downloadsMapRef.current).forEach((id) => {
      void deleteOfflineMediaBlob(id);
    });
    void clearVaultSnapshot();
    setCatalog(PROTOTYPE_MEDIA_CATALOG);
    setUser(INITIAL_USER_STATE);
    setUserVector(DEFAULT_TASTE_VECTOR);
    setProgressMap(INITIAL_PROGRESS_SEED);
      setFavoriteIds(new Set(['music-01', 'music-02', 'podcast-01', 'book-01']));
    setHiddenIds(new Set());
    setRecentIds(['music-01', 'music-02', 'podcast-01', 'book-01']);
    setFeedbackMap({});
    setCollections(INITIAL_COLLECTIONS_SEED);
    setDownloadsMap({});
    setSearchFilters(INITIAL_SEARCH_FILTERS);
    setUiState('normal');
    setOnboardingDone(true);
    showToast(t('In-app memory wiped and reset cleanly.', 'حافظه داخل اپلیکیشن پاک‌سازی و بازنشانی شد.'));
  }, [showToast, t]);

  const realmFilteredCatalog = useMemo(() => {
    const filtered = filterCatalogByRealm(catalog, realmFilter);
    return filtered.length > 0 ? filtered : catalog;
  }, [catalog, realmFilter]);

  const effectiveNavItems: Array<{
    id: PrototypeRoute;
    fa: string;
    en: string;
    icon: React.ReactNode;
  }> = useMemo(
    () => [
      { id: 'universe', fa: 'صفحه اصلی', en: 'Home', icon: <Home className="h-[18px] w-[18px]" /> },
      { id: 'dj', fa: 'اتاق‌ها', en: 'Rooms', icon: <Disc3 className="h-[18px] w-[18px]" /> },
      { id: 'discover', fa: 'کاوش بی‌نهایت', en: 'Discover', icon: <Compass className="h-[19px] w-[19px]" /> },
      { id: 'search', fa: 'سرچ هوشمند', en: 'Search', icon: <Search className="h-[18px] w-[18px]" /> },
      { id: 'library', fa: 'کتابخانه', en: 'Library', icon: <Bookmark className="h-[18px] w-[18px]" /> }
    ],
    []
  );

  // Entry Gate Routes render full-screen without main app chrome
  if (
    route === 'splash' ||
    route === 'welcome' ||
    route === 'age-gate' ||
    route === 'onboarding'
  ) {
    return (
      <MotionConfig reducedMotion={user.reducedMotion ? 'always' : 'user'}>
        <div className={user.highContrast ? 'contrast-125' : ''}>
          <EntryFlow
            route={route}
            lang={lang}
            user={user}
            onOpenLanguagePicker={() => setLangPickerOpen(true)}
            onNavigate={(nextRoute) => {
              if (nextRoute === 'universe') {
                setOnboardingDone(true);
              }
              navigateTo(nextRoute);
            }}
            onUpdateUser={handleUpdateUser}
            onApplyOnboardingPresets={handleApplyOnboardingPresets}
            onQuickEnterUniverse={handleQuickEnterUniverse}
          />
          <LanguagePickerModal
            isOpen={langPickerOpen}
            currentLang={lang}
            onSelect={setLang}
            onClose={() => setLangPickerOpen(false)}
          />
          <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
        </div>
      </MotionConfig>
    );
  }

  const activeAmbientTheme: AmbientThemeId =
    route === 'dj'
      ? activeDjRoomTheme
      : route === 'discover' ||
          route === 'search' ||
          route === 'library' ||
          route === 'settings'
        ? route
        : 'universe';

  const showSpatialMiniPlayer =
    Boolean(miniPlayerTrack) && route !== 'watch' && route !== 'discover' && route !== 'dj';

  return (
    <MotionConfig reducedMotion={user.reducedMotion ? 'always' : 'user'}>
      <div
        className={`relative min-h-[100dvh] bg-[#05060B] text-[#F5F7FA] flex flex-col ${
          user.highContrast ? 'contrast-125' : ''
        } ${user.reducedMotion ? 'reduced-motion-mode' : ''}`}
      >
        {/* Dynamic Organic Living Ambient Light Canvas & Audio-Reactive Particles */}
        <LivingAmbientCanvas themeId={activeAmbientTheme} reducedMotion={user.reducedMotion} />

        {/* Airy Floating Transparent Header (Zero hard bottom border) */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="pointer-events-none sticky top-0 z-40"
        >
          <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
            {/* Floating Brand Capsule */}
            <button
              type="button"
              onClick={() => navigateTo('dj')}
              className="pointer-events-auto min-h-[38px] inline-flex items-center gap-2.5 rounded-full liquid-glass-capsule px-4 text-start cursor-pointer shrink-0"
            >
              <span className="font-editorial text-sm sm:text-base tracking-[0.12em] text-[#F5B942]">
                aipetros-sound
              </span>
              <span className="hidden lg:inline text-[11px] font-medium text-[#CBD5E1]/80">
                {t('Listen · Create · Explore', 'بشنو · بساز · کاوش کن')}
              </span>
            </button>

            {/* Floating Language & Settings Glass Controls */}
            <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigateTo('settings')}
                aria-label={t('Settings', 'تنظیمات')}
                className={`min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-full transition-all cursor-pointer ${
                  route === 'settings'
                    ? 'liquid-glass-cta-gold'
                    : 'liquid-glass-capsule text-[#CBD5E1] hover:text-[#F5F7FA]'
                }`}
              >
                <Settings className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setLangPickerOpen(true)}
                aria-label={t('Select World Language', 'انتخاب زبان اپلیکیشن')}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full liquid-glass-capsule px-3 text-xs font-medium text-[#F5F7FA] hover:border-[#F5B942]/55 cursor-pointer whitespace-nowrap"
              >
                <Globe2 className="h-3.5 w-3.5 text-[#F5B942]" />
                <span className="hidden sm:inline">{languageInfo.nativeName}</span>
                <span className="sm:hidden uppercase">{lang}</span>
              </button>
            </div>
          </div>
        </motion.header>

        {/* Main Content Container */}
        <main
          className={
            route === 'discover'
              ? 'relative z-10 flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 pt-0 sm:pt-3 pb-2'
              : `relative z-10 flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 pt-4 sm:pt-5 ${
                  showSpatialMiniPlayer
                    ? 'pb-[calc(9.5rem+env(safe-area-inset-bottom))]'
                    : 'pb-[calc(6rem+env(safe-area-inset-bottom))]'
                }`
          }
        >
          <StateBoundary
            state={uiState}
            lang={lang}
            onResetState={() => {
              setSearchFilters(INITIAL_SEARCH_FILTERS);
              setUiState('normal');
            }}
          >
            {/* Persistent Cached Heavy 3D Workspaces (Paused when hidden, 0ms instant switch) */}
            {visitedDjTab && (
              <div className={route === 'dj' ? '' : 'hidden'}>
                <DjStudioScreen
                  catalog={catalog}
                  lang={lang}
                  userVector={userVector}
                  favoriteIds={favoriteIds}
                  downloadsMap={downloadsMap}
                  collections={collections}
                  initialDeckATrackId={djDeckATrackId}
                  initialDeckBTrackId={djDeckBTrackId}
                  initialStudioTab={djStudioTab}
                  isHostVisible={route === 'dj'}
                  onRoomThemeChange={setActiveDjRoomTheme}
                  onActivePlaybackChange={(track, playing) => {
                    setMiniPlayerTrack(track);
                    setMiniPlayerPlaying(playing);
                  }}
                  onPlayTrack={handlePlayItem}
                  onOpenDetail={handleOpenDetail}
                  onDownloadTrack={(item) => void handleDownloadItem(item, false)}
                  onToggleFavorite={handleToggleFavorite}
                  onCreatePlaylist={(playlist) =>
                    handleCreatePlaylist(playlist.name, playlist.itemIds, {
                      descriptionFa: playlist.descriptionFa,
                      descriptionEn: playlist.descriptionEn,
                      accentHex: playlist.accentHex,
                      moodTagFa: playlist.moodTagFa,
                      moodTagEn: playlist.moodTagEn,
                      isSmartGenerated: true
                    })
                  }
                  onUpdatePlaylist={(playlistId, patch) => {
                    setCollections((prev) =>
                      prev.map((c) => (c.id === playlistId ? { ...c, ...patch } : c))
                    );
                  }}
                  onDeletePlaylist={(id) => {
                    setCollections((prev) => prev.filter((c) => c.id !== id));
                    showToast(t('Playlist deleted.', 'پلی‌لیست حذف شد.'));
                  }}
                />
              </div>
            )}

            {visitedDiscoverTab && (
              <div className={route === 'discover' ? '' : 'hidden'}>
                <DiscoveryUniverseScreen
                  catalog={catalog}
                  lang={lang}
                  userVector={userVector}
                  personalizationEnabled={user.personalizationEnabled}
                  liteMode={user.liteUniverseMode}
                  favoriteIds={favoriteIds}
                  downloadsMap={downloadsMap}
                  hiddenIds={hiddenIds}
                  progressMap={progressMap}
                  feedbackMap={feedbackMap}
                  isHostVisible={route === 'discover'}
                  onToggleLiteMode={(lite) => handleUpdateUser({ liteUniverseMode: lite })}
                  onOpenDetail={handleOpenDetail}
                  onPlay={handlePlayItem}
                  onActivePlaybackChange={(track, playing) => {
                    setMiniPlayerTrack(track);
                    setMiniPlayerPlaying(playing);
                  }}
                  onDownload={(item, saveFile) => void handleDownloadItem(item, saveFile)}
                  onToggleFavorite={handleToggleFavorite}
                  onFeedback={handleFeedback}
                  onHide={handleHideItem}
                />
              </div>
            )}

            {route !== 'dj' && route !== 'discover' && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={route}
                  initial={route === 'watch' ? { opacity: 0 } : { opacity: 0, y: 10 }}
                  animate={route === 'watch' ? { opacity: 1 } : { opacity: 1, y: 0 }}
                  exit={route === 'watch' ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  {route === 'universe' && (
                    <LivingHomeScreen
                      catalog={catalog}
                      lang={lang}
                      userVector={userVector}
                      personalizationEnabled={user.personalizationEnabled}
                      progressMap={progressMap}
                      favoriteIds={favoriteIds}
                      downloadsMap={downloadsMap}
                      hiddenIds={hiddenIds}
                      feedbackMap={feedbackMap}
                      onGoDiscover={() => navigateTo('discover')}
                      onOpenDetail={handleOpenDetail}
                      onPlay={handlePlayItem}
                      onWatchTrailer={(item) => handleWatchTrailer(item)}
                      onDownload={(item, saveFile) => void handleDownloadItem(item, saveFile)}
                      onToggleFavorite={handleToggleFavorite}
                      onFeedback={handleFeedback}
                      onHide={handleHideItem}
                      onOpenInDj={(item, tab) => handleOpenInDj(item, tab ?? 'dj_console')}
                    />
                  )}

                  {route === 'search' && (
                  <IntelligentSearchScreen
                    catalog={catalog}
                    lang={lang}
                    userVector={userVector}
                    recentSearches={[]}
                    progressMap={progressMap}
                    favoriteIds={favoriteIds}
                    downloadsMap={downloadsMap}
                    hiddenIds={hiddenIds}
                    feedbackMap={feedbackMap}
                    onAddRecentSearch={() => {}}
                    onClearRecentSearches={() => {}}
                    onOpenDetail={handleOpenDetail}
                    onPlay={handlePlayItem}
                    onWatchTrailer={(item) => handleWatchTrailer(item)}
                    onDownload={(item, saveFile) => void handleDownloadItem(item, saveFile)}
                    onToggleFavorite={handleToggleFavorite}
                    onFeedback={handleFeedback}
                    onHide={handleHideItem}
                  />
                )}

                {route === 'watch' && (
                  <CinematicPlayerScreen
                    item={playingItem || catalog[0]}
                    catalog={catalog}
                    lang={lang}
                    playbackMode={playingPlaybackMode}
                    progress={progressMap[(playingItem || catalog[0]).id]}
                    isFavorite={favoriteIds.has((playingItem || catalog[0]).id)}
                    isDownloaded={Boolean(downloadsMap[(playingItem || catalog[0]).id])}
                    downloadRecord={downloadsMap[(playingItem || catalog[0]).id]}
                    preferredQuality={user.preferredQuality}
                    defaultSubtitleLang={user.defaultSubtitleLang}
                    defaultSpeed={user.defaultSpeed}
                    reducedMotion={user.reducedMotion}
                    onUpdateProgress={handleSaveProgress}
                    onSelectItem={handlePlayItem}
                    onDownloadItem={(item, saveFile, quality) =>
                      void handleDownloadItem(item, saveFile, quality)
                    }
                    onToggleFavorite={handleToggleFavorite}
                    onOpenLanguagePicker={() => setLangPickerOpen(true)}
                    onBackToBrowse={() => navigateTo(previousRouteBeforeWatch)}
                    onOpenInDj={(item, tab) => handleOpenInDj(item, tab ?? 'dj_console')}
                  />
                )}

                {route === 'library' && (
                  <LibraryScreen
                    catalog={catalog}
                    lang={lang}
                    progressMap={progressMap}
                    favoriteIds={favoriteIds}
                    downloadsMap={downloadsMap}
                    hiddenIds={hiddenIds}
                    feedbackMap={feedbackMap}
                    collections={collections}
                    onOpenDetail={handleOpenDetail}
                    onPlay={handlePlayItem}
                    onDownload={(item, saveFile) => void handleDownloadItem(item, saveFile)}
                    onRemoveDownload={handleDeleteDownload}
                    onClearAllDownloads={() => {
                      setDownloadsMap({});
                      showToast(t('Offline files cleared.', 'فایل‌های آفلاین پاک شدند.'));
                    }}
                    onToggleFavorite={handleToggleFavorite}
                    onFeedback={handleFeedback}
                    onHide={handleHideItem}
                    onUnhide={(id) =>
                      setHiddenIds((prev) => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                      })
                    }
                    onCreateCollection={(name) => {
                      handleCreatePlaylist(name, []);
                    }}
                    onDeleteCollection={(id) => {
                      setCollections((prev) => prev.filter((c) => c.id !== id));
                      showToast(t('Collection deleted.', 'کلکسیون حذف شد.'));
                    }}
                    onRemoveFromCollection={(colId, contentId) => {
                      setCollections((prev) =>
                        prev.map((c) =>
                          c.id === colId
                            ? { ...c, itemIds: c.itemIds.filter((x) => x !== contentId) }
                            : c
                        )
                      );
                    }}
                    onClearHistory={() => {
                      setProgressMap({});
                      setRecentIds([]);
                      showToast(t('Playback history cleared.', 'تاریخچه پخش پاک شد.'));
                    }}
                    onOpenInDj={(item, tab) => handleOpenInDj(item, tab ?? 'dj_console')}
                    onOpenPlaylistStudio={() => handleOpenInDj(undefined, 'playlist_studio')}
                  />
                )}

                {route === 'settings' && (
                  <SettingsScreen
                    lang={lang}
                    user={user}
                    userVector={userVector}
                    vaultSizeBytes={vaultSizeBytes}
                    onChangeLang={setLang}
                    onOpenLanguagePicker={() => setLangPickerOpen(true)}
                    onUpdateUser={handleUpdateUser}
                    onUpdateTasteVector={(patch) =>
                      setUserVector((prev) => ({ ...prev, ...patch }))
                    }
                    onRevokeSession={(sessionId) => {
                      setUser((prev) => ({
                        ...prev,
                        sessions: prev.sessions.filter((s) => s.id !== sessionId)
                      }));
                      showToast(t('Session revoked.', 'دسترسی نشست لغو شد.'));
                    }}
                    onResetTasteAndHistory={() => {
                      setUserVector(DEFAULT_TASTE_VECTOR);
                      setFeedbackMap({});
                      setProgressMap({});
                      showToast(
                        t(
                          'Taste model and history reset.',
                          'مدل سلیقه و سابقه تعاملات بازنشانی شد.'
                        )
                      );
                    }}
                    onExportPersonalData={handleExportPersonalData}
                    onWipeLocalMemory={() => {
                      handleResetPrototype();
                      navigateTo('universe');
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
            )}
          </StateBoundary>
        </main>

        {/* Hovering Liquid-Glass Spatial Mini-Player Capsule */}
        <AnimatePresence>
          {showSpatialMiniPlayer && miniPlayerTrack && (
            <SpatialCommandCenter
              item={miniPlayerTrack}
              isPlaying={miniPlayerPlaying}
              lang={lang}
              accentHex={miniPlayerTrack.accentHex || '#F5B942'}
              onTogglePlay={handleToggleMiniPlayer}
              onOpenFullPlayer={() => handlePlayItem(miniPlayerTrack)}
            />
          )}
        </AnimatePresence>

        {/* Ultra-Thin Translucent Holographic Glass Bottom Navigation Dock */}
        <motion.nav
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.12 }}
          className="fixed bottom-[calc(0.6rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 w-[min(420px,calc(100vw-18px))] h-[56px] rounded-full liquid-glass-capsule px-1.5 flex items-center justify-around"
          aria-label="Primary Bottom Navigation"
        >
          {effectiveNavItems.map((nav) => {
            const active = route === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => navigateTo(nav.id)}
                className={`relative h-[48px] flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[9.5px] font-medium cursor-pointer transition-colors ${
                  active ? 'text-[#F8FAFC] font-bold' : 'text-[#CBD5E1]/70 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="holoNavGlassDome"
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    className="pointer-events-none absolute -top-2.5 h-[62px] w-[76px] rounded-full bg-[radial-gradient(circle_at_50%_26%,rgba(245,185,66,0.34)_0%,rgba(45,32,16,0.68)_58%,rgba(14,16,24,0.75)_100%)] border border-[#F5B942]/30 shadow-[0_10px_28px_rgba(0,0,0,0.6),0_0_24px_rgba(245,185,66,0.22),inset_0_1px_1px_rgba(255,255,255,0.28)]"
                  />
                )}
                <span className={`relative z-10 flex flex-col items-center gap-0.5 ${active ? '-mt-0.5' : ''}`}>
                  <motion.span
                    animate={active ? { scale: 1.12 } : { scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                    className={
                      active
                        ? 'text-[#F5B942] drop-shadow-[0_0_8px_rgba(245,185,66,0.75)]'
                        : ''
                    }
                  >
                    {nav.icon}
                  </motion.span>
                  <span className="whitespace-nowrap leading-tight tracking-tight">
                    {t(nav.en, nav.fa)}
                  </span>
                  {active && (
                    /* Micro-particle light dots below active icon */
                    <span className="mt-0.5 flex items-center gap-1">
                      <span className="h-[2.5px] w-[2.5px] rounded-full bg-[#F5B942]/70" />
                      <span className="h-[3.5px] w-[3.5px] rounded-full bg-[#F5B942] shadow-[0_0_8px_#F5B942]" />
                      <span className="h-[2.5px] w-[2.5px] rounded-full bg-[#F5B942]/70" />
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </motion.nav>

        {/* Content Detail Modal / Bottom Sheet */}
        <ContentDetailModal
          item={selectedDetailItem}
          catalog={catalog}
          lang={lang}
          isFavorite={selectedDetailItem ? favoriteIds.has(selectedDetailItem.id) : false}
          downloadRecord={selectedDetailItem ? downloadsMap[selectedDetailItem.id] : undefined}
          progress={selectedDetailItem ? progressMap[selectedDetailItem.id] : undefined}
          feedback={selectedDetailItem ? feedbackMap[selectedDetailItem.id] : undefined}
          collections={collections}
          onClose={() => setSelectedDetailItem(null)}
          onPlay={handlePlayItem}
          onWatchTrailer={handleWatchTrailer}
          onDownload={(item, saveFile, quality) => void handleDownloadItem(item, saveFile, quality)}
          onSelectItem={handleOpenDetail}
          onToggleFavorite={handleToggleFavorite}
          onToggleCollectionItem={(colId, contentId) => {
            setCollections((prev) =>
              prev.map((c) => {
                if (c.id !== colId) return c;
                const exists = c.itemIds.includes(contentId);
                return {
                  ...c,
                  itemIds: exists
                    ? c.itemIds.filter((x) => x !== contentId)
                    : [...c.itemIds, contentId]
                };
              })
            );
          }}
          onFeedback={handleFeedback}
          onHide={handleHideItem}
          onSubmitReport={(item) => {
            handleHideItem(item);
          }}
          onOpenLanguagePicker={() => setLangPickerOpen(true)}
        />

        {/* World Languages Picker Modal */}
        <LanguagePickerModal
          isOpen={langPickerOpen}
          currentLang={lang}
          onSelect={setLang}
          onClose={() => setLangPickerOpen(false)}
        />

        {/* Undo / Notification Toast */}
        <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </MotionConfig>
  );
}
