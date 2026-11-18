import type {
  MediaDomainType,
  PrototypeMediaItem,
  UniverseRealmFilter,
  UserAccountState
} from './types';

import posterRainDetective from '../assets/images/poster_rain_detective_1794572116567.jpg';
import posterNeonTokyo from '../assets/images/poster_neon_tokyo_1794572116252.jpg';
import posterSurrealLabyrinth from '../assets/images/poster_surreal_labyrinth_1794572117376.jpg';
import posterParisianShadow from '../assets/images/poster_parisian_shadow_1794572118475.jpg';
import posterAlpineMystery from '../assets/images/poster_alpine_mystery_1794572117720.jpg';
import posterCyberMemory from '../assets/images/poster_cyber_memory_1794572117940.jpg';
import posterCrimsonMotel from '../assets/images/poster_crimson_motel_1794572119002.jpg';
import imgAmberHotel from '../assets/images/editorial_amber_hotel_noir_1794443435341.jpg';
import imgCrimsonSuite from '../assets/images/boudoir_crimson_silk_suite_1794443433215.jpg';
import imgMidnightParis from '../assets/images/cinema_midnight_express_paris_1794408998635.jpg';
import imgVelvetRain from '../assets/images/cinema_noir_velvet_rain_1794398988857.jpg';
import imgObsidianSonata from '../assets/images/cinema_obsidian_sonata_1794398992852.jpg';
import imgQuantumOasis from '../assets/images/ai_cinema_quantum_oasis_1794408994686.jpg';
import imgSolarisMirage from '../assets/images/ai_cinema_solaris_mirage_1794398990412.jpg';
import imgCyberRequiem from '../assets/images/animation_cyber_requiem_1794398991552.jpg';
import imgVelvetSamurai from '../assets/images/animation_velvet_samurai_1794408997353.jpg';
import imgAstralSiren from '../assets/images/animation_astral_siren_1794408998072.jpg';
import imgEclipseBloom from '../assets/images/ai_animation_eclipse_bloom_1794398992909.jpg';
import imgKiroshiHub from '../assets/images/kiroshi_neural_hub_1794586050574.jpg';
import imgCrimsonPenthouse from '../assets/images/cinema_crimson_penthouse_1794408993203.jpg';
import imgNeonBoudoir from '../assets/images/anime_nocturne_neon_boudoir_1794443444307.jpg';

export function inferMediaDomain(item: PrototypeMediaItem): MediaDomainType {
  if (item.mediaType && item.mediaType !== 'cinema') return item.mediaType;
  if (item.id.startsWith('podcast-')) return 'podcast';
  if (item.id.startsWith('book-')) return 'audiobook';
  return 'music';
}

export function filterCatalogByRealm(
  catalog: PrototypeMediaItem[],
  realm: UniverseRealmFilter
): PrototypeMediaItem[] {
  if (realm === 'all' || realm === 'all_audio') {
    return catalog.filter((item) => {
      const domain = inferMediaDomain(item);
      return domain === 'music' || domain === 'podcast' || domain === 'audiobook';
    });
  }
  return catalog.filter((item) => inferMediaDomain(item) === realm);
}

export const AUDIO_MEDIA_CATALOG: PrototypeMediaItem[] = [
  // =========================================================================
  // MUSIC (موسیقی) — Synthwave, Deep Melodic Techno, Noir Jazz, Classical, Ambient
  // =========================================================================
  {
    id: 'music-01',
    mediaType: 'music',
    bpm: 122,
    musicalKey: 'F#m',
    audioSpec: 'Lossless 24-Bit / 192kHz · Dolby Atmos',
    titleFa: 'ضربانِ نیمه‌شب در ایستگاهِ نئون',
    titleEn: 'Midnight Pulse at Neon Station',
    creatorFa: 'آکیرا ساتو و ارکستر آنالوگ کیوتو',
    creatorEn: 'Akira Sato & Kyoto Analog Ensemble',
    categoryFa: 'موسیقی · سینت‌ویو و ملودیک تکنو',
    categoryEn: 'Music · Melodic Synthwave & Techno',
    clusterId: 'midnight-sound',
    clusterLabelFa: 'موسیقی و ریتم شب',
    clusterLabelEn: 'Midnight Sound',
    durationSec: 348,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 0,
    posterUrl: posterNeonTokyo,
    accentHex: '#00F0FF',
    synopsisFa:
      'قطعه سینت‌ویو و ملودیک تکنو با بیس‌لاین آنالوگ عمیق (۱۲۲ BPM در گام فا دیز مینور)، مناسب برای رانندگی شبانه و میکس در استودیو دی‌جی.',
    synopsisEn:
      'Deep analog synthwave and melodic techno roller at 122 BPM in F# minor with warm prophet pads and spatial sub-bass.',
    tags: ['music', 'synthwave', 'techno', 'dj-ready', 'neon', 'electronic', 'tokyo'],
    tagsFa: ['موسیقی', 'سینت‌ویو', 'تکنو', 'دی‌جی', 'الکترونیک', 'نئون', 'شبانه'],
    vector: { tension: 0.78, pace: 0.82, surrealism: 0.64, nocturnal: 0.96, intimacy: 0.52, depth: 0.86 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Aether Mastering Studio',
    subtitles: [
      { startSec: 0, endSec: 8, fa: '♪ [ورود سینتی‌سایزر آنالوگ و پالس ساب‌بیس — ۱۲۲ BPM]', en: '♪ [Analog Prophet Pad & Sub-Bass Pulse — 122 BPM]' },
      { startSec: 8, endSec: 18, fa: 'در امتداد بزرگراه بارانی، چراغ‌های شهر به نت‌های کهربایی تبدیل می‌شوند...', en: 'Along the rain-slicked expressway, city lights dissolve into amber notes...' },
      { startSec: 18, endSec: 30, fa: '♪ [اوج‌گیری آرپژ نئونی و درامز فضایی]', en: '♪ [Neon Arpeggio Crescendo & Spatial Percussion Drop]' }
    ],
    chapters: [
      { id: 'm1-c1', timeSec: 0, labelFa: 'اینترو آنالوگ (Cue 1)', labelEn: 'Analog Intro (Cue 1)' },
      { id: 'm1-c2', timeSec: 64, labelFa: 'بیس‌لاین اصلی (Drop A)', labelEn: 'Main Bassline (Drop A)' },
      { id: 'm1-c3', timeSec: 180, labelFa: 'بریک‌داون فضایی (Breakdown)', labelEn: 'Atmospheric Breakdown' },
      { id: 'm1-c4', timeSec: 240, labelFa: 'اوج پایانی (Climax Drop)', labelEn: 'Climax Drop (Cue 4)' }
    ],
    spatialPos: { x: 26, y: 30, z: 0.92 }
  },
  {
    id: 'music-02',
    mediaType: 'music',
    bpm: 92,
    musicalKey: 'Cm',
    audioSpec: 'Master FLAC 24-Bit · Vinyl Warmth',
    titleFa: 'ساکسیفونِ بارانی در کافه پاریس',
    titleEn: 'Rain-Soaked Saxophone in Paris',
    creatorFa: 'لوران دوبوا کوارتت',
    creatorEn: 'Laurent Dubois Noir Quartet',
    categoryFa: 'موسیقی · جاز نوار و بلوز شبانه',
    categoryEn: 'Music · Late-Night Noir Jazz',
    clusterId: 'noir-shadows',
    clusterLabelFa: 'جاز و سایه‌های نوار',
    clusterLabelEn: 'Noir Shadows',
    durationSec: 412,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 1,
    posterUrl: posterParisianShadow,
    accentHex: '#F5B942',
    synopsisFa:
      'بداهه‌نوازی ساکسیفون تنور، کنترباس چوبی و پیانو با صدای باران طبیعی روی شیشه‌های کافه‌ای در پاریس (۹۲ BPM).',
    synopsisEn:
      'Smoky tenor saxophone, upright contrabass, and brushed snare recorded live against midnight Paris rainfall (92 BPM, C minor).',
    tags: ['music', 'jazz', 'noir', 'saxophone', 'rain', 'calm', 'acoustic'],
    tagsFa: ['موسیقی', 'جاز', 'ساکسیفون', 'بارانی', 'نوار', 'آرام', 'پاریس'],
    vector: { tension: 0.56, pace: 0.34, surrealism: 0.38, nocturnal: 0.95, intimacy: 0.89, depth: 0.91 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Seine Acoustic Vault',
    subtitles: [
      { startSec: 0, endSec: 9, fa: '♪ [تک‌نوازی کنترباس و صدای باران روی سنگ‌فرش]', en: '♪ [Upright Contrabass Solo & Rain on Cobblestones]' },
      { startSec: 9, endSec: 22, fa: '♪ [ورود ساکسیفون تنور با تم نوار کلاسیک در گام دو مینور]', en: '♪ [Tenor Saxophone Enters with Classic Noir Theme in C Minor]' }
    ],
    chapters: [
      { id: 'm2-c1', timeSec: 0, labelFa: 'پیش‌درآمد باران', labelEn: 'Rain Prelude' },
      { id: 'm2-c2', timeSec: 95, labelFa: 'سولوی ساکسیفون', labelEn: 'Tenor Sax Solo' },
      { id: 'm2-c3', timeSec: 280, labelFa: 'فرود پیانو', labelEn: 'Piano Outro' }
    ],
    spatialPos: { x: 20, y: 55, z: 0.88 }
  },
  {
    id: 'music-03',
    mediaType: 'music',
    bpm: 126,
    musicalKey: 'Am',
    audioSpec: 'Club Master 32-Bit Float · Sub-Enhanced',
    titleFa: 'کیروشی اُپتیکس: میکس کلاب سایبرپانک',
    titleEn: 'Kiroshi Optics: Cyberpunk Club Mix',
    creatorFa: 'دی‌جی وکتور و ساین‌ویو',
    creatorEn: 'DJ Vektor & Sinewave Works',
    categoryFa: 'موسیقی · دیپ هاوس و سایبرپانک کلاب',
    categoryEn: 'Music · Cyberpunk Deep House & Electro',
    clusterId: 'neon-futures',
    clusterLabelFa: 'آینده نئونی',
    clusterLabelEn: 'Neon Futures',
    durationSec: 395,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 0,
    posterUrl: imgKiroshiHub,
    accentHex: '#FF2A85',
    synopsisFa:
      'قطعه پرانرژی کلاب سایبرپانک با کیک‌های کوبنده ۱۲۶ BPM، سینت‌های اسیدی و وکال هولوگرافیک مخصوص ست‌های دی‌جی.',
    synopsisEn:
      'High-voltage cyberpunk deep house and dark electro club weapon at 126 BPM in A minor, engineered for seamless DJ deck mixing.',
    tags: ['music', 'cyberpunk', 'house', 'club', 'dj', 'fast-paced', 'bass'],
    tagsFa: ['موسیقی', 'دی‌جی', 'سایبرپانک', 'دیپ‌هاوس', 'پرانرژی', 'کلاب', 'بیس'],
    vector: { tension: 0.89, pace: 0.92, surrealism: 0.72, nocturnal: 0.97, intimacy: 0.45, depth: 0.82 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Night City Audio Lab',
    subtitles: [
      { startSec: 0, endSec: 8, fa: '♪ [بیت کلاب ۱۲۶ BPM · آماده سینک در دک A و B]', en: '♪ [126 BPM Club Beat Grid · Ready for Deck Sync]' },
      { startSec: 8, endSec: 20, fa: 'فرکانس‌های نوری در مدارهای عصبی شهر به حرکت درمی‌آیند...', en: 'Optical frequencies surge across the city neural bus...' }
    ],
    chapters: [
      { id: 'm3-c1', timeSec: 0, labelFa: 'بیت‌گرید دی‌جی (Intro 16 Bar)', labelEn: 'DJ Beatgrid (16-Bar Intro)' },
      { id: 'm3-c2', timeSec: 60, labelFa: 'دراپ اول بیس (Bass Drop)', labelEn: 'First Bass Drop' },
      { id: 'm3-c3', timeSec: 210, labelFa: 'سینت اسیدی (Acid Lead)', labelEn: 'Acid Synth Lead' }
    ],
    spatialPos: { x: 74, y: 24, z: 0.95 }
  },
  {
    id: 'music-04',
    mediaType: 'music',
    bpm: 76,
    musicalKey: 'Dm',
    audioSpec: 'Studio DSD · Grand Piano & Cello',
    titleFa: 'سوناتِ ابسیدین (نسخه کامل کنسرت)',
    titleEn: 'Obsidian Sonata: Nocturne for Cello & Piano',
    creatorFa: 'ویکتور کلاین',
    creatorEn: 'Viktor Klein',
    categoryFa: 'موسیقی · نئوکلاسیک و پیانو شبانه',
    categoryEn: 'Music · Modern Classical & Chamber',
    clusterId: 'midnight-sound',
    clusterLabelFa: 'موسیقی و ریتم شب',
    clusterLabelEn: 'Midnight Sound',
    durationSec: 445,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 2,
    posterUrl: imgObsidianSonata,
    accentHex: '#FBBF24',
    synopsisFa:
      'هم‌نوازی عمیق و احساسی پیانو گرند استاین‌وی و ویولن‌سل در تالار بتنی با آکوستیک طبیعی (۷۶ BPM، ر مینور).',
    synopsisEn:
      'Intimate late-night dialogue between a Steinway grand piano and solo cello inside a brutalist concrete hall (76 BPM, D minor).',
    tags: ['music', 'classical', 'piano', 'cello', 'acoustic', 'calm', 'emotional'],
    tagsFa: ['موسیقی', 'کلاسیک', 'پیانو', 'ویولن‌سل', 'آرام', 'احساسی', 'آکوستیک'],
    vector: { tension: 0.44, pace: 0.24, surrealism: 0.35, nocturnal: 0.88, intimacy: 0.86, depth: 0.96 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Nordic Chamber Recordings',
    subtitles: [
      { startSec: 0, endSec: 10, fa: '♪ [آداجیو پیانو در گام ر مینور — طنین تالار بتنی]', en: '♪ [Piano Adagio in D Minor — Concrete Hall Reverb]' }
    ],
    chapters: [
      { id: 'm4-c1', timeSec: 0, labelFa: 'مومان اول: آداجیو', labelEn: 'Movement I: Adagio' },
      { id: 'm4-c2', timeSec: 185, labelFa: 'مومان دوم: ورود ویولن‌سل', labelEn: 'Movement II: Cello Entry' }
    ],
    spatialPos: { x: 62, y: 66, z: 0.85 }
  },
  {
    id: 'music-05',
    mediaType: 'music',
    bpm: 116,
    musicalKey: 'Gm',
    audioSpec: 'Spatial Audio 3D · Persian Electronic Fusion',
    titleFa: 'سرابِ کویر و سنتور الکترونیک',
    titleEn: 'Desert Mirage: Electronic Santoor Odyssey',
    creatorFa: 'سهراب کاظمی و پروژه اوریون',
    creatorEn: 'Sohrab Kazemi & Orion Project',
    categoryFa: 'موسیقی · تلفیقی ایرانی و الکترونیک فضایی',
    categoryEn: 'Music · Persian Ethno-Electronic & Downtempo',
    clusterId: 'surreal-art',
    clusterLabelFa: 'هنر سورئال',
    clusterLabelEn: 'Surreal Art',
    durationSec: 380,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 1,
    posterUrl: imgQuantumOasis,
    accentHex: '#2DD4BF',
    synopsisFa:
      'تلفیق مسحورکننده سنتور و کمانچه با بیت‌های داون‌تمپو و سینتی‌سایزرهای فضایی (۱۱۶ BPM در سل مینور).',
    synopsisEn:
      'Hypnotic fusion of acoustic Persian santoor and kamancheh over deep organic downtempo grooves at 116 BPM in G minor.',
    tags: ['music', 'persian', 'fusion', 'electronic', 'downtempo', 'santoor', 'desert'],
    tagsFa: ['موسیقی', 'تلفیقی', 'سنتور', 'الکترونیک', 'ایرانی', 'کویر', 'دی‌جی'],
    vector: { tension: 0.52, pace: 0.62, surrealism: 0.89, nocturnal: 0.84, intimacy: 0.72, depth: 0.93 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Tehran-Berlin Sonic Collective',
    subtitles: [
      { startSec: 0, endSec: 10, fa: '♪ [پژواک سنتور در فضای سه‌بعدی با ریتم ۱۱۶ BPM]', en: '♪ [Spatial Santoor Resonance with 116 BPM Organic Groove]' }
    ],
    chapters: [
      { id: 'm5-c1', timeSec: 0, labelFa: 'زمزمه کویر', labelEn: 'Desert Whisper' },
      { id: 'm5-c2', timeSec: 110, labelFa: 'ورود ریتم داون‌تمپو', labelEn: 'Downtempo Pulse' }
    ],
    spatialPos: { x: 82, y: 58, z: 0.86 }
  },
  {
    id: 'music-06',
    mediaType: 'music',
    bpm: 104,
    musicalKey: 'Em',
    audioSpec: '24-Bit Studio Master · Velvet R&B',
    titleFa: 'اتاقِ مخملیِ ساعتِ سه بامداد',
    titleEn: 'Velvet Room at 3 A.M.',
    creatorFa: 'کلارا مونترو',
    creatorEn: 'Clara Montero',
    categoryFa: 'موسیقی · نئو سول، آر اند بی و چیل‌ویو',
    categoryEn: 'Music · Nocturnal R&B & Chillwave',
    clusterId: 'velvet-cinema',
    clusterLabelFa: 'آوای مخملی',
    clusterLabelEn: 'Velvet Cinema',
    durationSec: 310,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 3,
    posterUrl: imgCrimsonSuite,
    accentHex: '#F43F5E',
    synopsisFa:
      'وکال مخملی و گرم به همراه گیتار الکتریک ریورب‌دار و بیس نرم (۱۰۴ BPM در می مینور) برای ساعات خلوت شب.',
    synopsisEn:
      'Silky late-night vocals draped over drenched reverb guitar chords and warm sub-bass at 104 BPM in E minor.',
    tags: ['music', 'rnb', 'velvet', 'vocal', 'intimate', 'chill', 'night'],
    tagsFa: ['موسیقی', 'مخملی', 'آرام', 'وکال', 'شبانه', 'صمیمی', 'چیل'],
    vector: { tension: 0.48, pace: 0.45, surrealism: 0.46, nocturnal: 0.92, intimacy: 0.97, depth: 0.81 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Lumiere Sonic Records',
    subtitles: [
      { startSec: 0, endSec: 8, fa: 'چراغ‌های شهر از پشت پرده‌های ابریشمی خاموش می‌شوند...', en: 'City lights fade behind heavy silk curtains...' },
      { startSec: 8, endSec: 18, fa: 'هر نت، مکثی کوتاه میان دو نفس در تاریکی است.', en: 'Every note lingers between two quiet breaths in the dark.' }
    ],
    chapters: [
      { id: 'm6-c1', timeSec: 0, labelFa: 'گیتار مخملی', labelEn: 'Velvet Guitar Intro' },
      { id: 'm6-c2', timeSec: 75, labelFa: 'هم‌خوانی شبانه', labelEn: 'Midnight Chorus' }
    ],
    spatialPos: { x: 44, y: 76, z: 0.9 }
  },
  {
    id: 'music-07',
    mediaType: 'music',
    bpm: 64,
    musicalKey: 'Bbm',
    audioSpec: 'Binaural 3D Headphone Master',
    titleFa: 'امواجِ بیولومینسنت سولاریس',
    titleEn: 'Bioluminescent Tides of Solaris',
    creatorFa: 'سوفیا لیند',
    creatorEn: 'Sofia Lind',
    categoryFa: 'موسیقی · امبینت فضایی و صدای باینورال',
    categoryEn: 'Music · Deep Space Ambient & Binaural',
    clusterId: 'midnight-sound',
    clusterLabelFa: 'موسیقی و ریتم شب',
    clusterLabelEn: 'Midnight Sound',
    durationSec: 520,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 4,
    posterUrl: imgSolarisMirage,
    accentHex: '#818CF8',
    synopsisFa:
      'موسیقی امبینت فضایی با فرکانس‌های باینورال سه‌بعدی برای تمرکز عمیق، کدنویسی، مطالعه و ریلکسیشن شبانه.',
    synopsisEn:
      'Weightless binaural ambient textures and evolving harmonic drones crafted for deep focus, meditation, and nocturnal immersion.',
    tags: ['music', 'ambient', 'binaural', 'focus', 'calm', 'space', 'asmr'],
    tagsFa: ['موسیقی', 'امبینت', 'باینورال', 'تمرکز', 'آرامش', 'فضایی'],
    vector: { tension: 0.2, pace: 0.16, surrealism: 0.94, nocturnal: 0.89, intimacy: 0.68, depth: 0.92 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Astral Acoustic Lab',
    subtitles: [
      { startSec: 0, endSec: 12, fa: '♪ [امواج باینورال ۴۳۲ هرتز · حرکت سه‌بعدی صدا میان گوش چپ و راست]', en: '♪ [432Hz Binaural Tide · 3D Spatial Panning]' }
    ],
    chapters: [
      { id: 'm7-c1', timeSec: 0, labelFa: 'مدار اول: بی‌وزنی', labelEn: 'Orbit I: Weightlessness' },
      { id: 'm7-c2', timeSec: 240, labelFa: 'مدار دوم: سحابی عمیق', labelEn: 'Orbit II: Deep Nebula' }
    ],
    spatialPos: { x: 86, y: 44, z: 0.79 }
  },
  {
    id: 'music-08',
    mediaType: 'music',
    bpm: 132,
    musicalKey: 'Fm',
    audioSpec: 'Hi-Res Lossless · Industrial Synth',
    titleFa: 'دروازه دلوس: سمفونی بروتالیست',
    titleEn: 'Delos Subterranean: Brutalist Synth Symphony',
    creatorFa: 'رامین کاظمی و کلکتیو نوار',
    creatorEn: 'Ramin Kazemi & Atelier Collective',
    categoryFa: 'موسیقی · ساندترک سینمایی و دارک سینت',
    categoryEn: 'Music · Cinematic Score & Dark Synth',
    clusterId: 'noir-shadows',
    clusterLabelFa: 'سایه‌های نوار',
    clusterLabelEn: 'Noir Shadows',
    durationSec: 365,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 1,
    posterUrl: posterCyberMemory,
    accentHex: '#38BDF8',
    synopsisFa:
      'ارکستراسیون حماسی زهی و سینتی‌سایزرهای صنعتی الهام‌گرفته از فضای وست‌ورلد و معماری بتنی دلوس (۱۳۲ BPM).',
    synopsisEn:
      'Brutalist cinematic score blending low brass, taut strings, and modular analog pulses inspired by subterranean sci-fi labs (132 BPM).',
    tags: ['music', 'soundtrack', 'score', 'dark-synth', 'westworld', 'epic', 'dj'],
    tagsFa: ['موسیقی', 'ساندترک', 'سینمایی', 'دارک‌سینت', 'حماسی', 'دی‌جی'],
    vector: { tension: 0.94, pace: 0.84, surrealism: 0.68, nocturnal: 0.91, intimacy: 0.42, depth: 0.95 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Delos Soundstage Vault',
    subtitles: [
      { startSec: 0, endSec: 9, fa: '♪ [تم پیانوی خودکار و ورود ارکستر زهی در فا مینور]', en: '♪ [Player Piano Motif & Low String Ostinato in F Minor]' }
    ],
    chapters: [
      { id: 'm8-c1', timeSec: 0, labelFa: 'تم پیانوی مکانیکی', labelEn: 'Mechanical Piano Theme' },
      { id: 'm8-c2', timeSec: 120, labelFa: 'فوران سینت صنعتی', labelEn: 'Industrial Synth Surge' }
    ],
    spatialPos: { x: 68, y: 36, z: 0.91 }
  },

  // =========================================================================
  // PODCASTS (پادکست) — Deep Cinema, Sci-Fi Philosophy, True Mystery, Sound Art
  // =========================================================================
  {
    id: 'podcast-01',
    mediaType: 'podcast',
    bpm: 90,
    musicalKey: 'Voice · Spatial',
    audioSpec: 'Binaural Broadcast · 48kHz Studio Mic',
    narratorFa: 'میزبان: دکتر آرش تهرانی و سارا نوری',
    narratorEn: 'Hosted by Dr. Arash Tehrani & Sara Nouri',
    titleFa: 'پادکست رادیو نوار · اپیزود ۴۲: کالبدشکافی وست‌ورلد و هوش خودآگاه',
    titleEn: 'Radio Noir Podcast · Ep. 42: Anatomy of Westworld & Sentient Minds',
    creatorFa: 'استودیو رادیو نوار',
    creatorEn: 'Radio Noir Narrative Studio',
    categoryFa: 'پادکست · فلسفه سینما و آینده‌پژوهی',
    categoryEn: 'Podcast · Philosophy of Sci-Fi & Consciousness',
    clusterId: 'noir-shadows',
    clusterLabelFa: 'پادکست‌های تحلیلی و نوار',
    clusterLabelEn: 'Noir Shadows',
    durationSec: 1840,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 0,
    posterUrl: posterRainDetective,
    accentHex: '#F5B942',
    synopsisFa:
      'گفت‌وگوی عمیق با طراحی صدای سه‌بعدی درباره معماری آزمایشگاه‌های دلوس، هزارتوی خودآگاهی و موسیقی متن آثار علمی‌تخیلی نوار.',
    synopsisEn:
      'An immersive binaural conversation exploring brutalist sci-fi architecture, the maze of consciousness, and nocturnal film scoring.',
    tags: ['podcast', 'philosophy', 'scifi', 'westworld', 'cinema', 'deep-talk', 'binaural'],
    tagsFa: ['پادکست', 'فلسفه', 'وست‌ورلد', 'سینما', 'علمی‌تخیلی', 'تحلیلی', 'گفتگو'],
    vector: { tension: 0.72, pace: 0.42, surrealism: 0.65, nocturnal: 0.88, intimacy: 0.84, depth: 0.98 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Radio Noir Originals',
    subtitles: [
      { startSec: 0, endSec: 8, fa: 'به اپیزود چهل‌ودوم رادیو نوار خوش آمدید؛ امشب وارد هزارتوی خودآگاهی می‌شویم...', en: 'Welcome to Episode 42 of Radio Noir; tonight we step inside the labyrinth of consciousness...' },
      { startSec: 8, endSec: 18, fa: 'چرا معماری بروتالیست و بتن خام تا این اندازه حس رمزآلود بودن را تقویت می‌کند؟', en: 'Why does raw board-formed brutalist concrete amplify psychological mystery so deeply?' },
      { startSec: 18, endSec: 30, fa: 'وقتی حافظه به یک حلقه تکرارشونده تبدیل می‌شود، مرز رویا و واقعیت کجاست؟', en: 'When memory becomes a recurring loop, where does dream end and reality begin?' }
    ],
    chapters: [
      { id: 'p1-c1', timeSec: 0, labelFa: 'مقدمه: ورود به آزمایشگاه دلوس', labelEn: 'Intro: Entering the Delos Lab' },
      { id: 'p1-c2', timeSec: 420, labelFa: 'فصل اول: استعاره هزارتو', labelEn: 'Part I: The Maze Metaphor' },
      { id: 'p1-c3', timeSec: 1120, labelFa: 'فصل دوم: روان‌شناسی موسیقی متن', labelEn: 'Part II: Psychology of the Score' }
    ],
    spatialPos: { x: 32, y: 22, z: 0.91 }
  },
  {
    id: 'podcast-02',
    mediaType: 'podcast',
    bpm: 98,
    musicalKey: 'Voice · Cyber',
    audioSpec: 'Dolby Atmos Podcast · Neural Soundscape',
    narratorFa: 'راوی: نیما راد',
    narratorEn: 'Narrated by Nima Rad',
    titleFa: 'پادکست توکیو ۲۰۸۹ · اپیزود ۱۹: شهرهای شبانه و معماری سایبرپانک',
    titleEn: 'Tokyo 2089 Podcast · Ep. 19: Nocturnal Megacities & Cyberpunk Lore',
    creatorFa: 'شبکه پادکست نئون‌کست',
    creatorEn: 'NeonCast Audio Network',
    categoryFa: 'پادکست · تکنولوژی، فرهنگ سایبری و داستان‌گویی',
    categoryEn: 'Podcast · Cyberpunk Culture & Narrative Tech',
    clusterId: 'neon-futures',
    clusterLabelFa: 'آینده نئونی',
    clusterLabelEn: 'Neon Futures',
    durationSec: 1520,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 1,
    posterUrl: imgCyberRequiem,
    accentHex: '#00F0FF',
    synopsisFa:
      'پادکست روایی با افکت‌های صوتی محیطی از خیابان‌های بارانی توکیو و سئول؛ بررسی آینده رابط‌های مغز و کامپیوتر.',
    synopsisEn:
      'Narrative documentary podcast recorded with live Shinjuku street ambiences, exploring neural optics and cyberpunk urbanism.',
    tags: ['podcast', 'cyberpunk', 'tokyo', 'technology', 'future', 'storytelling'],
    tagsFa: ['پادکست', 'سایبرپانک', 'توکیو', 'تکنولوژی', 'آینده', 'روایی'],
    vector: { tension: 0.76, pace: 0.64, surrealism: 0.7, nocturnal: 0.94, intimacy: 0.72, depth: 0.9 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'NeonCast Studio',
    subtitles: [
      { startSec: 0, endSec: 9, fa: 'صدای باران روی تابلوهای هولوگرافیک شینجوکو، پس‌زمینه امشب ماست...', en: 'Rain tapping against Shinjuku holographic billboards sets our stage tonight...' },
      { startSec: 9, endSec: 20, fa: 'در سال ۲۰۷۷، مرز میان چشم انسان و لنزهای کیروشی کاملاً محو شده است.', en: 'By 2077, the boundary between human vision and optical HUDs has dissolved.' }
    ],
    chapters: [
      { id: 'p2-c1', timeSec: 0, labelFa: 'گزارش میدانی از شینجوکو', labelEn: 'Shinjuku Field Recording' },
      { id: 'p2-c2', timeSec: 540, labelFa: 'تکامل لنزهای هولوگرافیک', labelEn: 'Evolution of Spatial Optics' }
    ],
    spatialPos: { x: 78, y: 18, z: 0.87 }
  },
  {
    id: 'podcast-03',
    mediaType: 'podcast',
    bpm: 84,
    musicalKey: 'Voice · Mystery',
    audioSpec: '3D Binaural True Mystery Drama',
    narratorFa: 'گویندگان: الهام شمس و بهرام رستگار',
    narratorEn: 'Voiced by Elham Shams & Bahram Rastegar',
    titleFa: 'پادکست پرونده‌های نیمه‌شب · اپیزود ۱۱: مسافر ناپدیدشده قطار پاریس',
    titleEn: 'Midnight Dossier Podcast · Ep. 11: Vanishing on the Paris Express',
    creatorFa: 'آتلیه درام صوتی',
    creatorEn: 'Atelier Audio Drama',
    categoryFa: 'پادکست · معمایی، کارآگاهی و درام صوتی',
    categoryEn: 'Podcast · True Mystery & Noir Audio Drama',
    clusterId: 'noir-shadows',
    clusterLabelFa: 'سایه‌های نوار',
    clusterLabelEn: 'Noir Shadows',
    durationSec: 1680,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 2,
    posterUrl: imgMidnightParis,
    accentHex: '#FB923C',
    synopsisFa:
      'پادکست داستانی-معمایی با صدای سه‌بعدی حرکت قطار در شب؛ بازخوانی پرونده‌ای واقعی از سال ۱۹۶۸ در مسیر پاریس به وین.',
    synopsisEn:
      'Binaural mystery podcast reconstructing the unsolved 1968 disappearance aboard a sleeper train bound from Paris to Vienna.',
    tags: ['podcast', 'mystery', 'detective', 'train', 'noir', 'drama', 'story'],
    tagsFa: ['پادکست', 'معمایی', 'کارآگاهی', 'قطار', 'داستانی', 'نوار'],
    vector: { tension: 0.88, pace: 0.46, surrealism: 0.42, nocturnal: 0.92, intimacy: 0.81, depth: 0.91 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Atelier Official Vault',
    subtitles: [
      { startSec: 0, endSec: 10, fa: 'ساعت ۲:۱۵ بامداد، قطار سریع‌السیر پاریس در مه غلیظ متوقف شد اما کوپه شماره ۴ خالی بود...', en: 'At 2:15 a.m., the Paris express halted in dense fog, yet Compartment 4 was empty...' }
    ],
    chapters: [
      { id: 'p3-c1', timeSec: 0, labelFa: 'سوار شدن در ایستگاه لومیر', labelEn: 'Boarding at Gare de l’Est' },
      { id: 'p3-c2', timeSec: 620, labelFa: 'سرنخ اول: دفترچه چرمی', labelEn: 'Clue I: The Leather Notebook' }
    ],
    spatialPos: { x: 36, y: 62, z: 0.83 }
  },
  {
    id: 'podcast-04',
    mediaType: 'podcast',
    bpm: 72,
    musicalKey: 'Voice · Intimate',
    audioSpec: 'Warm Tube Mic · Late-Night Broadcast',
    narratorFa: 'میزبان: رکسانا دارابی',
    narratorEn: 'Hosted by Roxana Darabi',
    titleFa: 'پادکست شب‌بیداران · اپیزود ۲۷: هنر تنهایی و نامه‌های خوانده‌نشده',
    titleEn: 'Insomniac Letters Podcast · Ep. 27: The Art of Nocturnal Solitude',
    creatorFa: 'استودیو مخمل شب',
    creatorEn: 'Velvet Hour Broadcast',
    categoryFa: 'پادکست · ادبیات، روان‌شناسی و آرامش شبانه',
    categoryEn: 'Podcast · Late-Night Reflections & Literature',
    clusterId: 'velvet-cinema',
    clusterLabelFa: 'آوای مخملی',
    clusterLabelEn: 'Velvet Cinema',
    durationSec: 1410,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 3,
    posterUrl: imgAmberHotel,
    accentHex: '#F43F5E',
    synopsisFa:
      'گفتاری صمیمی و آرام با صدای گرم میکروفون لامپی و پیانوی ملایم درباره نامه‌های عاشقانه کلاسیک و آرامش ذهن قبل از خواب.',
    synopsisEn:
      'Unrushed late-night reflections and classic correspondence read over soft felt piano for quiet introspection.',
    tags: ['podcast', 'calm', 'literature', 'intimate', 'sleep', 'velvet', 'night'],
    tagsFa: ['پادکست', 'آرامش', 'ادبیات', 'شبانه', 'صمیمی', 'خواب'],
    vector: { tension: 0.26, pace: 0.2, surrealism: 0.44, nocturnal: 0.94, intimacy: 0.98, depth: 0.89 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Velvet Hour Studio',
    subtitles: [
      { startSec: 0, endSec: 10, fa: 'اگر این صدا را می‌شنوید، یعنی شهر به خواب رفته و تنها چراغ اتاق شما روشن است...', en: 'If you are hearing this voice, the city is asleep and only your lamp remains lit...' }
    ],
    chapters: [
      { id: 'p4-c1', timeSec: 0, labelFa: 'پیش‌گفتار نیمه‌شب', labelEn: 'Midnight Prologue' },
      { id: 'p4-c2', timeSec: 480, labelFa: 'نامه اول: پاریس ۱۹۵۴', labelEn: 'Letter I: Paris 1954' }
    ],
    spatialPos: { x: 48, y: 70, z: 0.88 }
  },
  {
    id: 'podcast-05',
    mediaType: 'podcast',
    bpm: 110,
    musicalKey: 'Voice · Studio',
    audioSpec: 'Dolby Atmos Masterclass · Live Synth',
    narratorFa: 'میزبان: کاوه فرهادی (طراح صدا و دی‌جی)',
    narratorEn: 'Hosted by Kaveh Farhadi (Sound Designer & DJ)',
    titleFa: 'پادکست معماران صدا · اپیزود ۸: رازهای میکس هارمونیک و طراحی صدای سه‌بعدی',
    titleEn: 'Sonic Architects Podcast · Ep. 8: Secrets of Harmonic DJ Mixing & 3D Sound',
    creatorFa: 'آزمایشگاه صوتی اِتر',
    creatorEn: 'Aether Sonic Lab',
    categoryFa: 'پادکست · آموزش موسیقی، دی‌جی و مهندسی صدا',
    categoryEn: 'Podcast · Music Production & DJ Masterclass',
    clusterId: 'midnight-sound',
    clusterLabelFa: 'موسیقی و ریتم شب',
    clusterLabelEn: 'Midnight Sound',
    durationSec: 1290,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 4,
    posterUrl: imgVelvetRain,
    accentHex: '#10B981',
    synopsisFa:
      'بررسی عملی تکنیک‌های میکس در کنسول دی‌جی، تطبیق گام‌های موسیقی (Camelot Wheel)، اکولایزر ۳بانده و ساخت پلی‌لیست‌های هوشمند.',
    synopsisEn:
      'Hands-on audio masterclass breaking down harmonic Camelot key mixing, 3-band EQ sculpting, and spatial sound design.',
    tags: ['podcast', 'dj', 'music', 'sound-design', 'audio', 'masterclass'],
    tagsFa: ['پادکست', 'دی‌جی', 'موسیقی', 'مهندسی صدا', 'میکس', 'آموزشی'],
    vector: { tension: 0.5, pace: 0.58, surrealism: 0.54, nocturnal: 0.82, intimacy: 0.76, depth: 0.94 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Aether Sonic Lab',
    subtitles: [
      { startSec: 0, endSec: 10, fa: 'راز یک ترنزیشن بی‌نقص در دی‌جی، تنها هماهنگی BPM نیست بلکه هم‌خوانی گام‌های هارمونیک است...', en: 'The secret to a seamless DJ transition is not just matching BPM, but aligning harmonic keys...' }
    ],
    chapters: [
      { id: 'p5-c1', timeSec: 0, labelFa: 'چرخه هارمونیک گام‌ها', labelEn: 'Harmonic Key Wheel' },
      { id: 'p5-c2', timeSec: 510, labelFa: 'مهندسی اکولایزر در میکس زنده', labelEn: 'Live EQ Sculpting' }
    ],
    spatialPos: { x: 58, y: 50, z: 0.84 }
  },

  // =========================================================================
  // AUDIOBOOKS (کتاب صوتی) — Sci-Fi Noir, Surreal Fiction, Mystery, Classics
  // =========================================================================
  {
    id: 'book-01',
    mediaType: 'audiobook',
    bpm: 80,
    musicalKey: 'Audiobook · 3D',
    audioSpec: 'Unabridged 3D Audiobook · Cinema Cast & Score',
    narratorFa: 'راوی: استاد شهاب حسینیان · با موسیقی متن اختصاصی',
    narratorEn: 'Narrated by Shahab Hosseinian · Original Ambient Score',
    titleFa: 'کتاب صوتی «آیا آدم‌مصنوعی‌ها خواب گوسفند برقی می‌بینند؟» (بلید رانر)',
    titleEn: 'Audiobook: Do Androids Dream of Electric Sheep? (Noir Edition)',
    creatorFa: 'فیلیپ کی. دیک · نشر صوتی اِتر',
    creatorEn: 'Philip K. Dick · Aether Unabridged Audio',
    categoryFa: 'کتاب صوتی · شاهکار علمی‌تخیلی و سایبرپانک',
    categoryEn: 'Audiobook · Classic Sci-Fi & Cyberpunk Noir',
    clusterId: 'neon-futures',
    clusterLabelFa: 'کتاب‌های صوتی علمی‌تخیلی',
    clusterLabelEn: 'Neon Futures',
    durationSec: 3420,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 0,
    posterUrl: posterCrimsonMotel,
    accentHex: '#00F0FF',
    synopsisFa:
      'نسخه صوتی سینمایی و کامل با افکت‌های باران اسیدی، سینتی‌سایزر ونجلیس‌گونه و روایت دراماتیک از شکارچی رپلیکانت‌ها در سانفرانسیسکوی تاریک.',
    synopsisEn:
      'Dramatized unabridged audiobook with atmospheric synthscapes and rain sound design following Rick Deckard across a dust-shrouded future.',
    tags: ['audiobook', 'book', 'scifi', 'cyberpunk', 'noir', 'blade-runner', 'story'],
    tagsFa: ['کتاب صوتی', 'کتاب', 'علمی‌تخیلی', 'سایبرپانک', 'بلید رانر', 'داستان', 'نوار'],
    vector: { tension: 0.86, pace: 0.4, surrealism: 0.78, nocturnal: 0.96, intimacy: 0.75, depth: 0.99 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Aether Literary Vault',
    subtitles: [
      { startSec: 0, endSec: 9, fa: 'فصل اول: ریک دکارد در سپیده‌دم خاکستری بیدار شد و به صدای غبار رادیواکتیو پشت پنجره گوش سپرد...', en: 'Chapter One: Rick Deckard awoke to the grey dawn and listened to the radioactive dust against the window...' },
      { startSec: 9, endSec: 21, fa: 'آزمون وویت-کمپ تنها راه تشخیص همدلی واقعی انسان از تقلید ماشینی بود.', en: 'The Voigt-Kampff empathy test remained the only line between human memory and synthetic replica.' }
    ],
    chapters: [
      { id: 'b1-c1', timeSec: 0, labelFa: 'فصل اول: بیداری در سانفرانسیسکو', labelEn: 'Chapter 1: Awakening in San Francisco' },
      { id: 'b1-c2', timeSec: 840, labelFa: 'فصل دوم: آزمون همدلی ریچل', labelEn: 'Chapter 2: The Voigt-Kampff Test' },
      { id: 'b1-c3', timeSec: 1920, labelFa: 'فصل سوم: باران بر بام شهر', labelEn: 'Chapter 3: Rain on the Rooftops' }
    ],
    spatialPos: { x: 70, y: 30, z: 0.94 }
  },
  {
    id: 'book-02',
    mediaType: 'audiobook',
    bpm: 74,
    musicalKey: 'Audiobook · Poetic',
    audioSpec: 'Hi-Res Binaural Narration · Chamber Strings',
    narratorFa: 'راوی: مریم شیرازی',
    narratorEn: 'Narrated by Maryam Shirazi',
    titleFa: 'کتاب صوتی «هزارتوی کتابخانه بابل و آینه‌های زمان»',
    titleEn: 'Audiobook: The Library of Babel & Mirrors of Time',
    creatorFa: 'خورخه لوئیس بورخس · ترجمه و اجرای صوتی اختصاصی',
    creatorEn: 'Jorge Luis Borges · Curated Audio Edition',
    categoryFa: 'کتاب صوتی · ادبیات سورئال و داستان‌های فلسفی',
    categoryEn: 'Audiobook · Surrealist Literature & Philosophy',
    clusterId: 'surreal-art',
    clusterLabelFa: 'هنر و ادبیات سورئال',
    clusterLabelEn: 'Surreal Art',
    durationSec: 2760,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 1,
    posterUrl: posterSurrealLabyrinth,
    accentHex: '#A78BFA',
    synopsisFa:
      'اجرای صوتی مسحورکننده از داستان‌های هزارتو، کتابخانه بی‌کران و زمان دایره‌ای بورخس با آکوستیک تالارهای سنگی.',
    synopsisEn:
      'Mesmerizing binaural narration of infinite hexagonal galleries, forked paths in time, and dream labyrinths.',
    tags: ['audiobook', 'book', 'surreal', 'literature', 'philosophy', 'borges', 'labyrinth'],
    tagsFa: ['کتاب صوتی', 'کتاب', 'سورئال', 'ادبیات', 'فلسفی', 'هزارتو', 'بورخس'],
    vector: { tension: 0.58, pace: 0.26, surrealism: 0.99, nocturnal: 0.84, intimacy: 0.82, depth: 0.99 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Aether Literary Vault',
    subtitles: [
      { startSec: 0, endSec: 11, fa: 'جهان، که دیگران آن را کتابخانه می‌نامند، از تعداد نامتناهی تالارهای شش‌ضلعی تشکیل شده است...', en: 'The universe, which others call the Library, is composed of an indefinite number of hexagonal galleries...' }
    ],
    chapters: [
      { id: 'b2-c1', timeSec: 0, labelFa: 'فصل اول: تالارهای شش‌ضلعی', labelEn: 'Chapter 1: Hexagonal Galleries' },
      { id: 'b2-c2', timeSec: 980, labelFa: 'فصل دوم: باغ گذرگاه‌های منشعب', labelEn: 'Chapter 2: Garden of Forking Paths' }
    ],
    spatialPos: { x: 82, y: 72, z: 0.89 }
  },
  {
    id: 'book-03',
    mediaType: 'audiobook',
    bpm: 82,
    musicalKey: 'Audiobook · Thriller',
    audioSpec: 'Spatial Thriller · Alpine Wind & Foley',
    narratorFa: 'راوی: کامران علوی',
    narratorEn: 'Narrated by Kamran Alavi',
    titleFa: 'کتاب صوتی «سایه باد در ایستگاه آلپ» (رمان معمایی)',
    titleEn: 'Audiobook: Shadow of the Alpine Wind (Noir Mystery Novel)',
    creatorFa: 'النا برگمان',
    creatorEn: 'Elena Bergman',
    categoryFa: 'کتاب صوتی · رمان جنایی، معمایی و تریلر روان‌شناختی',
    categoryEn: 'Audiobook · Nordic Noir & Psychological Mystery',
    clusterId: 'noir-shadows',
    clusterLabelFa: 'سایه‌های نوار',
    clusterLabelEn: 'Noir Shadows',
    durationSec: 3180,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 2,
    posterUrl: posterAlpineMystery,
    accentHex: '#93C5FD',
    synopsisFa:
      'رمان صوتی پرتعلیق درباره رمزگشایی از یک فرکانس رادیویی مرموز در رصدخانه‌ای متروکه بالای کوه‌های آلپ.',
    synopsisEn:
      'Gripping Nordic noir audiobook set inside a snowbound mountain observatory where an encrypted broadcast predicts the next 24 hours.',
    tags: ['audiobook', 'book', 'mystery', 'thriller', 'noir', 'snow', 'suspense'],
    tagsFa: ['کتاب صوتی', 'کتاب', 'معمایی', 'تریلر', 'جنایی', 'نوار', 'برفی'],
    vector: { tension: 0.95, pace: 0.36, surrealism: 0.52, nocturnal: 0.88, intimacy: 0.7, depth: 0.95 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Nordic Audio Press',
    subtitles: [
      { startSec: 0, endSec: 10, fa: 'فصل اول: کولاک تمام راه‌های ارتباطی رصدخانه را قطع کرده بود، جز یک گیرنده موج کوتاه...', en: 'Chapter 1: The blizzard had severed every line to the observatory, save for one shortwave receiver...' }
    ],
    chapters: [
      { id: 'b3-c1', timeSec: 0, labelFa: 'فصل اول: رصدخانه در کولاک', labelEn: 'Chapter 1: Snowbound Observatory' },
      { id: 'b3-c2', timeSec: 1100, labelFa: 'فصل دوم: پیام رمزنگاری‌شده', labelEn: 'Chapter 2: Encrypted Transmission' }
    ],
    spatialPos: { x: 28, y: 18, z: 0.86 }
  },
  {
    id: 'book-04',
    mediaType: 'audiobook',
    bpm: 70,
    musicalKey: 'Audiobook · Velvet',
    audioSpec: 'Intimate Studio Narration · Solo Cello',
    narratorFa: 'راوی: هانیه فرخزاد',
    narratorEn: 'Narrated by Hanieh Farrokhzad',
    titleFa: 'کتاب صوتی «شب‌های روشن و کافه‌های پاریس»',
    titleEn: 'Audiobook: White Nights & Parisian Nocturnes',
    creatorFa: 'فیودور داستایوفسکی (نسخه اقتباس مدرن صوتی)',
    creatorEn: 'Fyodor Dostoevsky (Modern Noir Audio Adaptation)',
    categoryFa: 'کتاب صوتی · عاشقانه کلاسیک و ادبیات جهان',
    categoryEn: 'Audiobook · Classic Romance & World Literature',
    clusterId: 'velvet-cinema',
    clusterLabelFa: 'آوای مخملی',
    clusterLabelEn: 'Velvet Cinema',
    durationSec: 2940,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 3,
    posterUrl: imgCrimsonPenthouse,
    accentHex: '#F5B942',
    synopsisFa:
      'روایت فوق‌العاده لطیف و شاعرانه از چهار شب دیدار دو روح تنها در کنار کانال‌های آب زیر نور چراغ‌های کهربایی.',
    synopsisEn:
      'Poetic, candlelit audio performance chronicling four sleepless nights of confession beside misty canal bridges.',
    tags: ['audiobook', 'book', 'classic', 'romance', 'literature', 'intimate', 'night'],
    tagsFa: ['کتاب صوتی', 'کتاب', 'کلاسیک', 'عاشقانه', 'ادبیات', 'شب‌های روشن', 'آرام'],
    vector: { tension: 0.42, pace: 0.22, surrealism: 0.48, nocturnal: 0.93, intimacy: 0.98, depth: 0.96 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Lumiere Literary Audio',
    subtitles: [
      { startSec: 0, endSec: 11, fa: 'شب اول: شبی شگفت‌انگیز بود، از آن شب‌هایی که تنها زمانی رخ می‌دهند که ما هنوز جوان و رویاپردازیم...', en: 'First Night: It was a marvelous night, such a night as is only possible when we are young and dreaming...' }
    ],
    chapters: [
      { id: 'b4-c1', timeSec: 0, labelFa: 'شب اول: دیدار روی پل', labelEn: 'Night I: Encounter on the Bridge' },
      { id: 'b4-c2', timeSec: 940, labelFa: 'شب دوم: داستان ناستنکا', labelEn: 'Night II: Nastenka’s Story' }
    ],
    spatialPos: { x: 40, y: 80, z: 0.91 }
  },
  {
    id: 'book-05',
    mediaType: 'audiobook',
    bpm: 88,
    musicalKey: 'Audiobook · Cyber',
    audioSpec: 'Dolby Atmos Sci-Fi Audio Drama',
    narratorFa: 'راوی: اشکان رادمهر',
    narratorEn: 'Narrated by Ashkan Radmehr',
    titleFa: 'کتاب صوتی «نورومنسر: جنون در ماتریکس سایبری»',
    titleEn: 'Audiobook: Neuromancer — Cyberspace Odyssey',
    creatorFa: 'ویلیام گیبسون · اجرای دراماتیک سه‌بعدی',
    creatorEn: 'William Gibson · Full-Cast Spatial Audio',
    categoryFa: 'کتاب صوتی · ادبیات سایبرپانک و هوش مصنوعی',
    categoryEn: 'Audiobook · Visionary Cyberpunk Fiction',
    clusterId: 'neon-futures',
    clusterLabelFa: 'آینده نئونی',
    clusterLabelEn: 'Neon Futures',
    durationSec: 3650,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 2,
    posterUrl: imgNeonBoudoir,
    accentHex: '#EC4899',
    synopsisFa:
      'کتاب صوتی مرجع دنیای سایبرپانک با طراحی صدای فضایی؛ داستان هکری که به درون معماری سه‌بعدی ماتریکس نفوذ می‌کند.',
    synopsisEn:
      'The definitive cyberpunk novel brought to life with spatial synth design: a washed-up console cowboy jacked into the 3D data matrix.',
    tags: ['audiobook', 'book', 'cyberpunk', 'neuromancer', 'matrix', 'scifi', 'ai'],
    tagsFa: ['کتاب صوتی', 'کتاب', 'سایبرپانک', 'نورومنسر', 'ماتریکس', 'علمی‌تخیلی'],
    vector: { tension: 0.87, pace: 0.68, surrealism: 0.85, nocturnal: 0.95, intimacy: 0.54, depth: 0.97 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Night City Audio Lab',
    subtitles: [
      { startSec: 0, endSec: 10, fa: 'فصل اول: آسمان بالای بندر، به رنگ تلویزیونی بود که روی کانالی مرده تنظیم شده باشد...', en: 'Chapter 1: The sky above the port was the color of television, tuned to a dead channel...' }
    ],
    chapters: [
      { id: 'b5-c1', timeSec: 0, labelFa: 'فصل اول: آسمان شهر چیبا', labelEn: 'Chapter 1: Chiba City Blues' },
      { id: 'b5-c2', timeSec: 1200, labelFa: 'فصل دوم: ورود به ماتریکس ۳بعدی', labelEn: 'Chapter 2: Jacking into the Matrix' }
    ],
    spatialPos: { x: 76, y: 38, z: 0.9 }
  }
];

export const CINEMA_MEDIA_CATALOG: PrototypeMediaItem[] = [
  {
    id: 'proto-01',
    mediaType: 'cinema',
    titleFa: 'بارانِ نیمه‌شب در ایستگاهِ ۴',
    titleEn: 'Midnight Rain at Platform 4',
    creatorFa: 'استودیو آتلیه نوار',
    creatorEn: 'Atelier Noir Collective',
    categoryFa: 'سینمای معمایی و نوار',
    categoryEn: 'Neo-Noir Cinema',
    clusterId: 'noir-shadows',
    clusterLabelFa: 'سایه‌های نوار',
    clusterLabelEn: 'Noir Shadows',
    durationSec: 540,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 2,
    posterUrl: posterRainDetective,
    accentHex: '#38BDF8',
    synopsisFa:
      'در یک ایستگاه قطار خلوت زیر باران شدید، کارآگاهی بازنشسته با نوارهای صوتی گم‌شده‌ای روبه‌رو می‌شود که زمان را به عقب برمی‌گردانند.',
    synopsisEn:
      'In a rain-drenched terminal after last departure, a retired archivist uncovers magnetic tape reels that rewrite the night.',
    tags: ['noir', 'rain', 'mystery', 'slow-burn', 'detective'],
    tagsFa: ['نوار', 'بارانی', 'معمایی', 'آهسته', 'کارآگاهی'],
    vector: { tension: 0.88, pace: 0.34, surrealism: 0.42, nocturnal: 0.96, intimacy: 0.55, depth: 0.92 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Atelier Official Vault',
    subtitles: [
      { startSec: 0, endSec: 6, fa: 'صدای باران روی سقف شیشه‌ای متوقف نمی‌شود...', en: 'The rain over the glass canopy never truly stops...' },
      { startSec: 6, endSec: 14, fa: 'هر نوار صوتی، ساعت متفاوتی از همان شب را روایت می‌کند.', en: 'Each reel recalls a different hour from the very same night.' },
      { startSec: 14, endSec: 25, fa: 'نور کهربایی در مهِ ایستگاه محو می‌شود.', en: 'Amber platform lights dissolve into the mist.' }
    ],
    chapters: [
      { id: 'c1', timeSec: 0, labelFa: 'ورود به ایستگاه', labelEn: 'Arrival at Platform' },
      { id: 'c2', timeSec: 165, labelFa: 'نوار اول', labelEn: 'First Reel' },
      { id: 'c3', timeSec: 390, labelFa: 'پرده پایانی', labelEn: 'Final Sequence' }
    ],
    spatialPos: { x: 24, y: 34, z: 0.9 }
  },
  {
    id: 'proto-02',
    titleFa: 'خاطره نئونی توکیو',
    titleEn: 'Neon Tokyo Reverie',
    creatorFa: 'کنجی تاکاهاشی',
    creatorEn: 'Kenji Takahashi',
    categoryFa: 'سینمای شهری شبانه',
    categoryEn: 'Urban Nocturne',
    clusterId: 'neon-futures',
    clusterLabelFa: 'آینده نئونی',
    clusterLabelEn: 'Neon Futures',
    durationSec: 420,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 1,
    posterUrl: posterNeonTokyo,
    accentHex: '#FB7185',
    synopsisFa:
      'پرسه‌زنی بی‌دیالوگ در کوچه‌های بارانی توکیو با صداگذاری باینورال و ریتم تند تصویربرداری ۶۰ فریم.',
    synopsisEn:
      'A dialogue-sparse drift through wet Tokyo backstreets captured with binaural night acoustics and kinetic 60fps framing.',
    tags: ['tokyo', 'neon', 'minimal-dialogue', 'cyber', 'fast-paced'],
    tagsFa: ['توکیو', 'نئون', 'کم‌دیالوگ', 'سایبری', 'پرتحرک'],
    vector: { tension: 0.72, pace: 0.76, surrealism: 0.58, nocturnal: 0.94, intimacy: 0.48, depth: 0.78 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Kansai Indie Feed',
    subtitles: [
      { startSec: 0, endSec: 7, fa: 'نورهای نئون روی آسفالت خیس می‌رقصند.', en: 'Neon signage ripples across wet asphalt.' },
      { startSec: 7, endSec: 16, fa: 'تنها صدای قدم‌ها و قطار عبوری باقی مانده است.', en: 'Only footsteps and distant commuter rails remain.' }
    ],
    chapters: [
      { id: 'c1', timeSec: 0, labelFa: 'کوچه بارانی', labelEn: 'Rain Alley' },
      { id: 'c2', timeSec: 210, labelFa: 'تقاطع شینجوکو', labelEn: 'Shinjuku Crossing' }
    ],
    spatialPos: { x: 72, y: 26, z: 0.82 }
  },
  {
    id: 'proto-03',
    titleFa: 'سوئیتِ کهربایی نیمه‌شب',
    titleEn: 'The Amber Midnight Suite',
    creatorFa: 'کلارا مونترو',
    creatorEn: 'Clara Montero',
    categoryFa: 'سینمای صمیمی و درام',
    categoryEn: 'Intimate Editorial',
    clusterId: 'velvet-cinema',
    clusterLabelFa: 'سینمای مخملی',
    clusterLabelEn: 'Velvet Cinema',
    durationSec: 615,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 4,
    posterUrl: imgAmberHotel,
    accentHex: '#F5B942',
    synopsisFa:
      'داستان کوتاه یک ملاقات ناخواسته در هتلی قدیمی با نورپردازی گرم شمع و ریتمی آرام و متمرکز بر جزئیات حسی.',
    synopsisEn:
      'An unhurried chamber piece inside an old-world hotel illuminated solely by warm tungsten and late-hour silence.',
    tags: ['hotel', 'amber', 'intimate', 'slow-burn', 'sensory'],
    tagsFa: ['هتل', 'کهربایی', 'صمیمی', 'آرام', 'حسی'],
    vector: { tension: 0.54, pace: 0.25, surrealism: 0.38, nocturnal: 0.85, intimacy: 0.96, depth: 0.84 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Lumiere Chamber Studio',
    subtitles: [
      { startSec: 0, endSec: 8, fa: 'ساعت لابی از نیمه‌شب گذشته و راهرو کاملاً ساکت است.', en: 'The lobby clock passes midnight as the corridor settles.' },
      { startSec: 8, endSec: 18, fa: 'پنجره رو به شهر تنها منبع صدای دوردست است.', en: 'A cracked window lets in only the hum of the distant avenue.' }
    ],
    chapters: [
      { id: 'c1', timeSec: 0, labelFa: 'راهروی طبقه چهارم', labelEn: 'Fourth Floor Hall' },
      { id: 'c2', timeSec: 260, labelFa: 'گفت‌وگوی آرام', labelEn: 'Quiet Exchange' }
    ],
    spatialPos: { x: 46, y: 66, z: 0.94 }
  },
  {
    id: 'proto-04',
    titleFa: 'هزارتوی آینه‌های سورئال',
    titleEn: 'Labyrinth of Surreal Mirrors',
    // Intentionally omits creatorFa/creatorEn to demonstrate graceful hiding of absent metadata
    categoryFa: 'هنر تجربی و سورئال',
    categoryEn: 'Surrealist Art Film',
    clusterId: 'surreal-art',
    clusterLabelFa: 'هنر سورئال',
    clusterLabelEn: 'Surreal Art',
    durationSec: 360,
    quality: '4K HDR',
    releaseYear: 2025,
    addedDaysAgo: 9,
    posterUrl: posterSurrealLabyrinth,
    accentHex: '#A78BFA',
    synopsisFa:
      'کاوشی انتزاعی در معماری رؤیاها، جایی که راهروهای مرمرین بر اساس حافظه بیننده تغییر شکل می‌دهند.',
    synopsisEn:
      'An architectural dream study where marble corridors bend and reorganize around fragments of memory.',
    tags: ['surreal', 'dream', 'architecture', 'art-house'],
    tagsFa: ['سورئال', 'رؤیا', 'معماری', 'هنری'],
    vector: { tension: 0.62, pace: 0.30, surrealism: 0.98, nocturnal: 0.72, intimacy: 0.44, depth: 0.95 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Archive Experimental',
    subtitles: [
      { startSec: 0, endSec: 9, fa: 'هر آینه تصویری از چند دقیقه قبل را نشان می‌دهد.', en: 'Every mirror reflects a moment several minutes behind.' }
    ],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'آستانه آینه', labelEn: 'Mirror Threshold' }],
    spatialPos: { x: 80, y: 74, z: 0.68 }
  },
  {
    id: 'proto-05',
    titleFa: 'سایه‌های پاریس در باران',
    titleEn: 'Parisian Shadow Study',
    creatorFa: 'لوران دوبوا',
    creatorEn: 'Laurent Dubois',
    categoryFa: 'سینمای نوار کلاسیک',
    categoryEn: 'European Noir',
    clusterId: 'noir-shadows',
    clusterLabelFa: 'سایه‌های نوار',
    clusterLabelEn: 'Noir Shadows',
    durationSec: 495,
    quality: '1080p',
    releaseYear: 2025,
    addedDaysAgo: 14,
    posterUrl: posterParisianShadow,
    accentHex: '#60A5FA',
    synopsisFa:
      'روایت کلاسیک یک تعقیب آرام در سنگ‌فرش‌های پاریس با کنتراست بالا و موسیقی جاز مینیمال.',
    synopsisEn:
      'A high-contrast nocturnal pursuit across Parisian cobblestones scored by sparse solo contrabass.',
    tags: ['paris', 'noir', 'jazz', 'classic', 'rain'],
    tagsFa: ['پاریس', 'نوار', 'جاز', 'کلاسیک', 'بارانی'],
    vector: { tension: 0.81, pace: 0.41, surrealism: 0.35, nocturnal: 0.92, intimacy: 0.62, depth: 0.88 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Seine Independent Vault',
    subtitles: [
      { startSec: 0, endSec: 8, fa: 'سایه پل روی رودخانه سن کشیده شده است.', en: 'The bridge casts a long shadow over the Seine.' }
    ],
    chapters: [
      { id: 'c1', timeSec: 0, labelFa: 'پل سن', labelEn: 'Pont Neuf' },
      { id: 'c2', timeSec: 240, labelFa: 'کافه متروکه', labelEn: 'Empty Bistro' }
    ],
    spatialPos: { x: 18, y: 52, z: 0.78 }
  },
  {
    id: 'proto-06',
    titleFa: 'سکوتِ برفی در آلپ',
    titleEn: 'Whiteout: Alpine Cabin',
    creatorFa: 'النا برگمان',
    creatorEn: 'Elena Bergman',
    categoryFa: 'تریلر روان‌شناختی',
    categoryEn: 'Psychological Thriller',
    clusterId: 'noir-shadows',
    clusterLabelFa: 'سایه‌های نوار',
    clusterLabelEn: 'Noir Shadows',
    durationSec: 690,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 6,
    posterUrl: posterAlpineMystery,
    accentHex: '#93C5FD',
    synopsisFa:
      'در یک کلبه بتنی محصور در بوران آلپ، دو غریبه متوجه می‌شوند فرستنده رادیویی پیام‌های خودشان را پخش می‌کند.',
    synopsisEn:
      'Isolated inside a brutalist alpine shelter during a whiteout, two strangers hear their own voices on the emergency band.',
    tags: ['snow', 'cabin', 'paranoia', 'tension', 'slow-burn'],
    tagsFa: ['برف', 'کلبه', 'تنش', 'روانشناختی', 'آهسته'],
    vector: { tension: 0.95, pace: 0.28, surrealism: 0.56, nocturnal: 0.68, intimacy: 0.52, depth: 0.94 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Nordic Cinema Archive',
    subtitles: [
      { startSec: 0, endSec: 7, fa: 'بوران تمام جاده پایین کوه را بسته است.', en: 'The blizzard has sealed every pass down the ridge.' }
    ],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'کابین بتنی', labelEn: 'Concrete Cabin' }],
    spatialPos: { x: 30, y: 20, z: 0.85 }
  },
  {
    id: 'proto-07',
    titleFa: 'حافظه سایبری ۲۰۰۹',
    titleEn: 'Cyber Memory Fragments',
    creatorFa: 'استودیو ساین‌ویو',
    creatorEn: 'Sinewave Works',
    categoryFa: 'علمی‌تخیلی مینیمال',
    categoryEn: 'Sci-Fi Essay',
    clusterId: 'neon-futures',
    clusterLabelFa: 'آینده نئونی',
    clusterLabelEn: 'Neon Futures',
    durationSec: 390,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 0,
    posterUrl: posterCyberMemory,
    accentHex: '#22D3EE',
    synopsisFa:
      'بازسازی شاعرانه خاطره‌های دیجیتال از سرورهای متروکه، با طراحی صدای آنالوگ و افق‌های آبی سرد.',
    synopsisEn:
      'A poetic reconstruction of abandoned digital archives paired with warm analog synthesizer swells.',
    tags: ['cyber', 'memory', 'scifi', 'synth', 'futuristic'],
    tagsFa: ['سایبری', 'حافظه', 'علمی‌تخیلی', 'سینت‌ویو'],
    vector: { tension: 0.64, pace: 0.58, surrealism: 0.82, nocturnal: 0.89, intimacy: 0.39, depth: 0.86 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Atelier Official Vault',
    subtitles: [
      { startSec: 0, endSec: 8, fa: 'سکتورهای قدیمی حافظه هنوز گرم هستند.', en: 'Old archive sectors still hold residual warmth.' }
    ],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'بازخوانی', labelEn: 'Memory Readout' }],
    spatialPos: { x: 76, y: 42, z: 0.89 }
  },
  {
    id: 'proto-08',
    titleFa: 'متل مخملی در حاشیه جاده',
    titleEn: 'Velvet Horizon Motel',
    creatorFa: 'مارکوس رید',
    creatorEn: 'Marcus Reed',
    categoryFa: 'نوار جاده‌ای و حسی',
    categoryEn: 'Sensual Road Noir',
    clusterId: 'velvet-cinema',
    clusterLabelFa: 'سینمای مخملی',
    clusterLabelEn: 'Velvet Cinema',
    durationSec: 510,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 3,
    posterUrl: posterCrimsonMotel,
    accentHex: '#F43F5E',
    synopsisFa:
      'نور تابلوهای نئون جاده‌ای از پشت پرده‌های مخملی عبور می‌کند و فضای اتاق شماره ۷ را به رنگ یاقوت درمی‌آورد.',
    synopsisEn:
      'Highway neon filters through heavy velvet drapes in Room 7 during a desert heatwave night.',
    tags: ['motel', 'crimson', 'velvet', 'desert', 'intimate'],
    tagsFa: ['متل', 'یاقوتی', 'مخملی', 'شبانه', 'صمیمی'],
    vector: { tension: 0.78, pace: 0.44, surrealism: 0.49, nocturnal: 0.91, intimacy: 0.92, depth: 0.80 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Lumiere Chamber Studio',
    subtitles: [
      { startSec: 0, endSec: 7, fa: 'باد گرم بیابان پشت شیشه می‌وزد.', en: 'A warm desert wind brushes against the motel glass.' }
    ],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'اتاق شماره ۷', labelEn: 'Room 7' }],
    spatialPos: { x: 52, y: 78, z: 0.91 }
  },
  {
    id: 'proto-09',
    titleFa: 'تالار ابریشم سرخ',
    titleEn: 'Crimson Silk Chamber',
    creatorFa: 'استودیو لومیر',
    creatorEn: 'Lumiere Collective',
    categoryFa: 'سینمای صمیمی ۴K',
    categoryEn: 'Luxury Chamber 4K',
    clusterId: 'velvet-cinema',
    clusterLabelFa: 'سینمای مخملی',
    clusterLabelEn: 'Velvet Cinema',
    durationSec: 480,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 5,
    posterUrl: imgCrimsonSuite,
    accentHex: '#E11D48',
    synopsisFa:
      'فیلم‌برداری لنز آنامورفیک با تمرکز بر بافت نور و سکوت در یک پنت‌هاوس شبانه.',
    synopsisEn:
      'Anamorphic lens study balancing deep velvet shadows with warm candlelit highlights.',
    tags: ['silk', 'boudoir', 'anamorphic', 'intimate', '4k'],
    tagsFa: ['ابریشم', 'صمیمی', 'آنامورفیک', '۴K'],
    vector: { tension: 0.58, pace: 0.30, surrealism: 0.44, nocturnal: 0.88, intimacy: 0.98, depth: 0.79 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Lumiere Chamber Studio',
    subtitles: [],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'پرده اول', labelEn: 'Opening Frame' }],
    spatialPos: { x: 41, y: 82, z: 0.87 }
  },
  {
    id: 'proto-10',
    titleFa: 'قطار شبانه‌ی پاریس',
    titleEn: 'Midnight Express Paris',
    creatorFa: 'ژولیت مورنو',
    creatorEn: 'Juliette Moreau',
    categoryFa: 'درام سینمایی',
    categoryEn: 'Cinematic Drama',
    clusterId: 'velvet-cinema',
    clusterLabelFa: 'سینمای مخملی',
    clusterLabelEn: 'Velvet Cinema',
    durationSec: 575,
    quality: '4K HDR',
    releaseYear: 2025,
    addedDaysAgo: 11,
    posterUrl: imgMidnightParis,
    accentHex: '#FB923C',
    synopsisFa:
      'گفت‌وگوی دو هم‌سفر در واگن کوپه‌ای در حال عبور از دشت‌های مه‌آلود فرانسه.',
    synopsisEn:
      'Two travelers share quiet confessions inside a sleeper compartment crossing foggy French plains.',
    tags: ['train', 'paris', 'dialogue', 'warm', 'night'],
    tagsFa: ['قطار', 'پاریس', 'دیالوگ', 'شب'],
    vector: { tension: 0.49, pace: 0.38, surrealism: 0.31, nocturnal: 0.82, intimacy: 0.86, depth: 0.87 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Seine Independent Vault',
    subtitles: [],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'واگن ۴', labelEn: 'Carriage 4' }],
    spatialPos: { x: 38, y: 60, z: 0.73 }
  },
  {
    id: 'proto-11',
    titleFa: 'باران مخملی بر شهر خاموش',
    titleEn: 'Velvet Rain Over Silent Streets',
    creatorFa: 'آکیرا ساتو',
    creatorEn: 'Akira Sato',
    categoryFa: 'پوئم صوتی‌تصویری ASMR',
    categoryEn: 'Ambient Soundscape',
    clusterId: 'midnight-sound',
    clusterLabelFa: 'صدا و ریتم شب',
    clusterLabelEn: 'Midnight Sound',
    durationSec: 720,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 1,
    posterUrl: imgVelvetRain,
    accentHex: '#34D399',
    synopsisFa:
      'تجربه‌ای خالص از صدای باران باینورال و پلان‌های طولانی و بدون کات برای آرامش عمیق شبانه.',
    synopsisEn:
      'Pure binaural rainfall and unbroken long takes crafted for deep late-night decompression.',
    tags: ['asmr', 'ambient', 'rain', 'binaural', 'calm'],
    tagsFa: ['صدا', 'آرامش', 'باران', 'باینورال', 'ملایم'],
    vector: { tension: 0.22, pace: 0.14, surrealism: 0.46, nocturnal: 0.90, intimacy: 0.74, depth: 0.70 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Kansai Indie Feed',
    subtitles: [],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'جریان اول', labelEn: 'Movement I' }],
    spatialPos: { x: 60, y: 54, z: 0.76 }
  },
  {
    id: 'proto-12',
    titleFa: 'سوناتِ ابسیدین',
    titleEn: 'Obsidian Sonata',
    creatorFa: 'ویکتور کلاین',
    creatorEn: 'Viktor Klein',
    categoryFa: 'موسیقی و تصویر زنده',
    categoryEn: 'Live Audiovisual',
    clusterId: 'midnight-sound',
    clusterLabelFa: 'صدا و ریتم شب',
    clusterLabelEn: 'Midnight Sound',
    durationSec: 445,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 2,
    posterUrl: imgObsidianSonata,
    accentHex: '#FBBF24',
    synopsisFa:
      'اجرای تک‌نوازی پیانو و ویولن‌سل در تالاری تاریک با نورپردازی تک‌نقطه‌ای.',
    synopsisEn:
      'A nocturnal cello and grand piano performance staged inside an unlit concrete hall.',
    tags: ['music', 'sonata', 'live', 'minimal', 'acoustic'],
    tagsFa: ['موسیقی', 'سونات', 'زنده', 'آکوستیک'],
    vector: { tension: 0.45, pace: 0.32, surrealism: 0.29, nocturnal: 0.86, intimacy: 0.71, depth: 0.91 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Nordic Cinema Archive',
    subtitles: [],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'آداجیو', labelEn: 'Adagio' }],
    spatialPos: { x: 65, y: 68, z: 0.71 }
  },
  {
    id: 'proto-13',
    titleFa: 'واحه‌ی کوانتومی',
    titleEn: 'Quantum Oasis',
    creatorFa: 'مرکز هنر ژنراتیو آیون',
    creatorEn: 'Aeon Generative Lab',
    categoryFa: 'سینمای هوش مصنوعی',
    categoryEn: 'Generative Cinema',
    clusterId: 'surreal-art',
    clusterLabelFa: 'هنر سورئال',
    clusterLabelEn: 'Surreal Art',
    durationSec: 315,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 0,
    posterUrl: imgQuantumOasis,
    accentHex: '#2DD4BF',
    synopsisFa:
      'سفری خیال‌انگیز در واحه‌ای بیابانی که با الگوریتم‌های هندسی و نورهای متحرک طراحی شده است.',
    synopsisEn:
      'A meditative drift through a luminous desert oasis sculpted with procedural geometry.',
    tags: ['ai-art', 'oasis', 'surreal', 'desert', 'visual-essay'],
    tagsFa: ['هنر', 'واحه', 'سورئال', 'بیابان'],
    vector: { tension: 0.31, pace: 0.48, surrealism: 0.94, nocturnal: 0.58, intimacy: 0.45, depth: 0.85 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Aeon Verified Originals',
    subtitles: [],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'سراب اول', labelEn: 'First Mirage' }],
    spatialPos: { x: 84, y: 60, z: 0.80 }
  },
  {
    id: 'proto-14',
    titleFa: 'سراب سولاریس',
    titleEn: 'Solaris Mirage',
    creatorFa: 'مرکز هنر ژنراتیو آیون',
    creatorEn: 'Aeon Generative Lab',
    categoryFa: 'فانتزی بصری',
    categoryEn: 'Visual Fantasy',
    clusterId: 'surreal-art',
    clusterLabelFa: 'هنر سورئال',
    clusterLabelEn: 'Surreal Art',
    durationSec: 385,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 7,
    posterUrl: imgSolarisMirage,
    accentHex: '#F59E0B',
    synopsisFa:
      'اقیانوسی معلق در مدار سیاره‌ای دوخورشیدی که امواجش با ضربان صدا تغییر رنگ می‌دهند.',
    synopsisEn:
      'An orbital ocean around twin suns whose bioluminescent tides pulse with acoustic resonance.',
    tags: ['solaris', 'space', 'surreal', 'scifi', 'ambient'],
    tagsFa: ['فضا', 'سولاریس', 'سورئال', 'علمی‌تخیلی'],
    vector: { tension: 0.36, pace: 0.27, surrealism: 0.96, nocturnal: 0.64, intimacy: 0.50, depth: 0.93 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Aeon Verified Originals',
    subtitles: [],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'مدار اقیانوس', labelEn: 'Ocean Orbit' }],
    spatialPos: { x: 88, y: 46, z: 0.77 }
  },
  {
    id: 'proto-15',
    titleFa: 'مرثیه سایبری (انیمیشن)',
    titleEn: 'Cyber Requiem',
    creatorFa: 'استودیو کوراما',
    creatorEn: 'Kurama Animation',
    categoryFa: 'انیمیشن بزرگسال و سایبرپانک',
    categoryEn: 'Adult Animation',
    clusterId: 'neon-futures',
    clusterLabelFa: 'آینده نئونی',
    clusterLabelEn: 'Neon Futures',
    durationSec: 460,
    quality: '4K 60FPS',
    releaseYear: 2026,
    addedDaysAgo: 3,
    posterUrl: imgCyberRequiem,
    accentHex: '#EC4899',
    synopsisFa:
      'انیمیشن فریم‌به‌فریم با ریتم تند در ابرشهری آینده‌نگر که مرز میان حافظه و ماشین از میان رفته است.',
    synopsisEn:
      'Frame-by-frame animated noir set inside an elevated megacity where memory implants expire at dawn.',
    tags: ['animation', 'anime', 'cyberpunk', 'fast-paced', 'action'],
    tagsFa: ['انیمیشن', 'انیمه', 'سایبرپانک', 'سریع', 'اکشن'],
    vector: { tension: 0.89, pace: 0.91, surrealism: 0.74, nocturnal: 0.95, intimacy: 0.42, depth: 0.81 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Kurama Studio Licensed',
    subtitles: [],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'بیدارشدن', labelEn: 'Awakening' }],
    spatialPos: { x: 78, y: 16, z: 0.84 }
  },
  {
    id: 'proto-16',
    titleFa: 'سامورایی مخملی',
    titleEn: 'Velvet Samurai',
    creatorFa: 'استودیو کوراما',
    creatorEn: 'Kurama Animation',
    categoryFa: 'انیمیشن هنری',
    categoryEn: 'Art Animation',
    clusterId: 'neon-futures',
    clusterLabelFa: 'آینده نئونی',
    clusterLabelEn: 'Neon Futures',
    durationSec: 530,
    quality: '4K HDR',
    releaseYear: 2025,
    addedDaysAgo: 12,
    posterUrl: imgVelvetSamurai,
    accentHex: '#F43F5E',
    synopsisFa:
      'ترکیب نقاشی مرکب سنتی با نورپردازی معاصر در داستان دوئلی خاموش زیر شکوفه‌های شبانه.',
    synopsisEn:
      'Traditional sumi-e ink animation fused with crimson moonlight in a silent duel beneath night blossoms.',
    tags: ['animation', 'samurai', 'ink', 'art', 'duel'],
    tagsFa: ['انیمیشن', 'سامورایی', 'مرکب', 'هنری'],
    vector: { tension: 0.84, pace: 0.68, surrealism: 0.65, nocturnal: 0.86, intimacy: 0.47, depth: 0.89 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Kurama Studio Licensed',
    subtitles: [],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'شب شکوفه‌ها', labelEn: 'Night Blossoms' }],
    spatialPos: { x: 64, y: 22, z: 0.72 }
  },
  {
    id: 'proto-17',
    titleFa: 'سایرن اخترشناسان',
    titleEn: 'Astral Siren',
    creatorFa: 'سوفیا لیند',
    creatorEn: 'Sofia Lind',
    categoryFa: 'انیمیشن صوتی‌تصویری',
    categoryEn: 'Audio-Visual Myth',
    clusterId: 'midnight-sound',
    clusterLabelFa: 'صدا و ریتم شب',
    clusterLabelEn: 'Midnight Sound',
    durationSec: 405,
    quality: '1080p',
    releaseYear: 2025,
    addedDaysAgo: 18,
    posterUrl: imgAstralSiren,
    accentHex: '#818CF8',
    synopsisFa:
      'سفر آوایی میان سحابی‌های دوردست با ریتم ملایم الکترونیک و طراحی انیمیشن سیال.',
    synopsisEn:
      'A drifting vocal and electronic odyssey through deep-space nebulae with fluid cel animation.',
    tags: ['animation', 'astral', 'ambient', 'music', 'calm'],
    tagsFa: ['انیمیشن', 'موسیقی', 'آرام', 'فضایی'],
    vector: { tension: 0.28, pace: 0.35, surrealism: 0.87, nocturnal: 0.79, intimacy: 0.66, depth: 0.76 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Nordic Cinema Archive',
    subtitles: [],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'ندای سحابی', labelEn: 'Nebula Call' }],
    spatialPos: { x: 58, y: 40, z: 0.69 }
  },
  {
    id: 'proto-18',
    titleFa: 'شکوفه کسوف',
    titleEn: 'Eclipse Bloom',
    // Also omits optional creator to verify missing-field handling
    categoryFa: 'تجربی و مدیتیشن بصری',
    categoryEn: 'Experimental Bloom',
    clusterId: 'surreal-art',
    clusterLabelFa: 'هنر سورئال',
    clusterLabelEn: 'Surreal Art',
    durationSec: 295,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 2,
    posterUrl: imgEclipseBloom,
    accentHex: '#FB7185',
    synopsisFa:
      'گیاهان بیولومینسنت در لحظه خورشیدگرفتگی کامل باز می‌شوند؛ مطالعه زمان‌گریز بر نور و رنگ.',
    synopsisEn:
      'Bioluminescent flora opening during a total solar eclipse in macro slow-motion clarity.',
    tags: ['eclipse', 'nature', 'macro', 'surreal', 'slow-burn'],
    tagsFa: ['کسوف', 'ماکرو', 'سورئال', 'آهسته'],
    vector: { tension: 0.25, pace: 0.18, surrealism: 0.90, nocturnal: 0.74, intimacy: 0.61, depth: 0.82 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Aeon Verified Originals',
    subtitles: [],
    chapters: [{ id: 'c1', timeSec: 0, labelFa: 'لحظه کسوف', labelEn: 'Totality' }],
    spatialPos: { x: 82, y: 84, z: 0.75 }
  },
  {
    id: 'proto-19',
    mediaType: 'cinema',
    titleFa: 'فیوز: عملیات لندن (Fuze)',
    titleEn: 'Fuze',
    creatorFa: 'دیوید مکنزی',
    creatorEn: 'David Mackenzie',
    categoryFa: 'اکشن و تریلر جنایی',
    categoryEn: 'Action Heist Thriller',
    clusterId: 'noir-shadows',
    clusterLabelFa: 'اکشن و تعلیق',
    clusterLabelEn: 'High-Stakes Thriller',
    durationSec: 5880,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 0,
    posterUrl: posterRainDetective,
    accentHex: '#F5B942',
    synopsisFa:
      'کشف یک بمب عمل‌نکرده از جنگ جهانی دوم در قلب لندن، تخلیه گسترده شهر را رقم می‌زند و پوششی بی‌نقص برای یک سرقت الماس میلیاردی در زیر زمین می‌شود.',
    synopsisEn:
      'The discovery of an unexploded WWII bomb in central London triggers a mass evacuation, serving as the perfect cover for a high-stakes subterranean heist.',
    tags: ['action', 'thriller', 'heist', 'london', 'tension'],
    tagsFa: ['اکشن', 'هیجانی', 'سرقت', 'لندن', 'تریلر'],
    vector: { tension: 0.96, pace: 0.88, surrealism: 0.25, nocturnal: 0.84, intimacy: 0.42, depth: 0.85 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Aether IMAX Box Office',
    subtitles: [
      { startSec: 0, endSec: 8, fa: 'شمارش معکوس در تونل‌های زیرزمینی لندن آغاز شده است...', en: 'The countdown beneath London’s subterranean vault has begun...' },
      { startSec: 8, endSec: 18, fa: 'وقتی تمام شهر تخلیه شود، تنها بیست دقیقه فرصت داریم.', en: 'Once the cordon clears the streets, we have twenty minutes.' }
    ],
    chapters: [
      { id: 'fz-1', timeSec: 0, labelFa: 'تخلیه منطقه قرمز', labelEn: 'Red Zone Evacuation' },
      { id: 'fz-2', timeSec: 180, labelFa: 'ورود به خزانه', labelEn: 'Vault Breach' }
    ],
    spatialPos: { x: 34, y: 28, z: 0.95 }
  },
  {
    id: 'proto-20',
    mediaType: 'cinema',
    titleFa: 'فصل اول - قسمت اول: طلوع ابسیدین',
    titleEn: 'Season 1 - Episode 1: Obsidian Dawn',
    creatorFa: 'استودیو اوریون',
    creatorEn: 'Orion Drama Collective',
    categoryFa: 'سریال درام و معمایی',
    categoryEn: 'Mystery Drama Series',
    clusterId: 'neon-futures',
    clusterLabelFa: 'سریال‌های برگزیده',
    clusterLabelEn: 'Prestige Series',
    durationSec: 3240,
    quality: '4K HDR',
    releaseYear: 2026,
    addedDaysAgo: 1,
    posterUrl: posterCyberMemory,
    accentHex: '#F5B942',
    synopsisFa:
      'در قسمت افتتاحیه فصل اول، کارآگاه آرشام وارد پرونده ناپدید شدن مهندسان پروژه کوانتومی در رصدخانه کوهستانی می‌شود.',
    synopsisEn:
      'In the Season 1 premiere, an investigator uncovers encrypted transmissions linking a mountain observatory to a vanished syndicate.',
    tags: ['series', 'mystery', 'noir', 'episode-1', 'drama'],
    tagsFa: ['سریال', 'فصل اول', 'معمایی', 'درام', 'نئوار'],
    vector: { tension: 0.89, pace: 0.72, surrealism: 0.54, nocturnal: 0.91, intimacy: 0.58, depth: 0.93 },
    availabilityStatus: 'available',
    licenseVerified: true,
    consentVerified: true,
    sourceName: 'Aether Series Originals',
    subtitles: [
      { startSec: 0, endSec: 9, fa: 'فصل اول، قسمت اول: سیگنال‌ها از ایستگاه متروکه هنوز ادامه دارند.', en: 'Season 1, Episode 1: The transmissions from the abandoned station are still active.' }
    ],
    chapters: [
      { id: 's1e1-1', timeSec: 0, labelFa: 'پیش‌درآمد', labelEn: 'Prologue' },
      { id: 's1e1-2', timeSec: 140, labelFa: 'پرونده طبقه هفتم', labelEn: 'The Seventh Floor Dossier' }
    ],
    spatialPos: { x: 48, y: 42, z: 0.91 }
  }
];

export const PROTOTYPE_MEDIA_CATALOG: PrototypeMediaItem[] = [
  ...AUDIO_MEDIA_CATALOG
];

export const INITIAL_USER_STATE: UserAccountState = {
  profileId: 'local-device-vault',
  displayName: 'فضای شخصی شما',
  ageVerified: true,
  jurisdiction: 'global-standard',
  consentEssential: true,
  consentPersonalization: true,
  personalizationEnabled: true,
  blockedTopics: [],
  preferredQuality: 'auto',
  defaultSubtitleLang: 'fa',
  defaultSpeed: 1,
  reducedMotion: false,
  highContrast: false,
  liteUniverseMode: false,
  notificationsEnabled: true,
  digestAlertsEnabled: false,
  sessions: [
    {
      id: 'sess-current',
      deviceLabel: 'حافظه محلی همین دستگاه (In-App Vault)',
      locationLabel: 'Local Device Storage',
      lastActive: 'هم‌اکنون · ذخیره خودکار',
      isCurrent: true
    }
  ]
};
