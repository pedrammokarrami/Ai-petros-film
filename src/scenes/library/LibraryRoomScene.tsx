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
  createPBRMaterial,
  createSoftVolumetricBeamMaterial,
  disposePBRMaterial,
  hash01,
  LockedSymmetricalCameraRig,
  persianRugPBR,
  RiggedHumanAvatar,
  RoomCanvasFrame,
  sampleMusicSyncLighting,
  SceneReadySignal,
  useConcertAssetManifest,
  useLiveTrackCanvasTexture,
  useLoadedMocapClips,
  woodPlanksPBR,
  type RoomCameraSpec,
  type SharedRoomSceneProps
} from '../shared/SonicRoomShared';
import {
  createPolyHavenStandardMaterial,
  usePolyHavenPBR
} from '../shared/polyhavenTextures';
import { assignPeersToCastSlots, PeerOverheadBadge } from '../shared/RoomPeerAvatars';
import type { RoomPeerParticipant } from '../../types/roomSync';

export const LIBRARY_CAMERA_SPEC: RoomCameraSpec = {
  cinematic: { position: [0, 2.5, 8.2], target: [0, 2.0, -5.5], fov: 60 },
  first_person: { position: [0, 1.72, 4.2], target: [0, 1.9, -5.5], fov: 62 },
  stage_closeup: { position: [0, 1.9, -2.0], target: [0, 1.7, -5.5], fov: 52 },
  bounds: { minX: -4.6, maxX: 4.6, minY: 1.1, maxY: 6.2, minZ: -3.5, maxZ: 9.0 }
};

function BrassChandelierRing({
  position,
  lightRef,
  bulbMat
}: {
  position: [number, number, number];
  lightRef?: React.Ref<THREE.PointLight>;
  bulbMat: THREE.MeshPhysicalMaterial;
}) {
  const bulbs = useMemo(() => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2), []);
  return (
    <group position={position}>
      <pointLight ref={lightRef} color="#ffd894" intensity={3.5} decay={1.0} distance={15} position={[0, -0.3, 0]} />
      <mesh position={[0, 0.56, 0]} castShadow>
        <cylinderGeometry args={[0.024, 0.024, 1.12, 12]} />
        <meshStandardMaterial color="#8a6228" metalness={0.92} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow>
        <sphereGeometry args={[0.085, 16, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.94} roughness={0.18} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[1.02, 0.046, 16, 40]} />
        <meshStandardMaterial color="#c89d42" metalness={0.94} roughness={0.18} />
      </mesh>
      {[0, Math.PI / 3, (2 * Math.PI) / 3].map((rot) => (
        <mesh key={rot} rotation={[0, rot, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 2.0, 8]} />
          <meshStandardMaterial color="#92692b" metalness={0.9} roughness={0.22} />
        </mesh>
      ))}
      {bulbs.map((a) => (
        <group key={a} position={[Math.cos(a) * 1.02, 0.11, Math.sin(a) * 1.02]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.038, 0.048, 0.11, 12]} />
            <meshStandardMaterial color="#92692b" metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.11, 0]} material={bulbMat}>
            <cylinderGeometry args={[0.044, 0.034, 0.13, 14]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * Sculpted Oxblood Leather Chesterfield Armchair (Diamond-Tufted Brass Buttons & Sheen)
 */
function SculptedChesterfieldArmchair({ position }: { position: [number, number, number] }) {
  const tuftButtons = useMemo<Array<[number, number]>>(
    () => [
      [-0.28, 0.78], [0, 0.78], [0.28, 0.78],
      [-0.14, 0.65], [0.14, 0.65],
      [-0.28, 0.52], [0, 0.52], [0.28, 0.52]
    ],
    []
  );
  return (
    <group position={position}>
      {/* Walnut Plinth Frame & 4 Turned Legs with Brass Casters */}
      <RoundedBox args={[0.92, 0.08, 0.82]} radius={0.025} smoothness={4} position={[0, 0.12, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#2b1408" roughness={0.34} />
      </RoundedBox>
      {[
        [-0.38, -0.34],
        [0.38, -0.34],
        [-0.38, 0.34],
        [0.38, 0.34]
      ].map(([lx, lz], idx) => (
        <mesh key={idx} position={[lx, 0.045, lz]} castShadow>
          <cylinderGeometry args={[0.032, 0.022, 0.09, 12]} />
          <meshStandardMaterial color="#d4af37" metalness={0.94} roughness={0.18} />
        </mesh>
      ))}
      {/* Deep Plump Oxblood Nappa Leather Seat Cushion + Front Piping */}
      <RoundedBox args={[0.68, 0.16, 0.68]} radius={0.048} smoothness={4} position={[0, 0.24, 0.04]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#58121f" roughness={0.34} sheen={0.65} sheenColor="#8b2635" clearcoat={0.38} />
      </RoundedBox>
      {/* Tufted High Backrest + Brass Tuft Buttons */}
      <RoundedBox args={[0.88, 0.68, 0.22]} radius={0.055} smoothness={4} position={[0, 0.62, -0.3]} rotation={[-0.08, 0, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#4c0f1b" roughness={0.36} sheen={0.62} sheenColor="#7f1d1d" clearcoat={0.34} />
      </RoundedBox>
      {tuftButtons.map(([bx, by], bIdx) => (
        <mesh key={bIdx} position={[bx, by, -0.192]} rotation={[Math.PI / 2 - 0.08, 0, 0]}>
          <sphereGeometry args={[0.015, 10, 10]} />
          <meshStandardMaterial color="#d4af37" metalness={0.92} roughness={0.22} />
        </mesh>
      ))}
      {[-0.4, 0.4].map((wx) => (
        <RoundedBox
          key={wx}
          args={[0.12, 0.42, 0.24]}
          radius={0.035}
          smoothness={4}
          position={[wx, 0.72, -0.18]}
          rotation={[0, wx < 0 ? 0.18 : -0.18, 0]}
          castShadow
        >
          <meshPhysicalMaterial color="#58121f" roughness={0.34} sheen={0.6} sheenColor="#8b2635" clearcoat={0.36} />
        </RoundedBox>
      ))}
      {/* Rolled Scroll Armrests with Mahogany Facing & Brass Stud Trim */}
      {[-0.41, 0.41].map((ax) => (
        <group key={ax} position={[ax, 0.42, 0.02]}>
          <RoundedBox args={[0.17, 0.34, 0.78]} radius={0.052} smoothness={4} castShadow receiveShadow>
            <meshPhysicalMaterial color="#58121f" roughness={0.34} sheen={0.6} sheenColor="#8b2635" clearcoat={0.36} />
          </RoundedBox>
          <mesh position={[0, 0.12, 0.39]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.068, 18]} />
            <meshStandardMaterial color="#d4af37" metalness={0.92} roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

let CACHED_GLOBE_MAP_TEX: THREE.CanvasTexture | null = null;
function getAntiqueGlobeCartographyTexture(): THREE.CanvasTexture {
  if (CACHED_GLOBE_MAP_TEX) return CACHED_GLOBE_MAP_TEX;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, 512, 256);
  bg.addColorStop(0, '#c8a96e');
  bg.addColorStop(0.5, '#dfc48d');
  bg.addColorStop(1, '#b89458');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  // Graticule latitude / longitude lines
  ctx.strokeStyle = 'rgba(72, 42, 18, 0.34)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(139, 44, 34, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(512, 128);
  ctx.stroke();

  // Sepia hand-drawn antique continents
  ctx.fillStyle = 'rgba(112, 74, 36, 0.65)';
  ctx.strokeStyle = 'rgba(56, 30, 14, 0.72)';
  ctx.lineWidth = 1.4;
  const blobs = [
    [95, 82, 42, 28],
    [135, 165, 26, 42],
    [255, 72, 38, 22],
    [275, 142, 34, 44],
    [365, 88, 62, 36],
    [418, 182, 28, 20]
  ];
  blobs.forEach(([bx, by, rx, ry]) => {
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  CACHED_GLOBE_MAP_TEX = tex;
  return tex;
}

/**
 * Antique Brass & Parchment Terrestrial Globe on Mahogany Stand
 */
function AntiqueTerrestrialGlobe({ position }: { position: [number, number, number] }) {
  const globeMap = useMemo(() => getAntiqueGlobeCartographyTexture(), []);
  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.24, 0.08, 20]} />
        <meshStandardMaterial color="#3b1d0e" roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.055, 0.64, 16]} />
        <meshStandardMaterial color="#3b1d0e" roughness={0.34} />
      </mesh>
      {/* Brass Meridian Ring & Equatorial Collar */}
      <mesh position={[0, 0.82, 0]} rotation={[0, 0.3, 0.4]} castShadow>
        <torusGeometry args={[0.25, 0.016, 12, 36]} />
        <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.16} />
      </mesh>
      <mesh position={[0, 0.82, 0]} rotation={[Math.PI / 2 - 0.38, 0.3, 0]}>
        <torusGeometry args={[0.228, 0.008, 8, 36]} />
        <meshStandardMaterial color="#b48a3e" metalness={0.92} roughness={0.2} />
      </mesh>
      {/* Aged Parchment Cartography Sphere */}
      <mesh position={[0, 0.82, 0]} rotation={[0.38, 0.8, 0]} castShadow>
        <sphereGeometry args={[0.22, 28, 28]} />
        <meshPhysicalMaterial map={globeMap} roughness={0.38} metalness={0.08} clearcoat={0.28} />
      </mesh>
    </group>
  );
}

/**
 * 7-Part Antique Brass Acoustic Gramophone / Phonograph with Flared LatheGeometry Horn
 */
function AntiqueBrassGramophone({
  position,
  isPlaying,
  isActive = true
}: {
  position: [number, number, number];
  isPlaying: boolean;
  isActive?: boolean;
}) {
  const platterRef = useRef<THREE.Group | null>(null);
  const hornGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const r = 0.022 + Math.pow(u, 2.35) * 0.21;
      const y = u * 0.34;
      pts.push(new THREE.Vector2(r, y));
    }
    const g = new THREE.LatheGeometry(pts, 28);
    g.computeVertexNormals();
    return g;
  }, []);

  useEffect(() => {
    return () => hornGeo.dispose();
  }, [hornGeo]);

  useFrame((_, delta) => {
    if (!isActive || !platterRef.current || !isPlaying) return;
    platterRef.current.rotation.y -= delta * 1.4;
  });

  return (
    <group position={position} rotation={[0, -0.45, 0]}>
      {/* Turned Mahogany Pedestal */}
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.042, 0.085, 0.56, 16]} />
        <meshStandardMaterial color="#3b1d0e" roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.25, 0.06, 20]} />
        <meshStandardMaterial color="#2b1408" roughness={0.36} />
      </mesh>
      {/* Beveled Walnut Motor Cabinet */}
      <RoundedBox args={[0.38, 0.14, 0.38]} radius={0.02} smoothness={4} position={[0, 0.63, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#42200e" roughness={0.3} clearcoat={0.38} />
      </RoundedBox>
      <RoundedBox args={[0.41, 0.024, 0.41]} radius={0.01} smoothness={3} position={[0, 0.705, 0]} castShadow>
        <meshStandardMaterial color="#c89d42" metalness={0.92} roughness={0.2} />
      </RoundedBox>
      {/* Spinning Shellac 78rpm Record Platter */}
      <group ref={platterRef} position={[0, 0.725, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.145, 0.145, 0.014, 28]} />
          <meshStandardMaterial color="#0b0d12" roughness={0.22} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.045, 20]} />
          <meshStandardMaterial color="#991b1b" roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.022, 10]} />
          <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.15} />
        </mesh>
      </group>
      {/* Brass Tonearm Bracket & Curved Neck */}
      <mesh position={[-0.12, 0.82, -0.1]} castShadow>
        <cylinderGeometry args={[0.018, 0.024, 0.18, 12]} />
        <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.16} />
      </mesh>
      {/* Flared Acoustic Brass Horn */}
      <group position={[-0.12, 0.9, -0.1]} rotation={[0.58, 0.25, -0.1]}>
        <mesh geometry={hornGeo} castShadow>
          <meshPhysicalMaterial
            color="#e5c158"
            metalness={0.96}
            roughness={0.14}
            clearcoat={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      {/* Hand Winding Crank */}
      <mesh position={[0.21, 0.63, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.06, 10]} />
        <meshStandardMaterial color="#d4af37" metalness={0.94} roughness={0.18} />
      </mesh>
    </group>
  );
}

/**
 * Grand Heritage Oak Reading Table with Leather Blotter, Dual Emeralite Banker Lamps, Open Books & 4 Sculpted Chairs
 */
function HeritageReadingTableGroup({
  position,
  mahoganyMat,
  lampConeMat,
  bankerShadeMat
}: {
  position: [number, number, number];
  mahoganyMat: THREE.MeshStandardMaterial;
  lampConeMat: THREE.ShaderMaterial;
  bankerShadeMat: THREE.MeshPhysicalMaterial;
}) {
  return (
    <group position={position}>
      {/* Beveled Mahogany Tabletop (depth 0.92 for generous knee/hand clearance) */}
      <RoundedBox args={[2.34, 0.08, 0.92]} radius={0.028} smoothness={4} position={[0, 0.74, 0]} castShadow receiveShadow material={mahoganyMat} />
      {/* Recessed Archive-Green Leather Desktop Blotter Inlay */}
      <RoundedBox args={[2.06, 0.015, 0.7]} radius={0.01} smoothness={3} position={[0, 0.782, 0]} receiveShadow>
        <meshPhysicalMaterial color="#112e22" roughness={0.42} clearcoat={0.28} />
      </RoundedBox>
      {/* Brass Corner Trim Strips */}
      <RoundedBox args={[2.12, 0.012, 0.76]} radius={0.01} smoothness={2} position={[0, 0.78, 0]}>
        <meshStandardMaterial color="#c89d42" metalness={0.9} roughness={0.22} />
      </RoundedBox>

      {/* 4 Turned Mahogany Table Legs with Brass Ferrules */}
      {[
        [-0.98, -0.35],
        [0.98, -0.35],
        [-0.98, 0.35],
        [0.98, 0.35]
      ].map(([lx, lz], lIdx) => (
        <group key={lIdx} position={[lx, 0.36, lz]}>
          <mesh castShadow material={mahoganyMat}>
            <cylinderGeometry args={[0.042, 0.032, 0.72, 14]} />
          </mesh>
          <mesh position={[0, -0.31, 0]}>
            <cylinderGeometry args={[0.035, 0.032, 0.09, 12]} />
            <meshStandardMaterial color="#d4af37" metalness={0.92} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Dual Iconic Emeralite Brass & Green Glass Banker's Lamps */}
      {[-0.58, 0.58].map((bx) => (
        <group key={bx} position={[bx, 0.79, 0]}>
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.095, 0.04, 16]} />
            <meshStandardMaterial color="#c89d42" metalness={0.94} roughness={0.18} />
          </mesh>
          <mesh position={[0, 0.15, 0]} castShadow>
            <cylinderGeometry args={[0.016, 0.018, 0.26, 12]} />
            <meshStandardMaterial color="#c89d42" metalness={0.94} roughness={0.18} />
          </mesh>
          <mesh position={[0, 0.28, 0]} rotation={[0, 0, Math.PI / 2]} castShadow material={bankerShadeMat}>
            <cylinderGeometry args={[0.075, 0.075, 0.21, 16, 1, false, 0, Math.PI]} />
          </mesh>
          <mesh position={[0, 0.13, 0]} material={lampConeMat}>
            <cylinderGeometry args={[0.06, 0.24, 0.28, 14, 1, true]} />
          </mesh>
        </group>
      ))}

      {/* 3-Part Open Illuminated Leather Manuscripts + Stacked Volumes + Brass Inkwells */}
      {[
        [-0.58, -0.22],
        [0.58, 0.22]
      ].map(([ox, oz], oIdx) => (
        <group key={oIdx} position={[ox, 0.79, oz]} rotation={[0, oIdx === 0 ? 0.12 : -0.14, 0]}>
          {/* Leather Book Cover Base */}
          <RoundedBox args={[0.31, 0.01, 0.22]} radius={0.003} smoothness={2} castShadow>
            <meshStandardMaterial color={oIdx === 0 ? '#4c0f1b' : '#132a1f'} roughness={0.44} />
          </RoundedBox>
          {/* Left & Right Curved Cream Parchment Page Blocks */}
          <RoundedBox args={[0.14, 0.02, 0.2]} radius={0.004} smoothness={2} position={[-0.072, 0.012, 0]} rotation={[0, 0, -0.08]} castShadow>
            <meshStandardMaterial color="#fef3c7" roughness={0.62} />
          </RoundedBox>
          <RoundedBox args={[0.14, 0.02, 0.2]} radius={0.004} smoothness={2} position={[0.072, 0.012, 0]} rotation={[0, 0, 0.08]} castShadow>
            <meshStandardMaterial color="#fdf4d7" roughness={0.62} />
          </RoundedBox>
          {/* Crimson Silk Bookmark Ribbon */}
          <mesh position={[0.01, 0.022, 0.02]} rotation={[0, 0.1, 0]}>
            <boxGeometry args={[0.012, 0.003, 0.22]} />
            <meshStandardMaterial color="#b91c1c" roughness={0.45} />
          </mesh>
          {/* Brass & Glass Inkwell Beside Open Tome */}
          <group position={[0.22, 0.02, -0.04]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.024, 0.028, 0.036, 12]} />
              <meshPhysicalMaterial color="#1e293b" roughness={0.12} clearcoat={1.0} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.022, 0]}>
              <cylinderGeometry args={[0.014, 0.016, 0.012, 12]} />
              <meshStandardMaterial color="#d4af37" metalness={0.94} roughness={0.18} />
            </mesh>
          </group>
        </group>
      ))}
      {/* Stacked Archival Hardcover Books on Center Blotter */}
      <group position={[0, 0.805, 0.14]} rotation={[0, 0.24, 0]}>
        <RoundedBox args={[0.2, 0.034, 0.15]} radius={0.004} smoothness={2} castShadow>
          <meshStandardMaterial color="#1e293b" roughness={0.48} />
        </RoundedBox>
        <RoundedBox args={[0.18, 0.03, 0.14]} radius={0.004} smoothness={2} position={[0.01, 0.032, -0.01]} rotation={[0, -0.22, 0]} castShadow>
          <meshStandardMaterial color="#581c1c" roughness={0.45} />
        </RoundedBox>
      </group>

      {/* 4 Sculpted Leather & Mahogany Reading Chairs at [-0.62, 0.62] x [-0.86, 0.86] */}
      {[-0.62, 0.62].map((cx) =>
        [-0.86, 0.86].map((cz) => (
          <group key={`${cx}-${cz}`} position={[cx, 0, cz]} rotation={[0, cz < 0 ? 0 : Math.PI, 0]}>
            {/* Padded Oxblood Leather Seat Cushion */}
            <RoundedBox args={[0.44, 0.06, 0.44]} radius={0.025} smoothness={4} position={[0, 0.43, 0]} castShadow receiveShadow>
              <meshPhysicalMaterial color="#4a121b" roughness={0.36} clearcoat={0.32} />
            </RoundedBox>
            {/* Mahogany Seat Frame */}
            <RoundedBox args={[0.46, 0.04, 0.46]} radius={0.015} smoothness={3} position={[0, 0.39, 0]} castShadow material={mahoganyMat} />
            {/* Curved Upholstered Backrest */}
            <RoundedBox args={[0.42, 0.38, 0.06]} radius={0.025} smoothness={4} position={[0, 0.72, -0.2]} rotation={[-0.07, 0, 0]} castShadow>
              <meshPhysicalMaterial color="#3d0f16" roughness={0.38} clearcoat={0.28} />
            </RoundedBox>
            {/* 4 Turned Legs */}
            {[
              [-0.18, -0.18],
              [0.18, -0.18],
              [-0.18, 0.18],
              [0.18, 0.18]
            ].map(([lx, lz], lIdx) => (
              <mesh key={lIdx} position={[lx, 0.19, lz]} castShadow material={mahoganyMat}>
                <cylinderGeometry args={[0.02, 0.015, 0.38, 10]} />
              </mesh>
            ))}
          </group>
        ))
      )}
    </group>
  );
}

function LibraryArchitectureAndProps({
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
  const cal = lightingCalibration || DEFAULT_ROOM_LIGHTING_PROFILES.audiobook;
  const archivalTexture = useLiveTrackCanvasTexture({
    style: 'library_archival',
    trackTitle,
    trackArtist,
    trackCoverUrl,
    trackAccentHex,
    bpm,
    isPlaying,
    pulseIntensity,
    isActive
  });

  const floorTex = usePolyHavenPBR('brown_planks_07', 6, 8);
  const rugTex = useMemo(() => persianRugPBR(1, 4), []);
  const mahoganyMat = useMemo(
    () =>
      createPolyHavenStandardMaterial('brown_planks_07', {
        repeatX: 5,
        repeatY: 3,
        normalScale: 0.9,
        roughness: 0.56,
        metalness: 0.05,
        color: '#b5845d'
      }),
    []
  );
  const softBeamMat = useMemo(() => createSoftVolumetricBeamMaterial('#ffaa44', 0.065), []);
  const lampConeMat = useMemo(() => createSoftVolumetricBeamMaterial('#10b981', 0.056), []);
  const bankerShadeMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#10b981',
        emissive: '#10b981',
        emissiveIntensity: 0.75,
        roughness: 0.14,
        clearcoat: 0.9
      }),
    []
  );
  const chandelierBulbMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#fffbeb',
        emissive: '#ffaa44',
        emissiveIntensity: 1.25,
        roughness: 0.16,
        transmission: 0.3
      }),
    []
  );
  const shelfStripMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fde68a',
        emissive: '#ffaa44',
        emissiveIntensity: 0.85
      }),
    []
  );
  const skylightMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#b48a3e',
        emissive: '#c89d42',
        emissiveIntensity: 0.32,
        roughness: 0.4
      }),
    []
  );

  const leftChandelierLightRef = useRef<THREE.PointLight | null>(null);
  const rightChandelierLightRef = useRef<THREE.PointLight | null>(null);
  const floorLampLightRef = useRef<THREE.PointLight | null>(null);
  const floorLampShadeMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const keySpotRef = useRef<THREE.SpotLight | null>(null);
  const rimSpotRef = useRef<THREE.SpotLight | null>(null);
  const fillSpotRef = useRef<THREE.SpotLight | null>(null);
  const overheadFillRef = useRef<THREE.PointLight | null>(null);
  const portalScreenMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const burstRef = useRef(0);
  const lastSeqRef = useRef(fxBurstSeq);

  // 1200 instanced antique leather-bound books
  const bookMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const bookCount = 1200;

  const dustRef = useRef<THREE.Points | null>(null);
  const dustGeo = useMemo(() => {
    const count = 180;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (hash01(i * 3.1) - 0.5) * 9.0;
      pos[i * 3 + 1] = 0.6 + hash01(i * 7.3) * 4.8;
      pos[i * 3 + 2] = -7.0 + hash01(i * 11.7) * 12.0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useEffect(() => {
    const inst = bookMeshRef.current;
    if (inst) {
      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      const palette = ['#3b1518', '#162b1e', '#1a2436', '#4a3219', '#2b1d0e', '#581c1c'];
      let idx = 0;

      // Left (X = -4.75) & Right (X = +4.75) 2-story shelves
      [-4.75, 4.75].forEach((wx) => {
        for (let tier = 0; tier < 6; tier++) {
          const by = 0.58 + tier * 0.94;
          for (let b = 0; b < 58; b++) {
            if (idx >= bookCount) break;
            const bz = -7.6 + b * 0.255;
            dummy.position.set(wx, by, bz);
            dummy.rotation.set(0, Math.PI / 2, (hash01(idx * 2.3) - 0.5) * 0.06);
            dummy.scale.set(0.86 + hash01(idx) * 0.32, 0.82 + hash01(idx + 9) * 0.32, 1);
            dummy.updateMatrix();
            inst.setMatrixAt(idx, dummy.matrix);
            col.set(palette[idx % palette.length]);
            inst.setColorAt(idx, col);
            idx++;
          }
        }
      });

      // Rear wall 2-story bookshelves (Z = -7.85)
      for (let tier = 0; tier < 6; tier++) {
        const by = 0.58 + tier * 0.94;
        for (let b = 0; b < 58; b++) {
          if (idx >= bookCount) break;
          const bx = -4.6 + b * 0.16;
          if (Math.abs(bx) < 2.35 && by > 1.7 && by < 4.7) continue;
          dummy.position.set(bx, by, -7.85);
          dummy.rotation.set(0, 0, (hash01(idx * 3.7) - 0.5) * 0.04);
          dummy.scale.set(0.86 + hash01(idx) * 0.3, 0.82 + hash01(idx + 5) * 0.32, 1);
          dummy.updateMatrix();
          inst.setMatrixAt(idx, dummy.matrix);
          col.set(palette[(idx + 2) % palette.length]);
          inst.setColorAt(idx, col);
          idx++;
        }
      }

      inst.count = idx;
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
    }
    return () => {
      rugTex.dispose();
      mahoganyMat.dispose();
      softBeamMat.dispose();
      lampConeMat.dispose();
      bankerShadeMat.dispose();
      chandelierBulbMat.dispose();
      shelfStripMat.dispose();
      skylightMat.dispose();
      dustGeo.dispose();
    };
  }, [bankerShadeMat, chandelierBulbMat, dustGeo, lampConeMat, mahoganyMat, rugTex, shelfStripMat, skylightMat, softBeamMat]);

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

    softBeamMat.uniforms.uTime.value = t;
    softBeamMat.uniforms.uOpacity.value = 0.056 * cal.beamOpacity;
    softBeamMat.uniforms.uBassHit.value = isPlaying ? 0.2 + env.bass * 0.65 * beamMod : 0.16;
    lampConeMat.uniforms.uTime.value = t;
    lampConeMat.uniforms.uOpacity.value = 0.048 * cal.beamOpacity;
    lampConeMat.uniforms.uBassHit.value = isPlaying ? 0.18 + env.mid * 0.7 * beamMod : 0.16;

    bankerShadeMat.emissiveIntensity = isPlaying
      ? 0.56 + (env.mid * 0.52 + env.halfBeatPulse * 0.25) * beamMod
      : 0.68;
    chandelierBulbMat.emissiveIntensity = isPlaying
      ? 0.85 + (env.mid * 0.55 + env.beatPulse * 0.3) * beamMod
      : 1.05;
    shelfStripMat.emissiveIntensity = isPlaying
      ? 0.6 + (env.bass * 0.45 + env.beatPulse * 0.22) * beamMod
      : 0.72;
    skylightMat.emissiveIntensity = isPlaying ? 0.24 + env.bass * 0.24 * beamMod : 0.26;

    if (leftChandelierLightRef.current) {
      const base = 2.6 * pracMult;
      leftChandelierLightRef.current.intensity = isPlaying
        ? base * (0.94 + env.bass * 0.22 * beamMod + env.beatPulse * 0.1 * keyMod)
        : base;
      leftChandelierLightRef.current.decay = cal.lightDecay;
    }
    if (rightChandelierLightRef.current) {
      const base = 2.6 * pracMult;
      rightChandelierLightRef.current.intensity = isPlaying
        ? base * (0.94 + env.mid * 0.22 * beamMod + env.halfBeatPulse * 0.1 * keyMod)
        : base;
      rightChandelierLightRef.current.decay = cal.lightDecay;
    }
    if (floorLampLightRef.current) {
      const base = 2.2 * pracMult;
      floorLampLightRef.current.intensity = isPlaying
        ? base * (0.94 + env.mid * 0.25 * beamMod)
        : base;
      floorLampLightRef.current.decay = Math.max(1.5, cal.lightDecay);
    }
    if (floorLampShadeMatRef.current) {
      floorLampShadeMatRef.current.emissiveIntensity = isPlaying
        ? 0.72 + (env.mid * 0.5 + env.beatPulse * 0.22) * beamMod
        : 0.84;
    }
    if (keySpotRef.current) {
      const base = cal.keyIntensity;
      keySpotRef.current.intensity = isPlaying
        ? base * (0.95 + (env.mid * 0.2 + env.beatPulse * 0.08) * keyMod)
        : base;
    }
    if (rimSpotRef.current) {
      const base = cal.rimIntensity;
      rimSpotRef.current.intensity = isPlaying
        ? base * (0.93 + (env.bass * 0.35 + env.beatPulse * 0.15) * beamMod)
        : base;
    }
    if (fillSpotRef.current) {
      const base = cal.fillIntensity;
      fillSpotRef.current.intensity = isPlaying
        ? base * (0.96 + env.mid * 0.16 * keyMod)
        : base;
    }
    if (overheadFillRef.current) {
      const base = cal.fillIntensity * 0.75;
      overheadFillRef.current.intensity = isPlaying
        ? base * (0.96 + env.bass * 0.16 * keyMod)
        : base;
    }
    if (portalScreenMatRef.current) {
      portalScreenMatRef.current.emissiveIntensity = isPlaying ? 0.22 + env.mid * 0.16 * beamMod : 0.24;
    }
    if (dustRef.current) {
      dustRef.current.rotation.y = Math.sin(t * (isPlaying ? 0.22 : 0.1)) * (0.06 + env.mid * 0.04);
      dustRef.current.position.y = Math.sin(t * (isPlaying ? 0.65 : 0.35)) * (0.08 + env.mid * 0.04);
    }
  });

  // 6 Foreground Oak Reading Tables (3 per side)
  const readingTables = useMemo<Array<[number, number]>>(
    () => [
      [-2.65, -2.2],
      [2.65, -2.2],
      [-2.65, 0.3],
      [2.65, 0.3],
      [-2.65, 2.8],
      [2.65, 2.8]
    ],
    []
  );

  const narratorTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 1.4, -5.5);
    return o;
  }, []);

  return (
    <group>
      {/* 1. Reflective woodPlanksPBR Parquet Floor */}
      {renderOwnFloor && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.5]} receiveShadow>
          <planeGeometry args={[12.5, 18.5]} />
          <MeshReflectorMaterial
            map={floorTex.map}
            normalMap={floorTex.normalMap}
            roughnessMap={floorTex.roughnessMap}
            resolution={256}
            blur={[120, 40]}
            mixBlur={1}
            mixStrength={1.65}
            mirror={0.5}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            depthScale={1.2}
            roughness={0.38}
            color="#a67954"
            metalness={0.12}
          />
        </mesh>
      )}

      {/* 2. Rich persianRugPBR Runner along Center Aisle (X = -1.35 to +1.35) with Gold Fringe Trim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0.5]} receiveShadow>
        <planeGeometry args={[2.7, 13.6]} />
        <meshStandardMaterial
          map={rugTex.map}
          bumpMap={rugTex.bumpMap}
          bumpScale={0.025}
          roughnessMap={rugTex.roughnessMap}
          roughness={0.72}
          metalness={0.04}
        />
      </mesh>

      {/* 3. Arched Coffered Wood Ceiling & Subdued Warm Skylights (Y = 6.8) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6.8, 0.5]} material={mahoganyMat}>
        <planeGeometry args={[12.5, 18.5]} />
      </mesh>
      {[-6.2, -3.4, -0.6, 2.2, 5.0].map((az) => (
        <mesh key={az} position={[0, 6.2, az]} material={mahoganyMat} castShadow>
          <torusGeometry args={[5.2, 0.17, 12, 36, Math.PI]} />
        </mesh>
      ))}
      {[-4.8, -2.0, 0.8, 3.6].map((sz) => (
        <group key={sz} position={[0, 6.72, sz]}>
          <RoundedBox args={[3.2, 0.08, 1.56]} radius={0.02} smoothness={3} material={mahoganyMat} />
          <mesh position={[0, -0.045, 0]} rotation={[Math.PI / 2, 0, 0]} material={skylightMat}>
            <planeGeometry args={[2.9, 1.32]} />
          </mesh>
        </group>
      ))}

      {/* Enclosing Mahogany Walls */}
      <mesh position={[0, 3.4, -8.7]} material={mahoganyMat} receiveShadow>
        <planeGeometry args={[12.5, 6.8]} />
      </mesh>
      <mesh position={[0, 3.4, 9.7]} rotation={[0, Math.PI, 0]} material={mahoganyMat}>
        <planeGeometry args={[12.5, 6.8]} />
      </mesh>
      <mesh position={[-5.7, 3.4, 0.5]} rotation={[0, Math.PI / 2, 0]} material={mahoganyMat} receiveShadow>
        <planeGeometry args={[18.5, 6.8]} />
      </mesh>
      <mesh position={[5.7, 3.4, 0.5]} rotation={[0, -Math.PI / 2, 0]} material={mahoganyMat} receiveShadow>
        <planeGeometry args={[18.5, 6.8]} />
      </mesh>

      {/* 4. Towering 2-Story Mahogany Bookshelves (X = ±5.0 and Z = -8.1) + Mezzanine Balustrades & Brass Ladders */}
      {[-5.0, 5.0].map((wx) => {
        const inward = wx > 0 ? -1 : 1;
        return (
          <group key={wx} position={[wx, 0, -0.1]}>
            <RoundedBox args={[0.54, 6.4, 15.8]} radius={0.03} smoothness={3} position={[0, 3.2, 0]} material={mahoganyMat} receiveShadow castShadow />
            {[0.44, 1.38, 2.32, 3.26, 4.2, 5.14, 6.08].map((sy) => (
              <group key={sy} position={[inward * 0.22, sy, 0]}>
                <RoundedBox args={[0.44, 0.055, 15.6]} radius={0.012} smoothness={3} castShadow receiveShadow>
                  <meshStandardMaterial color="#3b1f10" roughness={0.42} />
                </RoundedBox>
                <mesh position={[inward * 0.14, -0.032, 0]} material={shelfStripMat}>
                  <boxGeometry args={[0.032, 0.016, 15.2]} />
                </mesh>
              </group>
            ))}
            {/* 2nd-Story Gallery Walkway & Brass Balustrade */}
            <RoundedBox args={[0.74, 0.14, 15.6]} radius={0.025} smoothness={3} position={[inward * 0.6, 3.3, 0]} material={mahoganyMat} castShadow receiveShadow />
            <RoundedBox args={[0.06, 0.055, 15.6]} radius={0.015} smoothness={3} position={[inward * 0.9, 4.05, 0]} castShadow>
              <meshStandardMaterial color="#d4af37" metalness={0.92} roughness={0.2} />
            </RoundedBox>
            {Array.from({ length: 20 }).map((_, bIdx) => (
              <mesh key={bIdx} position={[inward * 0.9, 3.68, -7.2 + bIdx * 0.76]}>
                <cylinderGeometry args={[0.014, 0.018, 0.68, 8]} />
                <meshStandardMaterial color="#b48a3e" metalness={0.88} roughness={0.24} />
              </mesh>
            ))}
            {/* Rolling Brass Library Ladders */}
            {[-3.4, 1.6].map((lzPos) => (
              <group key={lzPos} position={[inward * 0.42, 0, lzPos]} rotation={[0, 0, inward * 0.12]}>
                {[-0.17, 0.17].map((lz) => (
                  <mesh key={lz} position={[0, 2.4, lz]} castShadow>
                    <cylinderGeometry args={[0.022, 0.022, 4.8, 10]} />
                    <meshStandardMaterial color="#c89d42" metalness={0.92} roughness={0.2} />
                  </mesh>
                ))}
                {Array.from({ length: 12 }).map((_, rIdx) => (
                  <mesh key={rIdx} position={[0, 0.34 + rIdx * 0.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.016, 0.016, 0.34, 8]} />
                    <meshStandardMaterial color="#b48a3e" metalness={0.9} roughness={0.22} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        );
      })}

      <group position={[0, 0, -8.1]}>
        <RoundedBox args={[10.4, 6.4, 0.52]} radius={0.03} smoothness={3} position={[0, 3.2, 0]} material={mahoganyMat} receiveShadow />
        {[0.44, 1.38, 2.32, 3.26, 4.2, 5.14, 6.08].map((sy) => (
          <RoundedBox key={sy} args={[10.0, 0.055, 0.42]} radius={0.012} smoothness={3} position={[0, sy, 0.25]}>
            <meshStandardMaterial color="#3b1f10" roughness={0.42} />
          </RoundedBox>
        ))}
      </group>

      {/* Instanced Dark Antique Leather Books */}
      <instancedMesh ref={bookMeshRef} args={[undefined, undefined, bookCount]} frustumCulled={false} castShadow>
        <boxGeometry args={[0.085, 0.32, 0.2]} />
        <meshStandardMaterial roughness={0.52} metalness={0.14} />
      </instancedMesh>

      {/* 5. Ornate Mahogany-Framed Archival OLED Portal at [0, 3.2, -7.5] (4.2 x 2.4) */}
      <group
        position={[0, 3.2, -7.5]}
        onClick={(e) => {
          e.stopPropagation();
          onInteractHotspot?.('toggle_play');
        }}
      >
        <RoundedBox args={[4.56, 2.76, 0.14]} radius={0.04} smoothness={4} position={[0, 0, -0.07]} castShadow>
          <meshStandardMaterial color="#2b1408" roughness={0.35} />
        </RoundedBox>
        <RoundedBox args={[4.36, 2.56, 0.09]} radius={0.03} smoothness={4} position={[0, 0, -0.02]} castShadow>
          <meshStandardMaterial color="#c89d42" roughness={0.2} metalness={0.92} />
        </RoundedBox>
        <mesh position={[0, 0, 0.04]}>
          <planeGeometry args={[4.2, 2.4]} />
          <meshStandardMaterial
            ref={portalScreenMatRef}
            map={archivalTexture}
            emissiveMap={archivalTexture}
            emissive="#ffe7ba"
            emissiveIntensity={0.24}
            roughness={0.22}
          />
        </mesh>
      </group>

      {/* 6. Narrator Sanctuary Platform ([0, 0, -5.5]) with Sculpted Chesterfield Armchair, Lectern, Vintage Mic & Globes */}
      <group position={[0, 0, -5.5]}>
        <RoundedBox args={[3.7, 0.4, 2.4]} radius={0.035} smoothness={4} position={[0, 0.2, 0]} receiveShadow castShadow material={mahoganyMat} />
        <RoundedBox args={[3.74, 0.035, 2.44]} radius={0.012} smoothness={3} position={[0, 0.385, 0]}>
          <meshStandardMaterial color="#d4af37" metalness={0.92} roughness={0.2} />
        </RoundedBox>

        {/* Sculpted Oxblood Leather Chesterfield Armchair */}
        <SculptedChesterfieldArmchair position={[0, 0.4, -0.1]} />

        {/* Carved Walnut Lectern + Open Illuminated Manuscript */}
        <group position={[0.64, 0.4, 0.58]} rotation={[0, -0.24, 0]}>
          <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.18, 0.22, 0.08, 16]} />
            <meshStandardMaterial color="#2b1408" roughness={0.36} />
          </mesh>
          <mesh position={[0, 0.48, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.075, 0.88, 16]} />
            <meshStandardMaterial color="#3b1f0e" roughness={0.38} />
          </mesh>
          <RoundedBox args={[0.58, 0.055, 0.42]} radius={0.018} smoothness={3} position={[0, 0.96, 0]} rotation={[0.32, 0, 0]} castShadow>
            <meshStandardMaterial color="#4a2813" roughness={0.34} />
          </RoundedBox>
          <RoundedBox args={[0.44, 0.03, 0.28]} radius={0.008} smoothness={2} position={[0, 1.0, 0]} rotation={[0.32, 0, 0]}>
            <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={0.35} />
          </RoundedBox>
        </group>

        {/* Walnut Side Table + Vintage Brass Audiobook Condenser Microphone */}
        <group position={[-0.64, 0.4, 0.48]}>
          <mesh position={[0, 0.56, 0]} castShadow receiveShadow material={mahoganyMat}>
            <cylinderGeometry args={[0.24, 0.24, 0.045, 20]} />
          </mesh>
          <mesh position={[0, 0.28, 0]} castShadow material={mahoganyMat}>
            <cylinderGeometry args={[0.035, 0.08, 0.54, 14]} />
          </mesh>
          {/* Vintage Brass Desk Mic */}
          <mesh position={[0, 0.6, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.075, 0.025, 14]} />
            <meshStandardMaterial color="#d4af37" metalness={0.94} roughness={0.18} />
          </mesh>
          <mesh position={[0, 0.72, 0]} castShadow>
            <cylinderGeometry args={[0.01, 0.012, 0.22, 10]} />
            <meshStandardMaterial color="#d4af37" metalness={0.94} roughness={0.18} />
          </mesh>
          <mesh position={[0, 0.85, 0]} rotation={[0.18, 0.2, 0]} castShadow>
            <capsuleGeometry args={[0.026, 0.05, 8, 14]} />
            <meshStandardMaterial color="#e5c158" metalness={0.95} roughness={0.15} />
          </mesh>
        </group>

        {/* Antique Brass Reading Floor Lamp */}
        <group position={[-1.12, 0.4, -0.18]}>
          <mesh position={[0, 0.03, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.2, 0.06, 18]} />
            <meshStandardMaterial color="#c89d42" metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.84, 0]} castShadow>
            <cylinderGeometry args={[0.022, 0.028, 1.62, 12]} />
            <meshStandardMaterial color="#c89d42" metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.65, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.26, 0.26, 20, 1, true]} />
            <meshPhysicalMaterial
              ref={floorLampShadeMatRef}
              color="#fef3c7"
              emissive="#ffaa44"
              emissiveIntensity={0.95}
              roughness={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
          <pointLight ref={floorLampLightRef} color="#ffd894" intensity={2.8} decay={1.0} distance={9} position={[0, 1.52, 0]} />
        </group>

        {/* Flanking Antique Brass Terrestrial Globes */}
        <AntiqueTerrestrialGlobe position={[-1.42, 0.4, 0.72]} />
        <AntiqueTerrestrialGlobe position={[1.42, 0.4, 0.72]} />

        {/* 7-Part Antique Brass Acoustic Gramophone Hero Prop */}
        <AntiqueBrassGramophone position={[1.12, 0.4, 0.02]} isPlaying={isPlaying} isActive={isActive} />
      </group>

      <points ref={dustRef} geometry={dustGeo}>
        <pointsMaterial color="#fde68a" size={0.032} transparent opacity={0.52} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      {/* 7. 6 Heritage Oak & Green-Leather Reading Desks with Dual Emeralite Banker Lamps */}
      {readingTables.map(([tx, tz], idx) => (
        <HeritageReadingTableGroup
          key={idx}
          position={[tx, 0, tz]}
          mahoganyMat={mahoganyMat}
          lampConeMat={lampConeMat}
          bankerShadeMat={bankerShadeMat}
        />
      ))}

      {/* 8. Two Warm Golden Chandeliers at [-3.2, 5.8, -1.0] and [3.2, 5.8, -1.0] */}
      <BrassChandelierRing position={[-3.2, 5.8, -1.0]} lightRef={leftChandelierLightRef} bulbMat={chandelierBulbMat} />
      <BrassChandelierRing position={[3.2, 5.8, -1.0]} lightRef={rightChandelierLightRef} bulbMat={chandelierBulbMat} />

      {/* 9. Physical Oxford Chiaroscuro Three-Point Lighting */}
      <primitive object={narratorTarget} />
      {/* 1. Key Light onto Narrator & Center Desk */}
      <spotLight
        ref={keySpotRef}
        color={cal.keyColor}
        intensity={cal.keyIntensity}
        decay={cal.lightDecay}
        distance={20}
        angle={0.54}
        penumbra={0.8}
        position={[2.6, 5.8, 2.0]}
        target={narratorTarget}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
      {/* 2. Warm Rim / Backlight separating narrator silhouettes from mahogany stacks */}
      <spotLight
        ref={rimSpotRef}
        color={cal.rimColor}
        intensity={cal.rimIntensity}
        decay={cal.lightDecay}
        distance={18}
        angle={0.65}
        penumbra={0.82}
        position={[0, 5.0, -6.8]}
        target={narratorTarget}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
        shadow-radius={3}
      />
      {/* 3. Subtle Cool-Neutral Archive Fill Light */}
      <spotLight
        ref={fillSpotRef}
        color={cal.fillColor}
        intensity={cal.fillIntensity}
        decay={cal.lightDecay}
        distance={18}
        angle={0.72}
        penumbra={0.92}
        position={[-2.6, 5.4, 2.2]}
        target={narratorTarget}
      />
      <mesh position={[0, 3.6, -4.4]} rotation={[0.25, 0, 0]} material={softBeamMat}>
        <cylinderGeometry args={[0.14, 1.3, 5.6, 20, 1, true]} />
      </mesh>
      <pointLight
        ref={overheadFillRef}
        color={cal.fillColor}
        intensity={cal.fillIntensity * 0.75}
        decay={cal.lightDecay}
        distance={14}
        position={[0, 4.4, 2.2]}
      />
      <hemisphereLight args={[cal.hemiSkyColor, cal.hemiGroundColor, cal.hemiIntensity]} />
    </group>
  );
}

function LibraryNarratorAndReaders({
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
  const readers = useMemo(() => {
    const tables: Array<[number, number]> = [
      [-2.65, -2.2],
      [2.65, -2.2],
      [-2.65, 0.3],
      [2.65, 0.3],
      [-2.65, 2.8],
      [2.65, 2.8]
    ];
    const arr: Array<{ key: string; pos: [number, number, number]; rotY: number; archIdx: number; female: boolean }> = [];
    let idx = 0;
    tables.forEach(([tx, tz]) => {
      [-0.62, 0.62].forEach((cx) => {
        [-0.86, 0.86].forEach((cz) => {
          if (idx >= 18) return;
          arr.push({
            key: `lib-reader-${idx}`,
            pos: [tx + cx, 0, tz + cz],
            rotY: cz < 0 ? 0 : Math.PI,
            archIdx: (idx * 3 + 2) % 22,
            female: idx % 2 === 0
          });
          idx++;
        });
      });
    });
    return arr;
  }, []);

  const peerMap = useMemo(() => {
    // Prioritize readers seated nearest the central sightline and Sanctuary narrator
    const innerReaders = [...readers].sort(
      (a, b) => Math.hypot(a.pos[0], a.pos[2] - 0.3) - Math.hypot(b.pos[0], b.pos[2] - 0.3)
    );
    const orderedSlots = [
      { key: 'lib-narrator', isFemale: false },
      ...innerReaders.map((r) => ({ key: r.key, isFemale: r.female }))
    ];
    return assignPeersToCastSlots(connectedPeers, orderedSlots, latestTrackDeviceName);
  }, [connectedPeers, latestTrackDeviceName, readers]);

  const narratorPeer = peerMap.get('lib-narrator');

  return (
    <group>
      <RiggedHumanAvatar
        modelUrl={manifest.dancerMale}
        mocapClips={mocapClips}
        archetypeIndex={11}
        position={[0, 0.4, -5.54]}
        rotationY={0}
        targetHeight={1.78}
        activity="narrate"
        seated
        seatHeight={0.47}
        phaseOffset={0.3}
        isPlaying={isPlaying}
        bpm={bpm}
        audioSyncBand="mid"
        castShadow
        isActive={isActive}
        onClick={() => onInteractHotspot?.('toggle_play')}
      >
        {narratorPeer && (
          <PeerOverheadBadge
            peer={narratorPeer.peer}
            isLatestDJ={narratorPeer.isLatestDJ}
            headHeight={1.58}
          />
        )}
      </RiggedHumanAvatar>

      {readers.map((l, idx) => {
        const assigned = peerMap.get(l.key);
        return (
          <RiggedHumanAvatar
            key={l.key}
            modelUrl={l.female ? manifest.dancerFemale : manifest.dancerMale}
            mocapClips={mocapClips}
            archetypeIndex={l.archIdx}
            position={l.pos}
            rotationY={l.rotY}
            targetHeight={1.72}
            activity="read"
            seated
            seatHeight={0.46}
            phaseOffset={idx * 1.37}
            speedMult={0.8 + hash01(idx) * 0.25}
            isPlaying={isPlaying}
            bpm={bpm}
            audioSyncBand="mid"
            castShadow
            isActive={isActive}
          >
            {assigned && (
              <PeerOverheadBadge
                peer={assigned.peer}
                isLatestDJ={assigned.isLatestDJ}
                headHeight={1.54}
              />
            )}
          </RiggedHumanAvatar>
        );
      })}
    </group>
  );
}

function LibraryLoadedBody(
  props: SharedRoomSceneProps & { manifest: ConcertAssetManifest }
) {
  const mocapClips = useLoadedMocapClips(props.manifest.mocapAnimUrls);
  const isActive = props.isActive !== false;
  return (
    <>
      <LibraryArchitectureAndProps
        isPlaying={props.isPlaying}
        bpm={props.bpm}
        pulseIntensity={props.pulseIntensity}
        lightingFxMode={props.lightingFxMode}
        fxBurstSeq={props.fxBurstSeq}
        trackTitle={props.trackTitle || 'فصل یکم: تالار کتابخانه سلطنتی'}
        trackArtist={props.trackArtist || 'Oxford Grand Archive'}
        trackCoverUrl={props.trackCoverUrl}
        trackAccentHex={props.trackAccentHex || '#eab308'}
        lightingCalibration={props.lightingCalibration}
        isActive={isActive}
        renderOwnFloor={props.renderOwnFloor !== false}
        onInteractHotspot={props.onInteractHotspot}
      />
      <ContactShadows position={[0, 0.01, -1.2]} opacity={0.85} scale={16} blur={2.0} far={3.5} resolution={256} frames={1} color="#120a04" />
      <LibraryNarratorAndReaders
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

export function LibraryRoomContent(
  props: SharedRoomSceneProps & { manifest: ConcertAssetManifest | null }
) {
  const { manifest, isActive = true } = props;
  if (!manifest) return null;
  return (
    <React.Suspense fallback={null}>
      {manifest.mocapAnimUrls.length > 0 ? (
        <LibraryLoadedBody {...props} manifest={manifest} />
      ) : (
        <>
          <LibraryArchitectureAndProps
            isPlaying={props.isPlaying}
            bpm={props.bpm}
            pulseIntensity={props.pulseIntensity}
            lightingFxMode={props.lightingFxMode}
            fxBurstSeq={props.fxBurstSeq}
            trackTitle={props.trackTitle || 'فصل یکم: تالار کتابخانه سلطنتی'}
            trackArtist={props.trackArtist || 'Oxford Grand Archive'}
            trackCoverUrl={props.trackCoverUrl}
            trackAccentHex={props.trackAccentHex || '#eab308'}
            lightingCalibration={props.lightingCalibration}
            isActive={isActive}
            renderOwnFloor={props.renderOwnFloor !== false}
            onInteractHotspot={props.onInteractHotspot}
          />
          <ContactShadows position={[0, 0.01, -1.2]} opacity={0.85} scale={16} blur={2.0} far={3.5} resolution={256} frames={1} color="#120a04" />
          <LibraryNarratorAndReaders
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

export function LibraryRoomScene(props: SharedRoomSceneProps) {
  const manifest = useConcertAssetManifest();
  return (
    <RoomCanvasFrame
      roomPreset="library"
      bgHex="#120b06"
      fogDensity={0.0055}
      ambientColor="#1f150c"
      ambientIntensity={0.22}
      lightingFxMode={props.lightingFxMode}
      envIntensity={0.36}
      lightingCalibration={props.lightingCalibration}
      initialCam={LIBRARY_CAMERA_SPEC[props.cameraPreset] || LIBRARY_CAMERA_SPEC.cinematic}
    >
      <LockedSymmetricalCameraRig
        cameraPreset={props.cameraPreset}
        moveInputRef={props.moveInputRef}
        spec={LIBRARY_CAMERA_SPEC}
      />
      <LibraryRoomContent {...props} manifest={manifest} />
    </RoomCanvasFrame>
  );
}
