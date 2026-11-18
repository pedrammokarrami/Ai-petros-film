import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Globe,
  HardDriveDownload,
  RotateCcw,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2
} from 'lucide-react';
import type { TasteVector, UiLang, UserAccountState } from '../types';
import { formatBytes } from '../downloadEngine';
import { useAutoTranslation } from '../i18n';
import {
  getAssetPreloadProgress,
  startFullGraphicAssetDownload,
  subscribeAssetPreloadProgress,
  type AssetPreloadProgress
} from '../../services/roomAssetPreloader';
import { usePWAInstall } from '../components/usePWAInstall';

interface SettingsScreenProps {
  lang: UiLang;
  user: UserAccountState;
  userVector: TasteVector;
  vaultSizeBytes: number;
  onChangeLang: (lang: UiLang) => void;
  onOpenLanguagePicker: () => void;
  onUpdateUser: (patch: Partial<UserAccountState>) => void;
  onUpdateTasteVector: (patch: Partial<TasteVector>) => void;
  onRevokeSession: (sessionId: string) => void;
  onResetTasteAndHistory: () => void;
  onExportPersonalData: () => void;
  onWipeLocalMemory: () => void;
}

const SONIC_TASTE_AXES: Array<{
  key: keyof TasteVector;
  labelFa: string;
  labelEn: string;
  genreFa: string;
  genreEn: string;
  colorHex: string;
}> = [
  {
    key: 'nocturnal',
    labelFa: 'اتمسفر شبانه و جاز کافه',
    labelEn: 'Nocturnal & Cafe Jazz',
    genreFa: 'جاز نوار · ساکسیفون و پیانو',
    genreEn: 'Noir Jazz & Acoustic Saloon',
    colorHex: '#F5B942'
  },
  {
    key: 'pace',
    labelFa: 'انرژی و ضرب‌آهنگ (BPM بالا)',
    labelEn: 'Rhythm & Club Energy (BPM)',
    genreFa: 'ملودیک تکنو · کلاب و دی‌جی',
    genreEn: 'Melodic Techno & Club Mix',
    colorHex: '#00F0FF'
  },
  {
    key: 'depth',
    labelFa: 'عمق روایی و کتاب صوتی',
    labelEn: 'Narrative Depth & Audiobooks',
    genreFa: 'کتاب صوتی و پادکست تحلیلی',
    genreEn: 'Audiobooks & Studio Podcasts',
    colorHex: '#34D399'
  },
  {
    key: 'surrealism',
    labelFa: 'صدای فضایی و سینت‌ویو',
    labelEn: 'Spatial Sound & Synthwave',
    genreFa: 'سینت‌ویو و الکترونیک فضایی',
    genreEn: 'Synthwave & Spatial Ambient',
    colorHex: '#A78BFA'
  },
  {
    key: 'intimacy',
    labelFa: 'آکوستیک گرم و صمیمی',
    labelEn: 'Warm Acoustic Intimacy',
    genreFa: 'گیتار آکوستیک و ویولن‌سل',
    genreEn: 'Acoustic Guitar & Chamber Cello',
    colorHex: '#FB7185'
  },
  {
    key: 'tension',
    labelFa: 'هیجان و درام صوتی',
    labelEn: 'Sonic Tension & Drama',
    genreFa: 'داستان‌های معمایی و تریلر صوتی',
    genreEn: 'Mystery Audio Drama',
    colorHex: '#F97316'
  }
];

export function SettingsScreen({
  lang,
  userVector,
  vaultSizeBytes,
  onChangeLang,
  onUpdateTasteVector,
  onResetTasteAndHistory,
  onExportPersonalData,
  onWipeLocalMemory
}: SettingsScreenProps) {
  const { t } = useAutoTranslation(lang);
  const [assetProgress, setAssetProgress] = useState<AssetPreloadProgress>(() =>
    getAssetPreloadProgress()
  );
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    return subscribeAssetPreloadProgress(setAssetProgress);
  }, []);

  const pct =
    assetProgress.totalFiles > 0
      ? Math.min(100, Math.round((assetProgress.completedFiles / assetProgress.totalFiles) * 100))
      : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-7 pb-16">
      {/* 1. Language Switcher */}
      <section className="rounded-3xl border border-[#F5B942]/35 bg-gradient-to-r from-[#12101B] via-[#0B0D14] to-[#171209] p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_20px_60px_rgba(0,0,0,0.75)]">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#F5B942]">
            <Globe className="h-4 w-4" />
            {t('INTERFACE LANGUAGE · aipetros-sound', 'زبان رابط کاربری · aipetros-sound')}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#F8FAFC]">
            {t('aipetros-sound Studio & Audio DNA Settings', 'تنظیمات جهان صوتی aipetros-sound')}
          </h1>
        </div>

        <div className="inline-flex items-center rounded-2xl border border-[#F5B942]/45 bg-[#06070C] p-1.5">
          <button
            type="button"
            onClick={() => onChangeLang('fa')}
            className={`min-h-[40px] rounded-xl px-5 py-2 text-xs sm:text-sm font-black transition-all cursor-pointer ${
              lang === 'fa'
                ? 'bg-[#F5B942] text-[#06070C]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            فارسی
          </button>
          <button
            type="button"
            onClick={() => onChangeLang('en')}
            className={`min-h-[40px] rounded-xl px-5 py-2 text-xs sm:text-sm font-black transition-all cursor-pointer ${
              lang === 'en'
                ? 'bg-[#F5B942] text-[#06070C]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            English
          </button>
        </div>
      </section>

      {/* 2. Offline 3D Graphic Pack & App Installation */}
      <section className="rounded-3xl border border-[#00F0FF]/25 bg-[#0A0A0F] p-6 sm:p-8 space-y-5 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00F0FF]">
              <HardDriveDownload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
                {t('Offline 3D Graphics & App Install', 'ذخیره آفلاین گرافیک‌های سه‌بعدی و نصب برنامه')}
              </h2>
              <p className="text-xs text-[#94A3B8]">
                {t(
                  'All 3D rooms, GLB props, Poly Haven PBR textures, and HDRIs download automatically onto your device for instant loading',
                  'تمامی مدل‌های سه‌بعدی، تکسچرهای محیطی و فایل‌های گرافیکی برای اجرای سریع و بدون تاخیر روی دستگاه شما ذخیره می‌شوند'
                )}
              </p>
            </div>
          </div>

          {!isInstalled && (isInstallable || isIOS) && (
            <button
              type="button"
              onClick={() => {
                if (isInstallable) {
                  void install();
                } else if (isIOS) {
                  setShowIOSGuide(true);
                }
              }}
              className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#F5B942] px-4 py-2 text-xs font-black text-[#06070C] hover:bg-[#FDE68A] transition-colors cursor-pointer"
            >
              <Smartphone className="h-4 w-4" />
              <span>{t('Install aipetros-sound App', 'نصب اپلیکیشن aipetros-sound')}</span>
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#06070C] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#F8FAFC]">
              {assetProgress.status === 'ready' ? (
                <CheckCircle2 className="h-4 w-4 text-[#34D399]" />
              ) : (
                <HardDriveDownload className="h-4 w-4 text-[#00F0FF]" />
              )}
              {assetProgress.status === 'ready'
                ? t('All 3D graphics cached locally on device', 'تمام بخش‌های گرافیکی روی دستگاه شما ذخیره شد')
                : assetProgress.status === 'downloading'
                  ? t('Downloading graphic pack to device...', 'در حال دانلود و ذخیره گرافیک‌ها روی دستگاه...')
                  : t('Initializing offline graphic pack...', 'آماده‌سازی پکیج گرافیکی آفلاین...')}
            </span>

            <span dir="ltr" className="font-mono-tabular text-[#00F0FF] font-bold">
              {assetProgress.completedFiles}/{assetProgress.totalFiles || '—'} ·{' '}
              {formatBytes(assetProgress.downloadedBytes)}
            </span>
          </div>

          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] to-[#F5B942] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-[#94A3B8]">
              {assetProgress.persistentGranted
                ? t('Persistent device storage granted', 'حافظه دائمی دستگاه فعال است')
                : t('Browser CacheStorage active', 'کش داخلی مرورگر فعال است')}
            </span>
            <button
              type="button"
              onClick={() => void startFullGraphicAssetDownload(true)}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-3.5 py-1.5 text-xs font-bold text-[#00F0FF] hover:bg-[#00F0FF]/20 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t('Verify & Download Graphics Pack', 'دانلود و بررسی کامل گرافیک‌ها')}</span>
            </button>
          </div>
        </div>

        {showIOSGuide && (
          <div className="rounded-2xl border border-[#F5B942]/40 bg-[#F5B942]/10 p-4 text-xs text-[#F8FAFC] space-y-2">
            <p className="font-bold text-[#F5B942]">
              {t('Install on iPhone / iPad', 'نصب روی آیفون و آیپد')}
            </p>
            <p className="text-[#CBD5E1]">
              {t(
                '1. Tap the Share icon in Safari. 2. Select "Add to Home Screen" for fullscreen standalone performance.',
                '۱. دکمه Share را در سافاری لمس کنید. ۲. گزینه Add to Home Screen را انتخاب کنید تا برنامه به‌صورت تمام‌صفحه اجرا شود.'
              )}
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="rounded-lg bg-white/10 px-3 py-1 text-[11px] font-bold hover:bg-white/20 cursor-pointer"
            >
              {t('Close', 'بستن')}
            </button>
          </div>
        )}
      </section>

      {/* 3. 6D Sonic Taste DNA */}
      <section className="rounded-3xl border border-[#F5B942]/30 bg-[#0A0A0F] p-6 sm:p-8 space-y-6 shadow-[0_18px_50px_rgba(0,0,0,0.7)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5B942]/15 border border-[#F5B942]/40 text-[#F5B942]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#F8FAFC]">
                {t('AI Sonic Taste DNA', 'پروفایل هوش مصنوعی سلیقه شنیداری شما')}
              </h2>
              <p className="text-xs text-[#94A3B8]">
                {t(
                  'Tune your 6D acoustic vector to customize music, podcast, and audiobook recommendations',
                  'تنظیم بردار ۶بعدی سلیقه صوتی برای شخصی‌سازی پیشنهادهای موسیقی، پادکست و کتاب صوتی'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onResetTasteAndHistory}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-[#CBD5E1] hover:border-[#F5B942] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#F5B942]" />
            <span>{t('Reset Sonic DNA', 'بازنشانی سلیقه صوتی')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SONIC_TASTE_AXES.map((axis) => {
            const pctVal = Math.round((userVector[axis.key] ?? 0.5) * 100);
            return (
              <div
                key={String(axis.key)}
                className="rounded-2xl border border-white/10 bg-[#06070C] p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#F8FAFC]">
                    {t(axis.labelEn, axis.labelFa)}
                  </span>
                  <span
                    dir="ltr"
                    className="font-mono-tabular font-black"
                    style={{ color: axis.colorHex }}
                  >
                    {pctVal}%
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={pctVal}
                  onChange={(e) =>
                    onUpdateTasteVector({
                      [axis.key]: Number(e.target.value) / 100
                    })
                  }
                  className="w-full accent-[#F5B942] h-1.5 bg-white/15 rounded-lg cursor-pointer"
                />

                <p className="text-[11px] text-[#94A3B8]">
                  {t(axis.genreEn, axis.genreFa)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Audio Playback & Local Vault */}
      <section className="rounded-3xl border border-white/10 bg-[#0A0A0F] p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-4">
          <Sliders className="h-5 w-5 text-[#F5B942]" />
          <h2 className="text-base sm:text-lg font-black text-[#F8FAFC]">
            {t('Audio Preferences & Local Vault', 'تنظیمات پخش صوتی و حافظه محلی')}
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="text-xs text-[#94A3B8]">
            {t('Local Vault Storage Used:', 'حجم حافظه محلی استفاده‌شده:')}{' '}
            <strong dir="ltr" className="font-mono-tabular text-[#F5B942]">
              {formatBytes(vaultSizeBytes)}
            </strong>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onExportPersonalData}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-bold text-[#F8FAFC] hover:border-[#F5B942] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#F5B942]" />
              <span>{t('Export JSON Backup', 'دانلود پشتیبان JSON')}</span>
            </button>

            <button
              type="button"
              onClick={onWipeLocalMemory}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 px-4 py-2 text-xs font-bold text-[#F87171] hover:bg-[#F87171]/20 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('Reset Local Vault', 'پاک‌سازی حافظه محلی')}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
