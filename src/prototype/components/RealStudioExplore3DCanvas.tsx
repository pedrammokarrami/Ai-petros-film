import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { djAudioController } from '../djAudioEngine';
import type { PrototypeMediaItem } from '../types';
import {
  disposeObject3DTree,
  loadStudioSlotGlb,
  STUDIO_GLB_SLOTS
} from './studioGlbLoader';
import { getPolyHavenPBR } from '../../scenes/shared/polyhavenTextures';
import {
  loadCachedHDRTexture,
  scheduleIdleRoomAssetWarming
} from '../../services/roomAssetPreloader';

export type StudioCameraPreset = 'desk_studio' | 'cassette_deck' | 'notebook_focus';

export interface TapeEditState {
  speed: number; // 0.75 .. 1.25
  warmth: number; // 0 .. 1
  echo: number; // 0 .. 1
  isSideB: boolean;
  editedLabel?: string;
}

export interface RealStudioExplore3DCanvasProps {
  tapes: PrototypeMediaItem[];
  selectedTapeId: string;
  isPlaying: boolean;
  cameraPreset: StudioCameraPreset;
  tapeEdits: Record<string, TapeEditState>;
  flipSeq: number;
  rewindSeq: number;
  stampSeq: number;
  isActive?: boolean;
  onSelectTape: (tapeId: string) => void;
  onTogglePlay: () => void;
  onInteractProp?: (prop: 'deck' | 'notebook' | 'headphones' | 'orb') => void;
}

const DEFAULT_EDIT: TapeEditState = {
  speed: 1.0,
  warmth: 0.25,
  echo: 0.2,
  isSideB: false
};

// Module-level reusable math helpers (zero GC inside animation loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _quatA = new THREE.Quaternion();
const _quatB = new THREE.Quaternion();
const _eulerTmp = new THREE.Euler();

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(5, 4, 3, 0.72)');
  grad.addColorStop(0.5, 'rgba(8, 6, 4, 0.34)');
  grad.addColorStop(1, 'rgba(8, 6, 4, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createGlowHaloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 4, 128, 128, 126);
  grad.addColorStop(0, 'rgba(255, 240, 195, 0.95)');
  grad.addColorStop(0.24, 'rgba(255, 196, 98, 0.52)');
  grad.addColorStop(0.55, 'rgba(245, 145, 48, 0.16)');
  grad.addColorStop(1, 'rgba(245, 130, 32, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDarkMarbleTextures(maxAnisotropy: number) {
  const albedoCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  albedoCanvas.width = roughCanvas.width = bumpCanvas.width = 1024;
  albedoCanvas.height = roughCanvas.height = bumpCanvas.height = 1024;
  const ctx = albedoCanvas.getContext('2d')!;
  const rCtx = roughCanvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#0d0e11';
  ctx.fillRect(0, 0, 1024, 1024);
  rCtx.fillStyle = '#2e2e2e';
  rCtx.fillRect(0, 0, 1024, 1024);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 1024, 1024);

  // Subtle natural mineral clouds
  for (let i = 0; i < 42; i++) {
    const gx = (i * 193) % 1024;
    const gy = (i * 317) % 1024;
    const rad = 110 + (i % 5) * 45;
    const grad = ctx.createRadialGradient(gx, gy, 12, gx, gy, rad);
    grad.addColorStop(0, i % 2 === 0 ? 'rgba(34, 30, 28, 0.25)' : 'rgba(20, 22, 26, 0.28)');
    grad.addColorStop(1, 'rgba(12, 12, 14, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);
  }

  // Organic multi-branched Nero Marquina & gold veining
  for (let v = 0; v < 26; v++) {
    ctx.beginPath();
    rCtx.beginPath();
    bCtx.beginPath();
    let x = (v * 79) % 1024;
    let y = 0;
    ctx.moveTo(x, y);
    rCtx.moveTo(x, y);
    bCtx.moveTo(x, y);
    for (let step = 0; step < 34; step++) {
      x += Math.sin(step * 0.48 + v * 1.7) * 32 + Math.cos(step * 0.23 + v) * 14;
      y += 32;
      ctx.lineTo(x, y);
      rCtx.lineTo(x, y);
      bCtx.lineTo(x, y);
    }
    const isGold = v % 3 === 0;
    ctx.strokeStyle = isGold ? 'rgba(226, 178, 98, 0.30)' : 'rgba(232, 226, 214, 0.16)';
    ctx.lineWidth = v % 5 === 0 ? 3.0 : 1.1;
    ctx.stroke();

    rCtx.strokeStyle = 'rgba(130, 130, 130, 0.35)';
    rCtx.lineWidth = 2.4;
    rCtx.stroke();

    bCtx.strokeStyle = 'rgba(155, 155, 155, 0.24)';
    bCtx.lineWidth = 2.0;
    bCtx.stroke();
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1.6, 1.2);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = maxAnisotropy;
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(1.6, 1.2);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(1.6, 1.2);

  return { map, roughnessMap, bumpMap };
}

function createWalnutWoodTexture(maxAnisotropy: number) {
  const canvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');
  canvas.width = bumpCanvas.width = 512;
  canvas.height = bumpCanvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const bCtx = bumpCanvas.getContext('2d')!;
  ctx.fillStyle = '#382215';
  ctx.fillRect(0, 0, 512, 512);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 120; i++) {
    const y = (i / 120) * 512;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(20, 10, 5, 0.42)' : 'rgba(96, 61, 36, 0.24)';
    ctx.lineWidth = 1.2 + (i % 4);
    bCtx.strokeStyle = i % 2 === 0 ? 'rgba(100,100,100,0.3)' : 'rgba(155,155,155,0.22)';
    bCtx.lineWidth = 1.2;
    ctx.beginPath();
    bCtx.beginPath();
    ctx.moveTo(0, y);
    bCtx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 24) {
      const wave = Math.sin(x * 0.02 + i * 0.45) * 4.5;
      ctx.lineTo(x, y + wave);
      bCtx.lineTo(x, y + wave);
    }
    ctx.stroke();
    bCtx.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

function createBrushedMetalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 2) {
    const shade = 108 + ((y * 37) % 38);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(0, y, 512, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Photorealistic layered twilight sunset skyline backdrop with atmospheric depth haze,
 * glowing sunset clouds, and soft circular city bokeh (zero blocky square pixels).
 */
function createTwilightSkylineTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d')!;

  // Rich dusk sky gradient: deep twilight slate -> lavender mauve -> burnished amber sunset
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 900);
  skyGrad.addColorStop(0.0, '#121826');
  skyGrad.addColorStop(0.28, '#283349');
  skyGrad.addColorStop(0.48, '#584b5c');
  skyGrad.addColorStop(0.64, '#a66d58');
  skyGrad.addColorStop(0.79, '#eb9f5c');
  skyGrad.addColorStop(0.92, '#d87b44');
  skyGrad.addColorStop(1.0, '#1b1412');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1600, 900);

  // Soft sunlit sunset core behind center-left towers
  const sunGlow = ctx.createRadialGradient(540, 620, 20, 540, 620, 560);
  sunGlow.addColorStop(0, 'rgba(255, 236, 185, 0.85)');
  sunGlow.addColorStop(0.32, 'rgba(255, 186, 102, 0.42)');
  sunGlow.addColorStop(0.7, 'rgba(220, 118, 72, 0.16)');
  sunGlow.addColorStop(1, 'rgba(220, 118, 72, 0)');
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, 1600, 900);

  // Painterly golden-edged sunset cloud bands
  for (let c = 0; c < 18; c++) {
    const cx = ((c * 173 + 60) % 1540);
    const cy = 220 + (c % 5) * 58;
    const rx = 180 + (c % 4) * 90;
    const ry = 22 + (c % 3) * 14;
    const cGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, rx);
    cGrad.addColorStop(0, c % 2 === 0 ? 'rgba(255, 198, 132, 0.24)' : 'rgba(62, 54, 72, 0.26)');
    cGrad.addColorStop(1, 'rgba(62, 54, 72, 0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = cGrad;
    ctx.fillRect(cx - rx, cy - rx, rx * 2, rx * 2);
    ctx.restore();
  }

  // Layer 1: Distant hazy skyline (atmospheric perspective, soft muted warm slate)
  for (let i = 0; i < 34; i++) {
    const bw = 34 + ((i * 23) % 44);
    const bh = 120 + ((i * 59) % 210);
    const bx = i * 48 - 10;
    const by = 780 - bh;
    const bGrad = ctx.createLinearGradient(0, by, 0, 780);
    bGrad.addColorStop(0, 'rgba(68, 56, 62, 0.56)');
    bGrad.addColorStop(1, 'rgba(130, 88, 66, 0.35)');
    ctx.fillStyle = bGrad;
    ctx.fillRect(bx, by, bw, bh);
  }

  // Layer 2: Mid-ground skyscrapers with realistic stepped tops, spires & soft glass reflection streaks
  const towers = [
    { x: 30, w: 72, h: 250, spire: 0 },
    { x: 112, w: 64, h: 310, spire: 34 },
    { x: 190, w: 86, h: 220, spire: 0 },
    { x: 292, w: 76, h: 350, spire: 48 },
    { x: 382, w: 94, h: 280, spire: 0 },
    { x: 492, w: 68, h: 395, spire: 62 },
    { x: 576, w: 82, h: 295, spire: 0 },
    { x: 678, w: 98, h: 425, spire: 78 }, // landmark stepped tower
    { x: 794, w: 74, h: 270, spire: 0 },
    { x: 888, w: 90, h: 345, spire: 30 },
    { x: 996, w: 70, h: 245, spire: 0 },
    { x: 1084, w: 88, h: 370, spire: 44 },
    { x: 1188, w: 78, h: 290, spire: 0 },
    { x: 1284, w: 92, h: 340, spire: 28 },
    { x: 1394, w: 74, h: 260, spire: 0 },
    { x: 1484, w: 96, h: 315, spire: 0 }
  ];

  for (const t of towers) {
    const topY = 820 - t.h;
    const tGrad = ctx.createLinearGradient(t.x, topY, t.x + t.w, 820);
    tGrad.addColorStop(0, 'rgba(26, 28, 38, 0.92)');
    tGrad.addColorStop(0.65, 'rgba(30, 26, 32, 0.95)');
    tGrad.addColorStop(1, 'rgba(18, 16, 20, 0.98)');
    ctx.fillStyle = tGrad;
    ctx.fillRect(t.x, topY, t.w, t.h + 80);

    // Architectural stepped crown + needle spire
    if (t.spire > 0) {
      ctx.fillRect(t.x + t.w * 0.16, topY - 22, t.w * 0.68, 22);
      ctx.fillRect(t.x + t.w * 0.34, topY - 40, t.w * 0.32, 18);
      ctx.fillRect(t.x + t.w * 0.49, topY - 40 - t.spire, 3, t.spire);
    }

    // Subtle golden rim-light along side facing sunset
    const rimGrad = ctx.createLinearGradient(t.x, topY, t.x + 8, topY);
    rimGrad.addColorStop(0, 'rgba(255, 198, 128, 0.28)');
    rimGrad.addColorStop(1, 'rgba(255, 198, 128, 0)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(t.x, topY, 8, t.h);

    // Subtle micro-slit architectural glass lines + delicate bokeh lights (tiny, realistic!)
    for (let wy = topY + 18; wy < 790; wy += 12) {
      for (let wx = t.x + 9; wx < t.x + t.w - 9; wx += 9) {
        const hash = Math.sin(wx * 19.31 + wy * 71.97) * 43758.5453;
        const frac = hash - Math.floor(hash);
        if (frac > 0.72) {
          const glowR = frac > 0.92 ? 4.5 : 2.6;
          const lGrad = ctx.createRadialGradient(wx, wy, 0.3, wx, wy, glowR);
          lGrad.addColorStop(
            0,
            frac > 0.92 ? 'rgba(255, 228, 168, 0.85)' : 'rgba(242, 188, 112, 0.48)'
          );
          lGrad.addColorStop(1, 'rgba(242, 188, 112, 0)');
          ctx.fillStyle = lGrad;
          ctx.beginPath();
          ctx.arc(wx, wy, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Horizon atmospheric sunset mist blanket blending city base smoothly into window sill
  const mistGrad = ctx.createLinearGradient(0, 620, 0, 900);
  mistGrad.addColorStop(0, 'rgba(235, 152, 88, 0)');
  mistGrad.addColorStop(0.55, 'rgba(210, 128, 74, 0.22)');
  mistGrad.addColorStop(1, 'rgba(18, 14, 12, 0.95)');
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, 620, 1600, 280);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function drawCassetteLabelCanvas(
  canvas: HTMLCanvasElement,
  item: PrototypeMediaItem,
  side: 'A' | 'B',
  editState: TapeEditState
) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const accent = item.accentHex || '#F5B942';

  ctx.fillStyle = side === 'A' ? '#f4ede0' : '#181b22';
  ctx.fillRect(0, 0, w, h);

  // Subtle paper grain
  ctx.fillStyle = side === 'A' ? 'rgba(120, 95, 65, 0.04)' : 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 40; i++) {
    ctx.fillRect((i * 73) % w, (i * 41) % h, 3, 2);
  }

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, w, 60);

  ctx.fillStyle = side === 'A' ? 'rgba(25,20,16,0.2)' : 'rgba(255,255,255,0.18)';
  ctx.fillRect(16, 68, w - 32, 2);

  ctx.fillStyle = '#141210';
  ctx.fillRect(16, 13, 44, 34);
  ctx.fillStyle = '#fef6e4';
  ctx.font = 'bold 24px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(side, 38, 31);

  ctx.fillStyle = '#0c0b09';
  ctx.font = 'bold 21px Changa, Montserrat, sans-serif';
  ctx.textAlign = 'right';
  const artistLabel = (item.creatorFa || item.creatorEn || item.sourceName).slice(0, 30);
  try {
    ctx.direction = 'rtl';
  } catch {
    // ignore
  }
  ctx.fillText(artistLabel, w - 20, 31);

  ctx.fillStyle = side === 'A' ? '#1f1a16' : '#f4ede0';
  ctx.font = 'bold 19px Changa, Montserrat, sans-serif';
  ctx.fillText((item.titleFa || item.titleEn).slice(0, 32), w - 20, 94);

  ctx.strokeStyle = side === 'A' ? 'rgba(130, 108, 86, 0.25)' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(16, 200);
  ctx.lineTo(w - 16, 200);
  ctx.moveTo(16, 226);
  ctx.lineTo(w - 16, 226);
  ctx.stroke();

  try {
    ctx.direction = 'ltr';
  } catch {
    // ignore
  }
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px "Courier Prime", monospace';
  ctx.fillStyle = side === 'A' ? '#574a3d' : '#cbd5e1';
  const bpmTxt = `${Math.round((item.bpm || 110) * editState.speed)} BPM · ${item.musicalKey || 'Cm'} · ${editState.speed.toFixed(2)}x`;
  ctx.fillText(bpmTxt, 20, 214);

  ctx.textAlign = 'right';
  ctx.font = 'bold 14px Montserrat, sans-serif';
  ctx.fillStyle = side === 'A' ? '#855814' : accent;
  ctx.fillText(
    side === 'A' ? 'AIPETROS CHROME II · 90M' : 'TAPE EDIT / B-SIDE',
    w - 20,
    214
  );

  const isEdited =
    editState.editedLabel ||
    Math.abs(editState.speed - 1) > 0.02 ||
    Math.abs(editState.warmth - 0.25) > 0.05 ||
    Math.abs(editState.echo - 0.2) > 0.05 ||
    editState.isSideB;

  if (isEdited) {
    ctx.save();
    ctx.translate(w - 92, 146);
    ctx.rotate(-0.14);
    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-62, -16, 124, 32);
    ctx.fillStyle = '#c2410c';
    ctx.font = 'bold 14px "Courier Prime", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(editState.editedLabel || 'MASTER EDITED', 0, 1);
    ctx.restore();
  }
}

function drawNotebookCanvas(
  canvas: HTMLCanvasElement,
  item: PrototypeMediaItem | undefined,
  editState: TapeEditState
) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#f5eedf';
  ctx.fillRect(0, 0, w, h);

  const spineGrad = ctx.createLinearGradient(w * 0.45, 0, w * 0.55, 0);
  spineGrad.addColorStop(0, 'rgba(0,0,0,0)');
  spineGrad.addColorStop(0.5, 'rgba(55,40,25,0.28)');
  spineGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = spineGrad;
  ctx.fillRect(w * 0.44, 0, w * 0.12, h);

  ctx.strokeStyle = 'rgba(120, 138, 165, 0.24)';
  ctx.lineWidth = 1.2;
  for (let y = 56; y < h - 24; y += 28) {
    ctx.beginPath();
    ctx.moveTo(26, y);
    ctx.lineTo(w * 0.46, y);
    ctx.moveTo(w * 0.54, y);
    ctx.lineTo(w - 26, y);
    ctx.stroke();
  }

  try {
    ctx.direction = 'ltr';
  } catch {
    // ignore
  }
  ctx.fillStyle = '#7c2d12';
  ctx.font = 'bold 20px "Courier Prime", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('STUDIO TAPE SESSION LOG', 34, 42);

  if (item) {
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 17px "Courier Prime", monospace';
    ctx.fillText(`KEY: ${item.musicalKey || 'Cm'}`, 34, 96);
    ctx.fillText(`TEMPO: ${Math.round((item.bpm || 110) * editState.speed)} BPM`, 34, 124);
    ctx.fillText(`SIDE: ${editState.isSideB ? 'SIDE B (EDIT)' : 'SIDE A (ORIG)'}`, 34, 152);
    ctx.fillText(`SPEED: ${editState.speed.toFixed(2)}x`, 34, 180);
    ctx.fillText(`WARMTH: ${Math.round(editState.warmth * 100)}%`, 34, 208);
    ctx.fillText(`ECHO: ${Math.round(editState.echo * 100)}%`, 34, 236);

    ctx.fillStyle = '#475569';
    ctx.font = 'italic 15px Amiri, serif';
    ctx.fillText('i  -  VI  -  III  -  VII   [Analog Bias]', 34, 294);
    ctx.fillText('Master Tape Calibration Verified ✓', 34, 326);
  }

  try {
    ctx.direction = 'rtl';
  } catch {
    // ignore
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 21px Changa, sans-serif';
  ctx.fillText('دفترچه استودیو · یادداشت خواننده', w - 34, 42);

  if (item) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px Changa, sans-serif';
    ctx.fillText((item.creatorFa || item.creatorEn || item.sourceName).slice(0, 26), w - 34, 96);

    ctx.fillStyle = '#334155';
    ctx.font = '17px Changa, sans-serif';
    ctx.fillText((item.titleFa || item.titleEn).slice(0, 28), w - 34, 134);

    ctx.fillStyle = '#475569';
    ctx.font = '15px Changa, sans-serif';
    ctx.fillText(
      editState.isSideB
        ? 'حالت فعال: روی B (میکس و ادیت آنالوگ)'
        : 'حالت فعال: روی A (مستر اصلی استودیو)',
      w - 34,
      180
    );
    ctx.fillText(
      `سرعت ${editState.speed.toFixed(2)}x · گرما ${Math.round(editState.warmth * 100)}٪`,
      w - 34,
      212
    );
  }
}

function createVuMeterCanvasTexture(maxAnisotropy: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(128, 120, 10, 128, 80, 155);
  grad.addColorStop(0, '#fff7dc');
  grad.addColorStop(0.55, '#f4cf7e');
  grad.addColorStop(1, '#a97128');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 140);

  ctx.strokeStyle = '#1f160e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(128, 146, 102, Math.PI * 1.18, Math.PI * 1.66);
  ctx.stroke();

  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 146, 102, Math.PI * 1.66, Math.PI * 1.82);
  ctx.stroke();

  ctx.fillStyle = '#1f160e';
  ctx.font = 'bold 16px "Courier Prime", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VU', 128, 92);
  ctx.font = 'bold 11px "Courier Prime", monospace';
  ctx.fillText('-20   -7   0   +3dB', 128, 62);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

interface CassetteRuntimeRef {
  id: string;
  item: PrototypeMediaItem;
  group: THREE.Group;
  leftReel: THREE.Object3D;
  rightReel: THREE.Object3D;
  labelCanvasA: HTMLCanvasElement;
  labelCanvasB: HTMLCanvasElement;
  labelTexA: THREE.CanvasTexture;
  labelTexB: THREE.CanvasTexture;
  restPos: THREE.Vector3;
  restRot: THREE.Euler;
  hitBox: THREE.Mesh;
}

function getResponsiveCameraSpec(
  preset: StudioCameraPreset,
  aspect: number
): { pos: [number, number, number]; target: [number, number, number]; fov: number } {
  const isPortrait = aspect < 0.85;
  if (preset === 'cassette_deck') {
    return isPortrait
      ? { pos: [0.44, 1.48, 1.92], target: [0.56, 1.02, -0.32], fov: 42 }
      : { pos: [0.38, 1.42, 1.54], target: [0.56, 1.02, -0.32], fov: 38 };
  }
  if (preset === 'notebook_focus') {
    return isPortrait
      ? { pos: [-0.82, 1.85, 1.85], target: [-0.88, 0.78, 0.28], fov: 44 }
      : { pos: [-0.76, 1.72, 1.52], target: [-0.88, 0.78, 0.28], fov: 40 };
  }
  // Full desk vista framed cleanly for both 9:16 mobile portrait and wide desktop
  return isPortrait
    ? { pos: [0, 2.32, 4.95], target: [0, 0.92, -0.15], fov: 48 }
    : { pos: [0, 2.15, 3.85], target: [0, 0.94, -0.18], fov: 41 };
}

export function RealStudioExplore3DCanvas({
  tapes,
  selectedTapeId,
  isPlaying,
  cameraPreset,
  tapeEdits,
  flipSeq,
  rewindSeq,
  stampSeq,
  isActive = true,
  onSelectTape,
  onTogglePlay,
  onInteractProp
}: RealStudioExplore3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resumeLoopRef = useRef<(() => void) | null>(null);
  const [webglError, setWebglError] = useState(false);

  const propsRef = useRef({
    tapes,
    selectedTapeId,
    isPlaying,
    cameraPreset,
    tapeEdits,
    flipSeq,
    rewindSeq,
    stampSeq,
    isActive,
    onSelectTape,
    onTogglePlay,
    onInteractProp
  });
  propsRef.current = {
    tapes,
    selectedTapeId,
    isPlaying,
    cameraPreset,
    tapeEdits,
    flipSeq,
    rewindSeq,
    stampSeq,
    isActive,
    onSelectTape,
    onTogglePlay,
    onInteractProp
  };

  useEffect(() => {
    if (isActive) {
      resumeLoopRef.current?.();
    }
  }, [isActive]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || 390;
    const height = container.clientHeight || 640;
    const initialAspect = width / Math.max(1, height);

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const domEl = renderer.domElement;
    domEl.style.width = '100%';
    domEl.style.height = '100%';
    domEl.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(domEl);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    domEl.addEventListener('webglcontextlost', handleContextLost);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    const disposables: Array<{ dispose: () => void }> = [];
    const glbRoots: THREE.Object3D[] = [];
    let disposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#131012');
    scene.fog = new THREE.FogExp2('#181312', 0.028);

    // Immediate RoomEnvironment PMREM, upgraded via shared cached HDR DataTexture
    const pmrem = new THREE.PMREMGenerator(renderer);
    let currentEnvTarget: THREE.WebGLRenderTarget | null = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = currentEnvTarget.texture;
    scene.environmentIntensity = 0.58;

    void loadCachedHDRTexture('/hdr/studio_small_08_1k.hdr').then((cachedHdr) => {
      if (disposed || !cachedHdr) return;
      const hdriTarget = pmrem.fromEquirectangular(cachedHdr);
      const prev = currentEnvTarget;
      currentEnvTarget = hdriTarget;
      scene.environment = hdriTarget.texture;
      scene.environmentIntensity = 0.72;
      prev?.dispose();
    });
    scheduleIdleRoomAssetWarming();

    const initialSpec = getResponsiveCameraSpec(propsRef.current.cameraPreset, initialAspect);
    const camera = new THREE.PerspectiveCamera(initialSpec.fov, initialAspect, 0.1, 60);
    camera.position.set(...initialSpec.pos);

    const controls = new OrbitControls(camera, domEl);
    controls.target.set(...initialSpec.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minDistance = 1.35;
    controls.maxDistance = 6.8;
    controls.minPolarAngle = 0.42;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minAzimuthAngle = -Math.PI * 0.34;
    controls.maxAzimuthAngle = Math.PI * 0.34;

    // Post-processing Composer (HDR bloom on glowing orb filaments & VU needles + crisp OutputPass)
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.24, 0.55, 0.96);
      const outputPass = new OutputPass();
      composer.addPass(renderPass);
      composer.addPass(bloomPass);
      composer.addPass(outputPass);
    }

    let cameraTransitionActive = false;
    let lastCameraPreset: StudioCameraPreset = propsRef.current.cameraPreset;
    let currentAspect = initialAspect;

    const onControlStart = () => {
      cameraTransitionActive = false;
    };
    controls.addEventListener('start', onControlStart);

    // -------------------------------------------------------------------------
    // LIGHTING RIG (Golden-hour sunset rim + cool twilight skylight + orb key)
    // -------------------------------------------------------------------------
    const hemi = new THREE.HemisphereLight('#c8d8f0', '#231811', 0.44);
    scene.add(hemi);

    const sunKey = new THREE.DirectionalLight('#ffd199', 2.8);
    sunKey.position.set(-4.2, 4.4, -3.5);
    if (!isSoftwareGl) {
      sunKey.castShadow = true;
      sunKey.shadow.mapSize.set(1024, 1024);
      sunKey.shadow.camera.near = 0.5;
      sunKey.shadow.camera.far = 16;
      sunKey.shadow.camera.left = -4.0;
      sunKey.shadow.camera.right = 4.0;
      sunKey.shadow.camera.top = 3.5;
      sunKey.shadow.camera.bottom = -3.5;
      sunKey.shadow.bias = -0.0005;
      sunKey.shadow.normalBias = 0.02;
    }
    scene.add(sunKey);

    const frontFill = new THREE.DirectionalLight('#d8e6f8', 0.72);
    frontFill.position.set(2.8, 3.1, 4.6);
    scene.add(frontFill);

    const orbPointLight = new THREE.PointLight('#ffba59', 3.4, 5.2, 1.55);
    orbPointLight.position.set(-0.08, 1.24, -0.68);
    scene.add(orbPointLight);

    const shelfLampLight = new THREE.PointLight('#ffaa4b', 2.4, 6.5, 1.5);
    shelfLampLight.position.set(2.3, 2.2, -3.0);
    scene.add(shelfLampLight);

    // Shared Contact Shadow Helper Texture
    const shadowTex = createRadialShadowTexture();
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    });
    const shadowPlaneGeo = new THREE.PlaneGeometry(1, 1);
    disposables.push(shadowTex, contactShadowMat, shadowPlaneGeo);

    const addContactShadow = (x: number, y: number, z: number, sx: number, sz: number) => {
      const m = new THREE.Mesh(shadowPlaneGeo, contactShadowMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.scale.set(sx, sz, 1);
      scene.add(m);
      return m;
    };

    // -------------------------------------------------------------------------
    // ARCHITECTURAL PENTHOUSE BACKGROUND + REAL POLY HAVEN GLB ROOM FURNISHINGS
    // -------------------------------------------------------------------------
    const skylineTex = createTwilightSkylineTexture(maxAnisotropy);
    disposables.push(skylineTex);

    const skylineGeo = new THREE.CylinderGeometry(8.5, 8.5, 7.6, 36, 1, true, Math.PI * 0.72, Math.PI * 0.56);
    const skylineMat = new THREE.MeshBasicMaterial({
      map: skylineTex,
      side: THREE.BackSide
    });
    disposables.push(skylineGeo, skylineMat);
    const skylineDome = new THREE.Mesh(skylineGeo, skylineMat);
    skylineDome.position.set(0, 2.3, 1.6);
    scene.add(skylineDome);

    // Real Poly Haven PBR maps for Window Frame (metal_plate) & Wood Walls/Floor (brown_planks_07 & american_walnut_veneer)
    const windowMetalPBR = getPolyHavenPBR('metal_plate', 2, 4);
    const woodWallPBR = getPolyHavenPBR('brown_planks_07', 3, 2);
    const woodFloorPBR = getPolyHavenPBR('brown_planks_07', 5, 4);
    const studioWalnutPBR = getPolyHavenPBR('american_walnut_veneer', 2, 2);

    // Architectural Poly Haven Metal-Plated Window Mullions + Sill + Reflective Glass
    const mullionMat = new THREE.MeshStandardMaterial({
      map: windowMetalPBR.map,
      normalMap: windowMetalPBR.normalMap,
      roughnessMap: windowMetalPBR.roughnessMap,
      color: '#2c3038',
      roughness: 0.34,
      metalness: 0.86
    });
    const mullionGeo = new THREE.BoxGeometry(0.085, 6.2, 0.14);
    const sillGeo = new THREE.BoxGeometry(10.5, 0.16, 0.4);
    const transBarGeo = new THREE.BoxGeometry(10.5, 0.085, 0.14);
    const windowGlassGeo = new THREE.PlaneGeometry(10.2, 5.8);
    const windowGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#ffd9b3',
      roughness: 0.05,
      metalness: 0.05,
      transparent: true,
      opacity: 0.09,
      reflectivity: 0.92,
      depthWrite: false
    });
    disposables.push(mullionMat, mullionGeo, sillGeo, transBarGeo, windowGlassGeo, windowGlassMat);

    [-3.6, -1.8, 0, 1.8, 3.6].forEach((mx) => {
      const m = new THREE.Mesh(mullionGeo, mullionMat);
      m.position.set(mx, 2.3, -4.1);
      scene.add(m);
    });
    const transBar = new THREE.Mesh(transBarGeo, mullionMat);
    transBar.position.set(0, 3.45, -4.1);
    const windowSill = new THREE.Mesh(sillGeo, mullionMat);
    windowSill.position.set(0, 0.38, -4.05);
    const windowGlass = new THREE.Mesh(windowGlassGeo, windowGlassMat);
    windowGlass.position.set(0, 2.35, -4.14);
    scene.add(transBar, windowSill, windowGlass);

    // Velvet floor-to-ceiling drapery curtains framing left & right of penthouse window
    const curtainMat = new THREE.MeshStandardMaterial({
      color: '#2c2320',
      roughness: 0.9,
      metalness: 0.02
    });
    const curtainFoldGeo = new THREE.CylinderGeometry(0.16, 0.18, 5.8, 16);
    disposables.push(curtainMat, curtainFoldGeo);
    [-3.15, -2.92, -2.7, 2.7, 2.92, 3.15].forEach((cx, ci) => {
      const fold = new THREE.Mesh(curtainFoldGeo, curtainMat);
      fold.position.set(cx, 2.75, -3.9 + (ci % 2) * 0.05);
      scene.add(fold);
    });

    // Poly Haven Brown Hardwood Plank Studio Floor (brown_planks_07)
    const floorGeo = new THREE.PlaneGeometry(18, 14);
    const floorMat = new THREE.MeshStandardMaterial({
      map: woodFloorPBR.map,
      normalMap: woodFloorPBR.normalMap,
      roughnessMap: woodFloorPBR.roughnessMap,
      color: '#73533a',
      roughness: 0.56,
      metalness: 0.06
    });
    disposables.push(floorGeo, floorMat);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -1);
    floor.receiveShadow = true;
    scene.add(floor);

    // Poly Haven Brown Wood Side & Rear Enclosure Walls framing the Window
    const woodWallGeo = new THREE.PlaneGeometry(12, 6.2);
    const woodWallMat = new THREE.MeshStandardMaterial({
      map: woodWallPBR.map,
      normalMap: woodWallPBR.normalMap,
      roughnessMap: woodWallPBR.roughnessMap,
      color: '#9c6e4b',
      roughness: 0.62,
      metalness: 0.04
    });
    disposables.push(woodWallGeo, woodWallMat);
    const leftWoodWall = new THREE.Mesh(woodWallGeo, woodWallMat);
    leftWoodWall.position.set(-3.45, 2.5, -0.4);
    leftWoodWall.rotation.y = Math.PI / 2;
    leftWoodWall.receiveShadow = true;
    const rightWoodWall = new THREE.Mesh(woodWallGeo, woodWallMat);
    rightWoodWall.position.set(3.45, 2.5, -0.4);
    rightWoodWall.rotation.y = -Math.PI / 2;
    rightWoodWall.receiveShadow = true;
    scene.add(leftWoodWall, rightWoodWall);

    const brushedBump = createBrushedMetalTexture(maxAnisotropy);
    disposables.push(brushedBump);

    const walnutMat = new THREE.MeshStandardMaterial({
      map: studioWalnutPBR.map,
      normalMap: studioWalnutPBR.normalMap,
      roughnessMap: studioWalnutPBR.roughnessMap,
      color: '#b07b54',
      roughness: 0.44,
      metalness: 0.05
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#d8a85e',
      roughness: 0.22,
      metalness: 0.92
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: '#1b1d22',
      roughness: 0.34,
      bumpMap: brushedBump,
      bumpScale: 0.004,
      metalness: 0.84
    });
    const silverMetalMat = new THREE.MeshStandardMaterial({
      color: '#c2c8d2',
      roughness: 0.24,
      bumpMap: brushedBump,
      bumpScale: 0.004,
      metalness: 0.9
    });
    disposables.push(walnutMat, brassMat, darkMetalMat, silverMetalMat);

    // Side Acoustic Poly Haven Wood Slat Panel (Right & Left framing)
    const slatWallGroup = new THREE.Group();
    slatWallGroup.position.set(2.45, 0, -2.55);
    slatWallGroup.rotation.y = -0.62;
    const slatBackGeo = new THREE.BoxGeometry(2.6, 4.4, 0.08);
    const slatBackMat = new THREE.MeshStandardMaterial({
      map: woodWallPBR.map,
      normalMap: woodWallPBR.normalMap,
      roughnessMap: woodWallPBR.roughnessMap,
      color: '#523826',
      roughness: 0.78
    });
    const slatStripGeo = new THREE.BoxGeometry(0.055, 4.4, 0.045);
    disposables.push(slatBackGeo, slatBackMat, slatStripGeo);
    const slatBack = new THREE.Mesh(slatBackGeo, slatBackMat);
    slatBack.position.y = 2.2;
    slatWallGroup.add(slatBack);
    for (let sx = -1.2; sx <= 1.2; sx += 0.11) {
      const strip = new THREE.Mesh(slatStripGeo, walnutMat);
      strip.position.set(sx, 2.2, 0.05);
      slatWallGroup.add(strip);
    }
    scene.add(slatWallGroup);

    // Bookshelf Slot (real Poly Haven wooden_display_shelves_01.glb + procedural fallback)
    const bookshelfContainer = new THREE.Group();
    bookshelfContainer.position.set(2.35, 0, -3.15);
    bookshelfContainer.rotation.y = -0.45;
    scene.add(bookshelfContainer);

    const shelfProcGroup = new THREE.Group();
    const shelfBackGeo = new THREE.BoxGeometry(1.85, 3.2, 0.08);
    const shelfPlankGeo = new THREE.BoxGeometry(1.8, 0.05, 0.42);
    const shelfStripMat = new THREE.MeshBasicMaterial({ color: '#ffd08e' });
    const shelfStripGeo = new THREE.BoxGeometry(1.7, 0.018, 0.025);
    disposables.push(shelfBackGeo, shelfPlankGeo, shelfStripMat, shelfStripGeo);
    const sBack = new THREE.Mesh(shelfBackGeo, slatBackMat);
    sBack.position.y = 1.6;
    shelfProcGroup.add(sBack);
    [0.75, 1.35, 1.95, 2.55].forEach((sy, idx) => {
      const plank = new THREE.Mesh(shelfPlankGeo, walnutMat);
      plank.position.set(0, sy, 0.2);
      const strip = new THREE.Mesh(shelfStripGeo, shelfStripMat);
      strip.position.set(0, sy - 0.036, 0.32);
      shelfProcGroup.add(plank, strip);
      for (let b = 0; b < 5; b++) {
        const bh = 0.24 + ((b + idx) % 3) * 0.04;
        const bGeo = new THREE.BoxGeometry(0.055, bh, 0.26);
        const bMat = new THREE.MeshStandardMaterial({
          color: ['#475569', '#78350f', '#1e293b', '#92400e', '#334155'][(b + idx) % 5],
          roughness: 0.72
        });
        disposables.push(bGeo, bMat);
        const book = new THREE.Mesh(bGeo, bMat);
        book.position.set(-0.55 + b * 0.14, sy + bh * 0.5 + 0.025, 0.2);
        shelfProcGroup.add(book);
      }
    });
    bookshelfContainer.add(shelfProcGroup);

    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.bookshelf, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        shelfProcGroup.visible = false;
        bookshelfContainer.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // Picture Frame Slot (real Poly Haven fancy_picture_frame_02.glb on slat wall)
    const wallFrameContainer = new THREE.Group();
    wallFrameContainer.position.set(2.1, 2.05, -2.55);
    wallFrameContainer.rotation.y = -0.62;
    scene.add(wallFrameContainer);
    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.wall_frame, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        wallFrameContainer.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // Floor Lamp Slot (Architectural warm brass + glowing linen shade)
    const floorLampContainer = new THREE.Group();
    floorLampContainer.position.set(1.38, 0, -3.25);
    scene.add(floorLampContainer);

    const lampProcGroup = new THREE.Group();
    const lampPoleGeo = new THREE.CylinderGeometry(0.02, 0.026, 2.25, 16);
    const lampBaseGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.04, 24);
    const lampShadeGeo = new THREE.CylinderGeometry(0.21, 0.29, 0.34, 28, 1, true);
    const lampShadeMat = new THREE.MeshStandardMaterial({
      color: '#fae6c6',
      emissive: '#ffaa44',
      emissiveIntensity: 0.85,
      side: THREE.DoubleSide,
      roughness: 0.72
    });
    disposables.push(lampPoleGeo, lampBaseGeo, lampShadeGeo, lampShadeMat);
    const lBase = new THREE.Mesh(lampBaseGeo, darkMetalMat);
    lBase.position.y = 0.02;
    const lPole = new THREE.Mesh(lampPoleGeo, brassMat);
    lPole.position.y = 1.14;
    const lShade = new THREE.Mesh(lampShadeGeo, lampShadeMat);
    lShade.position.y = 2.26;
    lampProcGroup.add(lBase, lPole, lShade);
    floorLampContainer.add(lampProcGroup);

    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.floor_lamp, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        lampProcGroup.visible = false;
        floorLampContainer.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // Potted Tropical Studio Palm (Left Rear Corner, adds organic silhouette depth)
    const plantContainer = new THREE.Group();
    plantContainer.position.set(-1.55, 0, -3.15);
    scene.add(plantContainer);

    const plantProcGroup = new THREE.Group();
    const potGeo = new THREE.CylinderGeometry(0.24, 0.17, 0.42, 24);
    const potMat = new THREE.MeshStandardMaterial({ color: '#1c1b1a', roughness: 0.8 });
    const leafGeo = new THREE.SphereGeometry(0.14, 10, 8);
    leafGeo.scale(0.38, 1.9, 0.08);
    const leafMat = new THREE.MeshStandardMaterial({
      color: '#223d28',
      roughness: 0.58,
      metalness: 0.04
    });
    disposables.push(potGeo, potMat, leafGeo, leafMat);
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.y = 0.21;
    plantProcGroup.add(pot);
    for (let f = 0; f < 11; f++) {
      const angle = (f / 11) * Math.PI * 2;
      const frond = new THREE.Mesh(leafGeo, leafMat);
      frond.position.set(
        Math.cos(angle) * 0.24,
        0.72 + (f % 3) * 0.2,
        Math.sin(angle) * 0.24
      );
      frond.rotation.set(Math.sin(angle) * 0.55, angle, Math.cos(angle) * 0.55);
      plantProcGroup.add(frond);
    }
    plantContainer.add(plantProcGroup);

    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.potted_plant, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        plantProcGroup.visible = false;
        plantContainer.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // Acoustic Guitar / Ukulele Slot (Left Rear Window View — real Poly Haven Ukulele_01.glb fallback!)
    const guitarContainer = new THREE.Group();
    guitarContainer.position.set(-1.35, 0.35, -2.45);
    guitarContainer.rotation.set(-0.14, 0.48, 0.06);
    scene.add(guitarContainer);

    const guitarProcGroup = new THREE.Group();
    const gLowerGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.12, 28);
    const gUpperGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 28);
    const gBodyMat = new THREE.MeshStandardMaterial({ color: '#924f22', roughness: 0.34, metalness: 0.08 });
    const gNeckGeo = new THREE.BoxGeometry(0.068, 0.78, 0.032);
    const gHoleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.126, 20);
    const gHoleMat = new THREE.MeshStandardMaterial({ color: '#130b06', roughness: 0.9 });
    disposables.push(gLowerGeo, gUpperGeo, gBodyMat, gNeckGeo, gHoleGeo, gHoleMat);
    const gLower = new THREE.Mesh(gLowerGeo, gBodyMat);
    gLower.rotation.x = Math.PI / 2;
    gLower.position.y = 0.38;
    const gUpper = new THREE.Mesh(gUpperGeo, gBodyMat);
    gUpper.rotation.x = Math.PI / 2;
    gUpper.position.y = 0.72;
    const gHole = new THREE.Mesh(gHoleGeo, gHoleMat);
    gHole.rotation.x = Math.PI / 2;
    gHole.position.y = 0.62;
    const gNeck = new THREE.Mesh(gNeckGeo, walnutMat);
    gNeck.position.y = 1.18;
    guitarProcGroup.add(gLower, gUpper, gHole, gNeck);
    guitarContainer.add(guitarProcGroup);

    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.acoustic_guitar, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        guitarProcGroup.visible = false;
        guitarContainer.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // Studio Chair behind background lounge area (real Poly Haven dining_chair_02.glb fallback)
    const chairContainer = new THREE.Group();
    chairContainer.position.set(1.55, 0, -2.05);
    chairContainer.rotation.y = -0.65;
    scene.add(chairContainer);
    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.studio_chair, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        chairContainer.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // -------------------------------------------------------------------------
    // HERO DESK: DARK VEINED MARBLE & WALNUT MUSIC PRODUCER TABLE
    // -------------------------------------------------------------------------
    const DESK_TOP_Y = 0.76;
    const { map: marbleMap, roughnessMap: marbleRough, bumpMap: marbleBump } =
      createDarkMarbleTextures(maxAnisotropy);
    disposables.push(marbleMap, marbleRough, marbleBump);

    const deskTopMat = new THREE.MeshPhysicalMaterial({
      map: marbleMap,
      roughnessMap: marbleRough,
      bumpMap: marbleBump,
      bumpScale: 0.0025,
      roughness: 0.2,
      metalness: 0.04,
      clearcoat: 0.92,
      clearcoatRoughness: 0.1
    });
    disposables.push(deskTopMat);

    const deskShape = new THREE.Shape();
    deskShape.absellipse(0, 0, 2.35, 1.38, 0, Math.PI * 2, false, 0);
    const deskTopGeo = new THREE.ExtrudeGeometry(deskShape, {
      depth: 0.055,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.02,
      bevelSegments: 4
    });
    deskTopGeo.rotateX(Math.PI / 2);
    disposables.push(deskTopGeo);

    const deskProcGroup = new THREE.Group();
    const deskTop = new THREE.Mesh(deskTopGeo, deskTopMat);
    deskTop.position.set(0, DESK_TOP_Y, 0.08);
    deskTop.receiveShadow = true;
    deskTop.castShadow = true;

    const apronGeo = new THREE.CylinderGeometry(2.18, 2.14, 0.05, 48);
    const legGeo = new THREE.CylinderGeometry(0.24, 0.38, DESK_TOP_Y - 0.05, 32);
    disposables.push(apronGeo, legGeo);
    const apron = new THREE.Mesh(apronGeo, walnutMat);
    apron.scale.set(1, 1, 0.56);
    apron.position.set(0, DESK_TOP_Y - 0.08, 0.08);
    const pedestalLeg = new THREE.Mesh(legGeo, darkMetalMat);
    pedestalLeg.position.set(0, (DESK_TOP_Y - 0.08) * 0.5, 0);
    deskProcGroup.add(deskTop, apron, pedestalLeg);
    scene.add(deskProcGroup);

    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.studio_desk, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        deskProcGroup.visible = false;
        glbModel.position.set(0, 0, 0.08);
        scene.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // -------------------------------------------------------------------------
    // 1. WARM GLOWING CRYSTAL ORB LAMP (Aether Tri-Loop Filaments + Glow Halo)
    // -------------------------------------------------------------------------
    const orbGroup = new THREE.Group();
    orbGroup.position.set(-0.1, DESK_TOP_Y, -0.68);
    orbGroup.userData.propAction = 'orb';
    addContactShadow(-0.1, DESK_TOP_Y + 0.002, -0.68, 0.58, 0.58);

    const orbProcGroup = new THREE.Group();
    const orbPedestalGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.075, 36);
    const orbRingGeo = new THREE.TorusGeometry(0.195, 0.012, 14, 48);
    const orbFilGeo = new THREE.TorusGeometry(0.105, 0.0055, 12, 64);
    const orbCoreMat = new THREE.MeshStandardMaterial({
      color: '#ffe8b2',
      emissive: '#ffb84d',
      emissiveIntensity: 3.6,
      roughness: 0.15
    });
    const orbSeedGeo = new THREE.SphereGeometry(0.022, 16, 16);
    const orbShellGeo = new THREE.SphereGeometry(0.23, 36, 36);
    const orbShellMat = new THREE.MeshPhysicalMaterial({
      color: '#fff9ef',
      roughness: 0.04,
      metalness: 0.02,
      transparent: true,
      opacity: isSoftwareGl ? 0.28 : 0.18,
      transmission: isSoftwareGl ? 0 : 0.86,
      ior: 1.52,
      thickness: 0.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      depthWrite: false
    });
    const haloTex = createGlowHaloTexture();
    const haloMat = new THREE.SpriteMaterial({
      map: haloTex,
      color: '#ffbe66',
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    disposables.push(
      orbPedestalGeo,
      orbRingGeo,
      orbFilGeo,
      orbCoreMat,
      orbSeedGeo,
      orbShellGeo,
      orbShellMat,
      haloTex,
      haloMat
    );

    const orbPedestal = new THREE.Mesh(orbPedestalGeo, darkMetalMat);
    orbPedestal.position.y = 0.038;
    const orbRing = new THREE.Mesh(orbRingGeo, brassMat);
    orbRing.rotation.x = Math.PI / 2;
    orbRing.position.y = 0.076;

    const orbCorePivot = new THREE.Group();
    orbCorePivot.position.y = 0.305;
    const f1 = new THREE.Mesh(orbFilGeo, orbCoreMat);
    const f2 = new THREE.Mesh(orbFilGeo, orbCoreMat);
    f2.rotation.y = Math.PI / 3;
    f2.rotation.x = 0.55;
    const f3 = new THREE.Mesh(orbFilGeo, orbCoreMat);
    f3.rotation.y = -Math.PI / 3;
    f3.rotation.x = -0.55;
    const centerSeed = new THREE.Mesh(orbSeedGeo, orbCoreMat);
    const orbHalo = new THREE.Sprite(haloMat);
    orbHalo.scale.set(0.68, 0.68, 1);
    orbCorePivot.add(f1, f2, f3, centerSeed, orbHalo);

    const orbShell = new THREE.Mesh(orbShellGeo, orbShellMat);
    orbShell.position.y = 0.305;
    orbShell.renderOrder = 4;

    orbProcGroup.add(orbPedestal, orbRing, orbCorePivot, orbShell);
    orbGroup.add(orbProcGroup);
    scene.add(orbGroup);

    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.glass_orb_lamp, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        orbProcGroup.visible = false;
        orbGroup.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // -------------------------------------------------------------------------
    // 2. OPEN LEATHER SONGWRITING NOTEBOOK & BRASS FOUNTAIN PEN ("دفتر")
    //    Positioned at x = -0.88 so ALWAYS clearly framed on portrait mobile
    // -------------------------------------------------------------------------
    const notebookGroup = new THREE.Group();
    notebookGroup.position.set(-0.88, DESK_TOP_Y + 0.004, 0.22);
    notebookGroup.rotation.y = 0.36;
    notebookGroup.userData.propAction = 'notebook';
    addContactShadow(-0.88, DESK_TOP_Y + 0.002, 0.22, 0.92, 0.68);

    const nbCoverGeo = new RoundedBoxGeometry(0.72, 0.02, 0.5, 3, 0.006);
    const nbCoverMat = new THREE.MeshStandardMaterial({
      color: '#281b13',
      roughness: 0.72,
      metalness: 0.06
    });
    const nbCanvas = document.createElement('canvas');
    nbCanvas.width = 1024;
    nbCanvas.height = 680;
    const nbTex = new THREE.CanvasTexture(nbCanvas);
    nbTex.colorSpace = THREE.SRGBColorSpace;
    nbTex.anisotropy = maxAnisotropy;

    const nbPageGeo = new RoundedBoxGeometry(0.68, 0.026, 0.46, 3, 0.004);
    const nbPageEdgeMat = new THREE.MeshStandardMaterial({ color: '#e5dcc8', roughness: 0.88 });
    const nbPageTopMat = new THREE.MeshStandardMaterial({
      map: nbTex,
      roughness: 0.84,
      metalness: 0.02
    });
    disposables.push(nbCoverGeo, nbCoverMat, nbTex, nbPageGeo, nbPageEdgeMat, nbPageTopMat);

    const nbCover = new THREE.Mesh(nbCoverGeo, nbCoverMat);
    nbCover.position.y = 0.01;
    nbCover.castShadow = true;
    const nbPages = new THREE.Mesh(nbPageGeo, [
      nbPageEdgeMat,
      nbPageEdgeMat,
      nbPageTopMat,
      nbPageEdgeMat,
      nbPageEdgeMat,
      nbPageEdgeMat
    ]);
    nbPages.position.y = 0.028;
    nbPages.castShadow = true;

    const nbProcGroup = new THREE.Group();
    nbProcGroup.add(nbCover, nbPages);
    notebookGroup.add(nbProcGroup);

    // Brass Fountain Pen (replaceable via fountain-pen.glb)
    const penGroup = new THREE.Group();
    const penProc = new THREE.Group();
    const penBodyGeo = new THREE.CylinderGeometry(0.011, 0.01, 0.32, 14);
    const penRingGeo = new THREE.CylinderGeometry(0.0125, 0.0125, 0.018, 14);
    const penNibGeo = new THREE.ConeGeometry(0.01, 0.038, 14);
    const penBodyMat = new THREE.MeshStandardMaterial({
      color: '#181b20',
      roughness: 0.22,
      metalness: 0.65
    });
    disposables.push(penBodyGeo, penRingGeo, penNibGeo, penBodyMat);
    const penBody = new THREE.Mesh(penBodyGeo, penBodyMat);
    penBody.rotation.z = Math.PI / 2;
    const penRing = new THREE.Mesh(penRingGeo, brassMat);
    penRing.rotation.z = Math.PI / 2;
    penRing.position.x = 0.045;
    const penNib = new THREE.Mesh(penNibGeo, brassMat);
    penNib.rotation.z = -Math.PI / 2;
    penNib.position.x = 0.175;
    penProc.add(penBody, penRing, penNib);
    penGroup.add(penProc);

    const penRestPos = new THREE.Vector3(0.16, 0.052, 0.14);
    penGroup.position.copy(penRestPos);
    penGroup.rotation.y = -0.5;
    notebookGroup.add(penGroup);
    scene.add(notebookGroup);

    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.open_notebook, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        nbProcGroup.visible = false;
        notebookGroup.add(glbModel);
        glbRoots.push(glbModel);
      }
    });
    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.fountain_pen, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        penProc.visible = false;
        penGroup.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // -------------------------------------------------------------------------
    // 3. STUDIO MONITOR HEADPHONES & CONDENSER MIC ("ابزار موسیقی")
    // -------------------------------------------------------------------------
    const headphonesGroup = new THREE.Group();
    headphonesGroup.position.set(0.92, DESK_TOP_Y + 0.048, 0.28);
    headphonesGroup.rotation.set(Math.PI * 0.47, -0.34, 0.52);
    headphonesGroup.userData.propAction = 'headphones';
    addContactShadow(0.92, DESK_TOP_Y + 0.002, 0.28, 0.56, 0.46);

    const hpProcGroup = new THREE.Group();
    const headbandGeo = new THREE.TorusGeometry(0.15, 0.02, 16, 36, Math.PI * 1.15);
    const leatherMat = new THREE.MeshStandardMaterial({
      color: '#1b1815',
      roughness: 0.65,
      metalness: 0.08
    });
    const earcupGeo = new THREE.CylinderGeometry(0.088, 0.088, 0.048, 28);
    const padGeo = new THREE.TorusGeometry(0.074, 0.024, 14, 28);
    const trimGeo = new THREE.TorusGeometry(0.064, 0.0055, 10, 28);
    disposables.push(headbandGeo, leatherMat, earcupGeo, padGeo, trimGeo);

    const headband = new THREE.Mesh(headbandGeo, leatherMat);
    headband.rotation.z = -Math.PI * 0.075;
    headband.castShadow = true;

    const leftCup = new THREE.Mesh(earcupGeo, darkMetalMat);
    leftCup.position.set(-0.16, -0.02, 0);
    leftCup.rotation.z = Math.PI / 2;
    const leftTrim = new THREE.Mesh(trimGeo, brassMat);
    leftTrim.position.set(-0.186, -0.02, 0);
    leftTrim.rotation.y = Math.PI / 2;
    const leftPad = new THREE.Mesh(padGeo, leatherMat);
    leftPad.position.set(-0.132, -0.02, 0);
    leftPad.rotation.y = Math.PI / 2;

    const rightCup = leftCup.clone();
    rightCup.position.x = 0.16;
    const rightTrim = leftTrim.clone();
    rightTrim.position.x = 0.186;
    const rightPad = leftPad.clone();
    rightPad.position.x = 0.132;

    hpProcGroup.add(headband, leftCup, leftTrim, leftPad, rightCup, rightTrim, rightPad);
    headphonesGroup.add(hpProcGroup);
    scene.add(headphonesGroup);

    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.studio_headphones, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        hpProcGroup.visible = false;
        headphonesGroup.rotation.set(0, -0.45, 0);
        headphonesGroup.position.y = DESK_TOP_Y + 0.002;
        headphonesGroup.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // Brass Studio Condenser Microphone (Rear-Left of desk)
    const micGroup = new THREE.Group();
    micGroup.position.set(-1.02, DESK_TOP_Y, -0.34);
    micGroup.rotation.y = 0.42;
    addContactShadow(-1.02, DESK_TOP_Y + 0.002, -0.34, 0.34, 0.34);

    const micProcGroup = new THREE.Group();
    const micBaseGeo = new THREE.CylinderGeometry(0.095, 0.105, 0.024, 28);
    const micStemGeo = new THREE.CylinderGeometry(0.012, 0.014, 0.25, 14);
    const micBodyGeo = new THREE.CylinderGeometry(0.04, 0.036, 0.15, 22);
    const micMeshGeo = new THREE.SphereGeometry(0.042, 22, 16);
    const micMeshMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.28,
      metalness: 0.92,
      wireframe: true
    });
    disposables.push(micBaseGeo, micStemGeo, micBodyGeo, micMeshGeo, micMeshMat);

    const micBase = new THREE.Mesh(micBaseGeo, darkMetalMat);
    micBase.position.y = 0.012;
    const micStem = new THREE.Mesh(micStemGeo, silverMetalMat);
    micStem.position.y = 0.14;
    const micCapsule = new THREE.Mesh(micBodyGeo, brassMat);
    micCapsule.position.y = 0.31;
    const micGrille = new THREE.Mesh(micMeshGeo, micMeshMat);
    micGrille.position.y = 0.39;
    micProcGroup.add(micBase, micStem, micCapsule, micGrille);
    micGroup.add(micProcGroup);
    scene.add(micGroup);

    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.condenser_mic, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        micProcGroup.visible = false;
        micGroup.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // -------------------------------------------------------------------------
    // 4. MOTORIZED HI-FI CASSETTE DECK (Center-Right Hero Player)
    // -------------------------------------------------------------------------
    const deckGroup = new THREE.Group();
    deckGroup.position.set(0.58, DESK_TOP_Y, -0.34);
    deckGroup.rotation.y = -0.24;
    deckGroup.userData.propAction = 'deck';
    addContactShadow(0.58, DESK_TOP_Y + 0.002, -0.34, 1.32, 0.8);

    const deckProcGroup = new THREE.Group();
    const deckBodyGeo = new RoundedBoxGeometry(1.06, 0.38, 0.56, 4, 0.014);
    const deckFrontMat = new THREE.MeshStandardMaterial({
      color: '#22262f',
      roughness: 0.28,
      bumpMap: brushedBump,
      bumpScale: 0.005,
      metalness: 0.86
    });
    const deckWoodCheekGeo = new RoundedBoxGeometry(0.042, 0.39, 0.57, 3, 0.008);
    const deckBayRecessGeo = new THREE.BoxGeometry(0.45, 0.24, 0.075);
    const deckBayRecessMat = new THREE.MeshStandardMaterial({ color: '#0c0e13', roughness: 0.85 });
    disposables.push(deckBodyGeo, deckFrontMat, deckWoodCheekGeo, deckBayRecessGeo, deckBayRecessMat);

    const deckBody = new THREE.Mesh(deckBodyGeo, deckFrontMat);
    deckBody.position.y = 0.19;
    deckBody.castShadow = true;
    deckBody.receiveShadow = true;
    deckProcGroup.add(deckBody);

    [-0.54, 0.54].forEach((cx) => {
      const cheek = new THREE.Mesh(deckWoodCheekGeo, walnutMat);
      cheek.position.set(cx, 0.195, 0);
      cheek.castShadow = true;
      deckProcGroup.add(cheek);
    });

    const bayRecess = new THREE.Mesh(deckBayRecessGeo, deckBayRecessMat);
    bayRecess.position.set(-0.2, 0.2, 0.25);
    deckProcGroup.add(bayRecess);

    const capstanGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.045, 14);
    disposables.push(capstanGeo);
    const capstanL = new THREE.Mesh(capstanGeo, silverMetalMat);
    capstanL.rotation.x = Math.PI / 2;
    capstanL.position.set(-0.285, 0.2, 0.252);
    const capstanR = capstanL.clone();
    capstanR.position.x = -0.115;
    deckProcGroup.add(capstanL, capstanR);

    // Motorized Smoked-Glass Cassette Door Pivot
    const deckDoorPivot = new THREE.Group();
    deckDoorPivot.position.set(-0.2, 0.08, 0.284);
    const doorFrameGeo = new THREE.BoxGeometry(0.47, 0.25, 0.014);
    const doorGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#cbd5e1',
      roughness: 0.1,
      metalness: 0.05,
      transparent: true,
      opacity: 0.3,
      depthWrite: false
    });
    const doorChromeBarGeo = new THREE.BoxGeometry(0.47, 0.02, 0.02);
    disposables.push(doorFrameGeo, doorGlassMat, doorChromeBarGeo);

    const doorGlass = new THREE.Mesh(doorFrameGeo, doorGlassMat);
    doorGlass.position.set(0, 0.125, 0);
    const doorBar = new THREE.Mesh(doorChromeBarGeo, silverMetalMat);
    doorBar.position.set(0, 0.245, 0.004);
    deckDoorPivot.add(doorGlass, doorBar);
    deckProcGroup.add(deckDoorPivot);

    // Twin Illuminated Analog VU Meters + Animated Needles
    const vuTex = createVuMeterCanvasTexture(maxAnisotropy);
    const vuGeo = new THREE.PlaneGeometry(0.165, 0.092);
    const vuMat = new THREE.MeshStandardMaterial({
      map: vuTex,
      emissive: '#ffb84d',
      emissiveMap: vuTex,
      emissiveIntensity: 0.85,
      roughness: 0.28
    });
    const needleGeo = new THREE.BoxGeometry(0.004, 0.066, 0.004);
    const needleMat = new THREE.MeshBasicMaterial({ color: '#1c1209' });
    disposables.push(vuTex, vuGeo, vuMat, needleGeo, needleMat);

    const vuNeedles: THREE.Group[] = [];
    [0.16, 0.365].forEach((vx) => {
      const face = new THREE.Mesh(vuGeo, vuMat);
      face.position.set(vx, 0.255, 0.282);
      deckProcGroup.add(face);

      const needlePivot = new THREE.Group();
      needlePivot.position.set(vx, 0.21, 0.286);
      const needle = new THREE.Mesh(needleGeo, needleMat);
      needle.position.y = 0.033;
      needlePivot.add(needle);
      needlePivot.rotation.z = 0.45;
      deckProcGroup.add(needlePivot);
      vuNeedles.push(needlePivot);
    });

    // 3 Brass Analog Rotary Knobs (Speed, Warmth, Echo)
    const knobGeo = new THREE.CylinderGeometry(0.03, 0.033, 0.034, 22);
    const knobTickGeo = new THREE.BoxGeometry(0.005, 0.008, 0.02);
    const knobTickMat = new THREE.MeshBasicMaterial({ color: '#111111' });
    disposables.push(knobGeo, knobTickGeo, knobTickMat);

    const rotaryKnobs: THREE.Group[] = [];
    [0.125, 0.265, 0.405].forEach((kx) => {
      const kGroup = new THREE.Group();
      kGroup.position.set(kx, 0.115, 0.292);
      const kMesh = new THREE.Mesh(knobGeo, brassMat);
      kMesh.rotation.x = Math.PI / 2;
      const tick = new THREE.Mesh(knobTickGeo, knobTickMat);
      tick.position.set(0, 0.02, 0.015);
      kGroup.add(kMesh, tick);
      deckProcGroup.add(kGroup);
      rotaryKnobs.push(kGroup);
    });

    const ledGeo = new THREE.SphereGeometry(0.0085, 10, 10);
    const playLedMat = new THREE.MeshBasicMaterial({ color: '#334155' });
    const rwLedMat = new THREE.MeshBasicMaterial({ color: '#334155' });
    disposables.push(ledGeo, playLedMat, rwLedMat);
    const playLed = new THREE.Mesh(ledGeo, playLedMat);
    playLed.position.set(-0.34, 0.34, 0.284);
    const rwLed = new THREE.Mesh(ledGeo, rwLedMat);
    rwLed.position.set(-0.295, 0.34, 0.284);
    deckProcGroup.add(playLed, rwLed);

    deckGroup.add(deckProcGroup);

    // Sleek Walnut & Brushed-Brass Angled Studio Cradle + Tilted Pivot for Poly Haven Cassette Player GLB
    const deckGlbDock = new THREE.Group();
    deckGlbDock.visible = false;
    const dockBaseGeo = new RoundedBoxGeometry(0.52, 0.036, 0.44, 3, 0.009);
    const dockTrimGeo = new RoundedBoxGeometry(0.46, 0.014, 0.04, 2, 0.005);
    const dockPropGeo = new RoundedBoxGeometry(0.42, 0.24, 0.035, 2, 0.006);
    disposables.push(dockBaseGeo, dockTrimGeo, dockPropGeo);

    const dockBase = new THREE.Mesh(dockBaseGeo, walnutMat);
    dockBase.position.set(0, 0.018, 0);
    dockBase.castShadow = true;
    dockBase.receiveShadow = true;

    const dockTrim = new THREE.Mesh(dockTrimGeo, brassMat);
    dockTrim.position.set(0, 0.04, 0.165);
    dockTrim.castShadow = true;

    const dockPropBack = new THREE.Mesh(dockPropGeo, darkMetalMat);
    dockPropBack.position.set(0, 0.12, -0.14);
    dockPropBack.rotation.x = 0.28;
    dockPropBack.castShadow = true;

    deckGlbDock.add(dockBase, dockTrim, dockPropBack);

    const deckGlbPivot = new THREE.Group();
    deckGlbPivot.position.set(0, 0.038, 0.09);
    deckGlbPivot.rotation.x = -0.52;
    deckGlbDock.add(deckGlbPivot);

    // Exact world-trackable bay anchor matching Poly Haven Dixons TR12 cassette window
    const insertedBayAnchor = new THREE.Object3D();
    insertedBayAnchor.position.set(0, 0.285, 0.056);
    deckGlbPivot.add(insertedBayAnchor);

    deckGroup.add(deckGlbDock);
    scene.add(deckGroup);

    let hasGlbDeck = false;
    let deckBakedTapeObj: THREE.Object3D | null = null;

    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.cassette_deck, () => disposed, {
      envMapIntensity: 1.15
    }).then((glbModel) => {
      if (glbModel && !disposed) {
        glbModel.traverse((obj) => {
          if (obj.name === 'cassette_player_tape') {
            deckBakedTapeObj = obj;
          }
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              if (!m) continue;
              if (m.name?.includes('flap') && m instanceof THREE.MeshStandardMaterial) {
                m.transparent = true;
                m.depthWrite = false;
                m.opacity = 0.34;
                m.roughness = 0.12;
                m.needsUpdate = true;
              }
            }
          }
        });
        deckProcGroup.visible = false;
        deckGlbDock.visible = true;
        hasGlbDeck = true;
        deckGlbPivot.add(glbModel);
        glbRoots.push(glbModel);
      }
    });

    // -------------------------------------------------------------------------
    // 5. WALNUT CASSETTE RACK & INDIVIDUAL SINGER 3D CASSETTE TAPES
    //    Compact curved spread [-0.82 .. +0.82] so all 7 tapes fit inside portrait 9:16
    // -------------------------------------------------------------------------
    const visibleTapes = propsRef.current.tapes.slice(0, 7);
    const cassetteRuntimes = new Map<string, CassetteRuntimeRef>();
    const clickableTargets: THREE.Object3D[] = [orbGroup, notebookGroup, headphonesGroup, deckGroup];

    const rackRailGeo = new RoundedBoxGeometry(1.94, 0.032, 0.3, 3, 0.008);
    disposables.push(rackRailGeo);
    const rackRail = new THREE.Mesh(rackRailGeo, walnutMat);
    rackRail.position.set(-0.02, DESK_TOP_Y + 0.016, 0.69);
    rackRail.receiveShadow = true;
    rackRail.castShadow = true;
    scene.add(rackRail);
    addContactShadow(-0.02, DESK_TOP_Y + 0.002, 0.69, 2.05, 0.4);

    const casBodyGeo = new RoundedBoxGeometry(0.32, 0.205, 0.04, 3, 0.007);
    const casBridgeGeo = new RoundedBoxGeometry(0.21, 0.044, 0.048, 2, 0.005);
    const casWindowGeo = new THREE.BoxGeometry(0.16, 0.05, 0.046);
    const casLabelGeo = new THREE.PlaneGeometry(0.285, 0.138);
    const casReelGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.05, 14);
    const casSpokeGeo = new THREE.BoxGeometry(0.04, 0.007, 0.052);
    const casHitGeo = new THREE.BoxGeometry(0.36, 0.25, 0.1);
    const casWindowMat = new THREE.MeshPhysicalMaterial({
      color: '#11141c',
      roughness: 0.16,
      metalness: 0.08,
      transparent: true,
      opacity: 0.78
    });
    const casReelMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.36 });
    const casSpokeMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.28 });
    const casHitMat = new THREE.MeshBasicMaterial({ visible: false });
    disposables.push(
      casBodyGeo,
      casBridgeGeo,
      casWindowGeo,
      casLabelGeo,
      casReelGeo,
      casSpokeGeo,
      casHitGeo,
      casWindowMat,
      casReelMat,
      casSpokeMat,
      casHitMat
    );

    const totalTapes = Math.max(1, visibleTapes.length);
    const cassetteProcShells: THREE.Object3D[] = [];

    visibleTapes.forEach((item, idx) => {
      const cGroup = new THREE.Group();
      cGroup.userData.tapeId = item.id;

      const shellColors = ['#1c1917', '#262930', '#31231b', '#1b2632', '#2b1b24', '#222823', '#1e1b29'];
      const shellMat = new THREE.MeshStandardMaterial({
        color: shellColors[idx % shellColors.length],
        roughness: 0.32,
        metalness: 0.18
      });
      disposables.push(shellMat);

      const procShellGroup = new THREE.Group();
      const shell = new THREE.Mesh(casBodyGeo, shellMat);
      shell.castShadow = true;
      shell.receiveShadow = true;
      const bridge = new THREE.Mesh(casBridgeGeo, shellMat);
      bridge.position.y = -0.085;
      const win = new THREE.Mesh(casWindowGeo, casWindowMat);
      win.position.y = 0.005;
      procShellGroup.add(shell, bridge, win);
      cGroup.add(procShellGroup);
      cassetteProcShells.push(procShellGroup);

      const canvasA = document.createElement('canvas');
      canvasA.width = 512;
      canvasA.height = 256;
      const texA = new THREE.CanvasTexture(canvasA);
      texA.colorSpace = THREE.SRGBColorSpace;
      texA.anisotropy = maxAnisotropy;

      const canvasB = document.createElement('canvas');
      canvasB.width = 512;
      canvasB.height = 256;
      const texB = new THREE.CanvasTexture(canvasB);
      texB.colorSpace = THREE.SRGBColorSpace;
      texB.anisotropy = maxAnisotropy;

      const initEdit = propsRef.current.tapeEdits[item.id] || DEFAULT_EDIT;
      drawCassetteLabelCanvas(canvasA, item, 'A', initEdit);
      drawCassetteLabelCanvas(canvasB, item, 'B', initEdit);
      texA.needsUpdate = true;
      texB.needsUpdate = true;

      const labelMatA = new THREE.MeshStandardMaterial({
        map: texA,
        roughness: 0.62,
        polygonOffset: true,
        polygonOffsetFactor: -1
      });
      const labelMatB = new THREE.MeshStandardMaterial({
        map: texB,
        roughness: 0.62,
        polygonOffset: true,
        polygonOffsetFactor: -1
      });
      disposables.push(texA, texB, labelMatA, labelMatB);

      const labelFront = new THREE.Mesh(casLabelGeo, labelMatA);
      labelFront.position.set(0, 0.014, 0.0215);
      const labelBack = new THREE.Mesh(casLabelGeo, labelMatB);
      labelBack.position.set(0, 0.014, -0.0215);
      labelBack.rotation.y = Math.PI;

      const leftReel = new THREE.Group();
      leftReel.position.set(-0.064, 0.005, 0);
      const lHub = new THREE.Mesh(casReelGeo, casReelMat);
      lHub.rotation.x = Math.PI / 2;
      const lSpoke1 = new THREE.Mesh(casSpokeGeo, casSpokeMat);
      const lSpoke2 = new THREE.Mesh(casSpokeGeo, casSpokeMat);
      lSpoke2.rotation.z = Math.PI / 2;
      leftReel.add(lHub, lSpoke1, lSpoke2);

      const rightReel = leftReel.clone();
      rightReel.position.x = 0.064;

      const hitBox = new THREE.Mesh(casHitGeo, casHitMat);
      hitBox.userData.tapeId = item.id;

      cGroup.add(labelFront, labelBack, leftReel, rightReel, hitBox);

      const norm = totalTapes > 1 ? idx / (totalTapes - 1) - 0.5 : 0;
      const rx = -0.02 + norm * 1.62;
      const rz = 0.68 + Math.abs(norm) * 0.13;
      const ry = DESK_TOP_Y + 0.115;
      const rotY = -norm * 0.34;
      const restPos = new THREE.Vector3(rx, ry, rz);
      const restRot = new THREE.Euler(-0.36, rotY, 0);

      cGroup.position.copy(restPos);
      cGroup.rotation.copy(restRot);
      scene.add(cGroup);
      clickableTargets.push(hitBox);

      cassetteRuntimes.set(item.id, {
        id: item.id,
        item,
        group: cGroup,
        leftReel,
        rightReel,
        labelCanvasA: canvasA,
        labelCanvasB: canvasB,
        labelTexA: texA,
        labelTexB: texB,
        restPos,
        restRot,
        hitBox
      });
    });

    // If user supplies public/models/studio/cassette-tape.glb, swap all 7 cassette shells cleanly
    void loadStudioSlotGlb(STUDIO_GLB_SLOTS.cassette_tape, () => disposed).then((glbModel) => {
      if (glbModel && !disposed) {
        let idx = 0;
        cassetteRuntimes.forEach((rt) => {
          const clone = glbModel.clone(true);
          if (cassetteProcShells[idx]) {
            cassetteProcShells[idx].visible = false;
          }
          rt.group.add(clone);
          idx++;
        });
        glbRoots.push(glbModel);
      }
    });

    const selGlowGeo = new THREE.RingGeometry(0.15, 0.19, 32);
    const selGlowMat = new THREE.MeshBasicMaterial({
      color: '#F5B942',
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    disposables.push(selGlowGeo, selGlowMat);
    const selGlow = new THREE.Mesh(selGlowGeo, selGlowMat);
    selGlow.rotation.x = -Math.PI / 2;
    selGlow.position.set(0, DESK_TOP_Y + 0.034, 0.68);
    scene.add(selGlow);

    // Initial notebook draw
    const initSelectedItem =
      visibleTapes.find((x) => x.id === propsRef.current.selectedTapeId) || visibleTapes[0];
    drawNotebookCanvas(
      nbCanvas,
      initSelectedItem,
      (initSelectedItem && propsRef.current.tapeEdits[initSelectedItem.id]) || DEFAULT_EDIT
    );
    nbTex.needsUpdate = true;

    // -------------------------------------------------------------------------
    // POINTER RAYCASTING
    // -------------------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 10) return;
      const rect = domEl.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(clickableTargets, true);
      if (hits.length === 0) return;

      let curr: THREE.Object3D | null = hits[0].object;
      while (curr) {
        if (typeof curr.userData.tapeId === 'string') {
          propsRef.current.onSelectTape(curr.userData.tapeId);
          return;
        }
        if (typeof curr.userData.propAction === 'string') {
          const act = curr.userData.propAction as 'deck' | 'notebook' | 'headphones' | 'orb';
          if (act === 'deck') {
            propsRef.current.onTogglePlay();
          }
          propsRef.current.onInteractProp?.(act);
          return;
        }
        curr = curr.parent;
      }
    };

    domEl.addEventListener('pointerdown', onPointerDown);
    domEl.addEventListener('pointerup', onPointerUp);

    // Responsive ResizeObserver updating camera projection + EffectComposer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 390;
      const h = container.clientHeight || 640;
      currentAspect = w / Math.max(1, h);
      const nextSpec = getResponsiveCameraSpec(propsRef.current.cameraPreset, currentAspect);
      camera.fov = nextSpec.fov;
      camera.aspect = currentAspect;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
      bloomPass?.resolution.set(w, h);
    };
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    let prevSelectedId = propsRef.current.selectedTapeId;
    let prevEditSig = '';
    let prevFlipSeq = propsRef.current.flipSeq;
    let prevRewindSeq = propsRef.current.rewindSeq;
    let prevStampSeq = propsRef.current.stampSeq;

    let flipTimer = 0;
    let rewindTimer = 0;
    let stampTimer = 0;
    let reelAngle = 0;

    // World coordinates inside Cassette Deck bay (aligned with deckGroup at [0.58, DESK_TOP_Y, -0.34])
    const deckSlotWorld = new THREE.Vector3(0.42, DESK_TOP_Y + 0.2, -0.14);
    const deckSlotRotY = -0.24;

    let rafId = 0;
    let loopRunning = false;
    const clock = new THREE.Clock();

    function scheduleNextFrame() {
      if (disposed || !propsRef.current.isActive) {
        loopRunning = false;
        return;
      }
      loopRunning = true;
      if (isSoftwareGl) {
        afterDraw(animateTick);
      } else {
        rafId = requestAnimationFrame(animateTick);
      }
    }

    resumeLoopRef.current = () => {
      if (disposed || loopRunning) return;
      clock.getDelta();
      handleResize();
      scheduleNextFrame();
    };

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync && gl.deleteSync) gl.deleteSync(sync);
          return;
        }
        const state =
          sync && gl.getSyncParameter ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          rafId = window.setTimeout(poll, 6);
        } else {
          if (sync && gl.deleteSync) gl.deleteSync(sync);
          rafId = window.setTimeout(cb, 80);
        }
      };
      rafId = window.setTimeout(poll, 6);
    }

    function animateTick() {
      if (disposed) return;
      if (!propsRef.current.isActive) {
        loopRunning = false;
        return;
      }
      loopRunning = true;
      const dt = Math.min(0.06, clock.getDelta());
      const elapsed = clock.elapsedTime;
      const cur = propsRef.current;
      const activeEdit = cur.tapeEdits[cur.selectedTapeId] || DEFAULT_EDIT;

      if (cur.cameraPreset !== lastCameraPreset) {
        lastCameraPreset = cur.cameraPreset;
        cameraTransitionActive = true;
      }

      if (cameraTransitionActive) {
        const spec = getResponsiveCameraSpec(cur.cameraPreset, currentAspect);
        camera.fov = THREE.MathUtils.damp(camera.fov, spec.fov, 4.5, dt);
        camera.updateProjectionMatrix();
        _targetCamPos.set(...spec.pos);
        _targetLookAt.set(...spec.target);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 4.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 4.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 4.5, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLookAt.x, 4.5, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLookAt.y, 4.5, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLookAt.z, 4.5, dt);
        if (camera.position.distanceTo(_targetCamPos) < 0.015) {
          cameraTransitionActive = false;
        }
      }

      if (cur.flipSeq !== prevFlipSeq) {
        prevFlipSeq = cur.flipSeq;
        flipTimer = 1.05;
      }
      if (cur.rewindSeq !== prevRewindSeq) {
        prevRewindSeq = cur.rewindSeq;
        rewindTimer = 1.15;
      }
      if (cur.stampSeq !== prevStampSeq) {
        prevStampSeq = cur.stampSeq;
        stampTimer = 0.95;
      }

      if (flipTimer > 0) flipTimer = Math.max(0, flipTimer - dt);
      if (rewindTimer > 0) rewindTimer = Math.max(0, rewindTimer - dt);
      if (stampTimer > 0) stampTimer = Math.max(0, stampTimer - dt);

      const editSig = `${cur.selectedTapeId}:${activeEdit.speed.toFixed(2)}:${activeEdit.warmth.toFixed(2)}:${activeEdit.echo.toFixed(2)}:${activeEdit.isSideB}:${activeEdit.editedLabel || ''}`;
      if (cur.selectedTapeId !== prevSelectedId || editSig !== prevEditSig) {
        prevSelectedId = cur.selectedTapeId;
        prevEditSig = editSig;
        const selItem = cur.tapes.find((x) => x.id === cur.selectedTapeId) || cur.tapes[0];
        drawNotebookCanvas(nbCanvas, selItem, activeEdit);
        nbTex.needsUpdate = true;

        const rt = cassetteRuntimes.get(cur.selectedTapeId);
        if (rt) {
          drawCassetteLabelCanvas(rt.labelCanvasA, rt.item, 'A', activeEdit);
          drawCassetteLabelCanvas(rt.labelCanvasB, rt.item, 'B', activeEdit);
          rt.labelTexA.needsUpdate = true;
          rt.labelTexB.needsUpdate = true;
        }
      }

      const audioMetrics = djAudioController.getCombinedBassAndSpectrum();
      const beatPulse = cur.isPlaying
        ? Math.max(
            audioMetrics.bass * 0.8 + audioMetrics.mid * 0.45,
            0.28 + Math.abs(Math.sin(elapsed * ((activeEdit.speed * 110) / 30))) * 0.35
          )
        : 0;

      // Animate glowing studio orb gently
      orbCorePivot.rotation.y = elapsed * 0.32;
      orbCorePivot.rotation.z = Math.sin(elapsed * 0.6) * 0.08;
      orbPointLight.intensity = 3.2 + activeEdit.warmth * 1.4 + beatPulse * 0.65;
      haloMat.opacity = 0.48 + activeEdit.warmth * 0.22 + beatPulse * 0.14;

      const doorOpenFactor = flipTimer > 0.35 ? 0.68 : cur.isPlaying ? 0.02 : 0.08;
      deckDoorPivot.rotation.x = THREE.MathUtils.damp(deckDoorPivot.rotation.x, doorOpenFactor, 7.5, dt);

      const activeBpm = (cassetteRuntimes.get(cur.selectedTapeId)?.item.bpm || 110) * activeEdit.speed;
      if (rewindTimer > 0) {
        reelAngle -= dt * 18.0;
        rwLedMat.color.set('#f59e0b');
        playLedMat.color.set('#334155');
      } else if (cur.isPlaying) {
        reelAngle += dt * (2.6 * (activeBpm / 110));
        playLedMat.color.set('#34d399');
        rwLedMat.color.set('#334155');
      } else {
        playLedMat.color.set('#334155');
        rwLedMat.color.set('#334155');
      }
      capstanL.rotation.y = reelAngle;
      capstanR.rotation.y = reelAngle;

      vuNeedles.forEach((np, i) => {
        const targetAngle = cur.isPlaying
          ? 0.42 - (beatPulse * (i === 0 ? 0.82 : 0.72) + Math.sin(elapsed * 9 + i) * 0.08)
          : 0.46;
        np.rotation.z = THREE.MathUtils.damp(np.rotation.z, targetAngle, 14, dt);
      });

      const knobVals = [
        ((activeEdit.speed - 0.75) / 0.5) * 3.8 - 1.9,
        activeEdit.warmth * 3.8 - 1.9,
        activeEdit.echo * 3.8 - 1.9
      ];
      rotaryKnobs.forEach((k, i) => {
        k.rotation.z = THREE.MathUtils.damp(k.rotation.z, -knobVals[i], 10, dt);
      });

      if (stampTimer > 0) {
        const pNorm = 1 - stampTimer / 0.95;
        penGroup.position.set(
          -0.06 + Math.sin(pNorm * Math.PI * 5) * 0.14,
          0.1 + Math.abs(Math.sin(pNorm * Math.PI * 3)) * 0.04,
          0.02 + Math.cos(pNorm * Math.PI * 4) * 0.06
        );
        penGroup.rotation.set(0.25, -0.45, -0.45);
      } else {
        penGroup.position.x = THREE.MathUtils.damp(penGroup.position.x, penRestPos.x, 8, dt);
        penGroup.position.y = THREE.MathUtils.damp(penGroup.position.y, penRestPos.y, 8, dt);
        penGroup.position.z = THREE.MathUtils.damp(penGroup.position.z, penRestPos.z, 8, dt);
        penGroup.rotation.x = THREE.MathUtils.damp(penGroup.rotation.x, 0, 8, dt);
        penGroup.rotation.y = THREE.MathUtils.damp(penGroup.rotation.y, -0.5, 8, dt);
        penGroup.rotation.z = THREE.MathUtils.damp(penGroup.rotation.z, 0, 8, dt);
      }

      if (deckBakedTapeObj) {
        deckBakedTapeObj.visible = !(cur.isPlaying && flipTimer <= 0.1);
      }

      cassetteRuntimes.forEach((rt) => {
        const isSelected = rt.id === cur.selectedTapeId;
        const edit = cur.tapeEdits[rt.id] || DEFAULT_EDIT;
        const sideYOffset = edit.isSideB ? Math.PI : 0;

        if (isSelected && cur.isPlaying && flipTimer <= 0.1) {
          if (hasGlbDeck) {
            insertedBayAnchor.getWorldPosition(_v1);
            insertedBayAnchor.getWorldQuaternion(_quatA);
            _eulerTmp.set(0, sideYOffset, 0);
            _quatB.setFromEuler(_eulerTmp);
            _quatA.multiply(_quatB);
          } else {
            _v1.copy(deckSlotWorld);
            _eulerTmp.set(0, deckSlotRotY + sideYOffset, 0);
            _quatA.setFromEuler(_eulerTmp);
          }
          rt.group.position.x = THREE.MathUtils.damp(rt.group.position.x, _v1.x, 7.2, dt);
          rt.group.position.y = THREE.MathUtils.damp(rt.group.position.y, _v1.y, 7.2, dt);
          rt.group.position.z = THREE.MathUtils.damp(rt.group.position.z, _v1.z, 7.2, dt);
          rt.group.quaternion.slerp(_quatA, 1 - Math.exp(-8 * dt));

          const targetBayScale = hasGlbDeck ? 0.86 : 1.0;
          rt.group.scale.x = THREE.MathUtils.damp(rt.group.scale.x, targetBayScale, 8, dt);
          rt.group.scale.y = THREE.MathUtils.damp(rt.group.scale.y, targetBayScale, 8, dt);
          rt.group.scale.z = THREE.MathUtils.damp(rt.group.scale.z, targetBayScale, 8, dt);

          rt.leftReel.rotation.z = -reelAngle;
          rt.rightReel.rotation.z = -reelAngle;
        } else if (isSelected && flipTimer > 0) {
          const p = 1 - flipTimer / 1.05;
          const arcLift = Math.sin(p * Math.PI) * 0.4;
          _v2.set(rt.restPos.x, rt.restPos.y + 0.14 + arcLift, rt.restPos.z - 0.1);
          rt.group.position.x = THREE.MathUtils.damp(rt.group.position.x, _v2.x, 12, dt);
          rt.group.position.y = THREE.MathUtils.damp(rt.group.position.y, _v2.y, 12, dt);
          rt.group.position.z = THREE.MathUtils.damp(rt.group.position.z, _v2.z, 12, dt);

          const spinY = sideYOffset - (1 - p) * Math.PI;
          const tiltX = Math.sin(p * Math.PI) * 0.45;
          _eulerTmp.set(rt.restRot.x + tiltX, rt.restRot.y + spinY, 0);
          _quatA.setFromEuler(_eulerTmp);
          rt.group.quaternion.slerp(_quatA, 1 - Math.exp(-16 * dt));

          rt.group.scale.x = THREE.MathUtils.damp(rt.group.scale.x, 1.0, 10, dt);
          rt.group.scale.y = THREE.MathUtils.damp(rt.group.scale.y, 1.0, 10, dt);
          rt.group.scale.z = THREE.MathUtils.damp(rt.group.scale.z, 1.0, 10, dt);
        } else {
          const liftY = isSelected ? 0.08 + Math.sin(elapsed * 2.4) * 0.012 : 0;
          const popZ = isSelected ? -0.05 : 0;
          rt.group.position.x = THREE.MathUtils.damp(rt.group.position.x, rt.restPos.x, 8, dt);
          rt.group.position.y = THREE.MathUtils.damp(rt.group.position.y, rt.restPos.y + liftY, 8, dt);
          rt.group.position.z = THREE.MathUtils.damp(rt.group.position.z, rt.restPos.z + popZ, 8, dt);

          const targetTiltX = isSelected ? -0.18 : rt.restRot.x;
          _eulerTmp.set(targetTiltX, rt.restRot.y + sideYOffset, 0);
          _quatA.setFromEuler(_eulerTmp);
          rt.group.quaternion.slerp(_quatA, 1 - Math.exp(-9 * dt));

          rt.group.scale.x = THREE.MathUtils.damp(rt.group.scale.x, 1.0, 10, dt);
          rt.group.scale.y = THREE.MathUtils.damp(rt.group.scale.y, 1.0, 10, dt);
          rt.group.scale.z = THREE.MathUtils.damp(rt.group.scale.z, 1.0, 10, dt);

          if (isSelected && rewindTimer > 0) {
            rt.leftReel.rotation.z = -reelAngle;
            rt.rightReel.rotation.z = -reelAngle;
          }
        }
      });

      const activeRt = cassetteRuntimes.get(cur.selectedTapeId);
      if (activeRt) {
        selGlow.position.x = THREE.MathUtils.damp(selGlow.position.x, activeRt.restPos.x, 10, dt);
        selGlow.position.z = THREE.MathUtils.damp(selGlow.position.z, activeRt.restPos.z, 10, dt);
        selGlowMat.opacity = cur.isPlaying ? 0.18 : 0.44 + Math.sin(elapsed * 3) * 0.12;
      }

      controls.update();
      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }

      if (propsRef.current.isActive) {
        scheduleNextFrame();
      } else {
        loopRunning = false;
      }
    }

    if (propsRef.current.isActive) {
      animateTick();
    }

    return () => {
      disposed = true;
      resumeLoopRef.current = null;
      cancelAnimationFrame(rafId);
      clearTimeout(rafId);
      resizeObs.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('webglcontextlost', handleContextLost);
      pmrem.dispose();
      currentEnvTarget?.dispose();
      composer?.dispose();
      for (const g of glbRoots) {
        disposeObject3DTree(g);
      }
      for (const d of disposables) {
        try {
          d.dispose();
        } catch {
          // ignore
        }
      }
      renderer.dispose();
    };
  }, []);

  if (webglError) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-b from-[#1f1c1a] to-[#0d0c0b] text-center p-6">
        <p className="text-sm font-semibold text-[#f3e5ab]">
          نمای استودیو سه‌بعدی در حال آماده‌سازی است
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
    />
  );
}
