import type { ImdbFilmMetadata } from './filmDetailsClient';
import type { PrototypeMediaItem } from './types';

export type AiSubtitleLanguageCode = 'fa' | 'en' | 'ar' | string;

export interface SyncedSubtitleCue {
  id: string;
  startSec: number;
  endSec: number;
  en: string;
  fa: string;
}

export interface AiSubtitleSyncResult {
  filmId: string;
  matchedFilename: string;
  confidencePct: number;
  detectedFps: string;
  autoOffsetMs: number;
  matchedAt: string;
  languageNative?: string;
  cues: SyncedSubtitleCue[];
}

export type AiSyncedSubtitleResult = AiSubtitleSyncResult;

function formatTimestamp(sec: number, separator: ',' | '.'): string {
  const safe = Math.max(0, sec);
  const totalMs = Math.round(safe * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}${separator}${String(ms).padStart(3, '0')}`;
}

export function generateAiSyncedSubtitles(
  item: PrototypeMediaItem,
  imdbOrLang?: ImdbFilmMetadata | string | null,
  resolutionOrDuration?: string | number,
  langCode = 'fa'
): AiSubtitleSyncResult {
  const imdb =
    typeof imdbOrLang === 'object' && imdbOrLang !== null ? imdbOrLang : null;
  const resolvedLang =
    typeof imdbOrLang === 'string' ? imdbOrLang : langCode;
  const resolutionLabel =
    typeof resolutionOrDuration === 'string' ? resolutionOrDuration : item.quality;

  const cleanTitleSlug = item.titleEn
    .replace(/[^a-zA-Z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  const imdbTag = imdb?.imdbId ? `.${imdb.imdbId}` : '';
  const resTag = resolutionLabel ? `.${resolutionLabel.replace(/\s+/g, '')}` : '';
  const matchedFilename = `${cleanTitleSlug}${imdbTag}${resTag}.AI-Synced.${resolvedLang}.srt`;

  const hashSeed = item.id.split('').reduce((acc, ch) => acc * 33 + ch.charCodeAt(0), 17);
  const paceScore = item.vector?.pace ?? 0.5;
  const detectedFps = paceScore > 0.65 ? '23.976 fps (NTSC Film)' : '24.000 fps (True Cinema)';
  const autoOffsetMs = ((hashSeed % 9) - 4) * 35;
  const confidencePct = Number((98.1 + ((hashSeed % 17) / 10)).toFixed(1));

  const duration = Math.max(60, item.durationSec);
  const cues: SyncedSubtitleCue[] = [];

  cues.push({
    id: `${item.id}-ai-0`,
    startSec: 1,
    endSec: Math.min(8, duration * 0.08),
    en: `${imdb?.matchedTitle || item.titleEn} (${imdb?.year || item.releaseYear}) — Dir. ${
      imdb?.director || item.creatorEn || 'Aether Cinema'
    }`,
    fa: `${item.titleFa} (${imdb?.year || item.releaseYear}) — کارگردان: ${
      item.creatorFa || imdb?.director || 'آتر سینما'
    }`
  });

  item.subtitles.forEach((s, idx) => {
    cues.push({
      id: `${item.id}-ai-base-${idx}`,
      startSec: s.startSec,
      endSec: s.endSec,
      en: s.en,
      fa: s.fa
    });
  });

  const sortedChapters = [...item.chapters].sort((a, b) => a.timeSec - b.timeSec);
  sortedChapters.forEach((ch, idx) => {
    const start = Math.max(2, ch.timeSec);
    const end = Math.min(duration - 2, start + 11);
    if (end > start + 2) {
      cues.push({
        id: `${item.id}-ai-ch-${idx}`,
        startSec: start,
        endSec: end,
        en: `[Scene ${idx + 1}: ${ch.labelEn}] — ${item.synopsisEn.split('.')[0]}.`,
        fa: `[سکانس ${idx + 1}: ${ch.labelFa}] — ${item.synopsisFa.split('؛')[0] || item.synopsisFa}`
      });
    }
  });

  const sliceCount = 8;
  const step = duration / (sliceCount + 1);
  const castText = imdb?.cast?.slice(0, 2).join(' & ') || item.creatorEn || 'Lead Ensemble';

  for (let i = 1; i <= sliceCount; i++) {
    const tStart = Math.round(step * i);
    const tEnd = Math.min(duration - 1, tStart + 10);
    const alreadyCovered = cues.some(
      (c) => (tStart >= c.startSec && tStart <= c.endSec) || Math.abs(c.startSec - tStart) < 7
    );
    if (!alreadyCovered && tEnd > tStart + 2) {
      cues.push({
        id: `${item.id}-ai-beat-${i}`,
        startSec: tStart,
        endSec: tEnd,
        en:
          i % 2 === 0
            ? `[Ambient Audio · ${castText}] ${item.clusterLabelEn} — ${item.synopsisEn.split('.')[0] || item.synopsisEn}`
            : `[Visual Cue #${i}] ${item.tags.slice(0, 3).join(' · ')} — ${item.categoryEn}`,
        fa:
          i % 2 === 0
            ? `[فضاسازی صوتی · ${castText}] ${item.clusterLabelFa} — ${item.synopsisFa.split('؛')[0] || item.synopsisFa}`
            : `[نشانه سکانس ${i}] ${item.categoryFa} — ${item.titleFa}`
      });
    }
  }

  cues.sort((a, b) => a.startSec - b.startSec);

  return {
    filmId: item.id,
    matchedFilename,
    confidencePct: Math.min(99.8, confidencePct),
    detectedFps,
    autoOffsetMs,
    matchedAt: new Date().toISOString(),
    languageNative: resolvedLang === 'fa' ? 'فارسی' : 'English',
    cues
  };
}

export function buildSrtContent(
  cues: Array<{ startSec: number; endSec: number; fa: string; en: string }>,
  offsetMs = 0,
  renderText?: (cue: { startSec: number; endSec: number; fa: string; en: string }) => string
): string {
  const offsetSec = offsetMs / 1000;
  const fmt = renderText ?? ((c) => c.fa || c.en);
  return cues
    .map((cue, idx) => {
      const start = Math.max(0, cue.startSec + offsetSec);
      const end = Math.max(start + 1.2, cue.endSec + offsetSec);
      return `${idx + 1}\n${formatTimestamp(start, ',')} --> ${formatTimestamp(
        end,
        ','
      )}\n${fmt(cue)}\n`;
    })
    .join('\n');
}

export function buildWebVttContent(
  cues: Array<{ startSec: number; endSec: number; fa: string; en: string }>,
  offsetMs = 0,
  renderText?: (cue: { startSec: number; endSec: number; fa: string; en: string }) => string
): string {
  const offsetSec = offsetMs / 1000;
  const fmt = renderText ?? ((c) => c.fa || c.en);
  const body = cues
    .map((cue) => {
      const start = Math.max(0, cue.startSec + offsetSec);
      const end = Math.max(start + 1.2, cue.endSec + offsetSec);
      return `${formatTimestamp(start, '.')} --> ${formatTimestamp(
        end,
        '.'
      )}\n${fmt(cue)}\n`;
    })
    .join('\n');
  return `WEBVTT\n\n${body}`;
}
