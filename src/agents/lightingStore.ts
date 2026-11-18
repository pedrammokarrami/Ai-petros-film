import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DEFAULT_ROOM_LIGHTING_PROFILES,
  LIGHTING_PRESETS,
  clampRoomLightingCalibration,
  type CalibrationRoomId,
  type RoomLightingCalibration
} from '../types/lighting.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_FILE = path.resolve(__dirname, '../../data/lighting-profiles.json');

type ProfileMap = Record<CalibrationRoomId, RoomLightingCalibration>;

function cloneDefaults(): ProfileMap {
  return {
    cafe: { ...DEFAULT_ROOM_LIGHTING_PROFILES.cafe },
    concert: { ...DEFAULT_ROOM_LIGHTING_PROFILES.concert },
    party: { ...DEFAULT_ROOM_LIGHTING_PROFILES.party },
    audiobook: { ...DEFAULT_ROOM_LIGHTING_PROFILES.audiobook },
    podcast: { ...DEFAULT_ROOM_LIGHTING_PROFILES.podcast }
  };
}

let inMemoryProfiles: ProfileMap | null = null;

function loadProfilesFromDisk(): ProfileMap {
  const base = cloneDefaults();
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ProfileMap>;
      (Object.keys(base) as CalibrationRoomId[]).forEach((roomId) => {
        if (parsed[roomId] && typeof parsed[roomId] === 'object') {
          base[roomId] = clampRoomLightingCalibration({
            ...base[roomId],
            ...parsed[roomId],
            roomId
          });
        }
      });
    }
  } catch {
    // Graceful fallback to physical defaults
  }
  return base;
}

function saveProfilesToDisk(profiles: ProfileMap): void {
  try {
    const dir = path.dirname(STORE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(profiles, null, 2), 'utf-8');
  } catch {
    // Ignore write failures in read-only runtimes
  }
}

function ensureProfiles(): ProfileMap {
  if (!inMemoryProfiles) {
    inMemoryProfiles = loadProfilesFromDisk();
  }
  return inMemoryProfiles;
}

export function isValidCalibrationRoomId(value: string): value is CalibrationRoomId {
  return ['cafe', 'concert', 'party', 'audiobook', 'podcast'].includes(value);
}

export function getAllLightingProfiles(): ProfileMap {
  const profiles = ensureProfiles();
  return {
    cafe: { ...profiles.cafe },
    concert: { ...profiles.concert },
    party: { ...profiles.party },
    audiobook: { ...profiles.audiobook },
    podcast: { ...profiles.podcast }
  };
}

export function getLightingProfile(roomId: CalibrationRoomId): RoomLightingCalibration {
  const profiles = ensureProfiles();
  return { ...profiles[roomId] };
}

export function updateLightingProfile(
  roomId: CalibrationRoomId,
  patch: Partial<RoomLightingCalibration>
): RoomLightingCalibration {
  const profiles = ensureProfiles();
  const current = profiles[roomId];
  const merged = clampRoomLightingCalibration({
    ...current,
    ...patch,
    roomId,
    updatedAt: new Date().toISOString()
  });
  profiles[roomId] = merged;
  saveProfilesToDisk(profiles);
  return { ...merged };
}

export function applyPresetToRoom(
  roomId: CalibrationRoomId,
  presetId: string
): RoomLightingCalibration {
  const base = { ...DEFAULT_ROOM_LIGHTING_PROFILES[roomId] };
  const preset = LIGHTING_PRESETS[presetId];
  if (!preset) {
    return updateLightingProfile(roomId, base);
  }
  const merged = clampRoomLightingCalibration({
    ...base,
    ...preset.patch,
    roomId,
    presetName: preset.labelEn,
    presetNameFa: preset.labelFa,
    notesFa: `${base.notesFa} (${preset.labelFa})`,
    updatedAt: new Date().toISOString()
  });
  const profiles = ensureProfiles();
  profiles[roomId] = merged;
  saveProfilesToDisk(profiles);
  return { ...merged };
}

export function resetLightingProfiles(roomId?: CalibrationRoomId): ProfileMap {
  const profiles = ensureProfiles();
  if (roomId) {
    profiles[roomId] = {
      ...DEFAULT_ROOM_LIGHTING_PROFILES[roomId],
      updatedAt: new Date().toISOString()
    };
  } else {
    inMemoryProfiles = cloneDefaults();
  }
  const next = ensureProfiles();
  saveProfilesToDisk(next);
  return getAllLightingProfiles();
}
