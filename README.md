# aipetros-sound — Spatial 3D Music, Podcast & Listening Rooms

Production-ready React 19 + Three.js (`@react-three/fiber` / `@react-three/drei`) + Express full-stack spatial audio platform with 5 interactive 3D rooms, real-time multi-device room sync (Bluetooth / Wi-Fi pairing & simultaneous routing), and an installable offline-first PWA.

---

## Quick Start

```bash
npm install
npm run dev       # Starts full-stack Express + Vite server on port 3000
npm run build     # Builds production client bundle into dist/
npm start         # Runs production server (tsx / node server.ts)
```

---

## 3D Graphics & Blender Handoff Guide (for `arjun988/blender-skills`)

This repository is structured for direct `.glb` / PBR / lighting upgrades via **Blender + `blender-skills`**:

### 1. Five Spatial 3D Rooms (`src/scenes/`)
- **Cafe / Saloon (`cafe`)**: `src/scenes/cafe/CafeRoomScene.tsx`
- **Underground Party (`party`)**: `src/scenes/party/PartyRoomScene.tsx`
- **Royal Library / Audiobook (`audiobook`)**: `src/scenes/library/LibraryRoomScene.tsx`
- **Live Concert Hall (`concert`)**: `src/scenes/concert/ConcertHallScene.tsx`
- **Broadcast Podcast Studio (`podcast`)**: `src/scenes/podcast/PodcastRoomScene.tsx`
- **Shared Rigged Characters, Lighting & Postprocessing**:
  - `src/scenes/shared/SonicRoomShared.tsx` (`RiggedHumanAvatar`, `ProceduralRoomEnvironment`, `RoomCanvasFrame`, `N8AO` / `Bloom` / `ToneMapping`)
  - `src/scenes/shared/RoomPeerAvatars.tsx` (`assignPeersToCastSlots`, `PeerOverheadBadge` — maps joined friends directly onto seated/performing cast characters)
  - `src/scenes/shared/polyhavenTextures.ts` (PBR tileable wood, stone, metal textures)
- **Discover Cassette Studio**:
  - `src/prototype/components/StudioCassette3DScene.tsx` (`/models/studio/cassette-deck.glb`)

### 2. Local 3D Assets (`public/`)
- `public/models/cafe/` — Saloon character GLBs (`bartender`, `saloonLady`, `gunslinger`, `rancher`, `gambler`)
- `public/models/concert/` — Stage performers, rigged dancers, and Mixamo-compatible mocap `.glb` clips
- `public/models/podcast/` — Seated podcast host & co-host GLBs
- `public/models/studio/` — `cassette-deck.glb` hero prop
- `public/textures/polyhaven/` — Albedo, normal, and roughness maps (preloaded offline via `src/services/roomAssetPreloader.ts`)
- `public/hdr/`, `public/hdri/` — Room environment HDRIs

### 3. Recommended Blender Export Conventions
When generating or replacing props/characters/environments with Blender (`blender-skills`):
1. Export as Draco-compressed **`.glb`** (sRGB Color maps, Linear Normal/Roughness/Metalness ORM maps, `Y-up`, meters scale).
2. Keep skeletal rigs Mixamo-compatible (`mixamorigHips` / `mixamorigHead` / `mixamorigSpine` / arms) or RPM (`Hips` / `Head`) so `RiggedHumanAvatar` & `buildHumanActivityClip` bind seamlessly.
3. Preserve ground/chair pivot discipline (`minY = 0` for standing props/characters; chair surface height documented for seated characters).
4. After replacing or adding assets under `public/models/` or `src/scenes/`, run:
   ```bash
   npx tsc --noEmit
   npm run build
   ```

---

## Deployment Notes (`vercel.json` & Standalone Server)
- Preconfigured for Vercel (`vercel.json` + serverless handler `api/index.ts`) and Express standalone (`server.ts` with HSTS / HTTPS `.dev` readiness).
- Set optional environment variables in `.env` (see `.env.example`).
