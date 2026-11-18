import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, MeshReflectorMaterial, OrbitControls, RoundedBox, useGLTF } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { djAudioController } from '../../prototype/djAudioEngine';
import type { RoomLightingFxMode } from '../../prototype/components/SonicRoom3DWorld';
import {
  DEFAULT_ROOM_LIGHTING_PROFILES,
  type RoomLightingCalibration
} from '../../types/lighting';
import {
  DRACO_DECODER_URL,
  HUMAN_ARCHETYPES,
  type ConcertAssetManifest
} from '../concert/concertAssets';
import {
  acousticSlatsPBR,
  brickWallPBR,
  createPBRMaterial,
  disposePBRMaterial,
  isSoftwareWebGL,
  RoomErrorBoundary,
  sampleMusicSyncLighting,
  SceneReadySignal,
  useConcertAssetManifest,
  useLoadedMocapClips,
  woodPlanksPBR,
  type RoomCameraSpec,
  type SharedRoomSceneProps
} from '../shared/SonicRoomShared';
import { usePolyHavenPBR } from '../shared/polyhavenTextures';
import { assignPeersToCastSlots, PeerOverheadBadge } from '../shared/RoomPeerAvatars';
import type { RoomPeerParticipant } from '../../types/roomSync';
import { loadCachedHDRTexture } from '../../services/roomAssetPreloader';

/**
 * Local asset paths in /public (Vite serves /public/* from root /*)
 */
export const PODCAST_HDR_PUBLIC_PATH = '/public/hdr/studio_small_08_1k.hdr';
export const PODCAST_STUDIO_GLB_PUBLIC_PATH = '/public/models/podcast/podcast-studio.glb';
export const PODCAST_HOSTS_GLB_PUBLIC_PATH = '/public/models/podcast/hosts.glb';
export const PODCAST_COHOST_GLB_PUBLIC_PATH = '/public/models/podcast/cohost.glb';

function resolvePublicUrl(publicPath: string): string {
  return publicPath.replace(/^\/public\//, '/');
}

const PODCAST_HDR_URL = resolvePublicUrl(PODCAST_HDR_PUBLIC_PATH);
const PODCAST_STUDIO_GLB_URL = resolvePublicUrl(PODCAST_STUDIO_GLB_PUBLIC_PATH);
const PODCAST_HOSTS_GLB_URL = resolvePublicUrl(PODCAST_HOSTS_GLB_PUBLIC_PATH);
const PODCAST_COHOST_GLB_URL = resolvePublicUrl(PODCAST_COHOST_GLB_PUBLIC_PATH);

const configureMeshopt = (loader: { setMeshoptDecoder?: (decoder: typeof MeshoptDecoder) => void }) => {
  if (typeof loader.setMeshoptDecoder === 'function') {
    loader.setMeshoptDecoder(MeshoptDecoder);
  }
};

useGLTF.preload(PODCAST_STUDIO_GLB_URL, DRACO_DECODER_URL, true, configureMeshopt);
useGLTF.preload(PODCAST_HOSTS_GLB_URL, DRACO_DECODER_URL, true, configureMeshopt);
useGLTF.preload(PODCAST_COHOST_GLB_URL, DRACO_DECODER_URL, true, configureMeshopt);

/**
 * 3. MOBILE PORTRAIT (9:16) CAMERA & WIDE CINEMATIC FRAMING
 * Default camera ("سینمایی آزاد"): position: [0, 2.1, 6.2], target: [0, 1.6, -4.2], fov: 60
 */
export const PODCAST_CAMERA_SPEC: RoomCameraSpec = {
  cinematic: { position: [0, 2.1, 6.2], target: [0, 1.6, -4.2], fov: 60 },
  first_person: { position: [0, 1.65, 3.0], target: [0, 1.6, -4.2], fov: 62 },
  stage_closeup: { position: [0, 1.65, -1.2], target: [0, 1.5, -4.5], fov: 52 },
  bounds: { minX: -4.1, maxX: 4.1, minY: 1.0, maxY: 4.7, minZ: -2.6, maxZ: 7.4 }
};

const _forwardVec = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _bonePos = new THREE.Vector3();
const _childPos = new THREE.Vector3();
const _curDir = new THREE.Vector3();
const _tgtDir = new THREE.Vector3();
const _qDelta = new THREE.Quaternion();
const _parentQuat = new THREE.Quaternion();
const _localDelta = new THREE.Quaternion();
const _qTmp = new THREE.Quaternion();
const _eTmp = new THREE.Euler();

const PODCAST_CLIP_CACHE = new Map<string, THREE.AnimationClip>();

function findSkeletonBone(root: THREE.Object3D, suffix: string): THREE.Bone | null {
  let matched: THREE.Bone | null = null;
  const clean = suffix.replace(/^mixamorig:?/i, '').toLowerCase();
  root.traverse((obj) => {
    if (matched) return;
    if ((obj as THREE.Bone).isBone) {
      const n = obj.name.toLowerCase();
      if (n === suffix.toLowerCase() || n.endsWith(clean)) {
        matched = obj as THREE.Bone;
      }
    }
  });
  return matched;
}

function aimBoneWorldDir(
  root: THREE.Object3D,
  boneName: string,
  childName: string,
  targetWorldDir: [number, number, number]
) {
  const bone = findSkeletonBone(root, boneName);
  const child = findSkeletonBone(root, childName);
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
 * Strips any root-motion or bone translation/scale tracks from an AnimationClip
 * so skeleton bones never drift, stretch, or distort inside the mesh.
 */
function stripRootMotionAndTranslationTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  const rotationOnlyTracks = clip.tracks.filter((track) => track.name.endsWith('.quaternion'));
  return new THREE.AnimationClip(clip.name, clip.duration, rotationOnlyTracks);
}

function applySeatedBroadcastPosture(root: THREE.Object3D) {
  root.updateMatrixWorld(true);

  // Natural relaxed seated legs: thighs angled slightly downward toward knees, calves vertical so feet plant firmly
  aimBoneWorldDir(root, 'mixamorigLeftUpLeg', 'mixamorigLeftLeg', [0.09, -0.24, 0.96]);
  aimBoneWorldDir(root, 'mixamorigLeftLeg', 'mixamorigLeftFoot', [0.02, -0.99, 0.08]);
  aimBoneWorldDir(root, 'mixamorigRightUpLeg', 'mixamorigRightLeg', [-0.09, -0.24, 0.96]);
  aimBoneWorldDir(root, 'mixamorigRightLeg', 'mixamorigRightFoot', [-0.02, -0.99, 0.08]);

  // Relaxed shoulders, upper arms resting naturally down along the torso, forearms resting comfortably forward
  aimBoneWorldDir(root, 'mixamorigLeftArm', 'mixamorigLeftForeArm', [0.16, -0.86, 0.42]);
  aimBoneWorldDir(root, 'mixamorigLeftForeArm', 'mixamorigLeftHand', [-0.22, 0.06, 0.95]);
  aimBoneWorldDir(root, 'mixamorigRightArm', 'mixamorigRightForeArm', [-0.16, -0.86, 0.42]);
  aimBoneWorldDir(root, 'mixamorigRightForeArm', 'mixamorigRightHand', [0.22, 0.06, 0.95]);

  root.updateMatrixWorld(true);
}

function buildSeatedPodcastGestureClip(
  modelUrl: string,
  root: THREE.Object3D,
  externalMocapClips: THREE.AnimationClip[],
  nativeClips: THREE.AnimationClip[],
  variant: number
): THREE.AnimationClip {
  const cacheKey = `podcast_host_breathing_v3|${modelUrl}|${variant % 4}|${externalMocapClips.length}`;

  const validExternal = externalMocapClips.filter((c) => !/tpose|t-pose/i.test(c.name) && c.duration > 0.25);
  const validNative = nativeClips.filter((c) => !/tpose|t-pose/i.test(c.name) && c.duration > 0.25);
  const rawIdleClip = validExternal.find((c) => /idle/i.test(c.name)) || validNative[0];

  if (rawIdleClip) {
    // Strip all root-motion / translation tracks before sampling so Hips bone never drifts
    const safeIdleClip = stripRootMotionAndTranslationTracks(rawIdleClip);
    const tmpMx = new THREE.AnimationMixer(root);
    const act = tmpMx.clipAction(safeIdleClip);
    act.reset().play();
    tmpMx.update(0.25);
    act.stop();
  }

  // Always apply seated posture directly to this cloned skeleton instance
  applySeatedBroadcastPosture(root);

  const cached = PODCAST_CLIP_CACHE.get(cacheKey);
  if (cached) return cached;

  const capture = (n: string) => findSkeletonBone(root, n)?.quaternion.clone() || new THREE.Quaternion();
  const hipsQ = capture('mixamorigHips');
  const lowSpineQ = capture('mixamorigSpine');
  const spineQ = capture('mixamorigSpine1');
  const spine2Q = capture('mixamorigSpine2');
  const neckQ = capture('mixamorigNeck');
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

  // Smooth, slow 6.0-second natural breathing & relaxed upper-body micro-movement loop
  const times = [0, 1.5, 3.0, 4.5, 6.0];
  const makeTrack = (bName: string, baseQ: THREE.Quaternion, keyOffsets: Array<[number, number, number]>) => {
    const bone = findSkeletonBone(root, bName);
    const actualName = bone ? bone.name : bName;
    const vals: number[] = [];
    keyOffsets.forEach(([rx, ry, rz]) => {
      _eTmp.set(rx, ry, rz);
      _qTmp.copy(baseQ).multiply(new THREE.Quaternion().setFromEuler(_eTmp));
      vals.push(_qTmp.x, _qTmp.y, _qTmp.z, _qTmp.w);
    });
    return new THREE.QuaternionKeyframeTrack(`${actualName}.quaternion`, times, vals);
  };

  const makeStaticTrack = (bName: string, baseQ: THREE.Quaternion) =>
    makeTrack(bName, baseQ, [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ]);

  const breath = 0.016;
  const sway = 0.018;
  const nod = 0.038;
  // Pure quaternion-only AnimationClip (ZERO .position tracks -> zero root-motion drift)
  const clip = new THREE.AnimationClip(`podcast_breathing_idle_${variant}`, 6.0, [
    makeStaticTrack('mixamorigHips', hipsQ),
    makeStaticTrack('mixamorigLeftUpLeg', lUpLegQ),
    makeStaticTrack('mixamorigLeftLeg', lLegQ),
    makeStaticTrack('mixamorigLeftFoot', lFootQ),
    makeStaticTrack('mixamorigRightUpLeg', rUpLegQ),
    makeStaticTrack('mixamorigRightLeg', rLegQ),
    makeStaticTrack('mixamorigRightFoot', rFootQ),
    makeTrack('mixamorigSpine', lowSpineQ, [
      [0, -sway * 0.4, -sway * 0.3],
      [breath * 0.7, 0, 0],
      [0, sway * 0.4, sway * 0.3],
      [breath * 0.7, 0, 0],
      [0, -sway * 0.4, -sway * 0.3]
    ]),
    makeTrack('mixamorigSpine1', spineQ, [
      [0, -sway * 0.5, -sway * 0.4],
      [breath, 0.012, 0],
      [0, sway * 0.5, sway * 0.4],
      [breath, -0.012, 0],
      [0, -sway * 0.5, -sway * 0.4]
    ]),
    makeTrack('mixamorigSpine2', spine2Q, [
      [0, 0, 0],
      [breath * 0.8, 0, 0],
      [0, 0, 0],
      [breath * 0.8, 0, 0],
      [0, 0, 0]
    ]),
    makeTrack('mixamorigNeck', neckQ, [
      [0, -0.02, 0],
      [nod * 0.35, 0.015, 0],
      [0, 0.02, 0],
      [nod * 0.25, -0.015, 0],
      [0, -0.02, 0]
    ]),
    makeTrack('mixamorigHead', headQ, [
      [0, -0.032, 0],
      [nod, 0.025, 0.01],
      [0.01, 0.032, 0],
      [nod * 0.65, -0.022, -0.01],
      [0, -0.032, 0]
    ]),
    makeTrack('mixamorigLeftArm', lArmQ, [
      [0, 0, 0],
      [0.022, 0, 0.014],
      [-0.01, 0, 0],
      [0.018, 0, -0.01],
      [0, 0, 0]
    ]),
    makeTrack('mixamorigLeftForeArm', lForeQ, [
      [0, 0, 0],
      [0.048, 0, 0],
      [0.01, 0, 0],
      [0.032, 0, 0],
      [0, 0, 0]
    ]),
    makeTrack('mixamorigRightArm', rArmQ, [
      [0, 0, 0],
      [-0.01, 0, 0],
      [0.024, 0, -0.015],
      [0.012, 0, 0],
      [0, 0, 0]
    ]),
    makeTrack('mixamorigRightForeArm', rForeQ, [
      [0, 0, 0],
      [0.018, 0, 0],
      [0.052, 0, 0],
      [0.018, 0, 0],
      [0, 0, 0]
    ])
  ]);

  PODCAST_CLIP_CACHE.set(cacheKey, clip);
  return clip;
}

/**
 * 1. HDRLoader Environment Setup (Three.js r180+ compatible)
 * Loads /public/hdr/studio_small_08_1k.hdr via HDRLoader and assigns to scene.environment
 */
function StudioHDRLoaderEnvironment() {
  const { scene, gl } = useThree();

  useEffect(() => {
    gl.setClearColor('#05060a', 1);
  }, [gl]);

  useEffect(() => {
    let active = true;

    void loadCachedHDRTexture(PODCAST_HDR_URL).then((cachedTex) => {
      if (!active) return;
      if (cachedTex) {
        scene.environment = cachedTex;
        scene.environmentIntensity = 0.68;
        return;
      }
      const loader = new HDRLoader();
      loader.load(
        PODCAST_HDR_PUBLIC_PATH,
        (hdrTexture) => {
          if (!active) {
            hdrTexture.dispose();
            return;
          }
          hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
          scene.environment = hdrTexture;
          scene.environmentIntensity = 0.68;
        },
        undefined,
        () => {
          // Silent fallback
        }
      );
    });

    return () => {
      active = false;
    };
  }, [scene]);

  return null;
}

/**
 * 2. Local Studio Model (/public/models/podcast/podcast-studio.glb) loaded via useGLTF + MeshoptDecoder
 */
function LocalPodcastStudioGLBModel() {
  const gltf = useGLTF(PODCAST_STUDIO_GLB_URL, DRACO_DECODER_URL, true, configureMeshopt);
  const clonedStudio = useMemo(() => {
    const c = gltf.scene.clone(true);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return c;
  }, [gltf.scene]);

  return <primitive object={clonedStudio} />;
}

/**
 * 2. Strict Avatar Rule (NO MATERIAL OVERWRITING):
 * Loads human podcast hosts from /public/models/podcast/hosts.glb with MeshoptDecoder
 * and clones via SkeletonUtils.clone(). Preserves 100% of original skin, face, eyes, and clothing textures.
 */
function PodcastHostAvatar({
  modelUrl = PODCAST_HOSTS_GLB_URL,
  mocapClips,
  archetypeIndex,
  position,
  rotationY,
  targetHeight = 1.72,
  seatHeight = 0.52,
  phaseOffset = 0,
  isPlaying,
  isActive = true,
  onClick,
  children
}: {
  modelUrl?: string;
  mocapClips: THREE.AnimationClip[];
  archetypeIndex: number;
  position: [number, number, number];
  rotationY: number;
  targetHeight?: number;
  seatHeight?: number;
  phaseOffset?: number;
  isPlaying: boolean;
  isActive?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const gltf = useGLTF(modelUrl, DRACO_DECODER_URL, true, configureMeshopt);
  const archetype = useMemo(
    () =>
      HUMAN_ARCHETYPES[
        ((archetypeIndex % HUMAN_ARCHETYPES.length) + HUMAN_ARCHETYPES.length) %
          HUMAN_ARCHETYPES.length
      ],
    [archetypeIndex]
  );

  const { clonedScene, mixer } = useMemo(() => {
    const cloned = skeletonClone(gltf.scene);
    cloned.position.set(0, 0, 0);
    cloned.rotation.set(0, 0, 0);
    cloned.scale.set(1, 1, 1);

    // 1. Measure standing height BEFORE bending legs into a seated pose so avatars scale to true 1:1 human proportions
    cloned.updateMatrixWorld(true);
    const standingBox = new THREE.Box3().setFromObject(cloned);
    const standingSize = new THREE.Vector3();
    standingBox.getSize(standingSize);
    const scale =
      standingSize.y > 0.01 ? (targetHeight * archetype.heightScale) / standingSize.y : 1;
    cloned.scale.set(scale * archetype.buildScaleX, scale, scale * archetype.buildScaleZ);
    cloned.updateMatrixWorld(true);

    // 2. Build & apply root-motion-free slow natural breathing seated posture clip
    const clip = buildSeatedPodcastGestureClip(
      modelUrl,
      cloned,
      mocapClips,
      gltf.animations,
      archetypeIndex
    );
    const mx = new THREE.AnimationMixer(cloned);
    const act = mx.clipAction(clip);
    act.reset().play();
    mx.update((phaseOffset * 1.75) % Math.max(0.8, clip.duration));

    // 3. Lock hips/pelvis cleanly onto the chair cushion (Y = -0.15 relative to chair seat reference)
    // and ensure feet rest firmly on the floor/footrest without floating
    cloned.updateMatrixWorld(true);
    const hipBone = findSkeletonBone(cloned, 'mixamorigHips') || findSkeletonBone(cloned, 'Hips');
    const targetHipY = seatHeight - 0.15;
    if (hipBone) {
      hipBone.getWorldPosition(_bonePos);
      cloned.position.y += targetHipY - _bonePos.y;
    } else {
      const seatedBox = new THREE.Box3().setFromObject(cloned);
      cloned.position.y += -0.15 - seatedBox.min.y;
    }
    cloned.updateMatrixWorld(true);

    // CRITICAL: DO NOT overwrite or tint any mesh.material or material.color!
    // Preserve 100% of factory GLTF skin, face, eyes, hair, and clothing PBR maps.
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });

    return { clonedScene: cloned, mixer: mx };
  }, [
    archetype.buildScaleX,
    archetype.buildScaleZ,
    archetype.heightScale,
    archetypeIndex,
    gltf.animations,
    gltf.scene,
    mocapClips,
    modelUrl,
    phaseOffset,
    seatHeight,
    targetHeight
  ]);

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  useFrame((_, delta) => {
    if (!isActive) return;
    // Smooth, steady natural breathing & relaxed upper-body micro-movement (zero twitching)
    const calmRate = isPlaying ? 0.85 : 0.55;
    mixer.update(Math.min(0.05, delta) * calmRate);
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
 * 3. Mobile Portrait (9:16) Camera Rig with Clamped OrbitControls
 * position: [0, 2.1, 6.2], target: [0, 1.6, -4.2], fov: 60
 * Clamped OrbitControls: minDistance: 3, maxDistance: 9, maxPolarAngle: Math.PI / 2.05
 */
function PodcastPortraitCameraRig({
  cameraPreset,
  moveInputRef
}: {
  cameraPreset: SharedRoomSceneProps['cameraPreset'];
  moveInputRef: SharedRoomSceneProps['moveInputRef'];
}) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const fpsRef = useRef({
    x: PODCAST_CAMERA_SPEC.first_person.position[0],
    y: PODCAST_CAMERA_SPEC.first_person.position[1],
    z: PODCAST_CAMERA_SPEC.first_person.position[2],
    vy: 0,
    yaw: 0,
    pitch: 0,
    walkBob: 0,
    onGround: true
  });
  const dragRef = useRef({ active: false, pointerId: -1, lastX: 0, lastY: 0 });

  useEffect(() => {
    const cfg = PODCAST_CAMERA_SPEC[cameraPreset] || PODCAST_CAMERA_SPEC.cinematic;
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
    const b = PODCAST_CAMERA_SPEC.bounds;
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
    const baseEyeY = PODCAST_CAMERA_SPEC.first_person.position[1];
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
      minDistance={3}
      maxDistance={9}
      maxPolarAngle={Math.PI / 2.05}
      minPolarAngle={0.28}
    />
  );
}

/**
 * 4. LIVE TRACK / EPISODE COVER DISPLAY ON OLED-STYLE STUDIO MONITOR
 * Dynamically renders live Album Cover, Persian title ("ضربان نیمه‌شب در ایستگاه نئون"),
 * artist name, and a smooth audio waveform on a THREE.CanvasTexture.
 */
function usePodcastOledMonitorCanvasTexture({
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
  const { ctx, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 560;
    const context = c.getContext('2d')!;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    return { ctx: context, texture: tex };
  }, []);

  const coverImgRef = useRef<HTMLImageElement | null>(null);
  const coverLoadedRef = useRef(false);
  const lastDrawMsRef = useRef(0);

  const drawFrame = useMemo(
    () => (t: number) => {
      const W = 1024;
      const H = 560;
      const audio = djAudioController.getCombinedBassAndSpectrum();
      const beatHz = Math.max(60, bpm) / 60;
      const synthPulse = isPlaying ? Math.pow(Math.max(0, Math.sin(t * beatHz * Math.PI * 2)), 2.0) : 0.12;
      const mid = Math.min(1.0, Math.max(audio.mid, isPlaying ? 0.32 + Math.sin(t * 3.6) * 0.2 : 0.14));
      const bass = Math.min(1.0, Math.max(audio.bass, synthPulse * pulseIntensity));
      const accent = trackAccentHex || '#38bdf8';

      // Deep OLED obsidian background with subtle studio radial glow
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, W, H);

      const bgGrad = ctx.createRadialGradient(W * 0.52, H * 0.48, 30, W * 0.5, H * 0.5, W * 0.65);
      bgGrad.addColorStop(0, 'rgba(24, 52, 86, 0.55)');
      bgGrad.addColorStop(0.55, 'rgba(11, 18, 32, 0.85)');
      bgGrad.addColorStop(1, '#05060a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle OLED inner bezel line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(14, 14, W - 28, H - 28);

      // Left Album Cover Art Card
      const artSize = 310;
      const artX = 68;
      const artY = (H - artSize) * 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(artX, artY, artSize, artSize, 20);
      ctx.clip();
      if (coverLoadedRef.current && coverImgRef.current) {
        ctx.drawImage(coverImgRef.current, artX, artY, artSize, artSize);
      } else {
        const vg = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
        vg.addColorStop(0, '#1e293b');
        vg.addColorStop(0.5, '#0f172a');
        vg.addColorStop(1, accent);
        ctx.fillStyle = vg;
        ctx.fillRect(artX, artY, artSize, artSize);
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(artX + artSize * 0.5, artY + artSize * 0.5, 98, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(artX + artSize * 0.5, artY + artSize * 0.5, 28, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(artX, artY, artSize, artSize, 20);
      ctx.stroke();

      // Right-hand Metadata & Smooth Audio Waveform (centered in right column with generous margin)
      const rightCenterX = 682;
      const textMaxW = 520;
      ctx.textAlign = 'center';

      // Live Broadcast Header Pill
      ctx.fillStyle = isPlaying ? 'rgba(239, 68, 68, 0.92)' : 'rgba(71, 85, 105, 0.75)';
      ctx.beginPath();
      ctx.roundRect(rightCenterX - 135, 96, 270, 38, 10);
      ctx.fill();
      ctx.direction = 'ltr';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 17px monospace';
      ctx.fillText(isPlaying ? '● ON AIR  •  STUDIO LIVE' : '❚❚ STUDIO STANDBY', rightCenterX, 121, 250);

      // Persian Episode / Track Title ("ضربان نیمه‌شب در ایستگاه نئون")
      const displayTitle = (trackTitle || 'ضربان نیمه‌شب در ایستگاه نئون').slice(0, 46);
      ctx.direction = /[\u0600-\u06FF]/.test(displayTitle) ? 'rtl' : 'ltr';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 31px "Vazirmatn", system-ui, sans-serif';
      ctx.fillText(displayTitle, rightCenterX, 206, textMaxW);

      // Artist / Show Subtitle
      const displayArtist = (trackArtist || 'Aether Broadcast Studio').slice(0, 46);
      ctx.direction = /[\u0600-\u06FF]/.test(displayArtist) ? 'rtl' : 'ltr';
      ctx.fillStyle = accent;
      ctx.font = '600 22px "Vazirmatn", system-ui, sans-serif';
      ctx.fillText(displayArtist, rightCenterX, 256, textMaxW);

      // Smooth Dual-Layer Audio Waveform + Spectrum Bars
      const waveStartX = 432;
      const waveW = 500;
      const waveMidY = 382;
      const bins = audio.bins;

      // Soft Equalizer Bars behind smooth waveform
      const barCount = 34;
      const bw = 9;
      const gap = 5.5;
      for (let i = 0; i < barCount; i++) {
        const binVal =
          bins && bins.length > 0
            ? bins[i % bins.length] / 255
            : isPlaying
              ? 0.2 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 4.8 + i * 0.38), 2)
              : 0.1;
        const bh = 12 + binVal * 76;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
        ctx.beginPath();
        ctx.roundRect(waveStartX + i * (bw + gap), waveMidY - bh * 0.5, bw, bh, 4);
        ctx.fill();
      }

      // Smooth Continuous Audio Waveform Curves
      for (let layer = 0; layer < 2; layer++) {
        ctx.beginPath();
        ctx.strokeStyle = layer === 0 ? '#38bdf8' : '#ffaa55';
        ctx.lineWidth = layer === 0 ? 3.5 : 2.2;
        for (let x = 0; x <= waveW; x += 6) {
          const normX = x / waveW;
          const windowEnv = Math.sin(normX * Math.PI);
          const amp = (14 + (mid * 34 + bass * 18)) * windowEnv * (layer === 0 ? 1 : 0.68);
          const y =
            waveMidY +
            Math.sin(x * 0.034 + t * (3.4 + layer * 1.1)) * amp * 0.7 +
            Math.cos(x * 0.062 - t * 2.2) * amp * 0.3;
          if (x === 0) ctx.moveTo(waveStartX + x, y);
          else ctx.lineTo(waveStartX + x, y);
        }
        ctx.stroke();
      }

      texture.needsUpdate = true;
    },
    [bpm, ctx, isPlaying, pulseIntensity, texture, trackAccentHex, trackArtist, trackTitle]
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
    if (nowMs - lastDrawMsRef.current < 60) return;
    lastDrawMsRef.current = nowMs;
    drawFrame(clock.getElapsedTime());
  });

  return texture;
}

function BroadcastBoomMic({
  position,
  rotationY
}: {
  position: [number, number, number];
  rotationY: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Weighted Anodized Desk C-Clamp & Swivel Turret */}
      <mesh position={[0, 0.032, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.046, 0.064, 20]} />
        <meshStandardMaterial color="#14161c" metalness={0.9} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.072, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.026, 0.028, 16]} />
        <meshStandardMaterial color="#c89d42" metalness={0.92} roughness={0.18} />
      </mesh>
      {/* Lower Parallelogram Scissor Arm */}
      <RoundedBox
        args={[0.024, 0.36, 0.028]}
        radius={0.008}
        smoothness={3}
        position={[0, 0.21, -0.09]}
        rotation={[-0.45, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color="#181c26" metalness={0.88} roughness={0.24} />
      </RoundedBox>
      {/* Chrome Tension Spring & Brass Elbow Thumbscrew */}
      <mesh position={[0, 0.35, -0.16]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.044, 14]} />
        <meshStandardMaterial color="#d4af37" metalness={0.92} roughness={0.2} />
      </mesh>
      {/* Upper Parallelogram Boom Arm */}
      <RoundedBox
        args={[0.022, 0.33, 0.024]}
        radius={0.007}
        smoothness={3}
        position={[0, 0.4, -0.02]}
        rotation={[0.7, 0, 0]}
        castShadow
      >
        <meshStandardMaterial color="#181c26" metalness={0.88} roughness={0.24} />
      </RoundedBox>
      {/* Shure SM7B Yoke Bracket + Shockmount Ring */}
      <mesh position={[0, 0.415, 0.13]} rotation={[Math.PI / 2.15, 0, 0]} castShadow>
        <torusGeometry args={[0.042, 0.005, 10, 24]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.22} />
      </mesh>
      {/* Shure SM7B Broadcast Dynamic Capsule Body */}
      <mesh position={[0, 0.41, 0.15]} rotation={[Math.PI / 2.15, 0, 0]} castShadow>
        <cylinderGeometry args={[0.032, 0.034, 0.145, 24]} />
        <meshStandardMaterial color="#0f131a" metalness={0.82} roughness={0.28} />
      </mesh>
      {/* Glowing Red On-Air Mic Tally Ring */}
      <mesh position={[0, 0.412, 0.11]} rotation={[Math.PI / 2.15, 0, 0]}>
        <torusGeometry args={[0.033, 0.0035, 8, 24]} />
        <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={0.85} />
      </mesh>
      {/* High-Density Acoustic Foam Windscreen */}
      <mesh position={[0, 0.4, 0.225]} rotation={[Math.PI / 2.15, 0, 0]} castShadow>
        <capsuleGeometry args={[0.034, 0.042, 12, 20]} />
        <meshStandardMaterial color="#18191e" roughness={0.9} metalness={0.04} />
      </mesh>
    </group>
  );
}

function StudioPlant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Fluted Architectural Matte-Black Ceramic Planter + Brass Rim */}
      <mesh position={[0, 0.23, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.16, 0.46, 24]} />
        <meshPhysicalMaterial color="#181920" roughness={0.38} clearcoat={0.3} />
      </mesh>
      <mesh position={[0, 0.455, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.215, 0.012, 10, 28]} />
        <meshStandardMaterial color="#c89d42" metalness={0.9} roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.43, 0]} receiveShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.03, 18]} />
        <meshStandardMaterial color="#271c15" roughness={0.92} />
      </mesh>
      {[0, 0.78, 1.57, 2.35, 3.14, 3.92, 4.71, 5.5].map((a, idx) => (
        <RoundedBox
          key={a}
          args={[0.12, 0.48 + (idx % 3) * 0.08, 0.024]}
          radius={0.01}
          smoothness={3}
          position={[Math.cos(a) * 0.14, 0.66 + (idx % 2) * 0.14, Math.sin(a) * 0.14]}
          rotation={[0.36 * Math.sin(a), a, 0.36 * Math.cos(a)]}
          castShadow
        >
          <meshPhysicalMaterial
            color={idx % 2 === 0 ? '#15803d' : '#166534'}
            roughness={0.38}
            clearcoat={0.25}
          />
        </RoundedBox>
      ))}
    </group>
  );
}

function LeatherLoungeSofa({
  position,
  rotationY
}: {
  position: [number, number, number];
  rotationY: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Walnut Plinth Base */}
      <RoundedBox
        args={[2.24, 0.09, 0.9]}
        radius={0.025}
        smoothness={4}
        position={[0, 0.14, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#3b1f10" roughness={0.35} metalness={0.08} />
      </RoundedBox>
      {/* 2 Plump Stitched Nappa Leather Seat Cushions */}
      {[-0.48, 0.48].map((cx) => (
        <RoundedBox
          key={cx}
          args={[0.94, 0.18, 0.8]}
          radius={0.055}
          smoothness={4}
          position={[cx, 0.27, 0.02]}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial color="#17181f" roughness={0.34} clearcoat={0.38} clearcoatRoughness={0.28} />
        </RoundedBox>
      ))}
      {/* 2 Tufted Leather Backrest Cushions */}
      {[-0.48, 0.48].map((cx) => (
        <RoundedBox
          key={cx}
          args={[0.94, 0.48, 0.22]}
          radius={0.06}
          smoothness={4}
          position={[cx, 0.56, -0.31]}
          rotation={[-0.08, 0, 0]}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial color="#1a1b23" roughness={0.36} clearcoat={0.34} />
        </RoundedBox>
      ))}
      {/* Sculpted Bolster Armrests */}
      {[-1.03, 1.03].map((ax) => (
        <RoundedBox
          key={ax}
          args={[0.18, 0.4, 0.88]}
          radius={0.055}
          smoothness={4}
          position={[ax, 0.4, 0]}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial color="#15161d" roughness={0.35} clearcoat={0.35} />
        </RoundedBox>
      ))}
      {/* Brushed Brass Tapered Legs */}
      {[-0.98, 0.98].map((lx) =>
        [-0.35, 0.35].map((lz) => (
          <mesh key={`${lx}-${lz}`} position={[lx, 0.05, lz]} castShadow>
            <cylinderGeometry args={[0.026, 0.018, 0.1, 12]} />
            <meshStandardMaterial color="#c89d42" metalness={0.92} roughness={0.2} />
          </mesh>
        ))
      )}
      {/* Cognac & Midnight Velvet Throw Pillows */}
      <RoundedBox
        args={[0.36, 0.32, 0.13]}
        radius={0.045}
        smoothness={4}
        position={[-0.74, 0.46, -0.12]}
        rotation={[-0.18, 0.24, 0.1]}
        castShadow
      >
        <meshStandardMaterial color="#9a3412" roughness={0.68} />
      </RoundedBox>
      <RoundedBox
        args={[0.36, 0.32, 0.13]}
        radius={0.045}
        smoothness={4}
        position={[0.74, 0.46, -0.12]}
        rotation={[-0.18, -0.24, -0.1]}
        castShadow
      >
        <meshStandardMaterial color="#1e3a5f" roughness={0.68} />
      </RoundedBox>
    </group>
  );
}

/**
 * High-Detail Sculpted Herman-Miller / Broadcast Executive Chair
 * Seat cushion top is strictly kept at y = 0.38 so avatar pelvis at seatHeight 0.52 (y = 0.37) locks cleanly onto the cushion.
 */
function ExecutiveBroadcastChair({
  position,
  rotationY
}: {
  position: [number, number, number];
  rotationY: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Contoured Upholstered Nappa Leather Seat Cushion (center y = 0.34, top y = 0.38) */}
      <RoundedBox
        args={[0.54, 0.08, 0.52]}
        radius={0.035}
        smoothness={4}
        position={[0, 0.34, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial color="#1d1b22" roughness={0.38} clearcoat={0.32} />
      </RoundedBox>
      {/* Brushed Aluminum Under-Seat Cradle */}
      <RoundedBox
        args={[0.46, 0.035, 0.44]}
        radius={0.015}
        smoothness={3}
        position={[0, 0.285, -0.02]}
        castShadow
      >
        <meshStandardMaterial color="#334155" metalness={0.88} roughness={0.22} />
      </RoundedBox>
      {/* Ergonomic Lumbar Backrest + Headrest Bolster */}
      <RoundedBox
        args={[0.5, 0.58, 0.085]}
        radius={0.038}
        smoothness={4}
        position={[0, 0.67, -0.25]}
        rotation={[-0.06, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial color="#1d1b22" roughness={0.38} clearcoat={0.32} />
      </RoundedBox>
      <RoundedBox
        args={[0.32, 0.16, 0.075]}
        radius={0.03}
        smoothness={4}
        position={[0, 1.03, -0.27]}
        rotation={[0.08, 0, 0]}
        castShadow
      >
        <meshPhysicalMaterial color="#27242e" roughness={0.35} clearcoat={0.35} />
      </RoundedBox>
      {/* Dual Chrome Spine Support Upright */}
      <RoundedBox
        args={[0.12, 0.48, 0.03]}
        radius={0.01}
        smoothness={3}
        position={[0, 0.56, -0.3]}
        castShadow
      >
        <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.18} />
      </RoundedBox>
      {/* Sculpted Armrests + Vertical Chrome Stalks */}
      {[-0.28, 0.28].map((ax) => (
        <group key={ax}>
          <RoundedBox
            args={[0.06, 0.038, 0.34]}
            radius={0.016}
            smoothness={4}
            position={[ax, 0.52, -0.02]}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial color="#16161d" roughness={0.35} clearcoat={0.3} />
          </RoundedBox>
          <mesh position={[ax, 0.4, -0.08]} castShadow>
            <cylinderGeometry args={[0.014, 0.016, 0.22, 12]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      ))}
      {/* Gas-Lift Pneumatic Cylinder */}
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.032, 0.042, 0.26, 18]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* 5-Star Die-Cast Aluminum Wheelbase */}
      {[0, 1.256, 2.513, 3.77, 5.026].map((ang) => (
        <mesh
          key={ang}
          position={[Math.sin(ang) * 0.15, 0.035, Math.cos(ang) * 0.15]}
          rotation={[0, ang, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.036, 0.028, 0.3]} />
          <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.22} />
        </mesh>
      ))}
      {/* Chrome Footrest Ring under Avatar Feet */}
      <mesh position={[0, 0.06, 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[0.23, 0.016, 12, 32]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
      </mesh>
    </group>
  );
}

/**
 * 19-Inch Outboard Analog Mastering Rack + Coaxial Studio Reference Monitor on Iso-Stand
 */
function StudioMasteringRackAndMonitor({
  position,
  rotationY,
  vuAmberMat,
  vuCyanMat
}: {
  position: [number, number, number];
  rotationY: number;
  vuAmberMat?: THREE.MeshStandardMaterial;
  vuCyanMat?: THREE.MeshStandardMaterial;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Walnut & Brushed Aluminum 19-Inch Outboard Rack Cabinet */}
      <RoundedBox
        args={[0.68, 1.18, 0.52]}
        radius={0.03}
        smoothness={4}
        position={[0, 0.59, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#3b1f10" roughness={0.34} metalness={0.08} />
      </RoundedBox>
      {/* 4 Rackmount Compressors / Preamps / SSL EQ Units */}
      {[0.28, 0.52, 0.76, 1.0].map((uy, idx) => (
        <group key={uy} position={[0, uy, 0.255]}>
          <RoundedBox args={[0.58, 0.18, 0.03]} radius={0.008} smoothness={3} castShadow>
            <meshStandardMaterial
              color={idx % 2 === 0 ? '#111622' : '#1e2433'}
              metalness={0.86}
              roughness={0.24}
            />
          </RoundedBox>
          {/* Warm Amber / Cyan Analog VU Meters */}
          {[-0.16, 0.02].map((vx, vIdx) => {
            const sharedMat = idx === 1 ? vuCyanMat : vuAmberMat;
            return (
              <mesh key={vIdx} position={[vx, 0, 0.018]} material={sharedMat}>
                <planeGeometry args={[0.11, 0.065]} />
                {!sharedMat && (
                  <meshStandardMaterial
                    color="#fef3c7"
                    emissive={idx === 1 ? '#38bdf8' : '#f59e0b'}
                    emissiveIntensity={0.48}
                    roughness={0.3}
                  />
                )}
              </mesh>
            );
          })}
          {/* Rotary Aluminum Knobs */}
          {[0.14, 0.2, 0.25].map((kx) => (
            <mesh key={kx} position={[kx, 0, 0.022]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.016, 0.016, 0.02, 12]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.18} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Genelec-Style Coaxial Studio Reference Monitor on Iso-Acoustic Stand */}
      <mesh position={[0, 1.28, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.2, 16]} />
        <meshStandardMaterial color="#18181b" metalness={0.88} roughness={0.22} />
      </mesh>
      <RoundedBox
        args={[0.32, 0.44, 0.28]}
        radius={0.055}
        smoothness={4}
        position={[0, 1.56, 0.02]}
        rotation={[0.08, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#14171f" metalness={0.78} roughness={0.26} />
      </RoundedBox>
      {/* Coaxial Copper/Gold Woofer Cone & Waveguide */}
      <mesh position={[0, 1.52, 0.165]} rotation={[0.08, 0, 0]}>
        <ringGeometry args={[0.035, 0.095, 24]} />
        <meshStandardMaterial color="#b45309" metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[0, 1.68, 0.16]} rotation={[0.08, 0, 0]}>
        <circleGeometry args={[0.042, 20]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

function StudioFloorLamp({
  position,
  shadeMat
}: {
  position: [number, number, number];
  shadeMat?: THREE.MeshStandardMaterial;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.06, 20]} />
        <meshStandardMaterial color="#18181b" metalness={0.88} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.92, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.026, 1.78, 12]} />
        <meshStandardMaterial color="#c89d42" metalness={0.92} roughness={0.2} />
      </mesh>
      <mesh position={[0, 1.76, 0]} castShadow material={shadeMat}>
        <cylinderGeometry args={[0.18, 0.26, 0.3, 24, 1, true]} />
        {!shadeMat && (
          <meshStandardMaterial
            color="#fde68a"
            emissive="#f59e0b"
            emissiveIntensity={0.55}
            roughness={0.48}
            side={THREE.DoubleSide}
          />
        )}
      </mesh>
    </group>
  );
}

/**
 * High-end Deep Burl-Walnut PBR texture & normalMap generator for the podcast table
 */
function createBurlWalnutPBR(): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  dispose: () => void;
} {
  const size = 512;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const colCtx = colCanvas.getContext('2d')!;

  const normCanvas = document.createElement('canvas');
  normCanvas.width = size;
  normCanvas.height = size;
  const normCtx = normCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext('2d')!;

  // Rich deep burl-walnut wood base
  const baseGrad = colCtx.createLinearGradient(0, 0, size, size);
  baseGrad.addColorStop(0, '#3a1f10');
  baseGrad.addColorStop(0.5, '#4a2815');
  baseGrad.addColorStop(1, '#2d170b');
  colCtx.fillStyle = baseGrad;
  colCtx.fillRect(0, 0, size, size);

  normCtx.fillStyle = 'rgb(128, 128, 255)';
  normCtx.fillRect(0, 0, size, size);

  roughCtx.fillStyle = 'rgb(90, 90, 90)';
  roughCtx.fillRect(0, 0, size, size);

  // Organic walnut wood grain fibers + burl swirls
  for (let y = 0; y < size; y += 2) {
    const wave = Math.sin(y * 0.045) * 14 + Math.cos(y * 0.11) * 6;
    const tone = Math.floor(18 * Math.sin(y * 0.08));
    colCtx.strokeStyle = `rgba(${58 + tone}, ${30 + Math.floor(tone * 0.5)}, ${16 + Math.floor(tone * 0.3)}, 0.32)`;
    colCtx.lineWidth = 1.6;
    colCtx.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const gy = y + Math.sin(x * 0.03 + wave * 0.1) * 5;
      if (x === 0) colCtx.moveTo(x, gy);
      else colCtx.lineTo(x, gy);
    }
    colCtx.stroke();

    // Normal map tangent perturbation along wood grain
    const ny = Math.max(96, Math.min(160, Math.floor(128 + Math.cos(y * 0.12) * 18)));
    normCtx.strokeStyle = `rgb(128, ${ny}, 252)`;
    normCtx.lineWidth = 2;
    normCtx.beginPath();
    normCtx.moveTo(0, y);
    normCtx.lineTo(size, y);
    normCtx.stroke();
  }

  // Subtle walnut burl knots
  const knots = [
    [140, 160, 46],
    [360, 290, 54],
    [220, 410, 38]
  ];
  knots.forEach(([kx, ky, kr]) => {
    const kg = colCtx.createRadialGradient(kx, ky, 4, kx, ky, kr);
    kg.addColorStop(0, 'rgba(28, 13, 6, 0.55)');
    kg.addColorStop(0.6, 'rgba(68, 36, 18, 0.28)');
    kg.addColorStop(1, 'rgba(58, 31, 16, 0)');
    colCtx.fillStyle = kg;
    colCtx.beginPath();
    colCtx.arc(kx, ky, kr, 0, Math.PI * 2);
    colCtx.fill();
  });

  const map = new THREE.CanvasTexture(colCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.generateMipmaps = true;

  const normalMap = new THREE.CanvasTexture(normCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(2, 2);
  normalMap.generateMipmaps = true;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);
  roughnessMap.generateMipmaps = true;

  return {
    map,
    normalMap,
    roughnessMap,
    dispose: () => {
      map.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
    }
  };
}

function createOnAirSignTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1a0507';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#ff2a2a';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.fillStyle = '#ff3838';
  ctx.font = '900 66px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ON AIR', 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  return tex;
}

function PodcastArchitectureAndProps({
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
  const cal = lightingCalibration || DEFAULT_ROOM_LIGHTING_PROFILES.podcast;
  const oledMonitorTexture = usePodcastOledMonitorCanvasTexture({
    trackTitle,
    trackArtist,
    trackCoverUrl,
    trackAccentHex,
    bpm,
    isPlaying,
    pulseIntensity,
    isActive
  });

  const floorTex = usePolyHavenPBR('brown_planks_07', 5, 8);
  const slatsTex = usePolyHavenPBR('brown_planks_07', 6, 2);
  const brickTex = usePolyHavenPBR('brown_planks_07', 4, 2);
  const burlWalnutTex = usePolyHavenPBR('american_walnut_veneer', 2, 2);
  const burlNormalScale = useMemo(() => new THREE.Vector2(0.85, 0.85), []);
  const wovenRugMat = useMemo(
    () => createPBRMaterial('woven_studio_rug', { repeatX: 4, repeatY: 4, roughness: 0.88 }),
    []
  );
  const onAirTex = useMemo(() => createOnAirSignTexture(), []);
  const rearWallSlats = useMemo(() => Array.from({ length: 49 }, (_, i) => -4.56 + i * 0.19), []);

  const softboxDiffuserMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffebd6',
        emissive: '#ffdfb6',
        emissiveIntensity: 0.48
      }),
    []
  );
  const wallAmberLedMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#d97706',
        emissive: '#d97706',
        emissiveIntensity: 0.52,
        roughness: 0.4
      }),
    []
  );
  const wallCyanLedMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0284c7',
        emissive: '#0284c7',
        emissiveIntensity: 0.52,
        roughness: 0.4
      }),
    []
  );
  const floorLampShadeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fde68a',
        emissive: '#f59e0b',
        emissiveIntensity: 0.55,
        roughness: 0.48,
        side: THREE.DoubleSide
      }),
    []
  );
  const vuAmberMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fef3c7',
        emissive: '#f59e0b',
        emissiveIntensity: 0.48,
        roughness: 0.3
      }),
    []
  );
  const vuCyanMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fef3c7',
        emissive: '#38bdf8',
        emissiveIntensity: 0.48,
        roughness: 0.3
      }),
    []
  );
  const padAmberMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        emissive: '#f59e0b',
        emissiveIntensity: 0.5
      }),
    []
  );
  const padEmeraldMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        emissive: '#10b981',
        emissiveIntensity: 0.5
      }),
    []
  );

  const onAirMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const oledScreenMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const keySpotRef = useRef<THREE.SpotLight | null>(null);
  const rimSpotRef = useRef<THREE.SpotLight | null>(null);
  const fillSpotRef = useRef<THREE.SpotLight | null>(null);
  const tableSpotRef = useRef<THREE.SpotLight | null>(null);
  const loungeSpotRef = useRef<THREE.SpotLight | null>(null);
  const bouncePointRef = useRef<THREE.PointLight | null>(null);
  const burstRef = useRef(0);
  const lastSeqRef = useRef(fxBurstSeq);

  useEffect(() => {
    return () => {
      disposePBRMaterial(wovenRugMat);
      onAirTex.dispose();
      softboxDiffuserMat.dispose();
      wallAmberLedMat.dispose();
      wallCyanLedMat.dispose();
      floorLampShadeMat.dispose();
      vuAmberMat.dispose();
      vuCyanMat.dispose();
      padAmberMat.dispose();
      padEmeraldMat.dispose();
    };
  }, [
    floorLampShadeMat,
    onAirTex,
    padAmberMat,
    padEmeraldMat,
    softboxDiffuserMat,
    vuAmberMat,
    vuCyanMat,
    wallAmberLedMat,
    wallCyanLedMat,
    wovenRugMat
  ]);

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

    softboxDiffuserMat.emissiveIntensity = isPlaying
      ? 0.4 + (env.mid * 0.25 + env.beatPulse * 0.1) * beamMod
      : 0.44;
    wallAmberLedMat.emissiveIntensity = isPlaying
      ? 0.36 + (env.bass * 0.85 + env.beatPulse * 0.35) * beamMod
      : 0.42;
    wallCyanLedMat.emissiveIntensity = isPlaying
      ? 0.36 + (env.high * 0.85 + env.halfBeatPulse * 0.35) * beamMod
      : 0.42;
    floorLampShadeMat.emissiveIntensity = isPlaying
      ? 0.44 + (env.mid * 0.42 + env.beatPulse * 0.18) * beamMod
      : 0.5;
    vuAmberMat.emissiveIntensity = isPlaying ? 0.36 + env.bass * 0.8 * beamMod : 0.4;
    vuCyanMat.emissiveIntensity = isPlaying ? 0.36 + env.mid * 0.8 * beamMod : 0.4;
    padAmberMat.emissiveIntensity = isPlaying ? 0.4 + env.beatPulse * 0.9 * beamMod : 0.44;
    padEmeraldMat.emissiveIntensity = isPlaying ? 0.4 + env.halfBeatPulse * 0.9 * beamMod : 0.44;

    if (onAirMatRef.current) {
      onAirMatRef.current.emissiveIntensity = isPlaying
        ? 0.78 + (env.beatPulse * 0.65 + env.mid * 0.22) * beamMod
        : 0.55;
    }
    if (oledScreenMatRef.current) {
      oledScreenMatRef.current.emissiveIntensity = isPlaying ? 0.2 + env.mid * 0.14 * beamMod : 0.2;
    }
    if (keySpotRef.current) {
      const base = cal.keyIntensity;
      keySpotRef.current.intensity = isPlaying
        ? base * (0.96 + (env.mid * 0.18 + env.beatPulse * 0.08) * keyMod)
        : base;
    }
    if (rimSpotRef.current) {
      const base = cal.rimIntensity;
      rimSpotRef.current.intensity = isPlaying
        ? base * (0.94 + (env.bass * 0.32 + env.beatPulse * 0.14) * beamMod)
        : base;
    }
    if (fillSpotRef.current) {
      const base = cal.fillIntensity;
      fillSpotRef.current.intensity = isPlaying
        ? base * (0.96 + env.high * 0.16 * keyMod)
        : base;
    }
    if (tableSpotRef.current) {
      const base = cal.keyIntensity * 0.72 * pracMult;
      tableSpotRef.current.intensity = isPlaying
        ? base * (0.96 + (env.mid * 0.18 + env.halfBeatPulse * 0.08) * keyMod)
        : base;
    }
    if (loungeSpotRef.current) {
      const base = cal.fillIntensity * 1.15 * pracMult;
      loungeSpotRef.current.intensity = isPlaying ? base * (0.96 + env.bass * 0.16 * keyMod) : base;
    }
    if (bouncePointRef.current) {
      const base = cal.fillIntensity * 0.65;
      bouncePointRef.current.intensity = isPlaying ? base * (0.96 + env.mid * 0.14 * keyMod) : base;
    }
  });

  const tableTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 1.15, -4.2);
    return o;
  }, []);

  const hostsTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 1.35, -4.45);
    return o;
  }, []);

  const rimForwardTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 1.25, -3.1);
    return o;
  }, []);

  const loungeTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0.5, 0.8);
    return o;
  }, []);

  return (
    <group>
      {/* Local GLB Studio Base Architecture (/public/models/podcast/podcast-studio.glb) */}
      <LocalPodcastStudioGLBModel />

      {/* Reflective Hardwood Studio Floor */}
      {renderOwnFloor && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0.3]} receiveShadow>
          <planeGeometry args={[10.5, 16.5]} />
          <MeshReflectorMaterial
            map={floorTex.map}
            normalMap={floorTex.normalMap}
            roughnessMap={floorTex.roughnessMap}
            resolution={256}
            blur={[120, 40]}
            mixBlur={1}
            mixStrength={1.45}
            mirror={0.46}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            depthScale={1.2}
            roughness={0.38}
            color="#966a48"
            metalness={0.12}
          />
        </mesh>
      )}

      {/* Plush Circular Woven Studio Rug under Podcast Desk ([0, 0.015, -4.2]) */}
      <mesh position={[0, 0.015, -4.2]} receiveShadow material={wovenRugMat}>
        <cylinderGeometry args={[2.85, 2.85, 0.025, 48]} />
      </mesh>

      {/* Foreground Lounge Woven Carpet */}
      <mesh position={[0, 0.015, 0.8]} receiveShadow material={wovenRugMat}>
        <boxGeometry args={[4.2, 0.022, 3.8]} />
      </mesh>

      {/* Overhead Studio Ceiling + Aluminum Truss Rig + 6 Softbox Diffusers */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 5.2, 0.3]} receiveShadow>
        <planeGeometry args={[10.5, 16.5]} />
        <meshStandardMaterial color="#05060a" roughness={0.88} />
      </mesh>
      <group position={[0, 4.72, -1.2]}>
        {[-4.8, -2.4, 0, 2.4, 4.8].map((tz) => (
          <RoundedBox key={tz} args={[9.0, 0.14, 0.14]} radius={0.02} smoothness={3} position={[0, 0, tz]} castShadow receiveShadow>
            <meshStandardMaterial color="#181c26" metalness={0.86} roughness={0.26} />
          </RoundedBox>
        ))}
        {[-3.6, 3.6].map((tx) => (
          <RoundedBox key={tx} args={[0.14, 0.14, 10.6]} radius={0.02} smoothness={3} position={[tx, 0, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#181c26" metalness={0.86} roughness={0.26} />
          </RoundedBox>
        ))}
      </group>
      {[
        [-1.75, -4.0],
        [1.75, -4.0],
        [-1.75, -1.4],
        [1.75, -1.4],
        [-1.75, 1.2],
        [1.75, 1.2]
      ].map(([sx, sz]) => (
        <group key={`${sx}-${sz}`} position={[sx, 4.58, sz]}>
          <RoundedBox args={[1.32, 0.1, 0.76]} radius={0.02} smoothness={3} castShadow receiveShadow>
            <meshStandardMaterial color="#14161f" metalness={0.8} roughness={0.3} />
          </RoundedBox>
          <mesh position={[0, -0.055, 0]} rotation={[Math.PI / 2, 0, 0]} material={softboxDiffuserMat}>
            <planeGeometry args={[1.22, 0.66]} />
          </mesh>
        </group>
      ))}

      {/* Acoustic Brown Wood Rear Wall (Poly Haven brown_planks_07 + american_walnut_veneer) */}
      <mesh position={[0, 2.6, -6.92]} receiveShadow>
        <planeGeometry args={[10.5, 5.2]} />
        <meshStandardMaterial
          map={brickTex.map}
          normalMap={brickTex.normalMap}
          roughnessMap={brickTex.roughnessMap}
          color="#6e4b32"
          roughness={0.72}
          metalness={0.04}
        />
      </mesh>
      {rearWallSlats.map((sx, idx) => (
        <RoundedBox
          key={idx}
          args={[0.11, 5.05, 0.085]}
          radius={0.014}
          smoothness={3}
          position={[sx, 2.6, -6.82]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            map={burlWalnutTex.map}
            normalMap={burlWalnutTex.normalMap}
            normalScale={burlNormalScale}
            roughnessMap={burlWalnutTex.roughnessMap}
            color={idx % 3 === 0 ? '#9c6844' : idx % 3 === 1 ? '#875736' : '#ab744d'}
            roughness={0.44}
            metalness={0.06}
          />
        </RoundedBox>
      ))}
      {/* Subtle Architectural Brass Trim Bars Framing Rear Acoustic Wall */}
      {[0.12, 5.08].map((by) => (
        <mesh key={by} position={[0, by, -6.76]} castShadow>
          <boxGeometry args={[9.4, 0.05, 0.08]} />
          <meshStandardMaterial color="#c89d42" metalness={0.92} roughness={0.2} />
        </mesh>
      ))}

      {/* Brown Wood Plank Side Walls (Poly Haven brown_planks_07) visible inside vertical 9:16 mobile frame */}
      {[-4.55, 4.55].map((wx) => {
        const inward = wx > 0 ? -1 : 1;
        return (
          <group key={wx}>
            <mesh position={[wx, 2.6, 0.3]} rotation={[0, inward * (Math.PI / 2), 0]} receiveShadow>
              <planeGeometry args={[16.5, 5.2]} />
              <meshStandardMaterial
                map={slatsTex.map}
                normalMap={slatsTex.normalMap}
                roughnessMap={slatsTex.roughnessMap}
                color="#8c6040"
                roughness={0.58}
                metalness={0.05}
              />
            </mesh>
            {[-5.2, -3.2, -1.2, 0.8, 2.8].map((lz, idx) => (
              <mesh
                key={lz}
                position={[wx + inward * 0.04, 2.6, lz]}
                material={idx % 2 === 0 ? wallAmberLedMat : wallCyanLedMat}
              >
                <boxGeometry args={[0.035, 4.6, 0.045]} />
              </mesh>
            ))}
            {/* Framed Gold & Platinum Vinyl Record Plaques */}
            {[-4.2, -2.2, -0.2].map((pz, idx) => (
              <group key={pz} position={[wx + inward * 0.05, 2.65, pz]} rotation={[0, inward * (Math.PI / 2), 0]}>
                <RoundedBox args={[0.7, 0.7, 0.045]} radius={0.015} smoothness={3} castShadow receiveShadow>
                  <meshStandardMaterial color="#14151c" roughness={0.32} metalness={0.6} />
                </RoundedBox>
                <mesh position={[0, 0, 0.026]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.24, 0.24, 0.015, 28]} />
                  <meshStandardMaterial color={idx % 2 === 0 ? '#eab308' : '#e2e8f0'} metalness={0.94} roughness={0.14} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}

      {/* Flanking 19-Inch Outboard Mastering Racks + Coaxial Studio Monitors */}
      <StudioMasteringRackAndMonitor
        position={[-2.85, 0, -5.85]}
        rotationY={0.34}
        vuAmberMat={vuAmberMat}
        vuCyanMat={vuCyanMat}
      />
      <StudioMasteringRackAndMonitor
        position={[2.85, 0, -5.85]}
        rotationY={-0.34}
        vuAmberMat={vuAmberMat}
        vuCyanMat={vuCyanMat}
      />

      <StudioPlant position={[-3.85, 0, -5.9]} />
      <StudioPlant position={[3.85, 0, -5.9]} />
      <StudioPlant position={[-3.75, 0, 2.9]} />
      <StudioPlant position={[3.75, 0, 2.9]} />

      {/* 4. Frameless 16:9 OLED Studio Monitor at [0, 2.7, -6.5] (width: 4.2, height: 2.3) */}
      <group
        position={[0, 2.7, -6.5]}
        onClick={(e) => {
          e.stopPropagation();
          onInteractHotspot?.('toggle_play');
        }}
      >
        <RoundedBox args={[4.26, 2.36, 0.045]} radius={0.018} smoothness={4} position={[0, 0, -0.025]} castShadow receiveShadow>
          <meshStandardMaterial color="#05060a" metalness={0.9} roughness={0.18} />
        </RoundedBox>
        {/* Frameless 16:9 OLED Display Surface (4.2 x 2.3) — crisp glare-free sRGB output */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[4.2, 2.3]} />
          <meshStandardMaterial
            ref={oledScreenMatRef}
            map={oledMonitorTexture}
            emissiveMap={oledMonitorTexture}
            emissive="#ffffff"
            emissiveIntensity={0.22}
            roughness={0.58}
            metalness={0.02}
          />
        </mesh>
      </group>

      {/* 4. Glowing Red "ON AIR" Studio Neon Sign at [0, 4.1, -6.5] directly above the monitor */}
      <group position={[0, 4.1, -6.5]}>
        <RoundedBox args={[1.2, 0.36, 0.08]} radius={0.02} smoothness={3} position={[0, 0, -0.04]} castShadow>
          <meshStandardMaterial color="#140708" metalness={0.78} roughness={0.26} />
        </RoundedBox>
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[1.1, 0.28]} />
          <meshStandardMaterial
            ref={onAirMatRef}
            map={onAirTex}
            emissiveMap={onAirTex}
            emissive="#ff2a2a"
            emissiveIntensity={isPlaying ? 0.95 : 0.65}
            roughness={0.32}
          />
        </mesh>
      </group>

      {/* Podcast Stage Riser (non-emissive dark anodized bevel edge — zero artificial yellow strip) */}
      <group position={[0, 0.15, -4.2]}>
        <RoundedBox args={[5.0, 0.3, 3.4]} radius={0.03} smoothness={4} receiveShadow castShadow>
          <meshStandardMaterial color="#151418" roughness={0.55} metalness={0.18} />
        </RoundedBox>
        <RoundedBox args={[5.04, 0.035, 3.44]} radius={0.01} smoothness={3} position={[0, 0.135, 0]} receiveShadow castShadow>
          <meshStandardMaterial color="#27272a" roughness={0.32} metalness={0.82} />
        </RoundedBox>
      </group>

      <group
        position={[0, 0.3, -4.2]}
        onClick={(e) => {
          e.stopPropagation();
          onInteractHotspot?.('open_dj');
        }}
      >
        {/* High-End PBR Deep Burl-Walnut Podcast Table (roughness: 0.35, metalness: 0.05, wood-grain normalMap) */}
        <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.96, 0.96, 0.065, 64]} />
          <meshStandardMaterial
            map={burlWalnutTex.map}
            normalMap={burlWalnutTex.normalMap}
            normalScale={burlNormalScale}
            roughnessMap={burlWalnutTex.roughnessMap}
            color="#5c3319"
            roughness={0.35}
            metalness={0.05}
          />
        </mesh>
        {/* Brushed Brass Bullnose Rim + Matte Black Sub-Apron */}
        <mesh position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[0.968, 0.026, 16, 64]} />
          <meshStandardMaterial color="#1c1917" metalness={0.88} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0.742, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.955, 0.006, 10, 64]} />
          <meshStandardMaterial color="#c89d42" metalness={0.92} roughness={0.18} />
        </mesh>
        {/* Center Cable-Management Grommet */}
        <mesh position={[0, 0.754, -0.06]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.03, 0.075, 24]} />
          <meshStandardMaterial color="#18181b" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Fluted Pedestal Column & Weighted Base */}
        <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.24, 0.38, 0.72, 32]} />
          <meshStandardMaterial color="#111318" metalness={0.86} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.48, 0.52, 0.05, 32]} />
          <meshStandardMaterial color="#18181b" metalness={0.9} roughness={0.22} />
        </mesh>

        {/* 3 Articulated Broadcast Boom Arms + Shure SM7B Dynamic Mics */}
        <BroadcastBoomMic position={[0, 0.75, -0.58]} rotationY={Math.PI} />
        <BroadcastBoomMic position={[-0.62, 0.75, -0.08]} rotationY={-Math.PI / 2} />
        <BroadcastBoomMic position={[0.62, 0.75, -0.08]} rotationY={Math.PI / 2} />

        {/* RØDECaster Pro II Broadcast Console with 8 Motorized Faders & RGB Pads */}
        <group position={[0, 0.768, 0.1]}>
          <RoundedBox args={[0.44, 0.042, 0.3]} radius={0.012} smoothness={4} castShadow receiveShadow>
            <meshStandardMaterial color="#0f141d" roughness={0.28} metalness={0.85} />
          </RoundedBox>
          {/* Tilted Touchscreen Display */}
          <mesh position={[-0.05, 0.024, -0.07]} rotation={[-Math.PI / 2 + 0.1, 0, 0]}>
            <planeGeometry args={[0.24, 0.085]} />
            <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.38} roughness={0.3} />
          </mesh>
          {/* 6 Physical Fader Caps */}
          {[-0.16, -0.11, -0.06, -0.01, 0.04, 0.09].map((fx) => (
            <RoundedBox
              key={fx}
              args={[0.018, 0.016, 0.032]}
              radius={0.004}
              smoothness={2}
              position={[fx, 0.026, 0.05]}
              castShadow
            >
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
            </RoundedBox>
          ))}
          {/* 8 Tactile Sound Pads */}
          {[0.14, 0.18].map((px, cIdx) =>
            [-0.04, 0.0, 0.04, 0.08].map((pz, rIdx) => (
              <mesh
                key={`${px}-${pz}`}
                position={[px, 0.023, pz]}
                material={(cIdx + rIdx) % 2 === 0 ? padAmberMat : padEmeraldMat}
              >
                <boxGeometry args={[0.028, 0.008, 0.028]} />
              </mesh>
            ))
          )}
        </group>

        {/* Sleek Aluminum Show-Notes Laptop in front of Lead Host */}
        <group position={[0.28, 0.755, -0.34]} rotation={[0, -0.45, 0]}>
          <RoundedBox args={[0.3, 0.012, 0.21]} radius={0.005} smoothness={3} castShadow receiveShadow>
            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.22} />
          </RoundedBox>
          <RoundedBox
            args={[0.3, 0.19, 0.008]}
            radius={0.004}
            smoothness={3}
            position={[0, 0.095, -0.1]}
            rotation={[-0.24, 0, 0]}
            castShadow
          >
            <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.22} />
          </RoundedBox>
        </group>

        {/* Ceramic Studio Espresso Cups on Leather Coasters */}
        {[
          [-0.28, 0.25],
          [0.3, 0.22],
          [-0.24, -0.32]
        ].map(([mx, mz], idx) => (
          <group key={idx} position={[mx, 0.755, mz]}>
            <mesh position={[0, 0.004, 0]} receiveShadow>
              <cylinderGeometry args={[0.052, 0.052, 0.006, 18]} />
              <meshStandardMaterial color="#3b1f10" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.048, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.038, 0.032, 0.085, 18]} />
              <meshPhysicalMaterial
                color={idx === 1 ? '#e2e8f0' : '#18181b'}
                roughness={0.22}
                clearcoat={0.65}
              />
            </mesh>
          </group>
        ))}

        {/* 3 Sculpted Executive Broadcast Chairs on Riser calibrated for pelvis lock at seatHeight 0.52 */}
        {[
          { pos: [0, 0, -1.32] as [number, number, number], rotY: 0 },
          { pos: [-1.34, 0, -0.18] as [number, number, number], rotY: Math.PI / 2 - 0.16 },
          { pos: [1.34, 0, -0.18] as [number, number, number], rotY: -Math.PI / 2 + 0.16 }
        ].map((ch, idx) => (
          <ExecutiveBroadcastChair key={idx} position={ch.pos} rotationY={ch.rotY} />
        ))}
      </group>

      {/* Foreground Sleek Studio Lounge Seating Area (Burl-Walnut Coffee Table) */}
      <LeatherLoungeSofa position={[-2.35, 0, 0.8]} rotationY={Math.PI / 2} />
      <LeatherLoungeSofa position={[2.35, 0, 0.8]} rotationY={-Math.PI / 2} />
      <group position={[0, 0, 0.8]}>
        <RoundedBox args={[1.3, 0.065, 2.04]} radius={0.024} smoothness={4} position={[0, 0.36, 0]} castShadow receiveShadow>
          <meshStandardMaterial
            map={burlWalnutTex.map}
            normalMap={burlWalnutTex.normalMap}
            normalScale={burlNormalScale}
            roughnessMap={burlWalnutTex.roughnessMap}
            color="#4e2915"
            roughness={0.35}
            metalness={0.05}
          />
        </RoundedBox>
        {[-0.52, 0.52].map((lx) =>
          [-0.82, 0.82].map((lz) => (
            <RoundedBox
              key={`${lx}-${lz}`}
              args={[0.055, 0.34, 0.055]}
              radius={0.01}
              smoothness={3}
              position={[lx, 0.17, lz]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color="#18181b" metalness={0.88} roughness={0.22} />
            </RoundedBox>
          ))
        )}
        <RoundedBox args={[0.36, 0.055, 0.28]} radius={0.01} smoothness={3} position={[0, 0.42, 0.22]} castShadow receiveShadow>
          <meshStandardMaterial color="#1e293b" roughness={0.45} />
        </RoundedBox>
        <mesh position={[0, 0.44, -0.32]} castShadow receiveShadow>
          <cylinderGeometry args={[0.052, 0.058, 0.11, 18]} />
          <meshPhysicalMaterial color="#27272a" roughness={0.28} clearcoat={0.5} />
        </mesh>
      </group>

      <StudioFloorLamp position={[-3.25, 0, -1.1]} shadeMat={floorLampShadeMat} />
      <StudioFloorLamp position={[3.25, 0, -1.1]} shadeMat={floorLampShadeMat} />
      <StudioFloorLamp position={[-3.25, 0, 2.5]} shadeMat={floorLampShadeMat} />
      <StudioFloorLamp position={[3.25, 0, 2.5]} shadeMat={floorLampShadeMat} />

      {/* ====================================================================
          NEXT-GEN CINEMATIC THREE-POINT STUDIO LIGHTING & 2048x2048 SHADOWS
         ==================================================================== */}
      <primitive object={tableTarget} />
      <primitive object={hostsTarget} />
      <primitive object={rimForwardTarget} />
      <primitive object={loungeTarget} />

      {/* 1. KEY LIGHT: Crisp Broadcast Key onto Hosts */}
      <spotLight
        ref={keySpotRef}
        color={cal.keyColor}
        intensity={cal.keyIntensity}
        decay={cal.lightDecay}
        distance={20}
        angle={0.62}
        penumbra={0.85}
        position={[2.5, 4.5, 2.0]}
        target={hostsTarget}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />

      {/* 2. RIM / BACKLIGHT (Hair & Shoulder Pop): Warm Separation Rim */}
      <spotLight
        ref={rimSpotRef}
        color={cal.rimColor}
        intensity={cal.rimIntensity}
        decay={cal.lightDecay}
        distance={16}
        angle={0.72}
        penumbra={0.82}
        position={[0, 4.0, -5.5]}
        target={rimForwardTarget}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />

      {/* 3. FILL LIGHT: Cool Soft Bounce separating shadow side naturally */}
      <spotLight
        ref={fillSpotRef}
        color={cal.fillColor}
        intensity={cal.fillIntensity}
        decay={cal.lightDecay}
        distance={18}
        angle={0.78}
        penumbra={0.95}
        position={[-2.6, 3.9, 2.2]}
        target={hostsTarget}
      />

      {/* Warm Overhead Broadcast Table Accent SpotLight */}
      <spotLight
        ref={tableSpotRef}
        color={cal.keyColor}
        intensity={cal.keyIntensity * 0.72 * cal.practicalIntensity}
        decay={cal.lightDecay}
        distance={14}
        angle={0.54}
        penumbra={0.78}
        position={[0, 4.55, -1.6]}
        target={tableTarget}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />

      {/* Foreground Lounge Warm Fill SpotLight */}
      <spotLight
        ref={loungeSpotRef}
        color={cal.fillColor}
        intensity={cal.fillIntensity * 1.15 * cal.practicalIntensity}
        decay={cal.lightDecay}
        distance={14}
        angle={0.66}
        penumbra={0.85}
        position={[0, 4.5, 3.0]}
        target={loungeTarget}
      />

      {/* Subtle Desk Bounce & Hemisphere Indirect Fill */}
      <pointLight
        ref={bouncePointRef}
        color={cal.keyColor}
        intensity={cal.fillIntensity * 0.65}
        decay={cal.lightDecay}
        distance={12}
        position={[0, 2.3, -1.8]}
      />
      <hemisphereLight args={[cal.hemiSkyColor, cal.hemiGroundColor, cal.hemiIntensity]} />
    </group>
  );
}

function PodcastHostsCast({
  mocapClips,
  isPlaying,
  isActive = true,
  connectedPeers,
  latestTrackDeviceName,
  onInteractHotspot
}: {
  mocapClips: THREE.AnimationClip[];
  isPlaying: boolean;
  isActive?: boolean;
  connectedPeers?: RoomPeerParticipant[];
  latestTrackDeviceName?: string;
  onInteractHotspot?: (action: 'toggle_play' | 'next_track' | 'trigger_fx' | 'open_dj') => void;
}) {
  const peerMap = useMemo(() => {
    const slots = [
      { key: 'podcast-lead', isFemale: false },
      { key: 'podcast-cohost', isFemale: true },
      { key: 'podcast-guest', isFemale: false },
      { key: 'podcast-sofa-l1', isFemale: true },
      { key: 'podcast-sofa-r1', isFemale: false },
      { key: 'podcast-sofa-l2', isFemale: false },
      { key: 'podcast-sofa-r2', isFemale: true }
    ];
    return assignPeersToCastSlots(connectedPeers, slots, latestTrackDeviceName);
  }, [connectedPeers, latestTrackDeviceName]);

  const leadPeer = peerMap.get('podcast-lead');
  const cohostPeer = peerMap.get('podcast-cohost');
  const guestPeer = peerMap.get('podcast-guest');

  const loungeSeats: Array<{
    key: string;
    position: [number, number, number];
    rotationY: number;
    isFemale: boolean;
    archIdx: number;
    phase: number;
  }> = [
    { key: 'podcast-sofa-l1', position: [-2.2, 0, 0.32], rotationY: Math.PI / 2, isFemale: true, archIdx: 4, phase: 0.7 },
    { key: 'podcast-sofa-r1', position: [2.2, 0, 0.32], rotationY: -Math.PI / 2, isFemale: false, archIdx: 9, phase: 1.4 },
    { key: 'podcast-sofa-l2', position: [-2.2, 0, 1.28], rotationY: Math.PI / 2, isFemale: false, archIdx: 12, phase: 2.1 },
    { key: 'podcast-sofa-r2', position: [2.2, 0, 1.28], rotationY: -Math.PI / 2, isFemale: true, archIdx: 17, phase: 2.8 }
  ];

  return (
    <group>
      {/* Lead Host seated cleanly on center chair (hips locked at Y = -0.15 relative to seatHeight 0.52) */}
      <PodcastHostAvatar
        modelUrl={PODCAST_HOSTS_GLB_URL}
        mocapClips={mocapClips}
        archetypeIndex={5}
        position={[0, 0.3, -5.52]}
        rotationY={0}
        targetHeight={1.72}
        seatHeight={0.52}
        phaseOffset={0.1}
        isPlaying={isPlaying}
        isActive={isActive}
        onClick={() => onInteractHotspot?.('toggle_play')}
      >
        {leadPeer && (
          <PeerOverheadBadge peer={leadPeer.peer} isLatestDJ={leadPeer.isLatestDJ} headHeight={1.42} />
        )}
      </PodcastHostAvatar>

      {/* Co-Host seated cleanly on left chair (hips locked at Y = -0.15 relative to seatHeight 0.52) */}
      <PodcastHostAvatar
        modelUrl={PODCAST_COHOST_GLB_URL}
        mocapClips={mocapClips}
        archetypeIndex={0}
        position={[-1.34, 0.3, -4.38]}
        rotationY={Math.PI / 2 - 0.16}
        targetHeight={1.68}
        seatHeight={0.52}
        phaseOffset={1.65}
        isPlaying={isPlaying}
        isActive={isActive}
      >
        {cohostPeer && (
          <PeerOverheadBadge peer={cohostPeer.peer} isLatestDJ={cohostPeer.isLatestDJ} headHeight={1.4} />
        )}
      </PodcastHostAvatar>

      {/* Guest Host seated cleanly on right chair (hips locked at Y = -0.15 relative to seatHeight 0.52) */}
      <PodcastHostAvatar
        modelUrl={PODCAST_HOSTS_GLB_URL}
        mocapClips={mocapClips}
        archetypeIndex={15}
        position={[1.34, 0.3, -4.38]}
        rotationY={-Math.PI / 2 + 0.16}
        targetHeight={1.71}
        seatHeight={0.52}
        phaseOffset={2.9}
        isPlaying={isPlaying}
        isActive={isActive}
      >
        {guestPeer && (
          <PeerOverheadBadge peer={guestPeer.peer} isLatestDJ={guestPeer.isLatestDJ} headHeight={1.42} />
        )}
      </PodcastHostAvatar>

      {/* Overflow friends seated naturally on the foreground Nappa leather lounge sofas */}
      {loungeSeats.map((seat) => {
        const assigned = peerMap.get(seat.key);
        if (!assigned) return null;
        return (
          <PodcastHostAvatar
            key={seat.key}
            modelUrl={seat.isFemale ? PODCAST_COHOST_GLB_URL : PODCAST_HOSTS_GLB_URL}
            mocapClips={mocapClips}
            archetypeIndex={seat.archIdx}
            position={seat.position}
            rotationY={seat.rotationY}
            targetHeight={seat.isFemale ? 1.68 : 1.71}
            seatHeight={0.51}
            phaseOffset={seat.phase}
            isPlaying={isPlaying}
            isActive={isActive}
          >
            <PeerOverheadBadge
              peer={assigned.peer}
              isLatestDJ={assigned.isLatestDJ}
              headHeight={1.42}
            />
          </PodcastHostAvatar>
        );
      })}
    </group>
  );
}

function PodcastLoadedBody(
  props: SharedRoomSceneProps & { manifest: ConcertAssetManifest }
) {
  const mocapClips = useLoadedMocapClips(props.manifest.mocapAnimUrls);
  const isActive = props.isActive !== false;
  return (
    <>
      <PodcastArchitectureAndProps
        isPlaying={props.isPlaying}
        bpm={props.bpm}
        pulseIntensity={props.pulseIntensity}
        lightingFxMode={props.lightingFxMode}
        fxBurstSeq={props.fxBurstSeq}
        trackTitle={props.trackTitle || 'ضربان نیمه‌شب در ایستگاه نئون'}
        trackArtist={props.trackArtist || 'Aether Broadcast Studio'}
        trackCoverUrl={props.trackCoverUrl}
        trackAccentHex={props.trackAccentHex || '#38bdf8'}
        lightingCalibration={props.lightingCalibration}
        isActive={isActive}
        renderOwnFloor={props.renderOwnFloor !== false}
        onInteractHotspot={props.onInteractHotspot}
      />
      <ContactShadows
        position={[0, 0.01, -1.8]}
        opacity={0.85}
        scale={8}
        blur={2.0}
        far={3}
      />
      <ContactShadows
        position={[0, 0.305, -4.2]}
        opacity={0.85}
        scale={6}
        blur={2.0}
        far={2.8}
      />
      <PodcastHostsCast
        mocapClips={mocapClips}
        isPlaying={props.isPlaying}
        isActive={isActive}
        connectedPeers={props.connectedPeers}
        latestTrackDeviceName={props.latestTrackDeviceName}
        onInteractHotspot={props.onInteractHotspot}
      />
      <SceneReadySignal active={isActive} onReady={props.onReady} />
    </>
  );
}

export function PodcastRoomContent(
  props: SharedRoomSceneProps & { manifest: ConcertAssetManifest | null }
) {
  const { manifest, isActive = true } = props;
  if (!manifest) return null;
  return (
    <React.Suspense fallback={null}>
      {manifest.mocapAnimUrls.length > 0 ? (
        <PodcastLoadedBody {...props} manifest={manifest} />
      ) : (
        <>
          <PodcastArchitectureAndProps
            isPlaying={props.isPlaying}
            bpm={props.bpm}
            pulseIntensity={props.pulseIntensity}
            lightingFxMode={props.lightingFxMode}
            fxBurstSeq={props.fxBurstSeq}
            trackTitle={props.trackTitle || 'ضربان نیمه‌شب در ایستگاه نئون'}
            trackArtist={props.trackArtist || 'Aether Broadcast Studio'}
            trackCoverUrl={props.trackCoverUrl}
            trackAccentHex={props.trackAccentHex || '#38bdf8'}
            lightingCalibration={props.lightingCalibration}
            isActive={isActive}
            renderOwnFloor={props.renderOwnFloor !== false}
            onInteractHotspot={props.onInteractHotspot}
          />
          <ContactShadows
            position={[0, 0.01, -1.8]}
            opacity={0.85}
            scale={8}
            blur={2.0}
            far={3}
          />
          <ContactShadows
            position={[0, 0.305, -4.2]}
            opacity={0.85}
            scale={6}
            blur={2.0}
            far={2.8}
          />
          <PodcastHostsCast
            mocapClips={[]}
            isPlaying={props.isPlaying}
            isActive={isActive}
            connectedPeers={props.connectedPeers}
            latestTrackDeviceName={props.latestTrackDeviceName}
            onInteractHotspot={props.onInteractHotspot}
          />
          <SceneReadySignal active={isActive} onReady={props.onReady} />
        </>
      )}
    </React.Suspense>
  );
}

function PodcastExposureSync({ exposure }: { exposure: number }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [exposure, gl]);
  return null;
}

export function PodcastRoomScene(props: SharedRoomSceneProps) {
  const manifest = useConcertAssetManifest();
  const swGl = useMemo(() => isSoftwareWebGL(), []);
  const isActive = props.isActive !== false;
  const initialCam = PODCAST_CAMERA_SPEC[props.cameraPreset] || PODCAST_CAMERA_SPEC.cinematic;
  const cal = props.lightingCalibration || DEFAULT_ROOM_LIGHTING_PROFILES.podcast;

  return (
    <div className="h-full w-full bg-[#05060a]">
      <RoomErrorBoundary
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-[#05060a] text-xs text-[#CBD5E1]">
            3D Podcast Studio Loading...
          </div>
        }
      >
        <Canvas
          frameloop={isActive ? 'always' : 'never'}
          shadows="soft"
          dpr={swGl ? 1 : [1, 1.5]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.NoToneMapping,
            toneMappingExposure: cal.exposure
          }}
          camera={{ position: initialCam.position, fov: initialCam.fov, near: 0.1, far: 100 }}
          className="h-full w-full bg-[#05060a] touch-none"
        >
          <PodcastExposureSync exposure={cal.exposure} />
          <color attach="background" args={['#05060a']} />
          <fogExp2 attach="fog" args={['#05060a', cal.fogDensity]} />
          <ambientLight color={cal.ambientColor} intensity={cal.ambientIntensity} />

          {/* 1. HDRLoader Studio Environment (/public/hdr/studio_small_08_1k.hdr) */}
          <StudioHDRLoaderEnvironment />

          {/* 3. Mobile Portrait (9:16) Camera & Clamped OrbitControls */}
          <PodcastPortraitCameraRig
            cameraPreset={props.cameraPreset}
            moveInputRef={props.moveInputRef}
          />

          {/* 2 & 4. Studio GLB, Hosts GLB, Live OLED Monitor & ON AIR Neon */}
          <PodcastRoomContent {...props} manifest={manifest} renderOwnFloor />

          {/* 1. Post-Processing: Single ACES Filmic pass + glare-free Bloom & N8AO */}
          <EffectComposer multisampling={swGl ? 0 : 4}>
            <N8AO
              aoRadius={0.7}
              intensity={1.8}
              distanceFalloff={1.0}
              quality={swGl ? 'performance' : 'medium'}
              halfRes={swGl}
              enabled={!swGl}
            />
            <Bloom
              mipmapBlur={true}
              luminanceThreshold={cal.bloomThreshold}
              intensity={cal.bloomIntensity}
            />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <Vignette eskil={false} offset={0.2} darkness={cal.vignetteDarkness} />
          </EffectComposer>
        </Canvas>
      </RoomErrorBoundary>
    </div>
  );
}
