import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SonicRoomId } from '../screens/DjStudioScreen';
import { ConcertHallScene } from '../../scenes/concert/ConcertHallScene';
import { preloadConcertAssets, resolveConcertAssetManifest } from '../../scenes/concert/concertAssets';
import { CAFE_CAMERA_SPEC, CafeRoomContent } from '../../scenes/cafe/CafeRoomScene';
import { PARTY_CAMERA_SPEC, PartyRoomContent } from '../../scenes/party/PartyRoomScene';
import { LIBRARY_CAMERA_SPEC, LibraryRoomContent } from '../../scenes/library/LibraryRoomScene';
import { PODCAST_CAMERA_SPEC, PodcastRoomContent, PodcastRoomScene } from '../../scenes/podcast/PodcastRoomScene';
import {
  SharedRoomsCanvas,
  type RoomCameraSpec,
  type SharedCanvasRoomId
} from '../../scenes/shared/SonicRoomShared';
import type { RoomLightingCalibration } from '../../types/lighting';
import type { RoomPeerParticipant } from '../../types/roomSync';
import { scheduleIdleRoomAssetWarming } from '../../services/roomAssetPreloader';

export type RoomCameraPreset = 'cinematic' | 'first_person' | 'stage_closeup';

export type RoomLightingFxMode =
  | 'natural_pt'
  | 'neon_laser'
  | 'golden_cinema'
  | 'strobe_pulse';

export interface RoomMoveInput {
  forward: number; // -1 .. 1
  strafe: number; // -1 .. 1
  jump?: boolean;
  sprint?: boolean;
}

export interface SonicRoom3DWorldProps {
  roomId: SonicRoomId;
  isPlaying: boolean;
  bpm: number;
  pulseIntensity: number;
  cameraPreset: RoomCameraPreset;
  lightingFxMode: RoomLightingFxMode;
  lightingCalibration?: RoomLightingCalibration;
  fxBurstSeq: number;
  moveInputRef: React.MutableRefObject<RoomMoveInput>;
  trackTitle?: string;
  trackArtist?: string;
  trackCoverUrl?: string;
  trackAccentHex?: string;
  roomGlowHex?: string;
  isHostVisible?: boolean;
  isFullscreen?: boolean;
  connectedPeers?: RoomPeerParticipant[];
  latestTrackDeviceName?: string;
  onInteractHotspot?: (action: 'toggle_play' | 'next_track' | 'trigger_fx' | 'open_dj') => void;
}

const SHARED_CAMERA_SPECS: Record<SharedCanvasRoomId, RoomCameraSpec> = {
  cafe: CAFE_CAMERA_SPEC,
  party: PARTY_CAMERA_SPEC,
  audiobook: LIBRARY_CAMERA_SPEC,
  podcast: PODCAST_CAMERA_SPEC
};

const ROOM_LOADING_LABELS: Record<SonicRoomId, string> = {
  concert: 'سالن کنسرت زنده',
  cafe: 'کافه آکوستیک',
  party: 'پارتی کلاب نئون',
  audiobook: 'تالار کتابخانه',
  podcast: 'استودیو پادکست'
};

function isSharedRoomId(id: SonicRoomId): id is Exclude<SharedCanvasRoomId, 'podcast'> {
  return id === 'cafe' || id === 'party' || id === 'audiobook';
}

export function SonicRoom3DWorld({
  roomId,
  isPlaying,
  bpm,
  pulseIntensity,
  cameraPreset,
  lightingFxMode,
  lightingCalibration,
  fxBurstSeq,
  moveInputRef,
  trackTitle,
  trackArtist,
  trackCoverUrl,
  trackAccentHex,
  roomGlowHex = '#F5B942',
  isHostVisible = true,
  isFullscreen = false,
  connectedPeers = [],
  latestTrackDeviceName,
  onInteractHotspot
}: SonicRoom3DWorldProps) {
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const joyActiveRef = useRef<{ pointerId: number | null; cx: number; cy: number }>({
    pointerId: null,
    cx: 0,
    cy: 0
  });

  const [visitedSharedRooms, setVisitedSharedRooms] = useState<SharedCanvasRoomId[]>(() =>
    isSharedRoomId(roomId) ? [roomId] : []
  );
  const [visitedPodcast, setVisitedPodcast] = useState<boolean>(() => roomId === 'podcast');
  const [visitedConcert, setVisitedConcert] = useState<boolean>(() => roomId === 'concert');
  const [readyRooms, setReadyRooms] = useState<Record<string, boolean>>({});
  const lastSharedRoomRef = useRef<SharedCanvasRoomId>(isSharedRoomId(roomId) ? roomId : 'cafe');

  if (isSharedRoomId(roomId)) {
    lastSharedRoomRef.current = roomId;
  }

  // Preload Concert Hall GLTFs only when entering the concert room so other rooms load their own assets immediately
  useEffect(() => {
    if (roomId === 'concert') {
      preloadConcertAssets();
    }
  }, [roomId]);

  // Cache every visited shared room, podcast room, and concert hall so switching back is instantaneous
  useEffect(() => {
    if (isSharedRoomId(roomId)) {
      setVisitedSharedRooms((prev) => (prev.includes(roomId) ? prev : [...prev, roomId]));
    } else if (roomId === 'podcast') {
      setVisitedPodcast(true);
    } else if (roomId === 'concert') {
      setVisitedConcert(true);
    }
  }, [roomId]);

  const markRoomReady = useCallback((id: SonicRoomId) => {
    setReadyRooms((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
    scheduleIdleRoomAssetWarming();
  }, []);

  // Track ConcertHallScene first-load readiness without modifying ConcertHallScene.tsx
  useEffect(() => {
    if (roomId !== 'concert' || readyRooms.concert) return;
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    void resolveConcertAssetManifest().then(() => {
      if (cancelled) return;
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          if (!cancelled) markRoomReady('concert');
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [markRoomReady, readyRooms.concert, roomId]);

  // Safety timeout so loading overlay never stalls on slow connections
  useEffect(() => {
    if (readyRooms[roomId]) return;
    const timer = window.setTimeout(() => {
      markRoomReady(roomId);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [markRoomReady, readyRooms, roomId]);

  // Keyboard WASD + Arrow + Shift + Space walk input when in first_person mode
  useEffect(() => {
    const keysDown = new Set<string>();
    const syncKeys = () => {
      let forward = 0;
      let strafe = 0;
      if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) forward += 1;
      if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) forward -= 1;
      if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) strafe += 1;
      if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) strafe -= 1;
      moveInputRef.current.forward = forward;
      moveInputRef.current.strafe = strafe;
      moveInputRef.current.sprint = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight');
      if (keysDown.has('Space')) {
        moveInputRef.current.jump = true;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (cameraPreset !== 'first_person') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (
        e.code === 'KeyW' ||
        e.code === 'KeyA' ||
        e.code === 'KeyS' ||
        e.code === 'KeyD' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight' ||
        e.code === 'Space'
      ) {
        if (e.code === 'Space') e.preventDefault();
        keysDown.add(e.code);
        syncKeys();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (keysDown.delete(e.code)) {
        syncKeys();
      }
    };

    const onBlur = () => {
      keysDown.clear();
      moveInputRef.current.forward = 0;
      moveInputRef.current.strafe = 0;
      moveInputRef.current.sprint = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [cameraPreset, moveInputRef]);

  const maxJoyRadius = 26;
  const updateJoystick = (clientX: number, clientY: number) => {
    const dx = clientX - joyActiveRef.current.cx;
    const dy = clientY - joyActiveRef.current.cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxJoyRadius);
    const angle = Math.atan2(dy, dx);
    const nx = dist > 0.001 ? Math.cos(angle) * (clamped / maxJoyRadius) : 0;
    const ny = dist > 0.001 ? Math.sin(angle) * (clamped / maxJoyRadius) : 0;
    setJoyOffset({ x: nx * maxJoyRadius, y: ny * maxJoyRadius });
    moveInputRef.current.strafe = nx;
    moveInputRef.current.forward = -ny;
    moveInputRef.current.sprint = clamped >= maxJoyRadius * 0.92;
  };

  const resetJoystick = () => {
    joyActiveRef.current.pointerId = null;
    setJoyOffset({ x: 0, y: 0 });
    moveInputRef.current.strafe = 0;
    moveInputRef.current.forward = 0;
    moveInputRef.current.sprint = false;
  };

  const sharedSceneProps = useMemo(
    () => ({
      isPlaying,
      bpm,
      pulseIntensity,
      cameraPreset,
      lightingFxMode,
      lightingCalibration,
      fxBurstSeq,
      moveInputRef,
      trackTitle,
      trackArtist,
      trackCoverUrl,
      trackAccentHex,
      connectedPeers,
      latestTrackDeviceName,
      onInteractHotspot
    }),
    [
      bpm,
      cameraPreset,
      connectedPeers,
      fxBurstSeq,
      isPlaying,
      latestTrackDeviceName,
      lightingCalibration,
      lightingFxMode,
      moveInputRef,
      onInteractHotspot,
      pulseIntensity,
      trackAccentHex,
      trackArtist,
      trackCoverUrl,
      trackTitle
    ]
  );

  const isSharedActive = isSharedRoomId(roomId);
  const activeSharedRoom = lastSharedRoomRef.current;
  const isCurrentRoomReady = Boolean(readyRooms[roomId]);

  const handleCafeReady = useCallback(() => markRoomReady('cafe'), [markRoomReady]);
  const handlePartyReady = useCallback(() => markRoomReady('party'), [markRoomReady]);
  const handleLibraryReady = useCallback(() => markRoomReady('audiobook'), [markRoomReady]);
  const handlePodcastReady = useCallback(() => markRoomReady('podcast'), [markRoomReady]);
  const handleConcertReady = useCallback(() => markRoomReady('concert'), [markRoomReady]);

  return (
    <div
      className={
        isFullscreen
          ? 'relative w-screen h-[100dvh] rounded-none overflow-hidden bg-[#05060a] select-none'
          : 'relative w-full h-[calc(100dvh-5.6rem)] min-h-[560px] sm:h-[78vh] max-h-[880px] sm:rounded-[36px] overflow-hidden bg-[#05060a] select-none'
      }
      style={{
        boxShadow: isFullscreen
          ? undefined
          : `0 30px 90px rgba(0,0,0,0.92), 0 0 70px -24px ${roomGlowHex}55`
      }}
    >
      {/* Desktop Specular Hairline Rim */}
      <div className="pointer-events-none hidden sm:block absolute inset-0 rounded-[36px] ring-1 ring-inset ring-white/15 z-20" />
      {/* Atmospheric Top & Bottom Edge Vignettes for Organic Melting into Living Canvas */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#05060B]/75 via-[#05060B]/25 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#05060B]/85 via-[#05060B]/30 to-transparent z-10" />
      {/* Persistent Cached Multi-Room WebGL Context for Cafe / Party / Library / Podcast */}
      {visitedSharedRooms.length > 0 && (
        <div
          className={
            isSharedActive
              ? 'absolute inset-0 z-0'
              : 'absolute inset-0 z-0 opacity-0 pointer-events-none'
          }
        >
          <SharedRoomsCanvas
            activeRoom={activeSharedRoom}
            isHostVisible={isHostVisible && isSharedActive}
            visitedRooms={visitedSharedRooms}
            cameraPreset={cameraPreset}
            lightingFxMode={lightingFxMode}
            lightingCalibration={lightingCalibration}
            moveInputRef={moveInputRef}
            activeCameraSpec={SHARED_CAMERA_SPECS[activeSharedRoom]}
            renderRoom={(rId, isRoomActive, manifest) => {
              switch (rId) {
                case 'cafe':
                  return (
                    <CafeRoomContent
                      {...sharedSceneProps}
                      manifest={manifest}
                      isActive={isRoomActive}
                      renderOwnFloor={false}
                      onReady={handleCafeReady}
                    />
                  );
                case 'party':
                  return (
                    <PartyRoomContent
                      {...sharedSceneProps}
                      manifest={manifest}
                      isActive={isRoomActive}
                      renderOwnFloor={false}
                      onReady={handlePartyReady}
                    />
                  );
                case 'audiobook':
                  return (
                    <LibraryRoomContent
                      {...sharedSceneProps}
                      manifest={manifest}
                      isActive={isRoomActive}
                      renderOwnFloor={false}
                      onReady={handleLibraryReady}
                    />
                  );
                case 'podcast':
                  return (
                    <PodcastRoomContent
                      {...sharedSceneProps}
                      manifest={manifest}
                      isActive={isRoomActive}
                      renderOwnFloor={false}
                      onReady={handlePodcastReady}
                    />
                  );
              }
            }}
          />
        </div>
      )}

      {/* Persistent Cached Standalone Podcast Room (Three.js r180+ HDRLoader + MeshoptDecoder + N8AO/Bloom) */}
      {visitedPodcast && (
        <div
          className={
            roomId === 'podcast'
              ? 'absolute inset-0 z-10 h-full w-full'
              : 'absolute inset-0 z-0 h-full w-full opacity-0 pointer-events-none'
          }
        >
          <PodcastRoomScene
            {...sharedSceneProps}
            isActive={isHostVisible && roomId === 'podcast'}
            onReady={handlePodcastReady}
          />
        </div>
      )}

      {/* Persistent Cached Concert Hall Scene */}
      {visitedConcert && (
        <div
          className={
            roomId === 'concert'
              ? 'relative z-10 h-full w-full'
              : 'absolute inset-0 z-0 h-full w-full opacity-0 pointer-events-none'
          }
        >
          <ConcertHallScene
            {...sharedSceneProps}
            isActive={isHostVisible && roomId === 'concert'}
            onReady={handleConcertReady}
          />
        </div>
      )}

      {/* First-Entry Room Loading & Caching Overlay */}
      {!isCurrentRoomReady && (
        <div
          dir="rtl"
          className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#05060a]/85 backdrop-blur-md transition-opacity duration-300"
        >
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#F5B942]/30 border-t-[#F5B942]" />
          <div className="text-sm font-bold text-white">
            {ROOM_LOADING_LABELS[roomId]}
          </div>
          <div className="text-xs text-[#CBD5E1]/85">
            در حال بارگذاری و کش کردن صحنه برای اجرای روان...
          </div>
        </div>
      )}

      {/* Subtle Center Reticle only in First-Person Walk Mode */}
      {cameraPreset === 'first_person' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full border border-white/65 bg-white/20" />
        </div>
      )}

      {/* Compact Virtual Analog Walk Stick (Bottom-Left above ultra-slim VisionOS dock) */}
      {cameraPreset === 'first_person' && (
        <div
          dir="ltr"
          onPointerDown={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            joyActiveRef.current = {
              pointerId: e.pointerId,
              cx: rect.left + rect.width / 2,
              cy: rect.top + rect.height / 2
            };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            updateJoystick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (joyActiveRef.current.pointerId === e.pointerId) {
              e.stopPropagation();
              updateJoystick(e.clientX, e.clientY);
            }
          }}
          onPointerUp={(e) => {
            if (joyActiveRef.current.pointerId === e.pointerId) {
              e.stopPropagation();
              resetJoystick();
            }
          }}
          onPointerCancel={resetJoystick}
          aria-label="Walk Joystick"
          className="absolute bottom-16 left-3.5 z-20 h-20 w-20 rounded-full border border-white/20 bg-[#070b14]/65 backdrop-blur-md flex items-center justify-center touch-none cursor-pointer"
        >
          <div
            className="h-8 w-8 rounded-full border border-white/40 bg-[#F5B942]/90 shadow-md transition-transform duration-75"
            style={{
              transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)`
            }}
          />
        </div>
      )}
    </div>
  );
}
