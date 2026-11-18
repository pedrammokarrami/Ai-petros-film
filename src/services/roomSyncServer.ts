import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  NearbyRoomScanEntry,
  RoomPeerConnectionType,
  RoomPeerParticipant,
  RoomSyncId,
  RoomSyncSessionState,
  SyncedTrackPayload
} from '../types/roomSync.ts';

const VALID_ROOM_IDS: RoomSyncId[] = ['cafe', 'concert', 'party', 'audiobook', 'podcast'];

const ROOM_TITLES: Record<RoomSyncId, { fa: string; en: string; signal: RoomPeerConnectionType }> = {
  cafe: { fa: 'اتاق کافه', en: 'Cafe Room', signal: 'wifi' },
  concert: { fa: 'اتاق کنسرت', en: 'Concert Room', signal: 'wifi' },
  party: { fa: 'اتاق پارتی', en: 'Party Room', signal: 'bluetooth' },
  audiobook: { fa: 'کتابخانه صوتی', en: 'Audio Library', signal: 'wifi' },
  podcast: { fa: 'اتاق پادکست', en: 'Podcast Room', signal: 'bluetooth' }
};

export function isValidRoomSyncId(value: string): value is RoomSyncId {
  return (VALID_ROOM_IDS as string[]).includes(value);
}

interface WsClientMeta {
  ws: WebSocket;
  roomId: RoomSyncId;
  peerId?: string;
}

class RoomSyncCoordinator {
  private rooms = new Map<RoomSyncId, RoomSyncSessionState>();
  private clients = new Set<WsClientMeta>();

  constructor() {
    const now = new Date().toISOString();
    this.rooms.set('cafe', {
      roomId: 'cafe',
      currentTrack: {
        id: 'music-02',
        titleFa: 'باران مخملی در کافه جَز',
        titleEn: 'Velvet Rain Over Jazz Cafe',
        creatorFa: 'لوران دوبوا کوارتت',
        creatorEn: 'Laurent Dubois Quartet',
        bpm: 92,
        musicalKey: 'Cm',
        posterUrl: '/assets/aistudio/image_12f14924.png',
        accentHex: '#F5B942',
        durationSec: 264,
        mediaType: 'music',
        addedByDeviceName: 'MacBook Pro · Studio',
        addedVia: 'wifi',
        addedAt: now
      },
      isPlaying: true,
      playbackSeq: 1,
      updatedAt: now,
      peers: [
        {
          id: 'seed-cafe-1',
          deviceName: 'MacBook Pro · Studio',
          connectionType: 'wifi',
          isHost: true,
          routed: true,
          joinedAt: now,
          avatarArchetype: 2,
          isFemale: false
        },
        {
          id: 'seed-cafe-2',
          deviceName: 'Marshall Emberton',
          connectionType: 'bluetooth',
          routed: true,
          joinedAt: now,
          avatarArchetype: 9,
          isFemale: true
        }
      ]
    });

    this.rooms.set('concert', {
      roomId: 'concert',
      currentTrack: {
        id: 'music-04',
        titleFa: 'سمفونی روشنایی صحنه',
        titleEn: 'Stage Horizon Symphony',
        creatorFa: 'آرمان فراهانی و ارکستر زنده',
        creatorEn: 'Arman Live Orchestra',
        bpm: 122,
        musicalKey: 'F#m',
        posterUrl: '/assets/aistudio/image_cbaca63a.png',
        accentHex: '#E879F9',
        durationSec: 295,
        mediaType: 'music',
        addedByDeviceName: 'iPhone 16 Pro · Aria',
        addedVia: 'wifi',
        addedAt: now
      },
      isPlaying: true,
      playbackSeq: 1,
      updatedAt: now,
      peers: [
        {
          id: 'seed-concert-1',
          deviceName: 'iPhone 16 Pro · Aria',
          connectionType: 'wifi',
          isHost: true,
          routed: true,
          joinedAt: now,
          avatarArchetype: 6,
          isFemale: true
        }
      ]
    });

    this.rooms.set('party', {
      roomId: 'party',
      currentTrack: {
        id: 'music-03',
        titleFa: 'نبض زیرزمینی برلین',
        titleEn: 'Berlin Warehouse Pulse',
        creatorFa: 'کلکتیو ساب‌بیس',
        creatorEn: 'SubBass Collective',
        bpm: 128,
        musicalKey: 'Fm',
        posterUrl: '/assets/aistudio/IMG_4476_612f85f5.png',
        accentHex: '#00F0FF',
        durationSec: 248,
        mediaType: 'music',
        addedByDeviceName: 'JBL PartyBox 310',
        addedVia: 'bluetooth',
        addedAt: now
      },
      isPlaying: true,
      playbackSeq: 1,
      updatedAt: now,
      peers: [
        {
          id: 'seed-party-1',
          deviceName: 'JBL PartyBox 310',
          connectionType: 'bluetooth',
          routed: true,
          joinedAt: now,
          avatarArchetype: 14,
          isFemale: false
        },
        {
          id: 'seed-party-2',
          deviceName: 'Galaxy S25 Ultra',
          connectionType: 'wifi',
          isHost: true,
          routed: true,
          joinedAt: now,
          avatarArchetype: 18,
          isFemale: true
        }
      ]
    });

    this.rooms.set('audiobook', {
      roomId: 'audiobook',
      currentTrack: {
        id: 'book-01',
        titleFa: 'معماری سکوت و زمان',
        titleEn: 'Architecture of Silence & Time',
        creatorFa: 'رادیو کتابخانه آتر',
        creatorEn: 'Aether Archive Press',
        bpm: 78,
        musicalKey: 'Dm',
        posterUrl: '/assets/aistudio/9A3FD16D-1B6F-4B5B-83D4-7245A8C33245_b3d6c6a1.png',
        accentHex: '#FBBF24',
        durationSec: 540,
        mediaType: 'audiobook',
        addedByDeviceName: 'iPad Pro · Sara',
        addedVia: 'wifi',
        addedAt: now
      },
      isPlaying: false,
      playbackSeq: 1,
      updatedAt: now,
      peers: [
        {
          id: 'seed-book-1',
          deviceName: 'iPad Pro · Sara',
          connectionType: 'wifi',
          routed: true,
          joinedAt: now,
          avatarArchetype: 4,
          isFemale: true
        }
      ]
    });

    this.rooms.set('podcast', {
      roomId: 'podcast',
      currentTrack: {
        id: 'podcast-01',
        titleFa: 'گفتگوی نیمه‌شب درباره صدای فضایی',
        titleEn: 'Midnight Spatial Sound Dialogues',
        creatorFa: 'استودیو پادکست اتر',
        creatorEn: 'Aether Broadcast Lab',
        bpm: 102,
        musicalKey: 'Am',
        posterUrl: '/assets/aistudio/9A3FD16D-1B6F-4B5B-83D4-7245A8C33245_b3d6c6a1.png',
        accentHex: '#A78BFA',
        durationSec: 420,
        mediaType: 'podcast',
        addedByDeviceName: 'Sony WH-1000XM5',
        addedVia: 'bluetooth',
        addedAt: now
      },
      isPlaying: false,
      playbackSeq: 1,
      updatedAt: now,
      peers: [
        {
          id: 'seed-podcast-1',
          deviceName: 'Sony WH-1000XM5',
          connectionType: 'bluetooth',
          routed: true,
          joinedAt: now,
          avatarArchetype: 11,
          isFemale: false
        }
      ]
    });
  }

  public getRoomState(roomId: RoomSyncId): RoomSyncSessionState {
    const state = this.rooms.get(roomId);
    if (!state) {
      throw new Error(`Unknown roomId: ${roomId}`);
    }
    return state;
  }

  public joinPeer(
    roomId: RoomSyncId,
    input: {
      peerId: string;
      deviceName: string;
      connectionType: RoomPeerConnectionType;
      isHost?: boolean;
      routed?: boolean;
    }
  ): RoomSyncSessionState {
    const room = this.getRoomState(roomId);
    const cleanName = input.deviceName.trim().slice(0, 36) || 'Guest Device';
    const existingIdx = room.peers.findIndex(
      (p) =>
        p.id === input.peerId ||
        (p.deviceName.toLowerCase() === cleanName.toLowerCase() &&
          p.connectionType === input.connectionType)
    );

    const hash = cleanName.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
    const peerRecord: RoomPeerParticipant = {
      id: existingIdx >= 0 ? room.peers[existingIdx].id : input.peerId,
      deviceName: cleanName,
      connectionType: input.connectionType,
      isHost: Boolean(input.isHost),
      routed: input.routed !== false,
      joinedAt: new Date().toISOString(),
      avatarArchetype: Math.abs(hash) % 22,
      isFemale: Math.abs(hash) % 2 === 1
    };

    if (existingIdx >= 0) {
      room.peers[existingIdx] = peerRecord;
    } else {
      room.peers.push(peerRecord);
    }

    room.updatedAt = new Date().toISOString();
    this.broadcastRoomState(roomId);
    return room;
  }

  public leavePeer(roomId: RoomSyncId, peerId: string): RoomSyncSessionState {
    const room = this.getRoomState(roomId);
    room.peers = room.peers.filter((p) => p.id !== peerId);
    room.updatedAt = new Date().toISOString();
    this.broadcastRoomState(roomId);
    return room;
  }

  public updatePeerRouting(
    roomId: RoomSyncId,
    peerId: string,
    routed: boolean
  ): RoomSyncSessionState {
    const room = this.getRoomState(roomId);
    room.peers = room.peers.map((p) => (p.id === peerId ? { ...p, routed } : p));
    room.updatedAt = new Date().toISOString();
    this.broadcastRoomState(roomId);
    return room;
  }

  /**
   * Collaborative Open Queue: Last-Added-Track Always Wins and Immediately Plays
   */
  public setRoomTrackLastWins(
    roomId: RoomSyncId,
    track: SyncedTrackPayload
  ): RoomSyncSessionState {
    const room = this.getRoomState(roomId);
    const cleanDevice = track.addedByDeviceName?.trim() || 'Guest Device';

    room.currentTrack = {
      ...track,
      addedByDeviceName: cleanDevice,
      addedAt: track.addedAt || new Date().toISOString()
    };
    room.isPlaying = true;
    room.playbackSeq += 1;
    room.updatedAt = new Date().toISOString();

    // Ensure attributing device appears as a connected character in the room if not present
    if (track.addedVia === 'bluetooth' || track.addedVia === 'wifi') {
      const hasPeer = room.peers.some(
        (p) => p.deviceName.toLowerCase() === cleanDevice.toLowerCase()
      );
      if (!hasPeer) {
        const hash = cleanDevice.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 11);
        room.peers.push({
          id: `peer-${Math.abs(hash)}`,
          deviceName: cleanDevice,
          connectionType: track.addedVia,
          routed: true,
          joinedAt: new Date().toISOString(),
          avatarArchetype: Math.abs(hash) % 22,
          isFemale: Math.abs(hash) % 2 === 1
        });
      }
    }

    this.broadcastRoomState(roomId);
    return room;
  }

  public setRoomPlayback(roomId: RoomSyncId, isPlaying: boolean): RoomSyncSessionState {
    const room = this.getRoomState(roomId);
    room.isPlaying = isPlaying;
    room.updatedAt = new Date().toISOString();
    this.broadcastRoomState(roomId);
    return room;
  }

  public scanNearbyRooms(): NearbyRoomScanEntry[] {
    return VALID_ROOM_IDS.map((roomId, idx) => {
      const room = this.getRoomState(roomId);
      const meta = ROOM_TITLES[roomId];
      const hasBt = room.peers.some((p) => p.connectionType === 'bluetooth');
      return {
        roomId,
        titleFa: meta.fa,
        titleEn: meta.en,
        peerCount: room.peers.length,
        signalType: hasBt ? 'bluetooth' : meta.signal,
        signalStrength: Math.min(99, 76 + room.peers.length * 5 + ((idx * 3) % 7)),
        currentTrackTitleFa: room.currentTrack?.titleFa || 'آماده پخش',
        currentTrackTitleEn: room.currentTrack?.titleEn || 'Ready',
        addedByDeviceName: room.currentTrack?.addedByDeviceName || 'Room Host',
        peers: room.peers
      };
    });
  }

  public attachWebSocketServer(httpServer: HttpServer): void {
    const wss = new WebSocketServer({ server: httpServer, path: '/ws/rooms' });

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '/ws/rooms', 'http://localhost');
      const rawRoom = String(url.searchParams.get('roomId') || 'cafe');
      const roomId: RoomSyncId = isValidRoomSyncId(rawRoom) ? rawRoom : 'cafe';
      const peerId = url.searchParams.get('peerId') || undefined;

      const meta: WsClientMeta = { ws, roomId, peerId };
      this.clients.add(meta);

      // Send immediate snapshot on join
      ws.send(
        JSON.stringify({
          type: 'room_state',
          state: this.getRoomState(roomId)
        })
      );

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw || '{}')) as {
            type?: string;
            roomId?: string;
            peer?: {
              peerId: string;
              deviceName: string;
              connectionType: RoomPeerConnectionType;
              isHost?: boolean;
              routed?: boolean;
            };
            track?: SyncedTrackPayload;
            isPlaying?: boolean;
            peerId?: string;
            routed?: boolean;
          };

          const targetRoom =
            msg.roomId && isValidRoomSyncId(msg.roomId) ? msg.roomId : meta.roomId;

          if (msg.type === 'switch_subscription' && msg.roomId && isValidRoomSyncId(msg.roomId)) {
            meta.roomId = msg.roomId;
            ws.send(
              JSON.stringify({
                type: 'room_state',
                state: this.getRoomState(meta.roomId)
              })
            );
            return;
          }

          if (msg.type === 'join_peer' && msg.peer) {
            meta.peerId = msg.peer.peerId;
            this.joinPeer(targetRoom, msg.peer);
          } else if (msg.type === 'push_track' && msg.track) {
            this.setRoomTrackLastWins(targetRoom, msg.track);
          } else if (msg.type === 'toggle_route' && msg.peerId) {
            this.updatePeerRouting(targetRoom, msg.peerId, Boolean(msg.routed));
          } else if (msg.type === 'playback' && typeof msg.isPlaying === 'boolean') {
            this.setRoomPlayback(targetRoom, msg.isPlaying);
          }
        } catch {
          // ignore malformed messages
        }
      });

      ws.on('close', () => {
        this.clients.delete(meta);
      });
    });
  }

  private broadcastRoomState(roomId: RoomSyncId): void {
    const state = this.getRoomState(roomId);
    const payload = JSON.stringify({
      type: 'room_state',
      state
    });
    for (const client of this.clients) {
      if (client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }
}

export const roomSyncCoordinator = new RoomSyncCoordinator();
