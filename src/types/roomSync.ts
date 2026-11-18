export type RoomSyncId = 'cafe' | 'concert' | 'party' | 'audiobook' | 'podcast';

export type RoomPeerConnectionType = 'bluetooth' | 'wifi';

export interface RoomPeerParticipant {
  id: string;
  deviceName: string;
  connectionType: RoomPeerConnectionType;
  isHost?: boolean;
  routed: boolean;
  joinedAt: string;
  avatarArchetype: number;
  isFemale?: boolean;
}

export interface SyncedTrackPayload {
  id: string;
  titleFa: string;
  titleEn: string;
  creatorFa?: string;
  creatorEn?: string;
  categoryFa?: string;
  categoryEn?: string;
  bpm: number;
  musicalKey?: string;
  posterUrl: string;
  accentHex: string;
  durationSec: number;
  mediaType?: 'music' | 'podcast' | 'audiobook' | 'cinema';
  audioUrl?: string;
  addedByDeviceName: string;
  addedVia: RoomPeerConnectionType | 'local';
  addedAt: string;
  aiPrompt?: string;
}

export interface RoomSyncSessionState {
  roomId: RoomSyncId;
  currentTrack: SyncedTrackPayload | null;
  isPlaying: boolean;
  playbackSeq: number;
  updatedAt: string;
  peers: RoomPeerParticipant[];
}

export interface NearbyRoomScanEntry {
  roomId: RoomSyncId;
  titleFa: string;
  titleEn: string;
  peerCount: number;
  signalType: RoomPeerConnectionType;
  signalStrength: number; // 65..99
  currentTrackTitleFa: string;
  currentTrackTitleEn: string;
  addedByDeviceName: string;
  peers: RoomPeerParticipant[];
}
