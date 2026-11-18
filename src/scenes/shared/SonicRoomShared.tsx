import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, MeshReflectorMaterial, OrbitControls, useGLTF } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { djAudioController } from '../../prototype/djAudioEngine';
import type {
  RoomCameraPreset,
  RoomLightingFxMode,
  RoomMoveInput
} from '../../prototype/components/SonicRoom3DWorld';
import type { RoomLightingCalibration } from '../../types/lighting';
import type { RoomPeerParticipant } from '../../types/roomSync';
import {
  DRACO_DECODER_URL,
  HUMAN_ARCHETYPES,
  resolveConcertAssetManifest,
  type ConcertAssetManifest,
  type HumanArchetypePreset
} from '../concert/concertAssets';
import { usePolyHavenPBR } from './polyhavenTextures';

export interface SharedRoomSceneProps {
  isPlaying: boolean;
  bpm: number;
  pulseIntensity: number;
  cameraPreset: RoomCameraPreset;
  lightingFxMode: RoomLightingFxMode;
  fxBurstSeq: number;
  moveInputRef: React.MutableRefObject<RoomMoveInput>;
  trackTitle?: string;
  trackArtist?: string;
  trackCoverUrl?: string;
  trackAccentHex?: string;
  lightingCalibration?: RoomLightingCalibration;
  connectedPeers?: RoomPeerParticipant[];
  latestTrackDeviceName?: string;
  onInteractHotspot?: (action: 'toggle_play' | 'next_track' | 'trigger_fx' | 'open_dj') => void;
  isActive?: boolean;
  renderOwnFloor?: boolean;
  onReady?: () => void;
}

export interface CameraPresetConfig {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface RoomCameraSpec {
  cinematic: CameraPresetConfig;
  first_person: CameraPresetConfig;
  stage_closeup: CameraPresetConfig;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

export type HumanActivityMode =
  | 'club_dance'
  | 'chill_sway'
  | 'converse'
  | 'read'
  | 'podcast_talk'
  | 'dj'
  | 'bartend'
  | 'guitar_sit'
  | 'piano_play'
  | 'poker_lean'
  | 'narrate';

export type RoomEnvironmentPreset = 'cafe' | 'party' | 'library' | 'podcast';

export type PBRMaterialType =
  | 'weathered_saloon_wood'
  | 'exposed_red_brick'
  | 'persian_royal_carpet'
  | 'acoustic_wood_slats'
  | 'industrial_concrete_grid'
  | 'tin_ceiling_tiles'
  | 'woven_studio_rug';

export interface PBRTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  dispose: () => void;
}

const _forwardVec = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _tempVert = new THREE.Vector3();
const _bonePos = new THREE.Vector3();
const _childPos = new THREE.Vector3();
const _curDir = new THREE.Vector3();
const _tgtDir = new THREE.Vector3();
const _qDelta = new THREE.Quaternion();
const _parentQuat = new THREE.Quaternion();
const _localDelta = new THREE.Quaternion();
const _qTmp = new THREE.Quaternion();
const _eTmp = new THREE.Euler();

let cachedIsSoftwareGl: boolean | null = null;
export function isSoftwareWebGL(): boolean {
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedIsSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    cachedIsSoftwareGl = false;
  }
  return cachedIsSoftwareGl;
}

export function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export class RoomErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function useConcertAssetManifest(): ConcertAssetManifest | null {
  const [manifest, setManifest] = useState<ConcertAssetManifest | null>(null);
  useEffect(() => {
    let active = true;
    void resolveConcertAssetManifest().then((m) => {
      if (active) setManifest(m);
    });
    return () => {
      active = false;
    };
  }, []);
  return manifest;
}

export function useLoadedMocapClips(mocapAnimUrls: string[]): THREE.AnimationClip[] {
  const loaded = useGLTF(mocapAnimUrls, DRACO_DECODER_URL) as unknown as
    | Array<{ animations?: THREE.AnimationClip[] }>
    | { animations?: THREE.AnimationClip[] };
  return useMemo(() => {
    const arr = Array.isArray(loaded) ? loaded : [loaded];
    return arr.flatMap((g) => g?.animations || []);
  }, [loaded]);
}

const PBR_TEXTURE_CACHE = new Map<string, PBRTextureSet>();
const PBR_MATERIAL_CACHE = new Map<string, THREE.MeshStandardMaterial>();
const ACTIVITY_CLIP_CACHE = new Map<string, THREE.AnimationClip>();
let CACHED_LENS_FLARE_TEX: THREE.CanvasTexture | null = null;
let CACHED_SPEAKER_GRILLE_TEX: THREE.CanvasTexture | null = null;

/**
 * 512x512 Cached Procedural PBR Texture & Bump Generator
 * Generates synchronized Albedo (sRGB), Bump (Linear), and Roughness (Linear) CanvasTextures ONCE per key.
 */
export function createPBRTextureSet(
  type: PBRMaterialType,
  repeatX = 4,
  repeatY = 4
): PBRTextureSet {
  const cacheKey = `${type}:${repeatX}:${repeatY}`;
  const hit = PBR_TEXTURE_CACHE.get(cacheKey);
  if (hit) return hit;

  const size = 512;
  const cMap = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  const cRough = document.createElement('canvas');
  cMap.width = cBump.width = cRough.width = size;
  cMap.height = cBump.height = cRough.height = size;

  const ctx = cMap.getContext('2d')!;
  const bCtx = cBump.getContext('2d')!;
  const rCtx = cRough.getContext('2d')!;

  ctx.save();
  bCtx.save();
  rCtx.save();
  ctx.scale(0.5, 0.5);
  bCtx.scale(0.5, 0.5);
  rCtx.scale(0.5, 0.5);
  const vSize = 1024;

  if (type === 'weathered_saloon_wood') {
    ctx.fillStyle = '#7d6a56';
    ctx.fillRect(0, 0, vSize, vSize);
    bCtx.fillStyle = '#888888';
    bCtx.fillRect(0, 0, vSize, vSize);
    rCtx.fillStyle = '#c4c4c4';
    rCtx.fillRect(0, 0, vSize, vSize);

    const planks = 8;
    const plankH = vSize / planks;
    const tones = ['#8a7660', '#7c6955', '#948069', '#705e4b', '#836f5a'];

    for (let i = 0; i < planks; i++) {
      const y = i * plankH;
      ctx.fillStyle = tones[i % tones.length];
      ctx.fillRect(0, y, vSize, plankH);

      const rVal = 165 + Math.floor(hash01(i * 7.3) * 45);
      rCtx.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
      rCtx.fillRect(0, y, vSize, plankH);

      for (let g = 0; g < 42; g++) {
        const gy = y + 6 + hash01(i * 41 + g * 1.9) * (plankH - 12);
        ctx.strokeStyle = g % 3 === 0 ? 'rgba(22, 17, 13, 0.42)' : 'rgba(138, 120, 102, 0.18)';
        ctx.lineWidth = 1.4 + hash01(g * 5.3) * 2.4;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        for (let x = 0; x <= vSize; x += 64) {
          ctx.lineTo(x, gy + Math.sin(x * 0.012 + g + i) * 3.5);
        }
        ctx.stroke();

        bCtx.strokeStyle = g % 2 === 0 ? 'rgba(55,55,55,0.48)' : 'rgba(190,190,190,0.24)';
        bCtx.lineWidth = 1.6;
        bCtx.stroke();
      }

      for (let k = 0; k < 2; k++) {
        const kx = 110 + hash01(i * 19 + k * 7) * (vSize - 220);
        const ky = y + 24 + hash01(i * 13 + k * 3) * (plankH - 48);
        const grad = ctx.createRadialGradient(kx, ky, 2, kx, ky, 22);
        grad.addColorStop(0, '#1e1712');
        grad.addColorStop(0.6, 'rgba(38, 30, 23, 0.65)');
        grad.addColorStop(1, 'rgba(38, 30, 23, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(kx, ky, 26, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        bCtx.fillStyle = '#404040';
        bCtx.beginPath();
        bCtx.ellipse(kx, ky, 15, 7, 0, 0, Math.PI * 2);
        bCtx.fill();
      }

      ctx.fillStyle = '#1a1410';
      ctx.fillRect(0, y, vSize, 5);
      bCtx.fillStyle = '#181818';
      bCtx.fillRect(0, y, vSize, 6);
      rCtx.fillStyle = '#d8d8d8';
      rCtx.fillRect(0, y, size, 5);

      const jx = 140 + ((i * 317) % (size - 280));
      ctx.fillRect(jx, y, 4, plankH);
      bCtx.fillRect(jx, y, 5, plankH);
      rCtx.fillRect(jx, y, 5, plankH);

      [-12, 14].forEach((nxOff) => {
        [y + 18, y + plankH - 18].forEach((ny) => {
          ctx.fillStyle = '#1c1917';
          ctx.beginPath();
          ctx.arc(jx + nxOff, ny, 3.5, 0, Math.PI * 2);
          ctx.fill();
          bCtx.fillStyle = '#e5e5e5';
          bCtx.beginPath();
          bCtx.arc(jx + nxOff, ny, 3.5, 0, Math.PI * 2);
          bCtx.fill();
        });
      });
    }
  } else if (type === 'exposed_red_brick') {
    ctx.fillStyle = '#6e6055';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#242424';
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#ececec';
    rCtx.fillRect(0, 0, size, size);

    const rows = 16;
    const cols = 8;
    const brickH = size / rows;
    const brickW = size / cols;
    const mortar = 7;
    const brickTones = ['#9c4b36', '#8a3f2d', '#a8553e', '#7c3626', '#924431', '#733021'];

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (brickW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const bx = c * brickW + offset;
        const by = r * brickH;
        const seed = r * 31 + c * 17;
        ctx.fillStyle = brickTones[Math.floor(hash01(seed) * brickTones.length)];
        ctx.beginPath();
        ctx.roundRect(bx + mortar * 0.5, by + mortar * 0.5, brickW - mortar, brickH - mortar, 4);
        ctx.fill();

        if (hash01(seed + 4) > 0.55) {
          ctx.fillStyle = 'rgba(28, 12, 8, 0.25)';
          ctx.fillRect(bx + mortar, by + mortar, (brickW - mortar * 2) * 0.6, brickH - mortar * 2);
        }

        const bumpVal = 175 + Math.floor(hash01(seed + 9) * 45);
        bCtx.fillStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
        bCtx.beginPath();
        bCtx.roundRect(bx + mortar * 0.5, by + mortar * 0.5, brickW - mortar, brickH - mortar, 4);
        bCtx.fill();

        const roughVal = 195 + Math.floor(hash01(seed + 13) * 35);
        rCtx.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`;
        rCtx.fillRect(bx + mortar * 0.5, by + mortar * 0.5, brickW - mortar, brickH - mortar);
      }
    }

    for (let i = 0; i < 1800; i++) {
      const gx = hash01(i * 3.1) * size;
      const gy = hash01(i * 7.7) * size;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.16)' : 'rgba(255,210,180,0.08)';
      ctx.fillRect(gx, gy, 3, 3);
      bCtx.fillStyle = i % 2 === 0 ? 'rgba(90,90,90,0.35)' : 'rgba(240,240,240,0.35)';
      bCtx.fillRect(gx, gy, 2, 2);
    }
  } else if (type === 'persian_royal_carpet') {
    ctx.fillStyle = '#5e0e1e';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#c2c2c2';
    rCtx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#131d36';
    ctx.lineWidth = 76;
    ctx.strokeRect(56, 56, size - 112, size - 112);

    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, size - 40, size - 40);
    ctx.strokeRect(94, 94, size - 188, size - 188);
    ctx.strokeStyle = '#f3d06b';
    ctx.lineWidth = 4;
    ctx.strokeRect(114, 114, size - 228, size - 228);

    for (let i = 0; i < 16; i++) {
      const t = 110 + (i / 15) * (size - 220);
      [
        [t, 56],
        [t, size - 56],
        [56, t],
        [size - 56, t]
      ].forEach(([px, py]) => {
        ctx.fillStyle = '#d4af37';
        ctx.beginPath();
        ctx.arc(px, py, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    [
      [120, 120],
      [size - 120, 120],
      [120, size - 120],
      [size - 120, size - 120]
    ].forEach(([cx, cy]) => {
      ctx.fillStyle = '#131d36';
      ctx.beginPath();
      ctx.arc(cx, cy, 78, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 4;
      ctx.stroke();
    });

    const mid = size * 0.5;
    for (const ring of [220, 165, 110, 56]) {
      ctx.fillStyle = ring === 220 ? '#131d36' : ring === 165 ? '#7c1828' : ring === 110 ? '#1a2748' : '#d4af37';
      ctx.beginPath();
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const rad = ring * (a % 2 === 0 ? 1.0 : 0.84);
        const px = mid + Math.cos(ang) * rad;
        const py = mid + Math.sin(ang) * rad;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e5c158';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    for (let y = 0; y < size; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? 'rgba(0,0,0,0.08)' : 'rgba(255,235,180,0.03)';
      ctx.fillRect(0, y, size, 2);
      bCtx.fillStyle = y % 8 === 0 ? '#727272' : '#969696';
      bCtx.fillRect(0, y, size, 2);
    }
  } else if (type === 'acoustic_wood_slats') {
    ctx.fillStyle = '#0c0d12';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#161616';
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#ececec';
    rCtx.fillRect(0, 0, size, size);

    const slatCount = 16;
    const cellW = size / slatCount;
    const slatW = cellW * 0.64;

    for (let i = 0; i < slatCount; i++) {
      const sx = i * cellW + (cellW - slatW) * 0.5;
      const tone = i % 3 === 0 ? '#693d21' : i % 3 === 1 ? '#573118' : '#734426';
      ctx.fillStyle = tone;
      ctx.fillRect(sx, 0, slatW, size);

      ctx.fillStyle = 'rgba(255, 200, 140, 0.16)';
      ctx.fillRect(sx, 0, 3, size);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(sx + slatW - 3, 0, 3, size);

      for (let g = 0; g < 6; g++) {
        ctx.fillStyle = g % 2 === 0 ? 'rgba(24, 10, 4, 0.25)' : 'rgba(180, 120, 70, 0.08)';
        ctx.fillRect(sx + 5 + g * (slatW / 7), 0, 2, size);
      }

      bCtx.fillStyle = '#e5e5e5';
      bCtx.fillRect(sx, 0, slatW, size);
      rCtx.fillStyle = '#787878';
      rCtx.fillRect(sx, 0, slatW, size);
    }
  } else if (type === 'industrial_concrete_grid') {
    ctx.fillStyle = '#141824';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#888888';
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#383838';
    rCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 60; i++) {
      const px = hash01(i * 4.3) * size;
      const py = hash01(i * 9.1) * size;
      const rad = 45 + hash01(i * 2.7) * 110;
      const g = ctx.createRadialGradient(px, py, 6, px, py, rad);
      g.addColorStop(0, i % 2 === 0 ? 'rgba(38, 48, 72, 0.38)' : 'rgba(8, 10, 16, 0.45)');
      g.addColorStop(1, 'rgba(18, 21, 31, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let p = 0; p < 10; p++) {
      const px = 90 + hash01(p * 17.3) * (size - 180);
      const py = 90 + hash01(p * 23.7) * (size - 180);
      const rx = 55 + hash01(p * 5.9) * 85;
      const ry = 40 + hash01(p * 8.3) * 70;
      rCtx.fillStyle = '#0c0c0c';
      rCtx.beginPath();
      rCtx.ellipse(px, py, rx, ry, hash01(p) * Math.PI, 0, Math.PI * 2);
      rCtx.fill();

      ctx.fillStyle = 'rgba(6, 8, 14, 0.38)';
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, hash01(p) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    const cells = 4;
    const step = size / cells;
    for (let c = 0; c < cells; c++) {
      const pos = c * step;
      ctx.fillStyle = '#242b3d';
      ctx.fillRect(pos, 0, 14, size);
      ctx.fillRect(0, pos, size, 14);
      ctx.fillStyle = '#090b10';
      ctx.fillRect(pos + 5, 0, 4, size);
      ctx.fillRect(0, pos + 5, size, 4);

      bCtx.fillStyle = '#242424';
      bCtx.fillRect(pos, 0, 14, size);
      bCtx.fillRect(0, pos, size, 14);

      for (let b = 32; b < size; b += 64) {
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(pos + 7, b, 2.5, 0, Math.PI * 2);
        ctx.arc(b, pos + 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (type === 'tin_ceiling_tiles') {
    ctx.fillStyle = '#261810';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#707070';
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#686868';
    rCtx.fillRect(0, 0, size, size);

    const grid = 4;
    const tile = size / grid;
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const x = c * tile;
        const y = r * tile;
        ctx.strokeStyle = '#5c3c24';
        ctx.lineWidth = 6;
        ctx.strokeRect(x + 8, y + 8, tile - 16, tile - 16);
        ctx.strokeStyle = '#8b5e34';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 28, y + 28, tile - 56, tile - 56);

        ctx.beginPath();
        ctx.arc(x + tile * 0.5, y + tile * 0.5, tile * 0.24, 0, Math.PI * 2);
        ctx.stroke();

        bCtx.strokeStyle = '#e5e5e5';
        bCtx.lineWidth = 6;
        bCtx.strokeRect(x + 8, y + 8, tile - 16, tile - 16);
        bCtx.strokeRect(x + 28, y + 28, tile - 56, tile - 56);
        bCtx.beginPath();
        bCtx.arc(x + tile * 0.5, y + tile * 0.5, tile * 0.24, 0, Math.PI * 2);
        bCtx.stroke();
      }
    }
  } else {
    ctx.fillStyle = '#1b1d24';
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = '#787878';
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#dedede';
    rCtx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 6) {
      for (let x = 0; x < size; x += 6) {
        const n = hash01(x * 1.7 + y * 3.1);
        const shade = Math.floor(24 + n * 24);
        ctx.fillStyle = `rgb(${shade},${shade + 1},${shade + 4})`;
        ctx.fillRect(x, y, 5, 5);
        const bShade = Math.floor(100 + n * 90);
        bCtx.fillStyle = `rgb(${bShade},${bShade},${bShade})`;
        bCtx.fillRect(x, y, 4, 4);
      }
    }
  }

  ctx.restore();
  bCtx.restore();
  rCtx.restore();

  const configure = (canvas: HTMLCanvasElement, isColor: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  };

  const map = configure(cMap, true);
  const bumpMap = configure(cBump, false);
  const roughnessMap = configure(cRough, false);

  const set: PBRTextureSet = {
    map,
    bumpMap,
    roughnessMap,
    // Kept cached across room switches to eliminate regeneration stutter
    dispose: () => {}
  };
  PBR_TEXTURE_CACHE.set(cacheKey, set);
  return set;
}

// Explicit 1024x1024 PBR Generator Aliases requested for all rooms
export const woodPlanksPBR = (rx = 5, ry = 5) => createPBRTextureSet('weathered_saloon_wood', rx, ry);
export const brickWallPBR = (rx = 4, ry = 2) => createPBRTextureSet('exposed_red_brick', rx, ry);
export const persianRugPBR = (rx = 1, ry = 3) => createPBRTextureSet('persian_royal_carpet', rx, ry);
export const acousticSlatsPBR = (rx = 3, ry = 1) => createPBRTextureSet('acoustic_wood_slats', rx, ry);
export const clubConcretePBR = (rx = 5, ry = 5) => createPBRTextureSet('industrial_concrete_grid', rx, ry);

export function createPBRMaterial(
  type: PBRMaterialType,
  options?: {
    repeatX?: number;
    repeatY?: number;
    roughness?: number;
    metalness?: number;
    bumpScale?: number;
    color?: string;
  }
): THREE.MeshStandardMaterial {
  const defaults: Record<PBRMaterialType, { rx: number; ry: number; rough: number; metal: number; bump: number }> = {
    weathered_saloon_wood: { rx: 4, ry: 4, rough: 0.35, metal: 0.08, bump: 0.03 },
    exposed_red_brick: { rx: 3, ry: 2, rough: 0.85, metal: 0.04, bump: 0.05 },
    persian_royal_carpet: { rx: 1, ry: 4, rough: 0.75, metal: 0.04, bump: 0.02 },
    acoustic_wood_slats: { rx: 3, ry: 1, rough: 0.56, metal: 0.08, bump: 0.06 },
    industrial_concrete_grid: { rx: 5, ry: 5, rough: 0.15, metal: 0.7, bump: 0.035 },
    tin_ceiling_tiles: { rx: 4, ry: 4, rough: 0.38, metal: 0.55, bump: 0.05 },
    woven_studio_rug: { rx: 4, ry: 4, rough: 0.88, metal: 0.02, bump: 0.03 }
  };

  const d = defaults[type];
  const rx = options?.repeatX ?? d.rx;
  const ry = options?.repeatY ?? d.ry;
  const rough = options?.roughness ?? d.rough;
  const metal = options?.metalness ?? d.metal;
  const bump = options?.bumpScale ?? d.bump;
  const col = options?.color ?? '#ffffff';
  const matKey = `${type}:${rx}:${ry}:${rough}:${metal}:${bump}:${col}`;
  const cachedMat = PBR_MATERIAL_CACHE.get(matKey);
  if (cachedMat) return cachedMat;

  const texSet = createPBRTextureSet(type, rx, ry);
  const mat = new THREE.MeshStandardMaterial({
    color: col,
    map: texSet.map,
    bumpMap: texSet.bumpMap,
    bumpScale: bump,
    roughnessMap: texSet.roughnessMap,
    roughness: rough,
    metalness: metal
  });
  mat.userData._texSet = texSet;
  PBR_MATERIAL_CACHE.set(matKey, mat);
  return mat;
}

export function disposePBRMaterial(_mat: THREE.MeshStandardMaterial) {
  // Cached globally for instant zero-lag room switching
}

export interface MusicSyncLightEnvelope {
  bass: number;
  mid: number;
  high: number;
  beatPulse: number;
  halfBeatPulse: number;
  barWave: number;
  beatIndex: number;
  isBeatHit: boolean;
  bins: Uint8Array | null;
}

/**
 * Shared real-time audio & beat-locked lighting envelope across all 5 3D Sonic Rooms.
 * Blends live Web Audio AnalyserNode FFT bands with exact BPM kick/snare/groove phase envelopes
 * so lighting pulses smoothly and crisply with the active song, pulseIntensity, and lightingFxMode.
 */
export function sampleMusicSyncLighting({
  time,
  bpm,
  isPlaying,
  pulseIntensity,
  lightingFxMode = 'natural_pt',
  burst = 0
}: {
  time: number;
  bpm: number;
  isPlaying: boolean;
  pulseIntensity: number;
  lightingFxMode?: RoomLightingFxMode;
  burst?: number;
}): MusicSyncLightEnvelope {
  const safeBpm = Math.max(45, Math.min(220, bpm || 110));
  const beatsPerSec = safeBpm / 60;
  const rawBeat = time * beatsPerSec;
  const beatIndex = Math.floor(rawBeat);
  const beatFrac = rawBeat - beatIndex;
  const halfFrac = (rawBeat * 2 + 0.5) % 1;

  const fxBoost =
    lightingFxMode === 'strobe_pulse'
      ? 1.28
      : lightingFxMode === 'neon_laser'
        ? 1.15
        : lightingFxMode === 'golden_cinema'
          ? 1.06
          : 1.0;

  if (!isPlaying && burst <= 0.02) {
    return {
      bass: 0.08,
      mid: 0.1,
      high: 0.06,
      beatPulse: 0,
      halfBeatPulse: 0,
      barWave: Math.sin(time * 0.45),
      beatIndex,
      isBeatHit: false,
      bins: null
    };
  }

  const audio = djAudioController.getCombinedBassAndSpectrum();
  const beatPulse = isPlaying ? Math.exp(-beatFrac * 4.8) : 0;
  const halfBeatPulse = isPlaying ? Math.exp(-halfFrac * 5.6) : 0;
  const groove = isPlaying ? 0.5 + 0.5 * Math.sin(time * beatsPerSec * Math.PI) : 0;
  const scale = (0.42 + 0.72 * Math.max(0.15, pulseIntensity)) * fxBoost;

  const bass = Math.min(
    1.35,
    Math.max(audio.bass, beatPulse * 0.88) * scale + burst * 0.75
  );
  const mid = Math.min(
    1.25,
    Math.max(audio.mid, 0.22 + halfBeatPulse * 0.58 + groove * 0.22) *
      (0.55 + 0.55 * Math.max(0.15, pulseIntensity)) *
      fxBoost +
      burst * 0.45
  );
  const high = Math.min(
    1.25,
    Math.max(audio.high, 0.16 + Math.pow(halfBeatPulse, 1.35) * 0.72) *
      (0.5 + 0.6 * Math.max(0.15, pulseIntensity)) *
      fxBoost +
      burst * 0.55
  );

  return {
    bass,
    mid,
    high,
    beatPulse,
    halfBeatPulse,
    barWave: Math.sin(time * beatsPerSec * Math.PI * 0.5),
    beatIndex,
    isBeatHit: audio.isBassHit || beatFrac < 0.16 || burst > 0.45,
    bins: audio.bins
  };
}

/**
 * Narrow, soft additive volumetric light beam shader (opacity 0.07 default)
 */
export function createSoftVolumetricBeamMaterial(
  hexColor: string,
  opacity = 0.07
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(hexColor) },
      uTime: { value: 0 },
      uBassHit: { value: 0.3 },
      uOpacity: { value: opacity }
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uBassHit;
      uniform float uOpacity;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      varying vec2 vUv;

      void main() {
        vec3 viewDir = normalize(vViewPos);
        float fresnel = pow(abs(dot(normalize(vNormalView), viewDir)), 3.8);
        float lengthFade = smoothstep(0.0, 0.36, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
        float shimmer = 0.92 + 0.08 * sin(vUv.y * 8.0 - uTime * 2.2 + vUv.x * 6.283);
        float alpha = fresnel * lengthFade * uOpacity * (0.52 + uBassHit * 0.85) * shimmer;
        gl_FragColor = vec4(uColor * (0.95 + uBassHit * 0.45), clamp(alpha, 0.0, 0.12));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

/**
 * Razor-sharp distance-faded club laser ray shader (smooth lens-to-floor falloff, no solid plastic stick edge)
 */
export function createSoftLaserRayMaterial(
  hexColor = '#ffffff',
  opacity = 0.34
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(hexColor) },
      uTime: { value: 0 },
      uOpacity: { value: opacity }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;

      void main() {
        vec3 viewDir = normalize(vViewPos);
        float radial = pow(max(0.08, abs(dot(normalize(vNormalView), viewDir))), 1.8);
        // vUv.y = 0 at emitter aperture, 1 at far floor end -> bright near emitter, fading smoothly into fog
        float axialFade = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.18, 1.0, vUv.y));
        float dust = 0.85 + 0.15 * sin(vUv.y * 22.0 - uTime * 4.5 + vUv.x * 12.0);
        float alpha = radial * axialFade * uOpacity * dust;
        gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 0.72));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

export function createLensFlareTexture(): THREE.CanvasTexture {
  if (CACHED_LENS_FLARE_TEX) return CACHED_LENS_FLARE_TEX;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(0.35, 'rgba(255, 224, 178, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  CACHED_LENS_FLARE_TEX = tex;
  return tex;
}

export function createSpeakerGrilleCanvasTexture(): THREE.CanvasTexture {
  if (CACHED_SPEAKER_GRILLE_TEX) return CACHED_SPEAKER_GRILLE_TEX;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1f2937';
  for (let y = 4; y < size; y += 8) {
    for (let x = 4; x < size; x += 8) {
      ctx.beginPath();
      ctx.arc(x + ((y / 8) % 2) * 4, y, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 5);
  CACHED_SPEAKER_GRILLE_TEX = tex;
  return tex;
}



function findBone(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  const stripped = name.replace('mixamorig:', '').replace('mixamorig', '');
  return (
    root.getObjectByName(name) ||
    root.getObjectByName(name.replace(':', '')) ||
    root.getObjectByName(stripped)
  );
}

function aimBoneWorldDir(
  root: THREE.Object3D,
  boneName: string,
  childName: string,
  targetWorldDir: [number, number, number]
) {
  const bone = findBone(root, boneName);
  const child = findBone(root, childName);
  if (!bone || !child || !bone.parent) return;

  bone.parent.updateWorldMatrix(true, false);
  bone.updateWorldMatrix(true, false);
  child.updateWorldMatrix(true, false);

  bone.getWorldPosition(_bonePos);
  child.getWorldPosition(_childPos);
  _curDir.copy(_childPos).sub(_bonePos);
  if (_curDir.lengthSq() < 1e-8) return;
  _curDir.normalize();

  _tgtDir.set(targetWorldDir[0], targetWorldDir[1], targetWorldDir[2]).normalize();
  _qDelta.setFromUnitVectors(_curDir, _tgtDir);

  bone.parent.getWorldQuaternion(_parentQuat);
  _localDelta.copy(_parentQuat).invert().multiply(_qDelta).multiply(_parentQuat);
  bone.quaternion.premultiply(_localDelta);
  bone.updateMatrixWorld(true);
}



function makeInPlaceClip(clip: THREE.AnimationClip, stripLegs = false): THREE.AnimationClip {
  const clonedClip = clip.clone();
  clonedClip.tracks = clonedClip.tracks.filter((track) => {
    // Strip all root-motion and bone position translation tracks so skeletons never drift or clip into furniture
    if (track.name.endsWith('.position') || track.name.endsWith('.scale')) {
      return false;
    }
    if (stripLegs && /UpLeg|Leg|Foot|Toe/i.test(track.name)) {
      return false;
    }
    return true;
  });
  return clonedClip;
}

function buildHumanActivityClip(
  modelUrl: string,
  root: THREE.Object3D,
  externalMocapClips: THREE.AnimationClip[],
  nativeClips: THREE.AnimationClip[],
  activity: HumanActivityMode,
  seated: boolean,
  variant: number
): THREE.AnimationClip {
  const variantBucket = Math.abs(variant) % 5;
  const clipCacheKey = `${modelUrl}|${activity}|${seated ? 1 : 0}|${variantBucket}|${externalMocapClips.length}`;
  const cachedClip = ACTIVITY_CLIP_CACHE.get(clipCacheKey);
  if (cachedClip) return cachedClip;

  const validExternal = externalMocapClips.filter((c) => !/tpose|t-pose/i.test(c.name) && c.duration > 0.25);
  const validNative = nativeClips.filter((c) => !/tpose|t-pose/i.test(c.name) && c.duration > 0.25);
  const rpmIdle = validExternal.find((c) => /idle/i.test(c.name));
  const rpmDances = validExternal.filter((c) => /dance/i.test(c.name));

  const primeClip =
    activity === 'club_dance' || activity === 'dj'
      ? rpmDances[variant % Math.max(1, rpmDances.length)] || rpmIdle || validNative[0]
      : rpmIdle || validNative[0];

  let tmpMx: THREE.AnimationMixer | null = null;
  if (primeClip) {
    const strippedPrime = makeInPlaceClip(primeClip, seated);
    tmpMx = new THREE.AnimationMixer(root);
    const act = tmpMx.clipAction(strippedPrime);
    act.reset().play();
    tmpMx.update(0.25);
  }
  root.updateMatrixWorld(true);

  if (!seated && (activity === 'club_dance' || activity === 'dj') && validExternal.length > 0) {
    if (tmpMx) {
      tmpMx.stopAllAction();
      tmpMx.uncacheRoot(root);
    }
    const danceClip =
      rpmDances[variant % Math.max(1, rpmDances.length)] || rpmIdle || validExternal[0];
    const inPlace = makeInPlaceClip(danceClip, false);
    ACTIVITY_CLIP_CACHE.set(clipCacheKey, inPlace);
    return inPlace;
  }

  aimBoneWorldDir(root, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.22, -0.88, 0.28]);
  aimBoneWorldDir(root, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [0.06, -0.52, 0.82]);
  aimBoneWorldDir(root, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.22, -0.88, 0.28]);
  aimBoneWorldDir(root, 'mixamorigRightForeArm', 'mixamorigRightHand', [-0.06, -0.52, 0.82]);

  if (seated) {
    // Thighs extend horizontally forward on seat cushion, knees bend cleanly downward to plant feet on floor
    aimBoneWorldDir(root, 'mixamorigLeftUpLeg', 'mixamorigLeftLeg', [0.08, -0.06, 0.99]);
    aimBoneWorldDir(root, 'mixamorigLeftLeg', 'mixamorigLeftFoot', [0.02, -0.98, 0.12]);
    aimBoneWorldDir(root, 'mixamorigLeftFoot', 'mixamorigLeftToeBase', [0.02, -0.05, 0.99]);
    aimBoneWorldDir(root, 'mixamorigRightUpLeg', 'mixamorigRightLeg', [-0.08, -0.06, 0.99]);
    aimBoneWorldDir(root, 'mixamorigRightLeg', 'mixamorigRightFoot', [-0.02, -0.98, 0.12]);
    aimBoneWorldDir(root, 'mixamorigRightFoot', 'mixamorigRightToeBase', [-0.02, -0.05, 0.99]);
  }
  root.updateMatrixWorld(true);

  const capture = (n: string) => findBone(root, n)?.quaternion.clone() || new THREE.Quaternion();
  const spineQ = capture('mixamorigSpine1');
  const lowSpineQ = capture('mixamorigSpine');
  const headQ = capture('mixamorigHead');
  const lArmQ = capture('mixamorigLeftArm');
  const lForeQ = capture('mixamorigLeftForeArm');
  const rArmQ = capture('mixamorigRightArm');
  const rForeQ = capture('mixamorigRightForeArm');
  const lUpLegQ = capture('mixamorigLeftUpLeg');
  const lLegQ = capture('mixamorigLeftLeg');
  const lFootQ = capture('mixamorigLeftFoot');
  const rUpLegQ = capture('mixamorigRightUpLeg');
  const rLegQ = capture('mixamorigRightLeg');
  const rFootQ = capture('mixamorigRightFoot');

  if (tmpMx) {
    tmpMx.stopAllAction();
    tmpMx.uncacheRoot(root);
  }

  const poseRoot = clone(root);
  poseRoot.updateMatrixWorld(true);
  if (activity === 'guitar_sit') {
    aimBoneWorldDir(poseRoot, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.28, -0.66, 0.68]);
    aimBoneWorldDir(poseRoot, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [-0.4, 0.14, 0.88]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.24, -0.74, 0.62]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightForeArm', 'mixamorigRightHand', [0.48, -0.14, 0.86]);
  } else if (activity === 'piano_play') {
    aimBoneWorldDir(poseRoot, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.16, -0.58, 0.78]);
    aimBoneWorldDir(poseRoot, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [-0.08, -0.05, 0.98]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.16, -0.58, 0.78]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightForeArm', 'mixamorigRightHand', [0.08, -0.05, 0.98]);
  } else if (activity === 'bartend') {
    aimBoneWorldDir(poseRoot, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.2, -0.64, 0.72]);
    aimBoneWorldDir(poseRoot, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [-0.28, 0.08, 0.92]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.2, -0.62, 0.74]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightForeArm', 'mixamorigRightHand', [0.3, 0.12, 0.92]);
  } else if (activity === 'poker_lean') {
    aimBoneWorldDir(poseRoot, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.24, -0.62, 0.72]);
    aimBoneWorldDir(poseRoot, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [-0.24, 0.12, 0.94]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.22, -0.66, 0.68]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightForeArm', 'mixamorigRightHand', [0.18, 0.22, 0.92]);
  } else if (activity === 'read' || activity === 'podcast_talk' || activity === 'converse') {
    aimBoneWorldDir(poseRoot, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.22, -0.74, 0.52]);
    aimBoneWorldDir(poseRoot, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [-0.22, -0.06, 0.94]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.22, -0.74, 0.52]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightForeArm', 'mixamorigRightHand', [0.22, -0.06, 0.94]);
  } else if (activity === 'narrate') {
    aimBoneWorldDir(poseRoot, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.18, -0.78, 0.54]);
    aimBoneWorldDir(poseRoot, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [-0.15, 0.14, 0.94]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.22, -0.64, 0.72]);
    aimBoneWorldDir(poseRoot, 'mixamorigRightForeArm', 'mixamorigRightHand', [0.18, 0.28, 0.88]);
  }
  poseRoot.updateMatrixWorld(true);

  const pLArmQ = findBone(poseRoot, 'mixamorigLeftArm')?.quaternion.clone() || lArmQ;
  const pLForeQ = findBone(poseRoot, 'mixamorigLeftForeArm')?.quaternion.clone() || lForeQ;
  const pRArmQ = findBone(poseRoot, 'mixamorigRightArm')?.quaternion.clone() || rArmQ;
  const pRForeQ = findBone(poseRoot, 'mixamorigRightForeArm')?.quaternion.clone() || rForeQ;

  // Smooth, natural breathing & activity micro-movement cycle
  const duration = 5.5;
  const times = [0, 1.375, 2.75, 4.125, 5.5];
  const makeTrack = (bName: string, baseQ: THREE.Quaternion, keyOffsets: Array<[number, number, number]>) => {
    const bone = findBone(root, bName);
    const actualName = bone ? bone.name : bName;
    const vals: number[] = [];
    keyOffsets.forEach(([rx, ry, rz]) => {
      _eTmp.set(rx, ry, rz);
      _qTmp.copy(baseQ).multiply(new THREE.Quaternion().setFromEuler(_eTmp));
      vals.push(_qTmp.x, _qTmp.y, _qTmp.z, _qTmp.w);
    });
    return new THREE.QuaternionKeyframeTrack(`${actualName}.quaternion`, times, vals);
  };

  const swayAmp =
    activity === 'club_dance' || activity === 'dj'
      ? 0.09
      : activity === 'piano_play'
        ? 0.068
        : activity === 'chill_sway' || activity === 'bartend'
          ? 0.045
          : activity === 'podcast_talk' || activity === 'narrate' || activity === 'converse' || activity === 'poker_lean'
            ? 0.034
            : 0.018;

  const headNod =
    activity === 'podcast_talk' || activity === 'narrate' || activity === 'piano_play'
      ? 0.06
      : activity === 'read'
        ? 0.025
        : 0.048;

  const headDownPitch = activity === 'read' ? 0.22 : activity === 'poker_lean' ? 0.11 : activity === 'piano_play' ? 0.08 : 0.0;
  const spineForwardLean = activity === 'poker_lean' ? 0.14 : activity === 'piano_play' ? 0.08 : 0.015;

  const zeroOffsets: Array<[number, number, number]> = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];

  const tracks: THREE.KeyframeTrack[] = [
    makeTrack('mixamorigSpine', lowSpineQ, [
      [spineForwardLean, -swayAmp * 0.6, -swayAmp * 0.5],
      [spineForwardLean + 0.02, 0, 0],
      [spineForwardLean, swayAmp * 0.6, swayAmp * 0.5],
      [spineForwardLean + 0.018, 0, 0],
      [spineForwardLean, -swayAmp * 0.6, -swayAmp * 0.5]
    ]),
    makeTrack('mixamorigSpine1', spineQ, [
      [spineForwardLean * 0.8, -swayAmp * 0.7, -swayAmp * 0.5],
      [spineForwardLean * 0.8 + 0.025, 0.025, 0],
      [spineForwardLean * 0.8, swayAmp * 0.7, swayAmp * 0.5],
      [spineForwardLean * 0.8 + 0.025, -0.025, 0],
      [spineForwardLean * 0.8, -swayAmp * 0.7, -swayAmp * 0.5]
    ]),
    makeTrack('mixamorigHead', headQ, [
      [headDownPitch, -0.05, 0],
      [headDownPitch + headNod, 0.035, 0],
      [headDownPitch, 0.05, 0],
      [headDownPitch + headNod * 0.65, -0.035, 0],
      [headDownPitch, -0.05, 0]
    ]),
    makeTrack('mixamorigLeftArm', pLArmQ, [
      [0, 0, 0],
      [activity === 'piano_play' ? 0.075 : 0.035, 0, 0.025],
      [-0.025, 0, 0],
      [activity === 'piano_play' ? 0.065 : 0.028, 0, -0.025],
      [0, 0, 0]
    ]),
    makeTrack('mixamorigLeftForeArm', pLForeQ, [
      [0, 0, 0],
      [activity === 'piano_play' ? 0.14 : activity === 'podcast_talk' || activity === 'narrate' ? 0.075 : 0.05, 0, 0],
      [activity === 'piano_play' ? -0.06 : 0, 0, 0],
      [activity === 'piano_play' ? 0.12 : 0.035, 0, 0],
      [0, 0, 0]
    ]),
    makeTrack('mixamorigRightArm', pRArmQ, [
      [0, 0, 0],
      [-0.025, 0, 0],
      [activity === 'piano_play' || activity === 'bartend' ? 0.075 : 0.045, 0, -0.025],
      [0.025, 0, 0],
      [0, 0, 0]
    ]),
    makeTrack('mixamorigRightForeArm', pRForeQ, [
      [0, 0, 0],
      [activity === 'piano_play' ? -0.07 : activity === 'bartend' ? 0.11 : 0.025, 0, 0],
      [activity === 'guitar_sit' || activity === 'piano_play' || activity === 'bartend' ? 0.13 : activity === 'podcast_talk' || activity === 'narrate' ? 0.095 : 0.055, 0, 0],
      [activity === 'piano_play' ? -0.05 : 0.025, 0, 0],
      [0, 0, 0]
    ])
  ];

  if (seated) {
    tracks.push(
      makeTrack('mixamorigLeftUpLeg', lUpLegQ, zeroOffsets),
      makeTrack('mixamorigLeftLeg', lLegQ, zeroOffsets),
      makeTrack('mixamorigLeftFoot', lFootQ, zeroOffsets),
      makeTrack('mixamorigRightUpLeg', rUpLegQ, zeroOffsets),
      makeTrack('mixamorigRightLeg', rLegQ, zeroOffsets),
      makeTrack('mixamorigRightFoot', rFootQ, zeroOffsets)
    );
  }

  const builtClip = new THREE.AnimationClip(`human_${activity}`, duration, tracks);
  ACTIVITY_CLIP_CACHE.set(clipCacheKey, builtClip);
  return builtClip;
}

export type WesternHatStyle =
  | 'stetson_brown'
  | 'stetson_black'
  | 'gambler_tan'
  | 'bowler_black'
  | 'saloon_lady';

export type WesternPropType =
  | 'cigar_smoke'
  | 'poker_cards'
  | 'whiskey_glass'
  | 'bar_cloth';

export type WesternOutfitPreset =
  | 'lady_olive_vest'
  | 'lady_charcoal_vest'
  | 'lady_chestnut_vest'
  | 'cowboy_tan_duster'
  | 'cowboy_sand_shirt'
  | 'guitarist_slate_denim'
  | 'bartender_slate_shirt'
  | 'patron_denim_shirt';

const AVATAR_STD_MAT_CACHE = new Map<string, THREE.MeshStandardMaterial>();
const WESTERN_MAT_CACHE = new Map<string, THREE.MeshStandardMaterial>();
let CACHED_STETSON_BRIM_GEO: THREE.CylinderGeometry | null = null;
let CACHED_STETSON_CURL_GEO: THREE.TorusGeometry | null = null;
let CACHED_STETSON_CROWN_GEO: THREE.CylinderGeometry | null = null;
let CACHED_STETSON_CREASE_GEO: THREE.SphereGeometry | null = null;
let CACHED_BOWLER_DOME_GEO: THREE.SphereGeometry | null = null;
let CACHED_HATBAND_GEO: THREE.CylinderGeometry | null = null;
let CACHED_GUNBELT_GEO: THREE.CylinderGeometry | null = null;
let CACHED_HOLSTER_GEO: THREE.CylinderGeometry | null = null;
let CACHED_BUCKLE_GEO: THREE.BoxGeometry | null = null;
let CACHED_MUSTACHE_GEO: THREE.TorusGeometry | null = null;
let CACHED_CIGAR_GEO: THREE.CylinderGeometry | null = null;
let CACHED_SMOKE_WISP_GEO: THREE.ConeGeometry | null = null;
let CACHED_CARD_GEO: THREE.PlaneGeometry | null = null;
let CACHED_GLASS_GEO: THREE.CylinderGeometry | null = null;

function getWesternMat(key: string, color: string, roughness = 0.78, metalness = 0.04): THREE.MeshStandardMaterial {
  const hit = WESTERN_MAT_CACHE.get(key);
  if (hit) return hit;
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  WESTERN_MAT_CACHE.set(key, mat);
  return mat;
}

const WESTERN_OUTFIT_RGB: Record<
  WesternOutfitPreset,
  {
    hair: [number, number, number];
    sleeve: [number, number, number];
    torso: [number, number, number];
    pants: [number, number, number];
    hasBackPatch?: boolean;
  }
> = {
  lady_olive_vest: {
    hair: [28, 20, 15],
    sleeve: [214, 205, 190],
    torso: [82, 68, 53],
    pants: [36, 32, 28]
  },
  lady_charcoal_vest: {
    hair: [38, 26, 18],
    sleeve: [166, 154, 136],
    torso: [54, 48, 41],
    pants: [34, 31, 28]
  },
  lady_chestnut_vest: {
    hair: [108, 68, 42],
    sleeve: [220, 212, 198],
    torso: [94, 68, 46],
    pants: [40, 34, 29]
  },
  cowboy_tan_duster: {
    hair: [38, 28, 18],
    sleeve: [126, 106, 80],
    torso: [116, 97, 73],
    pants: [38, 41, 46],
    hasBackPatch: true
  },
  cowboy_sand_shirt: {
    hair: [44, 32, 20],
    sleeve: [152, 131, 103],
    torso: [142, 122, 95],
    pants: [42, 36, 30]
  },
  guitarist_slate_denim: {
    hair: [42, 30, 18],
    sleeve: [86, 98, 110],
    torso: [78, 90, 102],
    pants: [58, 76, 96]
  },
  bartender_slate_shirt: {
    hair: [34, 24, 16],
    sleeve: [94, 107, 120],
    torso: [84, 96, 108],
    pants: [34, 34, 36]
  },
  patron_denim_shirt: {
    hair: [36, 26, 18],
    sleeve: [66, 82, 102],
    torso: [60, 76, 95],
    pants: [40, 44, 50],
    hasBackPatch: true
  }
};

function createWesternOutfitMaterial(
  baseMap: THREE.Texture,
  outfit: WesternOutfitPreset
): THREE.MeshStandardMaterial {
  const cacheKey = `${baseMap.uuid}:western:${outfit}`;
  const cached = AVATAR_STD_MAT_CACHE.get(cacheKey);
  if (cached) return cached;

  const img = baseMap.image as HTMLImageElement | ImageBitmap | HTMLCanvasElement | undefined;
  if (!img || !('width' in img) || img.width === 0) {
    const fallback = new THREE.MeshStandardMaterial({
      map: baseMap,
      roughness: 0.78,
      metalness: 0.02
    });
    AVATAR_STD_MAT_CACHE.set(cacheKey, fallback);
    return fallback;
  }

  const w = img.width || 512;
  const h = img.height || 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const cfg = WESTERN_OUTFIT_RGB[outfit];
  const sx = w / 512;
  const sy = h / 512;

  for (let y = 0; y < h; y++) {
    const ny = y / sy;
    for (let x = 0; x < w; x++) {
      const nx = x / sx;
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const weave = ((x + y) % 2 === 0 ? 0.96 : 1.04) * (0.94 + hash01(x * 0.37 + y * 0.73) * 0.12);

      // 1. Hair region
      if ((ny < 56 && nx < 256) || (outfit.startsWith('lady_') && nx >= 256 && ny < 248)) {
        const shade = (0.68 + lum * 0.62) * weave;
        data[i] = Math.min(255, Math.round(cfg.hair[0] * shade));
        data[i + 1] = Math.min(255, Math.round(cfg.hair[1] * shade));
        data[i + 2] = Math.min(255, Math.round(cfg.hair[2] * shade));
      }
      // 2. Shirt & Sleeves region (ny: 256..338, nx: 0..256)
      else if (ny >= 256 && ny < 338 && nx < 256) {
        if (r < 12 && g < 12 && b < 12) continue;
        const shade = (0.7 + lum * 0.38) * weave;
        data[i] = Math.min(255, Math.round(cfg.sleeve[0] * shade));
        data[i + 1] = Math.min(255, Math.round(cfg.sleeve[1] * shade));
        data[i + 2] = Math.min(255, Math.round(cfg.sleeve[2] * shade));
      }
      // 3. Waistcoat / Duster / Shirt Torso region (ny: 338..512, nx: 0..256)
      else if (ny >= 338 && nx < 256) {
        if (r < 10 && g < 10 && b < 10) continue;
        const fold = 0.74 + Math.sin(nx * 0.085) * 0.08 + lum * 0.34;
        let shade = fold * weave;
        // Subtle weathered canvas patch on the back of duster/shirt matching IMG_4438.webp
        if (
          cfg.hasBackPatch &&
          nx >= 148 &&
          nx <= 196 &&
          ny >= 365 &&
          ny <= 425 &&
          hash01(nx * 0.5 + ny * 0.5) > 0.22
        ) {
          shade *= 1.32;
        }
        data[i] = Math.min(255, Math.round(cfg.torso[0] * shade));
        data[i + 1] = Math.min(255, Math.round(cfg.torso[1] * shade));
        data[i + 2] = Math.min(255, Math.round(cfg.torso[2] * shade));
      }
      // 4. Trousers / Jeans region (nx: 256..384, ny: 56..128)
      else if (nx >= 256 && nx < 384 && ny >= 56 && ny < 128) {
        const shade = (0.76 + lum * 0.48) * weave;
        data[i] = Math.min(255, Math.round(cfg.pants[0] * shade));
        data[i + 1] = Math.min(255, Math.round(cfg.pants[1] * shade));
        data[i + 2] = Math.min(255, Math.round(cfg.pants[2] * shade));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const newTex = new THREE.CanvasTexture(c);
  newTex.colorSpace = THREE.SRGBColorSpace;
  newTex.flipY = baseMap.flipY;
  newTex.wrapS = baseMap.wrapS;
  newTex.wrapT = baseMap.wrapT;
  newTex.needsUpdate = true;

  const mat = new THREE.MeshStandardMaterial({
    map: newTex,
    roughness: 0.78,
    metalness: 0.02
  });
  AVATAR_STD_MAT_CACHE.set(cacheKey, mat);
  return mat;
}

function attachWesternHatAndGear(
  cloned: THREE.Object3D,
  style?: WesternHatStyle,
  propType?: WesternPropType,
  archetypeIndex = 0
) {
  if (!CACHED_STETSON_BRIM_GEO) {
    CACHED_STETSON_BRIM_GEO = new THREE.CylinderGeometry(0.175, 0.182, 0.01, 24);
    CACHED_STETSON_CURL_GEO = new THREE.TorusGeometry(0.172, 0.011, 8, 24);
    CACHED_STETSON_CROWN_GEO = new THREE.CylinderGeometry(0.086, 0.108, 0.112, 20);
    CACHED_STETSON_CREASE_GEO = new THREE.SphereGeometry(0.044, 12, 10);
    CACHED_BOWLER_DOME_GEO = new THREE.SphereGeometry(0.106, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62);
    CACHED_HATBAND_GEO = new THREE.CylinderGeometry(0.107, 0.109, 0.018, 20);
    CACHED_GUNBELT_GEO = new THREE.CylinderGeometry(0.168, 0.175, 0.042, 20);
    CACHED_HOLSTER_GEO = new THREE.CylinderGeometry(0.025, 0.017, 0.17, 10);
    CACHED_BUCKLE_GEO = new THREE.BoxGeometry(0.048, 0.038, 0.016);
    CACHED_MUSTACHE_GEO = new THREE.TorusGeometry(0.03, 0.008, 8, 14, Math.PI * 1.15);
    CACHED_CIGAR_GEO = new THREE.CylinderGeometry(0.0045, 0.005, 0.065, 8);
    CACHED_SMOKE_WISP_GEO = new THREE.ConeGeometry(0.038, 0.26, 10, 1, true);
    CACHED_CARD_GEO = new THREE.PlaneGeometry(0.042, 0.062);
    CACHED_GLASS_GEO = new THREE.CylinderGeometry(0.024, 0.019, 0.058, 12);
  }

  const headBone = findBone(cloned, 'mixamorigHead') || findBone(cloned, 'Head');
  if (headBone && style) {
    const hatGroup = new THREE.Group();
    const isLady = style === 'saloon_lady';
    const isBowler = style === 'bowler_black';

    // Authentic 1899 weathered felt tones matching IMG_4438.webp (dark charcoal-brown & worn umber)
    const feltMat =
      style === 'stetson_brown'
        ? getWesternMat('felt_brown_rdr2', '#382c21', 0.84, 0.02)
        : style === 'gambler_tan'
          ? getWesternMat('felt_charcoal_rdr2', '#2d251e', 0.84, 0.02)
          : style === 'saloon_lady'
            ? getWesternMat('felt_lady_rdr2', '#2b231c', 0.82, 0.03)
            : getWesternMat('felt_black_rdr2', '#221d18', 0.82, 0.03);

    const bandMat = getWesternMat('band_leather_rdr2', '#1a130e', 0.68, 0.08);

    const brim = new THREE.Mesh(CACHED_STETSON_BRIM_GEO!, feltMat);
    const brimScaleX = isBowler ? 0.78 : isLady ? 0.92 : 0.96;
    const brimScaleZ = isBowler ? 0.84 : isLady ? 1.02 : 1.12;
    brim.scale.set(brimScaleX, 1, brimScaleZ);
    hatGroup.add(brim);

    const curl = new THREE.Mesh(CACHED_STETSON_CURL_GEO!, feltMat);
    curl.rotation.x = Math.PI / 2;
    curl.position.y = 0.007;
    curl.scale.set(brimScaleX, brimScaleZ, 1.12);
    hatGroup.add(curl);

    if (isBowler) {
      const dome = new THREE.Mesh(CACHED_BOWLER_DOME_GEO!, feltMat);
      dome.position.y = 0.01;
      dome.scale.set(0.95, 0.95, 1.06);
      hatGroup.add(dome);
    } else {
      const crown = new THREE.Mesh(CACHED_STETSON_CROWN_GEO!, feltMat);
      crown.position.y = 0.056;
      crown.scale.set(0.94, 0.96, 1.1);
      hatGroup.add(crown);

      const leftLobe = new THREE.Mesh(CACHED_STETSON_CREASE_GEO!, feltMat);
      leftLobe.position.set(-0.028, 0.106, 0.004);
      leftLobe.scale.set(0.82, 0.52, 1.75);
      hatGroup.add(leftLobe);

      const rightLobe = new THREE.Mesh(CACHED_STETSON_CREASE_GEO!, feltMat);
      rightLobe.position.set(0.028, 0.106, 0.004);
      rightLobe.scale.set(0.82, 0.52, 1.75);
      hatGroup.add(rightLobe);
    }

    const hatband = new THREE.Mesh(CACHED_HATBAND_GEO!, bandMat);
    hatband.position.y = 0.015;
    hatband.scale.set(0.95, 1, 1.11);
    hatGroup.add(hatband);

    hatGroup.position.set(0, isLady ? 0.142 : 0.128, -0.006);
    hatGroup.rotation.x = -0.05;
    headBone.add(hatGroup);

    // Subtle 1899 Mustache for Bartender & Selected Cowboys
    if (!isLady && (propType === 'bar_cloth' || archetypeIndex % 2 === 1)) {
      const mustacheMat = getWesternMat('mustache_dark', '#23160d', 0.85, 0.02);
      const mustache = new THREE.Mesh(CACHED_MUSTACHE_GEO!, mustacheMat);
      mustache.position.set(0, 0.018, 0.095);
      mustache.rotation.set(0.15, 0, Math.PI * 0.92);
      headBone.add(mustache);
    }
  } else if (headBone && propType === 'bar_cloth') {
    const mustacheMat = getWesternMat('mustache_dark', '#23160d', 0.85, 0.02);
    const mustache = new THREE.Mesh(CACHED_MUSTACHE_GEO!, mustacheMat);
    mustache.position.set(0, 0.018, 0.095);
    mustache.rotation.set(0.15, 0, Math.PI * 0.92);
    headBone.add(mustache);
  }

  // Leather Gunbelt & Holster on Hips for Cowboys (No bulky neck cone bandana!)
  if (style === 'stetson_brown' || style === 'stetson_black' || style === 'gambler_tan') {
    const hipBone = findBone(cloned, 'mixamorigHips') || findBone(cloned, 'Hips');
    if (hipBone) {
      const beltMat = getWesternMat('gunbelt_leather', '#241810', 0.65, 0.1);
      const brassMat = getWesternMat('gunbelt_brass', '#9c8040', 0.35, 0.82);
      const beltGroup = new THREE.Group();

      const belt = new THREE.Mesh(CACHED_GUNBELT_GEO!, beltMat);
      belt.scale.set(1.01, 1, 0.78);
      belt.rotation.z = -0.06;
      beltGroup.add(belt);

      const buckle = new THREE.Mesh(CACHED_BUCKLE_GEO!, brassMat);
      buckle.position.set(0, 0.002, 0.134);
      beltGroup.add(buckle);

      const holster = new THREE.Mesh(CACHED_HOLSTER_GEO!, beltMat);
      holster.position.set(-0.175, -0.095, 0.015);
      holster.rotation.set(0.12, 0, 0.08);
      beltGroup.add(holster);

      beltGroup.position.set(0, -0.02, 0.005);
      hipBone.add(beltGroup);
    }
  }

  // Hand Props: Lit Cigar, Fanned Playing Cards, Whiskey Glass, or Bar Towel
  if (propType) {
    const rHand = findBone(cloned, 'mixamorigRightHand') || findBone(cloned, 'RightHand');
    const lHand = findBone(cloned, 'mixamorigLeftHand') || findBone(cloned, 'LeftHand');

    if (propType === 'cigar_smoke' && rHand) {
      const cigarGroup = new THREE.Group();
      const cigarMat = getWesternMat('cigar_leaf', '#522912', 0.78, 0.02);
      const emberMat = new THREE.MeshStandardMaterial({
        color: '#ff4500',
        emissive: '#ff5500',
        emissiveIntensity: 1.8
      });
      const smokeMat = new THREE.MeshBasicMaterial({
        color: '#d6d3d1',
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      const cigar = new THREE.Mesh(CACHED_CIGAR_GEO!, cigarMat);
      cigar.rotation.z = Math.PI / 2;
      cigarGroup.add(cigar);

      const ember = new THREE.Mesh(CACHED_CIGAR_GEO!, emberMat);
      ember.scale.set(1.05, 0.16, 1.05);
      ember.position.set(0.03, 0, 0);
      ember.rotation.z = Math.PI / 2;
      cigarGroup.add(ember);

      const wisp1 = new THREE.Mesh(CACHED_SMOKE_WISP_GEO!, smokeMat);
      wisp1.position.set(0.04, 0.13, 0);
      wisp1.rotation.z = 0.12;
      cigarGroup.add(wisp1);

      cigarGroup.position.set(0.03, 0.04, 0.03);
      rHand.add(cigarGroup);
    } else if (propType === 'poker_cards' && lHand) {
      const cardMat = getWesternMat('card_ivory', '#f5f0e1', 0.45, 0.02);
      const cardsGroup = new THREE.Group();
      [-0.22, 0, 0.22].forEach((ang, idx) => {
        const card = new THREE.Mesh(CACHED_CARD_GEO!, cardMat);
        card.position.set(idx * 0.012 - 0.012, 0.02, idx * 0.002);
        card.rotation.set(-0.35, 0, ang);
        cardsGroup.add(card);
      });
      cardsGroup.position.set(0, 0.05, 0.03);
      lHand.add(cardsGroup);
    } else if (propType === 'whiskey_glass' && rHand) {
      const glassMat = getWesternMat('whiskey_amber', '#c26a1b', 0.18, 0.12);
      const glass = new THREE.Mesh(CACHED_GLASS_GEO!, glassMat);
      glass.position.set(0.02, 0.05, 0.03);
      rHand.add(glass);
    } else if (propType === 'bar_cloth') {
      if (lHand) {
        const glassMat = getWesternMat('whiskey_amber', '#c26a1b', 0.18, 0.12);
        const glass = new THREE.Mesh(CACHED_GLASS_GEO!, glassMat);
        glass.position.set(0.02, 0.05, 0.03);
        lHand.add(glass);
      }
      if (rHand) {
        const clothMat = getWesternMat('bar_towel', '#dfd7c8', 0.85, 0.02);
        const cloth = new THREE.Mesh(CACHED_BUCKLE_GEO!, clothMat);
        cloth.scale.set(1.4, 1.0, 2.6);
        cloth.position.set(0, 0.05, 0.02);
        rHand.add(cloth);
      }
    }
  }
}

export function RiggedHumanAvatar({
  modelUrl,
  mocapClips,
  archetypeIndex,
  outfitOverride,
  position,
  rotationY = 0,
  targetHeight = 1.74,
  activity = 'chill_sway',
  seated = false,
  seatHeight = 0.44,
  phaseOffset = 0,
  speedMult = 1.0,
  isPlaying = true,
  bpm = 120,
  audioSyncBand = 'bass',
  castShadow = true,
  isActive = true,
  westernHat,
  westernProp,
  westernOutfit,
  onClick,
  children
}: {
  modelUrl: string;
  mocapClips: THREE.AnimationClip[];
  archetypeIndex: number;
  wardrobe?: string;
  outfitOverride?: Partial<HumanArchetypePreset>;
  position: [number, number, number];
  rotationY?: number;
  targetHeight?: number;
  activity?: HumanActivityMode;
  seated?: boolean;
  seatHeight?: number;
  phaseOffset?: number;
  speedMult?: number;
  rimColor?: string;
  rimIntensity?: number;
  isPlaying?: boolean;
  bpm?: number;
  audioSyncBand?: 'bass' | 'mid';
  castShadow?: boolean;
  isActive?: boolean;
  westernHat?: WesternHatStyle;
  westernProp?: WesternPropType;
  westernOutfit?: WesternOutfitPreset;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const gltf = useGLTF(modelUrl, DRACO_DECODER_URL);
  const archetype = useMemo<HumanArchetypePreset>(() => {
    const base = HUMAN_ARCHETYPES[((archetypeIndex % HUMAN_ARCHETYPES.length) + HUMAN_ARCHETYPES.length) % HUMAN_ARCHETYPES.length];
    return outfitOverride ? { ...base, ...outfitOverride } : base;
  }, [archetypeIndex, outfitOverride]);

  const { clonedScene, mixer } = useMemo(() => {
    const cloned = clone(gltf.scene);

    const computeSafeBox = (obj: THREE.Object3D): THREE.Box3 => {
      try {
        return new THREE.Box3().setFromObject(obj);
      } catch {
        return new THREE.Box3(
          new THREE.Vector3(-0.4, 0, -0.4),
          new THREE.Vector3(0.4, 1.85, 0.4)
        );
      }
    };

    // 1. Measure standing height BEFORE seated bone rotations so seated characters keep true 1:1 human scale
    cloned.updateMatrixWorld(true);
    const standingBox = computeSafeBox(cloned);
    const standingSize = new THREE.Vector3();
    standingBox.getSize(standingSize);
    const scale = standingSize.y > 0.01 ? (targetHeight * archetype.heightScale) / standingSize.y : 1;
    cloned.scale.set(scale * archetype.buildScaleX, scale, scale * archetype.buildScaleZ);
    cloned.updateMatrixWorld(true);

    // 2. Build and apply activity clip (with zero root-motion translation)
    const clip = buildHumanActivityClip(
      modelUrl,
      cloned,
      mocapClips,
      gltf.animations,
      activity,
      seated,
      archetypeIndex
    );
    const mx = new THREE.AnimationMixer(cloned);
    const act = mx.clipAction(clip);
    act.reset().play();
    mx.update((phaseOffset * 1.19) % Math.max(0.8, clip.duration));

    // 3. Lock seated pelvis cleanly onto chair cushion (Hips joint center is 0.10m above underside of buttocks, so Hips at seatHeight + 0.10 places thighs flush on seat and boots on floor)
    cloned.updateMatrixWorld(true);
    const posedBox = computeSafeBox(cloned);
    if (seated) {
      const hipBone = findBone(cloned, 'mixamorigHips') || findBone(cloned, 'Hips');
      if (hipBone) {
        hipBone.getWorldPosition(_bonePos);
        cloned.position.y += (seatHeight + 0.10) - _bonePos.y;
        cloned.position.z += -0.06 - _bonePos.z;
      } else {
        cloned.position.y -= posedBox.min.y;
      }
    } else {
      cloned.position.y -= posedBox.min.y;
    }

    // 4. Optional sculpted 3D Cowboy Hat, Gunbelt & Hand Props attached cleanly after Box3 measurement
    if (westernHat || westernProp) {
      attachWesternHatAndGear(cloned, westernHat, westernProp, archetypeIndex);
    }

    // Upgrade any unlit KHR_materials_unlit basic material and apply authentic 1899 Western fabric colors when westernOutfit is specified
    cloned.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = castShadow;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        const mat = mesh.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
        if (mat && mat.map) {
          if (westernOutfit) {
            mesh.material = createWesternOutfitMaterial(mat.map, westernOutfit);
          } else if (mat.type === 'MeshBasicMaterial') {
            const cacheKey = mat.map.uuid;
            let stdMat = AVATAR_STD_MAT_CACHE.get(cacheKey);
            if (!stdMat) {
              stdMat = new THREE.MeshStandardMaterial({
                map: mat.map,
                roughness: 0.72,
                metalness: 0.02
              });
              AVATAR_STD_MAT_CACHE.set(cacheKey, stdMat);
            }
            mesh.material = stdMat;
          }
        }
      }
    });

    return { clonedScene: cloned, mixer: mx };
  }, [
    activity,
    archetype,
    archetypeIndex,
    castShadow,
    gltf.animations,
    gltf.scene,
    mocapClips,
    modelUrl,
    phaseOffset,
    seatHeight,
    seated,
    targetHeight,
    westernHat,
    westernOutfit,
    westernProp
  ]);

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  useFrame((_, delta) => {
    if (!isActive) return;
    const audio = djAudioController.getCombinedBassAndSpectrum();
    const audioBoost = audioSyncBand === 'mid' ? audio.mid : audio.bass;
    const basePlayRate =
      activity === 'club_dance' || activity === 'dj'
        ? (Math.max(60, bpm) / 120) * (0.92 + audioBoost * 0.25)
        : activity === 'podcast_talk' || activity === 'narrate' || activity === 'converse'
          ? 0.55 + audioBoost * 0.55
          : activity === 'read'
            ? 0.3
            : 0.6 + audioBoost * 0.3;
    const rate = (isPlaying ? basePlayRate : 0.24) * speedMult;
    mixer.update(Math.min(0.08, delta) * rate);
  });

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    >
      <primitive object={clonedScene} />
      {children}
    </group>
  );
}

/**
 * Hard-Locked Symmetrical Room Camera Rig
 */
export function LockedSymmetricalCameraRig({
  cameraPreset,
  moveInputRef,
  spec,
  roomKey
}: {
  cameraPreset: RoomCameraPreset;
  moveInputRef: React.MutableRefObject<RoomMoveInput>;
  spec: RoomCameraSpec;
  roomKey?: string;
}) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const fpsRef = useRef({
    x: spec.first_person.position[0],
    y: spec.first_person.position[1],
    z: spec.first_person.position[2],
    vy: 0,
    yaw: 0,
    pitch: 0,
    walkBob: 0,
    onGround: true
  });
  const dragRef = useRef({ active: false, pointerId: -1, lastX: 0, lastY: 0 });

  useEffect(() => {
    const cfg = spec[cameraPreset] || spec.cinematic;
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.isPerspectiveCamera) {
      persp.fov = cfg.fov;
      persp.updateProjectionMatrix();
    }

    if (cameraPreset === 'first_person') {
      const dx = cfg.target[0] - cfg.position[0];
      const dy = cfg.target[1] - cfg.position[1];
      const dz = cfg.target[2] - cfg.position[2];
      const initYaw = Math.atan2(-dx, -dz);
      const initPitch = Math.atan2(dy, Math.hypot(dx, dz));
      fpsRef.current = {
        x: cfg.position[0],
        y: cfg.position[1],
        z: cfg.position[2],
        vy: 0,
        yaw: initYaw,
        pitch: initPitch,
        walkBob: 0,
        onGround: true
      };
      camera.position.set(cfg.position[0], cfg.position[1], cfg.position[2]);
      camera.rotation.set(initPitch, initYaw, 0, 'YXZ');
    } else {
      camera.position.set(cfg.position[0], cfg.position[1], cfg.position[2]);
      if (controlsRef.current) {
        controlsRef.current.target.set(cfg.target[0], cfg.target[1], cfg.target[2]);
        controlsRef.current.update();
      } else {
        camera.lookAt(cfg.target[0], cfg.target[1], cfg.target[2]);
      }
    }
  }, [camera, cameraPreset, roomKey, spec]);

  useEffect(() => {
    const dom = gl.domElement;
    const onDown = (e: PointerEvent) => {
      if (cameraPreset !== 'first_person') return;
      dragRef.current = { active: true, pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current.active || e.pointerId !== dragRef.current.pointerId) return;
      if (cameraPreset !== 'first_person') return;
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      const sens = window.innerWidth < 768 ? 0.0045 : 0.0032;
      fpsRef.current.yaw -= dx * sens;
      fpsRef.current.pitch = THREE.MathUtils.clamp(fpsRef.current.pitch - dy * sens, -0.85, 0.85);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId === dragRef.current.pointerId) {
        dragRef.current.active = false;
      }
    };
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [cameraPreset, gl.domElement]);

  useFrame((_, delta) => {
    const b = spec.bounds;
    if (cameraPreset !== 'first_person') {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, b.minX, b.maxX);
      camera.position.y = THREE.MathUtils.clamp(camera.position.y, b.minY, b.maxY);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, b.minZ, b.maxZ);
      return;
    }

    const dt = Math.min(0.1, delta);
    const f = fpsRef.current;
    const m = moveInputRef.current;
    const speed = (m.sprint ? 4.8 : 2.9) * dt;
    if (Math.hypot(m.forward, m.strafe) > 0.04) {
      _forwardVec.set(-Math.sin(f.yaw), 0, -Math.cos(f.yaw));
      _rightVec.set(Math.cos(f.yaw), 0, -Math.sin(f.yaw));
      f.x += (_forwardVec.x * m.forward + _rightVec.x * m.strafe) * speed;
      f.z += (_forwardVec.z * m.forward + _rightVec.z * m.strafe) * speed;
      f.walkBob += dt * (m.sprint ? 11 : 8);
    }
    if (m.jump && f.onGround) {
      f.vy = 5.0;
      f.onGround = false;
      m.jump = false;
    }
    const baseEyeY = spec.first_person.position[1];
    if (!f.onGround) {
      f.vy -= 18 * dt;
      f.y += f.vy * dt;
      if (f.y <= baseEyeY) {
        f.y = baseEyeY;
        f.vy = 0;
        f.onGround = true;
      }
    }
    f.x = THREE.MathUtils.clamp(f.x, b.minX, b.maxX);
    f.z = THREE.MathUtils.clamp(f.z, b.minZ, b.maxZ);
    camera.position.set(f.x, f.y + (f.onGround ? Math.sin(f.walkBob) * 0.022 : 0), f.z);
    camera.rotation.set(f.pitch, f.yaw, 0, 'YXZ');
  });

  if (cameraPreset === 'first_person') return null;

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      enablePan={false}
      maxPolarAngle={Math.PI / 2.04}
      minPolarAngle={0.28}
      minDistance={2.0}
      maxDistance={24.0}
    />
  );
}

export type TrackDisplayStyle =
  | 'cafe_marquee'
  | 'party_cyber'
  | 'library_archival'
  | 'podcast_broadcast';

export function useLiveTrackCanvasTexture({
  style,
  trackTitle,
  trackArtist,
  trackCoverUrl,
  trackAccentHex,
  bpm,
  isPlaying,
  pulseIntensity,
  isActive = true
}: {
  style: TrackDisplayStyle;
  trackTitle: string;
  trackArtist: string;
  trackCoverUrl?: string;
  trackAccentHex: string;
  bpm: number;
  isPlaying: boolean;
  pulseIntensity: number;
  isActive?: boolean;
}): THREE.CanvasTexture {
  const { ctx, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const context = c.getContext('2d')!;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    return { ctx: context, texture: tex };
  }, []);

  const coverImgRef = useRef<HTMLImageElement | null>(null);
  const coverLoadedRef = useRef(false);
  const lastDrawMsRef = useRef(0);

  const drawFrame = useMemo(
    () => (t: number) => {
      const audio = djAudioController.getCombinedBassAndSpectrum();
      const beatHz = Math.max(60, bpm) / 60;
      const synthPulse = isPlaying ? Math.pow(Math.max(0, Math.sin(t * beatHz * Math.PI * 2)), 2.2) : 0.12;
      const bass = Math.min(1.0, Math.max(audio.bass, synthPulse * pulseIntensity));
      const mid = Math.min(1.0, Math.max(audio.mid, isPlaying ? 0.3 + Math.sin(t * 3.8) * 0.18 : 0.12));

      const W = 1024;
      const H = 512;
      const bins = audio.bins;

      ctx.save();

      ctx.fillStyle = style === 'cafe_marquee' ? '#170d06' : style === 'library_archival' ? '#120c09' : '#080b12';
      ctx.fillRect(0, 0, W, H);

    if (style === 'party_cyber') {
      if (coverLoadedRef.current && coverImgRef.current) {
        const img = coverImgRef.current;
        const aspect = img.naturalWidth > 0 ? img.naturalWidth / img.naturalHeight : 1;
        const zoom = 1.04 + bass * 0.03;
        const dw = W * zoom;
        const dh = dw / aspect;
        ctx.save();
        ctx.filter = 'grayscale(100%) contrast(1.25) brightness(0.45)';
        ctx.globalAlpha = 0.42 + bass * 0.1;
        ctx.drawImage(img, (W - dw) * 0.5, (H - dh) * 0.42, dw, dh);
        ctx.restore();
      } else {
        const bg = ctx.createRadialGradient(W * 0.5, H * 0.45, 30, W * 0.5, H * 0.5, W * 0.55);
        bg.addColorStop(0, `rgba(226, 232, 240, ${0.14 + bass * 0.12})`);
        bg.addColorStop(0.45, `rgba(30, 41, 59, ${0.18 + mid * 0.08})`);
        bg.addColorStop(1, '#020203');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
      }

      const vig = ctx.createRadialGradient(W * 0.5, H * 0.45, W * 0.12, W * 0.5, H * 0.5, W * 0.52);
      vig.addColorStop(0, 'rgba(2, 2, 3, 0.25)');
      vig.addColorStop(0.58, 'rgba(2, 2, 3, 0.78)');
      vig.addColorStop(1, '#020203');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      const barCount = 32;
      const bw = 6;
      const gap = 8;
      for (let i = 0; i < barCount; i++) {
        const val =
          bins && bins.length > 0
            ? bins[i % bins.length] / 255
            : isPlaying
              ? 0.18 + 0.72 * Math.pow(0.5 + 0.5 * Math.sin(t * beatHz * Math.PI * 2 - i * 0.35), 2)
              : 0.08;
        const bh = 12 + val * 145;
        const lx = W * 0.5 - 190 - (i + 1) * (bw + gap);
        const rx = W * 0.5 + 190 + i * (bw + gap);
        ctx.fillStyle = `rgba(241, 245, 249, ${0.22 + val * 0.48})`;
        if (lx > 24) ctx.fillRect(lx, H - bh - 24, bw, bh);
        if (rx + bw < W - 24) ctx.fillRect(rx, H - bh - 24, bw, bh);
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(203, 213, 225, 0.58)';
      ctx.font = '700 16px monospace';
      ctx.fillText(`${bpm} BPM  •  BERLIN UNDERGROUND`, W * 0.5, 48, W - 96);

      const cleanTitle = (trackTitle || 'نبض زیرزمینی برلین').slice(0, 44);
      ctx.direction = /[\u0600-\u06FF]/.test(cleanTitle) ? 'rtl' : 'ltr';
      ctx.fillStyle = 'rgba(248, 250, 252, 0.86)';
      ctx.font = '800 30px "Vazirmatn", system-ui, sans-serif';
      ctx.fillText(cleanTitle, W * 0.5, H - 72, W - 110);

      const cleanArtist = (trackArtist || 'Warehouse Session').slice(0, 44);
      ctx.direction = /[\u0600-\u06FF]/.test(cleanArtist) ? 'rtl' : 'ltr';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.78)';
      ctx.font = '600 18px "Vazirmatn", system-ui, sans-serif';
      ctx.fillText(cleanArtist, W * 0.5, H - 34, W - 110);
    } else if (style === 'cafe_marquee') {
      // Authentic 1899 Mottled Silver-White & Smoky Charcoal Tarnished Mercury-Glass Backbar Mirror (matching IMG_4438.webp)
      const mirrorGrad = ctx.createLinearGradient(0, 0, W, H);
      mirrorGrad.addColorStop(0, '#2a2d2e');
      mirrorGrad.addColorStop(0.28, '#585d5e');
      mirrorGrad.addColorStop(0.55, '#8c9290');
      mirrorGrad.addColorStop(0.78, '#4d5253');
      mirrorGrad.addColorStop(1, '#222526');
      ctx.fillStyle = mirrorGrad;
      ctx.fillRect(0, 0, W, H);

      // Luminous cloudy silver-white mercury clouds & smoky dark oxidation blotches matching IMG_4438.webp
      const silverClouds = [
        { x: 0.56 * W, y: 0.22 * H, r: 195, bright: true },
        { x: 0.72 * W, y: 0.62 * H, r: 210, bright: true },
        { x: 0.22 * W, y: 0.45 * H, r: 175, bright: true },
        { x: 0.44 * W, y: 0.78 * H, r: 160, bright: true },
        { x: 0.85 * W, y: 0.35 * H, r: 155, bright: true },
        { x: 0.64 * W, y: 0.42 * H, r: 145, bright: false },
        { x: 0.36 * W, y: 0.26 * H, r: 165, bright: false },
        { x: 0.14 * W, y: 0.72 * H, r: 150, bright: false },
        { x: 0.82 * W, y: 0.82 * H, r: 140, bright: false }
      ];
      silverClouds.forEach((c) => {
        const sg = ctx.createRadialGradient(c.x, c.y, 8, c.x, c.y, c.r);
        if (c.bright) {
          sg.addColorStop(0, 'rgba(242, 245, 240, 0.88)');
          sg.addColorStop(0.45, 'rgba(195, 200, 194, 0.52)');
          sg.addColorStop(1, 'rgba(120, 125, 120, 0)');
        } else {
          sg.addColorStop(0, 'rgba(14, 16, 17, 0.88)');
          sg.addColorStop(0.55, 'rgba(26, 29, 30, 0.55)');
          sg.addColorStop(1, 'rgba(26, 29, 30, 0)');
        }
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      });

      for (let i = 0; i < 56; i++) {
        const sx = hash01(i * 7.3 + 1.2) * W;
        const sy = hash01(i * 13.1 + 0.7) * H;
        const sr = 36 + hash01(i * 3.7) * 95;
        const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, sr);
        if (i % 2 === 0) {
          sg.addColorStop(0, 'rgba(232, 236, 230, 0.54)');
          sg.addColorStop(0.55, 'rgba(168, 172, 166, 0.24)');
          sg.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
          sg.addColorStop(0, 'rgba(15, 17, 18, 0.72)');
          sg.addColorStop(0.6, 'rgba(28, 31, 32, 0.36)');
          sg.addColorStop(1, 'rgba(0,0,0,0)');
        }
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Warm reflected chandelier/candle glints inside the tarnished mirror
      [
        { x: 0.48 * W, y: 0.44 * H, r: 46 },
        { x: 0.55 * W, y: 0.48 * H, r: 38 },
        { x: 0.32 * W, y: 0.56 * H, r: 42 }
      ].forEach((glint) => {
        const gg = ctx.createRadialGradient(glint.x, glint.y, 2, glint.x, glint.y, glint.r);
        gg.addColorStop(0, 'rgba(255, 236, 185, 0.75)');
        gg.addColorStop(0.45, 'rgba(235, 188, 112, 0.28)');
        gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(glint.x, glint.y, glint.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Subtle ghostly reflection of the album cover & Persian title embedded inside the antique mirror
      const artSize = 150;
      const artX = 64;
      const artY = (H - artSize) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.roundRect(artX, artY, artSize, artSize, 10);
      ctx.clip();
      if (coverLoadedRef.current && coverImgRef.current) {
        ctx.drawImage(coverImgRef.current, artX, artY, artSize, artSize);
      }
      ctx.restore();

      const cleanTitle = (trackTitle || 'ضربان نیمه‌شب در ایستگاه نئون').slice(0, 44);
      ctx.textAlign = 'center';
      ctx.direction = /[\u0600-\u06FF]/.test(cleanTitle) ? 'rtl' : 'ltr';
      ctx.fillStyle = 'rgba(235, 232, 224, 0.24)';
      ctx.font = '700 22px "Vazirmatn", Georgia, serif';
      ctx.fillText(cleanTitle, W * 0.56, H * 0.88, 520);
    } else {
      const accent =
        style === 'library_archival'
          ? '#eab308'
          : '#38bdf8';

      const bgGrad = ctx.createRadialGradient(W * 0.5, H * 0.45, 30, W * 0.5, H * 0.5, W * 0.62);
      bgGrad.addColorStop(
        0,
        style === 'library_archival'
          ? 'rgba(54, 34, 14, 0.58)'
          : 'rgba(18, 42, 68, 0.68)'
      );
      bgGrad.addColorStop(1, style === 'library_archival' ? '#0d0907' : '#08090e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      const artSize = 264;
      const artX = 64;
      const artY = (H - artSize) * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(artX, artY, artSize, artSize, 16);
      ctx.clip();
      if (coverLoadedRef.current && coverImgRef.current) {
        ctx.drawImage(coverImgRef.current, artX, artY, artSize, artSize);
      } else {
        const vg = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
        vg.addColorStop(0, '#271a14');
        vg.addColorStop(1, accent);
        ctx.fillStyle = vg;
        ctx.fillRect(artX, artY, artSize, artSize);
        ctx.strokeStyle = 'rgba(255,255,255,0.34)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(artX + artSize * 0.5, artY + artSize * 0.5, 90, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(artX, artY, artSize, artSize, 16);
      ctx.stroke();

      const rightCenterX = 660;
      const textMaxW = 550;
      ctx.textAlign = 'center';

      if (style === 'podcast_broadcast') {
        ctx.fillStyle = isPlaying ? '#ef4444' : '#64748b';
        ctx.beginPath();
        ctx.roundRect(rightCenterX - 130, 88, 260, 36, 8);
        ctx.fill();
        ctx.direction = 'ltr';
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 17px monospace';
        ctx.fillText(isPlaying ? '● ON AIR / LIVE STUDIO' : '❚❚ STUDIO STANDBY', rightCenterX, 112, 240);
      } else {
        ctx.direction = 'ltr';
        ctx.fillStyle = '#e5c158';
        ctx.font = '600 17px monospace';
        const sec = Math.floor(t % 3600);
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');
        ctx.fillText(`GRAND ARCHIVE EDITION  •  VOL. 01  •  ${mm}:${ss}`, rightCenterX, 114, textMaxW);
      }

      const cleanTitle = (trackTitle || 'صدای زنده در آتر').slice(0, 44);
      ctx.direction = /[\u0600-\u06FF]/.test(cleanTitle) ? 'rtl' : 'ltr';
      ctx.fillStyle = style === 'library_archival' ? '#f5e8cc' : '#f8fafc';
      ctx.font = '800 30px "Vazirmatn", system-ui, sans-serif';
      ctx.fillText(cleanTitle, rightCenterX, 194, textMaxW);

      const cleanArtist = (trackArtist || 'Live Session').slice(0, 44);
      ctx.direction = /[\u0600-\u06FF]/.test(cleanArtist) ? 'rtl' : 'ltr';
      ctx.fillStyle = accent;
      ctx.font = '600 21px "Vazirmatn", system-ui, sans-serif';
      ctx.fillText(cleanArtist, rightCenterX, 240, textMaxW);

      const waveStartX = 395;
      const waveW = 530;
      const waveMidY = 345;
      if (style === 'library_archival') {
        for (let w = 0; w < 2; w++) {
          ctx.beginPath();
          ctx.strokeStyle = w === 0 ? 'rgba(234, 179, 8, 0.85)' : 'rgba(253, 230, 138, 0.45)';
          ctx.lineWidth = w === 0 ? 3 : 2;
          for (let x = 0; x <= waveW; x += 8) {
            const env = Math.sin((x / waveW) * Math.PI);
            const amp = (14 + mid * 30) * env;
            const y = waveMidY + Math.sin(x * 0.032 + t * (2.2 + w * 0.8)) * amp;
            if (x === 0) ctx.moveTo(waveStartX + x, y);
            else ctx.lineTo(waveStartX + x, y);
          }
          ctx.stroke();
        }
      } else {
        const bars = 36;
        const bw = 9;
        const gap = 5;
        for (let i = 0; i < bars; i++) {
          const v =
            bins && bins.length > 0
              ? bins[i % bins.length] / 255
              : isPlaying
                ? 0.22 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 5.2 + i * 0.42), 2)
                : 0.12;
          const bh = 12 + v * 78;
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.roundRect(waveStartX + i * (bw + gap), waveMidY - bh * 0.5, bw, bh, 4);
          ctx.fill();
        }
      }
    }

      ctx.restore();
      texture.needsUpdate = true;
    },
    [bpm, ctx, isPlaying, pulseIntensity, style, texture, trackAccentHex, trackArtist, trackTitle]
  );

  useEffect(() => {
    coverLoadedRef.current = false;
    if (!trackCoverUrl) {
      coverImgRef.current = null;
      drawFrame(0);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      coverImgRef.current = img;
      coverLoadedRef.current = true;
      drawFrame(0);
    };
    img.onerror = () => {
      coverImgRef.current = null;
      coverLoadedRef.current = false;
      drawFrame(0);
    };
    img.src = trackCoverUrl;
  }, [drawFrame, trackCoverUrl]);

  useEffect(() => {
    drawFrame(0);
  }, [drawFrame]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useFrame(({ clock }) => {
    if (!isActive || !isPlaying) return;
    const nowMs = performance.now();
    if (nowMs - lastDrawMsRef.current < 66) return;
    lastDrawMsRef.current = nowMs;
    drawFrame(clock.getElapsedTime());
  });

  return texture;
}

export function SceneReadySignal({
  onReady,
  active = true
}: {
  onReady?: () => void;
  active?: boolean;
}) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (!active || !onReady || firedRef.current) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        firedRef.current = true;
        onReady();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [active, onReady]);
  return null;
}

/**
 * Procedural Room-Specific Equirectangular Environment Lightformer Rig
 * Zero external HDRI files required — generates rich specular reflections per room
 */
function ProceduralRoomEnvironment({
  preset,
  bgHex,
  intensity
}: {
  preset: RoomEnvironmentPreset;
  bgHex: string;
  intensity: number;
}) {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={intensity}>
      <color attach="background" args={[bgHex]} />
      {preset === 'cafe' && (
        <>
          <Lightformer form="rect" intensity={3.6} color="#fff7e6" position={[-5.5, 4.0, -1.2]} rotation={[0, Math.PI / 2, 0]} scale={[7.5, 4.2, 1]} />
          <Lightformer form="ring" intensity={2.6} color="#ffe2a6" position={[0.2, 4.2, -2.5]} rotation={[Math.PI / 2, 0, 0]} scale={[2.6, 2.6, 1]} />
          <Lightformer form="rect" intensity={2.0} color="#ebd9c0" position={[0, 3.2, 4.8]} rotation={[0, Math.PI, 0]} scale={[9, 4.2, 1]} />
          <Lightformer form="rect" intensity={1.35} color="#8c7760" position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[14, 14, 1]} />
        </>
      )}
      {preset === 'party' && (
        <>
          <Lightformer form="rect" intensity={1.45} color="#f8fafc" position={[0, 5.4, -3]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 0.45, 1]} />
          <Lightformer form="rect" intensity={0.85} color="#e2e8f0" position={[0, 5.4, 1.5]} rotation={[Math.PI / 2, 0, 0]} scale={[7, 0.3, 1]} />
          <Lightformer form="rect" intensity={0.7} color="#cbd5e1" position={[-5.2, 3.6, -2]} rotation={[0, Math.PI / 2, 0]} scale={[9, 0.35, 1]} />
          <Lightformer form="rect" intensity={0.7} color="#cbd5e1" position={[5.2, 3.6, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[9, 0.35, 1]} />
          <Lightformer form="rect" intensity={0.48} color="#f1f5f9" position={[0, 3.2, -7.5]} rotation={[0, 0, 0]} scale={[6, 1.8, 1]} />
        </>
      )}
      {preset === 'library' && (
        <>
          <Lightformer form="rect" intensity={2.6} color="#ffe4a8" position={[0, 5.5, -1]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 4, 1]} />
          <Lightformer form="ring" intensity={2.4} color="#ffaa44" position={[-3.0, 4.5, -0.5]} rotation={[Math.PI / 2, 0, 0]} scale={[2.2, 2.2, 1]} />
          <Lightformer form="ring" intensity={2.4} color="#ffaa44" position={[3.0, 4.5, -0.5]} rotation={[Math.PI / 2, 0, 0]} scale={[2.2, 2.2, 1]} />
          <Lightformer form="rect" intensity={1.35} color="#10b981" position={[0, 1.2, 1]} rotation={[-Math.PI / 2, 0, 0]} scale={[8, 6, 1]} />
        </>
      )}
      {preset === 'podcast' && (
        <>
          <Lightformer form="rect" intensity={2.8} color="#fff1e0" position={[-1.8, 3.4, -1.5]} rotation={[Math.PI / 2, 0, 0]} scale={[2.2, 1.4, 1]} />
          <Lightformer form="rect" intensity={2.8} color="#fff1e0" position={[1.8, 3.4, -1.5]} rotation={[Math.PI / 2, 0, 0]} scale={[2.2, 1.4, 1]} />
          <Lightformer form="rect" intensity={1.7} color="#38bdf8" position={[3.8, 1.8, -1.5]} rotation={[0, -Math.PI / 2, 0]} scale={[5, 2.2, 1]} />
          <Lightformer form="rect" intensity={1.7} color="#ff9933" position={[-3.8, 1.8, -1.5]} rotation={[0, Math.PI / 2, 0]} scale={[5, 2.2, 1]} />
        </>
      )}
    </Environment>
  );
}

function CanvasExposureSync({ exposure }: { exposure: number }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [exposure, gl]);
  return null;
}

export function RoomCanvasFrame({
  roomPreset = 'cafe',
  bgHex = '#0a090c',
  fogDensity = 0.0085,
  ambientColor = '#2a1d14',
  ambientIntensity = 0.24,
  lightingFxMode,
  envIntensity = 0.42,
  initialCam,
  lightingCalibration,
  children
}: {
  roomPreset?: RoomEnvironmentPreset;
  bgHex?: string;
  fogDensity?: number;
  ambientColor?: string;
  ambientIntensity?: number;
  lightingFxMode: RoomLightingFxMode;
  envIntensity?: number;
  initialCam: CameraPresetConfig;
  lightingCalibration?: RoomLightingCalibration;
  children: React.ReactNode;
}) {
  const swGl = useMemo(() => isSoftwareWebGL(), []);
  const isMobile = useMemo(
    () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    []
  );
  const effAmbientColor = lightingCalibration?.ambientColor ?? ambientColor;
  const effAmbientInt = lightingCalibration?.ambientIntensity ?? ambientIntensity;
  const effFog = lightingCalibration?.fogDensity ?? fogDensity;
  const effEnvInt = lightingCalibration?.envIntensity ?? envIntensity;
  const effExposure = lightingCalibration?.exposure ?? 1.0;
  const effBloomInt =
    lightingCalibration?.bloomIntensity ?? (lightingFxMode === 'neon_laser' ? 0.34 : 0.22);
  const effBloomThresh = lightingCalibration?.bloomThreshold ?? 1.25;
  const effVignette = lightingCalibration?.vignetteDarkness ?? 0.48;

  return (
    <RoomErrorBoundary
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-[#09080b] text-xs text-[#CBD5E1]">
          3D Room Scene Loading...
        </div>
      }
    >
      <Canvas
        shadows="soft"
        dpr={swGl ? 1 : [1, 1.75]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.NoToneMapping,
          toneMappingExposure: effExposure
        }}
        camera={{ position: initialCam.position, fov: initialCam.fov, near: 0.1, far: 120 }}
        className="w-full h-full touch-none"
      >
        <CanvasExposureSync exposure={effExposure} />
        <color attach="background" args={[bgHex]} />
        <fogExp2 attach="fog" args={[bgHex, effFog]} />
        <ambientLight color={effAmbientColor} intensity={effAmbientInt} />

        <ProceduralRoomEnvironment preset={roomPreset} bgHex={bgHex} intensity={effEnvInt} />

        {children}

        <EffectComposer multisampling={swGl || isMobile ? 0 : 4}>
          <N8AO
            aoRadius={0.78}
            intensity={1.95}
            distanceFalloff={1.0}
            quality={swGl || isMobile ? 'performance' : 'medium'}
            halfRes={swGl || isMobile}
            enabled={!swGl}
          />
          <Bloom
            mipmapBlur={true}
            luminanceThreshold={effBloomThresh}
            intensity={effBloomInt}
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette eskil={false} offset={0.2} darkness={effVignette} />
        </EffectComposer>
      </Canvas>
    </RoomErrorBoundary>
  );
}

export type SharedCanvasRoomId = 'cafe' | 'party' | 'audiobook' | 'podcast';

const SHARED_ROOM_ATMOSPHERE: Record<
  SharedCanvasRoomId,
  {
    envPreset: RoomEnvironmentPreset;
    bgHex: string;
    fogDensity: number;
    ambientColor: string;
    ambientIntensity: number;
    envIntensity: number;
    exposure: number;
    bloomIntensity: number;
    bloomThreshold: number;
    vignetteDarkness: number;
  }
> = {
  cafe: {
    envPreset: 'cafe',
    bgHex: '#18120d',
    fogDensity: 0.0085,
    ambientColor: '#2a1d14',
    ambientIntensity: 0.24,
    envIntensity: 0.42,
    exposure: 1.02,
    bloomIntensity: 0.2,
    bloomThreshold: 1.25,
    vignetteDarkness: 0.48
  },
  party: {
    envPreset: 'party',
    bgHex: '#020203',
    fogDensity: 0.044,
    ambientColor: '#050608',
    ambientIntensity: 0.08,
    envIntensity: 0.1,
    exposure: 0.98,
    bloomIntensity: 0.32,
    bloomThreshold: 1.15,
    vignetteDarkness: 0.62
  },
  audiobook: {
    envPreset: 'library',
    bgHex: '#120b06',
    fogDensity: 0.0055,
    ambientColor: '#1f150c',
    ambientIntensity: 0.22,
    envIntensity: 0.36,
    exposure: 1.0,
    bloomIntensity: 0.22,
    bloomThreshold: 1.25,
    vignetteDarkness: 0.5
  },
  podcast: {
    envPreset: 'podcast',
    bgHex: '#0c0d12',
    fogDensity: 0.004,
    ambientColor: '#181922',
    ambientIntensity: 0.2,
    envIntensity: 0.38,
    exposure: 1.0,
    bloomIntensity: 0.2,
    bloomThreshold: 1.3,
    vignetteDarkness: 0.46
  }
};

function SharedReflectorFloor({
  activeRoom,
  swGl
}: {
  activeRoom: SharedCanvasRoomId;
  swGl: boolean;
}) {
  const cafeFloor = usePolyHavenPBR('hinoki_planks', 5, 7);
  const partyFloor = usePolyHavenPBR('metal_plate', 6, 7);
  const woodFloor = usePolyHavenPBR('brown_planks_07', 5, 7);

  const floorConfig = useMemo(() => {
    switch (activeRoom) {
      case 'party':
        return {
          tex: partyFloor,
          normalScale: 0.65,
          mixStrength: 1.05,
          mirror: 0.34,
          roughness: 0.32,
          color: '#282d38',
          metalness: 0.72
        };
      case 'audiobook':
        return {
          tex: woodFloor,
          normalScale: 0.7,
          mixStrength: 1.5,
          mirror: 0.45,
          roughness: 0.36,
          color: '#c9a684',
          metalness: 0.1
        };
      case 'podcast':
        return {
          tex: woodFloor,
          normalScale: 0.7,
          mixStrength: 1.45,
          mirror: 0.45,
          roughness: 0.36,
          color: '#a8876d',
          metalness: 0.1
        };
      case 'cafe':
      default:
        return {
          tex: cafeFloor,
          normalScale: 0.75,
          mixStrength: 0.32,
          mirror: 0.05,
          roughness: 0.8,
          color: '#e6d7c3',
          metalness: 0.04
        };
    }
  }, [activeRoom, cafeFloor, partyFloor, woodFloor]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.2]} receiveShadow>
      <planeGeometry args={[16.5, 20.5]} />
      <MeshReflectorMaterial
        map={floorConfig.tex.map}
        normalMap={floorConfig.tex.normalMap}
        normalScale={new THREE.Vector2(floorConfig.normalScale, floorConfig.normalScale)}
        roughnessMap={floorConfig.tex.roughnessMap}
        resolution={swGl ? 128 : 512}
        blur={[180, 60]}
        mixBlur={1}
        mixStrength={floorConfig.mixStrength}
        mirror={floorConfig.mirror}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        depthScale={1.2}
        roughness={floorConfig.roughness}
        color={floorConfig.color}
        metalness={floorConfig.metalness}
      />
    </mesh>
  );
}

export function SharedRoomsCanvas({
  activeRoom,
  isHostVisible,
  visitedRooms,
  cameraPreset,
  lightingFxMode,
  moveInputRef,
  activeCameraSpec,
  lightingCalibration,
  renderRoom
}: {
  activeRoom: SharedCanvasRoomId;
  isHostVisible: boolean;
  visitedRooms: SharedCanvasRoomId[];
  cameraPreset: RoomCameraPreset;
  lightingFxMode: RoomLightingFxMode;
  moveInputRef: React.MutableRefObject<RoomMoveInput>;
  activeCameraSpec: RoomCameraSpec;
  lightingCalibration?: RoomLightingCalibration;
  renderRoom: (roomId: SharedCanvasRoomId, isActive: boolean, manifest: ConcertAssetManifest | null) => React.ReactNode;
}) {
  const swGl = useMemo(() => isSoftwareWebGL(), []);
  const isMobile = useMemo(
    () => typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
    []
  );
  const manifest = useConcertAssetManifest();
  const atmo = SHARED_ROOM_ATMOSPHERE[activeRoom];
  const initialCam = activeCameraSpec[cameraPreset] || activeCameraSpec.cinematic;

  const effAmbientColor = lightingCalibration?.ambientColor ?? atmo.ambientColor;
  const effAmbientInt = lightingCalibration?.ambientIntensity ?? atmo.ambientIntensity;
  const effFog = lightingCalibration?.fogDensity ?? atmo.fogDensity;
  const effEnvInt = lightingCalibration?.envIntensity ?? atmo.envIntensity;
  const effExposure = lightingCalibration?.exposure ?? atmo.exposure;
  const effBloomInt =
    lightingCalibration?.bloomIntensity ??
    (lightingFxMode === 'neon_laser' ? Math.max(atmo.bloomIntensity, 0.34) : atmo.bloomIntensity);
  const effBloomThresh = lightingCalibration?.bloomThreshold ?? atmo.bloomThreshold;
  const effVignette = lightingCalibration?.vignetteDarkness ?? atmo.vignetteDarkness;

  return (
    <RoomErrorBoundary
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-[#09080b] text-xs text-[#CBD5E1]">
          3D Room Scene Loading...
        </div>
      }
    >
      <Canvas
        frameloop={isHostVisible ? 'always' : 'never'}
        shadows="soft"
        dpr={swGl ? 1 : [1, 1.75]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.NoToneMapping,
          toneMappingExposure: effExposure
        }}
        camera={{ position: initialCam.position, fov: initialCam.fov, near: 0.1, far: 120 }}
        className="w-full h-full touch-none"
      >
        <CanvasExposureSync exposure={effExposure} />
        <color attach="background" args={[atmo.bgHex]} />
        <fogExp2 attach="fog" args={[atmo.bgHex, effFog]} />
        <ambientLight color={effAmbientColor} intensity={effAmbientInt} />

        <ProceduralRoomEnvironment
          key={atmo.envPreset}
          preset={atmo.envPreset}
          bgHex={atmo.bgHex}
          intensity={effEnvInt}
        />

        <LockedSymmetricalCameraRig
          cameraPreset={cameraPreset}
          moveInputRef={moveInputRef}
          spec={activeCameraSpec}
          roomKey={activeRoom}
        />

        <SharedReflectorFloor activeRoom={activeRoom} swGl={swGl || isMobile} />

        {visitedRooms.map((rId) => {
          const isRoomActive = isHostVisible && activeRoom === rId;
          return (
            <group key={rId} visible={isRoomActive}>
              {renderRoom(rId, isRoomActive, manifest)}
            </group>
          );
        })}

        <EffectComposer multisampling={swGl || isMobile ? 0 : 4}>
          <N8AO
            aoRadius={0.78}
            intensity={1.95}
            distanceFalloff={1.0}
            quality={swGl || isMobile ? 'performance' : 'medium'}
            halfRes={swGl || isMobile}
            enabled={!swGl}
          />
          <Bloom
            mipmapBlur={true}
            luminanceThreshold={effBloomThresh}
            intensity={effBloomInt}
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette eskil={false} offset={0.2} darkness={effVignette} />
        </EffectComposer>
      </Canvas>
    </RoomErrorBoundary>
  );
}
