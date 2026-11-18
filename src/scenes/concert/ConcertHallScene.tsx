import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial, useGLTF } from '@react-three/drei';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { djAudioController } from '../../prototype/djAudioEngine';
import type {
  RoomCameraPreset,
  RoomLightingFxMode,
  RoomMoveInput
} from '../../prototype/components/SonicRoom3DWorld';
import {
  DEFAULT_ROOM_LIGHTING_PROFILES,
  type RoomLightingCalibration
} from '../../types/lighting';
import {
  DRACO_DECODER_URL,
  HUMAN_ARCHETYPES,
  preloadConcertAssets,
  resolveConcertAssetManifest,
  type ConcertAssetManifest,
  type HumanArchetypePreset
} from './concertAssets';
import { sampleMusicSyncLighting, SceneReadySignal } from '../shared/SonicRoomShared';
import { usePolyHavenPBR } from '../shared/polyhavenTextures';
import { assignPeersToCastSlots, PeerOverheadBadge, type AssignedCastPeer } from '../shared/RoomPeerAvatars';
import type { RoomPeerParticipant } from '../../types/roomSync';

interface ConcertHallSceneProps {
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
  isActive?: boolean;
  onReady?: () => void;
  onInteractHotspot?: (action: 'toggle_play' | 'next_track' | 'trigger_fx' | 'open_dj') => void;
}

const STAGE_SURFACE_Y = 1.2;
const DRUM_RISER_TOP_Y = 1.55;

type DanceClipName = 'dance_sway' | 'dance_groove' | 'dance_hands_up' | 'dance_bounce';

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

function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

class ConcertErrorBoundary extends Component<
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

function createParFlareTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  grad.addColorStop(0.35, 'rgba(255, 224, 178, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createStageWoodTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 512;
  const cMap = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  cMap.width = cBump.width = size;
  cMap.height = cBump.height = size;
  const ctx = cMap.getContext('2d')!;
  const bCtx = cBump.getContext('2d')!;

  ctx.fillStyle = '#15101b';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  const slats = 16;
  const slatW = size / slats;
  for (let i = 0; i < slats; i++) {
    const shade = 16 + ((i * 19) % 14);
    ctx.fillStyle = `rgb(${shade + 10}, ${shade}, ${shade + 8})`;
    ctx.fillRect(i * slatW + 2, 0, slatW - 4, size);

    for (let g = 0; g < 16; g++) {
      const gx = i * slatW + 3 + ((g * 7) % (slatW - 6));
      ctx.fillStyle = g % 2 === 0 ? 'rgba(0,0,0,0.22)' : 'rgba(255,210,170,0.04)';
      ctx.fillRect(gx, 0, 1.5, size);
    }

    bCtx.fillStyle = '#b4b4b4';
    bCtx.fillRect(i * slatW + 2, 0, slatW - 4, size);
    bCtx.fillStyle = '#383838';
    bCtx.fillRect(i * slatW, 0, 2, size);
  }

  const map = new THREE.CanvasTexture(cMap);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 2);

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 2);
  return { map, bumpMap };
}

function createCarpetTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 256;
  const cMap = document.createElement('canvas');
  const cBump = document.createElement('canvas');
  cMap.width = cBump.width = size;
  cMap.height = cBump.height = size;
  const ctx = cMap.getContext('2d')!;
  const bCtx = cBump.getContext('2d')!;

  ctx.fillStyle = '#0d0c16';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const n = ((x * 37 + y * 57) % 17) / 17;
      const v = Math.floor(10 + n * 10);
      ctx.fillStyle = `rgb(${v + 4}, ${v + 2}, ${v + 8})`;
      ctx.fillRect(x, y, 3, 3);
      const bv = Math.floor(100 + n * 45);
      bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bCtx.fillRect(x, y, 2, 2);
    }
  }

  const map = new THREE.CanvasTexture(cMap);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(14, 18);

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(14, 18);
  return { map, bumpMap };
}

function createSpeakerGrilleTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1e293b';
  for (let y = 4; y < size; y += 8) {
    for (let x = 4; x < size; x += 8) {
      ctx.beginPath();
      ctx.arc(x + ((y / 8) % 2) * 4, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 6);
  return tex;
}

/**
 * Narrow, ultra-soft additive volumetric spotlight beam cone shader (opacity 0.06 default)
 */
function createVolumetricBeamShader(hexColor: string, opacity = 0.06): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(hexColor) },
      uTime: { value: 0 },
      uBassHit: { value: 0.35 },
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
        float fresnel = pow(abs(dot(normalize(vNormalView), viewDir)), 3.4);
        float lengthFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
        float shimmer = 0.92 + 0.08 * sin(vUv.y * 8.0 - uTime * 2.4 + vUv.x * 6.283);
        float alpha = fresnel * lengthFade * uOpacity * (0.45 + uBassHit * 1.15) * shimmer;
        gl_FragColor = vec4(uColor * (0.95 + uBassHit * 0.55), clamp(alpha, 0.0, 0.145));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
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

/**
 * Compute normalized upright height attribute 'aBodyZone' (0.0 feet -> 1.0 crown)
 * directly on any rigged human mesh so PBR materials can customize hair, skin, jacket, and pants.
 */
function attachBodyZoneAttribute(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (mesh.geometry.getAttribute('aBodyZone')) return;

    const geo = mesh.geometry.clone();
    const pos = geo.attributes.position as THREE.BufferAttribute;
    let minY = Infinity;
    let maxY = -Infinity;
    const ys = new Float32Array(pos.count);

    for (let i = 0; i < pos.count; i++) {
      _tempVert.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      ys[i] = _tempVert.y;
      if (_tempVert.y < minY) minY = _tempVert.y;
      if (_tempVert.y > maxY) maxY = _tempVert.y;
    }

    const span = Math.max(0.01, maxY - minY);
    for (let i = 0; i < pos.count; i++) {
      ys[i] = (ys[i] - minY) / span;
    }
    geo.setAttribute('aBodyZone', new THREE.BufferAttribute(ys, 1));
    mesh.geometry = geo;
  });
}

/**
 * Tailored PBR MeshStandardMaterial for each HumanArchetypePreset:
 * - Solid dark concert fabric colors applied 100% uniformly over torso & pants
 *   so any back-shirt logo/print texture is completely eliminated
 * - Photoreal skin & tinted hair preserved on head/crown
 */
function createArchetypeMaterial(
  origMat: THREE.Material | null,
  archetype: HumanArchetypePreset,
  rimColor = '#000000',
  rimIntensity = 0
): THREE.MeshStandardMaterial {
  const isStd = Boolean(origMat && (origMat as THREE.MeshStandardMaterial).isMeshStandardMaterial);
  const mat = isStd
    ? (origMat as THREE.MeshStandardMaterial).clone()
    : new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: origMat && (origMat as THREE.MeshStandardMaterial).map ? (origMat as THREE.MeshStandardMaterial).map : null
      });

  const hasMap = Boolean(mat.map);
  mat.roughnessMap = null;
  mat.roughness = 0.72;
  mat.metalness = 0.08;
  if (rimIntensity > 0) {
    mat.emissive = new THREE.Color(rimColor);
    mat.emissiveIntensity = rimIntensity;
  }

  const uOutfit = new THREE.Color(archetype.outfitColor);
  const uPants = new THREE.Color(archetype.pantsColor);
  const uSkin = new THREE.Color(archetype.skinColor);
  const uHair = new THREE.Color(archetype.hairColor);

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uOutfit = { value: uOutfit };
    shader.uniforms.uPants = { value: uPants };
    shader.uniforms.uSkin = { value: uSkin };
    shader.uniforms.uHair = { value: uHair };
    shader.uniforms.uHasMap = { value: hasMap ? 1.0 : 0.0 };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBodyZone;\nvarying float vBodyZone;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBodyZone = aBodyZone;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uOutfit;\nuniform vec3 uPants;\nuniform vec3 uSkin;\nuniform vec3 uHair;\nuniform float uHasMap;\nvarying float vBodyZone;'
      )
      .replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float pantsW = 1.0 - smoothstep(0.45, 0.49, vBodyZone);
        float outfitW = smoothstep(0.45, 0.49, vBodyZone) * (1.0 - smoothstep(0.79, 0.825, vBodyZone));
        float skinW = smoothstep(0.79, 0.825, vBodyZone) * (1.0 - smoothstep(0.905, 0.935, vBodyZone));
        float hairW = smoothstep(0.905, 0.935, vBodyZone);

        // 100% solid fabric override on torso & pants to completely mask any shirt print/logo
        vec3 pantsCol = uPants;
        vec3 outfitCol = uOutfit;
        vec3 skinCol = uHasMap > 0.5 ? diffuseColor.rgb : uSkin;
        float texLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 hairCol = uHasMap > 0.5 ? mix(diffuseColor.rgb, uHair * (0.72 + texLum * 0.45), 0.48) : uHair;

        diffuseColor.rgb = pantsCol * pantsW + outfitCol * outfitW + skinCol * skinW + hairCol * hairW;
        `
      );
  };
  mat.customProgramCacheKey = () => `human-archetype-v5-${archetype.id}-${hasMap ? 1 : 0}-${rimIntensity}`;
  return mat;
}

function makeInPlaceClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const clonedClip = clip.clone();
  clonedClip.tracks = clonedClip.tracks.map((track) => {
    if (
      track.name === 'Hips.position' ||
      track.name.endsWith('.Hips.position') ||
      track.name.endsWith('mixamorigHips.position')
    ) {
      const t = track.clone();
      const vals = t.values;
      const x0 = vals[0];
      const z0 = vals[2];
      for (let i = 0; i < vals.length; i += 3) {
        vals[i] = x0;
        vals[i + 2] = z0;
      }
      return t;
    }
    return track;
  });
  return clonedClip;
}

function initializeRigAndDanceClips(
  root: THREE.Object3D,
  nativeAnimations: THREE.AnimationClip[],
  externalMocapClips: THREE.AnimationClip[],
  kind: 'female' | 'male',
  inPlaceOnly = false,
  danceVariant = 0
): Record<DanceClipName, THREE.AnimationClip> {
  const validNative = nativeAnimations.filter((c) => !/tpose|t-pose/i.test(c.name) && c.duration > 0.25);
  const validExternal = externalMocapClips.filter((c) => !/tpose|t-pose/i.test(c.name) && c.duration > 0.25);
  const isRpmAvatar = Boolean(root.getObjectByName('Hips')) && !root.getObjectByName('mixamorigHips');

  const sambaClip = validNative.find((c) => /samba|dance/i.test(c.name));
  const rpmIdleClip = validExternal.find((c) => /idle/i.test(c.name));
  const rpmDanceClips = validExternal.filter((c) => /dance/i.test(c.name));

  const primeClip = isRpmAvatar
    ? rpmDanceClips[danceVariant % Math.max(1, rpmDanceClips.length)] || rpmIdleClip || validNative[0]
    : kind === 'female'
      ? sambaClip || validNative[0]
      : validNative.find((c) => /idle/i.test(c.name)) || validNative[0];

  if (primeClip) {
    const tmpMx = new THREE.AnimationMixer(root);
    const act = tmpMx.clipAction(primeClip);
    act.reset().play();
    tmpMx.update(0.25);
    act.stop();
  }

  root.updateMatrixWorld(true);

  const idleBaseRoot = clone(root);
  if (isRpmAvatar && rpmIdleClip) {
    const idleMx = new THREE.AnimationMixer(idleBaseRoot);
    const iAct = idleMx.clipAction(rpmIdleClip);
    iAct.reset().play();
    idleMx.update(0.2);
    iAct.stop();
  }
  idleBaseRoot.updateMatrixWorld(true);

  aimBoneWorldDir(idleBaseRoot, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.2, -0.92, 0.22]);
  aimBoneWorldDir(idleBaseRoot, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [0.06, -0.68, 0.72]);
  aimBoneWorldDir(idleBaseRoot, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.2, -0.92, 0.22]);
  aimBoneWorldDir(idleBaseRoot, 'mixamorigRightForeArm', 'mixamorigRightHand', [-0.06, -0.68, 0.72]);
  idleBaseRoot.updateMatrixWorld(true);

  const spineName = 'mixamorigSpine1';
  const lowSpineName = 'mixamorigSpine';
  const headName = 'mixamorigHead';
  const lArmName = 'mixamorigLeftArm';
  const lForeName = 'mixamorigLeftForeArm';
  const rArmName = 'mixamorigRightArm';
  const rForeName = 'mixamorigRightForeArm';

  const capture = (obj: THREE.Object3D, n: string) =>
    findBone(obj, n)?.quaternion.clone() || new THREE.Quaternion();
  const baseSpine = capture(idleBaseRoot, spineName);
  const baseLowSpine = capture(idleBaseRoot, lowSpineName);
  const baseHead = capture(idleBaseRoot, headName);
  const baseLArm = capture(idleBaseRoot, lArmName);
  const baseRArm = capture(idleBaseRoot, rArmName);

  const raisedArmRoot = clone(idleBaseRoot);
  raisedArmRoot.updateMatrixWorld(true);
  aimBoneWorldDir(raisedArmRoot, lArmName, lForeName, [0.28, 0.88, 0.34]);
  aimBoneWorldDir(raisedArmRoot, lForeName, 'mixamorigLeftHand', [0.08, 0.94, 0.24]);
  aimBoneWorldDir(raisedArmRoot, rArmName, rForeName, [-0.28, 0.88, 0.34]);
  aimBoneWorldDir(raisedArmRoot, rForeName, 'mixamorigRightHand', [-0.08, 0.94, 0.24]);

  const upLArmQ = capture(raisedArmRoot, lArmName);
  const upLForeQ = capture(raisedArmRoot, lForeName);
  const upRArmQ = capture(raisedArmRoot, rArmName);
  const upRForeQ = capture(raisedArmRoot, rForeName);

  const midArmRoot = clone(idleBaseRoot);
  midArmRoot.updateMatrixWorld(true);
  aimBoneWorldDir(midArmRoot, rArmName, rForeName, [-0.22, -0.35, 0.9]);
  aimBoneWorldDir(midArmRoot, rForeName, 'mixamorigRightHand', [-0.08, 0.82, 0.56]);
  const midRArmQ = capture(midArmRoot, rArmName);
  const midRForeQ = capture(midArmRoot, rForeName);

  const times = [0, 0.25, 0.5, 0.75, 1.0];
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

  const makeArmWaveTrack = (bName: string, centerQ: THREE.Quaternion, ampZ: number, ampX = 0.16) => {
    const bone = findBone(root, bName);
    const actualName = bone ? bone.name : bName;
    const vals: number[] = [];
    [0, ampZ, 0, -ampZ, 0].forEach((ang, idx) => {
      _eTmp.set(idx % 2 === 1 ? ampX : -ampX * 0.5, 0, ang);
      _qTmp.copy(centerQ).multiply(new THREE.Quaternion().setFromEuler(_eTmp));
      vals.push(_qTmp.x, _qTmp.y, _qTmp.z, _qTmp.w);
    });
    return new THREE.QuaternionKeyframeTrack(`${actualName}.quaternion`, times, vals);
  };

  const handsUpClip = new THREE.AnimationClip('dance_hands_up', 1.0, [
    makeTrack(lowSpineName, baseLowSpine, [
      [-0.04, -0.05, -0.08],
      [0.02, 0.05, 0],
      [-0.04, 0.05, 0.08],
      [0.02, -0.05, 0],
      [-0.04, -0.05, -0.08]
    ]),
    makeTrack(spineName, baseSpine, [
      [-0.05, 0, -0.1],
      [0.02, 0.05, 0],
      [-0.05, 0, 0.1],
      [0.02, -0.05, 0],
      [-0.05, 0, -0.1]
    ]),
    makeTrack(headName, baseHead, [
      [-0.1, 0, 0],
      [0.1, 0, 0],
      [-0.1, 0, 0],
      [0.1, 0, 0],
      [-0.1, 0, 0]
    ]),
    makeArmWaveTrack(lArmName, upLArmQ, 0.22, 0.18),
    makeArmWaveTrack(lForeName, upLForeQ, 0.16, 0.16),
    makeArmWaveTrack(rArmName, upRArmQ, -0.22, 0.18),
    makeArmWaveTrack(rForeName, upRForeQ, -0.16, 0.16)
  ]);

  if (isRpmAvatar && validExternal.length > 0) {
    const idleSrc = rpmIdleClip || validExternal[0];
    const primaryDance = rpmDanceClips[danceVariant % Math.max(1, rpmDanceClips.length)] || idleSrc;
    const secondaryDance = rpmDanceClips[(danceVariant + 1) % Math.max(1, rpmDanceClips.length)] || primaryDance;
    return {
      dance_sway: makeInPlaceClip(idleSrc),
      dance_groove: makeInPlaceClip(primaryDance),
      dance_hands_up: handsUpClip,
      dance_bounce: makeInPlaceClip(secondaryDance)
    };
  }

  const swayClip = new THREE.AnimationClip('dance_sway', 1.0, [
    makeTrack(lowSpineName, baseLowSpine, [
      [0.02, -0.05, -0.08],
      [0.06, 0.04, 0],
      [0.02, 0.05, 0.08],
      [0.06, -0.04, 0],
      [0.02, -0.05, -0.08]
    ]),
    makeTrack(spineName, baseSpine, [
      [0.02, 0, -0.09],
      [0.07, 0.04, 0],
      [0.02, 0, 0.09],
      [0.07, -0.04, 0],
      [0.02, 0, -0.09]
    ]),
    makeTrack(headName, baseHead, [
      [-0.02, 0, 0],
      [0.16, 0.05, 0],
      [-0.02, 0, 0],
      [0.16, -0.05, 0],
      [-0.02, 0, 0]
    ]),
    makeArmWaveTrack(lArmName, baseLArm, 0.12, 0.18),
    makeArmWaveTrack(rArmName, baseRArm, -0.12, 0.18)
  ]);

  const synthGrooveClip = new THREE.AnimationClip('dance_groove', 1.0, [
    makeTrack(lowSpineName, baseLowSpine, [
      [0.04, -0.08, -0.1],
      [0.12, 0, 0],
      [0.04, 0.08, 0.1],
      [0.12, 0, 0],
      [0.04, -0.08, -0.1]
    ]),
    makeTrack(spineName, baseSpine, [
      [0.04, -0.06, -0.12],
      [0.14, 0, 0],
      [0.04, 0.06, 0.12],
      [0.14, 0, 0],
      [0.04, -0.06, -0.12]
    ]),
    makeTrack(headName, baseHead, [
      [-0.03, 0, 0],
      [0.22, 0.06, 0],
      [-0.03, 0, 0],
      [0.22, -0.06, 0],
      [-0.03, 0, 0]
    ]),
    makeArmWaveTrack(lArmName, baseLArm, 0.16, 0.24),
    makeArmWaveTrack(rArmName, midRArmQ, 0.22, 0.28),
    makeArmWaveTrack(rForeName, midRForeQ, 0.28, 0.3)
  ]);

  const bounceClip = new THREE.AnimationClip('dance_bounce', 1.0, [
    makeTrack(lowSpineName, baseLowSpine, [
      [0.02, 0, -0.08],
      [0.14, 0, 0],
      [0.02, 0, 0.08],
      [0.14, 0, 0],
      [0.02, 0, -0.08]
    ]),
    makeTrack(spineName, baseSpine, [
      [0.02, 0, -0.1],
      [0.18, 0, 0],
      [0.02, 0, 0.1],
      [0.18, 0, 0],
      [0.02, 0, -0.1]
    ]),
    makeTrack(headName, baseHead, [
      [-0.04, 0, 0],
      [0.24, 0, 0],
      [-0.04, 0, 0],
      [0.24, 0, 0],
      [-0.04, 0, 0]
    ]),
    makeArmWaveTrack(lArmName, upLArmQ, 0.26, 0.24),
    makeArmWaveTrack(lForeName, upLForeQ, 0.2, 0.2),
    makeArmWaveTrack(rArmName, midRArmQ, 0.2, 0.22)
  ]);

  const femaleGrooveClip =
    kind === 'female' && sambaClip
      ? inPlaceOnly
        ? makeInPlaceClip(sambaClip)
        : sambaClip
      : synthGrooveClip;

  return {
    dance_sway: swayClip,
    dance_groove: femaleGrooveClip,
    dance_hands_up: handsUpClip,
    dance_bounce: bounceClip
  };
}

/**
 * Frameless Cinematic Curved LED Video Wall Texture (1024x512, 2:1 widescreen):
 * - Full-bleed dark cinematic album artwork with smooth edge vignette fading seamlessly into #040508 backstage
 * - Zero equalizer bars, zero sine waves, zero borders/boxes
 * - Crisp subtle glowing typography at bottom-center
 */
function useLiveMainLedTexture({
  trackTitle,
  trackArtist,
  trackCoverUrl,
  trackAccentHex,
  bpm,
  isPlaying,
  pulseIntensity,
  isActive = true
}: {
  trackTitle: string;
  trackArtist: string;
  trackCoverUrl?: string;
  trackAccentHex: string;
  bpm: number;
  isPlaying: boolean;
  pulseIntensity: number;
  isActive?: boolean;
}): THREE.CanvasTexture {
  const { canvas, ctx, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const context = c.getContext('2d')!;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    return { canvas: c, ctx: context, texture: tex };
  }, []);

  const coverImgRef = useRef<HTMLImageElement | null>(null);
  const coverLoadedRef = useRef(false);
  const lastDrawMsRef = useRef(0);

  useEffect(() => {
    coverLoadedRef.current = false;
    if (!trackCoverUrl) {
      coverImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      coverImgRef.current = img;
      coverLoadedRef.current = true;
    };
    img.onerror = () => {
      coverImgRef.current = null;
      coverLoadedRef.current = false;
    };
    img.src = trackCoverUrl;
  }, [trackCoverUrl]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useFrame(({ clock }) => {
    if (!isActive) return;
    const nowMs = performance.now();
    if (nowMs - lastDrawMsRef.current < 48) return;
    lastDrawMsRef.current = nowMs;

    const t = clock.getElapsedTime();
    const audio = djAudioController.getCombinedBassAndSpectrum();
    const beatHz = Math.max(60, bpm) / 60;
    const synthPulse = isPlaying ? Math.pow(Math.max(0, Math.sin(t * beatHz * Math.PI * 2)), 2.2) : 0.1;
    const bass = Math.min(1.0, Math.max(audio.bass, synthPulse * pulseIntensity));

    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = '#040508';
    ctx.fillRect(0, 0, W, H);

    // Full-bleed dark cinematic album artwork
    if (coverLoadedRef.current && coverImgRef.current) {
      const img = coverImgRef.current;
      const imgAspect = img.naturalWidth > 0 ? img.naturalWidth / img.naturalHeight : 1;
      const canvasAspect = W / H;
      const zoom = 1.02 + bass * 0.025;
      let drawW = W * zoom;
      let drawH = drawW / imgAspect;
      if (drawH < H * zoom) {
        drawH = H * zoom;
        drawW = drawH * imgAspect;
      }
      if (canvasAspect > imgAspect) {
        drawW = W * zoom;
        drawH = drawW / imgAspect;
      }
      const dx = (W - drawW) * 0.5;
      const dy = (H - drawH) * 0.42;

      ctx.save();
      ctx.globalAlpha = 0.78 + bass * 0.1;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();
    } else {
      const accent = trackAccentHex || '#7c3aed';
      const darkGrad = ctx.createRadialGradient(W * 0.5, H * 0.42, 30, W * 0.5, H * 0.5, W * 0.55);
      darkGrad.addColorStop(0, `rgba(46, 26, 68, ${0.7 + bass * 0.15})`);
      darkGrad.addColorStop(0.5, 'rgba(14, 16, 28, 0.88)');
      darkGrad.addColorStop(1, '#040508');
      ctx.fillStyle = darkGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.globalAlpha = 0.22 + bass * 0.1;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.44, 140 + bass * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.44, 86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Smooth dark vignette blending all 4 edges seamlessly into #040508 backstage
    const radialVignette = ctx.createRadialGradient(W * 0.5, H * 0.44, W * 0.16, W * 0.5, H * 0.48, W * 0.52);
    radialVignette.addColorStop(0, 'rgba(4, 5, 8, 0.14)');
    radialVignette.addColorStop(0.55, 'rgba(4, 5, 8, 0.58)');
    radialVignette.addColorStop(0.85, 'rgba(4, 5, 8, 0.92)');
    radialVignette.addColorStop(1, '#040508');
    ctx.fillStyle = radialVignette;
    ctx.fillRect(0, 0, W, H);

    const sideGradL = ctx.createLinearGradient(0, 0, W * 0.18, 0);
    sideGradL.addColorStop(0, '#040508');
    sideGradL.addColorStop(1, 'rgba(4, 5, 8, 0)');
    ctx.fillStyle = sideGradL;
    ctx.fillRect(0, 0, W * 0.18, H);

    const sideGradR = ctx.createLinearGradient(W * 0.82, 0, W, 0);
    sideGradR.addColorStop(0, 'rgba(4, 5, 8, 0)');
    sideGradR.addColorStop(1, '#040508');
    ctx.fillStyle = sideGradR;
    ctx.fillRect(W * 0.82, 0, W * 0.18, H);

    const bottomFade = ctx.createLinearGradient(0, H * 0.48, 0, H);
    bottomFade.addColorStop(0, 'rgba(4, 5, 8, 0)');
    bottomFade.addColorStop(0.6, 'rgba(4, 5, 8, 0.72)');
    bottomFade.addColorStop(1, '#040508');
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, H * 0.48, W, H * 0.52);

    const topFade = ctx.createLinearGradient(0, 0, 0, H * 0.16);
    topFade.addColorStop(0, '#040508');
    topFade.addColorStop(1, 'rgba(4, 5, 8, 0)');
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, W, H * 0.16);

    // Crisp, subtle glowing typography at bottom-center
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.98)';
    ctx.shadowBlur = 14;

    const cleanTitle = (trackTitle || 'ضربان نیمهشب در ایستگاه نئون').slice(0, 48);
    ctx.direction = /[\u0600-\u06FF]/.test(cleanTitle) ? 'rtl' : 'ltr';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 32px "Vazirmatn", system-ui, -apple-system, sans-serif';
    ctx.fillText(cleanTitle, W * 0.5, H - 72);

    const cleanArtist = (trackArtist || 'آکیرا ساتو و ارکستر آنالوگ کیوتو').slice(0, 52);
    ctx.direction = /[\u0600-\u06FF]/.test(cleanArtist) ? 'rtl' : 'ltr';
    ctx.fillStyle = '#ffddaa';
    ctx.shadowColor = 'rgba(255, 221, 170, 0.35)';
    ctx.shadowBlur = 10;
    ctx.font = '500 20px "Vazirmatn", system-ui, -apple-system, sans-serif';
    ctx.fillText(cleanArtist, W * 0.5, H - 36);
    ctx.restore();

    texture.needsUpdate = true;
  });

  return texture;
}

/**
 * Rigged Human Stage Performer (Lead Vocalist + 3 Band Members)
 */
function StageHumanPerformer({
  modelUrl,
  mocapClips,
  kind,
  archetype,
  position,
  rotation,
  targetHeight,
  rimColor,
  instrument,
  isPlaying,
  bpm,
  isActive = true,
  onClick,
  children
}: {
  modelUrl: string;
  mocapClips: THREE.AnimationClip[];
  kind: 'female' | 'male';
  archetype: HumanArchetypePreset;
  position: [number, number, number];
  rotation: [number, number, number];
  targetHeight: number;
  rimColor: string;
  instrument: 'vocals' | 'guitar' | 'synth' | 'drums';
  isPlaying: boolean;
  bpm: number;
  isActive?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const gltf = useGLTF(modelUrl, DRACO_DECODER_URL);

  const { clonedScene, mixer, actions } = useMemo(() => {
    const cloned = clone(gltf.scene);
    attachBodyZoneAttribute(cloned);

    const clips = initializeRigAndDanceClips(cloned, gltf.animations, mocapClips, kind, true, 0);
    const mx = new THREE.AnimationMixer(cloned);

    const actionMap: Record<DanceClipName, THREE.AnimationAction> = {
      dance_sway: mx.clipAction(clips.dance_sway),
      dance_groove: mx.clipAction(clips.dance_groove),
      dance_hands_up: mx.clipAction(clips.dance_hands_up),
      dance_bounce: mx.clipAction(clips.dance_bounce)
    };

    actionMap.dance_groove.reset().play();
    mx.update(0.2);

    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = size.y > 0.01 ? targetHeight / size.y : 1;
    cloned.scale.setScalar(scale);

    cloned.updateMatrixWorld(true);
    box.setFromObject(cloned);
    cloned.position.y -= box.min.y;

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        mesh.material = createArchetypeMaterial(origMat || null, archetype, rimColor, 0.1);
      }
    });

    return { clonedScene: cloned, mixer: mx, actions: actionMap };
  }, [archetype, gltf.animations, gltf.scene, kind, mocapClips, rimColor, targetHeight]);

  const activeNameRef = useRef<DanceClipName>('dance_groove');

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  useFrame(({ clock }, delta) => {
    if (!isActive) return;
    const audio = djAudioController.getCombinedBassAndSpectrum();
    const t = clock.getElapsedTime();
    const beatHz = Math.max(60, bpm) / 60;
    const synthEnergy = isPlaying ? 0.45 + 0.4 * Math.sin(t * beatHz * Math.PI * 0.5) : 0.1;
    const energy = Math.max(audio.bass * 0.65 + audio.mid * 0.35, synthEnergy);

    const desiredClip: DanceClipName =
      !isPlaying
        ? 'dance_sway'
        : instrument === 'vocals' && energy > 0.68
          ? 'dance_bounce'
          : 'dance_groove';

    if (desiredClip !== activeNameRef.current) {
      const prev = actions[activeNameRef.current];
      const next = actions[desiredClip];
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      prev.crossFadeTo(next, 0.45, true);
      activeNameRef.current = desiredClip;
    }

    const rate = isPlaying ? (Math.max(60, bpm) / 120) * (0.9 + audio.bass * 0.25) : 0.28;
    mixer.update(Math.min(0.08, delta) * rate);

    if (!findBone(clonedScene, 'mixamorigRightArm')) return;
    const beatOsc = isPlaying ? Math.sin(t * beatHz * Math.PI * 2) * 0.14 : 0;
    const beatCos = isPlaying ? Math.cos(t * beatHz * Math.PI * 2) * 0.14 : 0;

    if (instrument === 'vocals') {
      aimBoneWorldDir(clonedScene, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.15, -0.62, 0.74]);
      aimBoneWorldDir(clonedScene, 'mixamorigRightForeArm', 'mixamorigRightHand', [0.22, 0.78 + beatOsc * 0.35, 0.58]);
    } else if (instrument === 'guitar') {
      aimBoneWorldDir(clonedScene, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.3, -0.7, 0.62]);
      aimBoneWorldDir(clonedScene, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [-0.42, 0.12, 0.86]);
      aimBoneWorldDir(clonedScene, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.26, -0.76, 0.58]);
      aimBoneWorldDir(clonedScene, 'mixamorigRightForeArm', 'mixamorigRightHand', [0.5, -0.14 + beatOsc, 0.82]);
    } else if (instrument === 'synth') {
      aimBoneWorldDir(clonedScene, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.16, -0.64, 0.74]);
      aimBoneWorldDir(clonedScene, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [0.05, -0.12 + beatOsc, 0.95]);
      aimBoneWorldDir(clonedScene, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.16, -0.64, 0.74]);
      aimBoneWorldDir(clonedScene, 'mixamorigRightForeArm', 'mixamorigRightHand', [-0.05, -0.12 + beatCos, 0.95]);
    } else {
      aimBoneWorldDir(clonedScene, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.22, -0.58, 0.78]);
      aimBoneWorldDir(clonedScene, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [-0.05, -0.15 + beatOsc, 0.95]);
      aimBoneWorldDir(clonedScene, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.22, -0.58, 0.78]);
      aimBoneWorldDir(clonedScene, 'mixamorigRightForeArm', 'mixamorigRightHand', [0.05, -0.15 + beatCos, 0.95]);
    }
  });

  const guitarBodyGeo = useMemo(() => {
    if (instrument !== 'guitar') return null;
    const s = new THREE.Shape();
    s.moveTo(0, -0.24);
    s.bezierCurveTo(0.22, -0.24, 0.23, -0.02, 0.11, 0.04);
    s.bezierCurveTo(0.2, 0.14, 0.18, 0.25, 0.1, 0.24);
    s.lineTo(0.04, 0.16);
    s.lineTo(-0.04, 0.16);
    s.lineTo(-0.11, 0.25);
    s.bezierCurveTo(-0.19, 0.23, -0.2, 0.11, -0.11, 0.03);
    s.bezierCurveTo(-0.23, -0.03, -0.22, -0.24, 0, -0.24);
    return new THREE.ExtrudeGeometry(s, {
      depth: 0.042,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      bevelSegments: 3
    });
  }, [instrument]);

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
    >
      <group position={[0, 0, instrument === 'drums' ? -0.35 : 0]}>
        <primitive object={clonedScene} />
      </group>

      {instrument === 'vocals' && (
        <group position={[0, 0, 0.48]}>
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.19, 0.036, 28]} />
            <meshPhysicalMaterial color="#111827" roughness={0.22} metalness={0.9} clearcoat={0.8} />
          </mesh>
          <mesh position={[0, 0.74, 0]} castShadow>
            <cylinderGeometry args={[0.013, 0.016, 1.46, 14]} />
            <meshPhysicalMaterial color="#e2e8f0" roughness={0.12} metalness={0.96} clearcoat={1} />
          </mesh>
          <mesh position={[0, 1.48, -0.06]} rotation={[0.45, 0, 0]}>
            <cylinderGeometry args={[0.017, 0.014, 0.18, 14]} />
            <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.85} />
          </mesh>
          <mesh position={[0, 1.55, -0.1]}>
            <sphereGeometry args={[0.03, 18, 18]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.18} metalness={0.95} />
          </mesh>
        </group>
      )}

      {instrument === 'guitar' && guitarBodyGeo && (
        <group>
          <group position={[0.04, 1.0, 0.25]} rotation={[0.14, 0.16, -0.36]}>
            <mesh geometry={guitarBodyGeo} position={[0, 0, -0.021]} castShadow>
              <meshPhysicalMaterial color="#881337" roughness={0.16} metalness={0.28} clearcoat={1} clearcoatRoughness={0.06} />
            </mesh>
            <mesh position={[0, -0.02, 0.028]}>
              <boxGeometry args={[0.09, 0.038, 0.012]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.18} metalness={0.92} />
            </mesh>
            <mesh position={[0, 0.06, 0.028]}>
              <boxGeometry args={[0.09, 0.038, 0.012]} />
              <meshStandardMaterial color="#111827" roughness={0.35} metalness={0.7} />
            </mesh>
            <mesh position={[-0.36, 0.32, 0.005]} rotation={[0, 0, Math.PI / 3.4]}>
              <boxGeometry args={[0.048, 0.72, 0.024]} />
              <meshStandardMaterial color="#451a03" roughness={0.38} />
            </mesh>
          </group>
          <group position={[-0.78, 0, -0.56]}>
            <mesh position={[0, 0.44, 0]} castShadow>
              <boxGeometry args={[0.76, 0.88, 0.42]} />
              <meshStandardMaterial color="#0f1117" roughness={0.78} metalness={0.15} />
            </mesh>
            <mesh position={[0, 0.99, 0]} castShadow>
              <boxGeometry args={[0.7, 0.22, 0.34]} />
              <meshPhysicalMaterial color="#18181b" roughness={0.35} metalness={0.7} clearcoat={0.5} />
            </mesh>
            <mesh position={[0, 0.99, 0.175]}>
              <boxGeometry args={[0.58, 0.04, 0.01]} />
              <meshStandardMaterial color="#ffcf70" roughness={0.18} metalness={0.95} />
            </mesh>
          </group>
        </group>
      )}

      {instrument === 'synth' && (
        <group position={[0, 0, 0.56]}>
          <mesh position={[-0.48, 0.48, 0]} rotation={[0.18, 0, 0]}>
            <boxGeometry args={[0.042, 0.98, 0.045]} />
            <meshPhysicalMaterial color="#64748b" metalness={0.92} roughness={0.2} clearcoat={0.7} />
          </mesh>
          <mesh position={[0.48, 0.48, 0]} rotation={[-0.18, 0, 0]}>
            <boxGeometry args={[0.042, 0.98, 0.045]} />
            <meshPhysicalMaterial color="#64748b" metalness={0.92} roughness={0.2} clearcoat={0.7} />
          </mesh>
          <mesh position={[0, 0.96, 0]} castShadow>
            <boxGeometry args={[1.38, 0.095, 0.46]} />
            <meshPhysicalMaterial color="#090d16" roughness={0.2} metalness={0.8} clearcoat={0.95} />
          </mesh>
          <mesh position={[0, 1.012, 0.08]}>
            <boxGeometry args={[1.22, 0.022, 0.18]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.14} />
          </mesh>
          {Array.from({ length: 16 }).map((_, k) => (
            <mesh key={k} position={[-0.54 + k * 0.072, 1.028, 0.03]}>
              <boxGeometry args={[0.022, 0.016, 0.1]} />
              <meshStandardMaterial color="#020617" roughness={0.25} />
            </mesh>
          ))}
        </group>
      )}

      {instrument === 'drums' && (
        <group position={[0, 0, 0.35]}>
          <mesh position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.5, 28]} />
            <meshPhysicalMaterial color="#3b0764" roughness={0.16} metalness={0.62} clearcoat={1} />
          </mesh>
          <mesh position={[0, 0.38, 0.254]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.38, 0.022, 10, 32]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.14} metalness={0.96} />
          </mesh>
          <mesh position={[0, 0.38, 0.252]}>
            <circleGeometry args={[0.35, 28]} />
            <meshStandardMaterial color="#090714" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.38, 0.255]}>
            <ringGeometry args={[0.14, 0.17, 28]} />
            <meshBasicMaterial color="#ffcf70" toneMapped={false} />
          </mesh>
          <mesh position={[-0.24, 0.78, -0.05]} rotation={[0.22, 0, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 0.16, 20]} />
            <meshPhysicalMaterial color="#4c1d95" roughness={0.18} metalness={0.58} clearcoat={1} />
          </mesh>
          <mesh position={[0.24, 0.78, -0.05]} rotation={[0.22, 0, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.17, 20]} />
            <meshPhysicalMaterial color="#4c1d95" roughness={0.18} metalness={0.58} clearcoat={1} />
          </mesh>
          <mesh position={[-0.48, 0.58, -0.18]} castShadow>
            <cylinderGeometry args={[0.17, 0.17, 0.14, 20]} />
            <meshPhysicalMaterial color="#e2e8f0" roughness={0.16} metalness={0.92} clearcoat={0.9} />
          </mesh>
          <mesh position={[0.52, 0.52, -0.14]} castShadow>
            <cylinderGeometry args={[0.21, 0.21, 0.36, 20]} />
            <meshPhysicalMaterial color="#3b0764" roughness={0.18} metalness={0.58} clearcoat={1} />
          </mesh>
          {[
            { x: -0.78, y: 1.14, z: -0.06, r: 0.26 },
            { x: 0.8, y: 1.18, z: -0.04, r: 0.29 },
            { x: -0.74, y: 0.92, z: -0.32, r: 0.19 }
          ].map((c, idx) => (
            <group key={idx} position={[c.x, 0, c.z]}>
              <mesh position={[0, c.y * 0.5, 0]}>
                <cylinderGeometry args={[0.011, 0.014, c.y, 10]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.16} metalness={0.96} />
              </mesh>
              <mesh position={[0, c.y, 0]} rotation={[0.16, 0, idx === 0 ? 0.14 : -0.14]}>
                <cylinderGeometry args={[c.r, c.r, 0.012, 28]} />
                <meshPhysicalMaterial color="#d97706" roughness={0.18} metalness={0.95} clearcoat={0.75} />
              </mesh>
            </group>
          ))}
        </group>
      )}
      {children}
    </group>
  );
}

const SHARED_CROWD_MAT_CACHE = new Map<string, THREE.MeshStandardMaterial>();

function getSharedCrowdMaterial(
  origMat: THREE.Material | null,
  archetype: HumanArchetypePreset,
  silhouette = false
): THREE.MeshStandardMaterial {
  const key = `${origMat ? origMat.uuid : 'none'}-${archetype.id}-${silhouette ? 'sil' : 'lit'}`;
  const existing = SHARED_CROWD_MAT_CACHE.get(key);
  if (existing) return existing;
  const mat = silhouette
    ? createArchetypeMaterial(
        origMat,
        {
          ...archetype,
          outfitColor: '#241a32',
          pantsColor: '#14111c',
          skinColor: '#564148',
          hairColor: '#18141f'
        },
        '#e838ff',
        0.12
      )
    : createArchetypeMaterial(origMat, archetype);
  SHARED_CROWD_MAT_CACHE.set(key, mat);
  return mat;
}

const SHARED_PHONE_GEO = new THREE.BoxGeometry(1, 1, 1);
const SHARED_PHONE_MAT = new THREE.MeshStandardMaterial({
  color: '#090d16',
  emissive: '#ffe8c2',
  emissiveIntensity: 1.65,
  roughness: 0.2
});

function AnimatedAudienceSpectator({
  modelUrl,
  mocapClips,
  archetype,
  position,
  rotationY,
  phaseOffset,
  speedMult,
  energyThreshold,
  preferHandsUp,
  danceVariant,
  hasPhone,
  isSilhouette = false,
  isPlaying,
  bpm,
  pulseIntensity,
  isActive = true,
  children
}: {
  modelUrl: string;
  mocapClips: THREE.AnimationClip[];
  archetype: HumanArchetypePreset;
  position: [number, number, number];
  rotationY: number;
  phaseOffset: number;
  speedMult: number;
  energyThreshold: number;
  preferHandsUp: boolean;
  danceVariant: number;
  hasPhone: boolean;
  isSilhouette?: boolean;
  isPlaying: boolean;
  bpm: number;
  pulseIntensity: number;
  isActive?: boolean;
  children?: React.ReactNode;
}) {
  const gltf = useGLTF(modelUrl, DRACO_DECODER_URL);

  const { clonedScene, mixer, actions } = useMemo(() => {
    const cloned = clone(gltf.scene);
    attachBodyZoneAttribute(cloned);

    const clips = initializeRigAndDanceClips(
      cloned,
      gltf.animations,
      mocapClips,
      archetype.baseKind,
      false,
      danceVariant
    );
    const mx = new THREE.AnimationMixer(cloned);

    const actionMap: Record<DanceClipName, THREE.AnimationAction> = {
      dance_sway: mx.clipAction(clips.dance_sway),
      dance_groove: mx.clipAction(clips.dance_groove),
      dance_hands_up: mx.clipAction(clips.dance_hands_up),
      dance_bounce: mx.clipAction(clips.dance_bounce)
    };

    const startClip: DanceClipName = preferHandsUp ? 'dance_hands_up' : 'dance_groove';
    actionMap[startClip].reset().play();
    mx.update((phaseOffset * 1.37) % Math.max(1.0, clips[startClip].duration));

    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const baseScale = size.y > 0.01 ? (1.72 * archetype.heightScale) / size.y : 1;
    cloned.scale.set(baseScale * archetype.buildScaleX, baseScale, baseScale * archetype.buildScaleZ);

    cloned.updateMatrixWorld(true);
    box.setFromObject(cloned);
    cloned.position.y -= box.min.y;

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        const origMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) || null;
        mesh.material = getSharedCrowdMaterial(origMat, archetype, isSilhouette);
      }
    });

    if (hasPhone) {
      const rightHand = findBone(cloned, 'mixamorigRightHand') || findBone(cloned, 'RightHand');
      if (rightHand) {
        rightHand.updateWorldMatrix(true, false);
        const ws = new THREE.Vector3();
        rightHand.getWorldScale(ws);
        const sx = Math.max(0.001, Math.abs(ws.x));
        const sy = Math.max(0.001, Math.abs(ws.y));
        const sz = Math.max(0.001, Math.abs(ws.z));
        const phone = new THREE.Mesh(SHARED_PHONE_GEO, SHARED_PHONE_MAT);
        phone.scale.set(0.065 / sx, 0.115 / sy, 0.009 / sz);
        phone.position.set(0, 0.06 / sy, 0.025 / sz);
        rightHand.add(phone);
      }
    }

    return { clonedScene: cloned, mixer: mx, actions: actionMap };
  }, [archetype, danceVariant, gltf.animations, gltf.scene, hasPhone, isSilhouette, mocapClips, phaseOffset, preferHandsUp]);

  const currentClipRef = useRef<DanceClipName>(preferHandsUp ? 'dance_hands_up' : 'dance_groove');

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  useFrame(({ clock }, delta) => {
    if (!isActive) return;
    const audio = djAudioController.getCombinedBassAndSpectrum();
    const t = clock.getElapsedTime();
    const beatHz = Math.max(60, bpm) / 60;

    const barCycle = 0.5 + 0.5 * Math.sin(t * beatHz * Math.PI * 0.25 + phaseOffset * 0.15);
    const synthEnergy = isPlaying ? 0.35 + barCycle * 0.52 * pulseIntensity : 0.1;
    const energy = Math.max(audio.bass * 0.62 + audio.mid * 0.38, synthEnergy);

    let desiredClip: DanceClipName = 'dance_sway';
    if (isPlaying) {
      if (energy > energyThreshold) {
        desiredClip = preferHandsUp ? 'dance_hands_up' : 'dance_bounce';
      } else {
        desiredClip = preferHandsUp ? 'dance_bounce' : 'dance_groove';
      }
    }

    if (desiredClip !== currentClipRef.current) {
      const prev = actions[currentClipRef.current];
      const next = actions[desiredClip];
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      prev.crossFadeTo(next, 0.5, true);
      currentClipRef.current = desiredClip;
    }

    const timeScale = isPlaying
      ? (Math.max(60, bpm) / 120) * speedMult * (0.9 + audio.bass * 0.26)
      : 0.26 * speedMult;
    mixer.update(Math.min(0.08, delta) * timeScale);
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={clonedScene} />
      {children}
    </group>
  );
}

// 6 rows x 20 cols (10 left wing + 10 right wing) = 120 floor spectators across Z = -1.5 to +6.8, X = -6.5 to +6.5
// with a clean glowing 1.2m center aisle (X = -0.6 to +0.6).
const CROWD_ROW_ZS = [-1.5, 0.16, 1.82, 3.48, 5.14, 6.8];
const CROWD_WING_COLS = 10;

function NonAdjacentAnimatedCrowd({
  manifest,
  mocapClips,
  isPlaying,
  bpm,
  pulseIntensity,
  isActive = true,
  peerMap
}: {
  manifest: ConcertAssetManifest;
  mocapClips: THREE.AnimationClip[];
  isPlaying: boolean;
  bpm: number;
  pulseIntensity: number;
  isActive?: boolean;
  peerMap?: Map<string, AssignedCastPeer>;
}) {
  interface CrowdPlacement {
    key: string;
    modelUrl: string;
    archetype: HumanArchetypePreset;
    position: [number, number, number];
    rotationY: number;
    phaseOffset: number;
    speedMult: number;
    energyThreshold: number;
    preferHandsUp: boolean;
    danceVariant: number;
    hasPhone: boolean;
    isSilhouette: boolean;
  }

  const placements = useMemo(() => {
    const list: CrowdPlacement[] = [];
    const totalCols = CROWD_WING_COLS * 2; // 120 floor spectators
    const grid: Array<Array<HumanArchetypePreset | null>> = Array.from(
      { length: CROWD_ROW_ZS.length },
      () => Array(totalCols).fill(null)
    );

    const femaleArchetypes = HUMAN_ARCHETYPES.filter((a) => a.baseKind === 'female');
    const maleArchetypes = HUMAN_ARCHETYPES.filter((a) => a.baseKind === 'male');

    CROWD_ROW_ZS.forEach((baseZ, row) => {
      for (let col = 0; col < totalCols; col++) {
        const idx = row * totalCols + col;
        const h1 = hash01(idx * 3.17 + 1);
        const h2 = hash01(idx * 5.41 + 2);
        const h3 = hash01(idx * 7.89 + 3);

        const neighbors = [
          col > 0 ? grid[row][col - 1] : null,
          row > 0 ? grid[row - 1][col] : null,
          row > 0 && col > 0 ? grid[row - 1][col - 1] : null,
          row > 0 && col < totalCols - 1 ? grid[row - 1][col + 1] : null
        ].filter(Boolean) as HumanArchetypePreset[];

        const forbiddenIds = new Set(neighbors.map((n) => n.id));
        const forbiddenColors = new Set(neighbors.map((n) => n.outfitColor));

        const wantFemale = (row + col) % 2 === 0;
        const pool = wantFemale ? femaleArchetypes : maleArchetypes;
        const fallbackPool = HUMAN_ARCHETYPES;

        let chosen =
          pool.find((a, pIdx) => {
            const candidate = pool[(pIdx + idx) % pool.length];
            return !forbiddenIds.has(candidate.id) && !forbiddenColors.has(candidate.outfitColor);
          }) ||
          fallbackPool.find((a, pIdx) => {
            const candidate = fallbackPool[(pIdx + idx) % fallbackPool.length];
            return !forbiddenIds.has(candidate.id) && !forbiddenColors.has(candidate.outfitColor);
          }) ||
          HUMAN_ARCHETYPES[idx % HUMAN_ARCHETYPES.length];

        const rotatedPool = pool.map((_, i) => pool[(i + idx) % pool.length]);
        const rotatedHit = rotatedPool.find(
          (c) => !forbiddenIds.has(c.id) && !forbiddenColors.has(c.outfitColor)
        );
        if (rotatedHit) chosen = rotatedHit;

        grid[row][col] = chosen;

        // Left wing [-6.6 .. -1.05], Right wing [+1.05 .. +6.6], clean matte slate 1.7m center aisle [-0.85 .. +0.85]
        const isRightWing = col >= CROWD_WING_COLS;
        const wingIdx = isRightWing ? col - CROWD_WING_COLS : col;
        const baseX = isRightWing
          ? 1.05 + (wingIdx / (CROWD_WING_COLS - 1)) * 5.55
          : -6.6 + (wingIdx / (CROWD_WING_COLS - 1)) * 5.55;

        const x = baseX + (h1 - 0.5) * 0.14;
        const z = baseZ + (h2 - 0.5) * 0.2;

        const customUrl =
          manifest.avatarUrls.length > 0
            ? manifest.avatarUrls[chosen.id % manifest.avatarUrls.length]
            : null;
        const modelUrl =
          customUrl ||
          manifest.dancer ||
          (chosen.baseKind === 'female' ? manifest.dancerFemale : manifest.dancerMale);

        const preferHandsUp = (row + col) % 3 === 1 || row >= 4;

        list.push({
          key: `floor-${row}-${col}`,
          modelUrl,
          archetype: chosen,
          position: [x, 0, z],
          rotationY: Math.PI + (h3 - 0.5) * 0.24,
          phaseOffset: idx * 1.13 + h1 * 4.5,
          speedMult: 0.84 + h1 * 0.34,
          energyThreshold: 0.4 + h2 * 0.26,
          preferHandsUp,
          danceVariant: (row * 3 + col) % 4,
          hasPhone: preferHandsUp && row >= 1 && (row * 7 + col) % 5 === 0,
          isSilhouette: false
        });
      }
    });

    // 16 Cheering Balcony Spectators along Two-Tier Side Balconies (X = ±8.35, Y = 3.36 & Y = 5.76)
    for (let b = 0; b < 16; b++) {
      const isRight = b % 2 === 1;
      const isUpper = b >= 8;
      const slot = Math.floor((b % 8) / 2);
      const x = isRight ? 8.35 : -8.35;
      const z = -4.2 + slot * 2.4;
      const y = isUpper ? 5.76 : 3.36;
      const isFem = b % 2 === 0;
      const arch = isFem
        ? femaleArchetypes[(b * 3) % femaleArchetypes.length]
        : maleArchetypes[(b * 3) % maleArchetypes.length];

      list.push({
        key: `balcony-${b}`,
        modelUrl: manifest.dancer || (isFem ? manifest.dancerFemale : manifest.dancerMale),
        archetype: arch,
        position: [x, y, z],
        rotationY: Math.atan2(-x, -6.0 - z),
        phaseOffset: (120 + b) * 1.41,
        speedMult: 0.86 + hash01(120 + b) * 0.3,
        energyThreshold: 0.42,
        preferHandsUp: b % 3 !== 0,
        danceVariant: b % 4,
        hasPhone: false,
        isSilhouette: true
      });
    }

    return list;
  }, [manifest.avatarUrls, manifest.dancer, manifest.dancerFemale, manifest.dancerMale]);

  return (
    <group>
      {placements.map((p) => {
        const assigned = peerMap?.get(p.key);
        return (
          <AnimatedAudienceSpectator
            key={p.key}
            modelUrl={p.modelUrl}
            mocapClips={mocapClips}
            archetype={p.archetype}
            position={p.position}
            rotationY={p.rotationY}
            phaseOffset={p.phaseOffset}
            speedMult={p.speedMult}
            energyThreshold={p.energyThreshold}
            preferHandsUp={p.preferHandsUp}
            danceVariant={p.danceVariant}
            hasPhone={p.hasPhone}
            isSilhouette={p.isSilhouette}
            isPlaying={isPlaying}
            bpm={bpm}
            pulseIntensity={pulseIntensity}
            isActive={isActive}
          >
            {assigned && (
              <PeerOverheadBadge
                peer={assigned.peer}
                isLatestDJ={assigned.isLatestDJ}
                headHeight={1.9}
              />
            )}
          </AnimatedAudienceSpectator>
        );
      })}
    </group>
  );
}

/**
 * Instanced Low-Profile Dark Velvet Theater Seats (120 seats) + Subtle Warm Amber Step-Light Dots (X = ±0.85)
 */
function TheaterSeatRowsAndAisleStrips() {
  const cushionRef = useRef<THREE.InstancedMesh | null>(null);
  const backRef = useRef<THREE.InstancedMesh | null>(null);
  const frameRef = useRef<THREE.InstancedMesh | null>(null);

  const seatCount = CROWD_ROW_ZS.length * CROWD_WING_COLS * 2;

  useEffect(() => {
    const cushion = cushionRef.current;
    const back = backRef.current;
    const frame = frameRef.current;
    if (!cushion || !back || !frame) return;

    const dummy = new THREE.Object3D();
    let idx = 0;

    CROWD_ROW_ZS.forEach((baseZ) => {
      for (let col = 0; col < CROWD_WING_COLS * 2; col++) {
        const isRightWing = col >= CROWD_WING_COLS;
        const wingIdx = isRightWing ? col - CROWD_WING_COLS : col;
        const x = isRightWing
          ? 1.05 + (wingIdx / (CROWD_WING_COLS - 1)) * 5.55
          : -6.6 + (wingIdx / (CROWD_WING_COLS - 1)) * 5.55;
        const seatZ = baseZ + 0.36;

        dummy.position.set(x, 0.3, seatZ);
        dummy.rotation.set(0.05, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        cushion.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(x, 0.47, seatZ + 0.18);
        dummy.rotation.set(-0.08, 0, 0);
        dummy.updateMatrix();
        back.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(x, 0.18, seatZ + 0.04);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        frame.setMatrixAt(idx, dummy.matrix);

        idx++;
      }
    });

    cushion.instanceMatrix.needsUpdate = true;
    back.instanceMatrix.needsUpdate = true;
    frame.instanceMatrix.needsUpdate = true;
    cushion.computeBoundingSphere();
    back.computeBoundingSphere();
    frame.computeBoundingSphere();
  }, []);

  return (
    <group>
      <instancedMesh ref={cushionRef} args={[undefined, undefined, seatCount]} frustumCulled={false} receiveShadow>
        <boxGeometry args={[0.46, 0.09, 0.4]} />
        <meshStandardMaterial color="#14131b" roughness={0.88} metalness={0.06} />
      </instancedMesh>
      <instancedMesh ref={backRef} args={[undefined, undefined, seatCount]} frustumCulled={false} receiveShadow>
        <boxGeometry args={[0.46, 0.36, 0.08]} />
        <meshStandardMaterial color="#16141e" roughness={0.88} metalness={0.06} />
      </instancedMesh>
      <instancedMesh ref={frameRef} args={[undefined, undefined, seatCount]} frustumCulled={false}>
        <boxGeometry args={[0.5, 0.3, 0.28]} />
        <meshStandardMaterial color="#0b0d14" roughness={0.48} metalness={0.76} />
      </instancedMesh>

      {/* Tiny, subtle warm amber step-light dots along outer carpet edges (X = -0.85 and X = +0.85) */}
      {[-0.85, 0.85].map((ax) => (
        <group key={ax}>
          {CROWD_ROW_ZS.map((mz) => (
            <mesh key={mz} position={[ax, 0.012, mz]}>
              <boxGeometry args={[0.045, 0.014, 0.045]} />
              <meshStandardMaterial color="#b47b32" emissive="#ffb347" emissiveIntensity={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Ornate Multi-Tier Warm Crystal Chandelier positioned strictly on the outer left/right wings (X = ±6.2)
 */
function CrystalChandelier({
  position,
  scale = 1.15,
  lightRef
}: {
  position: [number, number, number];
  scale?: number;
  lightRef?: React.Ref<THREE.PointLight>;
}) {
  const ringRadii = [1.22, 0.88, 0.54, 0.26];
  const crystalGeo = useMemo(() => new THREE.OctahedronGeometry(0.052, 0), []);
  const goldMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#d4af37',
        roughness: 0.16,
        metalness: 0.95,
        clearcoat: 1
      }),
    []
  );
  const crystalMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#fffbeb',
        emissive: '#ffcf70',
        emissiveIntensity: 1.45,
        roughness: 0.06,
        metalness: 0.15,
        clearcoat: 1
      }),
    []
  );

  useEffect(() => {
    return () => {
      crystalGeo.dispose();
      goldMat.dispose();
      crystalMat.dispose();
    };
  }, [crystalGeo, goldMat, crystalMat]);

  return (
    <group position={position} scale={scale}>
      <pointLight ref={lightRef} color="#ffcf70" intensity={1.8} decay={1.0} distance={14} position={[0, -0.75, 0]} />
      <mesh position={[0, 1.3, 0]} material={goldMat}>
        <cylinderGeometry args={[0.025, 0.025, 2.6, 10]} />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <sphereGeometry args={[0.15, 14, 14]} />
        <meshStandardMaterial color="#fef3c7" emissive="#ffcf70" emissiveIntensity={1.65} />
      </mesh>
      {ringRadii.map((radius, tier) => {
        const y = -tier * 0.3;
        const count = 20 - tier * 4;
        return (
          <group key={radius} position={[0, y, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={goldMat}>
              <torusGeometry args={[radius, 0.018, 10, 48]} />
            </mesh>
            {Array.from({ length: count }).map((_, idx) => {
              const a = (idx / count) * Math.PI * 2;
              return (
                <mesh
                  key={idx}
                  geometry={crystalGeo}
                  material={crystalMat}
                  position={[Math.cos(a) * radius, -0.12, Math.sin(a) * radius]}
                  scale={[0.42, 1.5, 0.42]}
                />
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

/**
 * Realistic Dark Arena Concert Stage Architecture:
 * - Deep matte obsidian black (#040508) backstage, ceiling & walls
 * - 3D metallic concert truss towers (X = ±5.8, Z = -9.5, height 8.5m) + overhead roof truss (X = -6..+6, Y = 7.8, Z = -8.5)
 * - Hanging curved 8-cabinet line-array speaker clusters at [±4.8, 5.8, -7.5]
 * - Frameless curved OLED video wall at [0, 4.3, -10.2] (9.2m x 4.6m)
 * - Elevated drum riser [0, 1.375, -8.4] (top Y = 1.55) flanked by stacked Marshall guitar amp cabinets
 * - 10 overhead moving-head spots (Y = 7.6, Z = -8.2) + 6 floor blinders (Y = 1.3, Z = -9.5) with ultra-soft narrow beams
 * - Dark matte-satin slate center aisle (#090b10, roughness 0.4, zero emissive)
 */
function TheaterArchitectureAndStage({
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
  isActive = true
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
}) {
  const cal = lightingCalibration || DEFAULT_ROOM_LIGHTING_PROFILES.concert;
  const mainLedTexture = useLiveMainLedTexture({
    trackTitle,
    trackArtist,
    trackCoverUrl,
    trackAccentHex,
    bpm,
    isPlaying,
    pulseIntensity,
    isActive
  });

  const stageWood = useMemo(() => createStageWoodTextures(), []);
  const carpet = useMemo(() => createCarpetTextures(), []);
  const speakerGrilleTex = useMemo(() => createSpeakerGrilleTexture(), []);
  const parFlareTex = useMemo(() => createParFlareTexture(), []);
  const concertMetalWallPBR = usePolyHavenPBR('corrugated_iron_03', 8, 3);

  // Frameless subtly curved LED video wall geometry (9.2m x 4.6m)
  const curvedLedGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(9.2, 4.6, 36, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const nx = x / 4.6;
      pos.setZ(i, nx * nx * 0.45);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const trussMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#14161d',
        metalness: 0.85,
        roughness: 0.25
      }),
    []
  );

  useEffect(() => {
    return () => {
      stageWood.map.dispose();
      stageWood.bumpMap.dispose();
      carpet.map.dispose();
      carpet.bumpMap.dispose();
      speakerGrilleTex.dispose();
      parFlareTex.dispose();
      curvedLedGeo.dispose();
      trussMat.dispose();
    };
  }, [carpet, curvedLedGeo, parFlareTex, speakerGrilleTex, stageWood, trussMat]);

  // 10 Overhead Moving-Head Spotlights along Y = 7.6, Z = -8.2
  const movingHeadXs = useMemo(
    () => [-4.95, -3.85, -2.75, -1.65, -0.55, 0.55, 1.65, 2.75, 3.85, 4.95],
    []
  );
  const movingHeadColors = useMemo(
    () => movingHeadXs.map((_, idx) => (idx % 2 === 0 ? '#ffddaa' : '#ff2a85')),
    [movingHeadXs]
  );
  const movingHeadBeamMats = useMemo(
    () => movingHeadColors.map((hex) => createVolumetricBeamShader(hex, 0.06)),
    [movingHeadColors]
  );
  const movingHeadBeamRefs = useRef<Array<THREE.Group | null>>([]);
  const movingHeadLensMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const movingHeadFlareMatRefs = useRef<Array<THREE.SpriteMaterial | null>>([]);
  const movingHeadFlareSpriteRefs = useRef<Array<THREE.Sprite | null>>([]);

  // 6 Floor-Standing Stage Blinders along Rear Riser (Y = 1.3, Z = -9.5)
  const floorBlinderXs = useMemo(() => [-4.5, -2.7, -0.9, 0.9, 2.7, 4.5], []);
  const blinderLensMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const blinderFlareMatRefs = useRef<Array<THREE.SpriteMaterial | null>>([]);
  const blinderFlareSpriteRefs = useRef<Array<THREE.Sprite | null>>([]);

  const mainLedMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const balconyTrimMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffcf70',
        emissive: '#fbbf24',
        emissiveIntensity: 1.1,
        roughness: 0.2,
        metalness: 0.7
      }),
    []
  );
  useEffect(() => {
    return () => {
      balconyTrimMat.dispose();
    };
  }, [balconyTrimMat]);

  const leftChandelierLightRef = useRef<THREE.PointLight | null>(null);
  const rightChandelierLightRef = useRef<THREE.PointLight | null>(null);
  const frontSpotRef = useRef<THREE.SpotLight | null>(null);
  const goldTrussSpotRef = useRef<THREE.SpotLight | null>(null);
  const magentaTrussSpotRef = useRef<THREE.SpotLight | null>(null);
  const crowdRimDirRef = useRef<THREE.DirectionalLight | null>(null);
  const crowdPointRef = useRef<THREE.PointLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);

  const singerTarget = useMemo(() => {
    const t = new THREE.Object3D();
    t.position.set(0, 2.0, -6.0);
    return t;
  }, []);

  const crowdRimTarget = useMemo(() => {
    const t = new THREE.Object3D();
    t.position.set(0, 0, 6.0);
    return t;
  }, []);

  const columnGeometry = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.36, 0),
      new THREE.Vector2(0.36, 0.36),
      new THREE.Vector2(0.24, 0.65),
      new THREE.Vector2(0.22, 10.6),
      new THREE.Vector2(0.32, 11.0),
      new THREE.Vector2(0.38, 11.4)
    ];
    return new THREE.LatheGeometry(pts, 20);
  }, []);

  const burstRef = useRef(0);
  const lastSeqRef = useRef(fxBurstSeq);

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

    const beatStep = env.beatIndex % 2;
    const fxIntensityMult =
      lightingFxMode === 'strobe_pulse' ? 1.25 : lightingFxMode === 'neon_laser' ? 1.15 : 1.0;
    const strobeGate =
      lightingFxMode === 'strobe_pulse' && isPlaying
        ? Math.sin(t * (Math.max(60, bpm) / 60) * Math.PI * 4) > -0.15
          ? 1.12
          : 0.38
        : 1.0;
    const fxScale = fxIntensityMult * strobeGate;
    const burstVal = burstRef.current;
    const energy = env.bass * 0.45 + env.mid * 0.35 + env.high * 0.2;
    const bassEnergy = Math.min(1.3, (env.bass * 0.72 + env.beatPulse * 0.58 + burstVal * 0.65) * fxIntensityMult);

    const keyMod = cal.audioReactivity;
    const beamMod = cal.beamReactivity;
    const pracMult = cal.practicalIntensity;

    movingHeadBeamRefs.current.forEach((pivotGrp, idx) => {
      const mat = movingHeadBeamMats[idx];
      const isEven = idx % 2 === 0;
      const chaseGate = isPlaying
        ? beatStep === (isEven ? 0 : 1)
          ? 1.15
          : 0.65
        : 0.72;
      const headLevel = Math.min(
        1.45,
        (0.32 + (bassEnergy * 0.72 + env.high * 0.22) * beamMod) * chaseGate * strobeGate
      );

      if (pivotGrp && mat) {
        const inwardBase = -movingHeadXs[idx] * 0.04;
        const sweepAmp = isPlaying ? (0.045 + bassEnergy * 0.04) * beamMod : 0.018;
        pivotGrp.rotation.z = inwardBase + Math.sin(env.barWave * 1.2 + idx * 0.65) * sweepAmp;
        pivotGrp.rotation.x = 0.24 + Math.cos(env.barWave * 0.8 + idx * 0.4) * (isPlaying ? 0.032 : 0.01);
        mat.uniforms.uTime.value = t;
        mat.uniforms.uOpacity.value = 0.055 * cal.beamOpacity;
        mat.uniforms.uBassHit.value = headLevel;
      }

      const lensMat = movingHeadLensMatRefs.current[idx];
      if (lensMat) {
        lensMat.emissiveIntensity = (1.4 + headLevel * 1.6) * (isPlaying ? 1 : 0.75);
      }
      const flareMat = movingHeadFlareMatRefs.current[idx];
      if (flareMat) {
        flareMat.opacity = Math.min(0.85, (0.24 + headLevel * 0.36) * cal.beamOpacity);
      }
      const flareSprite = movingHeadFlareSpriteRefs.current[idx];
      if (flareSprite) {
        const s = 0.42 + headLevel * 0.22;
        flareSprite.scale.set(s, s, 1);
      }
    });

    floorBlinderXs.forEach((_, idx) => {
      const altGate = !isPlaying || (env.beatIndex + idx) % 2 === 0 ? 1.0 : 0.55;
      const blinderPulse = Math.min(
        1.45,
        (0.26 + (env.beatPulse * 0.85 + env.bass * 0.42 + burstVal * 0.7) * beamMod) * altGate * fxScale
      );
      for (let sub = 0; sub < 2; sub++) {
        const key = idx * 2 + sub;
        const lMat = blinderLensMatRefs.current[key];
        if (lMat) {
          lMat.emissiveIntensity = 1.1 + blinderPulse * 1.85;
        }
        const fMat = blinderFlareMatRefs.current[key];
        if (fMat) {
          fMat.opacity = Math.min(0.8, 0.18 + blinderPulse * 0.32);
        }
        const fSprite = blinderFlareSpriteRefs.current[key];
        if (fSprite) {
          const s = 0.28 + blinderPulse * 0.2;
          fSprite.scale.set(s, s, 1);
        }
      }
    });

    if (mainLedMatRef.current) {
      mainLedMatRef.current.emissiveIntensity = 0.5 + energy * 0.32 * fxScale * beamMod + burstVal * 0.22;
    }

    balconyTrimMat.emissiveIntensity = (0.75 + (env.mid * 0.45 + env.beatPulse * 0.35) * beamMod) * pracMult;

    if (leftChandelierLightRef.current) {
      const base = 1.45 * pracMult;
      leftChandelierLightRef.current.intensity =
        base + (env.mid * 0.55 + (beatStep === 0 ? env.beatPulse * 0.4 : 0.1)) * beamMod;
    }
    if (rightChandelierLightRef.current) {
      const base = 1.45 * pracMult;
      rightChandelierLightRef.current.intensity =
        base + (env.mid * 0.55 + (beatStep === 1 ? env.beatPulse * 0.4 : 0.1)) * beamMod;
    }

    if (frontSpotRef.current) {
      const base = cal.keyIntensity;
      frontSpotRef.current.intensity =
        base * (0.94 + (env.beatPulse * 0.28 * fxIntensityMult + env.mid * 0.22) * keyMod);
    }
    if (goldTrussSpotRef.current) {
      const goldChase = beatStep === 0 ? 1.18 : 0.78;
      const base = cal.fillIntensity * 1.45;
      goldTrussSpotRef.current.intensity =
        (base + (env.beatPulse * 1.4 * fxScale + env.bass * 0.9) * beamMod) * goldChase;
      goldTrussSpotRef.current.angle = 0.17 + env.halfBeatPulse * 0.03 * beamMod;
    }
    if (magentaTrussSpotRef.current) {
      const magChase = beatStep === 1 ? 1.18 : 0.78;
      const base = cal.fillIntensity * 1.35;
      magentaTrussSpotRef.current.intensity =
        (base + (env.halfBeatPulse * 1.35 * fxScale + env.high * 0.95) * beamMod) * magChase;
      magentaTrussSpotRef.current.angle = 0.17 + env.beatPulse * 0.03 * beamMod;
    }
    if (crowdRimDirRef.current) {
      const base = cal.rimIntensity;
      crowdRimDirRef.current.intensity =
        base * (0.9 + (env.bass * 0.42 * fxScale + env.beatPulse * 0.25) * beamMod);
    }
    if (crowdPointRef.current) {
      const base = cal.fillIntensity;
      crowdPointRef.current.intensity =
        base * (0.92 + (env.mid * 0.35 + env.beatPulse * 0.25 * fxIntensityMult) * keyMod);
    }
    if (hemiLightRef.current) {
      hemiLightRef.current.intensity = cal.hemiIntensity * (0.94 + energy * 0.18 * keyMod);
    }
  });

  const towerBraceHeights = useMemo(() => [0.6, 1.8, 3.0, 4.2, 5.4, 6.6, 7.8], []);
  const roofBayXs = useMemo(() => [-5.0, -3.4, -1.8, -0.2, 1.4, 3.0, 4.6], []);

  return (
    <group>
      {/* Grand Hall Dark Carpet + Dark Matte-Satin Slate Center Aisle (#090b10, roughness 0.4, zero emissive) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1]} receiveShadow>
        <planeGeometry args={[26, 34]} />
        <meshStandardMaterial
          map={carpet.map}
          bumpMap={carpet.bumpMap}
          bumpScale={0.03}
          color="#100f18"
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 2.6]} receiveShadow>
        <planeGeometry args={[1.7, 13.5]} />
        <meshStandardMaterial color="#090b10" roughness={0.4} metalness={0.14} />
      </mesh>

      {/* 120 Low-Profile Theater Seats + Tiny Outer-Carpet Amber Step-Light Dots (X = ±0.85) */}
      <TheaterSeatRowsAndAisleStrips />

      {/* Corrugated Industrial Metal Arena Walls & Ceiling (Poly Haven corrugated_iron_03) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 11.4, 1]}>
        <planeGeometry args={[26, 34]} />
        <meshStandardMaterial
          map={concertMetalWallPBR.map}
          normalMap={concertMetalWallPBR.normalMap}
          roughnessMap={concertMetalWallPBR.roughnessMap}
          color="#2c323d"
          roughness={0.55}
          metalness={0.74}
        />
      </mesh>
      <mesh position={[0, 5.7, -13.5]}>
        <planeGeometry args={[26, 11.6]} />
        <meshStandardMaterial
          map={concertMetalWallPBR.map}
          normalMap={concertMetalWallPBR.normalMap}
          roughnessMap={concertMetalWallPBR.roughnessMap}
          color="#464f5e"
          roughness={0.44}
          metalness={0.82}
        />
      </mesh>
      <mesh position={[0, 5.7, 17.5]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[26, 11.6]} />
        <meshStandardMaterial
          map={concertMetalWallPBR.map}
          normalMap={concertMetalWallPBR.normalMap}
          roughnessMap={concertMetalWallPBR.roughnessMap}
          color="#464f5e"
          roughness={0.44}
          metalness={0.82}
        />
      </mesh>
      <mesh position={[-11.2, 5.7, 1]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[34, 11.6]} />
        <meshStandardMaterial
          map={concertMetalWallPBR.map}
          normalMap={concertMetalWallPBR.normalMap}
          roughnessMap={concertMetalWallPBR.roughnessMap}
          color="#4d5766"
          roughness={0.42}
          metalness={0.82}
        />
      </mesh>
      <mesh position={[11.2, 5.7, 1]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[34, 11.6]} />
        <meshStandardMaterial
          map={concertMetalWallPBR.map}
          normalMap={concertMetalWallPBR.normalMap}
          roughnessMap={concertMetalWallPBR.roughnessMap}
          color="#4d5766"
          roughness={0.42}
          metalness={0.82}
        />
      </mesh>

      {/* Main Elevated Stage Platform + Corrugated Metal Skirt + Glossy Reflective Stage Surface (Y = 1.2) */}
      <mesh position={[0, 0.59, -7.2]} receiveShadow>
        <boxGeometry args={[14.8, 1.18, 6.8]} />
        <meshStandardMaterial
          map={concertMetalWallPBR.map}
          normalMap={concertMetalWallPBR.normalMap}
          roughnessMap={concertMetalWallPBR.roughnessMap}
          color="#3b4250"
          roughness={0.42}
          metalness={0.8}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, STAGE_SURFACE_Y + 0.001, -7.2]} receiveShadow>
        <planeGeometry args={[14.8, 6.8]} />
        <MeshReflectorMaterial
          blur={[300, 90]}
          resolution={512}
          mixBlur={0.82}
          mixStrength={32}
          roughness={0.26}
          depthScale={1.0}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#07080d"
          metalness={0.6}
          mirror={0.58}
        />
      </mesh>
      {/* Sleek Dark Anodized Stage Lip Trim (no bright purple neon glare) */}
      <mesh position={[0, STAGE_SURFACE_Y - 0.04, -3.79]}>
        <boxGeometry args={[14.82, 0.07, 0.05]} />
        <meshStandardMaterial color="#14161d" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Elevated Drum Riser Platform at [0, 1.375, -8.4] (width: 3.2, depth: 2.4, top surface at Y = 1.55) */}
      <group position={[0, 1.375, -8.4]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[3.2, 0.35, 2.4]} />
          <meshStandardMaterial color="#0c0e14" roughness={0.34} metalness={0.62} />
        </mesh>
        <mesh position={[0, 0.165, 1.205]}>
          <boxGeometry args={[3.22, 0.035, 0.025]} />
          <meshStandardMaterial color="#2a2f3d" metalness={0.88} roughness={0.22} />
        </mesh>
      </group>

      {/* Stacked Marshall-Style Guitar Amp Cabinets on Stage Left & Stage Right */}
      {[-4.4, 4.4].map((ax) => (
        <group
          key={ax}
          position={[ax, STAGE_SURFACE_Y, -7.8]}
          rotation={[0, ax < 0 ? 0.28 : -0.28, 0]}
        >
          {[-0.44, 0.44].map((offsetX) => (
            <group key={offsetX} position={[offsetX, 0, 0]}>
              {/* Lower 4x12 straight cabinet */}
              <mesh position={[0, 0.38, 0]} castShadow>
                <boxGeometry args={[0.78, 0.76, 0.42]} />
                <meshStandardMaterial color="#0a0b0f" roughness={0.78} metalness={0.14} />
              </mesh>
              <mesh position={[0, 0.38, 0.214]}>
                <planeGeometry args={[0.7, 0.68]} />
                <meshStandardMaterial map={speakerGrilleTex} color="#272932" roughness={0.68} metalness={0.35} />
              </mesh>
              {/* Upper 4x12 angled cabinet */}
              <mesh position={[0, 1.14, 0]} castShadow>
                <boxGeometry args={[0.78, 0.74, 0.38]} />
                <meshStandardMaterial color="#0a0b0f" roughness={0.78} metalness={0.14} />
              </mesh>
              <mesh position={[0, 1.14, 0.194]}>
                <planeGeometry args={[0.7, 0.66]} />
                <meshStandardMaterial map={speakerGrilleTex} color="#272932" roughness={0.68} metalness={0.35} />
              </mesh>
              {/* Tube Amp Head with Brushed Gold Faceplate */}
              <mesh position={[0, 1.66, 0]} castShadow>
                <boxGeometry args={[0.74, 0.28, 0.34]} />
                <meshStandardMaterial color="#0c0d12" roughness={0.55} metalness={0.45} />
              </mesh>
              <mesh position={[0, 1.62, 0.174]}>
                <boxGeometry args={[0.66, 0.08, 0.01]} />
                <meshStandardMaterial color="#d4af37" roughness={0.22} metalness={0.92} />
              </mesh>
              <mesh position={[0.26, 1.62, 0.181]}>
                <sphereGeometry args={[0.012, 8, 8]} />
                <meshStandardMaterial color="#ff4444" emissive="#ff3333" emissiveIntensity={1.2} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* 6 Stage Monitor Wedges */}
      {[-4.0, -2.4, -0.8, 0.8, 2.4, 4.0].map((mx) => (
        <group key={mx} position={[mx, STAGE_SURFACE_Y, -4.15]} rotation={[-0.42, 0, 0]}>
          <mesh position={[0, 0.11, 0]} castShadow>
            <boxGeometry args={[0.54, 0.22, 0.34]} />
            <meshPhysicalMaterial color="#0d111a" roughness={0.46} metalness={0.5} clearcoat={0.3} />
          </mesh>
          <mesh position={[0, 0.12, -0.172]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.46, 0.16]} />
            <meshStandardMaterial map={speakerGrilleTex} roughness={0.5} metalness={0.75} />
          </mesh>
        </group>
      ))}

      {/* CLEAN FRAMELESS CURVED LED VIDEO WALL at [0, 4.3, -10.2] (width: 9.2, height: 4.6) */}
      <mesh geometry={curvedLedGeo} position={[0, 4.3, -10.2]}>
        <meshStandardMaterial
          ref={mainLedMatRef}
          map={mainLedTexture}
          emissiveMap={mainLedTexture}
          emissive="#ffffff"
          emissiveIntensity={0.65}
          roughness={0.35}
          metalness={0.05}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* REALISTIC 3D ALUMINUM STAGE TRUSSING (#14161d, metalness: 0.85, roughness: 0.25) */}
      {/* Left & Right Vertical Truss Towers at X = -5.8 and X = +5.8, Z = -9.5, height: 8.5m */}
      {[-5.8, 5.8].map((tx) => (
        <group key={tx} position={[tx, 0, -9.5]}>
          {/* Heavy Steel Base Outrigger */}
          <mesh position={[0, 0.06, 0]} material={trussMat}>
            <boxGeometry args={[0.92, 0.12, 0.92]} />
          </mesh>
          {/* 4 Vertical Steel Corner Chords (8.5m) */}
          {[
            [-0.22, -0.22],
            [0.22, -0.22],
            [-0.22, 0.22],
            [0.22, 0.22]
          ].map(([cx, cz], idx) => (
            <mesh key={idx} position={[cx, 4.25, cz]} material={trussMat}>
              <boxGeometry args={[0.055, 8.5, 0.055]} />
            </mesh>
          ))}
          {/* Horizontal Rings & Diagonal Cross-Bracing up 8.5m height */}
          {towerBraceHeights.map((hy, bIdx) => (
            <group key={hy} position={[0, hy, 0]}>
              <mesh position={[0, 0, 0.22]} material={trussMat}>
                <boxGeometry args={[0.48, 0.036, 0.036]} />
              </mesh>
              <mesh position={[0, 0, -0.22]} material={trussMat}>
                <boxGeometry args={[0.48, 0.036, 0.036]} />
              </mesh>
              <mesh position={[0.22, 0, 0]} material={trussMat}>
                <boxGeometry args={[0.036, 0.036, 0.48]} />
              </mesh>
              <mesh position={[-0.22, 0, 0]} material={trussMat}>
                <boxGeometry args={[0.036, 0.036, 0.48]} />
              </mesh>
              <mesh
                position={[0, 0.55, 0.22]}
                rotation={[0, 0, bIdx % 2 === 0 ? 0.36 : -0.36]}
                material={trussMat}
              >
                <boxGeometry args={[0.03, 1.24, 0.03]} />
              </mesh>
              <mesh
                position={[0.22, 0.55, 0]}
                rotation={[bIdx % 2 === 0 ? 0.36 : -0.36, 0, 0]}
                material={trussMat}
              >
                <boxGeometry args={[0.03, 1.24, 0.03]} />
              </mesh>
              <mesh
                position={[-0.22, 0.55, 0]}
                rotation={[bIdx % 2 === 0 ? -0.36 : 0.36, 0, 0]}
                material={trussMat}
              >
                <boxGeometry args={[0.03, 1.24, 0.03]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* Overhead Horizontal & Angled Concert Roof Truss spanning X = -6.0 to +6.0 at Y = 7.8, Z = -8.5 */}
      <group position={[0, 7.8, -8.5]}>
        {[
          [0.2, 0.2],
          [-0.2, 0.2],
          [0.2, -0.2],
          [-0.2, -0.2]
        ].map(([cy, cz], idx) => (
          <mesh key={idx} position={[0, cy, cz]} material={trussMat}>
            <boxGeometry args={[12.2, 0.052, 0.052]} />
          </mesh>
        ))}
        {roofBayXs.map((bx, idx) => (
          <group key={bx} position={[bx, 0, 0]}>
            <mesh position={[0, 0, 0.2]} rotation={[0, 0, idx % 2 === 0 ? 0.72 : -0.72]} material={trussMat}>
              <boxGeometry args={[0.034, 0.58, 0.034]} />
            </mesh>
            <mesh position={[0, 0, -0.2]} rotation={[0, 0, idx % 2 === 0 ? -0.72 : 0.72]} material={trussMat}>
              <boxGeometry args={[0.034, 0.58, 0.034]} />
            </mesh>
            <mesh position={[0, 0.2, 0]} material={trussMat}>
              <boxGeometry args={[0.034, 0.034, 0.44]} />
            </mesh>
            <mesh position={[0, -0.2, 0]} material={trussMat}>
              <boxGeometry args={[0.034, 0.034, 0.44]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Angled Roof Side Truss Beams connecting Vertical Towers (Z = -9.5) to Overhead Truss (Z = -8.5) & Speaker Wings */}
      {[-5.8, 5.8].map((sx) => (
        <group key={sx} position={[sx, 8.05, -8.5]} rotation={[0.14, 0, 0]}>
          <mesh position={[0.18, 0, 0]} material={trussMat}>
            <boxGeometry args={[0.045, 0.045, 2.8]} />
          </mesh>
          <mesh position={[-0.18, 0, 0]} material={trussMat}>
            <boxGeometry args={[0.045, 0.045, 2.8]} />
          </mesh>
          <mesh position={[0, -0.32, 0]} material={trussMat}>
            <boxGeometry args={[0.38, 0.04, 2.8]} />
          </mesh>
        </group>
      ))}

      {/* HANGING LINE-ARRAY CONCERT SPEAKER CLUSTERS: 8 Curved Matte-Black Cabinets at [±4.8, 5.8, -7.5] */}
      {[-4.8, 4.8].map((lx) => (
        <group key={lx} position={[lx, 5.8, -7.5]} rotation={[0.06, lx < 0 ? 0.16 : -0.16, 0]}>
          {/* Top Rigging Flybar */}
          <mesh position={[0, 1.36, 0]} material={trussMat}>
            <boxGeometry args={[0.92, 0.07, 0.64]} />
          </mesh>
          <mesh position={[0, 1.72, -0.14]} material={trussMat}>
            <cylinderGeometry args={[0.018, 0.018, 0.72, 8]} />
          </mesh>
          <mesh position={[0, 1.72, 0.14]} material={trussMat}>
            <cylinderGeometry args={[0.018, 0.018, 0.72, 8]} />
          </mesh>
          {/* 8 Curved Line-Array Cabinets */}
          {Array.from({ length: 8 }).map((_, idx) => {
            const cy = 1.08 - idx * 0.3;
            const cz = -Math.pow(idx / 7, 1.65) * 0.24;
            const tiltX = idx * 0.065;
            return (
              <group key={idx} position={[0, cy, cz]} rotation={[tiltX, 0, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.84, 0.26, 0.54]} />
                  <meshStandardMaterial color="#0c0e14" roughness={0.72} metalness={0.18} />
                </mesh>
                <mesh position={[0, 0, 0.273]}>
                  <planeGeometry args={[0.76, 0.22]} />
                  <meshStandardMaterial map={speakerGrilleTex} color="#1b1f29" roughness={0.55} metalness={0.7} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}

      {/* 10 MOVING-HEAD SPOTLIGHTS along Overhead Truss (Y = 7.6, Z = -8.2) with Ultra-Soft Narrow Beams */}
      {movingHeadXs.map((sx, idx) => {
        const beamColor = movingHeadColors[idx];
        return (
          <group key={idx}>
            <group position={[sx, 7.6, -8.2]} rotation={[0.24, 0, -sx * 0.04]}>
              {/* Yoke & Base Clamp */}
              <mesh position={[0, 0.18, 0]} material={trussMat}>
                <boxGeometry args={[0.22, 0.06, 0.18]} />
              </mesh>
              {/* Dark Cylindrical Moving-Head Fixture */}
              <mesh>
                <cylinderGeometry args={[0.11, 0.14, 0.34, 14]} />
                <meshStandardMaterial color="#14161d" roughness={0.28} metalness={0.85} />
              </mesh>
              {/* Small Intensely Bright Glowing Lens Core */}
              <mesh position={[0, -0.175, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.09, 14]} />
                <meshStandardMaterial
                  ref={(el) => {
                    movingHeadLensMatRefs.current[idx] = el;
                  }}
                  color="#ffffff"
                  emissive={beamColor}
                  emissiveIntensity={2.4}
                />
              </mesh>
              <sprite
                ref={(el) => {
                  movingHeadFlareSpriteRefs.current[idx] = el;
                }}
                position={[0, -0.19, 0.03]}
                scale={[0.52, 0.52, 1]}
              >
                <spriteMaterial
                  ref={(el) => {
                    movingHeadFlareMatRefs.current[idx] = el;
                  }}
                  map={parFlareTex}
                  color={beamColor}
                  transparent
                  opacity={0.44}
                  depthWrite={false}
                  blending={THREE.AdditiveBlending}
                />
              </sprite>
            </group>

            {/* Narrow Volumetric Beam Cone pivoted inside moving head lens [sx, 7.42, -8.2] */}
            <group
              position={[sx, 7.42, -8.2]}
              ref={(el) => {
                movingHeadBeamRefs.current[idx] = el;
              }}
            >
              <mesh position={[0, -3.4, 0]} material={movingHeadBeamMats[idx]}>
                <cylinderGeometry args={[0.07, 0.72, 6.8, 20, 1, true]} />
              </mesh>
            </group>
          </group>
        );
      })}

      {/* 6 FLOOR-STANDING STAGE BLINDERS along Rear Riser (Y = 1.3, Z = -9.5) */}
      {floorBlinderXs.map((fx, idx) => {
        const blinderColor = idx % 2 === 0 ? '#ffddaa' : '#ff2a85';
        return (
          <group key={fx} position={[fx, 1.3, -9.5]} rotation={[-0.36, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.42, 0.22, 0.24]} />
              <meshStandardMaterial color="#14161d" metalness={0.85} roughness={0.25} />
            </mesh>
            {[-0.1, 0.1].map((lx, subIdx) => {
              const blinderKey = idx * 2 + subIdx;
              return (
                <group key={lx} position={[lx, 0, 0.123]}>
                  <mesh>
                    <circleGeometry args={[0.062, 12]} />
                    <meshStandardMaterial
                      ref={(el) => {
                        blinderLensMatRefs.current[blinderKey] = el;
                      }}
                      color="#ffffff"
                      emissive={blinderColor}
                      emissiveIntensity={2.2}
                    />
                  </mesh>
                  <sprite
                    ref={(el) => {
                      blinderFlareSpriteRefs.current[blinderKey] = el;
                    }}
                    position={[0, 0, 0.02]}
                    scale={[0.38, 0.38, 1]}
                  >
                    <spriteMaterial
                      ref={(el) => {
                        blinderFlareMatRefs.current[blinderKey] = el;
                      }}
                      map={parFlareTex}
                      color={blinderColor}
                      transparent
                      opacity={0.35}
                      depthWrite={false}
                      blending={THREE.AdditiveBlending}
                    />
                  </sprite>
                </group>
              );
            })}
          </group>
        );
      })}

      {/* Two-Tier Side Balconies at X = -8.5 and X = +8.5 (Y = 3.2 and Y = 5.6) */}
      {[-8.5, 8.5].map((bx) => {
        const inward = bx > 0 ? -1 : 1;
        const colX = bx > 0 ? 10.0 : -10.0;
        return (
          <group key={bx}>
            {[3.2, 5.6].map((tierY) => (
              <group key={tierY} position={[bx, tierY, -0.5]}>
                <mesh>
                  <boxGeometry args={[2.8, 0.28, 20]} />
                  <meshStandardMaterial
                    map={stageWood.map}
                    color="#1a1418"
                    roughness={0.68}
                    metalness={0.2}
                  />
                </mesh>
                <mesh position={[inward * 1.32, 0.46, 0]}>
                  <boxGeometry args={[0.12, 0.72, 20]} />
                  <meshStandardMaterial color="#1c151a" roughness={0.68} />
                </mesh>
                <mesh position={[inward * 1.32, 0.85, 0]} material={balconyTrimMat}>
                  <boxGeometry args={[0.14, 0.1, 20]} />
                </mesh>
                {[-5.5, -3.2, -0.9, 1.4, 3.7, 6.0].map((sz) => (
                  <group key={sz} position={[inward * 0.35, 0.2, sz]}>
                    <mesh position={[0, 0.14, 0]}>
                      <boxGeometry args={[0.48, 0.14, 0.5]} />
                      <meshStandardMaterial color="#1d1422" roughness={0.85} />
                    </mesh>
                    <mesh position={[-inward * 0.2, 0.4, 0]}>
                      <boxGeometry args={[0.1, 0.5, 0.48]} />
                      <meshStandardMaterial color="#241628" roughness={0.85} />
                    </mesh>
                  </group>
                ))}
              </group>
            ))}

            {[-7, -1, 5, 10].map((cz) => (
              <mesh key={cz} geometry={columnGeometry} position={[colX, 0, cz]}>
                <meshStandardMaterial color="#15131c" roughness={0.5} metalness={0.35} />
              </mesh>
            ))}

            {[-4.5, -0.5, 3.5, 7.5].map((sz) => (
              <group key={sz} position={[colX + inward * 0.58, 4.35, sz]}>
                <mesh>
                  <cylinderGeometry args={[0.075, 0.045, 0.26, 10]} />
                  <meshStandardMaterial color="#fef3c7" emissive="#ffcf70" emissiveIntensity={1.45} />
                </mesh>
                <pointLight color="#ffaa55" intensity={0.9} decay={1.2} distance={10} />
              </group>
            ))}
          </group>
        );
      })}

      {/* Exactly TWO Ornate Multi-Tier Crystal Chandeliers positioned wide on Left & Right Wings */}
      <CrystalChandelier position={[-6.2, 7.8, 0.5]} scale={1.12} lightRef={leftChandelierLightRef} />
      <CrystalChandelier position={[6.2, 7.8, 0.5]} scale={1.12} lightRef={rightChandelierLightRef} />

      {/* CONCERT LIGHTING RIG: Tight Focused Performer Spots + Crowd Rim Backlight + Overhead Crowd Fill */}
      <primitive object={singerTarget} />
      <primitive object={crowdRimTarget} />

      {/* Focused Front Warm Stage Key onto Lead Vocalist & Band */}
      <spotLight
        ref={frontSpotRef}
        color={cal.keyColor}
        intensity={cal.keyIntensity}
        decay={cal.lightDecay}
        distance={26}
        angle={0.44}
        penumbra={0.72}
        position={[0, 7.2, 1.2]}
        target={singerTarget}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />

      {/* Narrow Truss Gold & Magenta Accent Spots */}
      <spotLight
        ref={goldTrussSpotRef}
        color={cal.fillColor}
        intensity={cal.fillIntensity * 1.45}
        decay={cal.lightDecay}
        distance={22}
        angle={0.18}
        penumbra={0.85}
        position={[-2.75, 7.6, -8.2]}
        target={singerTarget}
      />
      <spotLight
        ref={magentaTrussSpotRef}
        color="#ff2a85"
        intensity={cal.fillIntensity * 1.35}
        decay={cal.lightDecay}
        distance={22}
        angle={0.18}
        penumbra={0.85}
        position={[2.75, 7.6, -8.2]}
        target={singerTarget}
      />

      {/* Stage-to-Crowd Backlight (Rim Light) illuminating heads, hair, shoulders & raised cheering hands */}
      <directionalLight
        ref={crowdRimDirRef}
        color={cal.rimColor}
        intensity={cal.rimIntensity}
        position={[0, 6.2, -7.5]}
        target={crowdRimTarget}
      />

      {/* Warm Crowd Overhead Fill illuminating the dancing audience */}
      <pointLight
        ref={crowdPointRef}
        color="#ffaa55"
        intensity={cal.fillIntensity}
        distance={18}
        decay={cal.lightDecay}
        position={[0, 6.5, 3.5]}
      />

      <hemisphereLight
        ref={hemiLightRef}
        args={[cal.hemiSkyColor, cal.hemiGroundColor, cal.hemiIntensity]}
      />
    </group>
  );
}

/**
 * HARD-LOCKED SYMMETRICAL FRONT CAMERA RIG (Zero Orbital Drift):
 * - 'cinematic' (Default): pos [0, 2.35, 8.2], target [0, 2.3, -6.5], fov 50
 * - 'first_person': pos [0, 1.85, 3.2], target [0, 2.2, -6.5], fov 50 (with WASD/drag walk when moving)
 * - 'stage_closeup': pos [0, 2.1, -2.2], target [0, 2.1, -6.2], fov 50
 */
function ConcertCameraRig({
  cameraPreset,
  moveInputRef,
  isActive = true
}: {
  cameraPreset: RoomCameraPreset;
  moveInputRef: React.MutableRefObject<RoomMoveInput>;
  isActive?: boolean;
}) {
  const { camera, gl } = useThree();
  const fpsRef = useRef({
    x: 0,
    y: 1.85,
    z: 3.2,
    vy: 0,
    yaw: 0,
    pitch: Math.atan2(2.2 - 1.85, 9.7),
    walkBob: 0,
    onGround: true
  });
  const dragRef = useRef({ active: false, pointerId: -1, lastX: 0, lastY: 0 });

  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.isPerspectiveCamera) {
      persp.fov = 50;
      persp.updateProjectionMatrix();
    }

    if (cameraPreset === 'first_person') {
      const dx = 0 - 0;
      const dy = 2.2 - 1.85;
      const dz = -6.5 - 3.2;
      const initYaw = Math.atan2(-dx, -dz);
      const initPitch = Math.atan2(dy, Math.hypot(dx, dz));
      fpsRef.current = {
        x: 0,
        y: 1.85,
        z: 3.2,
        vy: 0,
        yaw: initYaw,
        pitch: initPitch,
        walkBob: 0,
        onGround: true
      };
      camera.position.set(0, 1.85, 3.2);
      camera.rotation.set(initPitch, initYaw, 0, 'YXZ');
    } else if (cameraPreset === 'stage_closeup') {
      camera.position.set(0, 2.1, -2.2);
      camera.lookAt(0, 2.1, -6.2);
    } else {
      camera.position.set(0, 2.35, 8.2);
      camera.lookAt(0, 2.3, -6.5);
    }
  }, [camera, cameraPreset]);

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
      fpsRef.current.pitch = THREE.MathUtils.clamp(fpsRef.current.pitch - dy * sens, -0.9, 0.9);
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
    if (!isActive) return;
    const persp = camera as THREE.PerspectiveCamera;
    if (persp.isPerspectiveCamera && persp.fov !== 50) {
      persp.fov = 50;
      persp.updateProjectionMatrix();
    }

    if (cameraPreset === 'stage_closeup') {
      camera.position.set(0, 2.1, -2.2);
      camera.lookAt(0, 2.1, -6.2);
      return;
    }

    if (cameraPreset === 'cinematic') {
      camera.position.set(0, 2.35, 8.2);
      camera.lookAt(0, 2.3, -6.5);
      return;
    }

    // First-person movement & view
    const dt = Math.min(0.1, delta);
    const f = fpsRef.current;
    const m = moveInputRef.current;
    const speed = (m.sprint ? 5.6 : 3.4) * dt;
    if (Math.hypot(m.forward, m.strafe) > 0.04) {
      _forwardVec.set(-Math.sin(f.yaw), 0, -Math.cos(f.yaw));
      _rightVec.set(Math.cos(f.yaw), 0, -Math.sin(f.yaw));
      f.x += (_forwardVec.x * m.forward + _rightVec.x * m.strafe) * speed;
      f.z += (_forwardVec.z * m.forward + _rightVec.z * m.strafe) * speed;
      f.walkBob += dt * (m.sprint ? 11 : 8);
    }
    if (m.jump && f.onGround) {
      f.vy = 5.5;
      f.onGround = false;
      m.jump = false;
    }
    if (!f.onGround) {
      f.vy -= 18 * dt;
      f.y += f.vy * dt;
      if (f.y <= 1.85) {
        f.y = 1.85;
        f.vy = 0;
        f.onGround = true;
      }
    }
    f.x = THREE.MathUtils.clamp(f.x, -6.2, 6.2);
    f.z = THREE.MathUtils.clamp(f.z, -2.5, 8.0);
    camera.position.set(f.x, f.y + (f.onGround ? Math.sin(f.walkBob) * 0.025 : 0), f.z);
    camera.rotation.set(f.pitch, f.yaw, 0, 'YXZ');
  });

  return null;
}

function ConcertProceduralEnvironment() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.3}>
      <color attach="background" args={['#040508']} />
      <Lightformer form="rect" intensity={1.8} color="#ffddaa" position={[0, 7, -4]} rotation={[Math.PI / 2, 0, 0]} scale={[12, 3, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#ff2a85" position={[-6, 4, -7]} rotation={[0, Math.PI / 4, 0]} scale={[4, 3, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#ffddaa" position={[6, 4, -7]} rotation={[0, -Math.PI / 4, 0]} scale={[4, 3, 1]} />
      <Lightformer form="ring" intensity={0.7} color="#94a3b8" position={[0, 6, 4]} rotation={[Math.PI / 2.4, 0, 0]} scale={[8, 8, 1]} />
    </Environment>
  );
}

function ConcertSceneBody({
  manifest,
  mocapClips,
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
  connectedPeers = [],
  latestTrackDeviceName,
  isActive = true,
  onReady,
  onInteractHotspot
}: {
  manifest: ConcertAssetManifest;
  mocapClips: THREE.AnimationClip[];
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
  connectedPeers?: RoomPeerParticipant[];
  latestTrackDeviceName?: string;
  isActive?: boolean;
  onReady?: () => void;
  onInteractHotspot?: (action: 'toggle_play' | 'next_track' | 'trigger_fx' | 'open_dj') => void;
}) {
  const cal = lightingCalibration || DEFAULT_ROOM_LIGHTING_PROFILES.concert;
  const concertPeerMap = useMemo(() => {
    const slots = [
      { key: 'floor-2-10', isFemale: true },
      { key: 'floor-2-9', isFemale: false },
      { key: 'floor-1-9', isFemale: true },
      { key: 'floor-1-10', isFemale: false },
      { key: 'floor-3-9', isFemale: true },
      { key: 'floor-3-10', isFemale: false },
      { key: 'floor-2-8', isFemale: true },
      { key: 'floor-2-11', isFemale: false },
      { key: 'stage-vocals', isFemale: true },
      { key: 'stage-guitar', isFemale: false },
      { key: 'stage-synth', isFemale: false },
      { key: 'stage-drums', isFemale: false }
    ];
    return assignPeersToCastSlots(connectedPeers, slots, latestTrackDeviceName);
  }, [connectedPeers, latestTrackDeviceName]);

  const vocalsPeer = concertPeerMap.get('stage-vocals');
  const guitarPeer = concertPeerMap.get('stage-guitar');
  const synthPeer = concertPeerMap.get('stage-synth');
  const drumsPeer = concertPeerMap.get('stage-drums');

  return (
    <>
      {manifest.hdri ? (
        <ConcertErrorBoundary fallback={<ConcertProceduralEnvironment />}>
          <Suspense fallback={<ConcertProceduralEnvironment />}>
            <Environment files={manifest.hdri} environmentIntensity={cal.envIntensity} />
          </Suspense>
        </ConcertErrorBoundary>
      ) : (
        <ConcertProceduralEnvironment />
      )}

      <TheaterArchitectureAndStage
        isPlaying={isPlaying}
        bpm={bpm}
        pulseIntensity={pulseIntensity}
        lightingFxMode={lightingFxMode}
        fxBurstSeq={fxBurstSeq}
        trackTitle={trackTitle}
        trackArtist={trackArtist}
        trackCoverUrl={trackCoverUrl}
        trackAccentHex={trackAccentHex}
        lightingCalibration={cal}
        isActive={isActive}
      />

      <ContactShadows
        position={[0, 0.01, 2.6]}
        opacity={0.55}
        scale={24}
        blur={2.0}
        far={4}
        resolution={256}
        frames={2}
        color="#05030b"
      />
      <ContactShadows
        position={[0, 1.21, -7.0]}
        opacity={0.58}
        scale={15}
        blur={2.0}
        far={4}
        resolution={256}
        frames={2}
        color="#05030b"
      />

      {/* 4 Illuminated Human Stage Performers */}
      <StageHumanPerformer
        modelUrl={manifest.singer}
        mocapClips={mocapClips}
        kind="female"
        archetype={HUMAN_ARCHETYPES[6]}
        position={[0, STAGE_SURFACE_Y, -6.0]}
        rotation={[0, 0, 0]}
        targetHeight={1.82}
        rimColor="#ffcf70"
        instrument="vocals"
        isPlaying={isPlaying}
        bpm={bpm}
        isActive={isActive}
        onClick={() => onInteractHotspot?.('toggle_play')}
      >
        {vocalsPeer && (
          <PeerOverheadBadge peer={vocalsPeer.peer} isLatestDJ={vocalsPeer.isLatestDJ} headHeight={1.98} />
        )}
      </StageHumanPerformer>

      <StageHumanPerformer
        modelUrl={manifest.guitarist}
        mocapClips={mocapClips}
        kind="male"
        archetype={HUMAN_ARCHETYPES[1]}
        position={[-2.8, STAGE_SURFACE_Y, -6.8]}
        rotation={[0, 0.3, 0]}
        targetHeight={1.8}
        rimColor="#e838ff"
        instrument="guitar"
        isPlaying={isPlaying}
        bpm={bpm}
        isActive={isActive}
      >
        {guitarPeer && (
          <PeerOverheadBadge peer={guitarPeer.peer} isLatestDJ={guitarPeer.isLatestDJ} headHeight={1.96} />
        )}
      </StageHumanPerformer>

      <StageHumanPerformer
        modelUrl={manifest.maleHuman}
        mocapClips={mocapClips}
        kind="male"
        archetype={HUMAN_ARCHETYPES[5]}
        position={[2.8, STAGE_SURFACE_Y, -6.8]}
        rotation={[0, -0.3, 0]}
        targetHeight={1.8}
        rimColor="#ffcf70"
        instrument="synth"
        isPlaying={isPlaying}
        bpm={bpm}
        isActive={isActive}
      >
        {synthPeer && (
          <PeerOverheadBadge peer={synthPeer.peer} isLatestDJ={synthPeer.isLatestDJ} headHeight={1.96} />
        )}
      </StageHumanPerformer>

      <StageHumanPerformer
        modelUrl={manifest.drummer}
        mocapClips={mocapClips}
        kind="male"
        archetype={HUMAN_ARCHETYPES[3]}
        position={[0, DRUM_RISER_TOP_Y, -8.4]}
        rotation={[0, 0, 0]}
        targetHeight={1.78}
        rimColor="#ffddaa"
        instrument="drums"
        isPlaying={isPlaying}
        bpm={bpm}
        isActive={isActive}
      >
        {drumsPeer && (
          <PeerOverheadBadge peer={drumsPeer.peer} isLatestDJ={drumsPeer.isLatestDJ} headHeight={1.94} />
        )}
      </StageHumanPerformer>

      {/* 120 Floor Spectators + 16 Two-Tier Balcony Spectators */}
      <NonAdjacentAnimatedCrowd
        manifest={manifest}
        mocapClips={mocapClips}
        isPlaying={isPlaying}
        bpm={bpm}
        pulseIntensity={pulseIntensity}
        isActive={isActive}
        peerMap={concertPeerMap}
      />
      <SceneReadySignal active={isActive} onReady={onReady} />
    </>
  );
}

function MocapLoadedConcertContent(props: {
  manifest: ConcertAssetManifest;
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
  connectedPeers?: RoomPeerParticipant[];
  latestTrackDeviceName?: string;
  isActive?: boolean;
  onReady?: () => void;
  onInteractHotspot?: (action: 'toggle_play' | 'next_track' | 'trigger_fx' | 'open_dj') => void;
}) {
  const loaded = useGLTF(props.manifest.mocapAnimUrls, DRACO_DECODER_URL) as unknown as
    | Array<{ animations?: THREE.AnimationClip[] }>
    | { animations?: THREE.AnimationClip[] };
  const mocapClips = useMemo(() => {
    const arr = Array.isArray(loaded) ? loaded : [loaded];
    return arr.flatMap((g) => g?.animations || []);
  }, [loaded]);

  return <ConcertSceneBody {...props} mocapClips={mocapClips} />;
}

function ConcertExposureSync({ exposure }: { exposure: number }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [exposure, gl]);
  return null;
}

export function ConcertHallScene({
  isPlaying,
  bpm,
  pulseIntensity,
  cameraPreset,
  lightingFxMode,
  fxBurstSeq,
  moveInputRef,
  trackTitle = 'ضربان نیمهشب در ایستگاه نئون',
  trackArtist = 'Live Stage Performance',
  trackCoverUrl,
  trackAccentHex = '#e838ff',
  lightingCalibration,
  connectedPeers = [],
  latestTrackDeviceName,
  isActive = true,
  onReady,
  onInteractHotspot
}: ConcertHallSceneProps) {
  const [manifest, setManifest] = useState<ConcertAssetManifest | null>(null);
  const cal = lightingCalibration || DEFAULT_ROOM_LIGHTING_PROFILES.concert;

  useEffect(() => {
    preloadConcertAssets();
    let active = true;
    void resolveConcertAssetManifest().then((m) => {
      if (active) setManifest(m);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ConcertErrorBoundary
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-[#06070C] text-xs text-[#CBD5E1]">
          3D Concert Scene Loading...
        </div>
      }
    >
      <Canvas
        frameloop={isActive ? 'always' : 'never'}
        shadows="soft"
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.NoToneMapping,
          toneMappingExposure: cal.exposure
        }}
        camera={{ position: [0, 2.35, 8.2], fov: 50, near: 0.1, far: 160 }}
        className="w-full h-full touch-none"
      >
        <ConcertExposureSync exposure={cal.exposure} />
        <color attach="background" args={['#040508']} />
        <fogExp2 attach="fog" args={['#040508', cal.fogDensity]} />
        <ambientLight color={cal.ambientColor} intensity={cal.ambientIntensity} />

        <ConcertCameraRig
          cameraPreset={cameraPreset}
          moveInputRef={moveInputRef}
          isActive={isActive}
        />

        {manifest && (
          <Suspense fallback={null}>
            {manifest.mocapAnimUrls.length > 0 ? (
              <MocapLoadedConcertContent
                manifest={manifest}
                isPlaying={isPlaying}
                bpm={bpm}
                pulseIntensity={pulseIntensity}
                lightingFxMode={lightingFxMode}
                fxBurstSeq={fxBurstSeq}
                trackTitle={trackTitle}
                trackArtist={trackArtist}
                trackCoverUrl={trackCoverUrl}
                trackAccentHex={trackAccentHex}
                lightingCalibration={cal}
                connectedPeers={connectedPeers}
                latestTrackDeviceName={latestTrackDeviceName}
                isActive={isActive}
                onReady={onReady}
                onInteractHotspot={onInteractHotspot}
              />
            ) : (
              <ConcertSceneBody
                manifest={manifest}
                mocapClips={[]}
                isPlaying={isPlaying}
                bpm={bpm}
                pulseIntensity={pulseIntensity}
                lightingFxMode={lightingFxMode}
                fxBurstSeq={fxBurstSeq}
                trackTitle={trackTitle}
                trackArtist={trackArtist}
                trackCoverUrl={trackCoverUrl}
                trackAccentHex={trackAccentHex}
                lightingCalibration={cal}
                connectedPeers={connectedPeers}
                latestTrackDeviceName={latestTrackDeviceName}
                isActive={isActive}
                onReady={onReady}
                onInteractHotspot={onInteractHotspot}
              />
            )}
          </Suspense>
        )}

        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            luminanceThreshold={cal.bloomThreshold}
            intensity={cal.bloomIntensity}
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette eskil={false} offset={0.25} darkness={cal.vignetteDarkness} />
        </EffectComposer>
      </Canvas>
    </ConcertErrorBoundary>
  );
}
