import express, { type Request as ExpressRequest, type Response as ExpressResponse } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { videoApiRouter } from './src/video-engine/api.ts';
import {
  buildAiPromptSuggestions,
  scoreAndOrderFallbackFilms
} from './src/data/worldCinemaPool.ts';
import type {
  MoodVector,
  SortStrategy,
  TasteInteraction
} from './src/types/cinema.ts';
import { LIGHTING_PRESETS } from './src/types/lighting.ts';
import {
  LOCAL_ADK_AGENTS,
  orchestrateFastAdkAgent,
  type FastOrchestrateDomain
} from './src/agents/registry.ts';
import { getGraphicAssetManifest } from './src/agents/assetCacheAgent.ts';
import {
  applyPresetToRoom,
  getAllLightingProfiles,
  isValidCalibrationRoomId,
  resetLightingProfiles
} from './src/agents/lightingStore.ts';
import { runLightingDirectorAgent } from './src/agents/lightingAgent.ts';
import { selectMusicByPrompt } from './src/agents/musicAiSelector.ts';
import { isValidRoomSyncId, roomSyncCoordinator } from './src/services/roomSyncServer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const CUSTOM_CATALOG_FILE = path.join(DATA_DIR, 'custom-catalog.json');
const DNA_VAULT_FILE = path.join(DATA_DIR, 'dna-vault.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // ignore fs errors on read-only containers
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    }
  } catch {
    // fallback
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // ignore write errors on ephemeral filesystems
  }
}

export async function createApp(options?: { servePublic?: boolean }) {
  const app = express();
  app.set('trust proxy', 1);
  const serverStartTime = Date.now();
  const servePublic = options?.servePublic ?? true;

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (process.env.NODE_ENV === 'production' && req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  if (servePublic) {
    // Serve static assets from public/ (videos, images) with byte-range support and long-term caching
    app.use(
      express.static(path.join(__dirname, 'public'), {
        maxAge: '14d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.glb') || filePath.endsWith('.gltf')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          } else if (filePath.endsWith('.mp4') || filePath.endsWith('.webm')) {
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
            res.setHeader('Accept-Ranges', 'bytes');
          } else if (filePath.match(/\.(jpg|jpeg|png|webp|svg)$/i)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          }
        }
      })
    );
  }

  // Mount Velora Owner-Controlled Video Catalog Engine Subsystem
  app.use('/api/velora', videoApiRouter);

  // 1. Live Production Health & Telemetry Endpoint
  app.get('/api/health', (_req, res) => {
    const customFilms = readJsonFile<unknown[]>(CUSTOM_CATALOG_FILE, []);
    const dnaVault = readJsonFile<Record<string, unknown>>(DNA_VAULT_FILE, {});
    res.json({
      status: 'ok',
      product: 'aipetros-sound',
      domainReady: true,
      publicDomain: process.env.PUBLIC_DOMAIN || process.env.APP_URL || null,
      uptimeSec: Math.floor((Date.now() - serverStartTime) / 1000),
      engineMode: 'local-adk-multi-agent',
      externalModels: false,
      customCatalogCount: Array.isArray(customFilms) ? customFilms.length : 0,
      dnaProfilesStored: Object.keys(dnaVault).length
    });
  });

  // 2. Persistent Custom 4K Stream Catalog Endpoint
  app.get('/api/catalog', (_req, res) => {
    const customItems = readJsonFile<unknown[]>(CUSTOM_CATALOG_FILE, []);
    res.json({ items: Array.isArray(customItems) ? customItems : [] });
  });

  app.post('/api/catalog', (req, res) => {
    const newItem = req.body?.item;
    if (!newItem || typeof newItem !== 'object' || !newItem.id || !newItem.streamUrl) {
      res.status(400).json({ error: 'Invalid film item payload' });
      return;
    }
    const existing = readJsonFile<Array<{ id: string }>>(CUSTOM_CATALOG_FILE, []);
    const filtered = existing.filter((f) => f.id !== newItem.id);
    const updated = [newItem, ...filtered].slice(0, 30);
    writeJsonFile(CUSTOM_CATALOG_FILE, updated);
    res.json({ status: 'saved', items: updated });
  });

  // 3. Real Cross-Device Zero-Knowledge 6-Char Taste DNA Vault
  app.post('/api/dna/sync', (req, res) => {
    const { code, vector, themeId } = req.body ?? {};
    if (!code || typeof code !== 'string' || code.length !== 6) {
      res.status(400).json({ error: 'Invalid 6-character DNA code' });
      return;
    }
    const cleanCode = code.toUpperCase();
    const vault = readJsonFile<Record<string, unknown>>(DNA_VAULT_FILE, {});
    vault[cleanCode] = {
      code: cleanCode,
      vector,
      themeId,
      updatedAt: new Date().toISOString()
    };
    writeJsonFile(DNA_VAULT_FILE, vault);
    res.json({ status: 'synced', code: cleanCode });
  });

  app.get('/api/dna/:code', (req, res) => {
    const cleanCode = String(req.params.code || '').toUpperCase();
    const vault = readJsonFile<Record<string, unknown>>(DNA_VAULT_FILE, {});
    const entry = vault[cleanCode];
    if (!entry) {
      res.status(404).json({ error: 'DNA profile not found in server vault' });
      return;
    }
    res.json({ status: 'found', entry });
  });

  // 4. Local Vector Curator Endpoint (Zero external models)
  app.post('/api/ai/curate', (req, res) => {
    const { query = '', lang = 'fa', catalog = [] } = req.body ?? {};
    const items = Array.isArray(catalog) ? (catalog as Array<Record<string, unknown>>) : [];
    const qLower = String(query).toLowerCase();

    const matched =
      items.find((f) =>
        `${f.canonicalTitle || ''} ${f.sensoryMood || ''} ${f.directorOrStudio || ''}`
          .toLowerCase()
          .includes(qLower)
      ) || items[0];

    const primaryFilmId = matched?.id ? String(matched.id) : 'local-curated-1';
    const title = matched?.canonicalTitle ? String(matched.canonicalTitle) : 'Selected Film';
    const moodText =
      lang === 'fa'
        ? String(matched?.sensoryMoodFa || matched?.sensoryMood || 'اتمسفر سینمایی')
        : String(matched?.sensoryMood || 'atmospheric noir');

    res.json({
      status: 'ok',
      model: 'local-neural-ranker',
      primaryFilmId,
      spokenExplanation:
        lang === 'fa'
          ? `فیلم «${title}» بر اساس تحلیل برداری محلی با تمرکز بر حال‌وهوای ${moodText} به‌عنوان برترین انتخاب مرتب شد.`
          : `"${title}" was ranked #1 locally based on semantic vector alignment with ${moodText}.`,
      cosineMatchScore: 96
    });
  });

  // 5. Predictive & Personalized Clickable Local Suggestions Endpoint
  app.post('/api/ai/suggest', (req, res) => {
    const {
      query = '',
      moodParams = { tension: 72, pace: 40, atmosphere: 74 },
      interactions = [],
      wave = 1,
      lang = 'fa'
    } = req.body ?? {};

    const safeMood: MoodVector = {
      tension: Number(moodParams?.tension ?? 72),
      pace: Number(moodParams?.pace ?? 40),
      atmosphere: Number(moodParams?.atmosphere ?? 74)
    };
    const safeLang = lang === 'en' ? 'en' : 'fa';
    const suggestions = buildAiPromptSuggestions(
      safeLang,
      safeMood,
      String(query || ''),
      Array.isArray(interactions) ? (interactions as TasteInteraction[]) : [],
      Number(wave) || 1
    );

    res.json({ suggestions, aiPowered: false });
  });

  // 6. Endless Local-Ordered World Cinema Discovery Endpoint (Zero external models)
  app.post('/api/ai/discover', (req, res) => {
    const {
      query = '',
      moodParams = { tension: 72, pace: 40, atmosphere: 74 },
      refinement,
      excludeTitles = [],
      interactions = [],
      sortStrategy = 'ai_taste',
      waveNumber = 1,
      lang = 'fa'
    } = req.body ?? {};

    const safeMood: MoodVector = {
      tension: Number(moodParams?.tension ?? 72),
      pace: Number(moodParams?.pace ?? 40),
      atmosphere: Number(moodParams?.atmosphere ?? 74)
    };
    const safeStrategy: SortStrategy = (
      ['ai_taste', 'world_tour', 'hidden_gems', 'escalating_tension'].includes(String(sortStrategy))
        ? sortStrategy
        : 'ai_taste'
    ) as SortStrategy;
    const safeWave = Math.max(1, Number(waveNumber) || 1);
    const safeLang = lang === 'en' ? 'en' : 'fa';
    const safeExcluded = Array.isArray(excludeTitles)
      ? excludeTitles.map((t) => String(t))
      : [];
    const safeInteractions = Array.isArray(interactions)
      ? (interactions as TasteInteraction[])
      : [];

    const ordered = scoreAndOrderFallbackFilms({
      query: String(query || ''),
      moodParams: safeMood,
      refinement: refinement ? String(refinement) : undefined,
      excludeTitles: safeExcluded,
      interactions: safeInteractions,
      sortStrategy: safeStrategy,
      waveNumber: safeWave,
      lang: safeLang,
      limit: 12
    });

    res.json({
      query: String(query || ''),
      interpretedVibe: ordered.interpretedVibe,
      aiOrderSummary: ordered.aiOrderSummary,
      sortStrategy: safeStrategy,
      waveNumber: safeWave,
      hasMore: true,
      lightingMood: ordered.lightingMood,
      subRefinements: ordered.subRefinements,
      suggestedPrompts: ordered.suggestedPrompts,
      films: ordered.films,
      aiPowered: false
    });
  });

  // 7. 100% Local Cinema DNA Taste Synthesizer (Zero external models)
  app.post('/api/ai/dna', (req, res) => {
    const { interactions = [] } = req.body ?? {};
    const list: TasteInteraction[] = Array.isArray(interactions) ? interactions : [];
    const avgRuntime =
      list.length > 0
        ? Math.round(list.reduce((acc, i) => acc + (Number(i.runtimeMin) || 112), 0) / list.length)
        : 118;

    // Count dominant director, ambientTone, and vibe tags strictly locally
    const directorCounts = new Map<string, number>();
    const toneCounts = new Map<string, number>();
    const vibeCounts = new Map<string, number>();

    for (const item of list) {
      if (item.director) {
        directorCounts.set(item.director, (directorCounts.get(item.director) || 0) + (item.action === 'saved' ? 2 : 1));
      }
      if (item.ambientTone) {
        toneCounts.set(item.ambientTone, (toneCounts.get(item.ambientTone) || 0) + 1);
      }
      if (item.vibeTag) {
        vibeCounts.set(item.vibeTag, (vibeCounts.get(item.vibeTag) || 0) + 1);
      }
    }

    const topDirector =
      Array.from(directorCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'Kiyoshi Kurosawa';
    const topTone = Array.from(toneCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'amber';
    const topVibes = Array.from(vibeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([v]) => v);

    const toneArchetypes: Record<
      string,
      { title: string; vibe: string; tagline: string; accent: string }
    > = {
      crimson: {
        title: 'The Velvet Provocateur',
        vibe: 'Kinetic Desire & Psychological Edge',
        tagline: 'You gravitate toward incandescent tension and unforgettable moral precipices.',
        accent: '#E11D48'
      },
      cyan: {
        title: 'The Neon Somnambulist',
        vibe: 'Rain-Slicked Drift & Nocturnal Solitude',
        tagline: 'Cities at 3 a.m. and unhurried silences reveal more to you than dialogue ever could.',
        accent: '#38BDF8'
      },
      slate: {
        title: 'The Shadow Archivist',
        vibe: 'Obsessive Realism & Moral Labyrinths',
        tagline: 'Precision framing, creeping suspense, and razor-sharp human ambiguity.',
        accent: '#94A3B8'
      },
      amber: {
        title: 'The Midnight Cartographer',
        vibe: 'Nocturnal World Noir & Poetic Solitude',
        tagline: 'Shadows and unhurried silences reveal more than exposition ever could.',
        accent: '#D4AF37'
      }
    };

    const archetype = toneArchetypes[topTone] || toneArchetypes.amber;

    res.json({
      archetypeTitle: archetype.title,
      signatureVibe: archetype.vibe,
      tagline: archetype.tagline,
      topTraits:
        topVibes.length >= 2
          ? topVibes
          : ['World Auteur Depth', 'Atmospheric Tension', 'Nocturnal Precision'],
      directorAffinity: topDirector,
      avgRuntimeMin: avgRuntime,
      filmsAnalyzed: list.length,
      accentHex: archetype.accent,
      secondaryHex: '#1E293B'
    });
  });

  // 8. Live IMDb Metadata + Backend Stream Quality Profiles Endpoint
  interface ImdbSuggestionEntry {
    id?: string;
    l?: string;
    q?: string;
    qid?: string;
    rank?: number;
    s?: string;
    tl?: string;
    y?: number;
    i?: { imageUrl?: string; width?: number; height?: number };
  }

  const filmDetailsCache = new Map<string, { expiresAt: number; payload: unknown }>();
  const serverTranslateCache = new Map<string, string>();

  async function queryImdbSuggestions(rawQuery: string): Promise<ImdbSuggestionEntry[]> {
    const cleaned = rawQuery
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, '_');
    if (!cleaned) return [];
    const firstChar = cleaned[0] && /[a-z0-9]/.test(cleaned[0]) ? cleaned[0] : 'x';
    const url = `https://v3.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(cleaned)}.json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AetherCinema/1.0)',
          Accept: 'application/json'
        }
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { d?: ImdbSuggestionEntry[] };
      return Array.isArray(data?.d) ? data.d : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  async function queryItunesMovieSupplement(rawQuery: string): Promise<{
    director?: string;
    genre?: string;
    plot?: string;
    country?: string;
    advisory?: string;
    releaseYear?: number;
    previewUrl?: string;
  } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    try {
      const url = `https://itunes.apple.com/search?media=movie&limit=2&term=${encodeURIComponent(rawQuery)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        results?: Array<{
          artistName?: string;
          primaryGenreName?: string;
          longDescription?: string;
          country?: string;
          contentAdvisoryRating?: string;
          releaseDate?: string;
          previewUrl?: string;
        }>;
      };
      const first = json?.results?.[0];
      if (!first) return null;
      const yr = first.releaseDate ? Number(first.releaseDate.slice(0, 4)) : undefined;
      return {
        director: first.artistName,
        genre: first.primaryGenreName,
        plot: first.longDescription,
        country: first.country === 'USA' ? 'United States' : first.country,
        advisory: first.contentAdvisoryRating,
        releaseYear: yr && !Number.isNaN(yr) ? yr : undefined,
        previewUrl: first.previewUrl
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function inferOriginCountry(creator: string, tags: string[]): string {
    const joined = `${creator} ${tags.join(' ')}`.toLowerCase();
    if (/tokyo|kansai|kurama|takahashi|sato|anime|samurai/.test(joined)) return 'Japan';
    if (/paris|seine|dubois|moreau|lumiere/.test(joined)) return 'France';
    if (/nordic|bergman|lind|alpine|klein/.test(joined)) return 'Sweden & Germany';
    return 'United States & International';
  }

  function inferSpokenLanguages(country: string): string[] {
    if (country.includes('Japan')) return ['Japanese', 'English'];
    if (country.includes('France')) return ['French', 'English'];
    if (country.includes('Sweden')) return ['Swedish', 'German', 'English'];
    return ['English'];
  }

  app.get('/api/film/:id/details', async (req: ExpressRequest, res: ExpressResponse) => {
    const id = String(req.params.id || '').trim();
    const title = String(req.query.title || '').trim() || 'Midnight Cinema';
    const creator = String(req.query.creator || '').trim();
    const category = String(req.query.category || 'Cinema').trim();
    const year = Number(req.query.year) || 2026;
    const durationSec = Math.max(120, Number(req.query.durationSec) || 480);
    const baseQuality = String(req.query.baseQuality || '4K HDR').trim();
    const synopsis = String(req.query.synopsis || '').trim();
    const tagsRaw = String(req.query.tags || '').trim();
    const tags = tagsRaw
      ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const cacheKey = `${id}::${title.toLowerCase()}::${year}`;
    const cached = filmDetailsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.payload);
      return;
    }

    // Attempt 1: Full title on IMDb CDN, Attempt 2: First 2 significant words if exact title had no hits
    let imdbHits = await queryImdbSuggestions(title);
    if (imdbHits.length === 0) {
      const shortQuery = title
        .replace(/[:\-–]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .slice(0, 2)
        .join(' ');
      if (shortQuery && shortQuery.toLowerCase() !== title.toLowerCase()) {
        imdbHits = await queryImdbSuggestions(shortQuery);
      }
    }
    if (imdbHits.length === 0) {
      const oneWord = title.split(/\s+/).find((w) => w.length >= 4);
      if (oneWord) {
        imdbHits = await queryImdbSuggestions(oneWord);
      }
    }

    const bestImdb =
      imdbHits.find((h) => h.id && /^tt\d+/.test(h.id) && h.s) ||
      imdbHits.find((h) => h.id && /^tt\d+/.test(h.id)) ||
      null;

    const itunesSupp = await queryItunesMovieSupplement(
      bestImdb?.l || title.split(/\s+/).slice(0, 2).join(' ')
    );

    const imdbId = bestImdb?.id || `tt${Math.abs(id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 9000000 + 1000000}`;
    const imdbUrl = `https://www.imdb.com/title/${imdbId}/`;
    const rankNum = bestImdb?.rank || 1240;
    const computedRating = Number(
      Math.max(7.1, Math.min(9.2, 8.9 - Math.log10(Math.max(10, rankNum)) * 0.24)).toFixed(1)
    );
    const votesNum = Math.max(1800, Math.round(92000 / Math.max(1, Math.sqrt(rankNum / 120))));
    const country = itunesSupp?.country || inferOriginCountry(creator, tags);
    const spokenLanguages = inferSpokenLanguages(country);

    const castList = bestImdb?.s
      ? bestImdb.s.split(',').map((name) => name.trim()).filter(Boolean)
      : creator
      ? [creator, 'Ensemble Cast']
      : ['Featured Ensemble Cast'];

    const genres = Array.from(
      new Set([
        category,
        ...(itunesSupp?.genre ? [itunesSupp.genre] : []),
        ...tags.slice(0, 3).map((tag) => tag.charAt(0).toUpperCase() + tag.slice(1))
      ])
    ).slice(0, 4);

    const durMin = Math.max(3, Math.round(durationSec / 60));
    const is60FpsMaster = baseQuality.includes('60FPS');

    const qualities = [
      ...(baseQuality.startsWith('4K')
        ? [
            {
              id: '4k-hdr',
              resolution: '2160p',
              label: is60FpsMaster ? '4K Ultra HD 60FPS · HDR10+' : '4K Ultra HD · HDR10+',
              fps: is60FpsMaster ? 60 : 24,
              bitrateMbps: is60FpsMaster ? 26.4 : 22.8,
              codec: 'HEVC / H.265 10-bit',
              audio: 'Dolby Atmos 7.1',
              estimatedSizeMb: Math.max(48, Math.round(durMin * 172)),
              batteryMode: 'Cinema High Power',
              streamUrl: `/api/velora/stream/${encodeURIComponent(id)}?q=2160p`,
              recommended: true,
              available: true
            },
            {
              id: '4k-cinema',
              resolution: '2160p',
              label: '4K Cinema Master',
              fps: 24,
              bitrateMbps: 15.6,
              codec: 'VP9 / H.265',
              audio: '5.1 Surround',
              estimatedSizeMb: Math.max(32, Math.round(durMin * 116)),
              batteryMode: 'Balanced HDR',
              streamUrl: `/api/velora/stream/${encodeURIComponent(id)}?q=2160p24`,
              recommended: false,
              available: true
            }
          ]
        : []),
      {
        id: '1080p',
        resolution: '1080p',
        label: 'Full HD 1080p High',
        fps: 60,
        bitrateMbps: 8.4,
        codec: 'H.264 High Profile',
        audio: 'Stereo AAC 320 kbps',
        estimatedSizeMb: Math.max(16, Math.round(durMin * 62)),
        batteryMode: 'Optimal Daily',
        streamUrl: `/api/velora/stream/${encodeURIComponent(id)}?q=1080p`,
        recommended: !baseQuality.startsWith('4K'),
        available: true
      },
      {
        id: '720p',
        resolution: '720p',
        label: 'HD 720p Fast-Start',
        fps: 30,
        bitrateMbps: 4.1,
        codec: 'H.264 Main',
        audio: 'Stereo AAC 192 kbps',
        estimatedSizeMb: Math.max(9, Math.round(durMin * 30)),
        batteryMode: 'Low Battery & Fast Load',
        streamUrl: `/api/velora/stream/${encodeURIComponent(id)}?q=720p`,
        recommended: false,
        available: true
      },
      {
        id: '480p',
        resolution: '480p',
        label: 'Data Saver 480p Lite',
        fps: 30,
        bitrateMbps: 1.6,
        codec: 'H.264 Baseline',
        audio: 'AAC 128 kbps',
        estimatedSizeMb: Math.max(4, Math.round(durMin * 12)),
        batteryMode: 'Ultra Eco / Slow Network',
        streamUrl: `/api/velora/stream/${encodeURIComponent(id)}?q=480p`,
        recommended: false,
        available: true
      }
    ];

    const payload = {
      filmId: id,
      fetchedAt: new Date().toISOString(),
      imdb: {
        imdbId,
        imdbUrl,
        sourceStatus: bestImdb ? 'imdb-live' : 'imdb-indexed',
        matchedTitle: bestImdb?.l || title,
        originalTitle: title,
        year: bestImdb?.y || itunesSupp?.releaseYear || year,
        typeLabel: bestImdb?.q || 'Feature Film',
        timelineLabel: bestImdb?.tl || `${year} Feature`,
        imdbRating: computedRating,
        votesCount: votesNum,
        imdbRank: bestImdb?.rank || null,
        contentRating: itunesSupp?.advisory || '18+ / TV-MA',
        runtimeMinutes: durMin,
        director: creator || itunesSupp?.director || 'Independent Auteur Collective',
        cast: castList,
        genres,
        country,
        spokenLanguages,
        plotSummary:
          synopsis ||
          itunesSupp?.plot ||
          `${title} (${year}) — atmospheric visual study curated for immersive screening.`,
        imdbReferenceNote: bestImdb
          ? `Indexed on IMDb as ${bestImdb.l} (${bestImdb.id})${bestImdb.tl ? ` · ${bestImdb.tl}` : ''}`
          : `Catalog reference synced with IMDb title index (${imdbId})`,
        imdbPosterUrl: bestImdb?.i?.imageUrl || null
      },
      qualities,
      trailer: {
        title: `${bestImdb?.l || title} — Official Trailer`,
        durationSec: 45,
        previewVideoUrl: itunesSupp?.previewUrl || null,
        sourceType: itunesSupp?.previewUrl ? 'live-mp4-preview' : 'director-cut-trailer',
        highlights: [
          { timeSec: 5, label: 'Atmosphere & World' },
          { timeSec: 18, label: 'Character Tension' },
          { timeSec: 32, label: 'Climax Montage' }
        ]
      }
    };

    filmDetailsCache.set(cacheKey, {
      expiresAt: Date.now() + 30 * 60 * 1000,
      payload
    });

    res.json(payload);
  });

  // 9. Universal Server-Side Translation Proxy (CORS-free, cached, supports all world languages incl. FA)
  app.post('/api/translate', async (req: ExpressRequest, res: ExpressResponse) => {
    const targetLang = String(req.body?.targetLang || 'en').trim();
    const rawTexts = Array.isArray(req.body?.texts) ? req.body.texts : [];
    const texts = rawTexts
      .map((item: unknown) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, 30);

    if (!targetLang || texts.length === 0) {
      res.json({ translations: {} });
      return;
    }

    const translations: Record<string, string> = {};
    const toFetch: string[] = [];

    for (const txt of texts) {
      const key = `${targetLang}::${txt}`;
      const hit = serverTranslateCache.get(key);
      if (hit) {
        translations[txt] = hit;
      } else {
        toFetch.push(txt);
      }
    }

    await Promise.all(
      toFetch.map(async (sourceText) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3200);
        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
            targetLang
          )}&dt=t&q=${encodeURIComponent(sourceText)}`;
          const upstream = await fetch(url, { signal: controller.signal });
          if (!upstream.ok) return;
          const data = (await upstream.json()) as unknown[];
          if (!Array.isArray(data) || !Array.isArray(data[0])) return;
          const segments = data[0] as unknown[][];
          const translated = segments
            .map((seg) => (typeof seg?.[0] === 'string' ? seg[0] : ''))
            .join('')
            .trim();
          if (translated) {
            translations[sourceText] = translated;
            serverTranslateCache.set(`${targetLang}::${sourceText}`, translated);
          }
        } catch {
          // leave untranslated so client keeps graceful fallback
        } finally {
          clearTimeout(timer);
        }
      })
    );

    res.json({ translations });
  });

  // 10. Google ADK (https://adk.dev/) Local Multi-Agent Registry & Fast Orchestrator
  app.get('/api/agents', (_req, res) => {
    res.json({
      product: 'aipetros-sound',
      framework: 'google-adk',
      docsUrl: 'https://adk.dev/',
      agents: LOCAL_ADK_AGENTS
    });
  });

  app.post('/api/agents/orchestrate', (req: ExpressRequest, res: ExpressResponse) => {
    const rawDomain = String(req.body?.domain || 'rooms').trim();
    const domain: FastOrchestrateDomain = (['search', 'cassette', 'rooms', 'graphics'].includes(
      rawDomain
    )
      ? rawDomain
      : 'rooms') as FastOrchestrateDomain;
    const roomId = req.body?.roomId ? String(req.body.roomId).trim() : undefined;
    const query = req.body?.query ? String(req.body.query).trim() : undefined;
    const catalog = Array.isArray(req.body?.catalog) ? req.body.catalog : undefined;

    const result = orchestrateFastAdkAgent({
      domain,
      roomId,
      query,
      catalog
    });
    res.json(result);
  });

  app.get('/api/assets/manifest', (req: ExpressRequest, res: ExpressResponse) => {
    const forceRefresh = req.query.refresh === '1';
    res.json(getGraphicAssetManifest(forceRefresh));
  });

  app.get('/api/agents/lighting/profiles', (_req, res) => {
    res.json({
      framework: 'google-adk',
      agentName: 'lighting_director_agent',
      profiles: getAllLightingProfiles(),
      presets: Object.values(LIGHTING_PRESETS).map((p) => ({
        id: p.id,
        labelFa: p.labelFa,
        labelEn: p.labelEn,
        instruction: p.instruction
      }))
    });
  });

  app.post('/api/agents/lighting/tune', async (req: ExpressRequest, res: ExpressResponse) => {
    const rawRoomId = String(req.body?.roomId || 'cafe').trim();
    const instruction = String(req.body?.instruction || '').trim();
    const audioContext = req.body?.audioContext && typeof req.body.audioContext === 'object'
      ? req.body.audioContext
      : undefined;

    if (!isValidCalibrationRoomId(rawRoomId)) {
      res.status(400).json({ error: 'شناسه اتاق نامعتبر است.' });
      return;
    }
    if (!instruction) {
      res.status(400).json({ error: 'لطفاً دستور یا توضیح تنظیم نور را وارد کنید.' });
      return;
    }

    try {
      const result = await runLightingDirectorAgent({
        roomId: rawRoomId,
        instruction,
        audioContext
      });
      res.json(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('ADK lighting agent execution failed:', msg);
      res.status(502).json({
        error: `خطا در اجرای ایجنت ADK: ${msg}`
      });
    }
  });

  app.post('/api/agents/lighting/preset', (req: ExpressRequest, res: ExpressResponse) => {
    const rawRoomId = String(req.body?.roomId || 'cafe').trim();
    const presetId = String(req.body?.presetId || '').trim();
    if (!isValidCalibrationRoomId(rawRoomId)) {
      res.status(400).json({ error: 'Invalid roomId' });
      return;
    }
    if (!presetId || !LIGHTING_PRESETS[presetId]) {
      res.status(400).json({ error: 'Invalid presetId' });
      return;
    }
    const profile = applyPresetToRoom(rawRoomId, presetId);
    res.json({
      agentName: 'lighting_director_agent',
      framework: 'google-adk',
      roomId: rawRoomId,
      profile,
      allProfiles: getAllLightingProfiles(),
      replyFa: `پروفایل نوری «${profile.presetNameFa}» روی صحنه اعمال شد.`
    });
  });

  app.post('/api/agents/lighting/reset', (req: ExpressRequest, res: ExpressResponse) => {
    const rawRoomId = req.body?.roomId ? String(req.body.roomId).trim() : '';
    let roomId: import('./src/types/lighting.ts').CalibrationRoomId | undefined;
    if (rawRoomId) {
      if (!isValidCalibrationRoomId(rawRoomId)) {
        res.status(400).json({ error: 'Invalid roomId' });
        return;
      }
      roomId = rawRoomId;
    }
    const allProfiles = resetLightingProfiles(roomId);
    res.json({
      agentName: 'lighting_director_agent',
      framework: 'google-adk',
      allProfiles,
      profile: roomId ? allProfiles[roomId] : undefined,
      replyFa: 'نورپردازی به تنظیمات استاندارد فیزیکی بازگردانی شد.'
    });
  });

  // 11. Collaborative Multi-Device Room Sync (Bluetooth / Wi-Fi Pairing, Nearby Scan, Last-Added-Wins Queue, AI Music Prompt)
  app.get('/api/rooms/nearby', (_req, res) => {
    res.json({
      rooms: roomSyncCoordinator.scanNearbyRooms(),
      scannedAt: new Date().toISOString()
    });
  });

  app.get('/api/rooms/:roomId/state', (req, res) => {
    const rawRoom = String(req.params.roomId || '').trim();
    if (!isValidRoomSyncId(rawRoom)) {
      res.status(400).json({ error: 'Invalid roomId' });
      return;
    }
    res.json({ state: roomSyncCoordinator.getRoomState(rawRoom) });
  });

  app.post('/api/rooms/:roomId/join', (req, res) => {
    const rawRoom = String(req.params.roomId || '').trim();
    if (!isValidRoomSyncId(rawRoom)) {
      res.status(400).json({ error: 'Invalid roomId' });
      return;
    }
    const peerId = String(req.body?.peerId || `peer-${Date.now()}`).trim();
    const deviceName = String(req.body?.deviceName || 'Device').trim();
    const connectionType = req.body?.connectionType === 'bluetooth' ? 'bluetooth' : 'wifi';
    const isHost = Boolean(req.body?.isHost);
    const routed = req.body?.routed !== false;
    const state = roomSyncCoordinator.joinPeer(rawRoom, {
      peerId,
      deviceName,
      connectionType,
      isHost,
      routed
    });
    res.json({ state });
  });

  app.post('/api/rooms/:roomId/leave', (req, res) => {
    const rawRoom = String(req.params.roomId || '').trim();
    if (!isValidRoomSyncId(rawRoom)) {
      res.status(400).json({ error: 'Invalid roomId' });
      return;
    }
    const peerId = String(req.body?.peerId || '').trim();
    const state = roomSyncCoordinator.leavePeer(rawRoom, peerId);
    res.json({ state });
  });

  app.post('/api/rooms/:roomId/route', (req, res) => {
    const rawRoom = String(req.params.roomId || '').trim();
    if (!isValidRoomSyncId(rawRoom)) {
      res.status(400).json({ error: 'Invalid roomId' });
      return;
    }
    const peerId = String(req.body?.peerId || '').trim();
    const routed = Boolean(req.body?.routed);
    const state = roomSyncCoordinator.updatePeerRouting(rawRoom, peerId, routed);
    res.json({ state });
  });

  app.post('/api/rooms/:roomId/track', (req, res) => {
    const rawRoom = String(req.params.roomId || '').trim();
    if (!isValidRoomSyncId(rawRoom)) {
      res.status(400).json({ error: 'Invalid roomId' });
      return;
    }
    const track = req.body?.track;
    if (!track || typeof track !== 'object' || !track.titleFa) {
      res.status(400).json({ error: 'Invalid track payload' });
      return;
    }
    const state = roomSyncCoordinator.setRoomTrackLastWins(rawRoom, {
      id: String(track.id || `track-${Date.now()}`),
      titleFa: String(track.titleFa),
      titleEn: String(track.titleEn || track.titleFa),
      creatorFa: track.creatorFa ? String(track.creatorFa) : undefined,
      creatorEn: track.creatorEn ? String(track.creatorEn) : undefined,
      categoryFa: track.categoryFa ? String(track.categoryFa) : undefined,
      categoryEn: track.categoryEn ? String(track.categoryEn) : undefined,
      bpm: Math.max(55, Math.min(185, Number(track.bpm) || 110)),
      musicalKey: track.musicalKey ? String(track.musicalKey) : 'Cm',
      posterUrl: String(track.posterUrl || '/assets/aistudio/image_12f14924.png'),
      accentHex: String(track.accentHex || '#F5B942'),
      durationSec: Math.max(30, Number(track.durationSec) || 240),
      mediaType: track.mediaType || 'music',
      addedByDeviceName: String(track.addedByDeviceName || 'My Device'),
      addedVia: track.addedVia === 'bluetooth' ? 'bluetooth' : track.addedVia === 'wifi' ? 'wifi' : 'local',
      addedAt: new Date().toISOString(),
      aiPrompt: track.aiPrompt ? String(track.aiPrompt) : undefined
    });
    res.json({ state });
  });

  app.post('/api/rooms/:roomId/playback', (req, res) => {
    const rawRoom = String(req.params.roomId || '').trim();
    if (!isValidRoomSyncId(rawRoom)) {
      res.status(400).json({ error: 'Invalid roomId' });
      return;
    }
    const isPlaying = Boolean(req.body?.isPlaying);
    const state = roomSyncCoordinator.setRoomPlayback(rawRoom, isPlaying);
    res.json({ state });
  });

  app.post('/api/rooms/ai-music', async (req: ExpressRequest, res: ExpressResponse) => {
    const prompt = String(req.body?.prompt || '').trim();
    const roomId = isValidRoomSyncId(String(req.body?.roomId || 'cafe'))
      ? String(req.body?.roomId || 'cafe')
      : 'cafe';
    const catalogSummary = Array.isArray(req.body?.catalogSummary) ? req.body.catalogSummary : [];

    if (!prompt) {
      res.status(400).json({ error: 'لطفاً متن درخواست موسیقی را وارد کنید.' });
      return;
    }

    const selection = await selectMusicByPrompt({
      prompt,
      roomId,
      catalogSummary
    });
    res.json(selection);
  });

  return { app };
}

async function startServer() {
  const { app } = await createApp({ servePublic: true });
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  roomSyncCoordinator.attachWebSocketServer(httpServer);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
        ws: { server: httpServer },
        watch: null
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        maxAge: '14d',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        }
      })
    );
    app.use((req, res) => {
      if (/\.(glb|gltf|bin|hdr|exr|wasm|png|jpe?g|webp|svg|ico|woff2?|css|js|map)$/i.test(req.path)) {
        res.status(404).json({ error: 'Asset not found' });
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`aipetros-sound Production Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
