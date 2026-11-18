import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Coffee,
  Cpu,
  Disc3,
  Headphones,
  Layers,
  Mic,
  Music,
  Pause,
  Play,
  Radio,
  SkipForward,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react';
import type {
  ClubSubPreset,
  LanguageCode,
  PrototypeMediaItem,
  VenueRoomId
} from '../types';
import { inferMediaDomain } from '../prototypeData';
import { djAudioController, type DjDeckConfig } from '../djAudioEngine';
import { useT } from '../i18n';
import { formatDuration } from '../components/UiPrimitives';

interface FiveVenues3DStageProps {
  catalog: PrototypeMediaItem[];
  lang: LanguageCode;
  activeRoom: VenueRoomId;
  onChangeRoom: (room: VenueRoomId) => void;
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onPlayFullScreen: (item: PrototypeMediaItem) => void;
  onOpenDjStudio: (item: PrototypeMediaItem) => void;
  onBackToHub?: () => void;
}

type LaserShowMode = 'auto_bass' | 'strobe_rave' | 'cyber_duotone' | 'warm_gold';
type CameraAnglePreset = 'wide' | 'stage_close' | 'floor_pit' | 'orbit';

interface VenueRoomMeta {
  id: VenueRoomId;
  titleFa: string;
  titleEn: string;
  subtitleFa: string;
  subtitleEn: string;
  badgeFa: string;
  badgeEn: string;
  accentHex: string;
  previewImage: string;
}

export const FIVE_VENUE_ROOMS: VenueRoomMeta[] = [
  {
    id: 'cafe',
    titleFa: 'اتاق کافه',
    titleEn: 'Cafe & Endless DJ Saloon',
    subtitleFa: 'موسیقی دی‌جی و طنین کافه‌ای مداوم بدون تمام شدن',
    subtitleEn: 'Endless non-stop cafe DJ radio, live upright piano & warm sunbeams',
    badgeFa: 'پخش ۲۴/۷ بی‌وقفه کافه',
    badgeEn: '24/7 Non-Stop Cafe Stream',
    accentHex: '#F5B942',
    previewImage: '/assets/aistudio/IMG_4316_9c38956d.jpeg'
  },
  {
    id: 'concert',
    titleFa: 'اتاق کنسرت',
    titleEn: 'Live Concert Arena',
    subtitleFa: 'فول آلبوم‌ها و اجرای زنده خوانندگان محبوب روی سن',
    subtitleEn: 'Full artist albums & live stage performance with arena light beams',
    badgeFa: 'فول آلبوم و اجرای زنده',
    badgeEn: 'Full Albums & Live Stage',
    accentHex: '#D946EF',
    previewImage: '/assets/aistudio/IMG_4317_eedef0b3.jpeg'
  },
  {
    id: 'party',
    titleFa: 'اتاق پارتی',
    titleEn: '3D Club & Disco Rave',
    subtitleFa: 'موسیقی‌های بیس‌دار، کلاب‌های مختلف و رقص نور حساس به بیس',
    subtitleEn: 'Bass-heavy club & disco rooms with real-time beat-reactive lasers & strobes',
    badgeFa: 'رقص نور زنده با بیس (DMX)',
    badgeEn: 'Bass-Synced Lasers & Disco',
    accentHex: '#00F0FF',
    previewImage: '/assets/aistudio/IMG_4318_265bece3.jpeg'
  },
  {
    id: 'library',
    titleFa: 'کتابخانه صوتی',
    titleEn: '3D Audiobook Sanctuary',
    subtitleFa: 'جهانی از کتاب‌های صوتی و روایت‌های شنیدنی در تالار چوبی',
    subtitleEn: 'Immersive 3D wooden library of narrated audiobooks & chapters',
    badgeFa: 'روایت و کتاب صوتی',
    badgeEn: 'Narrated Audiobooks',
    accentHex: '#EAB308',
    previewImage:
      'https://images.unsplash.com/photo-1507842229356-51c61504d3ab?auto=format&fit=crop&w=900&q=82'
  },
  {
    id: 'podcast',
    titleFa: 'اتاق پادکست',
    titleEn: 'Live Podcast Studio',
    subtitleFa: 'گفتگوهای زنده و پادکست‌های در حال ساخت در استودیو آکوستیک',
    subtitleEn: '3D acoustic broadcast room with live host recording at the studio desk',
    badgeFa: 'استودیو ضبط زنده (ON AIR)',
    badgeEn: 'Live Studio Recording',
    accentHex: '#A855F7',
    previewImage:
      'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=900&q=82'
  }
];

const CLUB_SUB_PRESETS: Array<{
  id: ClubSubPreset;
  fa: string;
  en: string;
  descFa: string;
  descEn: string;
  color: string;
}> = [
  {
    id: 'cyber_club',
    fa: 'کلاب سایبرپانک (تکنو و لیزر)',
    en: 'Cyber Techno Club',
    descFa: 'دیوارهای بتنی، ساب‌ووفرهای تپنده و لیزرهای فیروزه‌ای/ارغوانی',
    descEn: 'Concrete vault, pulsing subwoofers & cyan/magenta lasers',
    color: '#00F0FF'
  },
  {
    id: 'neon_disco',
    fa: 'دیسکوی نئونی (گوی آینه‌ای و پیست رقص)',
    en: 'Neon Mirror Disco',
    descFa: 'گوی دیسکوی چرخان، کاشی‌های نوری کف و پرتوهای طلایی/صورتی',
    descEn: 'Spinning mirror disco ball & reactive LED dancefloor tiles',
    color: '#EC4899'
  },
  {
    id: 'laser_arena',
    fa: 'آرنای لیزر و استروب سنگین',
    en: 'Heavy Strobe Laser Arena',
    descFa: 'قفس لیزری سبز و بنفش با فلش‌های استروب هماهنگ با ضرب بیس',
    descEn: 'High-voltage emerald/violet laser cage with bass strobe',
    color: '#10B981'
  }
];

// Reusable math temporaries outside render loop (zero GC in rAF)
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();
const _smoothLookAt = new THREE.Vector3(0, 2.2, -4);
const _tempColor = new THREE.Color();

function createLedMatrixTexture(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture };
}

export function FiveVenues3DStage({
  catalog,
  activeRoom,
  onChangeRoom,
  onOpenDetail,
  onPlayFullScreen,
  onOpenDjStudio,
  onBackToHub
}: FiveVenues3DStageProps) {
  const { t } = useT();
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const [clubPreset, setClubPreset] = useState<ClubSubPreset>('cyber_club');
  const [laserMode, setLaserMode] = useState<LaserShowMode>('auto_bass');
  const [cameraPreset, setCameraPreset] = useState<CameraAnglePreset>('wide');
  const [bassSensitivity, setBassSensitivity] = useState<number>(1.35);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [endlessRadioMode, setEndlessRadioMode] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [showTechModal, setShowTechModal] = useState<boolean>(false);
  const [liveBassPct, setLiveBassPct] = useState<number>(0);

  // Filter tracks appropriate for each of the 5 rooms
  const roomPlaylist = useMemo(() => {
    if (activeRoom === 'cafe') {
      // Cafe: chill music, nocturnal jazz, lo-fi, acoustic/santoor
      const list = catalog.filter(
        (item) =>
          inferMediaDomain(item) === 'music' &&
          ((item.bpm && item.bpm <= 115) ||
            item.id === 'music-02' ||
            item.id === 'music-05' ||
            item.id === 'music-04' ||
            item.id === 'music-08')
      );
      return list.length > 0 ? list : catalog.filter((i) => inferMediaDomain(i) === 'music');
    }
    if (activeRoom === 'concert') {
      // Concert: full albums, orchestral, synthwave anthems, live stage pieces
      const list = catalog.filter(
        (item) =>
          inferMediaDomain(item) === 'music' &&
          (item.id === 'music-04' ||
            item.id === 'music-01' ||
            item.id === 'music-07' ||
            item.id === 'music-08' ||
            item.id === 'music-02')
      );
      return list.length > 0 ? list : catalog.filter((i) => inferMediaDomain(i) === 'music');
    }
    if (activeRoom === 'party') {
      // Party / Club: high BPM bass-heavy tracks
      const list = catalog
        .filter((item) => inferMediaDomain(item) === 'music')
        .sort((a, b) => (b.bpm || 110) - (a.bpm || 110));
      return list.length > 0 ? list : catalog;
    }
    if (activeRoom === 'library') {
      const list = catalog.filter((item) => inferMediaDomain(item) === 'audiobook');
      return list.length > 0 ? list : catalog;
    }
    // Podcast room
    const list = catalog.filter((item) => inferMediaDomain(item) === 'podcast');
    return list.length > 0 ? list : catalog;
  }, [catalog, activeRoom]);

  const [selectedTrackId, setSelectedTrackId] = useState<string>(() => roomPlaylist[0]?.id || 'music-01');

  // Keep selectedTrackId synced when switching rooms
  useEffect(() => {
    if (roomPlaylist.length > 0 && !roomPlaylist.some((i) => i.id === selectedTrackId)) {
      setSelectedTrackId(roomPlaylist[0].id);
    }
  }, [roomPlaylist, selectedTrackId]);

  const currentTrack = useMemo(
    () => roomPlaylist.find((i) => i.id === selectedTrackId) || roomPlaylist[0] || catalog[0],
    [roomPlaylist, selectedTrackId, catalog]
  );

  // Endless non-stop radio auto-advance for Cafe / Party / Concert
  useEffect(() => {
    if (!isPlaying || !endlessRadioMode || roomPlaylist.length < 2) return;
    const intervalMs = activeRoom === 'cafe' ? 28000 : 35000;
    const timer = window.setInterval(() => {
      setSelectedTrackId((prevId) => {
        const idx = roomPlaylist.findIndex((tItem) => tItem.id === prevId);
        const nextIdx = (idx + 1) % roomPlaylist.length;
        return roomPlaylist[nextIdx].id;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, endlessRadioMode, roomPlaylist, activeRoom]);

  // Sync live Web Audio synthesizer to the active room and track
  useEffect(() => {
    if (!currentTrack) return;
    const isBassRoom = activeRoom === 'party' || activeRoom === 'concert';
    const deckA: DjDeckConfig = {
      track: currentTrack,
      isPlaying,
      currentTimeSec: 0,
      pitchRate: activeRoom === 'party' ? 1.06 : activeRoom === 'cafe' ? 0.96 : 1.0,
      volume: 0.92,
      eqLowDb: isBassRoom ? 7.5 : activeRoom === 'cafe' ? 2.5 : 1.0,
      eqMidDb: activeRoom === 'podcast' || activeRoom === 'library' ? 4.5 : 1.5,
      eqHighDb: isBassRoom ? 4.0 : 1.5,
      filterSweep: 0,
      activeLoopBeats: null
    };
    const deckB: DjDeckConfig = {
      track: currentTrack,
      isPlaying: false,
      currentTimeSec: 0,
      pitchRate: 1,
      volume: 0,
      eqLowDb: 0,
      eqMidDb: 0,
      eqHighDb: 0,
      filterSweep: 0,
      activeLoopBeats: null
    };
    djAudioController.syncState(deckA, deckB, -1, 0.88, isMuted);
  }, [currentTrack, isPlaying, isMuted, activeRoom]);

  useEffect(() => {
    return () => {
      djAudioController.stopAll();
    };
  }, []);

  // Keyboard shortcut 'H' to toggle HUD dock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h' && document.activeElement?.tagName !== 'INPUT') {
        setDockCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleNextTrack = useCallback(() => {
    if (roomPlaylist.length === 0) return;
    const idx = roomPlaylist.findIndex((i) => i.id === currentTrack.id);
    const next = roomPlaylist[(idx + 1) % roomPlaylist.length];
    setSelectedTrackId(next.id);
    djAudioController.triggerFxPad(activeRoom === 'party' ? 'sub_drop' : 'velvet_reverb');
  }, [roomPlaylist, currentTrack, activeRoom]);

  // Mutable refs for the 60fps Three.js render loop
  const stateRef = useRef({
    activeRoom,
    clubPreset,
    laserMode,
    cameraPreset,
    bassSensitivity,
    isPlaying,
    currentTrack
  });
  stateRef.current = {
    activeRoom,
    clubPreset,
    laserMode,
    cameraPreset,
    bassSensitivity,
    isPlaying,
    currentTrack
  };

  // Manual pointer orbit offsets
  const pointerOrbitRef = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    yawOffset: 0,
    pitchOffset: 0
  });

  // Main Three.js WebGL Scene Setup & Bass-Reactive Render Loop
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070e);
    scene.fog = new THREE.FogExp2(0x05070e, 0.032);

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 140);
    camera.position.set(0, 3.2, 10.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Procedural Studio Reflection Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // Global Lights
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090b12, 0.55);
    hemiLight.position.set(0, 18, 0);
    scene.add(hemiLight);

    const keySpot = new THREE.SpotLight(0xffffff, 4.5, 45, Math.PI / 3, 0.65, 1.5);
    keySpot.position.set(0, 12, 4);
    keySpot.castShadow = !isSoftwareGl;
    scene.add(keySpot);
    scene.add(keySpot.target);

    const bassPulseLightLeft = new THREE.PointLight(0x00f0ff, 3.2, 24, 1.6);
    bassPulseLightLeft.position.set(-5.5, 4.2, -3);
    scene.add(bassPulseLightLeft);

    const bassPulseLightRight = new THREE.PointLight(0xec4899, 3.2, 24, 1.6);
    bassPulseLightRight.position.set(5.5, 4.2, -3);
    scene.add(bassPulseLightRight);

    const stageCenterLight = new THREE.PointLight(0xf5b942, 2.8, 22, 1.5);
    stageCenterLight.position.set(0, 4.8, -6.2);
    scene.add(stageCenterLight);

    // Shared Floor
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0b0f19,
      roughness: 0.16,
      metalness: 0.78
    });
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // ========================================================================
    // 1. PARTY / CLUB & DISCO GROUP (Matches IMG_4318_265bece3.jpeg)
    // ========================================================================
    const partyGroup = new THREE.Group();
    scene.add(partyGroup);

    // Concrete Club Side & Back Walls + Ceiling Pipes
    const clubWallMat = new THREE.MeshStandardMaterial({
      color: 0x121726,
      roughness: 0.65,
      metalness: 0.25
    });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 11, 0.5), clubWallMat);
    backWall.position.set(0, 5.5, -10.5);
    partyGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 24), clubWallMat);
    leftWall.position.set(-9.8, 5.5, 0);
    partyGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 24), clubWallMat);
    rightWall.position.set(9.8, 5.5, 0);
    partyGroup.add(rightWall);

    // Industrial Ceiling Conduits (Pipes)
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x263044,
      roughness: 0.3,
      metalness: 0.85
    });
    for (const xPos of [-8.2, -2.2, 2.2, 8.2]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 22, 14), pipeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(xPos, 9.6, -1);
      partyGroup.add(pipe);
    }

    // Elevated DJ Booth Stage & Desk
    const boothRiser = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 1.1, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x161b29, roughness: 0.4, metalness: 0.6 })
    );
    boothRiser.position.set(0, 0.55, -7.4);
    partyGroup.add(boothRiser);

    const djTableTop = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.14, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x22293e, roughness: 0.25, metalness: 0.8 })
    );
    djTableTop.position.set(0, 2.05, -6.8);
    partyGroup.add(djTableTop);

    const djLegLeft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 1.1), pipeMat);
    djLegLeft.position.set(-2.2, 1.55, -6.8);
    partyGroup.add(djLegLeft);
    const djLegRight = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 1.1), pipeMat);
    djLegRight.position.set(2.2, 1.55, -6.8);
    partyGroup.add(djLegRight);

    // 4 DJ Monitors on the Desk (like IMG_4318)
    const monitorScreenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (const mx of [-1.7, -0.95, 0.95, 1.7]) {
      const mon = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.06), monitorScreenMat);
      mon.position.set(mx, 2.38, -6.55);
      partyGroup.add(mon);
    }

    // Giant LED Dot-Matrix Wall behind DJ Booth
    const ledCanvasObj = createLedMatrixTexture();
    const ledWallMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 3.3),
      new THREE.MeshBasicMaterial({ map: ledCanvasObj.texture })
    );
    ledWallMesh.position.set(0, 5.4, -10.1);
    partyGroup.add(ledWallMesh);

    // Left & Right Heavy Club Subwoofers + Hanging Speaker Arrays (cones pulse with bass!)
    const wooferCones: THREE.Mesh[] = [];
    const speakerBoxMat = new THREE.MeshStandardMaterial({
      color: 0x0d111a,
      roughness: 0.5,
      metalness: 0.4
    });
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.7
    });

    const createSubwooferStack = (x: number, y: number, z: number, rotY: number) => {
      const stack = new THREE.Group();
      stack.position.set(x, y, z);
      stack.rotation.y = rotY;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.7, 1.3), speakerBoxMat);
      stack.add(cab);
      for (const cy of [-0.6, 0.6]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.46, 0.06, 12, 24),
          coneMat
        );
        ring.position.set(0, cy, 0.66);
        stack.add(ring);
        wooferCones.push(ring);
      }
      partyGroup.add(stack);
    };
    createSubwooferStack(-8.5, 1.35, -1.5, Math.PI / 3);
    createSubwooferStack(8.5, 1.35, -1.5, -Math.PI / 3);
    createSubwooferStack(-8.2, 6.8, -2.5, Math.PI / 4);
    createSubwooferStack(8.2, 6.8, -2.5, -Math.PI / 4);

    // Volumetric Laser Cones (8 beams sweeping and strobing on bass hits)
    const laserCones: Array<{
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      baseX: number;
      phase: number;
      side: number;
    }> = [];
    const coneGeo = new THREE.ConeGeometry(2.4, 13.5, 20, 1, true);
    coneGeo.translate(0, -6.75, 0);

    for (let i = 0; i < 8; i++) {
      const isLeft = i < 4;
      const mat = new THREE.MeshBasicMaterial({
        color: isLeft ? 0x00f0ff : 0xec4899,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(coneGeo, mat);
      const baseX = isLeft ? -3.4 + (i % 4) * 0.9 : 3.4 - (i % 4) * 0.9;
      mesh.position.set(baseX, 8.6, -6.5);
      partyGroup.add(mesh);
      laserCones.push({
        mesh,
        mat,
        baseX,
        phase: i * 0.85,
        side: isLeft ? -1 : 1
      });
    }

    // Spinning 3D Mirror Disco Ball & Reactive LED Dancefloor (for Neon Disco preset)
    const discoSubGroup = new THREE.Group();
    const discoBall = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.05,
        metalness: 0.98,
        emissive: 0xec4899,
        emissiveIntensity: 0.25
      })
    );
    discoBall.position.set(0, 7.6, -2.2);
    discoSubGroup.add(discoBall);

    const dancefloorTiles: Array<{ mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; idx: number }> = [];
    const tileGeo = new THREE.PlaneGeometry(1.35, 1.35);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        const tMat = new THREE.MeshStandardMaterial({
          color: 0x111827,
          emissive: (r + c) % 2 === 0 ? 0x00f0ff : 0xec4899,
          emissiveIntensity: 0.2,
          roughness: 0.2,
          metalness: 0.6,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });
        const tMesh = new THREE.Mesh(tileGeo, tMat);
        tMesh.rotation.x = -Math.PI / 2;
        tMesh.position.set(-3.75 + c * 1.5, 0.03, -3.5 + r * 1.5);
        discoSubGroup.add(tMesh);
        dancefloorTiles.push({ mesh: tMesh, mat: tMat, idx: r * 6 + c });
      }
    }
    partyGroup.add(discoSubGroup);

    // ========================================================================
    // 2. CONCERT HALL GROUP (Matches IMG_4317_eedef0b3.jpeg)
    // ========================================================================
    const concertGroup = new THREE.Group();
    concertGroup.visible = false;
    scene.add(concertGroup);

    // Multi-Tiered Side Balconies with Warm LED Strips
    const balconyMat = new THREE.MeshStandardMaterial({
      color: 0x1d162b,
      roughness: 0.45,
      metalness: 0.35
    });
    const balconyGlowMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    for (const side of [-1, 1]) {
      for (const tierY of [3.4, 6.4]) {
        const bal = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 18), balconyMat);
        bal.position.set(side * 9.2, tierY, -1.5);
        concertGroup.add(bal);

        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 18), balconyGlowMat);
        strip.position.set(side * 8.05, tierY, -1.5);
        concertGroup.add(strip);
      }
    }

    // Wide Concert Stage with Neon Purple Edge Trim
    const concertStage = new THREE.Mesh(
      new THREE.BoxGeometry(13.5, 1.2, 5.5),
      new THREE.MeshStandardMaterial({ color: 0x171124, roughness: 0.3, metalness: 0.5 })
    );
    concertStage.position.set(0, 0.6, -7.2);
    concertGroup.add(concertStage);

    const stageEdgeGlow = new THREE.Mesh(
      new THREE.BoxGeometry(13.6, 0.1, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xe879f9 })
    );
    stageEdgeGlow.position.set(0, 1.18, -4.44);
    concertGroup.add(stageEdgeGlow);

    // 3 Giant Stage LED Screens (Center + Left/Right Vertical Towers)
    const centerScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 3.8),
      new THREE.MeshBasicMaterial({ map: ledCanvasObj.texture })
    );
    centerScreen.position.set(0, 4.4, -9.6);
    concertGroup.add(centerScreen);

    for (const sx of [-5.2, 5.2]) {
      const sideScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 5.6),
        new THREE.MeshBasicMaterial({
          color: sx < 0 ? 0xc026d3 : 0xf59e0b,
          transparent: true,
          opacity: 0.85
        })
      );
      sideScreen.position.set(sx, 4.3, -9.2);
      concertGroup.add(sideScreen);
    }

    // 4 Band Members on Stage (Lead Singer, Guitarist, Drummer, Keyboardist)
    const bandSilhouetteMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.5,
      emissive: 0x3b0764,
      emissiveIntensity: 0.35
    });
    const bandMembers: THREE.Group[] = [];
    const bandPositions = [
      { x: 0, z: -5.6, role: 'singer' },
      { x: -2.6, z: -6.2, role: 'guitar' },
      { x: 0.9, z: -7.8, role: 'drums' },
      { x: 2.9, z: -6.4, role: 'keys' }
    ];
    for (const bp of bandPositions) {
      const g = new THREE.Group();
      g.position.set(bp.x, 1.2, bp.z);
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.25, 12), bandSilhouetteMat);
      torso.position.y = 0.62;
      g.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 14), bandSilhouetteMat);
      head.position.y = 1.42;
      g.add(head);
      concertGroup.add(g);
      bandMembers.push(g);
    }

    // Concert Overhead Spotlight Beams (10 crisscrossing beams)
    const concertBeams: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; idx: number }> = [];
    const concertBeamColors = [0xd946ef, 0xa855f7, 0xfacc15, 0xec4899, 0x38bdf8];
    for (let i = 0; i < 10; i++) {
      const bMat = new THREE.MeshBasicMaterial({
        color: concertBeamColors[i % concertBeamColors.length],
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const bMesh = new THREE.Mesh(coneGeo, bMat);
      bMesh.position.set(-4.5 + i * 1.0, 9.4, -7.8);
      concertGroup.add(bMesh);
      concertBeams.push({ mesh: bMesh, mat: bMat, idx: i });
    }

    // Cheering Audience Crowd in the Pit (22 animated silhouettes)
    const crowdMembers: Array<{ group: THREE.Group; phase: number; baseY: number }> = [];
    const crowdMat = new THREE.MeshStandardMaterial({
      color: 0x090b12,
      roughness: 0.7
    });
    for (let i = 0; i < 22; i++) {
      const cg = new THREE.Group();
      const row = Math.floor(i / 7);
      const col = i % 7;
      const cx = -5.4 + col * 1.8 + (row % 2) * 0.6;
      const cz = -2.2 + row * 1.65;
      cg.position.set(cx, 0, cz);

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 1.3, 10), crowdMat);
      body.position.y = 0.65;
      cg.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), crowdMat);
      head.position.y = 1.48;
      cg.add(head);

      // Raised cheering arm
      if (i % 2 === 0) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8), crowdMat);
        arm.position.set(0.26, 1.45, 0);
        arm.rotation.z = -0.35;
        cg.add(arm);
      }
      concertGroup.add(cg);
      crowdMembers.push({ group: cg, phase: i * 0.7, baseY: 0 });
    }

    // ========================================================================
    // 3. CAFE & SALOON GROUP (Matches IMG_4316_9c38956d.jpeg)
    // ========================================================================
    const cafeGroup = new THREE.Group();
    cafeGroup.visible = false;
    scene.add(cafeGroup);

    const woodWallMat = new THREE.MeshStandardMaterial({
      color: 0x452c1e,
      roughness: 0.72,
      metalness: 0.08
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: 0x2c1a11,
      roughness: 0.55,
      metalness: 0.12
    });

    const cafeBackWall = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 0.5), woodWallMat);
    cafeBackWall.position.set(0, 5, -9.5);
    cafeGroup.add(cafeBackWall);

    const cafeLeftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10, 20), woodWallMat);
    cafeLeftWall.position.set(-9.2, 5, 0);
    cafeGroup.add(cafeLeftWall);

    const cafeRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10, 20), woodWallMat);
    cafeRightWall.position.set(9.2, 5, 0);
    cafeGroup.add(cafeRightWall);

    // Glowing Paned Windows on Left Wall + Volumetric Golden Sunbeams
    const windowGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const sunbeams: THREE.Mesh[] = [];
    const sunbeamGeo = new THREE.ConeGeometry(2.6, 13, 16, 1, true);
    sunbeamGeo.translate(0, -6.5, 0);
    const sunbeamMat = new THREE.MeshBasicMaterial({
      color: 0xfde68a,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    for (const wz of [-5.2, -1.2, 2.8]) {
      const winPane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.6, 2.1), windowGlowMat);
      winPane.position.set(-8.9, 4.6, wz);
      cafeGroup.add(winPane);

      const beam = new THREE.Mesh(sunbeamGeo, sunbeamMat);
      beam.position.set(-8.6, 6.2, wz);
      beam.rotation.z = 0.78;
      cafeGroup.add(beam);
      sunbeams.push(beam);
    }

    // Upright Wooden Piano & Pianist on the Left (like IMG_4316)
    const pianoGroup = new THREE.Group();
    pianoGroup.position.set(-6.4, 0, 1.4);
    const pianoBody = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.5, 2.8), darkWoodMat);
    pianoBody.position.y = 1.25;
    pianoGroup.add(pianoBody);
    const keyBed = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.18, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.2 })
    );
    keyBed.position.set(0.75, 1.35, 0);
    pianoGroup.add(keyBed);
    // Pianist silhouette
    const pianistGroup = new THREE.Group();
    pianistGroup.position.set(1.45, 0, 0);
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.75, 12), darkWoodMat);
    stool.position.y = 0.37;
    pianistGroup.add(stool);
    const pianistTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.2, 12), darkWoodMat);
    pianistTorso.position.y = 1.3;
    pianistGroup.add(pianistTorso);
    const pianistHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), darkWoodMat);
    pianistHead.position.y = 2.08;
    pianistGroup.add(pianistHead);
    pianoGroup.add(pianistGroup);
    cafeGroup.add(pianoGroup);

    // 3 Round Wooden Cafe Tables in Center
    for (const [tx, tz] of [
      [-1.5, -2.5],
      [1.8, -0.5],
      [0.6, 2.6]
    ]) {
      const tbl = new THREE.Group();
      tbl.position.set(tx, 0, tz);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 24), woodWallMat);
      top.position.y = 1.15;
      tbl.add(top);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 1.15, 12), darkWoodMat);
      ped.position.y = 0.57;
      tbl.add(ped);
      cafeGroup.add(tbl);
    }

    // Wooden Bar Counter on Right Wall
    const barCounter = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 9.5), darkWoodMat);
    barCounter.position.set(6.5, 0.7, -1.5);
    cafeGroup.add(barCounter);

    // ========================================================================
    // 4. AUDIOBOOK LIBRARY GROUP (Matches IMG_4320 #4)
    // ========================================================================
    const libraryGroup = new THREE.Group();
    libraryGroup.visible = false;
    scene.add(libraryGroup);

    // Towering Bookshelves with Instanced 3D Books
    const shelfFrameMat = new THREE.MeshStandardMaterial({
      color: 0x3b2314,
      roughness: 0.65,
      metalness: 0.15
    });
    for (const bx of [-6.5, -2.2, 2.2, 6.5]) {
      const bookcase = new THREE.Mesh(new THREE.BoxGeometry(3.8, 8.5, 0.9), shelfFrameMat);
      bookcase.position.set(bx, 4.25, -8.2);
      libraryGroup.add(bookcase);
    }

    const bookGeo = new THREE.BoxGeometry(0.18, 0.78, 0.55);
    const bookMat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 });
    const bookCount = 160;
    const bookInstanced = new THREE.InstancedMesh(bookGeo, bookMat, bookCount);
    const dummy = new THREE.Object3D();
    const bookPalette = [0xb45309, 0x991b1b, 0x1e3a8a, 0x065f46, 0xd97706, 0x7c2d12];
    let bIdx = 0;
    for (let shelfRow = 0; shelfRow < 5; shelfRow++) {
      for (let slot = 0; slot < 32; slot++) {
        if (bIdx >= bookCount) break;
        dummy.position.set(-7.5 + slot * 0.48, 1.2 + shelfRow * 1.45, -7.65);
        dummy.rotation.z = (slot % 5 === 0 ? 0.08 : 0);
        dummy.updateMatrix();
        bookInstanced.setMatrixAt(bIdx, dummy.matrix);
        bookInstanced.setColorAt(bIdx, _tempColor.setHex(bookPalette[bIdx % bookPalette.length]));
        bIdx++;
      }
    }
    bookInstanced.instanceMatrix.needsUpdate = true;
    if (bookInstanced.instanceColor) bookInstanced.instanceColor.needsUpdate = true;
    bookInstanced.computeBoundingSphere();
    libraryGroup.add(bookInstanced);

    // Central Oak Reading Desk + Brass Lamp + 3D Studio Headphones + Open Book
    const readingDesk = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 2.4), woodWallMat);
    readingDesk.position.set(0, 1.35, -1.8);
    libraryGroup.add(readingDesk);

    // Glowing Open Book & Floating Holographic Chapter Ring
    const openBook = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.08, 0.68),
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.55
      })
    );
    openBook.position.set(-0.7, 1.52, -1.6);
    libraryGroup.add(openBook);

    // 3D Headphones on the Desk
    const hpGroup = new THREE.Group();
    hpGroup.position.set(0.85, 1.82, -1.55);
    const headband = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.055, 14, 28, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.25, metalness: 0.85 })
    );
    hpGroup.add(headband);
    for (const earX of [-0.42, 0.42]) {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.16, 18),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.7 })
      );
      cup.rotation.z = Math.PI / 2;
      cup.position.set(earX, -0.05, 0);
      hpGroup.add(cup);
    }
    libraryGroup.add(hpGroup);

    const libraryHaloRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.9, 0.03, 12, 64),
      new THREE.MeshBasicMaterial({ color: 0xf5b942 })
    );
    libraryHaloRing.rotation.x = Math.PI / 2;
    libraryHaloRing.position.set(0, 2.9, -1.8);
    libraryGroup.add(libraryHaloRing);

    // ========================================================================
    // 5. PODCAST STUDIO GROUP (Matches IMG_4320 #5)
    // ========================================================================
    const podcastGroup = new THREE.Group();
    podcastGroup.visible = false;
    scene.add(podcastGroup);

    // Acoustic Foam Panels on Studio Back Wall
    const studioWall = new THREE.Mesh(
      new THREE.BoxGeometry(16, 9, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x131624, roughness: 0.8 })
    );
    studioWall.position.set(0, 4.5, -7.2);
    podcastGroup.add(studioWall);

    const foamColors = [0x881337, 0x1e293b, 0x4c1d95];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 1.4, 0.18),
          new THREE.MeshStandardMaterial({
            color: foamColors[(r + c) % foamColors.length],
            roughness: 0.85
          })
        );
        panel.position.set(-4.5 + c * 1.8, 2.6 + r * 1.65, -6.9);
        podcastGroup.add(panel);
      }
    }

    // Studio Producer Desk + Dual DAW Waveform Screens + Studio Monitors + Mic
    const podDesk = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.18, 2.2), darkWoodMat);
    podDesk.position.set(0, 1.4, -2.6);
    podcastGroup.add(podDesk);

    for (const sx of [-0.95, 0.95]) {
      const dawScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(1.55, 0.92),
        new THREE.MeshBasicMaterial({ map: ledCanvasObj.texture })
      );
      dawScreen.position.set(sx, 2.15, -3.1);
      podcastGroup.add(dawScreen);
    }

    // Studio Nearfield Speakers with Glowing Amber Cones
    for (const spkX of [-2.15, 2.15]) {
      const spk = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.5), speakerBoxMat);
      spk.position.set(spkX, 1.92, -3.0);
      podcastGroup.add(spk);
      const cone = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.18, 20),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
      );
      cone.position.set(spkX, 1.85, -2.74);
      podcastGroup.add(cone);
    }

    // Podcast Host Seated at Desk with Headphones & Boom Mic
    const hostGroup = new THREE.Group();
    hostGroup.position.set(0, 0, -1.2);
    const hostTorso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 1.35, 14),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
    );
    hostTorso.position.y = 1.45;
    hostGroup.add(hostTorso);
    const hostHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 })
    );
    hostHead.position.y = 2.35;
    hostGroup.add(hostHead);
    // Mic on boom arm
    const micCapsule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.28, 12),
      new THREE.MeshStandardMaterial({
        color: 0xf5b942,
        metalness: 0.9,
        roughness: 0.2,
        emissive: 0xf5b942,
        emissiveIntensity: 0.4
      })
    );
    micCapsule.position.set(0.32, 2.25, -0.55);
    hostGroup.add(micCapsule);
    podcastGroup.add(hostGroup);

    // Pointer drag orbit handlers
    const domEl = renderer.domElement;
    const onPointerDown = (e: PointerEvent) => {
      pointerOrbitRef.current.isDown = true;
      pointerOrbitRef.current.startX = e.clientX;
      pointerOrbitRef.current.startY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointerOrbitRef.current.isDown) return;
      const dx = e.clientX - pointerOrbitRef.current.startX;
      const dy = e.clientY - pointerOrbitRef.current.startY;
      pointerOrbitRef.current.startX = e.clientX;
      pointerOrbitRef.current.startY = e.clientY;
      pointerOrbitRef.current.yawOffset = Math.max(
        -0.85,
        Math.min(0.85, pointerOrbitRef.current.yawOffset - dx * 0.0045)
      );
      pointerOrbitRef.current.pitchOffset = Math.max(
        -0.35,
        Math.min(0.45, pointerOrbitRef.current.pitchOffset + dy * 0.0035)
      );
    };
    const onPointerUp = () => {
      pointerOrbitRef.current.isDown = false;
    };
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Software WebGL safe pacing helper
    let frameId = 0;
    let lastUiUpdateMs = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function updateLedMatrixCanvas(elapsed: number, bass: number, mid: number, room: VenueRoomId) {
      const { ctx, canvas, texture } = ledCanvasObj;
      ctx.fillStyle = room === 'concert' ? '#140824' : '#050914';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw glowing dot-matrix eye/wave (matching IMG_4318 LED wall)
      const cols = 32;
      const rows = 16;
      const cellW = canvas.width / cols;
      const cellH = canvas.height / rows;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const nx = (c / cols) * 2 - 1;
          const ny = (r / rows) * 2 - 1;
          const dist = Math.sqrt(nx * nx * 1.4 + ny * ny * 2.2);
          const wave = Math.sin(nx * 6 + elapsed * 5) * 0.35 * (0.4 + bass);
          const ringVal = Math.cos((dist - elapsed * 0.8) * 9) * 0.5 + 0.5;
          const intensity = Math.max(0.12, ringVal * (0.45 + bass * 0.85) + (Math.abs(ny - wave) < 0.25 ? 0.6 : 0));

          if (room === 'concert') {
            ctx.fillStyle = `rgba(245, 158, 11, ${Math.min(1, intensity)})`;
          } else if (room === 'podcast') {
            ctx.fillStyle = `rgba(168, 85, 247, ${Math.min(1, intensity * (0.6 + mid))})`;
          } else {
            ctx.fillStyle = `rgba(125, 211, 252, ${Math.min(1, intensity)})`;
          }
          ctx.beginPath();
          ctx.arc(c * cellW + cellW * 0.5, r * cellH + cellH * 0.5, Math.min(cellW, cellH) * 0.34, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      texture.needsUpdate = true;
    }

    function tick() {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const st = stateRef.current;

      // Read live FFT Bass & Spectrum from Web Audio API
      const audioMetrics = djAudioController.getCombinedBassAndSpectrum();
      const synthFallbackBass = st.isPlaying
        ? Math.pow(Math.max(0, Math.sin(elapsed * ((st.currentTrack?.bpm || 120) / 60) * Math.PI)), 4) * 0.82
        : 0.08;
      const rawBass = Math.max(audioMetrics.bass, synthFallbackBass);
      const bass = Math.min(1, rawBass * st.bassSensitivity);
      const isKickHit = bass > 0.68;

      const nowMs = performance.now();
      if (nowMs - lastUiUpdateMs > 110) {
        lastUiUpdateMs = nowMs;
        setLiveBassPct(Math.round(bass * 100));
      }

      // Toggle visible 3D room group
      partyGroup.visible = st.activeRoom === 'party';
      concertGroup.visible = st.activeRoom === 'concert';
      cafeGroup.visible = st.activeRoom === 'cafe';
      libraryGroup.visible = st.activeRoom === 'library';
      podcastGroup.visible = st.activeRoom === 'podcast';

      // Update LED Canvas for Party, Concert, or Podcast monitors
      updateLedMatrixCanvas(elapsed, bass, audioMetrics.mid || 0.4, st.activeRoom);

      // Room-specific 3D animations & Bass-Reactive Lighting
      if (st.activeRoom === 'party') {
        floorMat.color.setHex(0x080b14);
        floorMat.roughness = 0.12;
        discoSubGroup.visible = st.clubPreset === 'neon_disco';

        // Pulse subwoofers physically with the bass kick
        const coneScale = 1 + bass * 0.34;
        for (const cone of wooferCones) {
          cone.scale.set(coneScale, coneScale, 1 + bass * 0.5);
        }

        // Sweep & strobe the 8 volumetric laser cones
        laserCones.forEach((lc, idx) => {
          const sweepSpeed = st.laserMode === 'strobe_rave' ? 3.4 : 1.45;
          const angleZ = lc.side * (0.32 + Math.sin(elapsed * sweepSpeed + lc.phase) * (0.28 + bass * 0.25));
          const angleX = 0.42 + Math.cos(elapsed * 1.1 + idx) * 0.18;
          lc.mesh.rotation.set(angleX, 0, angleZ);

          // Color & Strobe intensity based on laserMode + bass kick
          if (st.laserMode === 'warm_gold') {
            lc.mat.color.setHex(idx % 2 === 0 ? 0xf5b942 : 0xec4899);
          } else if (st.clubPreset === 'laser_arena') {
            lc.mat.color.setHex(idx % 2 === 0 ? 0x10b981 : 0xa855f7);
          } else {
            lc.mat.color.setHex(lc.side < 0 ? 0x00f0ff : 0xec4899);
          }

          const strobeGate =
            st.laserMode === 'strobe_rave' && isKickHit
              ? (Math.floor(elapsed * 24) % 2 === 0 ? 0.68 : 0.04)
              : 0.14 + bass * 0.38;
          lc.mat.opacity = strobeGate;
        });

        // Disco ball & dancefloor tiles
        if (st.clubPreset === 'neon_disco') {
          discoBall.rotation.y = elapsed * 0.85;
          dancefloorTiles.forEach((tile) => {
            const wave = Math.sin(elapsed * 4 + tile.idx * 0.5) * 0.5 + 0.5;
            tile.mat.emissiveIntensity = 0.15 + wave * bass * 1.4;
          });
        }

        bassPulseLightLeft.color.setHex(st.clubPreset === 'laser_arena' ? 0x10b981 : 0x00f0ff);
        bassPulseLightRight.color.setHex(0xec4899);
        bassPulseLightLeft.intensity = 1.5 + bass * 6.5;
        bassPulseLightRight.intensity = 1.5 + bass * 6.5;
        stageCenterLight.intensity = isKickHit ? 5.5 : 1.8;
      } else if (st.activeRoom === 'concert') {
        floorMat.color.setHex(0x12091c);
        floorMat.roughness = 0.28;

        // Sweep concert stage beams & pulse with music
        concertBeams.forEach((cb) => {
          const swing = Math.sin(elapsed * 1.2 + cb.idx * 0.6) * 0.38;
          cb.mesh.rotation.set(0.35, 0, swing);
          cb.mat.opacity = 0.16 + bass * 0.34;
        });

        // Animate band & cheering crowd bouncing to the beat
        bandMembers.forEach((bm, idx) => {
          bm.position.y = 1.2 + Math.abs(Math.sin(elapsed * 4 + idx)) * (0.04 + bass * 0.12);
        });
        crowdMembers.forEach((cm) => {
          cm.group.position.y =
            cm.baseY + Math.abs(Math.sin(elapsed * 5.5 + cm.phase)) * (0.05 + bass * 0.22);
        });

        bassPulseLightLeft.color.setHex(0xd946ef);
        bassPulseLightRight.color.setHex(0xfacc15);
        bassPulseLightLeft.intensity = 2.4 + bass * 4.2;
        bassPulseLightRight.intensity = 2.4 + bass * 4.2;
        stageCenterLight.color.setHex(0xffffff);
        stageCenterLight.intensity = 3.5 + bass * 3.0;
      } else if (st.activeRoom === 'cafe') {
        floorMat.color.setHex(0x2b1b12);
        floorMat.roughness = 0.45;
        pianistGroup.rotation.z = Math.sin(elapsed * 2.4) * 0.05;
        sunbeams.forEach((sb, i) => {
          (sb.material as THREE.MeshBasicMaterial).opacity =
            0.13 + Math.sin(elapsed * 0.8 + i) * 0.03 + bass * 0.05;
        });
        bassPulseLightLeft.color.setHex(0xfde68a);
        bassPulseLightRight.color.setHex(0xf59e0b);
        bassPulseLightLeft.intensity = 2.6;
        bassPulseLightRight.intensity = 1.8;
        stageCenterLight.color.setHex(0xfef08a);
        stageCenterLight.intensity = 2.4;
      } else if (st.activeRoom === 'library') {
        floorMat.color.setHex(0x1c130d);
        floorMat.roughness = 0.35;
        libraryHaloRing.rotation.z = elapsed * 0.45;
        libraryHaloRing.position.y = 2.85 + Math.sin(elapsed * 1.5) * 0.12;
        bassPulseLightLeft.color.setHex(0xf59e0b);
        bassPulseLightRight.color.setHex(0xd97706);
        bassPulseLightLeft.intensity = 2.1;
        bassPulseLightRight.intensity = 2.1;
        stageCenterLight.color.setHex(0xfef3c7);
        stageCenterLight.intensity = 3.2;
      } else {
        // Podcast Studio
        floorMat.color.setHex(0x0d101b);
        floorMat.roughness = 0.32;
        hostGroup.rotation.y = Math.sin(elapsed * 1.6) * 0.12;
        bassPulseLightLeft.color.setHex(0xa855f7);
        bassPulseLightRight.color.setHex(0x38bdf8);
        bassPulseLightLeft.intensity = 2.2 + bass * 2.0;
        bassPulseLightRight.intensity = 2.2 + bass * 2.0;
        stageCenterLight.color.setHex(0xf5b942);
        stageCenterLight.intensity = 2.8;
      }

      // Smooth damped camera positioning
      if (st.cameraPreset === 'stage_close') {
        _camTargetPos.set(0, 2.7, 2.2);
        _camLookAt.set(0, 2.4, -6.5);
      } else if (st.cameraPreset === 'floor_pit') {
        _camTargetPos.set(0, 1.85, 5.2);
        _camLookAt.set(0, 2.8, -6.2);
      } else if (st.cameraPreset === 'orbit') {
        _camTargetPos.set(Math.sin(elapsed * 0.32) * 5.2, 3.3, 7.2 + Math.cos(elapsed * 0.32) * 2.2);
        _camLookAt.set(0, 2.3, -5.0);
      } else {
        _camTargetPos.set(0, 3.2, 9.6);
        _camLookAt.set(0, 2.5, -5.2);
      }

      // Apply manual user drag orbit offset
      _camTargetPos.x += pointerOrbitRef.current.yawOffset * 5.5;
      _camTargetPos.y = Math.max(1.2, _camTargetPos.y + pointerOrbitRef.current.pitchOffset * 3.5);

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 4.2, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 4.2, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 4.2, delta);

      _smoothLookAt.x = THREE.MathUtils.damp(_smoothLookAt.x, _camLookAt.x, 5.0, delta);
      _smoothLookAt.y = THREE.MathUtils.damp(_smoothLookAt.y, _camLookAt.y, 5.0, delta);
      _smoothLookAt.z = THREE.MathUtils.damp(_smoothLookAt.z, _camLookAt.z, 5.0, delta);
      camera.lookAt(_smoothLookAt);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      envTexture.dispose();
      ledCanvasObj.texture.dispose();
      renderer.dispose();
    };
  }, []);

  const currentRoomMeta = useMemo(
    () => FIVE_VENUE_ROOMS.find((r) => r.id === activeRoom) || FIVE_VENUE_ROOMS[0],
    [activeRoom]
  );

  return (
    <div className="relative w-full h-[calc(100dvh-7.5rem)] min-h-[560px] rounded-[28px] overflow-hidden border border-white/15 bg-[#05070E] select-none">
      {/* Dedicated WebGL 3D Canvas Mount */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Minimal Top HUD Bar (No side-panel clutter, zero backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute top-3.5 inset-x-3.5 z-20 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-[#070A12]/90 px-3.5 py-2 shadow-lg">
          {onBackToHub && (
            <button
              type="button"
              onClick={onBackToHub}
              className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#F5B942] hover:bg-white/20 cursor-pointer"
            >
              {t('← 5 Rooms Hub', '→ بازگشت به ۵ تالار')}
            </button>
          )}
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: currentRoomMeta.accentHex }}
          />
          <div>
            <p className="text-xs sm:text-sm font-bold text-[#F5F7FA]">
              {t(currentRoomMeta.titleEn, currentRoomMeta.titleFa)}
            </p>
            <p className="text-[10px] text-[#A3AEC2] hidden sm:block">
              {t(currentRoomMeta.subtitleEn, currentRoomMeta.subtitleFa)}
            </p>
          </div>
        </div>

        {/* Live Bass DMX Telemetry & 3D Tech Stack Button */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#070A12]/90 px-3 py-1.5 text-[11px] font-mono-tabular text-[#F5F7FA]">
            <Zap className="h-3.5 w-3.5 text-[#00F0FF]" />
            <span>BASS DMX: {liveBassPct}%</span>
            <div className="w-14 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00F0FF] via-[#F5B942] to-[#EC4899] transition-all duration-75"
                style={{ width: `${Math.min(100, liveBassPct)}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTechModal(true)}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-full border border-[#F5B942]/45 bg-[#070A12]/92 px-3 text-xs font-semibold text-[#F5B942] hover:bg-[#F5B942]/15 cursor-pointer"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>{t('3D Tech Stack', 'تکنولوژی‌های ۳بعدی')}</span>
          </button>
        </div>
      </div>

      {/* Unified Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div className="pointer-events-none absolute bottom-3 inset-x-0 z-20 flex flex-col items-center px-3">
        {/* Collapse / Expand Toggle Handle */}
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#070A12]/92 px-4 py-1.5 text-[11px] font-medium text-[#A3AEC2] hover:text-white cursor-pointer shadow-md"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5 text-[#F5B942]" />
              <span>{t('Show 3D Room & Light Controls (H)', 'نمایش پنل اتاق‌ها و رقص نور (H)')}</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 text-[#F5B942]" />
              <span>{t('Hide Dock · Full 3D View (H)', 'مخفی کردن پنل · دید کامل ۳بعدی (H)')}</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full max-w-[940px] rounded-[24px] border border-white/15 bg-[#070A12]/95 p-3 sm:p-4 shadow-2xl space-y-3">
            {/* Row 1: 5 Rooms Instant Switcher */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {FIVE_VENUE_ROOMS.map((rm) => {
                const active = rm.id === activeRoom;
                return (
                  <button
                    key={rm.id}
                    type="button"
                    onClick={() => onChangeRoom(rm.id)}
                    className={`min-h-[38px] shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors cursor-pointer border ${
                      active
                        ? 'border-[#F5B942] bg-[#F5B942] text-[#06070C]'
                        : 'border-white/12 bg-[#0D121F] text-[#A3AEC2] hover:text-white'
                    }`}
                  >
                    {rm.id === 'cafe' && <Coffee className="h-3.5 w-3.5" />}
                    {rm.id === 'concert' && <Music className="h-3.5 w-3.5" />}
                    {rm.id === 'party' && <Disc3 className="h-3.5 w-3.5" />}
                    {rm.id === 'library' && <BookOpen className="h-3.5 w-3.5" />}
                    {rm.id === 'podcast' && <Mic className="h-3.5 w-3.5" />}
                    <span>{t(rm.titleEn, rm.titleFa)}</span>
                  </button>
                );
              })}

              <div className="ms-auto flex items-center gap-1 shrink-0">
                {(
                  [
                    { id: 'wide', fa: 'نمای کلی', en: 'Wide' },
                    { id: 'stage_close', fa: 'نزدیک سن/دی‌جی', en: 'Stage' },
                    { id: 'floor_pit', fa: 'وسط پیست', en: 'Dancefloor' },
                    { id: 'orbit', fa: 'چرخش ۳بعدی', en: 'Orbit' }
                  ] as Array<{ id: CameraAnglePreset; fa: string; en: string }>
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraPreset(cam.id)}
                    className={`min-h-[32px] rounded-full px-2.5 text-[11px] font-medium cursor-pointer border ${
                      cameraPreset === cam.id
                        ? 'border-[#00F0FF] bg-[#00F0FF]/15 text-[#00F0FF]'
                        : 'border-white/10 bg-[#0D121F] text-[#A3AEC2] hover:text-white'
                    }`}
                  >
                    {t(cam.en, cam.fa)}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Room-Specific Sub-Clubs / Laser DMX Controls */}
            {activeRoom === 'party' && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#0B0F1C] px-3 py-2">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-[11px] font-semibold text-[#00F0FF] shrink-0">
                    {t('Select Club / Disco:', 'انتخاب کلاب و دیسکو:')}
                  </span>
                  {CLUB_SUB_PRESETS.map((cp) => (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => setClubPreset(cp.id)}
                      className={`min-h-[32px] shrink-0 rounded-full px-3 text-[11px] font-semibold cursor-pointer border ${
                        clubPreset === cp.id
                          ? 'border-[#00F0FF] bg-[#00F0FF]/20 text-white'
                          : 'border-white/10 bg-[#070A12] text-[#A3AEC2] hover:text-white'
                      }`}
                    >
                      {t(cp.en, cp.fa)}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'auto_bass', fa: 'رقص نور با بیس', en: 'Bass Sync' },
                        { id: 'strobe_rave', fa: 'فلش استروب', en: 'Strobe Rave' },
                        { id: 'warm_gold', fa: 'لیزر طلایی/صورتی', en: 'Gold/Pink' }
                      ] as Array<{ id: LaserShowMode; fa: string; en: string }>
                    ).map((lm) => (
                      <button
                        key={lm.id}
                        type="button"
                        onClick={() => setLaserMode(lm.id)}
                        className={`min-h-[30px] rounded-full px-2.5 text-[10px] font-semibold cursor-pointer border ${
                          laserMode === lm.id
                            ? 'border-[#EC4899] bg-[#EC4899]/20 text-[#F5F7FA]'
                            : 'border-white/10 text-[#A3AEC2]'
                        }`}
                      >
                        {t(lm.en, lm.fa)}
                      </button>
                    ))}
                  </div>

                  <label className="inline-flex items-center gap-1.5 text-[11px] text-[#A3AEC2]">
                    <Sliders className="h-3 w-3 text-[#F5B942]" />
                    <span>{t('Bass Light Gain', 'شدت بیس نور')}</span>
                    <input
                      type="range"
                      min={0.6}
                      max={2.2}
                      step={0.1}
                      value={bassSensitivity}
                      onChange={(e) => setBassSensitivity(Number(e.target.value))}
                      className="w-16 accent-[#00F0FF] cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Row 3: Active Audio / Track / Album / Podcast Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="h-10 w-10 rounded-full bg-[#F5B942] text-[#06070C] inline-flex items-center justify-center font-bold hover:brightness-110 cursor-pointer shrink-0"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                </button>

                <button
                  type="button"
                  onClick={handleNextTrack}
                  className="h-9 w-9 rounded-full border border-white/15 bg-[#0D121F] text-[#F5F7FA] inline-flex items-center justify-center hover:border-[#F5B942] cursor-pointer shrink-0"
                  title={t('Next Track in Room', 'قطعه بعدی در این اتاق')}
                >
                  <SkipForward className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsMuted((m) => !m)}
                  className="h-9 w-9 rounded-full border border-white/15 bg-[#0D121F] text-[#A3AEC2] inline-flex items-center justify-center hover:text-white cursor-pointer shrink-0"
                  aria-label="Mute toggle"
                >
                  {isMuted ? <VolumeX className="h-4 w-4 text-[#FCA5A5]" /> : <Volume2 className="h-4 w-4 text-[#00F0FF]" />}
                </button>

                {currentTrack && (
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs sm:text-sm font-bold text-[#F5F7FA]">
                        {t(currentTrack.titleEn, currentTrack.titleFa)}
                      </p>
                      {currentTrack.bpm && (
                        <span className="rounded-md bg-[#00F0FF]/15 px-1.5 py-0.5 text-[10px] font-mono-tabular text-[#00F0FF]">
                          {currentTrack.bpm} BPM
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-[#A3AEC2]">
                      {t(
                        currentTrack.creatorEn || currentTrack.categoryEn,
                        currentTrack.creatorFa || currentTrack.categoryFa
                      )}{' '}
                      · {formatDuration(currentTrack.durationSec)}
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Track/Episode Selector Pills + Open in DJ / Full Player */}
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={currentTrack?.id || ''}
                  onChange={(e) => setSelectedTrackId(e.target.value)}
                  className="min-h-[36px] max-w-[210px] rounded-full border border-white/15 bg-[#0D121F] px-3 text-xs text-[#F5F7FA]"
                >
                  {roomPlaylist.map((item) => (
                    <option key={item.id} value={item.id}>
                      {t(item.titleEn, item.titleFa)}
                    </option>
                  ))}
                </select>

                {activeRoom === 'cafe' && (
                  <button
                    type="button"
                    onClick={() => setEndlessRadioMode((v) => !v)}
                    className={`min-h-[36px] inline-flex items-center gap-1 rounded-full px-3 text-[11px] font-semibold border cursor-pointer ${
                      endlessRadioMode
                        ? 'border-[#34D399] bg-[#34D399]/15 text-[#34D399]'
                        : 'border-white/15 bg-[#0D121F] text-[#A3AEC2]'
                    }`}
                  >
                    <Radio className="h-3.5 w-3.5" />
                    <span>{t('Endless Cafe Radio: ON', 'رادیو بی‌وقفه کافه: فعال')}</span>
                  </button>
                )}

                {currentTrack && (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenDjStudio(currentTrack)}
                      className="min-h-[36px] inline-flex items-center gap-1 rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/12 px-3 text-[11px] font-semibold text-[#00F0FF] hover:bg-[#00F0FF]/20 cursor-pointer"
                    >
                      <Disc3 className="h-3.5 w-3.5" />
                      <span>{t('Mix in DJ Deck', 'میکس در میز دی‌جی')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onPlayFullScreen(currentTrack)}
                      className="min-h-[36px] inline-flex items-center gap-1 rounded-full border border-white/15 bg-[#0D121F] px-3 text-[11px] font-medium text-[#F5F7FA] hover:border-[#F5B942] cursor-pointer"
                    >
                      <Headphones className="h-3.5 w-3.5 text-[#F5B942]" />
                      <span>{t('Player & Chapters', 'پلیر و فصل‌ها')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3D Technology Stack Architecture Modal (Answers "با چه تکنولوژی‌هایی می‌تونم اینو انجام بدم؟") */}
      {showTechModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowTechModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-[28px] border border-white/15 bg-[#0A0E1A] p-5 sm:p-6 text-[#F5F7FA] shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-[#F5B942]" />
                <h2 className="text-base sm:text-lg font-bold">
                  {t(
                    '3D Club, Concert & Audio-Reactive Lighting Tech Stack',
                    'تکنولوژی‌های ساخت کلاب، دیسکو و رقص نور ۳بعدی حساس به بیس'
                  )}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTechModal(false)}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-[#A3AEC2] hover:text-white cursor-pointer"
              >
                {t('Close', 'بستن')}
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm leading-relaxed text-[#D1D8E6]">
              <div className="rounded-2xl border border-[#00F0FF]/30 bg-[#00F0FF]/10 p-3.5 space-y-1">
                <p className="font-bold text-[#00F0FF] flex items-center gap-1.5">
                  <Layers className="h-4 w-4" />
                  <span>۱. موتور رندرینگ سه‌بعدی تحت وب: Three.js (WebGL2 / WebGPU) + React Three Fiber</span>
                </p>
                <p>
                  برای اجرای مستقیم و بدون نیاز به نصب در مرورگر و موبایل، از <strong>Three.js</strong> با متریال‌های فیزیکی (PBR `MeshStandardMaterial` و `MeshPhysicalMaterial`)، نقشه بازتاب محیطی (`PMREMGenerator` + `RoomEnvironment`) و `ACESFilmicToneMapping` استفاده شده است تا سطوح براق پیست رقص، فلز سازه‌های کنسرت و چوب کافه کاملاً واقعی رندر شوند.
                </p>
              </div>

              <div className="rounded-2xl border border-[#F5B942]/30 bg-[#F5B942]/10 p-3.5 space-y-1">
                <p className="font-bold text-[#F5B942] flex items-center gap-1.5">
                  <Zap className="h-4 w-4" />
                  <span>۲. رقص نور زنده هماهنگ با بیس (Web Audio API FFT AnalyserNode → DMX Shader)</span>
                </p>
                <p>
                  صدا از طریق <strong>Web Audio API (`AnalyserNode`)</strong> در لحظه به طیف فرکانسی (FFT) تبدیل می‌شود. فرکانس‌های زیر (Sub-Bass بین ۲۰ تا ۱۴۰ هرتز) استخراج شده و در حلقه ۶۰ فریم بر ثانیه (`requestAnimationFrame`) مستقیماً به شدت نورهای نقطه‌ای (`PointLight`)، زاویه مخروط‌های لیزر (`AdditiveBlending Cone Meshes`)، لرزش ساب‌ووفرها و دیوار LED پشت دی‌جی متصل شده‌اند.
                </p>
              </div>

              <div className="rounded-2xl border border-[#EC4899]/30 bg-[#EC4899]/10 p-3.5 space-y-1">
                <p className="font-bold text-[#EC4899] flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  <span>۳. پرتوهای حجمی لیزر و افکت‌های سینمایی (Volumetric Beams & Post-Processing)</span>
                </p>
                <p>
                  پرتوهای لیزر کلاب، نورهای کنسرت و پرتوهای آفتاب کافه با هندسه‌های مخروطی شفاف (`AdditiveBlending` + `FogExp2`) ساخته شده‌اند. برای پروژه‌های سنگین‌تر دسکتاپ/موبایل می‌توان مدل‌های آماده <strong>Blender (.glb / .gltf با فشرده‌سازی Draco)</strong> و شیدرهای <strong>UnrealBloomPass / Custom GLSL</strong> یا موتورهای <strong>Unreal Engine 5 (Pixel Streaming) / Unity WebGPU</strong> را نیز روی همین معماری سوار کرد.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
