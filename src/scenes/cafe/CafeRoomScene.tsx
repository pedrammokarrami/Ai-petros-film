import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ContactShadows, MeshReflectorMaterial, RoundedBox, useGLTF } from '@react-three/drei';
import {
  DRACO_DECODER_URL,
  type ConcertAssetManifest
} from '../concert/concertAssets';
import type { RoomLightingFxMode } from '../../prototype/components/SonicRoom3DWorld';
import {
  DEFAULT_ROOM_LIGHTING_PROFILES,
  type RoomLightingCalibration
} from '../../types/lighting';
import {
  createPBRMaterial,
  createSoftVolumetricBeamMaterial,
  disposePBRMaterial,
  hash01,
  LockedSymmetricalCameraRig,
  RiggedHumanAvatar,
  RoomCanvasFrame,
  RoomErrorBoundary,
  sampleMusicSyncLighting,
  SceneReadySignal,
  useLiveTrackCanvasTexture,
  woodPlanksPBR,
  type HumanActivityMode,
  type PBRTextureSet,
  type RoomCameraSpec,
  type SharedRoomSceneProps,
  type WesternHatStyle,
  type WesternOutfitPreset,
  type WesternPropType
} from '../shared/SonicRoomShared';
import {
  createPolyHavenStandardMaterial,
  usePolyHavenPBR
} from '../shared/polyhavenTextures';
import { assignPeersToCastSlots, PeerOverheadBadge } from '../shared/RoomPeerAvatars';
import type { RoomPeerParticipant } from '../../types/roomSync';

/**
 * Ready-Made 1899 Western Saloon GLB Character Models (512x512 fast mobile atlas,
 * Western Waistcoats, Frontier Shirts, Leather Cowboy Boots & Sculpted 3D Cowboy Hats)
 */
export const WESTERN_SALOON_GLB_MODELS = {
  gunslinger: '/models/cafe/cowboy-gunslinger.glb?v=rdr2_v8',
  gambler: '/models/cafe/cowboy-gambler.glb?v=rdr2_v8',
  rancher: '/models/cafe/cowboy-rancher.glb?v=rdr2_v8',
  bartender: '/models/cafe/saloon-bartender.glb?v=rdr2_v8',
  saloonLady: '/models/cafe/saloon-lady.glb?v=rdr2_v8'
} as const;

export const WESTERN_SALOON_PROP_GLBS = {
  roundTable: '/models/cafe/props/round_wooden_table_01.glb',
  saloonChair: '/models/cafe/props/dining_chair_02.glb',
  wineBottles: '/models/cafe/props/wine_bottles_01.glb',
  wineBarrel: '/models/cafe/props/wine_barrel_01.glb',
  displayShelves: '/models/cafe/props/wooden_display_shelves_01.glb',
  ornateMirror: '/models/cafe/props/ornate_mirror_01.glb',
  pictureFrame: '/models/cafe/props/fancy_picture_frame_02.glb',
  guitar: '/models/cafe/props/Ukulele_01.glb',
  woodenStool: '/models/cafe/props/wooden_stool_01.glb',
  chandelier: '/models/cafe/props/Chandelier_03.glb',
  lantern: '/models/cafe/props/Lantern_01.glb'
} as const;

const EMPTY_MOCAP_CLIPS: THREE.AnimationClip[] = [];

let cafeAssetsPreloaded = false;

export function preloadCafeAssets(): void {
  if (cafeAssetsPreloaded) return;
  cafeAssetsPreloaded = true;
  Object.values(WESTERN_SALOON_GLB_MODELS).forEach((url) => {
    useGLTF.preload(url, DRACO_DECODER_URL);
  });
  Object.values(WESTERN_SALOON_PROP_GLBS).forEach((url) => {
    useGLTF.preload(url, DRACO_DECODER_URL);
  });
}

/**
 * Camera Spec calibrated to match IMG_4438.webp on mobile portrait & desktop viewports:
 * Elevated 3/4 vantage point looking diagonally down across the 3 foreground/midground
 * green-felt poker tables, with the heavy rough-hewn timber column + brass spittoon framing
 * the right foreground, stage with upright piano & seated guitarist in the midground-left,
 * bar with smoky tarnished mirror in the background, and upper mezzanine + sunbeams above.
 */
export const CAFE_CAMERA_SPEC: RoomCameraSpec = {
  cinematic: { position: [0.88, 3.18, 6.38], target: [-0.48, 1.25, -2.55], fov: 56 },
  first_person: { position: [0.65, 1.72, 3.85], target: [-0.65, 1.62, -3.8], fov: 60 },
  stage_closeup: { position: [-0.35, 1.78, -1.25], target: [-1.15, 1.55, -4.2], fov: 52 },
  bounds: { minX: -5.2, maxX: 5.2, minY: 1.1, maxY: 5.4, minZ: -3.2, maxZ: 8.5 }
};

export interface SaloonPokerTableSpec {
  position: [number, number];
  seatAngles: number[];
}

/**
 * Poker Table Layout matching IMG_4438.webp:
 * - Tables 0, 1, 2 form the signature diagonal foreground-to-midground stair-step row of green-felt poker tables
 *   with lit pillar candles, rising white smoke plumes, cards, and seated patrons on left & right.
 * - Tables 3 & 4 populate the left window side and right side for full saloon depth.
 */
export const SALOON_POKER_TABLES: SaloonPokerTableSpec[] = [
  // Table 0 (Bottom-Left Foreground in IMG_4438.webp): 2-person table
  { position: [-0.36, 3.22], seatAngles: [-Math.PI / 2 + 0.16, Math.PI / 2 - 0.16] },
  // Table 1 (Center Midground in IMG_4438.webp): 2-person table
  { position: [0.02, 1.05], seatAngles: [-Math.PI / 2 + 0.14, Math.PI / 2 - 0.16] },
  // Table 2 (Upper-Right Midground near Stage/Bar in IMG_4438.webp): 2-person table
  { position: [0.46, -0.95], seatAngles: [-Math.PI / 2 + 0.12, Math.PI / 2 - 0.14] },
  // Table 3 (Far Left under Windows in IMG_4438.webp): 2-person table
  { position: [-3.15, -0.85], seatAngles: [0.42, -Math.PI / 2] },
  // Table 4 (Far Right behind Timber Column): 3-person table
  { position: [2.95, 0.25], seatAngles: [0, Math.PI / 2, -Math.PI / 2] }
];

let CACHED_WALLPAPER_PBR: PBRTextureSet | null = null;
let CACHED_SAWDUST_TEX: THREE.CanvasTexture | null = null;
let CACHED_SUNLIT_FLOOR_TEX: THREE.CanvasTexture | null = null;
let CACHED_PELT_TEX: THREE.CanvasTexture | null = null;
let CACHED_SMOKE_PUFF_TEX: THREE.CanvasTexture | null = null;
const CACHED_VINTAGE_PHOTO_TEX: Record<number, THREE.CanvasTexture> = {};

/**
 * Soft Radial Smoke Plume Billboard Texture (Power-of-Two 256x256)
 * Used for natural rising candle & cigarette smoke above the poker tables and guitarist.
 */
function createSoftSmokePuffTexture(): THREE.CanvasTexture {
  if (CACHED_SMOKE_PUFF_TEX) return CACHED_SMOKE_PUFF_TEX;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 120);
  g.addColorStop(0, 'rgba(238, 236, 232, 0.42)');
  g.addColorStop(0.38, 'rgba(218, 215, 210, 0.24)');
  g.addColorStop(0.72, 'rgba(195, 192, 186, 0.08)');
  g.addColorStop(1, 'rgba(180, 178, 172, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  CACHED_SMOKE_PUFF_TEX = tex;
  return tex;
}

/**
 * Spotted Brown & White Frontier Hide / Bear Pelt Texture (Power-of-Two 256x256, matching IMG_4438.webp)
 */
function createSpottedHidePeltTexture(): THREE.CanvasTexture {
  if (CACHED_PELT_TEX) return CACHED_PELT_TEX;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#2b1e16';
  ctx.fillRect(0, 0, size, size);

  // Cream-white & mottled brown fur patches like the wall hide in IMG_4438.webp
  const patches = [
    { x: 65, y: 78, r: 44, col: '#e6ded2' },
    { x: 185, y: 92, r: 48, col: '#dfd5c7' },
    { x: 128, y: 185, r: 52, col: '#e2d8ca' },
    { x: 75, y: 165, r: 36, col: '#4a3525' },
    { x: 165, y: 145, r: 42, col: '#3d2a1d' }
  ];
  patches.forEach((p) => {
    const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r);
    g.addColorStop(0, p.col);
    g.addColorStop(0.65, p.col);
    g.addColorStop(1, 'rgba(43, 30, 22, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  CACHED_PELT_TEX = tex;
  return tex;
}

/**
 * 1899 Desaturated Weathered Saloon Wood & Plaster Patina PBR Texture
 */
function createRdr2SaloonWallpaperPBR(repeatX = 6, repeatY = 2): PBRTextureSet {
  if (CACHED_WALLPAPER_PBR) return CACHED_WALLPAPER_PBR;
  const size = 512;
  const cMap = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cBump.width = cRough.width = size;
  cMap.height = cBump.height = cRough.height = size;

  const ctx = cMap.getContext('2d')!;
  const bCtx = cBump.getContext('2d')!;
  const rCtx = cRough.getContext('2d')!;

  const baseGrad = ctx.createLinearGradient(0, 0, 0, size);
  baseGrad.addColorStop(0, '#2b231d');
  baseGrad.addColorStop(0.5, '#362c24');
  baseGrad.addColorStop(1, '#241d17');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#c8c8c8';
  rCtx.fillRect(0, 0, size, size);

  const cols = 8;
  const colW = size / cols;
  for (let c = 0; c < cols; c++) {
    const x = c * colW;
    ctx.fillStyle = c % 2 === 0 ? 'rgba(58, 46, 36, 0.36)' : 'rgba(32, 25, 19, 0.36)';
    ctx.fillRect(x, 0, colW, size);

    ctx.strokeStyle = 'rgba(145, 124, 96, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 4, 0);
    ctx.lineTo(x + 4, size);
    ctx.stroke();
  }

  for (let i = 0; i < 55; i++) {
    const px = hash01(i * 5.1) * size;
    const py = hash01(i * 8.7) * size;
    const rad = 30 + hash01(i * 3.3) * 80;
    const g = ctx.createRadialGradient(px, py, 4, px, py, rad);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(18, 14, 11, 0.46)' : 'rgba(88, 72, 56, 0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  const configure = (canvas: HTMLCanvasElement, isColor: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  };

  CACHED_WALLPAPER_PBR = {
    map: configure(cMap, true),
    bumpMap: configure(cBump, false),
    roughnessMap: configure(cRough, false),
    dispose: () => {}
  };
  return CACHED_WALLPAPER_PBR;
}

/**
 * Subtle Natural Sawdust & Floor Wear Overlay Texture (Power-of-Two 512x512)
 */
function createSawdustFloorTexture(): THREE.CanvasTexture {
  if (CACHED_SAWDUST_TEX) return CACHED_SAWDUST_TEX;
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  for (let p = 0; p < 32; p++) {
    const px = hash01(p * 7.1 + 1) * size;
    const py = hash01(p * 13.3 + 2) * size;
    const rad = 28 + hash01(p * 3.7) * 65;
    const g = ctx.createRadialGradient(px, py, 4, px, py, rad);
    g.addColorStop(0, 'rgba(168, 146, 114, 0.26)');
    g.addColorStop(0.55, 'rgba(138, 118, 92, 0.14)');
    g.addColorStop(1, 'rgba(110, 92, 68, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 1800; i++) {
    const x = hash01(i * 3.17) * size;
    const y = hash01(i * 5.83) * size;
    const w = 1.4 + hash01(i * 9.1) * 3.0;
    const h = 0.8 + hash01(i * 2.3) * 1.4;
    const rot = hash01(i * 4.7) * Math.PI;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(195, 174, 138, 0.38)'
        : i % 3 === 1
          ? 'rgba(158, 136, 104, 0.34)'
          : 'rgba(122, 102, 76, 0.28)';
    ctx.fillRect(-w * 0.5, -h * 0.5, w, h);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 5);
  tex.needsUpdate = true;
  CACHED_SAWDUST_TEX = tex;
  return tex;
}

/**
 * Projected Diagonal Window Sunlight Patch Texture with Soft Mullion Grid Shadows (matching IMG_4438.webp floor)
 */
function createSunlitFloorPatchTexture(): THREE.CanvasTexture {
  if (CACHED_SUNLIT_FLOOR_TEX) return CACHED_SUNLIT_FLOOR_TEX;
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const g = ctx.createRadialGradient(w * 0.48, h * 0.5, 16, w * 0.5, h * 0.5, w * 0.48);
  g.addColorStop(0, 'rgba(255, 244, 214, 0.52)');
  g.addColorStop(0.55, 'rgba(248, 226, 178, 0.34)');
  g.addColorStop(0.85, 'rgba(235, 206, 152, 0.14)');
  g.addColorStop(1, 'rgba(220, 190, 135, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'destination-out';
  [0.34, 0.66].forEach((fx) => {
    const sg = ctx.createLinearGradient(w * fx - 12, 0, w * fx + 12, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(0.5, 'rgba(0,0,0,0.32)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(w * fx - 12, 0, 24, h);
  });
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  CACHED_SUNLIT_FLOOR_TEX = tex;
  return tex;
}

/**
 * Faded 1899 Sepia Tintype / Daguerreotype Vintage Photograph Texture (Power-of-Two 256x256)
 */
function createVintagePhotoTexture(variant = 0): THREE.CanvasTexture {
  if (CACHED_VINTAGE_PHOTO_TEX[variant]) return CACHED_VINTAGE_PHOTO_TEX[variant];
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  const g = ctx.createRadialGradient(128, 120, 24, 128, 128, 165);
  g.addColorStop(0, '#dcd2c0');
  g.addColorStop(0.65, '#9e917c');
  g.addColorStop(1, '#26201a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#d4cab8';
  ctx.lineWidth = 16;
  ctx.strokeRect(14, 14, 228, 228);
  ctx.strokeStyle = '#382e24';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, 208, 208);

  if (variant % 2 === 0) {
    [-42, 0, 42].forEach((ox, idx) => {
      const cx = 128 + ox;
      const cy = 124 + (idx === 1 ? -6 : 4);
      ctx.fillStyle = '#26201a';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 22, 22, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 12, cy - 36, 24, 15);
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy + 36, 24, 32, 0, Math.PI, 0, true);
      ctx.fill();
    });
  } else {
    ctx.fillStyle = '#42382e';
    ctx.beginPath();
    ctx.moveTo(28, 170);
    ctx.lineTo(75, 95);
    ctx.lineTo(130, 145);
    ctx.lineTo(185, 88);
    ctx.lineTo(228, 170);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#241e18';
    ctx.fillRect(28, 165, 200, 62);
    ctx.fillRect(62, 128, 48, 38);
    ctx.fillRect(138, 118, 54, 48);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  CACHED_VINTAGE_PHOTO_TEX[variant] = tex;
  return tex;
}

/**
 * Clone a loaded Poly Haven GLB scene with shadow casting enabled cleanly per instance
 */
function clonePropGlb(scene: THREE.Object3D): THREE.Object3D {
  const cloned = scene.clone(true);
  cloned.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return cloned;
}

/**
 * Reusable Poly Haven GLB Prop Renderer
 */
function SimpleGlbProp({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1
}: {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}) {
  const gltf = useGLTF(url, DRACO_DECODER_URL);
  const obj = useMemo(() => clonePropGlb(gltf.scene), [gltf.scene]);
  return <primitive object={obj} position={position} rotation={rotation} scale={scale} />;
}

/**
 * Framed Faded Vintage 1899 Sepia Photograph using Real Poly Haven Frame (`fancy_picture_frame_02.glb`)
 */
function FramedVintagePhotograph({
  position,
  rotation = [0, 0, 0],
  scale = 1,
  variant = 0
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  variant?: number;
}) {
  const tex = useMemo(() => createVintagePhotoTexture(variant), [variant]);
  const gltf = useGLTF(WESTERN_SALOON_PROP_GLBS.pictureFrame, DRACO_DECODER_URL);
  const framedObj = useMemo(() => {
    const cloned = clonePropGlb(gltf.scene);
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.Material | undefined;
      const isCanvas =
        mesh.name.includes('canvas') ||
        mesh.name === 'Plane.003' ||
        (mat && mat.name.includes('canvas'));
      if (isCanvas) {
        mesh.material = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.65,
          metalness: 0.04
        });
      }
    });
    return cloned;
  }, [gltf.scene, tex]);

  return <primitive object={framedObj} position={position} rotation={rotation} scale={scale} />;
}

/**
 * Real Poly Haven Wine & Whiskey Bottle Cluster (`wine_bottles_01.glb`)
 * Populates the bar counter, backbar ledge, left display shelves, and right display shelves.
 */
function SaloonWineBottlesCluster() {
  const gltf = useGLTF(WESTERN_SALOON_PROP_GLBS.wineBottles, DRACO_DECODER_URL);
  const bottleInstances = useMemo(() => {
    const nodeNames = [
      'wine_bottles_01_bordeaux',
      'wine_bottles_01_alsace',
      'wine_bottles_01_burgundy',
      'wine_bottles_01_champagne'
    ];
    const templates = nodeNames
      .map((name) => gltf.scene.getObjectByName(name))
      .filter((n): n is THREE.Object3D => Boolean(n));
    const fallbackTemplate = templates.length > 0 ? templates : [gltf.scene];

    const placements: Array<{ pos: [number, number, number]; scale: number; rotY: number; idx: number }> = [];

    // 1. Backbar shelf ledge directly under the mottled tarnished mirror (y = 1.18, z = -6.08)
    for (let i = 0; i < 16; i++) {
      const bx = -0.52 + i * 0.18 + (hash01(i * 4.3) - 0.5) * 0.03;
      const bz = -6.08 + (i % 2 === 0 ? -0.05 : 0.05);
      placements.push({
        pos: [bx, 1.18, bz],
        scale: 0.98 + hash01(i * 2.1) * 0.18,
        rotY: hash01(i * 7.7) * Math.PI * 2,
        idx: i
      });
    }

    // 2. Bar counter rear & left bottles (avoiding brass cash register around x=1.73, z=-5.13)
    const barXs = [-0.55, -0.34, -0.18, 0.05, 0.28, 0.88, 1.12, 2.38, 2.65, 2.86];
    barXs.forEach((bx, i) => {
      placements.push({
        pos: [bx, 1.087, -5.36 + (i % 2) * 0.1],
        scale: 0.96 + hash01(i * 3.1) * 0.15,
        rotY: hash01(i * 9.2) * Math.PI * 2,
        idx: i + 3
      });
    });

    // 3. Left wooden display shelves (`[-2.2, 0, -6.34]`, scale `[1.0, 1.45, 1.35]`)
    // Exact shelf plank top Ys: 1.146, 1.689, 2.255; X range: -2.78 .. -1.62
    [1.146, 1.689, 2.255].forEach((sy, rowIdx) => {
      for (let col = 0; col < 5; col++) {
        placements.push({
          pos: [-2.74 + col * 0.27 + (hash01(rowIdx * 10 + col) - 0.5) * 0.03, sy, -6.34],
          scale: 0.92 + hash01(col * 3.7 + rowIdx) * 0.14,
          rotY: hash01(col * 5.9 + rowIdx) * Math.PI * 2,
          idx: rowIdx * 5 + col
        });
      }
    });

    // 4. Right wooden display shelves (`[3.25, 0, -6.28]`, scale `[1.0, 1.35, 1.2]`)
    // Exact shelf plank top Ys: 1.067, 1.573, 2.099; X range: 2.74 .. 3.76
    [1.067, 1.573, 2.099].forEach((sy, rowIdx) => {
      for (let col = 0; col < 4; col++) {
        placements.push({
          pos: [2.76 + col * 0.32 + (hash01(rowIdx * 13 + col) - 0.5) * 0.03, sy, -6.28],
          scale: 0.92 + hash01(col * 4.1 + rowIdx) * 0.14,
          rotY: hash01(col * 6.3 + rowIdx) * Math.PI * 2,
          idx: rowIdx * 4 + col + 2
        });
      }
    });

    return placements.map((p) => {
      const tpl = fallbackTemplate[p.idx % fallbackTemplate.length];
      const obj = clonePropGlb(tpl);
      obj.position.set(0, 0, 0);
      return { obj, pos: p.pos, scale: p.scale, rotY: p.rotY };
    });
  }, [gltf.scene]);

  return (
    <group>
      {bottleInstances.map((b, i) => (
        <primitive
          key={i}
          object={b.obj}
          position={b.pos}
          rotation={[0, b.rotY, 0]}
          scale={b.scale}
        />
      ))}
    </group>
  );
}

/**
 * Wall-Mounted Spotted Hide / Bear Skin Pelt (Matching Upper Wall of IMG_4438.webp)
 */
function WallMountedHidePelt({
  position,
  rotation = [0, 0, 0],
  scale = 1
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const peltTex = useMemo(() => createSpottedHidePeltTexture(), []);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh scale={[1.05, 1.18, 0.08]} castShadow receiveShadow>
        <cylinderGeometry args={[0.66, 0.58, 0.08, 18]} />
        <meshStandardMaterial map={peltTex} roughness={0.92} />
      </mesh>
      {[-1, 1].map((side) =>
        [
          { y: 0.42, rotZ: side * -0.62, len: 0.62 },
          { y: -0.45, rotZ: side * -0.48, len: 0.58 }
        ].map((limb, lIdx) => (
          <group key={`${side}-${lIdx}`} position={[side * 0.48, limb.y, 0.01]} rotation={[0, 0, limb.rotZ]}>
            <mesh castShadow>
              <boxGeometry args={[limb.len, 0.24, 0.06]} />
              <meshStandardMaterial map={peltTex} roughness={0.92} />
            </mesh>
          </group>
        ))
      )}
    </group>
  );
}

/**
 * Sculpted Taxidermy Stag / Deer Head & Multi-Point Antlers Trophy (Matching Upper-Left of IMG_4438.webp)
 */
function TaxidermyStagHeadMount({
  position,
  rotation = [0, 0, 0],
  scale = 1
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Dark Wood Shield Plaque */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.3, 0.05, 10]} />
        <meshStandardMaterial color="#2b1e14" roughness={0.55} />
      </mesh>
      {/* Sculpted Stag Neck & Chest */}
      <mesh position={[0, -0.04, 0.14]} rotation={[1.05, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.19, 0.36, 14]} />
        <meshStandardMaterial color="#6e5844" roughness={0.82} />
      </mesh>
      {/* Stag Head & Snout */}
      <mesh position={[0, 0.08, 0.28]} castShadow>
        <sphereGeometry args={[0.125, 14, 14]} />
        <meshStandardMaterial color="#78614c" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.03, 0.42]} rotation={[Math.PI / 2 + 0.2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.095, 0.22, 12]} />
        <meshStandardMaterial color="#68523f" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.01, 0.53]}>
        <sphereGeometry args={[0.032, 10, 10]} />
        <meshStandardMaterial color="#1c1612" roughness={0.4} />
      </mesh>
      {/* Stag Ears */}
      {[-1, 1].map((side) => (
        <mesh
          key={`ear-${side}`}
          position={[side * 0.14, 0.16, 0.24]}
          rotation={[0.2, 0, side * -0.85]}
          castShadow
        >
          <coneGeometry args={[0.042, 0.16, 8]} />
          <meshStandardMaterial color="#6e5844" roughness={0.82} />
        </mesh>
      ))}
      {/* Large Branching Antlers */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.06, 0.18, 0.26]} rotation={[0.18, 0, side * -0.52]}>
          <mesh position={[side * 0.22, 0.28, -0.04]} rotation={[-0.15, 0, side * -0.32]} castShadow>
            <cylinderGeometry args={[0.015, 0.026, 0.72, 10]} />
            <meshStandardMaterial color="#d8ccb8" roughness={0.52} />
          </mesh>
          {[0.16, 0.34, 0.5, 0.62].map((ty, tIdx) => (
            <mesh
              key={tIdx}
              position={[side * (0.14 + tIdx * 0.075), ty, 0.03]}
              rotation={[0.32, 0, side * 0.38]}
              castShadow
            >
              <coneGeometry args={[0.014, 0.24, 8]} />
              <meshStandardMaterial color="#e4dac8" roughness={0.48} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Heavy, Rough-Hewn Dark-Stained Timber Support Post with Weathered Wood Grain
 * Matches the prominent foreground right column and structural posts in IMG_4438.webp.
 */
function RoughHewnTimberPost({
  position,
  height = 4.9,
  width = 0.34,
  darkTimberMat,
  saloonWoodMat,
  hasKneeBraces = true
}: {
  position: [number, number, number];
  height?: number;
  width?: number;
  darkTimberMat: THREE.MeshStandardMaterial;
  saloonWoodMat: THREE.MeshStandardMaterial;
  hasKneeBraces?: boolean;
}) {
  return (
    <group position={position}>
      <RoundedBox
        args={[width * 1.18, 0.18, width * 1.18]}
        radius={0.015}
        smoothness={2}
        position={[0, 0.09, 0]}
        material={saloonWoodMat}
        castShadow
        receiveShadow
      />
      <RoundedBox
        args={[width, height, width]}
        radius={0.018}
        smoothness={3}
        position={[0, height * 0.5, 0]}
        material={darkTimberMat}
        castShadow
        receiveShadow
      />
      {/* Vertical rough-hewn split seams */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (width * 0.18), height * 0.5, width * 0.502]}>
          <boxGeometry args={[0.008, height * 0.92, 0.006]} />
          <meshStandardMaterial color="#1c1510" roughness={0.9} />
        </mesh>
      ))}
      {hasKneeBraces &&
        [-1, 1].map((dir) => (
          <mesh
            key={dir}
            position={[0, height - 0.38, dir * (width * 0.88)]}
            rotation={[dir * 0.68, 0, 0]}
            material={darkTimberMat}
            castShadow
          >
            <boxGeometry args={[width * 0.72, 0.78, width * 0.52]} />
          </mesh>
        ))}
    </group>
  );
}

/**
 * Ornate Forged Black Wrought-Iron Balcony Railing Section (Matching Mezzanine in IMG_4438.webp)
 */
function WroughtIronRailingSection({
  width,
  position,
  rotation = [0, 0, 0]
}: {
  width: number;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const balusterCount = Math.max(4, Math.floor(width / 0.24));
  const spacing = width / balusterCount;
  return (
    <group position={position} rotation={rotation}>
      {/* Weathered Dark Timber Top Handrail */}
      <RoundedBox args={[width, 0.07, 0.1]} radius={0.02} smoothness={3} position={[0, 0.88, 0]} castShadow>
        <meshStandardMaterial color="#3b2f25" roughness={0.58} />
      </RoundedBox>
      {/* Upper & Lower Forged Wrought-Iron Rails */}
      <mesh position={[0, 0.76, 0]} castShadow>
        <boxGeometry args={[width, 0.028, 0.038]} />
        <meshStandardMaterial color="#181615" metalness={0.82} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[width, 0.032, 0.042]} />
        <meshStandardMaterial color="#181615" metalness={0.82} roughness={0.38} />
      </mesh>
      {/* Vertical Iron Balusters & Ornate Scrollwork Rings */}
      {Array.from({ length: balusterCount + 1 }).map((_, i) => {
        const bx = -width * 0.5 + i * spacing;
        return (
          <group key={i} position={[bx, 0.44, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.01, 0.01, 0.82, 8]} />
              <meshStandardMaterial color="#1a1816" metalness={0.85} roughness={0.36} />
            </mesh>
            {i < balusterCount && (
              <>
                <mesh position={[spacing * 0.5, 0.16, 0]}>
                  <torusGeometry args={[spacing * 0.34, 0.008, 8, 16]} />
                  <meshStandardMaterial color="#1f1c1a" metalness={0.85} roughness={0.35} />
                </mesh>
                <mesh position={[spacing * 0.5, -0.16, 0]}>
                  <torusGeometry args={[spacing * 0.34, 0.008, 8, 16]} />
                  <meshStandardMaterial color="#1f1c1a" metalness={0.85} roughness={0.35} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Period-Accurate 1899 Lever-Action Repeater Rifle Leaning Against Bar / Wall
 */
function FrontierLeverActionRifle({
  position,
  rotation = [0.18, 0, 0.12]
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[0.042, 0.34, 0.11]} radius={0.012} smoothness={2} position={[0, 0.17, -0.02]} rotation={[0.14, 0, 0]} castShadow>
        <meshStandardMaterial color="#4a3321" roughness={0.52} />
      </RoundedBox>
      <RoundedBox args={[0.038, 0.18, 0.068]} radius={0.006} smoothness={2} position={[0, 0.41, 0]} castShadow>
        <meshStandardMaterial color="#9c824c" metalness={0.85} roughness={0.32} />
      </RoundedBox>
      <mesh position={[0, 0.36, 0.045]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.036, 0.006, 8, 14]} />
        <meshStandardMaterial color="#231f1d" metalness={0.88} roughness={0.3} />
      </mesh>
      <RoundedBox args={[0.034, 0.28, 0.048]} radius={0.008} smoothness={2} position={[0, 0.62, 0.004]} castShadow>
        <meshStandardMaterial color="#4a3321" roughness={0.52} />
      </RoundedBox>
      <mesh position={[0, 0.78, -0.008]} castShadow>
        <cylinderGeometry args={[0.012, 0.014, 0.58, 8]} />
        <meshStandardMaterial color="#24272a" metalness={0.9} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.74, 0.012]} castShadow>
        <cylinderGeometry args={[0.009, 0.009, 0.48, 8]} />
        <meshStandardMaterial color="#2b2f33" metalness={0.88} roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * Polished Brass Saloon Spittoon (Cuspidor) matching the foreground right column base in IMG_4438.webp
 */
function BrassSaloonSpittoon({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.135, 0.15, 0.05, 18]} />
        <meshStandardMaterial color="#8f7538" metalness={0.88} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.11, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.088, 0.125, 0.14, 18]} />
        <meshStandardMaterial color="#9e8240" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.078, 0.055, 18]} />
        <meshStandardMaterial color="#b09248" metalness={0.92} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.228, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.072, 14]} />
        <meshBasicMaterial color="#0b0805" />
      </mesh>
    </group>
  );
}

/**
 * Real Poly Haven Acoustic Guitar (`Ukulele_01.glb` scaled to parlour guitar proportions)
 */
function AuthenticWesternAcousticGuitar() {
  const gltf = useGLTF(WESTERN_SALOON_PROP_GLBS.guitar, DRACO_DECODER_URL);
  const guitarObj = useMemo(() => clonePropGlb(gltf.scene), [gltf.scene]);
  return (
    <group position={[-0.3109, 0.685, 0.1714]} rotation={[-0.0299, -0.185, -1.2078]} scale={1.38}>
      <primitive object={guitarObj} />
    </group>
  );
}

/**
 * Real Poly Haven Brass/Crystal Candle Chandelier (`Chandelier_03.glb`) + Warm Saloon Point Light
 */
function BrassWagonWheelChandelier({
  position,
  lightRef
}: {
  position: [number, number, number];
  lightRef?: React.Ref<THREE.PointLight>;
}) {
  const gltf = useGLTF(WESTERN_SALOON_PROP_GLBS.chandelier, DRACO_DECODER_URL);
  const chandelierObj = useMemo(() => clonePropGlb(gltf.scene), [gltf.scene]);
  return (
    <group position={[position[0], 5.75, position[2]]}>
      <pointLight ref={lightRef} color="#ffdf9e" intensity={2.4} decay={1.2} distance={13} position={[0, -1.65, 0]} />
      <primitive object={chandelierObj} scale={1.75} />
    </group>
  );
}

/**
 * 1899 Ornate Brass National Cash Register (On Right End of Bar Counter in IMG_4438.webp)
 */
function AntiqueBrassCashRegister({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, -0.25, 0]}>
      <RoundedBox args={[0.44, 0.1, 0.34]} radius={0.015} smoothness={3} position={[0, 0.05, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#38291e" roughness={0.48} />
      </RoundedBox>
      <RoundedBox args={[0.38, 0.26, 0.28]} radius={0.03} smoothness={4} position={[0, 0.22, -0.02]} castShadow>
        <meshStandardMaterial color="#8f763a" metalness={0.86} roughness={0.28} />
      </RoundedBox>
      <RoundedBox args={[0.3, 0.09, 0.05]} radius={0.01} smoothness={2} position={[0, 0.39, -0.02]} castShadow>
        <meshStandardMaterial color="#7d6632" metalness={0.85} roughness={0.3} />
      </RoundedBox>
    </group>
  );
}

/**
 * Real Poly Haven Hooped Oak Wine/Whiskey Barrel (`wine_barrel_01.glb`)
 */
function OakWhiskeyBarrel({
  position,
  rotation = [0, 0, 0],
  scale = 1
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const gltf = useGLTF(WESTERN_SALOON_PROP_GLBS.wineBarrel, DRACO_DECODER_URL);
  const barrelObj = useMemo(() => clonePropGlb(gltf.scene), [gltf.scene]);
  return <primitive object={barrelObj} position={position} rotation={rotation} scale={scale} />;
}

/**
 * Authentic 1899 Western Saloon Green-Felt Poker Table
 * Built atop Real Poly Haven `round_wooden_table_01.glb` + `dining_chair_02.glb`
 * with green baize felt, pillar candle, rising smoke, playing cards & whiskey glasses.
 */
function SaloonPokerAndWhiskeyTable({
  position,
  seatAngles,
  tableIdx,
  candleLightRef,
  candleFlameMatRef
}: {
  position: [number, number, number];
  seatAngles: number[];
  saloonWoodMat: THREE.MeshStandardMaterial;
  darkTimberMat: THREE.MeshStandardMaterial;
  tableIdx: number;
  candleLightRef?: React.Ref<THREE.PointLight>;
  candleFlameMatRef?: React.Ref<THREE.MeshStandardMaterial>;
}) {
  const seatRadius = 0.86;
  const smokeTex = useMemo(() => createSoftSmokePuffTexture(), []);
  const tableGltf = useGLTF(WESTERN_SALOON_PROP_GLBS.roundTable, DRACO_DECODER_URL);
  const chairGltf = useGLTF(WESTERN_SALOON_PROP_GLBS.saloonChair, DRACO_DECODER_URL);

  const tableObj = useMemo(() => clonePropGlb(tableGltf.scene), [tableGltf.scene]);
  const chairs = useMemo(
    () =>
      seatAngles.map((ang) => ({
        obj: clonePropGlb(chairGltf.scene),
        x: Math.sin(ang) * seatRadius,
        z: Math.cos(ang) * seatRadius,
        rotY: ang + Math.PI
      })),
    [chairGltf.scene, seatAngles]
  );

  return (
    <group position={position}>
      {/* Real Poly Haven Weathered Round Wooden Table Base (`round_wooden_table_01.glb` scaled so tabletop sits at y=0.768) */}
      <primitive object={tableObj} scale={[0.88, 0.765, 0.88]} />

      {/* Matte Forest-Green Poker Felt Top Overlay */}
      <mesh position={[0, 0.77, 0]} receiveShadow>
        <cylinderGeometry args={[0.53, 0.53, 0.006, 36]} />
        <meshStandardMaterial color={tableIdx % 2 === 0 ? '#274d36' : '#234530'} roughness={0.92} />
      </mesh>

      {/* Center Thick Cream Wax Pillar Candle on Wooden Coaster (Matching IMG_4438.webp) */}
      <group position={[-0.05, 0.773, 0.02]}>
        {tableIdx < 3 && (
          <pointLight
            ref={candleLightRef}
            color="#ffcf82"
            intensity={1.25}
            decay={1.6}
            distance={3.4}
            position={[0, 0.24, 0]}
          />
        )}
        {/* Wooden Candle Coaster Base */}
        <mesh position={[0, 0.016, 0]} castShadow>
          <cylinderGeometry args={[0.048, 0.052, 0.032, 16]} />
          <meshStandardMaterial color="#6e4b2a" roughness={0.55} />
        </mesh>
        {/* Thick Cream Wax Pillar Candle */}
        <mesh position={[0, 0.068, 0]} castShadow>
          <cylinderGeometry args={[0.034, 0.036, 0.078, 16]} />
          <meshStandardMaterial
            color="#f5efe2"
            emissive="#ffdf9e"
            emissiveIntensity={0.45}
            roughness={0.42}
          />
        </mesh>
        {/* Bright Warm-White Candle Flame */}
        <mesh position={[0, 0.122, 0]}>
          <coneGeometry args={[0.012, 0.036, 8]} />
          <meshStandardMaterial
            ref={candleFlameMatRef}
            color="#ffffff"
            emissive="#ffe4a8"
            emissiveIntensity={4.0}
          />
        </mesh>
        {/* Soft Rising White-Grey Smoke Plume Above the Candle & Table */}
        {tableIdx < 3 && (
          <group position={[0.04, 0.28, 0]}>
            <mesh position={[0, 0, 0]} rotation={[0, 0.25, 0]}>
              <planeGeometry args={[0.68, 0.74]} />
              <meshBasicMaterial map={smokeTex} transparent opacity={0.62} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0.08, 0.26, -0.04]} rotation={[0, -0.35, 0.12]}>
              <planeGeometry args={[0.84, 0.88]} />
              <meshBasicMaterial map={smokeTex} transparent opacity={0.48} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}
      </group>

      {/* Scattered White Playing Cards in the Center of the Green Felt (Matching IMG_4438.webp) */}
      {[
        { x: 0.05, z: 0.12, rot: 0.25 },
        { x: 0.11, z: 0.07, rot: -0.4 },
        { x: -0.02, z: 0.19, rot: 0.65 },
        { x: -0.1, z: 0.27, rot: 0.12 },
        { x: 0.14, z: -0.04, rot: 0.85 },
        { x: 0.08, z: -0.12, rot: -0.22 }
      ].map((card, cIdx) => (
        <group key={cIdx} position={[card.x, 0.775 + cIdx * 0.0006, card.z]} rotation={[-Math.PI / 2, 0, card.rot]}>
          <mesh>
            <planeGeometry args={[0.058, 0.082]} />
            <meshStandardMaterial color="#f5f2eb" roughness={0.48} />
          </mesh>
          <mesh position={[0, 0, 0.0005]}>
            <planeGeometry args={[0.018, 0.018]} />
            <meshBasicMaterial color={cIdx % 2 === 0 ? '#991b1b' : '#1c1917'} />
          </mesh>
        </group>
      ))}

      {/* Per-Seat Drinks (Red Sarsaparilla / Whiskey Tumblers), Dealt Cards & Chips */}
      {seatAngles.map((ang, sIdx) => {
        const px = Math.sin(ang) * 0.34;
        const pz = Math.cos(ang) * 0.34;
        const isRedGlass = sIdx % 2 === 0;
        return (
          <group key={sIdx} position={[px, 0.774, pz]} rotation={[0, ang + Math.PI, 0]}>
            {/* Glass Tumbler (Red drink on left, amber whiskey on right just like IMG_4438.webp) */}
            <group position={[isRedGlass ? -0.06 : 0.08, 0, 0.04]}>
              <mesh position={[0, 0.032, 0]} castShadow>
                <cylinderGeometry args={[0.024, 0.02, 0.062, 12]} />
                <meshStandardMaterial color="#f5efe6" roughness={0.14} transparent opacity={0.38} />
              </mesh>
              <mesh position={[0, 0.022, 0]}>
                <cylinderGeometry args={[0.021, 0.018, 0.038, 10]} />
                <meshStandardMaterial
                  color={isRedGlass ? '#991b1b' : '#b45309'}
                  roughness={0.18}
                  transparent
                  opacity={0.88}
                />
              </mesh>
            </group>
            {/* Player's Dealt Cards */}
            {[-0.028, 0.018].map((cx, cIdx) => (
              <mesh
                key={cIdx}
                position={[cx, 0.002 + cIdx * 0.0008, -0.02]}
                rotation={[-Math.PI / 2, 0, (cIdx - 0.5) * 0.28]}
              >
                <planeGeometry args={[0.052, 0.074]} />
                <meshStandardMaterial color="#f5f2eb" roughness={0.45} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Real Poly Haven Weathered Wooden Saloon Chairs (`dining_chair_02.glb`) */}
      {chairs.map((c, sIdx) => (
        <primitive key={sIdx} object={c.obj} position={[c.x, 0, c.z]} rotation={[0, c.rotY, 0]} />
      ))}
    </group>
  );
}

/**
 * 1899 Red Dead Redemption 2 Valentine Saloon Architecture, Natural Daylight Sunbeams,
 * Upper Mezzanine, Stag & Pelt Taxidermy, Stage, Bar with Mottled Mirror & Poker Tables
 */
function SaloonArchitectureAndProps({
  isPlaying,
  bpm,
  pulseIntensity,
  lightingFxMode,
  fxBurstSeq,
  trackTitle,
  trackArtist,
  trackCoverUrl,
  trackAccentHex,
  lightingCalibration,
  isActive = true,
  renderOwnFloor = true,
  onInteractHotspot
}: {
  isPlaying: boolean;
  bpm: number;
  pulseIntensity: number;
  lightingFxMode: RoomLightingFxMode;
  fxBurstSeq: number;
  trackTitle: string;
  trackArtist: string;
  trackCoverUrl?: string;
  trackAccentHex: string;
  lightingCalibration?: RoomLightingCalibration;
  isActive?: boolean;
  renderOwnFloor?: boolean;
  onInteractHotspot?: (action: 'toggle_play' | 'next_track' | 'trigger_fx' | 'open_dj') => void;
}) {
  const cal = lightingCalibration || DEFAULT_ROOM_LIGHTING_PROFILES.cafe;
  const mirrorReflectionTexture = useLiveTrackCanvasTexture({
    style: 'cafe_marquee',
    trackTitle,
    trackArtist,
    trackCoverUrl,
    trackAccentHex,
    bpm,
    isPlaying,
    pulseIntensity,
    isActive
  });

  const floorTex = usePolyHavenPBR('hinoki_planks', 6, 8);
  const sawdustTex = useMemo(() => createSawdustFloorTexture(), []);
  const sunlitFloorTex = useMemo(() => createSunlitFloorPatchTexture(), []);
  const wallpaperTex = useMemo(() => createRdr2SaloonWallpaperPBR(6, 2), []);
  const smokeTex = useMemo(() => createSoftSmokePuffTexture(), []);

  // Light pale wood PBR textures from Poly Haven (hinoki_planks)
  const saloonWoodMat = useMemo(
    () =>
      createPolyHavenStandardMaterial('hinoki_planks', {
        repeatX: 4,
        repeatY: 2,
        normalScale: 0.78,
        roughness: 0.72,
        color: '#f2e3cd'
      }),
    []
  );
  const darkTimberMat = useMemo(
    () =>
      createPolyHavenStandardMaterial('hinoki_planks', {
        repeatX: 3,
        repeatY: 2,
        normalScale: 0.85,
        roughness: 0.76,
        color: '#d8c0a0'
      }),
    []
  );
  const agedBrickMat = useMemo(
    () =>
      createPolyHavenStandardMaterial('hinoki_planks', {
        repeatX: 6,
        repeatY: 3,
        normalScale: 0.9,
        roughness: 0.78,
        color: '#efe0ca'
      }),
    []
  );

  // Natural warm-ivory window daylight sunbeams matching IMG_4438.webp
  const sunbeamShaftMat = useMemo(() => createSoftVolumetricBeamMaterial('#f7ead0', 0.088), []);

  const chandelierLightRef = useRef<THREE.PointLight | null>(null);
  const wallLanternLightRef = useRef<THREE.PointLight | null>(null);
  const candleLightRefs = useRef<Array<THREE.PointLight | null>>([]);
  const candleFlameMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const frontWarmFillRef = useRef<THREE.PointLight | null>(null);
  const stageWarmFillRef = useRef<THREE.PointLight | null>(null);
  const windowSpotRef = useRef<THREE.SpotLight | null>(null);
  const mirrorMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const burstRef = useRef(0);
  const lastSeqRef = useRef(fxBurstSeq);

  useEffect(() => {
    return () => {
      wallpaperTex.dispose();
      saloonWoodMat.dispose();
      darkTimberMat.dispose();
      agedBrickMat.dispose();
      sunbeamShaftMat.dispose();
    };
  }, [agedBrickMat, darkTimberMat, saloonWoodMat, sunbeamShaftMat, wallpaperTex]);

  useFrame(({ clock }, delta) => {
    if (!isActive) return;
    const t = clock.getElapsedTime();
    if (fxBurstSeq !== lastSeqRef.current) {
      lastSeqRef.current = fxBurstSeq;
      burstRef.current = 1.0;
    }
    burstRef.current = Math.max(0, burstRef.current - delta * 1.4);

    const env = sampleMusicSyncLighting({
      time: t,
      bpm,
      isPlaying,
      pulseIntensity,
      lightingFxMode,
      burst: burstRef.current
    });

    const keyMod = cal.audioReactivity;
    const beamMod = cal.beamReactivity;
    const pracMult = cal.practicalIntensity;

    sunbeamShaftMat.uniforms.uTime.value = t * (isPlaying ? 0.9 : 0.5);
    sunbeamShaftMat.uniforms.uOpacity.value = 0.068 * cal.beamOpacity;
    sunbeamShaftMat.uniforms.uBassHit.value = isPlaying ? 0.2 + env.mid * 0.65 * beamMod : 0.18;

    if (chandelierLightRef.current) {
      const base = 2.0 * pracMult;
      chandelierLightRef.current.intensity = isPlaying
        ? base * (0.94 + env.mid * 0.22 * beamMod + env.beatPulse * 0.12 * keyMod)
        : base;
    }
    if (wallLanternLightRef.current) {
      const flicker = 0.94 + 0.06 * Math.sin(t * 7.8);
      const base = 1.35 * pracMult;
      wallLanternLightRef.current.intensity =
        (isPlaying ? base * (0.95 + env.mid * 0.25 * beamMod) : base) * flicker;
    }
    candleLightRefs.current.forEach((light, idx) => {
      const flameFlicker = 0.92 + 0.08 * Math.sin(t * (6.4 + idx * 1.7) + idx * 1.7);
      if (light) {
        const base = 1.45 * pracMult;
        light.intensity =
          (isPlaying ? base * (0.94 + env.mid * 0.25 * beamMod + env.beatPulse * 0.12 * keyMod) : base) *
          flameFlicker;
        light.decay = Math.max(1.5, cal.lightDecay);
      }
      const flameMat = candleFlameMatRefs.current[idx];
      if (flameMat) {
        flameMat.emissiveIntensity =
          (isPlaying ? 3.0 + (env.mid * 1.4 + env.beatPulse * 0.7) * beamMod : 3.4) * flameFlicker;
      }
    });
    if (stageWarmFillRef.current) {
      const base = cal.rimIntensity;
      stageWarmFillRef.current.intensity = isPlaying
        ? base * (0.94 + env.mid * 0.35 * beamMod)
        : base;
    }
    if (frontWarmFillRef.current) {
      const base = cal.fillIntensity;
      frontWarmFillRef.current.intensity = isPlaying
        ? base * (0.95 + env.bass * 0.25 * keyMod)
        : base;
    }
    if (windowSpotRef.current) {
      const base = cal.keyIntensity;
      windowSpotRef.current.intensity = isPlaying
        ? base * (0.96 + env.mid * 0.18 * keyMod)
        : base;
    }
    if (mirrorMatRef.current) {
      mirrorMatRef.current.emissiveIntensity = isPlaying ? 0.44 + env.mid * 0.18 * beamMod : 0.46;
    }
  });

  const barSlats = useMemo(() => Array.from({ length: 18 }, (_, i) => -0.45 + i * 0.22), []);

  const sunlightTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0.25, 0.1, 0.2);
    return o;
  }, []);

  return (
    <group>
      {/* 1. Natural Weathered Barn-Wood Plank Floor (when standalone) + Always-Active Sawdust & Projected Sunlight Floor Patches */}
      {renderOwnFloor && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.5]} receiveShadow>
          <planeGeometry args={[14.5, 18.0]} />
          <MeshReflectorMaterial
            map={floorTex.map}
            normalMap={floorTex.normalMap}
            roughnessMap={floorTex.roughnessMap}
            resolution={256}
            blur={[180, 60]}
            mixBlur={1}
            mixStrength={0.32}
            mirror={0.05}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            depthScale={1.0}
            roughness={0.78}
            color="#f2e2ca"
            metalness={0.04}
          />
        </mesh>
      )}

      {/* Always render Sawdust Overlay & Diagonal Projected Window Sunlight Patches on the Wood Floor (matching IMG_4438.webp) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0.5]} receiveShadow>
        <planeGeometry args={[13.6, 16.8]} />
        <meshStandardMaterial
          map={sawdustTex}
          transparent
          opacity={0.82}
          roughness={0.95}
          depthWrite={false}
        />
      </mesh>
      {[
        { pos: [-1.75, 0.008, -0.55] as [number, number, number], size: [3.9, 1.45] as [number, number], rotZ: -0.46, op: 0.78 },
        { pos: [-0.25, 0.008, 1.95] as [number, number, number], size: [5.2, 1.65] as [number, number], rotZ: -0.46, op: 0.85 },
        { pos: [-2.15, 0.008, 3.15] as [number, number, number], size: [3.2, 1.15] as [number, number], rotZ: -0.46, op: 0.68 }
      ].map((patch, pIdx) => (
        <mesh key={pIdx} position={patch.pos} rotation={[-Math.PI / 2, 0, patch.rotZ]}>
          <planeGeometry args={patch.size} />
          <meshBasicMaterial
            map={sunlitFloorTex}
            transparent
            opacity={patch.op}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* 2. Prominent Foreground Right Rough-Hewn Timber Column + Brass Spittoon (Matching IMG_4438.webp Right Frame) */}
      <RoughHewnTimberPost
        position={[1.24, 0, 1.55]}
        height={5.1}
        width={0.34}
        darkTimberMat={darkTimberMat}
        saloonWoodMat={saloonWoodMat}
        hasKneeBraces
      />
      <BrassSaloonSpittoon position={[1.42, 0, 1.88]} scale={1.18} />

      {/* Secondary Right-Edge Timber Post */}
      <RoughHewnTimberPost
        position={[2.45, 0, 0.45]}
        height={5.1}
        width={0.28}
        darkTimberMat={darkTimberMat}
        saloonWoodMat={saloonWoodMat}
        hasKneeBraces={false}
      />

      {/* Left Midground Timber Support Post under Mezzanine (Matching Left Post in IMG_4438.webp) */}
      <RoughHewnTimberPost
        position={[-3.65, 0, -2.95]}
        height={3.65}
        width={0.24}
        darkTimberMat={darkTimberMat}
        saloonWoodMat={saloonWoodMat}
        hasKneeBraces={false}
      />

      {/* Heavy Sloped Dark Timber Roof Rafters & Ceiling Planks (Matching Top-Right of IMG_4438.webp) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 5.75, 0.5]} material={darkTimberMat}>
        <planeGeometry args={[14.5, 18.0]} />
      </mesh>
      {[-4.8, -2.2, 0.2, 1.55, 3.1, 4.4].map((bz, idx) => (
        <RoundedBox
          key={idx}
          args={[14.2, 0.34, 0.32]}
          radius={0.02}
          smoothness={3}
          position={[0, 5.12, bz]}
          material={darkTimberMat}
          castShadow
        />
      ))}
      {/* Longitudinal Header Beam Above the Right Foreground Column */}
      <RoundedBox
        args={[0.36, 0.38, 14.5]}
        radius={0.02}
        smoothness={3}
        position={[1.24, 4.95, 0.2]}
        material={darkTimberMat}
        castShadow
      />

      {/* 3. Aged Brick & Weathered Wood Back & Side Walls */}
      <mesh position={[0, 3.1, -6.9]} material={agedBrickMat} receiveShadow>
        <planeGeometry args={[14.5, 6.2]} />
      </mesh>
      <RoundedBox args={[14.5, 1.55, 0.1]} radius={0.02} smoothness={3} position={[0, 0.78, -6.82]} material={saloonWoodMat} receiveShadow />

      {/* Left & Right Aged Brick + Scratched Timber Walls */}
      {[-4.85, 4.85].map((wx) => {
        const inward = wx > 0 ? -1 : 1;
        return (
          <group key={wx}>
            <mesh position={[wx, 3.1, 0.5]} rotation={[0, inward * (Math.PI / 2), 0]} material={agedBrickMat} receiveShadow>
              <planeGeometry args={[18.0, 6.2]} />
            </mesh>
            <RoundedBox
              args={[0.1, 1.55, 17.6]}
              radius={0.02}
              smoothness={3}
              position={[wx + inward * 0.05, 0.78, 0.5]}
              material={saloonWoodMat}
              receiveShadow
            />
          </group>
        );
      })}

      {/* 4. Upper-Left & Lower-Left Multi-Pane Daylight Windows + Diagonal Volumetric Sunbeam Rays (Matching IMG_4438.webp) */}
      <group position={[-4.76, 4.35, -3.15]}>
        <RoundedBox args={[0.14, 1.48, 1.18]} radius={0.015} smoothness={2} material={darkTimberMat} castShadow />
        <mesh position={[0.08, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.02, 1.32]} />
          <meshStandardMaterial
            color="#fffdf7"
            emissive="#f7eedc"
            emissiveIntensity={2.6}
            roughness={0.2}
          />
        </mesh>
        {/* 12-Pane Window Mullion Grid */}
        {[-0.17, 0.17].map((mz) => (
          <mesh key={`v-${mz}`} position={[0.09, 0, mz]}>
            <boxGeometry args={[0.025, 1.34, 0.03]} />
            <meshStandardMaterial color="#2b2118" roughness={0.6} />
          </mesh>
        ))}
        {[-0.32, 0, 0.32].map((my) => (
          <mesh key={`h-${my}`} position={[0.09, my, 0]}>
            <boxGeometry args={[0.025, 0.03, 1.04]} />
            <meshStandardMaterial color="#2b2118" roughness={0.6} />
          </mesh>
        ))}
        {/* 4 Layered Diagonal Sunbeam Shafts Streaming Down Into the Saloon */}
        {[
          { y: -1.1, z: 0.12, rotZ: -0.96, rTop: 0.36, rBot: 1.35, len: 6.6 },
          { y: -1.5, z: 0.48, rotZ: -0.88, rTop: 0.3, rBot: 1.25, len: 7.2 },
          { y: -0.8, z: -0.18, rotZ: -1.06, rTop: 0.28, rBot: 1.05, len: 5.8 },
          { y: -1.85, z: 1.15, rotZ: -0.84, rTop: 0.32, rBot: 1.4, len: 7.4 }
        ].map((b, bIdx) => (
          <mesh
            key={bIdx}
            position={[2.45, b.y, b.z]}
            rotation={[0.08, 0, b.rotZ]}
            material={sunbeamShaftMat}
          >
            <cylinderGeometry args={[b.rTop, b.rBot, b.len, 20, 1, true]} />
          </mesh>
        ))}
      </group>

      {/* Lower-Left Mullioned Window + Warm Wall Lantern Sconce (Matching Mid-Left of IMG_4438.webp) */}
      <group position={[-4.76, 2.05, -4.15]}>
        <RoundedBox args={[0.14, 1.28, 1.05]} radius={0.015} smoothness={2} material={darkTimberMat} castShadow />
        <mesh position={[0.08, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.88, 1.12]} />
          <meshStandardMaterial
            color="#f0eadc"
            emissive="#e6dcc8"
            emissiveIntensity={1.45}
            roughness={0.3}
          />
        </mesh>
        <mesh position={[0.09, 0, 0]}>
          <boxGeometry args={[0.025, 1.14, 0.03]} />
          <meshStandardMaterial color="#2b2118" roughness={0.6} />
        </mesh>
        <mesh position={[0.09, 0, 0]}>
          <boxGeometry args={[0.025, 0.03, 0.9]} />
          <meshStandardMaterial color="#2b2118" roughness={0.6} />
        </mesh>
      </group>
      {/* Left Wall Real Poly Haven Lantern (`Lantern_01.glb`) */}
      <group position={[-4.68, 2.08, -2.55]}>
        <pointLight ref={wallLanternLightRef} color="#ffcf78" intensity={1.3} distance={7.5} decay={1.3} position={[0.25, 0.15, 0]} />
        <RoomErrorBoundary fallback={null}>
          <React.Suspense fallback={null}>
            <SimpleGlbProp url={WESTERN_SALOON_PROP_GLBS.lantern} scale={1.35} rotation={[0, Math.PI / 2, 0]} />
          </React.Suspense>
        </RoomErrorBoundary>
      </group>

      {/* 5. Upper Mezzanine Balcony + Ornate Wrought-Iron Railings + Stag Head & Spotted Hide Pelt Above (Matching IMG_4438.webp) */}
      <group position={[-0.45, 3.48, -5.55]}>
        <RoundedBox
          args={[8.6, 0.24, 1.85]}
          radius={0.025}
          smoothness={3}
          position={[0, 0, -0.25]}
          material={darkTimberMat}
          castShadow
          receiveShadow
        />
        <WroughtIronRailingSection width={8.2} position={[0, 0.1, 0.58]} />
        {/* Mezzanine Timber Newel Posts */}
        {[-3.9, -1.3, 1.3, 3.9].map((px) => (
          <RoundedBox
            key={px}
            args={[0.16, 1.05, 0.16]}
            radius={0.015}
            smoothness={2}
            position={[px, 0.48, 0.58]}
            material={darkTimberMat}
            castShadow
          />
        ))}
      </group>

      {/* Stag Head Mount & Spotted Brown-and-White Hide Pelt on Upper Brick Wall Above Mezzanine (Matching IMG_4438.webp) */}
      <TaxidermyStagHeadMount position={[-2.25, 4.68, -6.75]} rotation={[0.08, 0.18, 0]} scale={0.98} />
      <WallMountedHidePelt position={[-0.95, 4.58, -6.75]} rotation={[0, 0, -0.12]} scale={0.98} />

      <RoomErrorBoundary fallback={null}>
        <React.Suspense fallback={null}>
          <FramedVintagePhotograph position={[0.35, 4.72, -6.75]} variant={0} scale={0.95} />

          {/* Framed Vintage Photographs on the Back Wall (`fancy_picture_frame_02.glb`) */}
          <FramedVintagePhotograph position={[-3.55, 2.55, -6.75]} variant={0} scale={0.82} />
          <FramedVintagePhotograph position={[-3.55, 1.88, -6.75]} variant={1} scale={0.82} />
          <FramedVintagePhotograph position={[3.25, 2.92, -6.75]} variant={1} scale={1.08} />
          {/* Real Poly Haven Ornate Mirror Accent on Left Wall Near Piano */}
          <SimpleGlbProp url={WESTERN_SALOON_PROP_GLBS.ornateMirror} position={[-3.55, 1.25, -6.75]} scale={1.05} />

          {/* 6. Center Brass & Candle Chandelier (`Chandelier_03.glb`) */}
          <BrassWagonWheelChandelier position={[0.05, 3.58, -2.85]} lightRef={chandelierLightRef} />
        </React.Suspense>
      </RoomErrorBoundary>

      {/* 7. Weathered Timber Stage (Left-Center) + Upright Piano + Real Wooden Stools (`wooden_stool_01.glb`) + Footlights */}
      <group position={[-1.55, 0.16, -4.05]}>
        <RoundedBox args={[3.6, 0.32, 1.85]} radius={0.02} smoothness={3} receiveShadow castShadow material={darkTimberMat} />
        {/* Brass Stage Footlights placed cleanly along stage front lip away from boots */}
        {[-1.25, -0.35, 0.65].map((fx) => (
          <group key={fx} position={[fx, 0.18, 0.86]}>
            <mesh position={[0, 0.04, 0]} castShadow>
              <cylinderGeometry args={[0.048, 0.062, 0.08, 12]} />
              <meshStandardMaterial color="#9e8240" metalness={0.88} roughness={0.26} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 1899 Dark-Wood Upright Saloon Piano on Left Stage Facing the Pianist */}
      <group
        position={[-1.98, 0.32, -4.12]}
        rotation={[0, -Math.PI / 2 + 0.22, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onInteractHotspot?.('toggle_play');
        }}
      >
        <RoundedBox args={[1.38, 1.26, 0.52]} radius={0.03} smoothness={3} position={[0, 0.63, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#3d2e22" roughness={0.52} />
        </RoundedBox>
        <RoundedBox args={[1.32, 0.08, 0.3]} radius={0.015} smoothness={2} position={[0, 0.72, 0.31]} castShadow>
          <meshStandardMaterial color="#38291e" roughness={0.48} />
        </RoundedBox>
        <RoundedBox args={[1.18, 0.028, 0.18]} radius={0.006} smoothness={2} position={[0, 0.768, 0.34]}>
          <meshStandardMaterial color="#efe6d5" roughness={0.28} />
        </RoundedBox>
      </group>

      {/* Real Poly Haven Wooden Display Shelves & Performers' Wooden Stools */}
      <RoomErrorBoundary fallback={null}>
        <React.Suspense fallback={null}>
          <SimpleGlbProp
            url={WESTERN_SALOON_PROP_GLBS.displayShelves}
            position={[-2.2, 0, -6.34]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[1.0, 1.45, 1.35]}
          />
          {/* Pianist Wooden Stool at [-2.683, 0.32, -3.963] */}
          <SimpleGlbProp
            url={WESTERN_SALOON_PROP_GLBS.woodenStool}
            position={[-2.683, 0.32, -3.963]}
            scale={1.0}
          />
        </React.Suspense>
      </RoomErrorBoundary>

      <group position={[-0.85, 0.32, -3.88]}>
        <RoomErrorBoundary fallback={null}>
          <React.Suspense fallback={null}>
            <SimpleGlbProp url={WESTERN_SALOON_PROP_GLBS.woodenStool} scale={1.03} />
          </React.Suspense>
        </RoomErrorBoundary>
        {/* Atmospheric Smoke Wisp Behind the Guitarist */}
        <mesh position={[-0.12, 1.32, -0.22]}>
          <planeGeometry args={[0.95, 0.95]} />
          <meshBasicMaterial map={smokeTex} transparent opacity={0.46} depthWrite={false} />
        </mesh>
      </group>

      {/* 8. Weathered Dark-Wood Bar Counter (Right Background), Brass Register, Leaning Rifle, Barrel (`wine_barrel_01.glb`) & Mottled Tarnished Mirror */}
      <group
        position={[1.15, 0, -5.15]}
        onClick={(e) => {
          e.stopPropagation();
          onInteractHotspot?.('next_track');
        }}
      >
        <RoundedBox args={[3.85, 1.02, 0.74]} radius={0.03} smoothness={3} position={[0, 0.51, 0]} material={darkTimberMat} castShadow receiveShadow />
        {barSlats.map((sx, idx) => (
          <RoundedBox
            key={idx}
            args={[0.12, 0.84, 0.04]}
            radius={0.01}
            smoothness={2}
            position={[sx, 0.51, 0.38]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={idx % 2 === 0 ? '#4a3c2f' : '#574738'} roughness={0.62} />
          </RoundedBox>
        ))}
        <RoundedBox args={[4.0, 0.075, 0.9]} radius={0.025} smoothness={3} position={[0, 1.05, 0.04]} material={saloonWoodMat} castShadow receiveShadow />
        <AntiqueBrassCashRegister position={[0.58, 1.08, 0.02]} />
      </group>

      {/* Backbar Wooden Shelf Ledge Beneath the Tarnished Mirror */}
      <RoundedBox
        args={[3.35, 0.08, 0.32]}
        radius={0.015}
        smoothness={2}
        position={[0.85, 1.14, -6.08]}
        material={darkTimberMat}
        castShadow
        receiveShadow
      />

      {/* Lever-Action Rifle Leaning Against the Bar Counter */}
      <FrontierLeverActionRifle position={[0.62, 0, -4.38]} rotation={[-0.22, 0.15, 0.14]} />

      <RoomErrorBoundary fallback={null}>
        <React.Suspense fallback={null}>
          {/* Real Oak Wine Barrel on the Right */}
          <OakWhiskeyBarrel position={[2.35, 0, -3.55]} rotation={[0, -0.25, 0]} scale={0.98} />

          {/* Real Poly Haven Wooden Display Shelves Right of Bar (`wooden_display_shelves_01.glb`) */}
          <SimpleGlbProp
            url={WESTERN_SALOON_PROP_GLBS.displayShelves}
            position={[3.25, 0, -6.28]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[1.0, 1.35, 1.2]}
          />

          {/* Real Poly Haven Wine & Whiskey Bottles Across Bar Counter & Display Shelves */}
          <SaloonWineBottlesCluster />
        </React.Suspense>
      </RoomErrorBoundary>

      {/* 9. Large Arched/Framed Distressed Dark-Wood Backbar with Luminous Mottled Silver-Grey Tarnished Mirror (Matching IMG_4438.webp) */}
      <group
        position={[0.85, 2.32, -6.32]}
        onClick={(e) => {
          e.stopPropagation();
          onInteractHotspot?.('toggle_play');
        }}
      >
        <RoundedBox args={[3.45, 2.15, 0.14]} radius={0.03} smoothness={3} position={[0, 0, -0.06]} material={darkTimberMat} castShadow />
        <RoundedBox args={[3.22, 1.92, 0.08]} radius={0.02} smoothness={3} position={[0, 0, -0.01]} castShadow>
          <meshStandardMaterial color="#69543e" roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 0, 0.035]}>
          <planeGeometry args={[3.06, 1.76]} />
          <meshStandardMaterial
            ref={mirrorMatRef}
            map={mirrorReflectionTexture}
            emissive="#ffffff"
            emissiveMap={mirrorReflectionTexture}
            emissiveIntensity={0.58}
            roughness={0.22}
            metalness={0.35}
          />
        </mesh>
      </group>

      {/* 10. 5 Round Green-Felt Saloon Poker Tables (Including the 3 Foreground/Midground Tables in IMG_4438.webp) */}
      <RoomErrorBoundary fallback={null}>
        <React.Suspense fallback={null}>
          {SALOON_POKER_TABLES.map((spec, idx) => (
            <SaloonPokerAndWhiskeyTable
              key={idx}
              position={[spec.position[0], 0, spec.position[1]]}
              seatAngles={spec.seatAngles}
              saloonWoodMat={saloonWoodMat}
              darkTimberMat={darkTimberMat}
              tableIdx={idx}
              candleLightRef={(el) => {
                candleLightRefs.current[idx] = el;
              }}
              candleFlameMatRef={(el) => {
                candleFlameMatRefs.current[idx] = el;
              }}
            />
          ))}
        </React.Suspense>
      </RoomErrorBoundary>

      {/* 11. Physical Window Daylight Key + Cool Indirect Fill + Warm Candle Practicals */}
      <primitive object={sunlightTarget} />
      {/* Primary Natural Daylight Streaming Through Upper-Left Window */}
      <spotLight
        ref={windowSpotRef}
        color={cal.keyColor}
        intensity={cal.keyIntensity}
        decay={cal.lightDecay}
        distance={24}
        angle={0.7}
        penumbra={0.78}
        position={[-4.6, 4.65, -2.6]}
        target={sunlightTarget}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
      {/* Subtle Cool Daylight Sky Bounce into Foreground Shadow Side */}
      <spotLight
        color={cal.fillColor}
        intensity={cal.fillIntensity}
        decay={cal.lightDecay}
        distance={20}
        angle={0.82}
        penumbra={0.9}
        position={[3.6, 4.4, 3.0]}
        target={sunlightTarget}
      />
      {/* Warm Candlelight & Saloon Accent Fill Over Stage, Bar & Tables */}
      <pointLight
        ref={frontWarmFillRef}
        color={cal.fillColor}
        intensity={cal.fillIntensity * 0.85}
        decay={cal.lightDecay}
        distance={13}
        position={[-0.2, 2.1, 2.2]}
      />
      <pointLight
        ref={stageWarmFillRef}
        color={cal.rimColor}
        intensity={cal.rimIntensity}
        decay={cal.lightDecay}
        distance={13}
        position={[-1.4, 2.8, -4.6]}
      />
      <hemisphereLight args={[cal.hemiSkyColor, cal.hemiGroundColor, cal.hemiIntensity]} />
    </group>
  );
}

function SafeSaloonAvatar(props: React.ComponentProps<typeof RiggedHumanAvatar>) {
  return (
    <RoomErrorBoundary fallback={null}>
      <React.Suspense fallback={null}>
        <RiggedHumanAvatar {...props} />
      </React.Suspense>
    </RoomErrorBoundary>
  );
}

/**
 * 1899 Red Dead Redemption 2 Saloon Cast Matching IMG_4438.webp:
 * - Bartender behind the bar in front of the tarnished mirror
 * - Piano player at the upright piano (left stage)
 * - Cowboy acoustic guitarist seated center-right of stage strumming guitar
 * - Seated patrons at the foreground, midground, background, and side green-felt poker tables
 *   (Left seat: Frontier woman in vest/blouse; Right seat: Cowboy in Stetson hat & jacket/shirt leaning in with cards & drinks)
 */
function SaloonCrowdAndPerformers({
  isPlaying,
  bpm,
  isActive = true,
  connectedPeers,
  latestTrackDeviceName,
  onInteractHotspot
}: {
  isPlaying: boolean;
  bpm: number;
  isActive?: boolean;
  connectedPeers?: RoomPeerParticipant[];
  latestTrackDeviceName?: string;
  onInteractHotspot?: (action: 'toggle_play' | 'next_track' | 'trigger_fx' | 'open_dj') => void;
}) {
  const seatedPatrons = useMemo(() => {
    const arr: Array<{
      key: string;
      pos: [number, number, number];
      rotY: number;
      archIdx: number;
      modelUrl: string;
      hat?: WesternHatStyle;
      outfit: WesternOutfitPreset;
      activity: HumanActivityMode;
      prop: WesternPropType;
      isFemale: boolean;
    }> = [];
    const seatRadius = 0.86;

    SALOON_POKER_TABLES.forEach((table, tIdx) => {
      const [tx, tz] = table.position;
      table.seatAngles.forEach((ang, sIdx) => {
        const cx = tx + Math.sin(ang) * seatRadius;
        const cz = tz + Math.cos(ang) * seatRadius;
        const rotY = ang + Math.PI;

        // Match IMG_4438.webp: on the main diagonal tables (0, 1, 2), left seat is a frontier woman, right seat is a cowboy in Stetson
        const isLeftSeat = sIdx === 0 && tIdx < 3;
        const modelUrl = isLeftSeat
          ? WESTERN_SALOON_GLB_MODELS.saloonLady
          : (sIdx + tIdx) % 2 === 0
            ? WESTERN_SALOON_GLB_MODELS.rancher
            : WESTERN_SALOON_GLB_MODELS.gambler;

        // In IMG_4438.webp: Table 1 left woman wears a dark cowboy hat; Table 0 & Table 2 left women have hair bun without hat
        const hat: WesternHatStyle | undefined = isLeftSeat
          ? tIdx === 1
            ? 'stetson_black'
            : undefined
          : (sIdx + tIdx) % 2 === 0
            ? 'stetson_brown'
            : 'gambler_tan';

        const outfit: WesternOutfitPreset = isLeftSeat
          ? tIdx === 0
            ? 'lady_olive_vest'
            : tIdx === 1
              ? 'lady_charcoal_vest'
              : 'lady_chestnut_vest'
          : tIdx === 3
            ? 'patron_denim_shirt'
            : (sIdx + tIdx) % 2 === 0
              ? 'cowboy_sand_shirt'
              : 'cowboy_tan_duster';

        const prop: WesternPropType =
          sIdx === 0 ? 'poker_cards' : tIdx === 0 ? 'whiskey_glass' : 'poker_cards';
        const activity: HumanActivityMode = sIdx === 1 ? 'poker_lean' : 'converse';

        arr.push({
          key: `saloon-seated-${tIdx}-${sIdx}`,
          pos: [cx, 0, cz],
          rotY,
          archIdx: (tIdx * 3 + sIdx) * 2 + 1,
          modelUrl,
          hat,
          outfit,
          activity,
          prop,
          isFemale: isLeftSeat
        });
      });
    });
    return arr;
  }, []);

  const peerMap = useMemo(() => {
    const priorityOrder = [
      'saloon-seated-1-0',
      'saloon-seated-1-1',
      'saloon-guitarist',
      'saloon-seated-2-0',
      'saloon-pianist',
      'saloon-seated-2-1',
      'saloon-bartender',
      'saloon-seated-0-0',
      'saloon-seated-0-1'
    ];
    const poolByKey = new Map<string, { key: string; isFemale: boolean }>();
    poolByKey.set('saloon-bartender', { key: 'saloon-bartender', isFemale: false });
    poolByKey.set('saloon-pianist', { key: 'saloon-pianist', isFemale: true });
    poolByKey.set('saloon-guitarist', { key: 'saloon-guitarist', isFemale: false });
    seatedPatrons.forEach((p) => poolByKey.set(p.key, { key: p.key, isFemale: p.isFemale }));

    const orderedSlots: Array<{ key: string; isFemale: boolean }> = [];
    priorityOrder.forEach((k) => {
      const hit = poolByKey.get(k);
      if (hit) {
        orderedSlots.push(hit);
        poolByKey.delete(k);
      }
    });
    poolByKey.forEach((v) => orderedSlots.push(v));

    return assignPeersToCastSlots(connectedPeers, orderedSlots, latestTrackDeviceName);
  }, [connectedPeers, latestTrackDeviceName, seatedPatrons]);

  const bartenderPeer = peerMap.get('saloon-bartender');
  const pianistPeer = peerMap.get('saloon-pianist');
  const guitaristPeer = peerMap.get('saloon-guitarist');

  return (
    <group>
      {/* 1. Bartender Behind the Bar Counter in Front of the Mottled Tarnished Mirror (Matching IMG_4438.webp) */}
      <SafeSaloonAvatar
        modelUrl={WESTERN_SALOON_GLB_MODELS.bartender}
        mocapClips={EMPTY_MOCAP_CLIPS}
        archetypeIndex={9}
        position={[0.38, 0, -5.68]}
        rotationY={-0.14}
        targetHeight={1.76}
        activity="bartend"
        phaseOffset={0.4}
        isPlaying={isPlaying}
        bpm={bpm}
        castShadow
        isActive={isActive}
        westernProp="bar_cloth"
        westernOutfit="bartender_slate_shirt"
      >
        {bartenderPeer && (
          <PeerOverheadBadge
            peer={bartenderPeer.peer}
            isLatestDJ={bartenderPeer.isLatestDJ}
            headHeight={1.94}
          />
        )}
      </SafeSaloonAvatar>

      {/* 2. Saloon Pianist Seated on Wooden Stool in Front of the Upright Piano Keys */}
      <SafeSaloonAvatar
        modelUrl={WESTERN_SALOON_GLB_MODELS.saloonLady}
        mocapClips={EMPTY_MOCAP_CLIPS}
        archetypeIndex={4}
        position={[-2.683, 0.32, -3.963]}
        rotationY={1.7908}
        targetHeight={1.7}
        activity="piano_play"
        seated
        seatHeight={0.44}
        phaseOffset={0.75}
        isPlaying={isPlaying}
        bpm={bpm}
        castShadow
        isActive={isActive}
        westernOutfit="lady_olive_vest"
        onClick={() => onInteractHotspot?.('toggle_play')}
      >
        {pianistPeer && (
          <PeerOverheadBadge
            peer={pianistPeer.peer}
            isLatestDJ={pianistPeer.isLatestDJ}
            headHeight={1.58}
          />
        )}
      </SafeSaloonAvatar>

      {/* 3. Cowboy Acoustic Guitarist Seated on Stage Strumming Guitar (Center-Left in IMG_4438.webp) */}
      <SafeSaloonAvatar
        modelUrl={WESTERN_SALOON_GLB_MODELS.gunslinger}
        mocapClips={EMPTY_MOCAP_CLIPS}
        archetypeIndex={7}
        position={[-0.85, 0.32, -3.88]}
        rotationY={0.22}
        targetHeight={1.76}
        activity="guitar_sit"
        seated
        seatHeight={0.45}
        phaseOffset={1.1}
        isPlaying={isPlaying}
        bpm={bpm}
        castShadow
        isActive={isActive}
        westernHat="stetson_brown"
        westernOutfit="guitarist_slate_denim"
        onClick={() => onInteractHotspot?.('toggle_play')}
      >
        <AuthenticWesternAcousticGuitar />
        {guitaristPeer && (
          <PeerOverheadBadge
            peer={guitaristPeer.peer}
            isLatestDJ={guitaristPeer.isLatestDJ}
            headHeight={1.62}
          />
        )}
      </SafeSaloonAvatar>

      {/* 4. Seated Patrons at the Green-Felt Poker Tables (Matching Foreground, Midground & Side Tables in IMG_4438.webp) */}
      {seatedPatrons.map((p, idx) => {
        const assigned = peerMap.get(p.key);
        return (
          <SafeSaloonAvatar
            key={p.key}
            modelUrl={p.modelUrl}
            mocapClips={EMPTY_MOCAP_CLIPS}
            archetypeIndex={p.archIdx}
            position={p.pos}
            rotationY={p.rotY}
            targetHeight={1.72}
            activity={p.activity}
            seated
            seatHeight={0.44}
            phaseOffset={idx * 0.87}
            speedMult={0.85 + hash01(idx) * 0.25}
            isPlaying={isPlaying}
            bpm={bpm}
            castShadow
            isActive={isActive}
            westernHat={p.hat}
            westernProp={p.prop}
            westernOutfit={p.outfit}
          >
            {assigned && (
              <PeerOverheadBadge
                peer={assigned.peer}
                isLatestDJ={assigned.isLatestDJ}
                headHeight={p.hat ? 1.62 : 1.54}
              />
            )}
          </SafeSaloonAvatar>
        );
      })}
    </group>
  );
}

export function CafeRoomContent(
  props: SharedRoomSceneProps & { manifest?: ConcertAssetManifest | null }
) {
  const { isActive = true } = props;
  useEffect(() => {
    preloadCafeAssets();
  }, []);

  return (
    <>
      <SaloonArchitectureAndProps
        isPlaying={props.isPlaying}
        bpm={props.bpm}
        pulseIntensity={props.pulseIntensity}
        lightingFxMode={props.lightingFxMode}
        fxBurstSeq={props.fxBurstSeq}
        trackTitle={props.trackTitle || 'ضربان نیمه‌شب در ایستگاه نئون'}
        trackArtist={props.trackArtist || 'Valentine Saloon • 1899'}
        trackCoverUrl={props.trackCoverUrl}
        trackAccentHex={props.trackAccentHex || '#dfd2be'}
        lightingCalibration={props.lightingCalibration}
        isActive={isActive}
        renderOwnFloor={props.renderOwnFloor !== false}
        onInteractHotspot={props.onInteractHotspot}
      />
      <ContactShadows
        position={[0, 0.01, 0.2]}
        opacity={0.72}
        scale={14}
        blur={2.2}
        far={3.5}
        resolution={256}
        frames={1}
        color="#1f1710"
      />
      <RoomErrorBoundary fallback={null}>
        <SaloonCrowdAndPerformers
          isPlaying={props.isPlaying}
          bpm={props.bpm}
          isActive={isActive}
          connectedPeers={props.connectedPeers}
          latestTrackDeviceName={props.latestTrackDeviceName}
          onInteractHotspot={props.onInteractHotspot}
        />
      </RoomErrorBoundary>
      <SceneReadySignal active={isActive} onReady={props.onReady} />
    </>
  );
}

export function CafeRoomScene(props: SharedRoomSceneProps) {
  return (
    <RoomCanvasFrame
      roomPreset="cafe"
      bgHex="#18120d"
      fogDensity={0.0085}
      ambientColor="#2a1d14"
      ambientIntensity={0.24}
      lightingFxMode={props.lightingFxMode}
      envIntensity={0.42}
      lightingCalibration={props.lightingCalibration}
      initialCam={CAFE_CAMERA_SPEC[props.cameraPreset] || CAFE_CAMERA_SPEC.cinematic}
    >
      <LockedSymmetricalCameraRig
        cameraPreset={props.cameraPreset}
        moveInputRef={props.moveInputRef}
        spec={CAFE_CAMERA_SPEC}
      />
      <CafeRoomContent {...props} />
    </RoomCanvasFrame>
  );
}
