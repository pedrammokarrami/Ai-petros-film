import { FunctionTool, LlmAgent } from '@google/adk';
import { z } from 'zod';
import { isValidRoomSyncId, roomSyncCoordinator } from '../services/roomSyncServer.ts';
import type { RoomSyncId } from '../types/roomSync.ts';

export interface FastRoomSyncResult {
  agentName: 'room_sync_agent';
  framework: 'google-adk';
  latencyMs: number;
  nearbyRoomsCount: number;
  activeRoomId: RoomSyncId;
  activePeerCount: number;
  routedPeerCount: number;
  currentTrackTitleFa: string;
  summaryFa: string;
}

export function runFastRoomSyncOrchestrator(roomIdRaw?: string): FastRoomSyncResult {
  const started = performance.now();
  const roomId: RoomSyncId = roomIdRaw && isValidRoomSyncId(roomIdRaw) ? roomIdRaw : 'cafe';
  const state = roomSyncCoordinator.getRoomState(roomId);
  const nearby = roomSyncCoordinator.scanNearbyRooms();
  const routedCount = state.peers.filter((p) => p.routed).length;
  const latencyMs = Math.max(1, Math.round(performance.now() - started));

  return {
    agentName: 'room_sync_agent',
    framework: 'google-adk',
    latencyMs,
    nearbyRoomsCount: nearby.length,
    activeRoomId: roomId,
    activePeerCount: state.peers.length,
    routedPeerCount: routedCount,
    currentTrackTitleFa: state.currentTrack?.titleFa || 'آماده پخش',
    summaryFa: `${state.peers.length} دستگاه متصل (${routedCount} دستگاه در مسیر پخش هم‌زمان) در ${latencyMs}ms همگام‌سازی شدند.`
  };
}

export const inspectSonicRoomsTool = new FunctionTool({
  name: 'inspect_sonic_rooms',
  description:
    'Inspects live session state, connected Bluetooth/Wi-Fi peer devices, and current last-added track in a 3D sonic room.',
  parameters: z.object({
    roomId: z.enum(['cafe', 'concert', 'party', 'audiobook', 'podcast']).default('cafe')
  }),
  execute: async ({ roomId }) => {
    return roomSyncCoordinator.getRoomState(roomId);
  }
});

export const scanNearbySonicRoomsTool = new FunctionTool({
  name: 'scan_nearby_sonic_rooms',
  description:
    'Scans all nearby active Bluetooth/Wi-Fi sonic rooms and returns signal strength, peer devices, and currently playing track.',
  parameters: z.object({}),
  execute: async () => {
    return {
      rooms: roomSyncCoordinator.scanNearbyRooms()
    };
  }
});

export const toggleDeviceRouteTool = new FunctionTool({
  name: 'orchestrate_room_route',
  description: 'Enables or mutes simultaneous audio routing for a paired Bluetooth/Wi-Fi device in a room.',
  parameters: z.object({
    roomId: z.enum(['cafe', 'concert', 'party', 'audiobook', 'podcast']),
    peerId: z.string(),
    routed: z.boolean()
  }),
  execute: async ({ roomId, peerId, routed }) => {
    return roomSyncCoordinator.updatePeerRouting(roomId, peerId, routed);
  }
});

export const roomSyncAgent = new LlmAgent({
  name: 'room_sync_agent',
  model: 'gemini-4-hydrogen',
  description:
    'Fast local Google ADK coordinator for multi-device Bluetooth/Wi-Fi room routing, nearby scanning, and last-added-wins playback in aipetros-sound.',
  instruction:
    'Manage real-time WebSocket multi-device rooms, nearby room scanning, and last-added-wins track synchronization for aipetros-sound.',
  tools: [inspectSonicRoomsTool, scanNearbySonicRoomsTool, toggleDeviceRouteTool]
});
