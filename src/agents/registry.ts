import { lightingDirectorAgent, rootAgent } from './lightingAgent.ts';
import { soundCuratorAgent, runFastSoundCurator, type CurateCatalogCandidate } from './soundCuratorAgent.ts';
import { roomSyncAgent, runFastRoomSyncOrchestrator } from './roomSyncAgent.ts';
import { assetCacheAgent, getGraphicAssetManifest } from './assetCacheAgent.ts';
import { getAllLightingProfiles } from './lightingStore.ts';

export interface LocalAdkAgentSummary {
  id: string;
  name: string;
  titleFa: string;
  framework: 'google-adk';
  docsUrl: 'https://adk.dev/';
  model: string;
  descriptionFa: string;
  tools: string[];
  endpoint: string;
}

export const LOCAL_ADK_AGENTS: LocalAdkAgentSummary[] = [
  {
    id: lightingDirectorAgent.name,
    name: lightingDirectorAgent.name,
    titleFa: 'ایجنت کارگردان نورپردازی سه‌بعدی',
    framework: 'google-adk',
    docsUrl: 'https://adk.dev/',
    model: 'gemini-4-hydrogen',
    descriptionFa:
      'کنترل سریع و زنده نورپردازی فیزیکی ۵ اتاق سه‌بعدی، سایه، افت فاصله و هماهنگی با موسیقی',
    tools: ['inspect_room_lighting', 'calibrate_room_lighting', 'apply_lighting_preset'],
    endpoint: '/api/agents/lighting/tune'
  },
  {
    id: soundCuratorAgent.name,
    name: soundCuratorAgent.name,
    titleFa: 'ایجنت کیوریتور صوت و استودیو کاست',
    framework: 'google-adk',
    docsUrl: 'https://adk.dev/',
    model: 'gemini-4-hydrogen',
    descriptionFa:
      'رتبه‌بندی هوشمند قطعات، تنظیم افکت آنالوگ نوار کاست (سرعت، گرما، اکو) و جستجوی معنایی زیر ۵ میلی‌ثانیه',
    tools: ['curate_room_soundtrack', 'tune_tape_deck_fx'],
    endpoint: '/api/agents/orchestrate'
  },
  {
    id: roomSyncAgent.name,
    name: roomSyncAgent.name,
    titleFa: 'ایجنت همگام‌سازی اتاق‌ها و دستگاه‌ها',
    framework: 'google-adk',
    docsUrl: 'https://adk.dev/',
    model: 'gemini-4-hydrogen',
    descriptionFa:
      'مدیریت بلوتوث و وای‌فای دوستان، مسیردهی هم‌زمان چند دستگاه و اجرای فوری آخرین آهنگ اضافه‌شده',
    tools: ['inspect_sonic_rooms', 'scan_nearby_sonic_rooms', 'orchestrate_room_route'],
    endpoint: '/api/agents/orchestrate'
  },
  {
    id: assetCacheAgent.name,
    name: assetCacheAgent.name,
    titleFa: 'ایجنت دانلود و کش آفلاین گرافیک',
    framework: 'google-adk',
    docsUrl: 'https://adk.dev/',
    model: 'gemini-4-hydrogen',
    descriptionFa:
      'فهرست‌برداری و آماده‌سازی تمام فایل‌های GLB، تکسچرهای PBR و HDRI برای دانلود و اجرای بدون تاخیر روی سیستم و موبایل',
    tools: ['collect_graphic_asset_manifest'],
    endpoint: '/api/assets/manifest'
  }
];

export type FastOrchestrateDomain = 'search' | 'cassette' | 'rooms' | 'graphics';

export function orchestrateFastAdkAgent(params: {
  domain: FastOrchestrateDomain;
  roomId?: string;
  query?: string;
  catalog?: CurateCatalogCandidate[];
}) {
  const started = performance.now();
  if (params.domain === 'search' || params.domain === 'cassette') {
    const sound = runFastSoundCurator({
      action: params.domain === 'cassette' ? 'tune_tape' : 'curate',
      roomId: params.roomId,
      query: params.query,
      catalog: params.catalog
    });
    return {
      product: 'aipetros-sound',
      domain: params.domain,
      sound,
      lightingProfiles: getAllLightingProfiles(),
      latencyMs: Math.max(1, Math.round(performance.now() - started))
    };
  }

  if (params.domain === 'rooms') {
    const roomSync = runFastRoomSyncOrchestrator(params.roomId);
    const sound = runFastSoundCurator({
      action: 'curate',
      roomId: roomSync.activeRoomId,
      query: params.query
    });
    return {
      product: 'aipetros-sound',
      domain: 'rooms',
      roomSync,
      sound,
      lightingProfiles: getAllLightingProfiles(),
      latencyMs: Math.max(1, Math.round(performance.now() - started))
    };
  }

  const manifest = getGraphicAssetManifest();
  return {
    product: 'aipetros-sound',
    domain: 'graphics',
    manifestSummary: {
      totalFiles: manifest.totalFiles,
      totalBytes: manifest.totalBytes
    },
    latencyMs: Math.max(1, Math.round(performance.now() - started))
  };
}

export { rootAgent, lightingDirectorAgent, soundCuratorAgent, roomSyncAgent, assetCacheAgent };
