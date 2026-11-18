import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { fetchCachedArrayBuffer } from '../../services/roomAssetPreloader';

export const STUDIO_DRACO_DECODER_URL =
  'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

export type StudioGlbSlotId =
  | 'studio_desk'
  | 'cassette_tape'
  | 'cassette_deck'
  | 'open_notebook'
  | 'fountain_pen'
  | 'studio_headphones'
  | 'condenser_mic'
  | 'acoustic_guitar'
  | 'glass_orb_lamp'
  | 'floor_lamp'
  | 'bookshelf'
  | 'potted_plant'
  | 'studio_chair'
  | 'wall_frame'
  | 'vinyl_turntable';

export interface StudioGlbSlotSpec {
  id: StudioGlbSlotId;
  primaryUrl: string;
  fallbackUrls?: string[];
  /** Target max extent (or height) in scene meters once normalized */
  targetExtent: number;
  /** Fit mode: 'maxDim' scales largest axis to targetExtent, 'height' scales Y to targetExtent */
  fitAxis?: 'maxDim' | 'height' | 'width';
  /** Rest bottom flush on y = 0 */
  groundBottom?: boolean;
  /** Optional default Y rotation correction if imported asset faces -X/+X */
  rotationY?: number;
}

export const STUDIO_GLB_SLOTS: Record<StudioGlbSlotId, StudioGlbSlotSpec> = {
  studio_desk: {
    id: 'studio_desk',
    primaryUrl: '/models/studio/studio-desk.glb',
    targetExtent: 3.9,
    fitAxis: 'width',
    groundBottom: true
  },
  cassette_tape: {
    id: 'cassette_tape',
    primaryUrl: '/models/studio/cassette-tape.glb',
    targetExtent: 0.34,
    fitAxis: 'width',
    groundBottom: false
  },
  cassette_deck: {
    id: 'cassette_deck',
    primaryUrl: '/models/studio/cassette-deck.glb',
    targetExtent: 0.74,
    fitAxis: 'height',
    groundBottom: true
  },
  open_notebook: {
    id: 'open_notebook',
    primaryUrl: '/models/studio/open-notebook.glb',
    targetExtent: 0.68,
    fitAxis: 'maxDim',
    groundBottom: true
  },
  fountain_pen: {
    id: 'fountain_pen',
    primaryUrl: '/models/studio/fountain-pen.glb',
    targetExtent: 0.3,
    fitAxis: 'maxDim',
    groundBottom: true
  },
  studio_headphones: {
    id: 'studio_headphones',
    primaryUrl: '/models/studio/studio-headphones.glb',
    targetExtent: 0.44,
    fitAxis: 'maxDim',
    groundBottom: true
  },
  condenser_mic: {
    id: 'condenser_mic',
    primaryUrl: '/models/studio/condenser-mic.glb',
    targetExtent: 0.44,
    fitAxis: 'height',
    groundBottom: true
  },
  acoustic_guitar: {
    id: 'acoustic_guitar',
    primaryUrl: '/models/studio/acoustic-guitar.glb',
    fallbackUrls: ['/models/cafe/props/Ukulele_01.glb'],
    targetExtent: 1.18,
    fitAxis: 'height',
    groundBottom: true
  },
  glass_orb_lamp: {
    id: 'glass_orb_lamp',
    primaryUrl: '/models/studio/glass-orb-lamp.glb',
    targetExtent: 0.56,
    fitAxis: 'height',
    groundBottom: true
  },
  floor_lamp: {
    id: 'floor_lamp',
    primaryUrl: '/models/studio/floor-lamp.glb',
    targetExtent: 2.35,
    fitAxis: 'height',
    groundBottom: true
  },
  bookshelf: {
    id: 'bookshelf',
    primaryUrl: '/models/studio/bookshelf.glb',
    fallbackUrls: ['/models/cafe/props/wooden_display_shelves_01.glb'],
    targetExtent: 2.6,
    fitAxis: 'height',
    groundBottom: true
  },
  potted_plant: {
    id: 'potted_plant',
    primaryUrl: '/models/studio/potted-plant.glb',
    targetExtent: 1.55,
    fitAxis: 'height',
    groundBottom: true
  },
  studio_chair: {
    id: 'studio_chair',
    primaryUrl: '/models/studio/studio-chair.glb',
    fallbackUrls: ['/models/cafe/props/dining_chair_02.glb'],
    targetExtent: 1.12,
    fitAxis: 'height',
    groundBottom: true
  },
  wall_frame: {
    id: 'wall_frame',
    primaryUrl: '/models/studio/wall-frame.glb',
    fallbackUrls: ['/models/cafe/props/fancy_picture_frame_02.glb'],
    targetExtent: 0.85,
    fitAxis: 'height',
    groundBottom: false
  },
  vinyl_turntable: {
    id: 'vinyl_turntable',
    primaryUrl: '/models/studio/vinyl-turntable.glb',
    targetExtent: 0.62,
    fitAxis: 'width',
    groundBottom: true
  }
};

let sharedLoader: GLTFLoader | null = null;
const availabilityCache = new Map<string, Promise<boolean>>();
const parsedGlbTemplateCache = new Map<string, Promise<THREE.Group | null>>();

function getSharedGlbLoader(): GLTFLoader {
  if (sharedLoader) return sharedLoader;
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(STUDIO_DRACO_DECODER_URL);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  sharedLoader = loader;
  return loader;
}

/**
 * Verifies a .glb endpoint returns actual binary glTF bytes ("glTF" magic header)
 * rather than Vite SPA index.html fallback or truncated stub bytes.
 */
export function probeBinaryGlb(url: string): Promise<boolean> {
  const cached = availabilityCache.get(url);
  if (cached) return cached;

  const checkPromise = (async () => {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-31' }
      });
      if (!res.ok) return false;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) return false;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 12) return false;
      const magic = new Uint8Array(buf, 0, 4);
      // ASCII "glTF" -> 0x67, 0x6c, 0x54, 0x46
      return magic[0] === 0x67 && magic[1] === 0x6c && magic[2] === 0x54 && magic[3] === 0x46;
    } catch {
      return false;
    }
  })();

  availabilityCache.set(url, checkPromise);
  return checkPromise;
}

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

function getOrParseStudioTemplate(url: string): Promise<THREE.Group | null> {
  const cached = parsedGlbTemplateCache.get(url);
  if (cached) return cached;

  const parsePromise = (async () => {
    try {
      const loader = getSharedGlbLoader();
      const buffer = await fetchCachedArrayBuffer(url);
      const gltf = await loader.parseAsync(buffer, '');
      if (!gltf?.scene) return null;
      return gltf.scene;
    } catch {
      return null;
    }
  })();

  parsedGlbTemplateCache.set(url, parsePromise);
  return parsePromise;
}

/**
 * Safely resolves the first valid GLB from slot primary + fallbacks,
 * clones from in-memory parsed template cache (backed by CacheStorage),
 * normalizes scale and pivot, and invokes only if still mounted.
 */
export async function loadStudioSlotGlb(
  slot: StudioGlbSlotSpec,
  isCancelled: () => boolean,
  options?: { castShadow?: boolean; receiveShadow?: boolean; envMapIntensity?: number }
): Promise<THREE.Group | null> {
  const candidates = [slot.primaryUrl, ...(slot.fallbackUrls || [])];
  let resolvedUrl: string | null = null;

  for (const url of candidates) {
    if (isCancelled()) return null;
    const valid = await probeBinaryGlb(url);
    if (valid) {
      resolvedUrl = url;
      break;
    }
  }

  if (!resolvedUrl || isCancelled()) return null;

  try {
    const templateScene = await getOrParseStudioTemplate(resolvedUrl);
    if (isCancelled() || !templateScene) return null;

    const wrapper = new THREE.Group();
    const model = skeletonClone(templateScene);
    model.userData.__sharedTemplateClone = true;

    if (slot.rotationY) {
      model.rotation.y = slot.rotationY;
    }

    model.traverse((obj) => {
      obj.userData.__sharedTemplateClone = true;
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = options?.castShadow ?? true;
        mesh.receiveShadow = options?.receiveShadow ?? true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (m && 'envMapIntensity' in m) {
            (m as THREE.MeshStandardMaterial).envMapIntensity = options?.envMapIntensity ?? 0.95;
          }
        }
      }
    });

    model.updateMatrixWorld(true);
    _box.setFromObject(model);
    _box.getSize(_size);
    _box.getCenter(_center);

    const refAxis =
      slot.fitAxis === 'height'
        ? Math.max(0.001, _size.y)
        : slot.fitAxis === 'width'
          ? Math.max(0.001, _size.x)
          : Math.max(0.001, _size.x, _size.y, _size.z);

    const scale = slot.targetExtent / refAxis;
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);

    _box.setFromObject(model);
    _box.getCenter(_center);

    model.position.x -= _center.x;
    model.position.z -= _center.z;
    if (slot.groundBottom) {
      model.position.y -= _box.min.y;
    } else {
      model.position.y -= _center.y;
    }

    wrapper.add(model);
    return wrapper;
  } catch {
    return null;
  }
}

export function disposeObject3DTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    // Keep shared GLB template geometries & textures warm in RAM across screen switches
    if (obj.userData?.__sharedTemplateClone) return;
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m) continue;
        for (const key of Object.keys(m)) {
          const val = (m as unknown as Record<string, unknown>)[key];
          if (val && typeof val === 'object' && 'isTexture' in val) {
            (val as THREE.Texture).dispose();
          }
        }
        m.dispose();
      }
    }
  });
}
