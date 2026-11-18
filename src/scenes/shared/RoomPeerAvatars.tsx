import React from 'react';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import type { RoomPeerParticipant, RoomSyncId } from '../../types/roomSync';

export interface CastSlotDescriptor {
  key: string;
  isFemale?: boolean;
}

export interface AssignedCastPeer {
  peer: RoomPeerParticipant;
  isLatestDJ: boolean;
}

/**
 * Deterministic 1-to-1 assignment mapping joined room peers directly onto existing
 * room cast characters (seated patrons, musicians, hosts, dancers, spectators) so friends
 * never spawn as stiff extra standing clones.
 */
export function assignPeersToCastSlots(
  peers: RoomPeerParticipant[] | undefined,
  orderedSlots: CastSlotDescriptor[],
  latestTrackDeviceName?: string
): Map<string, AssignedCastPeer> {
  const result = new Map<string, AssignedCastPeer>();
  if (!peers || peers.length === 0 || orderedSlots.length === 0) {
    return result;
  }

  const usedIndices = new Set<number>();
  const latestLower = latestTrackDeviceName?.trim().toLowerCase() || '';

  for (const peer of peers) {
    if (usedIndices.size >= orderedSlots.length) break;

    // Prefer an unclaimed cast slot matching the peer's avatar gender first
    let chosenIdx = orderedSlots.findIndex(
      (slot, idx) =>
        !usedIndices.has(idx) &&
        slot.isFemale !== undefined &&
        Boolean(slot.isFemale) === Boolean(peer.isFemale)
    );

    if (chosenIdx === -1) {
      chosenIdx = orderedSlots.findIndex((_, idx) => !usedIndices.has(idx));
    }

    if (chosenIdx !== -1) {
      usedIndices.add(chosenIdx);
      const isLatestDJ =
        Boolean(latestLower) && peer.deviceName.trim().toLowerCase() === latestLower;
      result.set(orderedSlots[chosenIdx].key, { peer, isLatestDJ });
    }
  }

  return result;
}

/**
 * Compact overhead device & connection badge attached directly to the replaced room character.
 * Omits perspective distanceFactor so badges never scale up 3x and clip off mobile screen edges.
 */
export function PeerOverheadBadge({
  peer,
  isLatestDJ = false,
  headHeight = 1.92
}: {
  peer: RoomPeerParticipant;
  isLatestDJ?: boolean;
  headHeight?: number;
}) {
  const isBt = peer.connectionType === 'bluetooth';
  const badgeColor = isBt ? '#38BDF8' : '#34D399';
  const accentBorder = isLatestDJ ? '#F5B942' : badgeColor;

  return (
    <Html position={[0, headHeight, 0]} center zIndexRange={[18, 0]}>
      <div className="pointer-events-none select-none flex flex-col items-center">
        <div
          dir="rtl"
          style={{
            background: 'rgba(7, 11, 20, 0.88)',
            border: `1px solid ${accentBorder}99`,
            boxShadow: `0 4px 14px rgba(0,0,0,0.72), 0 0 10px ${accentBorder}2E`
          }}
          className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[9.5px] font-semibold text-white backdrop-blur-md"
        >
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{
              backgroundColor: badgeColor,
              boxShadow: `0 0 6px ${badgeColor}`
            }}
          />
          <span className="max-w-[86px] truncate">{peer.deviceName}</span>
          <span
            dir="ltr"
            style={{
              backgroundColor: `${badgeColor}26`,
              color: badgeColor
            }}
            className="rounded-full px-1 py-[1px] text-[7.5px] font-bold tracking-wide leading-none"
          >
            {isBt ? 'BT' : 'Wi-Fi'}
          </span>
          {isLatestDJ && (
            <span className="rounded-full bg-[#F5B942]/25 px-1 py-[1px] text-[7.5px] font-bold text-[#F5B942] leading-none">
              ♪
            </span>
          )}
        </div>
        <div
          style={{
            background: `linear-gradient(to bottom, ${accentBorder}aa, transparent)`
          }}
          className="h-2 w-[1.5px]"
        />
      </div>
    </Html>
  );
}

/**
 * Legacy mount kept as a safe no-op: joined friends now occupy real in-room characters directly.
 */
export function RoomPeerAvatars(_props: {
  roomId: RoomSyncId;
  peers?: RoomPeerParticipant[];
  maleModelUrl: string;
  femaleModelUrl: string;
  mocapClips: THREE.AnimationClip[];
  isPlaying: boolean;
  bpm: number;
  isActive?: boolean;
  latestTrackDeviceName?: string;
  stageYOffset?: number;
}) {
  return null;
}
