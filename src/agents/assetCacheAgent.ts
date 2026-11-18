import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FunctionTool, LlmAgent } from '@google/adk';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_ROOT = path.resolve(__dirname, '../../public');

export interface GraphicAssetManifestEntry {
  url: string;
  category: 'models' | 'textures' | 'hdr' | 'icons' | 'assets';
  sizeBytes: number;
}

export interface GraphicAssetManifestPayload {
  agentName: 'asset_cache_agent';
  framework: 'google-adk';
  product: 'aipetros-sound';
  generatedAt: string;
  totalFiles: number;
  totalBytes: number;
  assets: GraphicAssetManifestEntry[];
}

const VALID_GRAPHIC_EXT = /\.(glb|gltf|bin|hdr|exr|jpg|jpeg|png|webp|svg|wasm)$/i;

let cachedManifest: GraphicAssetManifestPayload | null = null;

function walkDirectory(
  dirPath: string,
  category: GraphicAssetManifestEntry['category'],
  out: GraphicAssetManifestEntry[]
) {
  if (!fs.existsSync(dirPath)) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(full, category, out);
    } else if (entry.isFile() && VALID_GRAPHIC_EXT.test(entry.name)) {
      try {
        const stat = fs.statSync(full);
        const rel = path.relative(PUBLIC_ROOT, full).replace(/\\/g, '/');
        out.push({
          url: `/${rel}`,
          category,
          sizeBytes: stat.size
        });
      } catch {
        // ignore unreadable file
      }
    }
  }
}

export function getGraphicAssetManifest(forceRefresh = false): GraphicAssetManifestPayload {
  if (cachedManifest && !forceRefresh) {
    return cachedManifest;
  }

  const assets: GraphicAssetManifestEntry[] = [];
  walkDirectory(path.join(PUBLIC_ROOT, 'models'), 'models', assets);
  walkDirectory(path.join(PUBLIC_ROOT, 'textures'), 'textures', assets);
  walkDirectory(path.join(PUBLIC_ROOT, 'hdr'), 'hdr', assets);
  walkDirectory(path.join(PUBLIC_ROOT, 'hdri'), 'hdr', assets);
  walkDirectory(path.join(PUBLIC_ROOT, 'assets', 'images'), 'assets', assets);

  for (const iconFile of [
    'icon.svg',
    'apple-touch-icon.png',
    'pwa-192x192.png',
    'pwa-512x512.png',
    'pwa-maskable-512x512.png'
  ]) {
    const full = path.join(PUBLIC_ROOT, iconFile);
    if (fs.existsSync(full)) {
      try {
        const stat = fs.statSync(full);
        assets.push({
          url: `/${iconFile}`,
          category: 'icons',
          sizeBytes: stat.size
        });
      } catch {
        // ignore
      }
    }
  }

  // Sort smaller textures/icons/studios first, then heavier concert/human GLBs so startup feels instant
  assets.sort((a, b) => a.sizeBytes - b.sizeBytes);

  const totalBytes = assets.reduce((sum, item) => sum + item.sizeBytes, 0);
  cachedManifest = {
    agentName: 'asset_cache_agent',
    framework: 'google-adk',
    product: 'aipetros-sound',
    generatedAt: new Date().toISOString(),
    totalFiles: assets.length,
    totalBytes,
    assets
  };
  return cachedManifest;
}

export const collectGraphicAssetManifestTool = new FunctionTool({
  name: 'collect_graphic_asset_manifest',
  description:
    'Inventories all 3D GLB models, Poly Haven PBR textures, HDRIs, and graphic icons required for zero-stutter offline caching on user devices.',
  parameters: z.object({
    refresh: z.boolean().optional().default(false)
  }),
  execute: async ({ refresh }) => {
    return getGraphicAssetManifest(Boolean(refresh));
  }
});

export const assetCacheAgent = new LlmAgent({
  name: 'asset_cache_agent',
  model: 'gemini-4-hydrogen',
  description:
    'Local Google ADK asset & graphic pack controller for aipetros-sound ensuring all 3D models, PBR textures, and HDRIs download locally right after launch.',
  instruction:
    'Coordinate full client-side offline graphic pack manifests so all 3D rooms and cassette studio graphics load instantaneously.',
  tools: [collectGraphicAssetManifestTool]
});
