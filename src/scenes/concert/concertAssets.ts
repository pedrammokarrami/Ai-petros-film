import { useGLTF } from '@react-three/drei';

// Configure global Draco decoder path for all concert room GLB assets
export const DRACO_DECODER_URL = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
useGLTF.setDecoderPath(DRACO_DECODER_URL);

export interface HumanArchetypePreset {
  id: number;
  label: string;
  baseKind: 'female' | 'male';
  outfitColor: string;
  pantsColor: string;
  skinColor: string;
  hairColor: string;
  heightScale: number;
  buildScaleX: number;
  buildScaleZ: number;
}

/**
 * 20+ Distinct Human Archetypes (varied hair, skin, jacket/shirt PBR tones, height 0.92-1.08, and builds)
 * Zero robots or armored soldiers.
 */
export const HUMAN_ARCHETYPES: HumanArchetypePreset[] = [
  { id: 0, label: 'female-burgundy', baseKind: 'female', outfitColor: '#2b0912', pantsColor: '#12131a', skinColor: '#f0c4a8', hairColor: '#1a1412', heightScale: 0.96, buildScaleX: 0.96, buildScaleZ: 0.96 },
  { id: 1, label: 'male-navy', baseKind: 'male', outfitColor: '#0b132b', pantsColor: '#11141f', skinColor: '#e2ae8c', hairColor: '#2c1e16', heightScale: 1.04, buildScaleX: 1.03, buildScaleZ: 1.02 },
  { id: 2, label: 'female-espresso', baseKind: 'female', outfitColor: '#211510', pantsColor: '#141720', skinColor: '#d99e7c', hairColor: '#4a2e1b', heightScale: 0.94, buildScaleX: 0.95, buildScaleZ: 0.95 },
  { id: 3, label: 'male-forest', baseKind: 'male', outfitColor: '#0b201a', pantsColor: '#11141b', skinColor: '#f3ccb4', hairColor: '#171516', heightScale: 1.06, buildScaleX: 1.05, buildScaleZ: 1.04 },
  { id: 4, label: 'female-charcoal', baseKind: 'female', outfitColor: '#18181b', pantsColor: '#121319', skinColor: '#c88762', hairColor: '#181414', heightScale: 0.98, buildScaleX: 0.98, buildScaleZ: 0.97 },
  { id: 5, label: 'male-charcoal', baseKind: 'male', outfitColor: '#202229', pantsColor: '#12151e', skinColor: '#eab897', hairColor: '#6b4423', heightScale: 1.02, buildScaleX: 1.0, buildScaleZ: 1.0 },
  { id: 6, label: 'female-midnight', baseKind: 'female', outfitColor: '#0e172a', pantsColor: '#12141c', skinColor: '#f5d2bc', hairColor: '#9e6b3b', heightScale: 0.95, buildScaleX: 0.96, buildScaleZ: 0.96 },
  { id: 7, label: 'male-espresso', baseKind: 'male', outfitColor: '#261812', pantsColor: '#151822', skinColor: '#8f593c', hairColor: '#141212', heightScale: 1.07, buildScaleX: 1.06, buildScaleZ: 1.04 },
  { id: 8, label: 'female-navy', baseKind: 'female', outfitColor: '#0b132b', pantsColor: '#11141c', skinColor: '#e5b190', hairColor: '#221814', heightScale: 0.97, buildScaleX: 0.97, buildScaleZ: 0.96 },
  { id: 9, label: 'male-burgundy', baseKind: 'male', outfitColor: '#2b0912', pantsColor: '#13131b', skinColor: '#f2c8ad', hairColor: '#3d2817', heightScale: 1.01, buildScaleX: 0.99, buildScaleZ: 1.0 },
  { id: 10, label: 'female-forest', baseKind: 'female', outfitColor: '#0b201a', pantsColor: '#12151c', skinColor: '#b97b56', hairColor: '#1a1514', heightScale: 0.95, buildScaleX: 0.95, buildScaleZ: 0.96 },
  { id: 11, label: 'male-deep-slate', baseKind: 'male', outfitColor: '#161b26', pantsColor: '#11141e', skinColor: '#ecc0a1', hairColor: '#52341e', heightScale: 1.05, buildScaleX: 1.04, buildScaleZ: 1.02 },
  { id: 12, label: 'female-oxide', baseKind: 'female', outfitColor: '#241118', pantsColor: '#13141c', skinColor: '#f4cdb5', hairColor: '#2a1d17', heightScale: 0.99, buildScaleX: 0.98, buildScaleZ: 0.98 },
  { id: 13, label: 'male-obsidian', baseKind: 'male', outfitColor: '#14151c', pantsColor: '#101219', skinColor: '#d2946f', hairColor: '#161313', heightScale: 1.03, buildScaleX: 1.02, buildScaleZ: 1.02 },
  { id: 14, label: 'female-umber', baseKind: 'female', outfitColor: '#211510', pantsColor: '#141620', skinColor: '#eab796', hairColor: '#7b4c28', heightScale: 0.93, buildScaleX: 0.94, buildScaleZ: 0.94 },
  { id: 15, label: 'male-midnight-blue', baseKind: 'male', outfitColor: '#0f172a', pantsColor: '#10131b', skinColor: '#f0c5a9', hairColor: '#241c18', heightScale: 1.08, buildScaleX: 1.07, buildScaleZ: 1.05 },
  { id: 16, label: 'female-garnet', baseKind: 'female', outfitColor: '#330c17', pantsColor: '#12131b', skinColor: '#9c6244', hairColor: '#161313', heightScale: 0.96, buildScaleX: 0.96, buildScaleZ: 0.96 },
  { id: 17, label: 'male-roasted', baseKind: 'male', outfitColor: '#241711', pantsColor: '#13151d', skinColor: '#f2cab0', hairColor: '#4e3524', heightScale: 1.02, buildScaleX: 1.01, buildScaleZ: 1.01 },
  { id: 18, label: 'female-graphite', baseKind: 'female', outfitColor: '#1c1d24', pantsColor: '#12131a', skinColor: '#dfab89', hairColor: '#201613', heightScale: 1.0, buildScaleX: 0.99, buildScaleZ: 0.98 },
  { id: 19, label: 'male-pine', baseKind: 'male', outfitColor: '#0f241d', pantsColor: '#12141b', skinColor: '#c98863', hairColor: '#191616', heightScale: 1.04, buildScaleX: 1.03, buildScaleZ: 1.02 },
  { id: 20, label: 'male-cocoa', baseKind: 'male', outfitColor: '#211510', pantsColor: '#141720', skinColor: '#ecc1a4', hairColor: '#3a2719', heightScale: 1.01, buildScaleX: 1.0, buildScaleZ: 1.01 },
  { id: 21, label: 'female-deep-navy', baseKind: 'female', outfitColor: '#0b132b', pantsColor: '#11131a', skinColor: '#f4d0b8', hairColor: '#633e22', heightScale: 0.95, buildScaleX: 0.95, buildScaleZ: 0.95 }
];

export interface ConcertAssetManifest {
  venue: string | null;
  singer: string;
  dancer: string | null;
  dancerMale: string;
  dancerFemale: string;
  guitarist: string;
  drummer: string;
  maleHuman: string;
  mocapAnimUrls: string[];
  avatarUrls: string[]; // Optional custom /models/concert/avatars/human_01..20.glb when present
  hdri: string | null;
}

export const CONCERT_LOCAL_PATHS = {
  venue: '/models/concert/concert-hall.glb',
  singer: '/models/concert/dancer-female.glb',
  dancer: '/models/concert/dancer.glb',
  dancerMale: '/models/concert/dancer-male.glb',
  dancerFemale: '/models/concert/dancer-female.glb',
  guitarist: '/models/concert/guitarist.glb',
  drummer: '/models/concert/drummer.glb',
  mocapAnims: [
    '/models/concert/anim-idle-m1.glb',
    '/models/concert/anim-dance-m1.glb',
    '/models/concert/anim-dance-m4.glb',
    '/models/concert/anim-dance-m6.glb',
    '/models/concert/anim-dance-f5.glb'
  ],
  avatarPrefix: '/models/concert/avatars/human_',
  hdri: '/hdri/stage.hdr',
  hdriNight: '/hdri/stage-night.hdr'
} as const;

export const CONCERT_FALLBACK_CDN_URLS = {
  singer: 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/feminine/glb/Feminine_TPose.glb',
  maleHuman: 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/masculine/glb/Masculine_TPose.glb',
  femaleHuman: 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/feminine/glb/Feminine_TPose.glb'
} as const;

/**
 * Verifies a local `.glb` actually exists and begins with the binary `'glTF'` header.
 */
async function probeBinaryGlb(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-3' } });
    if (!res.ok) return false;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) return false;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 4) return false;
    const bytes = new Uint8Array(buf);
    return bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;
  } catch {
    return false;
  }
}

async function probeHdrFile(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-15' } });
    if (!res.ok) return false;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html')) return false;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 2) return false;
    const bytes = new Uint8Array(buf);
    return bytes[0] === 0x23 && bytes[1] === 0x3f;
  } catch {
    return false;
  }
}

let resolvedManifestPromise: Promise<ConcertAssetManifest> | null = null;

export function resolveConcertAssetManifest(): Promise<ConcertAssetManifest> {
  if (!resolvedManifestPromise) {
    resolvedManifestPromise = (async () => {
      const [
        hasVenue,
        hasSinger,
        hasDancer,
        hasDancerMale,
        hasDancerFemale,
        hasGuitarist,
        hasDrummer,
        hasFirstAvatar,
        hasStageHdri,
        hasStageNightHdri,
        ...mocapHits
      ] = await Promise.all([
        probeBinaryGlb(CONCERT_LOCAL_PATHS.venue),
        probeBinaryGlb(CONCERT_LOCAL_PATHS.singer),
        probeBinaryGlb(CONCERT_LOCAL_PATHS.dancer),
        probeBinaryGlb(CONCERT_LOCAL_PATHS.dancerMale),
        probeBinaryGlb(CONCERT_LOCAL_PATHS.dancerFemale),
        probeBinaryGlb(CONCERT_LOCAL_PATHS.guitarist),
        probeBinaryGlb(CONCERT_LOCAL_PATHS.drummer),
        probeBinaryGlb(`${CONCERT_LOCAL_PATHS.avatarPrefix}01.glb`),
        probeHdrFile(CONCERT_LOCAL_PATHS.hdri),
        probeHdrFile(CONCERT_LOCAL_PATHS.hdriNight),
        ...CONCERT_LOCAL_PATHS.mocapAnims.map((p) => probeBinaryGlb(p))
      ]);

      const avatarUrls: string[] = [];
      if (hasFirstAvatar) {
        avatarUrls.push(`${CONCERT_LOCAL_PATHS.avatarPrefix}01.glb`);
        const checks = await Promise.all(
          Array.from({ length: 19 }, (_, idx) => {
            const num = String(idx + 2).padStart(2, '0');
            const path = `${CONCERT_LOCAL_PATHS.avatarPrefix}${num}.glb`;
            return probeBinaryGlb(path).then((ok) => (ok ? path : null));
          })
        );
        checks.forEach((p) => {
          if (p) avatarUrls.push(p);
        });
      }

      const singerUrl = hasSinger ? CONCERT_LOCAL_PATHS.singer : CONCERT_FALLBACK_CDN_URLS.singer;
      const dancerMaleUrl = hasDancerMale ? CONCERT_LOCAL_PATHS.dancerMale : CONCERT_FALLBACK_CDN_URLS.maleHuman;
      const dancerFemaleUrl = hasDancerFemale ? CONCERT_LOCAL_PATHS.dancerFemale : CONCERT_FALLBACK_CDN_URLS.femaleHuman;
      const guitaristUrl = hasGuitarist ? CONCERT_LOCAL_PATHS.guitarist : dancerMaleUrl;
      const drummerUrl = hasDrummer ? CONCERT_LOCAL_PATHS.drummer : dancerMaleUrl;
      const hdriUrl = hasStageHdri
        ? CONCERT_LOCAL_PATHS.hdri
        : hasStageNightHdri
          ? CONCERT_LOCAL_PATHS.hdriNight
          : null;

      const mocapAnimUrls = CONCERT_LOCAL_PATHS.mocapAnims.filter((_, idx) => mocapHits[idx]);

      return {
        venue: hasVenue ? CONCERT_LOCAL_PATHS.venue : null,
        singer: singerUrl,
        dancer: hasDancer ? CONCERT_LOCAL_PATHS.dancer : null,
        dancerMale: dancerMaleUrl,
        dancerFemale: dancerFemaleUrl,
        guitarist: guitaristUrl,
        drummer: drummerUrl,
        maleHuman: dancerMaleUrl,
        mocapAnimUrls,
        avatarUrls,
        hdri: hdriUrl
      };
    })();
  }
  return resolvedManifestPromise;
}

export function preloadConcertAssets() {
  void resolveConcertAssetManifest().then((manifest) => {
    useGLTF.preload(manifest.singer, DRACO_DECODER_URL);
    useGLTF.preload(manifest.dancerMale, DRACO_DECODER_URL);
    useGLTF.preload(manifest.dancerFemale, DRACO_DECODER_URL);
    if (manifest.dancer) useGLTF.preload(manifest.dancer, DRACO_DECODER_URL);
    if (manifest.guitarist !== manifest.dancerMale) useGLTF.preload(manifest.guitarist, DRACO_DECODER_URL);
    if (manifest.drummer !== manifest.guitarist && manifest.drummer !== manifest.dancerMale) {
      useGLTF.preload(manifest.drummer, DRACO_DECODER_URL);
    }
    manifest.mocapAnimUrls.forEach((url) => useGLTF.preload(url, DRACO_DECODER_URL));
    manifest.avatarUrls.forEach((url) => useGLTF.preload(url, DRACO_DECODER_URL));
    if (manifest.venue) {
      useGLTF.preload(manifest.venue, DRACO_DECODER_URL);
    }
  });
}
