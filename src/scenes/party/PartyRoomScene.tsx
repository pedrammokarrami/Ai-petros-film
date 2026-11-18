import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ContactShadows, MeshReflectorMaterial, RoundedBox } from '@react-three/drei';
import type { RoomLightingFxMode } from '../../prototype/components/SonicRoom3DWorld';
import {
  DEFAULT_ROOM_LIGHTING_PROFILES,
  type RoomLightingCalibration
} from '../../types/lighting';
import type { ConcertAssetManifest } from '../concert/concertAssets';
import {
  clubConcretePBR,
  createLensFlareTexture,
  createPBRMaterial,
  createSoftLaserRayMaterial,
  createSoftVolumetricBeamMaterial,
  createSpeakerGrilleCanvasTexture,
  disposePBRMaterial,
  hash01,
  isSoftwareWebGL,
  LockedSymmetricalCameraRig,
  RiggedHumanAvatar,
  RoomCanvasFrame,
  sampleMusicSyncLighting,
  SceneReadySignal,
  useConcertAssetManifest,
  useLiveTrackCanvasTexture,
  useLoadedMocapClips,
  type HumanActivityMode,
  type RoomCameraSpec,
  type SharedRoomSceneProps
} from '../shared/SonicRoomShared';
import {
  createPolyHavenStandardMaterial,
  usePolyHavenPBR
} from '../shared/polyhavenTextures';
import { assignPeersToCastSlots, PeerOverheadBadge } from '../shared/RoomPeerAvatars';
import type { RoomPeerParticipant } from '../../types/roomSync';

export const PARTY_CAMERA_SPEC: RoomCameraSpec = {
  cinematic: { position: [0, 2.5, 8.5], target: [0, 2.2, -6.5], fov: 60 },
  first_person: { position: [0, 1.75, 4.2], target: [0, 2.1, -6.5], fov: 64 },
  stage_closeup: { position: [0, 2.1, -2.5], target: [0, 2.1, -6.8], fov: 54 },
  bounds: { minX: -5.8, maxX: 5.8, minY: 1.15, maxY: 6.2, minZ: -4.0, maxZ: 9.5 }
};

/**
 * Detailed Pioneer CDJ-3000 Media Player Deck (Anisotropic Brushed Aluminum & Glass Platter)
 */
function PioneerCDJDeck({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Beveled Anodized Aluminum Chassis */}
      <RoundedBox args={[0.42, 0.055, 0.48]} radius={0.015} smoothness={4} castShadow receiveShadow>
        <meshPhysicalMaterial color="#0d1017" roughness={0.22} metalness={0.9} anisotropy={0.85} clearcoat={0.45} />
      </RoundedBox>
      {/* Brushed Top Trim Frame */}
      <RoundedBox args={[0.39, 0.008, 0.45]} radius={0.006} smoothness={3} position={[0, 0.028, 0]}>
        <meshPhysicalMaterial color="#181d28" roughness={0.18} metalness={0.94} anisotropy={0.9} />
      </RoundedBox>
      {/* Angled High-Res Glass Waveform Screen */}
      <RoundedBox args={[0.32, 0.022, 0.14]} radius={0.006} smoothness={3} position={[0, 0.036, -0.14]} rotation={[0.16, 0, 0]}>
        <meshPhysicalMaterial color="#0b101b" emissive="#e2e8f0" emissiveIntensity={0.28} roughness={0.08} clearcoat={1.0} clearcoatRoughness={0.06} />
      </RoundedBox>
      {/* Jog Wheel Outer Rim + Grooved Aluminum Platter */}
      <mesh position={[0, 0.035, 0.06]} castShadow>
        <cylinderGeometry args={[0.128, 0.138, 0.026, 32]} />
        <meshPhysicalMaterial color="#141923" roughness={0.18} metalness={0.94} anisotropy={0.92} clearcoat={0.5} />
      </mesh>
      <mesh position={[0, 0.049, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.124, 0.0065, 12, 32]} />
        <meshStandardMaterial color="#f8fafc" emissive="#ffffff" emissiveIntensity={0.62} />
      </mesh>
      <mesh position={[0, 0.05, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.088, 0.0025, 8, 28]} />
        <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Center Illuminated On-Jog Display */}
      <mesh position={[0, 0.051, 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.048, 24]} />
        <meshPhysicalMaterial color="#0f172a" emissive="#cbd5e1" emissiveIntensity={0.34} roughness={0.1} clearcoat={1.0} />
      </mesh>
      {/* Tempo Pitch Fader + Chrome Rail */}
      <RoundedBox args={[0.03, 0.014, 0.145]} radius={0.004} smoothness={2} position={[0.16, 0.034, 0.08]}>
        <meshStandardMaterial color="#cbd5e1" metalness={0.94} roughness={0.16} />
      </RoundedBox>
      <RoundedBox args={[0.022, 0.018, 0.026]} radius={0.004} smoothness={2} position={[0.16, 0.044, 0.05]}>
        <meshStandardMaterial color="#f8fafc" metalness={0.96} roughness={0.14} />
      </RoundedBox>
      {/* 8 Illuminated Tactile Performance Hot-Cue Pads */}
      {[-0.12, -0.06, 0, 0.06].map((px, i) => (
        <RoundedBox key={i} args={[0.042, 0.014, 0.028]} radius={0.004} smoothness={2} position={[px, 0.034, -0.04]}>
          <meshPhysicalMaterial color="#f1f5f9" emissive="#ffffff" emissiveIntensity={0.38} roughness={0.22} clearcoat={0.6} />
        </RoundedBox>
      ))}
    </group>
  );
}

/**
 * Multi-Part Over-Ear DJ Monitor Headphones Resting on Booth Counter
 */
function StudioDJHeadphones({ position, rotationY = 0.45 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[Math.PI / 2 - 0.14, 0, rotationY]}>
      <mesh castShadow>
        <torusGeometry args={[0.105, 0.014, 10, 24, Math.PI * 1.15]} />
        <meshPhysicalMaterial color="#11151d" roughness={0.36} sheen={0.5} clearcoat={0.2} />
      </mesh>
      {[-0.105, 0.105].map((ex) => (
        <group key={ex} position={[ex, -0.015, 0]} rotation={[0, 0, ex < 0 ? 0.18 : -0.18]}>
          <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
            <cylinderGeometry args={[0.046, 0.042, 0.028, 20]} />
            <meshPhysicalMaterial color="#cbd5e1" metalness={0.94} roughness={0.18} anisotropy={0.8} />
          </mesh>
          <mesh position={[ex < 0 ? 0.018 : -0.018, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.036, 0.014, 10, 20]} />
            <meshPhysicalMaterial color="#0b0d12" roughness={0.45} sheen={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Faceted Motorized Disco Mirrorball Rig Suspended Above Dancefloor
 */
function DiscoMirrorballRig({
  position,
  isPlaying,
  bpm,
  isActive = true
}: {
  position: [number, number, number];
  isPlaying: boolean;
  bpm: number;
  isActive?: boolean;
}) {
  const ballRef = useRef<THREE.Group | null>(null);
  useFrame((_, delta) => {
    if (!isActive || !ballRef.current) return;
    const speed = isPlaying ? 0.25 + (bpm / 120) * 0.28 : 0.12;
    ballRef.current.rotation.y += delta * speed;
  });
  return (
    <group position={position}>
      {/* Motorized Ceiling Hub & Suspension Rod */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.13, 0.16, 16]} />
        <meshStandardMaterial color="#0b0e14" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.65, 10]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.95} roughness={0.18} />
      </mesh>
      {/* Faceted Specular Chrome Mirrorball */}
      <group ref={ballRef}>
        <mesh castShadow>
          <icosahedronGeometry args={[0.46, 2]} />
          <meshPhysicalMaterial
            color="#f8fafc"
            metalness={1.0}
            roughness={0.04}
            flatShading
            envMapIntensity={2.6}
            clearcoat={1.0}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Tufted Black Leather VIP Booth with Backlit Glass Cocktail Table & Optical Glass Bottle Service
 */
function VipBottleServiceBooth({
  position,
  rotationY = 0,
  swGl = false
}: {
  position: [number, number, number];
  rotationY?: number;
  swGl?: boolean;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Plinth Base with Brushed Steel Kickplate */}
      <RoundedBox args={[2.1, 0.16, 0.84]} radius={0.03} smoothness={3} position={[0, 0.08, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#090b0f" roughness={0.38} metalness={0.62} />
      </RoundedBox>
      {/* Tufted Piped Seat Cushions */}
      {[-0.5, 0.5].map((cx) => (
        <RoundedBox key={cx} args={[0.96, 0.18, 0.78]} radius={0.05} smoothness={4} position={[cx, 0.25, 0.02]} castShadow receiveShadow>
          <meshPhysicalMaterial color="#11141c" roughness={0.36} sheen={0.55} sheenColor="#64748b" clearcoat={0.32} />
        </RoundedBox>
      ))}
      {/* Channel-Tufted Vertical Leather Backrest Rib Panels */}
      {[-0.8, -0.4, 0, 0.4, 0.8].map((bx) => (
        <RoundedBox key={bx} args={[0.37, 0.54, 0.22]} radius={0.055} smoothness={4} position={[bx, 0.56, -0.3]} castShadow receiveShadow>
          <meshPhysicalMaterial color="#12151e" roughness={0.38} sheen={0.55} sheenColor="#475569" clearcoat={0.28} />
        </RoundedBox>
      ))}
      {/* Sculpted Cocktail Table with Frosted Illuminated Glass Top */}
      <RoundedBox args={[1.18, 0.36, 0.54]} radius={0.035} smoothness={4} position={[0, 0.18, 0.82]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#090b10" roughness={0.22} metalness={0.84} clearcoat={0.65} />
      </RoundedBox>
      <RoundedBox args={[1.06, 0.018, 0.44]} radius={0.01} smoothness={3} position={[0, 0.368, 0.82]}>
        <meshPhysicalMaterial
          color="#e2e8f0"
          emissive="#f8fafc"
          emissiveIntensity={0.14}
          roughness={0.1}
          clearcoat={1.0}
          transmission={swGl ? 0 : 0.45}
          transparent
          opacity={swGl ? 0.45 : 0.92}
        />
      </RoundedBox>
      {/* Brushed Steel Champagne Ice Bucket */}
      <group position={[0, 0.46, 0.82]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.11, 0.082, 0.18, 20]} />
          <meshPhysicalMaterial color="#e2e8f0" roughness={0.14} metalness={0.96} anisotropy={0.85} clearcoat={0.6} />
        </mesh>
        {/* Refractive Champagne Bottle Inside Bucket */}
        <group position={[0.015, 0.12, 0]} rotation={[0.12, 0, -0.14]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.034, 0.038, 0.17, 16]} />
            <meshPhysicalMaterial
              color="#94a3b8"
              roughness={0.06}
              metalness={0.05}
              ior={1.52}
              clearcoat={1.0}
              transmission={swGl ? 0 : 0.78}
              transparent
              opacity={swGl ? 0.55 : 1}
            />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.012, 0.022, 0.08, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.16} />
          </mesh>
        </group>
      </group>
      {/* Crystal Rocks Glasses on Table */}
      {[-0.32, 0.32].map((gx) => (
        <mesh key={gx} position={[gx, 0.415, 0.84]} castShadow>
          <cylinderGeometry args={[0.032, 0.026, 0.075, 16]} />
          <meshPhysicalMaterial
            color="#f8fafc"
            roughness={0.04}
            ior={1.52}
            clearcoat={1.0}
            transmission={swGl ? 0 : 0.88}
            transparent
            opacity={swGl ? 0.45 : 1}
          />
        </mesh>
      ))}
    </group>
  );
}

function PartyArchitectureAndLighting({
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
  const swGl = useMemo(() => isSoftwareWebGL(), []);
  const cal = lightingCalibration || DEFAULT_ROOM_LIGHTING_PROFILES.party;
  const cyberLedTexture = useLiveTrackCanvasTexture({
    style: 'party_cyber',
    trackTitle,
    trackArtist,
    trackCoverUrl,
    trackAccentHex,
    bpm,
    isPlaying,
    pulseIntensity,
    isActive
  });

  const floorTex = usePolyHavenPBR('metal_plate', 6, 7);
  const concreteWallMat = useMemo(
    () =>
      createPolyHavenStandardMaterial('metal_plate', {
        repeatX: 4,
        repeatY: 2,
        normalScale: 0.95,
        roughness: 0.36,
        metalness: 0.78,
        color: '#383e4a'
      }),
    []
  );
  const speakerGrille = useMemo(() => createSpeakerGrilleCanvasTexture(), []);
  const flareTex = useMemo(() => createLensFlareTexture(), []);

  // Drifting underground club haze motes illuminated by white laser fans
  const hazeRef = useRef<THREE.Points | null>(null);
  const hazeGeo = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (hash01(i * 4.7) - 0.5) * 11.5;
      pos[i * 3 + 1] = 0.6 + hash01(i * 9.3) * 5.2;
      pos[i * 3 + 2] = -7.8 + hash01(i * 13.1) * 12.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  // Main Monochrome Berlin Club Backdrop Wall (width: 4.6, height: 2.6) at [0, 3.5, -8.5]
  const curvedLedGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(4.6, 2.6, 28, 1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const nx = pos.getX(i) / 2.3;
      pos.setZ(i, nx * nx * 0.25);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const steelMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#090b0f', metalness: 0.85, roughness: 0.34 }),
    []
  );

  // 12 Overhead Pure-White Laser & Pin-Beam Projectors along Truss
  const beamXs = useMemo(
    () => [-4.4, -3.6, -2.8, -2.0, -1.2, -0.4, 0.4, 1.2, 2.0, 2.8, 3.6, 4.4],
    []
  );
  const beamMats = useMemo(
    () => beamXs.map(() => createSoftVolumetricBeamMaterial('#ffffff', 0.062)),
    [beamXs]
  );
  const beamRefs = useRef<Array<THREE.Group | null>>([]);
  const trussLensMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const trussFlareMatRefs = useRef<Array<THREE.SpriteMaterial | null>>([]);
  const trussFlareSpriteRefs = useRef<Array<THREE.Sprite | null>>([]);
  const eqBarMeshRefs = useRef<Array<THREE.Mesh | null>>([]);
  const eqBarMatRefs = useRef<Array<THREE.MeshStandardMaterial | null>>([]);
  const ledWallMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const djSpotRef = useRef<THREE.SpotLight | null>(null);
  const crowdSpotRef = useRef<THREE.SpotLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);

  // Razor-sharp pure white laser rays fanning from overhead & rear laser pods (with distance fade shader)
  const laserArrayRefs = useRef<Array<THREE.Group | null>>([]);
  const laserRayMat = useMemo(
    () => createSoftLaserRayMaterial('#ffffff', 0.34),
    []
  );
  const laserFanSpecs = useMemo(() => {
    const pods = [
      { id: 'left-pod', origin: [-2.4, 3.4, -7.7] as [number, number, number], basePitch: 1.52, baseYaw: 0.14 },
      { id: 'right-pod', origin: [2.4, 3.4, -7.7] as [number, number, number], basePitch: 1.52, baseYaw: -0.14 },
      { id: 'center-truss', origin: [0, 5.55, -5.2] as [number, number, number], basePitch: 2.08, baseYaw: 0 }
    ];
    return pods.map((pod) => ({
      ...pod,
      rays: Array.from({ length: 9 }, (_, rIdx) => ({
        spreadZ: (rIdx - 4) * 0.105,
        spreadX: (rIdx % 2 === 0 ? 1 : -1) * 0.03
      }))
    }));
  }, []);

  const burstRef = useRef(0);
  const lastSeqRef = useRef(fxBurstSeq);

  const boothTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 1.55, -6.6);
    return o;
  }, []);
  const crowdTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0.9, -0.4);
    return o;
  }, []);

  useEffect(() => {
    return () => {
      concreteWallMat.dispose();
      speakerGrille.dispose();
      flareTex.dispose();
      curvedLedGeo.dispose();
      steelMat.dispose();
      laserRayMat.dispose();
      hazeGeo.dispose();
      beamMats.forEach((m) => m.dispose());
    };
  }, [beamMats, concreteWallMat, curvedLedGeo, flareTex, hazeGeo, laserRayMat, speakerGrille, steelMat]);

  useFrame(({ clock }, delta) => {
    if (!isActive) return;
    const t = clock.getElapsedTime();
    if (fxBurstSeq !== lastSeqRef.current) {
      lastSeqRef.current = fxBurstSeq;
      burstRef.current = 1.0;
    }
    burstRef.current = Math.max(0, burstRef.current - delta * 1.45);

    const env = sampleMusicSyncLighting({
      time: t,
      bpm,
      isPlaying,
      pulseIntensity,
      lightingFxMode,
      burst: burstRef.current
    });
    const beatHz = Math.max(45, bpm || 120) / 60;
    const chaseStep = ((env.beatIndex % 4) + 4) % 4;
    const keyMod = cal.audioReactivity;
    const beamMod = cal.beamReactivity;

    if (djSpotRef.current) {
      const base = cal.keyIntensity;
      djSpotRef.current.intensity = isPlaying
        ? base * (0.75 + (env.bass * 0.95 + env.beatPulse * 0.35) * keyMod)
        : base;
    }
    if (crowdSpotRef.current) {
      const base = cal.rimIntensity;
      crowdSpotRef.current.intensity = isPlaying
        ? base * (0.7 + (env.beatPulse * 1.1 + env.high * 0.5) * beamMod)
        : base;
      crowdTarget.position.x = isPlaying ? env.barWave * 1.35 : 0;
    }
    if (hemiLightRef.current) {
      hemiLightRef.current.intensity = isPlaying
        ? cal.hemiIntensity * (0.85 + env.mid * 0.35 * keyMod)
        : cal.hemiIntensity;
    }
    if (ledWallMatRef.current) {
      ledWallMatRef.current.emissiveIntensity = isPlaying ? 0.1 + env.bass * 0.18 * beamMod : 0.11;
    }

    beamRefs.current.forEach((pivotGrp, idx) => {
      const mat = beamMats[idx];
      const isChaseActive = (idx % 4) === chaseStep || env.beatPulse > 0.65;
      const beamEnergy = isPlaying
        ? env.bass * (isChaseActive ? 1.1 : 0.38 + env.halfBeatPulse * 0.5) * beamMod
        : 0.18;
      if (pivotGrp && mat) {
        pivotGrp.rotation.z =
          -beamXs[idx] * 0.055 +
          Math.sin(t * beatHz * 0.85 + idx * 0.72) * (0.09 + env.bass * 0.07 * beamMod);
        pivotGrp.rotation.x = 0.24 + Math.cos(t * beatHz * 0.65 + idx) * 0.08;
        mat.uniforms.uTime.value = t;
        mat.uniforms.uOpacity.value = 0.062 * cal.beamOpacity;
        mat.uniforms.uBassHit.value = beamEnergy;
      }

      const lensMat = trussLensMatRefs.current[idx];
      if (lensMat) {
        lensMat.emissiveIntensity = isPlaying
          ? 0.55 + (isChaseActive ? 1.85 * env.beatPulse + env.high * 0.95 : env.mid * 0.45) * beamMod
          : 0.85;
      }
      const flareMat = trussFlareMatRefs.current[idx];
      const flareSprite = trussFlareSpriteRefs.current[idx];
      if (flareMat && flareSprite) {
        const fOp = isPlaying
          ? (0.14 + (isChaseActive ? 0.38 * env.beatPulse + env.high * 0.2 : 0.08) * beamMod) * cal.beamOpacity
          : 0.22 * cal.beamOpacity;
        flareMat.opacity = Math.min(0.85, fOp);
        const fScale = isPlaying ? 0.24 + fOp * 0.4 : 0.3;
        flareSprite.scale.set(fScale, fScale, 1);
      }
    });

    laserRayMat.uniforms.uTime.value = t;
    laserRayMat.uniforms.uOpacity.value = isPlaying
      ? Math.min(0.88, (0.16 + (env.beatPulse * 0.42 + env.high * 0.22) * beamMod + burstRef.current * 0.26) * cal.beamOpacity)
      : 0.14 * cal.beamOpacity;
    laserArrayRefs.current.forEach((grp, pIdx) => {
      if (!grp) return;
      const spec = laserFanSpecs[pIdx];
      const sweepSpeed = isPlaying ? beatHz * (0.65 + pIdx * 0.16) : 0.35;
      grp.rotation.x =
        spec.basePitch +
        Math.sin(t * sweepSpeed + pIdx * 1.3) * (isPlaying ? 0.16 + env.bass * 0.06 : 0.08);
      grp.rotation.y =
        spec.baseYaw +
        Math.cos(t * sweepSpeed * 0.75 + pIdx * 2.1) * (isPlaying ? 0.2 + env.mid * 0.08 : 0.1);
    });

    eqBarMeshRefs.current.forEach((bar, i) => {
      if (!bar) return;
      const specVal =
        env.bins && env.bins.length > 0
          ? env.bins[i % env.bins.length] / 255
          : isPlaying
            ? 0.22 + 0.72 * Math.pow(0.5 + 0.5 * Math.sin(t * beatHz * Math.PI * 2 + i * 0.55), 2)
            : 0.25;
      const targetScaleY = isPlaying ? 0.45 + specVal * 1.85 * Math.max(0.35, pulseIntensity) : 0.55;
      bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, targetScaleY, Math.min(1, delta * 18));
      const barMat = eqBarMatRefs.current[i];
      if (barMat) {
        barMat.emissiveIntensity = isPlaying ? 0.2 + specVal * 0.95 : 0.22;
      }
    });

    if (hazeRef.current) {
      hazeRef.current.rotation.y = Math.sin(t * 0.14) * 0.05;
      hazeRef.current.position.y = Math.sin(t * 0.42) * 0.09;
    }
  });

  const eqBars = useMemo(() => Array.from({ length: 16 }, (_, i) => -1.35 + i * 0.18), []);

  return (
    <group>
      {/* 1. Industrial Metallic Floor (Poly Haven metal_plate) */}
      {renderOwnFloor && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[16, 20]} />
          <MeshReflectorMaterial
            map={floorTex.map}
            normalMap={floorTex.normalMap}
            roughnessMap={floorTex.roughnessMap}
            resolution={256}
            blur={[120, 40]}
            mixBlur={1}
            mixStrength={1.05}
            mirror={0.38}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            depthScale={1.2}
            roughness={0.28}
            color="#353c48"
            metalness={0.74}
          />
        </mesh>
      )}

      {/* 2. Industrial Metal Warehouse Ceiling & Walls (Poly Haven metal_plate) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6.8, 0]}>
        <planeGeometry args={[16, 20]} />
        <meshStandardMaterial
          map={floorTex.map}
          normalMap={floorTex.normalMap}
          roughnessMap={floorTex.roughnessMap}
          color="#232830"
          roughness={0.42}
          metalness={0.78}
        />
      </mesh>
      {[-7.2, -4.4, -1.6, 1.2, 4.0, 6.8].map((cz) => (
        <RoundedBox key={cz} args={[15.8, 0.34, 0.38]} radius={0.03} smoothness={3} position={[0, 6.62, cz]} material={concreteWallMat} castShadow />
      ))}
      <mesh position={[0, 3.4, -9.8]} material={concreteWallMat} receiveShadow>
        <planeGeometry args={[16, 6.8]} />
      </mesh>
      <mesh position={[0, 3.4, 10.2]} rotation={[0, Math.PI, 0]} material={concreteWallMat}>
        <planeGeometry args={[16, 6.8]} />
      </mesh>
      <mesh position={[-7.2, 3.4, 0]} rotation={[0, Math.PI / 2, 0]} material={concreteWallMat} receiveShadow>
        <planeGeometry args={[20, 6.8]} />
      </mesh>
      <mesh position={[7.2, 3.4, 0]} rotation={[0, -Math.PI / 2, 0]} material={concreteWallMat} receiveShadow>
        <planeGeometry args={[20, 6.8]} />
      </mesh>

      {/* 3. 8 Raw Dark Brutalist Concrete Columns (Zero Neon Strips) */}
      {[-5.3, 5.3].map((px) =>
        [-5.2, -1.8, 1.6, 5.0].map((pz) => (
          <group key={`${px}-${pz}`} position={[px, 0, pz]} rotation={[0, px < 0 ? 0.16 : -0.16, 0]}>
            <RoundedBox args={[0.76, 6.8, 0.76]} radius={0.045} smoothness={4} position={[0, 3.4, 0]} material={concreteWallMat} castShadow receiveShadow />
          </group>
        ))
      )}

      {/* 4. Side Dark Steel & Smoked-Glass Mezzanine Balconies */}
      {[-5.6, 5.6].map((vx) => {
        const inward = vx > 0 ? -1 : 1;
        return (
          <group key={vx} position={[vx, 3.2, -0.4]}>
            <RoundedBox args={[2.3, 0.18, 11.4]} radius={0.03} smoothness={3} position={[inward * -0.7, 0, 0]} material={steelMat} castShadow receiveShadow />
            <mesh position={[inward * 0.41, 0.56, 0]}>
              <boxGeometry args={[0.04, 0.92, 11.3]} />
              <meshPhysicalMaterial color="#1e293b" transparent opacity={0.22} roughness={0.14} metalness={0.2} />
            </mesh>
            <RoundedBox args={[0.08, 0.05, 11.4]} radius={0.018} smoothness={3} position={[inward * 0.41, 1.03, 0]} material={steelMat} />
            <VipBottleServiceBooth
              position={[inward * -0.95, 0.09, -4.3]}
              rotationY={inward * (Math.PI / 2)}
              swGl={swGl}
            />
            <VipBottleServiceBooth
              position={[inward * -0.95, 0.09, 2.4]}
              rotationY={inward * (Math.PI / 2)}
              swGl={swGl}
            />
          </group>
        );
      })}

      {/* 5. Dim Monochrome Berlin Club Backdrop Wall + Flanking Matte Black Truss & Line-Array Towers */}
      <group position={[0, 3.5, -8.5]}>
        <RoundedBox args={[4.84, 2.84, 0.12]} radius={0.04} smoothness={4} position={[0, 0, -0.07]} material={steelMat} castShadow />
        <mesh
          geometry={curvedLedGeo}
          onClick={(e) => {
            e.stopPropagation();
            onInteractHotspot?.('toggle_play');
          }}
        >
          <meshStandardMaterial
            ref={ledWallMatRef}
            map={cyberLedTexture}
            emissiveMap={cyberLedTexture}
            emissive="#ffffff"
            emissiveIntensity={0.14}
            roughness={0.35}
          />
        </mesh>
      </group>

      {[-3.15, 3.15].map((tx) => {
        const inward = tx > 0 ? -1 : 1;
        return (
          <group key={tx} position={[tx, 0, -8.1]} rotation={[0, inward * 0.24, 0]}>
            <RoundedBox args={[0.44, 6.0, 0.44]} radius={0.035} smoothness={3} position={[0, 3.0, 0]} material={steelMat} castShadow receiveShadow />
            <group position={[inward * 0.45, 4.65, 0.65]}>
              {[0, -0.26, -0.52, -0.78, -1.04].map((ly, lIdx) => (
                <RoundedBox
                  key={lIdx}
                  args={[0.72, 0.22, 0.44]}
                  radius={0.025}
                  smoothness={3}
                  position={[0, ly, lIdx * 0.04]}
                  rotation={[0.08 * lIdx, 0, 0]}
                  castShadow
                >
                  <meshStandardMaterial color="#090b10" roughness={0.5} metalness={0.48} />
                </RoundedBox>
              ))}
            </group>
          </group>
        );
      })}

      {/* 6. Center Matte Obsidian DJ Booth ([0, 0, -6.6]) with Minimal White Accents */}
      <group position={[0, 0, -6.6]}>
        <RoundedBox args={[5.9, 0.8, 2.2]} radius={0.045} smoothness={4} position={[0, 0.4, 0]} receiveShadow castShadow material={steelMat} />
        <group
          position={[0, 0.8, 0.38]}
          onClick={(e) => {
            e.stopPropagation();
            onInteractHotspot?.('open_dj');
          }}
        >
          <RoundedBox args={[3.65, 1.1, 0.88]} radius={0.055} smoothness={4} position={[0, 0.55, 0]} castShadow receiveShadow>
            <meshPhysicalMaterial color="#06080b" roughness={0.28} metalness={0.82} clearcoat={0.4} />
          </RoundedBox>
          <RoundedBox args={[3.72, 0.055, 0.94]} radius={0.02} smoothness={4} position={[0, 1.11, 0]} castShadow receiveShadow material={steelMat} />
          {/* Beat-Synced Monochrome White Hairline Level Bars */}
          {eqBars.map((ex, i) => (
            <RoundedBox
              key={ex}
              ref={(el) => {
                eqBarMeshRefs.current[i] = el;
              }}
              args={[0.026, 0.22 + (i % 4) * 0.08, 0.02]}
              radius={0.004}
              smoothness={2}
              position={[ex, 0.55, 0.448]}
            >
              <meshStandardMaterial
                ref={(el) => {
                  eqBarMatRefs.current[i] = el;
                }}
                color="#cbd5e1"
                emissive="#ffffff"
                emissiveIntensity={0.28}
              />
            </RoundedBox>
          ))}
          {[-1.22, -0.62, 0.62, 1.22].map((dx) => (
            <PioneerCDJDeck key={dx} position={[dx, 1.16, 0.04]} />
          ))}
          {/* Sculpted Over-Ear DJ Headphones Resting Beside Mixer */}
          <StudioDJHeadphones position={[-0.3, 1.158, 0.24]} rotationY={0.52} />
          <group position={[0, 1.16, 0.04]}>
            <RoundedBox args={[0.52, 0.06, 0.5]} radius={0.015} smoothness={4} castShadow receiveShadow>
              <meshPhysicalMaterial color="#0b0e14" roughness={0.22} metalness={0.92} anisotropy={0.85} clearcoat={0.4} />
            </RoundedBox>
            {/* 4 Channel Faders + Rotary EQ Potentiometer Rows */}
            {[-0.15, -0.05, 0.05, 0.15].map((fx) => (
              <group key={fx}>
                <RoundedBox args={[0.024, 0.022, 0.16]} radius={0.004} smoothness={2} position={[fx, 0.036, 0.1]}>
                  <meshStandardMaterial color="#94a3b8" metalness={0.92} roughness={0.18} />
                </RoundedBox>
                {[-0.14, -0.08, -0.02].map((kz) => (
                  <mesh key={kz} position={[fx, 0.04, kz]} castShadow>
                    <cylinderGeometry args={[0.013, 0.015, 0.024, 12]} />
                    <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.22} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
          {[-1.65, 1.65].map((mx) => (
            <group key={mx} position={[mx, 1.32, -0.26]} rotation={[0.12, mx < 0 ? 0.38 : -0.38, 0]}>
              <RoundedBox args={[0.26, 0.38, 0.24]} radius={0.025} smoothness={4} castShadow>
                <meshStandardMaterial color="#0b0d13" roughness={0.36} metalness={0.68} />
              </RoundedBox>
              {/* Recessed Studio Monitor Woofer + Copper/White Tweeter Dome */}
              <mesh position={[0, -0.05, 0.125]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.072, 0.012, 10, 24]} />
                <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.7} />
              </mesh>
              <mesh position={[0, -0.05, 0.118]}>
                <circleGeometry args={[0.068, 22]} />
                <meshStandardMaterial color="#0f172a" roughness={0.48} metalness={0.35} />
              </mesh>
              <mesh position={[0, 0.1, 0.125]}>
                <circleGeometry args={[0.026, 16]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Stage Corner CO2 Cryo-Jet Cannons (Subtle Cool-White Tip) */}
        {[-2.6, 2.6].map((cx) => (
          <group key={cx} position={[cx, 0.85, 0.85]}>
            <mesh castShadow material={steelMat}>
              <cylinderGeometry args={[0.08, 0.11, 0.22, 16]} />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <cylinderGeometry args={[0.045, 0.055, 0.12, 14]} />
              <meshStandardMaterial color="#cbd5e1" emissive="#f8fafc" emissiveIntensity={0.25} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Flanking Stage Dancer Risers & Subwoofer Stacks */}
      {[-3.15, 3.15].map((sx) => (
        <group key={sx} position={[sx, 0, -6.6]}>
          <RoundedBox args={[1.34, 0.8, 1.44]} radius={0.04} smoothness={4} position={[0, 0.4, 0]} material={steelMat} receiveShadow castShadow />
          <RoundedBox args={[1.36, 0.035, 1.46]} radius={0.01} smoothness={3} position={[0, 0.79, 0]}>
            <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.28} />
          </RoundedBox>
        </group>
      ))}
      {[-4.5, 4.5].map((sx) => (
        <group key={sx} position={[sx, 0, -7.2]} rotation={[0, sx < 0 ? 0.25 : -0.25, 0]}>
          {[0.42, 1.28, 2.14, 3.0].map((sy) => (
            <group key={sy} position={[0, sy, 0]}>
              <RoundedBox args={[0.96, 0.8, 0.78]} radius={0.035} smoothness={4} castShadow receiveShadow>
                <meshStandardMaterial color="#08090d" roughness={0.62} metalness={0.28} />
              </RoundedBox>
              <mesh position={[0, 0, 0.395]}>
                <planeGeometry args={[0.84, 0.68]} />
                <meshStandardMaterial map={speakerGrille} color="#1e2430" roughness={0.55} metalness={0.7} />
              </mesh>
              {[-0.2, 0.2].map((wx) => (
                <group key={wx} position={[wx, 0, 0.398]}>
                  <mesh>
                    <ringGeometry args={[0.09, 0.175, 24]} />
                    <meshStandardMaterial color="#1e293b" metalness={0.88} roughness={0.28} />
                  </mesh>
                  <mesh position={[0, 0, -0.012]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.036, 0.135, 0.038, 20, 1, true]} />
                    <meshStandardMaterial color="#0b0e14" roughness={0.48} metalness={0.25} side={THREE.DoubleSide} />
                  </mesh>
                  <mesh position={[0, 0, -0.005]}>
                    <sphereGeometry args={[0.04, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
                    <meshStandardMaterial color="#090b0f" roughness={0.22} metalness={0.8} />
                  </mesh>
                </group>
              ))}
            </group>
          ))}
        </group>
      ))}

      {/* 7. Overhead Steel Box-Truss Grid (Y = 5.9) with Diagonal Lattice Cross-Bracing & Mirrorball */}
      <group position={[0, 5.9, -1.6]}>
        {[-5.6, -2.2, 1.2, 4.6].map((tz) => (
          <group key={tz} position={[0, 0, tz]}>
            <RoundedBox args={[11.2, 0.24, 0.24]} radius={0.025} smoothness={3} material={steelMat} castShadow />
            {[-4.4, -2.2, 0, 2.2, 4.4].map((bx) => (
              <mesh key={bx} position={[bx, 0, 0.13]} rotation={[0, 0, 0.72]}>
                <boxGeometry args={[0.035, 0.28, 0.03]} />
                <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.3} />
              </mesh>
            ))}
          </group>
        ))}
        {[-5.2, -1.8, 1.8, 5.2].map((tx) => (
          <RoundedBox key={tx} args={[0.24, 0.24, 11.4]} radius={0.025} smoothness={3} position={[tx, 0, 0]} material={steelMat} castShadow />
        ))}
      </group>

      {/* Suspended Faceted Chrome Disco Mirrorball */}
      <DiscoMirrorballRig position={[0, 5.1, -2.1]} isPlaying={isPlaying} bpm={bpm} isActive={isActive} />

      {/* Atmospheric Club Dust / Haze Motes Catching Lasers */}
      <points ref={hazeRef} geometry={hazeGeo}>
        <pointsMaterial color="#e2e8f0" size={0.038} transparent opacity={0.36} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      {beamXs.map((bx, idx) => (
        <group key={idx}>
          <group position={[bx, 5.75, -3.4]}>
            <RoundedBox args={[0.22, 0.1, 0.22]} radius={0.02} smoothness={3} position={[0, 0.12, 0]} material={steelMat} />
            <mesh material={steelMat} castShadow>
              <cylinderGeometry args={[0.09, 0.12, 0.25, 16]} />
            </mesh>
            <mesh position={[0, -0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.065, 16]} />
              <meshStandardMaterial
                ref={(el) => {
                  trussLensMatRefs.current[idx] = el;
                }}
                color="#ffffff"
                emissive="#ffffff"
                emissiveIntensity={1.25}
              />
            </mesh>
            <sprite
              ref={(el) => {
                trussFlareSpriteRefs.current[idx] = el;
              }}
              position={[0, -0.16, 0.03]}
              scale={[0.34, 0.34, 1]}
            >
              <spriteMaterial
                ref={(el) => {
                  trussFlareMatRefs.current[idx] = el;
                }}
                map={flareTex}
                color="#ffffff"
                transparent
                opacity={0.34}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </sprite>
          </group>
          {/* Volumetric White Club Haze Beams pivoted strictly inside projector lens [bx, 5.61, -3.4] */}
          <group
            position={[bx, 5.61, -3.4]}
            ref={(el) => {
              beamRefs.current[idx] = el;
            }}
          >
            <mesh position={[0, -3.0, 0]} material={beamMats[idx]}>
              <cylinderGeometry args={[0.04, 0.24, 6.0, 14, 1, true]} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Razor-Sharp Sweeping White Laser Fan Projectors (Authentic Underground Party Lasers) */}
      {laserFanSpecs.map((pod, pIdx) => (
        <group
          key={pod.id}
          position={pod.origin}
          ref={(el) => {
            laserArrayRefs.current[pIdx] = el;
          }}
        >
          {pod.rays.map((ray, rIdx) => (
            <group key={rIdx} rotation={[ray.spreadX, 0, ray.spreadZ]}>
              <mesh position={[0, 6.5, 0]} material={laserRayMat}>
                <cylinderGeometry args={[0.005, 0.015, 13.0, 6, 1, true]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* 8. Minimal High-Contrast Pitch-Dark Lighting (Pure Crisp White Pools Only) */}
      <primitive object={boothTarget} />
      <primitive object={crowdTarget} />
      {/* Tight overhead white pin-spot on DJ booth */}
      <spotLight
        ref={djSpotRef}
        color={cal.keyColor}
        intensity={cal.keyIntensity}
        decay={cal.lightDecay}
        distance={14}
        angle={0.42}
        penumbra={0.68}
        position={[0, 5.6, -5.2]}
        target={boothTarget}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
      {/* Tight cool-white overhead haze beam over center crowd silhouettes */}
      <spotLight
        ref={crowdSpotRef}
        color={cal.rimColor}
        intensity={cal.rimIntensity}
        decay={cal.lightDecay}
        distance={15}
        angle={0.56}
        penumbra={0.88}
        position={[0, 5.8, -0.8]}
        target={crowdTarget}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
      {/* Very faint ambient rim so floor shadows & dark shapes stay moody */}
      <hemisphereLight
        ref={hemiLightRef}
        args={[cal.hemiSkyColor, cal.hemiGroundColor, cal.hemiIntensity]}
      />
    </group>
  );
}

/**
 * Organic Non-Grid Underground Party Crowd with Guaranteed Collision-Free Separation (>= 0.84m)
 */
function PartyCrowdAndDj({
  manifest,
  mocapClips,
  isPlaying,
  bpm,
  isActive = true,
  connectedPeers,
  latestTrackDeviceName,
  onInteractHotspot
}: {
  manifest: ConcertAssetManifest;
  mocapClips: THREE.AnimationClip[];
  isPlaying: boolean;
  bpm: number;
  isActive?: boolean;
  connectedPeers?: RoomPeerParticipant[];
  latestTrackDeviceName?: string;
  onInteractHotspot?: (action: 'toggle_play' | 'next_track' | 'trigger_fx' | 'open_dj') => void;
}) {
  const dancers = useMemo(() => {
    const MIN_SEP_SQ = 0.86 * 0.86;
    const placed: Array<{
      key: string;
      pos: [number, number, number];
      rotY: number;
      archIdx: number;
      female: boolean;
      phase: number;
      speed: number;
      height: number;
      activity: HumanActivityMode;
    }> = [];

    // Pre-register VIP balcony & flanking riser dancers so nobody ever collides with them
    const fixedExtras: Array<{ pos: [number, number, number]; rotY: number; activity: HumanActivityMode }> = [
      { pos: [-5.1, 3.28, -3.0], rotY: Math.PI - 0.35, activity: 'club_dance' },
      { pos: [-5.1, 3.28, 0.2], rotY: Math.PI - 0.52, activity: 'chill_sway' },
      { pos: [5.1, 3.28, -3.0], rotY: Math.PI + 0.38, activity: 'club_dance' },
      { pos: [5.1, 3.28, 0.2], rotY: Math.PI + 0.45, activity: 'chill_sway' }
    ];
    fixedExtras.forEach((ex, i) => {
      placed.push({
        key: `party-vip-${i}`,
        pos: ex.pos,
        rotY: ex.rotY,
        archIdx: (i * 5 + 2) % 22,
        female: i % 2 === 0,
        phase: hash01(i * 11.7) * 6.28,
        speed: 0.85 + hash01(i * 4.3) * 0.3,
        height: 1.7 + (hash01(i * 7.1) - 0.5) * 0.08,
        activity: ex.activity
      });
    });

    // Organic party cluster pockets (tight near front, scattered groups & pairs further back)
    const clusters = [
      { cx: -1.65, cz: -3.2, rx: 1.5, rz: 1.3 },
      { cx: 1.45, cz: -3.0, rx: 1.5, rz: 1.3 },
      { cx: -0.15, cz: -1.6, rx: 1.7, rz: 1.4 },
      { cx: -2.65, cz: -0.7, rx: 1.3, rz: 1.4 },
      { cx: 2.55, cz: -0.5, rx: 1.3, rz: 1.4 },
      { cx: -1.1, cz: 1.1, rx: 1.6, rz: 1.4 },
      { cx: 1.5, cz: 1.4, rx: 1.6, rz: 1.4 },
      { cx: 0.1, cz: 2.8, rx: 2.2, rz: 1.2 }
    ];

    const floorPositions: Array<[number, number]> = [];
    for (let attempt = 0; attempt < 320 && floorPositions.length < 36; attempt++) {
      const cl = clusters[attempt % clusters.length];
      const ang = hash01(attempt * 13.37 + 1.1) * Math.PI * 2;
      const rad = Math.sqrt(hash01(attempt * 7.91 + 3.7));
      const x = cl.cx + Math.cos(ang) * cl.rx * rad;
      const z = cl.cz + Math.sin(ang) * cl.rz * rad;

      // Stay cleanly inside dancefloor bounds, away from DJ booth, speakers & columns
      if (x < -4.05 || x > 4.05 || z < -4.45 || z > 3.95) continue;
      if (Math.abs(x) < 3.45 && z < -4.9) continue;

      let overlaps = false;
      for (let j = 0; j < floorPositions.length; j++) {
        const dx = floorPositions[j][0] - x;
        const dz = floorPositions[j][1] - z;
        if (dx * dx + dz * dz < MIN_SEP_SQ) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      floorPositions.push([x, z]);
      const idx = floorPositions.length;
      const rRoll = hash01(attempt * 19.3);
      // Natural party facing: some face DJ loosely, some angle toward neighboring dancers
      const rotY =
        rRoll < 0.72
          ? Math.PI + (hash01(attempt * 5.3) - 0.5) * 1.15
          : Math.PI + (hash01(attempt * 8.9) - 0.5) * 2.5;

      const actRoll = hash01(attempt * 23.7);
      const activity: HumanActivityMode = actRoll < 0.72 ? 'club_dance' : 'chill_sway';

      placed.push({
        key: `party-dancer-${idx}`,
        pos: [x, 0, z],
        rotY,
        archIdx: Math.floor(hash01(attempt * 31.1) * 22) % 22,
        female: hash01(attempt * 17.3) > 0.48,
        phase: hash01(attempt * 41.9) * 6.28,
        speed: 0.78 + hash01(attempt * 29.3) * 0.46,
        height: 1.66 + hash01(attempt * 37.7) * 0.16,
        activity
      });
    }

    return placed;
  }, []);

  const peerMap = useMemo(() => {
    const floorCenterVisible = dancers
      .filter((d) => !d.key.startsWith('party-vip-') && Math.abs(d.pos[0]) <= 2.4 && d.pos[2] >= -4.2 && d.pos[2] <= 2.6)
      .sort((a, b) => Math.hypot(a.pos[0], a.pos[2] + 1.4) - Math.hypot(b.pos[0], b.pos[2] + 1.4));
    const orderedSlots = [
      { key: 'party-dj', isFemale: false },
      ...floorCenterVisible.slice(0, 6).map((d) => ({ key: d.key, isFemale: d.female })),
      { key: 'party-stage-l', isFemale: true },
      { key: 'party-stage-r', isFemale: true },
      ...dancers
        .filter((d) => !floorCenterVisible.slice(0, 6).some((fc) => fc.key === d.key))
        .map((d) => ({ key: d.key, isFemale: d.female }))
    ];
    return assignPeersToCastSlots(connectedPeers, orderedSlots, latestTrackDeviceName);
  }, [connectedPeers, dancers, latestTrackDeviceName]);

  const djPeer = peerMap.get('party-dj');
  const stageLeftPeer = peerMap.get('party-stage-l');
  const stageRightPeer = peerMap.get('party-stage-r');

  return (
    <group>
      <RiggedHumanAvatar
        modelUrl={manifest.dancerMale}
        mocapClips={mocapClips}
        archetypeIndex={13}
        position={[0, 0.8, -7.0]}
        rotationY={0}
        targetHeight={1.82}
        activity="dj"
        phaseOffset={0.2}
        isPlaying={isPlaying}
        bpm={bpm}
        castShadow
        isActive={isActive}
        onClick={() => onInteractHotspot?.('open_dj')}
      >
        {djPeer && (
          <PeerOverheadBadge peer={djPeer.peer} isLatestDJ={djPeer.isLatestDJ} headHeight={1.96} />
        )}
      </RiggedHumanAvatar>

      <RiggedHumanAvatar
        modelUrl={manifest.dancerFemale}
        mocapClips={mocapClips}
        archetypeIndex={0}
        position={[-3.15, 0.8, -6.6]}
        rotationY={0.34}
        targetHeight={1.76}
        activity="club_dance"
        phaseOffset={1.1}
        speedMult={0.94}
        isPlaying={isPlaying}
        bpm={bpm}
        castShadow
        isActive={isActive}
      >
        {stageLeftPeer && (
          <PeerOverheadBadge
            peer={stageLeftPeer.peer}
            isLatestDJ={stageLeftPeer.isLatestDJ}
            headHeight={1.92}
          />
        )}
      </RiggedHumanAvatar>
      <RiggedHumanAvatar
        modelUrl={manifest.dancerFemale}
        mocapClips={mocapClips}
        archetypeIndex={18}
        position={[3.15, 0.8, -6.6]}
        rotationY={-0.38}
        targetHeight={1.74}
        activity="club_dance"
        phaseOffset={3.4}
        speedMult={1.06}
        isPlaying={isPlaying}
        bpm={bpm}
        castShadow
        isActive={isActive}
      >
        {stageRightPeer && (
          <PeerOverheadBadge
            peer={stageRightPeer.peer}
            isLatestDJ={stageRightPeer.isLatestDJ}
            headHeight={1.92}
          />
        )}
      </RiggedHumanAvatar>

      {dancers.map((d) => {
        const assigned = peerMap.get(d.key);
        return (
          <RiggedHumanAvatar
            key={d.key}
            modelUrl={d.female ? manifest.dancerFemale : manifest.dancerMale}
            mocapClips={mocapClips}
            archetypeIndex={d.archIdx}
            position={d.pos}
            rotationY={d.rotY}
            targetHeight={d.height}
            activity={d.activity}
            phaseOffset={d.phase}
            speedMult={d.speed}
            isPlaying={isPlaying}
            bpm={bpm}
            castShadow
            isActive={isActive}
          >
            {assigned && (
              <PeerOverheadBadge
                peer={assigned.peer}
                isLatestDJ={assigned.isLatestDJ}
                headHeight={1.94}
              />
            )}
          </RiggedHumanAvatar>
        );
      })}
    </group>
  );
}

function PartyLoadedBody(
  props: SharedRoomSceneProps & { manifest: ConcertAssetManifest }
) {
  const mocapClips = useLoadedMocapClips(props.manifest.mocapAnimUrls);
  const isActive = props.isActive !== false;
  return (
    <>
      <PartyArchitectureAndLighting
        isPlaying={props.isPlaying}
        bpm={props.bpm}
        pulseIntensity={props.pulseIntensity}
        lightingFxMode={props.lightingFxMode}
        fxBurstSeq={props.fxBurstSeq}
        trackTitle={props.trackTitle || 'نبض زیرزمینی برلین'}
        trackArtist={props.trackArtist || 'Warehouse Session'}
        trackCoverUrl={props.trackCoverUrl}
        trackAccentHex={props.trackAccentHex || '#ffffff'}
        lightingCalibration={props.lightingCalibration}
        isActive={isActive}
        renderOwnFloor={props.renderOwnFloor !== false}
        onInteractHotspot={props.onInteractHotspot}
      />
      <ContactShadows position={[0, 0.01, -1.5]} opacity={0.85} scale={16} blur={2.0} far={4} resolution={256} frames={1} color="#020204" />
      <PartyCrowdAndDj
        manifest={props.manifest}
        mocapClips={mocapClips}
        isPlaying={props.isPlaying}
        bpm={props.bpm}
        isActive={isActive}
        connectedPeers={props.connectedPeers}
        latestTrackDeviceName={props.latestTrackDeviceName}
        onInteractHotspot={props.onInteractHotspot}
      />
      <SceneReadySignal active={isActive} onReady={props.onReady} />
    </>
  );
}

export function PartyRoomContent(
  props: SharedRoomSceneProps & { manifest: ConcertAssetManifest | null }
) {
  const { manifest, isActive = true } = props;
  if (!manifest) return null;
  return (
    <React.Suspense fallback={null}>
      {manifest.mocapAnimUrls.length > 0 ? (
        <PartyLoadedBody {...props} manifest={manifest} />
      ) : (
        <>
          <PartyArchitectureAndLighting
            isPlaying={props.isPlaying}
            bpm={props.bpm}
            pulseIntensity={props.pulseIntensity}
            lightingFxMode={props.lightingFxMode}
            fxBurstSeq={props.fxBurstSeq}
            trackTitle={props.trackTitle || 'نبض زیرزمینی برلین'}
            trackArtist={props.trackArtist || 'Warehouse Session'}
            trackCoverUrl={props.trackCoverUrl}
            trackAccentHex={props.trackAccentHex || '#ffffff'}
            lightingCalibration={props.lightingCalibration}
            isActive={isActive}
            renderOwnFloor={props.renderOwnFloor !== false}
            onInteractHotspot={props.onInteractHotspot}
          />
          <ContactShadows position={[0, 0.01, -1.5]} opacity={0.85} scale={16} blur={2.0} far={4} resolution={256} frames={1} color="#020204" />
          <PartyCrowdAndDj
            manifest={manifest}
            mocapClips={[]}
            isPlaying={props.isPlaying}
            bpm={props.bpm}
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

export function PartyRoomScene(props: SharedRoomSceneProps) {
  const manifest = useConcertAssetManifest();
  return (
    <RoomCanvasFrame
      roomPreset="party"
      bgHex="#020203"
      fogDensity={0.044}
      ambientColor="#050608"
      ambientIntensity={0.08}
      lightingFxMode={props.lightingFxMode}
      envIntensity={0.1}
      lightingCalibration={props.lightingCalibration}
      initialCam={PARTY_CAMERA_SPEC[props.cameraPreset] || PARTY_CAMERA_SPEC.cinematic}
    >
      <LockedSymmetricalCameraRig
        cameraPreset={props.cameraPreset}
        moveInputRef={props.moveInputRef}
        spec={PARTY_CAMERA_SPEC}
      />
      <PartyRoomContent {...props} manifest={manifest} />
    </RoomCanvasFrame>
  );
}
