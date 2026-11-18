import { useMemo } from 'react';
import * as THREE from 'three';

export type PolyHavenTextureAssetId =
  | 'hinoki_planks'
  | 'brown_planks_07'
  | 'american_walnut_veneer'
  | 'corrugated_iron_03'
  | 'metal_plate';

export interface PolyHavenPBRMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

const sharedLoader = new THREE.TextureLoader();
const pbrCache = new Map<string, PolyHavenPBRMaps>();

function configureTiledTexture(
  tex: THREE.Texture,
  repeatX: number,
  repeatY: number,
  isSrgb: boolean
): THREE.Texture {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 16;
  tex.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Loads & caches a real Poly Haven 1K PBR Texture set (Diffuse + OpenGL Normal + Roughness)
 * from /public/textures/polyhaven/<assetId>/.
 */
export function getPolyHavenPBR(
  assetId: PolyHavenTextureAssetId,
  repeatX = 4,
  repeatY = 2
): PolyHavenPBRMaps {
  const key = `${assetId}:${repeatX}:${repeatY}`;
  const hit = pbrCache.get(key);
  if (hit) return hit;

  const base = `/textures/polyhaven/${assetId}`;
  const map = configureTiledTexture(sharedLoader.load(`${base}/diff.jpg`), repeatX, repeatY, true);
  const normalMap = configureTiledTexture(sharedLoader.load(`${base}/nor.jpg`), repeatX, repeatY, false);
  const roughnessMap = configureTiledTexture(sharedLoader.load(`${base}/rough.jpg`), repeatX, repeatY, false);

  const entry: PolyHavenPBRMaps = { map, normalMap, roughnessMap };
  pbrCache.set(key, entry);
  return entry;
}

export function createPolyHavenStandardMaterial(
  assetId: PolyHavenTextureAssetId,
  opts?: {
    repeatX?: number;
    repeatY?: number;
    color?: string;
    roughness?: number;
    metalness?: number;
    normalScale?: number;
    side?: THREE.Side;
  }
): THREE.MeshStandardMaterial {
  const maps = getPolyHavenPBR(assetId, opts?.repeatX ?? 4, opts?.repeatY ?? 2);
  const ns = opts?.normalScale ?? 0.85;
  return new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(ns, ns),
    roughnessMap: maps.roughnessMap,
    color: opts?.color ?? '#ffffff',
    roughness: opts?.roughness ?? 0.65,
    metalness: opts?.metalness ?? 0.06,
    side: opts?.side ?? THREE.FrontSide
  });
}

export function usePolyHavenPBR(
  assetId: PolyHavenTextureAssetId,
  repeatX = 4,
  repeatY = 2
): PolyHavenPBRMaps {
  return useMemo(() => getPolyHavenPBR(assetId, repeatX, repeatY), [assetId, repeatX, repeatY]);
}
