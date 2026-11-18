import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { useGLTF } from '@react-three/drei';
import {
  DRACO_DECODER_URL,
  resolveConcertAssetManifest
} from '../scenes/concert/concertAssets';
import {
  getPolyHavenPBR,
  type PolyHavenTextureAssetId
} from '../scenes/shared/polyhavenTextures';

export const AETHER_ASSET_CACHE_NAME = 'aipetros-sound-assets-v1';
const LEGACY_CACHE_NAME = 'aether-3d-assets-v1';

const HDR_MEMORY_CACHE = new Map<string, Promise<THREE.DataTexture | null>>();
const ARRAY_BUFFER_FLIGHT_CACHE = new Map<string, Promise<ArrayBuffer>>();

export interface AssetPreloadProgress {
  status: 'idle' | 'downloading' | 'ready';
  totalFiles: number;
  completedFiles: number;
  totalBytes: number;
  downloadedBytes: number;
  persistentGranted: boolean;
  lastUpdatedAt: number;
}

let preloadProgressState: AssetPreloadProgress = {
  status: 'idle',
  totalFiles: 0,
  completedFiles: 0,
  totalBytes: 0,
  downloadedBytes: 0,
  persistentGranted: false,
  lastUpdatedAt: 0
};

const progressListeners = new Set<(state: AssetPreloadProgress) => void>();

function emitProgress(patch: Partial<AssetPreloadProgress>) {
  preloadProgressState = {
    ...preloadProgressState,
    ...patch,
    lastUpdatedAt: Date.now()
  };
  progressListeners.forEach((cb) => {
    try {
      cb(preloadProgressState);
    } catch {
      // ignore subscriber errors
    }
  });
}

export function getAssetPreloadProgress(): AssetPreloadProgress {
  return preloadProgressState;
}

export function subscribeAssetPreloadProgress(
  listener: (state: AssetPreloadProgress) => void
): () => void {
  progressListeners.add(listener);
  listener(preloadProgressState);
  return () => {
    progressListeners.delete(listener);
  };
}

const POLYHAVEN_TEXTURE_IDS: PolyHavenTextureAssetId[] = [
  'hinoki_planks',
  'brown_planks_07',
  'american_walnut_veneer',
  'corrugated_iron_03',
  'metal_plate'
];

const CORE_STATIC_ASSET_URLS: string[] = [
  '/hdr/studio_small_08_1k.hdr',
  '/hdri/stage-night.hdr',
  '/models/podcast/podcast-studio.glb',
  '/models/podcast/hosts.glb',
  '/models/podcast/cohost.glb',
  '/models/cafe/props/round_wooden_table_01.glb',
  '/models/cafe/props/dining_chair_02.glb',
  '/models/cafe/props/wine_bottles_01.glb',
  '/models/cafe/props/wine_barrel_01.glb',
  '/models/cafe/props/wooden_display_shelves_01.glb',
  '/models/cafe/props/ornate_mirror_01.glb',
  '/models/cafe/props/fancy_picture_frame_02.glb',
  '/models/cafe/props/Ukulele_01.glb',
  '/models/cafe/props/wooden_stool_01.glb',
  '/models/cafe/props/Chandelier_03.glb',
  '/models/cafe/props/Lantern_01.glb',
  '/models/studio/cassette-deck.glb'
];

let idleWarmingScheduled = false;
let activeWarmingPromise: Promise<void> | null = null;

async function matchFromCaches(url: string, absoluteUrl: string): Promise<Response | undefined> {
  if (typeof caches === 'undefined') return undefined;
  const cache = await caches.open(AETHER_ASSET_CACHE_NAME);
  const directHit = (await cache.match(absoluteUrl)) || (await cache.match(url));
  if (directHit && directHit.status === 200) return directHit;

  try {
    const legacy = await caches.open(LEGACY_CACHE_NAME);
    const legacyHit = (await legacy.match(absoluteUrl)) || (await legacy.match(url));
    if (legacyHit && legacyHit.status === 200) {
      await cache.put(absoluteUrl, legacyHit.clone()).catch(() => {});
      return legacyHit;
    }
  } catch {
    // ignore legacy cache lookup errors
  }
  return undefined;
}

/**
 * Resolves full binary bytes from CacheStorage first, falling back to network
 * and storing clean 200 OK non-HTML responses for instant offline/revisit hits.
 */
export async function fetchCachedArrayBuffer(url: string): Promise<ArrayBuffer> {
  const existingFlight = ARRAY_BUFFER_FLIGHT_CACHE.get(url);
  if (existingFlight) return existingFlight;

  const task = (async () => {
    const absoluteUrl =
      typeof window !== 'undefined' ? new URL(url, window.location.origin).href : url;

    if (typeof caches !== 'undefined') {
      try {
        const hit = await matchFromCaches(url, absoluteUrl);
        if (hit) {
          const ct = (hit.headers.get('content-type') || '').toLowerCase();
          if (!ct.includes('text/html')) {
            return await hit.arrayBuffer();
          }
        }
      } catch {
        // Fallback to network cleanly
      }
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Asset fetch failed (${res.status}) for ${url}`);
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) {
      throw new Error(`Invalid HTML fallback received for binary asset ${url}`);
    }

    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(AETHER_ASSET_CACHE_NAME);
        await cache.put(absoluteUrl, res.clone());
      } catch {
        // Ignore quota errors
      }
    }

    return await res.arrayBuffer();
  })();

  ARRAY_BUFFER_FLIGHT_CACHE.set(url, task);
  try {
    return await task;
  } finally {
    ARRAY_BUFFER_FLIGHT_CACHE.delete(url);
  }
}

/**
 * Ensures any static binary URL (texture, hdr, glb, png) is stored once in CacheStorage.
 */
export async function cacheAssetUrl(url: string): Promise<number> {
  if (!url || typeof window === 'undefined' || typeof caches === 'undefined') return 0;
  try {
    const absoluteUrl = new URL(url, window.location.origin).href;
    const existing = await matchFromCaches(url, absoluteUrl);
    if (existing) {
      const lenHeader = existing.headers.get('content-length');
      return lenHeader ? Number(lenHeader) || 0 : 0;
    }

    const res = await fetch(url);
    if (res.ok && res.status === 200) {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!ct.includes('text/html')) {
        const lenHeader = res.headers.get('content-length');
        const cache = await caches.open(AETHER_ASSET_CACHE_NAME);
        await cache.put(absoluteUrl, res);
        return lenHeader ? Number(lenHeader) || 0 : 0;
      }
    }
  } catch {
    // Non-fatal background cache error
  }
  return 0;
}

/**
 * Parses and caches an HDR Equirectangular DataTexture once in memory + CacheStorage.
 * Callers must NOT call `.dispose()` on the returned shared texture.
 */
export function loadCachedHDRTexture(url: string): Promise<THREE.DataTexture | null> {
  const hit = HDR_MEMORY_CACHE.get(url);
  if (hit) return hit;

  const loadPromise = (async () => {
    try {
      const buffer = await fetchCachedArrayBuffer(url);
      const loader = new HDRLoader();
      const parsed = loader.parse(buffer);
      const tex = new THREE.DataTexture(
        parsed.data,
        parsed.width,
        parsed.height,
        THREE.RGBAFormat,
        parsed.type
      );
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.flipY = true;
      tex.needsUpdate = true;
      tex.userData.__sharedCachedHdr = true;
      return tex;
    } catch {
      return null;
    }
  })();

  HDR_MEMORY_CACHE.set(url, loadPromise);
  return loadPromise;
}

function yieldToMainThread(delayMs = 30): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    window.setTimeout(() => {
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(() => resolve(), { timeout: 220 });
      } else {
        resolve();
      }
    }, delayMs);
  });
}

async function requestPersistentDeviceStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  try {
    const storageApi = navigator.storage as
      | (StorageManager & { persist?: () => Promise<boolean>; persisted?: () => Promise<boolean> })
      | undefined;
    if (!storageApi?.persist) return false;
    const already = await storageApi.persisted?.();
    if (already) return true;
    return await storageApi.persist();
  } catch {
    return false;
  }
}

async function runSequentialAssetWarming(): Promise<void> {
  const persistentGranted = await requestPersistentDeviceStorage();

  // 1. Query local ADK asset_cache_agent manifest for complete list of all graphic/3D files
  const urlSizeMap = new Map<string, number>();
  const orderedUrls: string[] = [];

  const registerUrl = (url: string, sizeBytes = 0) => {
    if (!url || urlSizeMap.has(url)) return;
    urlSizeMap.set(url, sizeBytes);
    orderedUrls.push(url);
  };

  try {
    const res = await fetch('/api/assets/manifest');
    if (res.ok) {
      const manifest = (await res.json()) as {
        assets?: Array<{ url: string; sizeBytes?: number }>;
      };
      if (Array.isArray(manifest.assets)) {
        for (const entry of manifest.assets) {
          registerUrl(entry.url, Number(entry.sizeBytes) || 0);
        }
      }
    }
  } catch {
    // Offline fallback uses curated static lists below
  }

  for (const id of POLYHAVEN_TEXTURE_IDS) {
    registerUrl(`/textures/polyhaven/${id}/diff.jpg`);
    registerUrl(`/textures/polyhaven/${id}/nor.jpg`);
    registerUrl(`/textures/polyhaven/${id}/rough.jpg`);
  }
  for (const url of CORE_STATIC_ASSET_URLS) {
    registerUrl(url);
  }

  let glbPreloadTargets: string[] = [];
  try {
    const manifest = await resolveConcertAssetManifest();
    const manifestUrls = [
      manifest.singer,
      manifest.dancerMale,
      manifest.dancerFemale,
      manifest.guitarist,
      manifest.drummer,
      ...(manifest.dancer ? [manifest.dancer] : []),
      ...(manifest.venue ? [manifest.venue] : []),
      ...manifest.mocapAnimUrls
    ].filter(Boolean);
    glbPreloadTargets = Array.from(new Set(manifestUrls));
    for (const url of glbPreloadTargets) {
      registerUrl(url);
    }
  } catch {
    // Non-fatal
  }

  // Ensure Draco decoder files are cached offline on device too
  registerUrl(`${DRACO_DECODER_URL}draco_decoder.wasm`);
  registerUrl(`${DRACO_DECODER_URL}draco_wasm_wrapper.js`);

  const totalFiles = orderedUrls.length;
  const estimatedTotalBytes = Array.from(urlSizeMap.values()).reduce((a, b) => a + b, 0);

  emitProgress({
    status: 'downloading',
    totalFiles,
    completedFiles: 0,
    totalBytes: estimatedTotalBytes,
    downloadedBytes: 0,
    persistentGranted
  });

  // Warm PBR GPU textures & studio HDR first so entering any room is immediate
  for (const id of POLYHAVEN_TEXTURE_IDS) {
    getPolyHavenPBR(id, 4, 2);
  }
  void loadCachedHDRTexture('/hdr/studio_small_08_1k.hdr');

  let completedFiles = 0;
  let downloadedBytes = 0;

  // Bounded 2-worker parallel queue keeps UI at 60fps while finishing full download fast
  const CONCURRENCY = 2;
  let cursor = 0;

  async function worker() {
    while (cursor < orderedUrls.length) {
      const idx = cursor++;
      const url = orderedUrls[idx];
      const fetchedSize = await cacheAssetUrl(url);
      const knownSize = urlSizeMap.get(url) || fetchedSize || 0;
      completedFiles += 1;
      downloadedBytes += knownSize;

      if (completedFiles % 3 === 0 || completedFiles === totalFiles) {
        emitProgress({
          status: completedFiles === totalFiles ? 'ready' : 'downloading',
          totalFiles,
          completedFiles,
          totalBytes: Math.max(estimatedTotalBytes, downloadedBytes),
          downloadedBytes,
          persistentGranted
        });
      }
      await yieldToMainThread(25);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Warm parsed GLTF cache for concert & podcast models once bytes sit in local CacheStorage
  for (const url of glbPreloadTargets) {
    try {
      useGLTF.preload(url, DRACO_DECODER_URL);
    } catch {
      // ignore preload error
    }
  }

  emitProgress({
    status: 'ready',
    totalFiles,
    completedFiles: totalFiles,
    totalBytes: Math.max(estimatedTotalBytes, downloadedBytes),
    downloadedBytes: Math.max(estimatedTotalBytes, downloadedBytes),
    persistentGranted
  });
}

export function startFullGraphicAssetDownload(force = false): Promise<void> {
  if (activeWarmingPromise && !force) return activeWarmingPromise;
  if (preloadProgressState.status === 'ready' && !force) {
    return Promise.resolve();
  }
  activeWarmingPromise = runSequentialAssetWarming().finally(() => {
    activeWarmingPromise = null;
  });
  return activeWarmingPromise;
}

/**
 * Schedules full background download of all 3D models, Poly Haven textures, HDRIs, and graphics
 * immediately after initial render settles so switching rooms/pages runs cleanly offline with zero freeze.
 */
export function scheduleIdleRoomAssetWarming(): void {
  if (idleWarmingScheduled || typeof window === 'undefined') return;
  idleWarmingScheduled = true;

  window.setTimeout(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(() => {
        void startFullGraphicAssetDownload();
      }, { timeout: 900 });
    } else {
      void startFullGraphicAssetDownload();
    }
  }, 650);
}
