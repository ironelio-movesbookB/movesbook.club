/**
 * Tools Settings Constants
 * Extracted from ToolsSettings.tsx
 */

import {
  normalizeSportsIndicatedToLibraryKeys,
  sanitizeSportsIndicatedForLibrary,
} from '@/constants/exerciseLibrarySports';

export type IconType = 'emoji' | 'bw_icons';
export type ToolsTab =
  | 'periods'
  | 'periodizationPlan'
  | 'periodizationLibrary'
  | 'sections'
  | 'sports'
  | 'equipment'
  | 'equipmentFactories'
  | 'muscles'
  | 'sportsEquipment'
  | 'exercises'
  | 'myLibrary'
  | 'devices'
  | 'executionTechniques'
  | 'bodyBuildingTechniques'
  | 'commonDailyActions'
  | 'workMethods'
  | 'insertActions'
  | 'sportDropdownParameters'
  | 'sportMachines'
  | 'pathologies';

export interface Period {
  id: string;
  title: string;
  description: string;
  /** Per-language titles (Super Admin); English should match `title` / DB `name` for compatibility */
  titleByLanguage?: Record<string, string>;
  /** Per-language descriptions (Super Admin); English should match `description` for DB/API compatibility */
  descriptionByLanguage?: Record<string, string>;
  color: string;
  order: number;
  userId?: string; // Track ownership
  isUserCreated?: boolean; // Distinguish user-created from admin defaults
}

export interface WorkoutSection {
  id: string;
  title: string;
  description: string;
  /** Per-language titles (Super Admin); English should match `title` / DB `name` */
  titleByLanguage?: Record<string, string>;
  /** Per-language descriptions (Super Admin); English should match `description` */
  descriptionByLanguage?: Record<string, string>;
  color: string;
  code?: string;
  picture?: string;
  order: number;
  userId?: string; // Track ownership
  isUserCreated?: boolean; // Distinguish user-created from admin defaults
}

export interface ExecutionTechnique {
  id: string;
  title: string;
  description: string;
  /** Per-language titles (Super Admin); English should match `title` / DB `name` */
  titleByLanguage?: Record<string, string>;
  /** Per-language descriptions (Super Admin); English should match `description` */
  descriptionByLanguage?: Record<string, string>;
  color: string;
  sports: string[]; // Array of sport names that can use this technique
  order: number;
  userId?: string; // Track ownership
  isUserCreated?: boolean; // Distinguish user-created from admin defaults
}

// Backward compatibility alias
export type BodyBuildingTechnique = ExecutionTechnique;

/** Catalog row for exercise contraindications (Technical Settings → Pathologies). */
export interface ExercisePathologyCatalogItem {
  id: string;
  /** English / canonical label (kept in sync with `nameByLanguage.en`). */
  name: string;
  /** Localized pathology labels keyed by `SUPPORTED_LANGUAGES` code. */
  nameByLanguage?: Record<string, string>;
  /** English / canonical description (kept in sync with `descriptionByLanguage.en`). */
  description?: string;
  /** Localized descriptions keyed by `SUPPORTED_LANGUAGES` code. */
  descriptionByLanguage?: Record<string, string>;
  /** Illustration (URL or data URL) — same for all languages. */
  picture?: string;
  order: number;
}

export function getPathologyNameForLang(item: ExercisePathologyCatalogItem, lang: string): string {
  const byLang = item.nameByLanguage || {};
  const en = (byLang.en || item.name || '').trim();
  if (lang === 'en') return en;
  return (byLang[lang] || '').trim() || en;
}

export function getPathologyDescriptionForLang(item: ExercisePathologyCatalogItem, lang: string): string {
  const byLang = item.descriptionByLanguage || {};
  const en = (byLang.en || item.description || '').trim();
  if (lang === 'en') return en;
  return (byLang[lang] || '').trim() || en;
}

export function getPathologyInfoForLang(ex: Exercise, lang: string): string {
  const byLang = ex.contraindicatedPathologiesInfoByLanguage || {};
  const en = (byLang.en || ex.contraindicatedPathologiesNote || '').trim();
  if (lang === 'en') return en;
  return (byLang[lang] || '').trim() || en;
}

export function getExerciseDescriptionForLang(ex: Exercise, lang: string): string {
  const byLang = ex.descriptionByLanguage || {};
  const en = (byLang.en || ex.description || '').trim();
  if (lang === 'en') return en;
  return (byLang[lang] || '').trim() || en;
}

export function normalizePathologyCatalogItem(
  partial: Partial<ExercisePathologyCatalogItem> & { id: string },
  order: number
): ExercisePathologyCatalogItem {
  const nameByLanguage = { ...(partial.nameByLanguage || {}) };
  const descriptionByLanguage = { ...(partial.descriptionByLanguage || {}) };
  const legacyName = (partial.name || '').trim();
  const legacyDesc = (partial.description || '').trim();
  if (!nameByLanguage.en?.trim() && legacyName) nameByLanguage.en = legacyName;
  if (!descriptionByLanguage.en?.trim() && legacyDesc) descriptionByLanguage.en = legacyDesc;
  const name = (nameByLanguage.en || legacyName).trim();
  const description = (descriptionByLanguage.en || legacyDesc).trim();
  const picture = typeof partial.picture === 'string' ? partial.picture.trim() : '';
  return {
    id: partial.id,
    name,
    nameByLanguage,
    description,
    descriptionByLanguage,
    ...(picture ? { picture } : {}),
    order,
  };
}

export function normalizePathologyCatalog(raw: unknown): ExercisePathologyCatalogItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ExercisePathologyCatalogItem[] = [];
  raw.forEach((row, i) => {
    if (!row || typeof row !== 'object') return;
    const o = row as Record<string, unknown>;
    const id = String(o.id ?? '').trim() || `path-${Date.now()}-${i}`;
    const nameByLanguage =
      o.nameByLanguage && typeof o.nameByLanguage === 'object' && !Array.isArray(o.nameByLanguage)
        ? (o.nameByLanguage as Record<string, string>)
        : undefined;
    const descriptionByLanguage =
      o.descriptionByLanguage &&
      typeof o.descriptionByLanguage === 'object' &&
      !Array.isArray(o.descriptionByLanguage)
        ? (o.descriptionByLanguage as Record<string, string>)
        : undefined;
    const order = Number.isFinite(Number(o.order)) ? Number(o.order) : i;
    out.push(
      normalizePathologyCatalogItem(
        {
          id,
          name: String(o.name ?? ''),
          nameByLanguage,
          description: String(o.description ?? ''),
          descriptionByLanguage,
          picture: typeof o.picture === 'string' ? o.picture : undefined,
        },
        order
      )
    );
  });
  return out.sort((a, b) => a.order - b.order).map((p, i) => ({ ...p, order: i }));
}

/** Training levels for periodization favourites (dropdown on create/edit). */
export const PERIODIZATION_LEVEL_OPTIONS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Elite',
  'Professional',
  'Club',
  'National',
  'International',
] as const;

export type PeriodizationLevel = (typeof PERIODIZATION_LEVEL_OPTIONS)[number];

/** Exercise catalog difficulty bands (levels 1–5), aligned with Workouts → Parameters training levels. */
export const EXERCISE_DIFFICULTY_LEVEL_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Elite',
  5: 'Professional',
};

export const EXERCISE_DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const;

export function getExerciseDifficultyLabel(level: number): string {
  return EXERCISE_DIFFICULTY_LEVEL_LABELS[level as 1 | 2 | 3 | 4 | 5] ?? `Level ${level}`;
}

export function formatExerciseDifficultyLevels(levels: number[] | undefined): string {
  const nums = (levels || []).filter((n) => n >= 1 && n <= 5).sort((a, b) => a - b);
  if (nums.length === 0) return EXERCISE_DIFFICULTY_LEVEL_LABELS[1];
  return nums.map(getExerciseDifficultyLabel).join(', ');
}

/** Muscle / equipment summary for catalog detail cards (admin preview + future user catalog). */
export function getExerciseCatalogMuscleSummary(exercise: Exercise): {
  bodyPart: string;
  primaryMuscles: string;
  secondaryMuscles: string;
  equipment: string;
} {
  const ex = mergeExerciseWithDefaults(exercise);
  const tags = normalizeMuscleAreaPercentTags(ex.muscleAreaPercentTags || []);
  const mainAreas = tags.filter((t) => t.isMain && (t.area || '').trim()).map((t) => t.area.trim());
  const secondaryFromTags = tags
    .filter((t) => !t.isMain && (t.area || '').trim())
    .map((t) => t.area.trim());
  const primary =
    mainAreas.length > 0
      ? mainAreas.join(', ')
      : (ex.mainMuscleGroup || ex.muscleGroups?.[0] || '').trim();
  const secondary =
    secondaryFromTags.length > 0
      ? secondaryFromTags.join(', ')
      : (ex.secondaryMuscleGroups || []).filter(Boolean).join(', ');
  const bodyPart = [primary, secondary].filter(Boolean).join(', ');
  const equipment = (ex.equipmentType || ex.equipment?.join(', ') || '').trim();
  return {
    bodyPart: bodyPart || '—',
    primaryMuscles: primary || '—',
    secondaryMuscles: secondary || '—',
    equipment: equipment || '—',
  };
}

export function getExerciseDisplayNameForLang(exercise: Exercise, lang: string): string {
  const ex = mergeExerciseWithDefaults(exercise);
  if (lang === 'en') return (ex.name || '').trim() || '—';
  return (ex.nameByLanguage?.[lang] || ex.name || '').trim() || '—';
}

/** Saved builder state for a favourite periodization (52-week draft, not live yearly plan). */
export interface PeriodizationTemplateBuild {
  notesByPeriodId?: Record<string, string>;
  attachmentsByPeriodId?: Record<
    string,
    { id: string; name: string; url: string; mimeType?: string; size?: number }[]
  >;
  displayOrder?: string[];
  /** Calendar week number (1–52) → period id */
  weekPeriodByNumber?: Record<number, string>;
}

/** Named periodization presets (Super Admin defaults + user copies); stored in `toolsSettings` JSON. */
export interface PeriodizationTemplate {
  id: string;
  name: string;
  sport: string;
  level: string;
  /** Language of periods shown in the builder (`en`, `it`, …). */
  language: string;
  tags: string[];
  build?: PeriodizationTemplateBuild;
  isUserCreated?: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Localized period row for builder UI. */
export function periodForLanguage(period: Period, languageCode: string): Period {
  const code = (languageCode || 'en').toLowerCase().split('-')[0] || 'en';
  const title =
    period.titleByLanguage?.[code]?.trim() ||
    period.titleByLanguage?.en?.trim() ||
    period.title;
  const description =
    period.descriptionByLanguage?.[code]?.trim() ||
    period.descriptionByLanguage?.en?.trim() ||
    period.description;
  return { ...period, title, description };
}

export function normalizePeriodizationTemplates(raw: unknown): PeriodizationTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row, i) => {
    const o = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    const tagsRaw = o.tags;
    let tags: string[] = [];
    if (Array.isArray(tagsRaw)) {
      tags = tagsRaw.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof tagsRaw === 'string') {
      tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
    }
    const weekRaw = o.build && typeof o.build === 'object' ? (o.build as Record<string, unknown>) : null;
    let build: PeriodizationTemplateBuild | undefined;
    if (weekRaw) {
      const wpm = weekRaw.weekPeriodByNumber;
      let weekPeriodByNumber: Record<number, string> | undefined;
      if (wpm && typeof wpm === 'object') {
        weekPeriodByNumber = {};
        for (const [k, v] of Object.entries(wpm as Record<string, unknown>)) {
          const n = parseInt(k, 10);
          if (!Number.isNaN(n) && typeof v === 'string' && v.trim()) {
            weekPeriodByNumber[n] = v.trim();
          }
        }
      }
      build = {
        notesByPeriodId:
          weekRaw.notesByPeriodId && typeof weekRaw.notesByPeriodId === 'object'
            ? { ...(weekRaw.notesByPeriodId as Record<string, string>) }
            : undefined,
        attachmentsByPeriodId:
          weekRaw.attachmentsByPeriodId && typeof weekRaw.attachmentsByPeriodId === 'object'
            ? { ...(weekRaw.attachmentsByPeriodId as PeriodizationTemplateBuild['attachmentsByPeriodId']) }
            : undefined,
        displayOrder: Array.isArray(weekRaw.displayOrder)
          ? (weekRaw.displayOrder as string[]).map(String)
          : undefined,
        weekPeriodByNumber,
      };
    }
    return {
      id: String(o.id ?? '').trim() || `pt-${Date.now()}-${i}`,
      name: String(o.name ?? '').trim() || 'Untitled',
      sport: String(o.sport ?? '').trim(),
      level: String(o.level ?? '').trim(),
      language: String(o.language ?? 'en').trim() || 'en',
      tags,
      build,
      isUserCreated: Boolean(o.isUserCreated),
      notes: o.notes != null ? String(o.notes) : undefined,
      createdAt: o.createdAt != null ? String(o.createdAt) : undefined,
      updatedAt: o.updatedAt != null ? String(o.updatedAt) : undefined,
    };
  });
}

export interface Sport {
  id: string;
  name: string;
  icon: string;
  order: number;
  isTop5: boolean;
}

export interface Equipment {
  id: string;
  name: string;
  picture?: string;
  category: string;
  sports: string[]; // Multi-select sports tags
  company?: string;
  description: string;
  inStock: boolean;
  isUserCreated?: boolean; // Distinguish user-created from admin defaults
  // Athlete-specific fields
  startDate?: string;
  durationAlarm?: {
    days?: number;
    km?: number;
    time?: string;
  };
}

/** Exercise bank typology (single choice in Section Exercises form). */
export type ExerciseTypology =
  | 'Strength'
  | 'Aerobic'
  | 'Stretching'
  | 'Gymnic'
  | 'Pilates'
  | 'Calistenic'
  | 'Spartan'
  | 'Crossfit'
  | 'Technical moves for sports';

/** Label 6 — one muscular area with % involvement; exactly one row uses `isMain` in the saved list. */
export type MuscleAreaPercentTag = {
  area: string;
  percent: number;
  isMain: boolean;
};

/** Label 7 — one FAQ with question and answer per language (`SUPPORTED_LANGUAGES` codes). */
export interface ExerciseFaqEntry {
  id: string;
  questionByLanguage: Record<string, string>;
  answerByLanguage: Record<string, string>;
}

function newExerciseFaqId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `faq-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function newExerciseFaqEntry(): ExerciseFaqEntry {
  return {
    id: newExerciseFaqId(),
    questionByLanguage: {},
    answerByLanguage: {},
  };
}

/** Ensure each FAQ has a stable id and plain language maps (for JSON round-trips). */
export function normalizeExerciseFaqs(raw: ExerciseFaqEntry[] | undefined | null): ExerciseFaqEntry[] {
  if (!raw?.length) return [];
  return raw.map((row) => {
    const id =
      row && typeof row.id === 'string' && row.id.trim() !== '' ? row.id.trim() : newExerciseFaqId();
    const q =
      row.questionByLanguage && typeof row.questionByLanguage === 'object'
        ? { ...row.questionByLanguage }
        : {};
    const a =
      row.answerByLanguage && typeof row.answerByLanguage === 'object' ? { ...row.answerByLanguage } : {};
    return { id, questionByLanguage: q, answerByLanguage: a };
  });
}

/** True if this FAQ has any non-empty question or answer in any language (used when saving or listing). */
export function exerciseFaqEntryHasContent(entry: ExerciseFaqEntry): boolean {
  const qHit = Object.values(entry.questionByLanguage || {}).some((v) => String(v || '').trim() !== '');
  const aHit = Object.values(entry.answerByLanguage || {}).some((v) => String(v || '').trim() !== '');
  return qHit || aHit;
}

/** Who can share / source of the exercise definition. */
export type ExerciseSharedBy =
  | 'MOVESBOOK'
  | 'SINGLE_USER'
  | 'COACH'
  | 'TEAM_TRAINER'
  | 'CLUB_TRAINER'
  | 'MY_LIBRARY';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  description: string;
  equipment: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  muscleGroups: string[];
  isUserCreated?: boolean; // Distinguish user-created from admin defaults

  /** Section Exercises — extended fields (optional for legacy JSON rows). */
  typology?: ExerciseTypology | '';
  /** Sport names from the user’s sports list (multi). */
  sportsIndicated?: string[];
  /** Single equipment modality for this exercise. */
  equipmentType?: string;
  /** Technical Settings → Machines: catalogue rows usually used with this exercise (IDs from sport_machines). */
  usualSportMachineIds?: string[];
  /** Twinned / related exercises in the catalog (exercise ids). */
  relatedExerciseIds?: string[];
  /** Localized names keyed by `SUPPORTED_LANGUAGES` code (English uses `name`). */
  nameByLanguage?: Record<string, string>;
  /** Short summary for lists — one entry per supported language (English uses `description`). */
  descriptionByLanguage?: Record<string, string>;
  /** Short catalog / reference code (optional). */
  exerciseCode?: string;
  /** Free text: conditions or pathologies for which the exercise is not recommended (legacy plain; use `contraindicatedPathologiesInfoByLanguage`). */
  contraindicatedPathologiesNote?: string;
  /** Info & contraindications — rich text per language (Pathologies tab). */
  contraindicatedPathologiesInfoByLanguage?: Record<string, string>;
  /** IDs from Technical Settings → Pathologies — exercise is not suggested when these apply. */
  contraindicatedPathologyIds?: string[];
  /**
   * How to execute the exercise — long text per language (same pattern as Language → Long texts / tools translations).
   * English (`en`) is the primary reference; `description` may stay a short summary for lists.
   */
  executionByLanguage?: Record<string, string>;
  /** Expert suggestions / coaching cues — long text per language (Language → Long texts pattern). */
  expertSuggestionsByLanguage?: Record<string, string>;
  /** Breathing pattern / cues — long text per language (Language → Long texts pattern). */
  breathingByLanguage?: Record<string, string>;
  /** Common mistakes / what to avoid — long text per language (Language → Long texts pattern). */
  mistakesByLanguage?: Record<string, string>;
  /** Label 7 — ordered FAQs (question + answer per language). */
  exerciseFaqs?: ExerciseFaqEntry[];
  /** Muscular areas with % (main + tagged others); percents should total 100. */
  muscleAreaPercentTags?: MuscleAreaPercentTag[];
  mainMuscleGroup?: string;
  secondaryMuscleGroups?: string[];
  /** Difficulty bands 1–5 (multi): Beginner … Professional — see `EXERCISE_DIFFICULTY_LEVEL_LABELS`. */
  levels?: number[];
  sharedBy?: ExerciseSharedBy | '';
  /** Movesbook staff label or approved sharer username. */
  sharedByUsername?: string;
  pictureAMale?: string;
  pictureAFemale?: string;
  pictureBMale?: string;
  pictureBFemale?: string;
  officialVideoUrl?: string;
  /** Optional inline video (small files only; prefer URL for production). */
  officialVideoDataUrl?: string;
  /** Female demo — URL (mirrors male official video fields). */
  officialVideoUrlFemale?: string;
  /** Female demo — optional inline video (same size limits as male). */
  officialVideoDataUrlFemale?: string;
  referenceUrl1?: string;
  referenceUrl2?: string;
  enabled?: boolean;
  /**
   * Optional secret the creator sets in the exercise form; deleting this exercise from the tools bank
   * prompts for this exact string. Leave empty to use a normal confirm dialog only.
   */
  deleteGuardPassword?: string;
}

/** Defaults for the Section Exercises dialog; merge over legacy exercises when opening the editor. */
export function createDefaultExercise(): Exercise {
  return {
    id: '',
    name: '',
    category: '',
    description: '',
    equipment: [],
    difficulty: 'Beginner',
    muscleGroups: [],
    typology: '',
    sportsIndicated: [],
    equipmentType: '',
    usualSportMachineIds: [],
    relatedExerciseIds: [],
    nameByLanguage: {},
    descriptionByLanguage: {},
    exerciseCode: '',
    contraindicatedPathologiesNote: '',
    contraindicatedPathologiesInfoByLanguage: {},
    contraindicatedPathologyIds: [],
    executionByLanguage: {},
    expertSuggestionsByLanguage: {},
    breathingByLanguage: {},
    mistakesByLanguage: {},
    exerciseFaqs: [],
    muscleAreaPercentTags: [{ area: '', percent: 0, isMain: true }],
    mainMuscleGroup: '',
    secondaryMuscleGroups: [],
    levels: [1],
    sharedBy: 'MY_LIBRARY',
    sharedByUsername: '',
    pictureAMale: '',
    pictureAFemale: '',
    pictureBMale: '',
    pictureBFemale: '',
    officialVideoUrl: '',
    officialVideoDataUrl: '',
    officialVideoUrlFemale: '',
    officialVideoDataUrlFemale: '',
    referenceUrl1: '',
    referenceUrl2: '',
    enabled: true,
  };
}

/**
 * Official video: URL field wins over inline `data:` (legacy rows may have both after a URL change).
 */
export function resolveOfficialVideoFromUrlAndData(
  url: string | null | undefined,
  dataUrl: string | null | undefined
): string {
  const u = (url || '').trim();
  const d = (dataUrl || '').trim();
  if (u) return u;
  return d;
}

/** Resolved official video src for Male vs Female (female falls back to male only when female has no source). */
export function resolveExerciseOfficialVideoSrc(ex: Exercise, sex: 'male' | 'female'): string {
  const male = resolveOfficialVideoFromUrlAndData(ex.officialVideoUrl, ex.officialVideoDataUrl);
  const femaleOnly = resolveOfficialVideoFromUrlAndData(
    ex.officialVideoUrlFemale,
    ex.officialVideoDataUrlFemale
  );
  if (sex === 'male') return male;
  return femaleOnly || male;
}

/** Extract YouTube video id from common share / watch URLs. */
export function extractYouTubeVideoId(url: string): string | null {
  const u = (url || '').trim();
  if (!u) return null;

  let m = u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (m?.[1]) return m[1];

  m = u.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
  if (m?.[1]) return m[1];

  m = u.match(/youtube\.com\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/i);
  if (m?.[1]) return m[1];

  return null;
}

function extractVimeoVideoId(url: string): string | null {
  const m = (url || '').trim().match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m?.[1] ?? null;
}

/** YouTube, Vimeo, or direct video URL → iframe or native video for inline preview. */
export function resolveExerciseVideoEmbed(
  url: string | null | undefined
): { kind: 'iframe' | 'video'; src: string } | null {
  const u = (url || '').trim();
  if (!u) return null;

  const ytId = extractYouTubeVideoId(u);
  if (ytId) {
    return {
      kind: 'iframe',
      src: `https://www.youtube-nocookie.com/embed/${ytId}?rel=0`,
    };
  }

  const vimeoId = extractVimeoVideoId(u);
  if (vimeoId) {
    return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeoId}` };
  }

  if (u.startsWith('data:video/') || u.startsWith('data:application/')) {
    return { kind: 'video', src: u };
  }

  if (/^https?:\/\//i.test(u)) {
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(u)) {
      return { kind: 'video', src: u };
    }
    return { kind: 'video', src: u };
  }

  if (u.startsWith('data:')) {
    return { kind: 'video', src: u };
  }

  return null;
}

export function exerciseHasAnyOfficialVideo(ex: Exercise): boolean {
  const male = resolveOfficialVideoFromUrlAndData(ex.officialVideoUrl, ex.officialVideoDataUrl);
  const femaleOnly = resolveOfficialVideoFromUrlAndData(
    ex.officialVideoUrlFemale,
    ex.officialVideoDataUrlFemale
  );
  return !!(male || femaleOnly);
}

/** Drop orphaned inline video when a URL is set (form clears on edit; fixes legacy DB rows). */
export function normalizeOfficialVideoFieldsForStorage(ex: Exercise): Exercise {
  const next = { ...ex };
  if ((next.officialVideoUrl || '').trim() && (next.officialVideoDataUrl || '').trim()) {
    next.officialVideoDataUrl = '';
  }
  if (
    (next.officialVideoUrlFemale || '').trim() &&
    (next.officialVideoDataUrlFemale || '').trim()
  ) {
    next.officialVideoDataUrlFemale = '';
  }
  return next;
}

/** Sync legacy `category` / `muscleGroups` / `equipment` into extended fields when opening the form. */
export function mergeExerciseWithDefaults(partial: Partial<Exercise>): Exercise {
  const base = createDefaultExercise();
  const merged: Exercise = {
    ...base,
    ...partial,
    id: partial.id ?? '',
    nameByLanguage: { ...base.nameByLanguage, ...partial.nameByLanguage },
    descriptionByLanguage: { ...base.descriptionByLanguage, ...partial.descriptionByLanguage },
    executionByLanguage: { ...base.executionByLanguage, ...partial.executionByLanguage },
    expertSuggestionsByLanguage: {
      ...base.expertSuggestionsByLanguage,
      ...partial.expertSuggestionsByLanguage,
    },
    breathingByLanguage: { ...base.breathingByLanguage, ...partial.breathingByLanguage },
    mistakesByLanguage: { ...base.mistakesByLanguage, ...partial.mistakesByLanguage },
    contraindicatedPathologiesInfoByLanguage: {
      ...base.contraindicatedPathologiesInfoByLanguage,
      ...partial.contraindicatedPathologiesInfoByLanguage,
    },
    exerciseFaqs: normalizeExerciseFaqs(partial.exerciseFaqs ?? base.exerciseFaqs),
    muscleAreaPercentTags:
      partial.muscleAreaPercentTags && partial.muscleAreaPercentTags.length > 0
        ? normalizeMuscleAreaPercentTags(partial.muscleAreaPercentTags)
        : base.muscleAreaPercentTags,
    usualSportMachineIds: Array.isArray(partial.usualSportMachineIds)
      ? [...partial.usualSportMachineIds]
      : base.usualSportMachineIds,
    relatedExerciseIds: Array.isArray(partial.relatedExerciseIds)
      ? [...partial.relatedExerciseIds]
      : base.relatedExerciseIds,
    contraindicatedPathologyIds: Array.isArray(partial.contraindicatedPathologyIds)
      ? [...partial.contraindicatedPathologyIds]
      : base.contraindicatedPathologyIds,
  };
  const execVals = merged.executionByLanguage || {};
  const hasAnyExecution = Object.values(execVals).some((v) => String(v || '').trim() !== '');
  if (!hasAnyExecution && (merged.description || '').trim()) {
    merged.executionByLanguage = { ...execVals, en: merged.description.trim() };
  }
  const descVals = merged.descriptionByLanguage || {};
  const hasAnyShortDesc = Object.values(descVals).some((v) => String(v || '').trim() !== '');
  if (!hasAnyShortDesc && (merged.description || '').trim()) {
    merged.descriptionByLanguage = { ...descVals, en: merged.description.trim() };
  } else if ((descVals.en || '').trim()) {
    merged.description = descVals.en.trim();
  }
  const pathInfoVals = merged.contraindicatedPathologiesInfoByLanguage || {};
  const hasAnyPathInfo = Object.values(pathInfoVals).some((v) => String(v || '').trim() !== '');
  if (!hasAnyPathInfo && (merged.contraindicatedPathologiesNote ?? '').trim()) {
    const legacy = (merged.contraindicatedPathologiesNote ?? '').trim();
    merged.contraindicatedPathologiesInfoByLanguage = { ...pathInfoVals, en: legacy };
  } else if ((pathInfoVals.en || '').trim()) {
    merged.contraindicatedPathologiesNote = pathInfoVals.en.trim();
  }
  if (!merged.typology && merged.category) {
    const c = merged.category;
    const allowed: ExerciseTypology[] = [
      'Strength',
      'Aerobic',
      'Stretching',
      'Gymnic',
      'Pilates',
      'Calistenic',
      'Spartan',
      'Crossfit',
      'Technical moves for sports',
    ];
    merged.typology = (allowed.includes(c as ExerciseTypology) ? c : '') as ExerciseTypology | '';
  }
  if (!merged.equipmentType && merged.equipment?.length === 1) merged.equipmentType = merged.equipment[0];
  if (!merged.mainMuscleGroup && merged.muscleGroups?.length) merged.mainMuscleGroup = merged.muscleGroups[0];
  if (!merged.secondaryMuscleGroups?.length && merged.muscleGroups && merged.muscleGroups.length > 1) {
    merged.secondaryMuscleGroups = merged.muscleGroups.slice(1);
  }
  if (!merged.muscleAreaPercentTags?.some((t) => (t.area || '').trim()) && merged.mainMuscleGroup) {
    const main = merged.mainMuscleGroup;
    const secs = (merged.secondaryMuscleGroups || []).filter((s) => s && s !== main);
    if (secs.length === 0) {
      merged.muscleAreaPercentTags = [{ area: main, percent: 100, isMain: true }];
    } else {
      const n = 1 + secs.length;
      const base = Math.floor(100 / n);
      let rem = 100 - base * n;
      const arr: MuscleAreaPercentTag[] = [
        { area: main, percent: base + (rem > 0 ? 1 : 0), isMain: true },
      ];
      if (rem > 0) rem -= 1;
      for (const s of secs) {
        const extra = rem > 0 ? 1 : 0;
        if (rem > 0) rem -= 1;
        arr.push({ area: s, percent: base + extra, isMain: false });
      }
      merged.muscleAreaPercentTags = arr;
    }
  }
  if (merged.enabled === undefined) merged.enabled = true;
  merged.sportsIndicated = normalizeSportsIndicatedToLibraryKeys(merged.sportsIndicated);
  return normalizeOfficialVideoFieldsForStorage(merged);
}

/** Ensure exactly one `isMain` row; keep areas and percents as entered. */
export function normalizeMuscleAreaPercentTags(tags: MuscleAreaPercentTag[]): MuscleAreaPercentTag[] {
  if (!tags?.length) return [{ area: '', percent: 0, isMain: true }];
  const mi = tags.findIndex((t) => t.isMain);
  const idx = mi >= 0 ? mi : 0;
  return tags.map((t, i) => ({
    area: typeof t.area === 'string' ? t.area : '',
    percent: Number.isFinite(Number(t.percent)) ? Number(t.percent) : 0,
    isMain: i === idx,
  }));
}

export function muscleInvolvementPercentTotal(tags: MuscleAreaPercentTag[] | undefined | null): number {
  if (!tags?.length) return 0;
  return tags.reduce((sum, t) => sum + Math.max(0, Math.round(Number(t.percent) || 0)), 0);
}

/** Fill legacy `category`, `muscleGroups`, `equipment`, and `difficulty` from extended Section Exercises fields before save. */
export function finalizeExerciseForStorage(e: Exercise): Exercise {
  const typ = (e.typology || e.category || '').trim();
  const tagRows = normalizeMuscleAreaPercentTags(e.muscleAreaPercentTags || []);
  const withArea = tagRows.filter((t) => (t.area || '').trim() !== '');

  let main = (e.mainMuscleGroup || '').trim();
  let sec = (e.secondaryMuscleGroups || []).filter((m) => m && m.trim() && m.trim() !== main);
  let muscleGroups = main ? [main, ...sec] : e.muscleGroups?.length ? [...e.muscleGroups] : [];

  if (withArea.length > 0) {
    const mainT = withArea.find((t) => t.isMain) ?? withArea[0];
    main = mainT.area.trim();
    sec = withArea
      .filter((t) => t.area.trim() !== main)
      .sort((a, b) => b.percent - a.percent)
      .map((t) => t.area.trim());
    muscleGroups = [main, ...sec];
  }
  const equipment = (e.equipmentType || '').trim() ? [(e.equipmentType || '').trim()] : [...e.equipment];
  const lvRaw = (e.levels || []).filter((n) => n >= 1 && n <= 5);
  const lv = lvRaw.length ? lvRaw : [1];
  const maxLv = Math.max(...lv);
  const difficulty: Exercise['difficulty'] =
    maxLv <= 2 ? 'Beginner' : maxLv === 3 ? 'Intermediate' : 'Advanced';
  const enHow = (e.executionByLanguage?.en || '').trim();
  const descByLang = { ...(e.descriptionByLanguage || {}) };
  const enShort = (descByLang.en || e.description || '').trim();
  if (enShort) descByLang.en = enShort;
  const description = enShort || (enHow ? enHow.slice(0, 500) : '');

  const exerciseFaqs = normalizeExerciseFaqs(e.exerciseFaqs).filter(exerciseFaqEntryHasContent);

  const usualSportMachineIds = Array.from(
    new Set((e.usualSportMachineIds || []).map((x) => String(x).trim()).filter(Boolean))
  );

  const selfId = (e.id || '').trim();
  const relatedExerciseIds = Array.from(
    new Set((e.relatedExerciseIds || []).map((x) => String(x).trim()).filter(Boolean))
  ).filter((id) => id !== selfId);

  const contraindicatedPathologyIds = Array.from(
    new Set((e.contraindicatedPathologyIds || []).map((x) => String(x).trim()).filter(Boolean))
  );

  const pathInfoByLang = { ...(e.contraindicatedPathologiesInfoByLanguage || {}) };
  const enPathInfo = (pathInfoByLang.en || e.contraindicatedPathologiesNote || '').trim();
  if (enPathInfo) pathInfoByLang.en = enPathInfo;
  const contraindicatedPathologiesNote = enPathInfo;

  const sportsIndicated = sanitizeSportsIndicatedForLibrary(e.sportsIndicated);
  const withVideos = normalizeOfficialVideoFieldsForStorage(e);

  return {
    ...withVideos,
    sportsIndicated,
    category: typ || e.category,
    muscleGroups,
    mainMuscleGroup: main,
    secondaryMuscleGroups: sec,
    equipment,
    difficulty,
    levels: lv,
    description,
    descriptionByLanguage: descByLang,
    exerciseFaqs,
    usualSportMachineIds,
    relatedExerciseIds,
    contraindicatedPathologyIds,
    contraindicatedPathologiesNote,
    contraindicatedPathologiesInfoByLanguage: pathInfoByLang,
  };
}

export interface Device {
  id: string;
  name: string;
  brand: string;
  model: string;
  codekey: string; // Unique code identifier for protocol mapping (e.g., GARM-FR945)
  type: 'Watch' | 'Tracker' | 'Monitor' | 'Scale' | 'Sensor' | 'Other';
  compatibility: string[];
  isEnabled: boolean;
  syncProtocol: string;
  description: string;
  isUserCreated?: boolean; // Distinguish user-created from admin defaults
}

/**
 * Supported languages for tools settings
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'ja', name: '日本語' },
  { code: 'id', name: 'Indonesia' },
  { code: 'zh', name: '中文' },
  { code: 'ar', name: 'العربية' },
];

/** Super Admin Period Settings: English first (default on-screen reference language). */
export function supportedLanguagesPeriodAdminOrder() {
  const en = SUPPORTED_LANGUAGES.find((l) => l.code === 'en');
  const rest = SUPPORTED_LANGUAGES.filter((l) => l.code !== 'en');
  return en ? [en, ...rest] : [...SUPPORTED_LANGUAGES];
}

/**
 * Default workout periods
 */
export const DEFAULT_PERIODS: Period[] = [
  { id: '1', title: 'Preparation Phase', description: 'Building base fitness', color: '#3b82f6', order: 0 },
  { id: '2', title: 'Competition Phase', description: 'Peak performance period', color: '#ef4444', order: 1 },
  { id: '3', title: 'Recovery Phase', description: 'Active recovery and rest', color: '#10b981', order: 2 },
];

/**
 * Default execution techniques (formerly body building techniques)
 */
export const DEFAULT_EXECUTION_TECHNIQUES: ExecutionTechnique[] = [
  { id: '1', title: 'Drop Set', description: 'Reduce weight and continue reps', color: '#f59e0b', sports: ['BODY_BUILDING'], order: 0 },
  { id: '2', title: 'Super Set', description: 'Two exercises back-to-back', color: '#ef4444', sports: ['BODY_BUILDING'], order: 1 },
  { id: '3', title: 'Rest-Pause', description: 'Short breaks within a set', color: '#8b5cf6', sports: ['BODY_BUILDING'], order: 2 },
  { id: '4', title: 'Pyramid', description: 'Progressive weight increase/decrease', color: '#06b6d4', sports: ['BODY_BUILDING'], order: 3 },
  { id: '5', title: 'Tempo', description: 'Controlled movement speed', color: '#10b981', sports: ['BODY_BUILDING'], order: 4 },
];

// Backward compatibility alias
export const DEFAULT_BODYBUILDING_TECHNIQUES = DEFAULT_EXECUTION_TECHNIQUES;

/**
 * Default workout sections
 */
export const DEFAULT_SECTIONS: WorkoutSection[] = [
  { id: '1', title: 'Warm-up', description: 'Preparation exercises', color: '#f59e0b', order: 0 },
  { id: '2', title: 'Main Set', description: 'Primary workout', color: '#3b82f6', order: 1 },
  { id: '3', title: 'Cool-down', description: 'Recovery exercises', color: '#10b981', order: 2 },
];

/**
 * Default sports list
 */
export const DEFAULT_SPORTS: Sport[] = [
  { id: '1', name: 'Swimming', icon: '/icons/swimming.png', order: 0, isTop5: true },
  { id: '2', name: 'Running', icon: '/icons/running.png', order: 1, isTop5: true },
  { id: '3', name: 'Cycling', icon: '/icons/cycling.png', order: 2, isTop5: true },
  { id: '4', name: 'Weights', icon: '/icons/weights.png', order: 3, isTop5: true },
  { id: '5', name: 'Soccer', icon: '/icons/soccer.png', order: 4, isTop5: true },
  { id: '6', name: 'Basketball', icon: '/icons/basketball.png', order: 5, isTop5: false },
  { id: '7', name: 'Tennis', icon: '/icons/tennis.png', order: 6, isTop5: false },
  { id: '8', name: 'Volleyball', icon: '/icons/volley.png', order: 7, isTop5: false },
  { id: '9', name: 'Boxing', icon: '/icons/boxe.png', order: 8, isTop5: false },
  { id: '10', name: 'Martial Arts', icon: '/icons/martial arts.png', order: 9, isTop5: false },
  { id: '11', name: 'Rowing', icon: '/icons/rowing.png', order: 10, isTop5: false },
  { id: '12', name: 'Yoga', icon: '/icons/yoga.png', order: 11, isTop5: false },
  { id: '13', name: 'Gymnastics', icon: '/icons/gymnastic.png', order: 12, isTop5: false },
  { id: '14', name: 'Skiing', icon: '/icons/ski.png', order: 13, isTop5: false },
  { id: '15', name: 'Surfing', icon: '/icons/surf.png', order: 14, isTop5: false },
  { id: '16', name: 'Golf', icon: '/icons/golf.png', order: 15, isTop5: false },
  { id: '17', name: 'Baseball', icon: '/icons/baseball.png', order: 16, isTop5: false },
  { id: '18', name: 'Ice Hockey', icon: '/icons/hockey.png', order: 17, isTop5: false },
  { id: '19', name: 'Rugby', icon: '/icons/rugby.png', order: 18, isTop5: false },
  { id: '20', name: 'Mountain Climbing', icon: '/icons/mountain climbing.png', order: 19, isTop5: false },
  { id: '21', name: 'American Football', icon: '/icons/american football.png', order: 20, isTop5: false },
  { id: '22', name: 'Archery', icon: '/icons/arch.png', order: 21, isTop5: false },
  { id: '23', name: 'Artistic Gymnastics', icon: '/icons/artistic gymnastics.png', order: 22, isTop5: false },
  { id: '24', name: 'Athletics', icon: '/icons/athletic.png', order: 23, isTop5: false },
  { id: '25', name: 'Badminton', icon: '/icons/badminton.png', order: 24, isTop5: false },
  { id: '26', name: 'Billiards', icon: '/icons/billiards.png', order: 25, isTop5: false },
  { id: '27', name: 'Boating', icon: '/icons/boating.png', order: 26, isTop5: false },
  { id: '28', name: 'Bowling', icon: '/icons/bowling.png', order: 27, isTop5: false },
  { id: '29', name: 'Calisthenics', icon: '/icons/calistenic.png', order: 28, isTop5: false },
  { id: '30', name: 'Canoe', icon: '/icons/canoe.png', order: 29, isTop5: false },
  { id: '31', name: 'Cycling Tourism', icon: '/icons/cicloturism.png', order: 30, isTop5: false },
  { id: '32', name: 'Classic Dance', icon: '/icons/classic dance.png', order: 31, isTop5: false },
  { id: '33', name: 'Cricket', icon: '/icons/cricket.png', order: 32, isTop5: false },
  { id: '34', name: 'Cross-Country Skiing', icon: '/icons/cross-country skiing.png', order: 33, isTop5: false },
  { id: '35', name: 'CrossFit', icon: '/icons/crossfit.png', order: 34, isTop5: false },
  { id: '36', name: 'Cyclocross', icon: '/icons/cyclocross.png', order: 35, isTop5: false },
  { id: '37', name: 'Dance', icon: '/icons/dance.png', order: 36, isTop5: false },
  { id: '38', name: 'Dips', icon: '/icons/dips.png', order: 37, isTop5: false },
  { id: '39', name: 'Diving', icon: '/icons/diving.png', order: 38, isTop5: false },
  { id: '40', name: 'Downhill Skiing', icon: '/icons/downhill skiing.png', order: 39, isTop5: false },
  { id: '41', name: 'Fencing', icon: '/icons/fancing.png', order: 40, isTop5: false },
  { id: '42', name: 'Field Hockey', icon: '/icons/field hockey.png', order: 41, isTop5: false },
  { id: '43', name: 'Fishing', icon: '/icons/fishing.png', order: 42, isTop5: false },
  { id: '44', name: 'Freestyle Wrestling', icon: '/icons/freestyle wrestling.png', order: 43, isTop5: false },
  { id: '45', name: 'Handball', icon: '/icons/handball.png', order: 44, isTop5: false },
  { id: '46', name: 'Hang Gliding', icon: '/icons/hang gliding.png', order: 45, isTop5: false },
  { id: '47', name: 'Hiking', icon: '/icons/hiking.png', order: 46, isTop5: false },
  { id: '48', name: 'Horse Racing', icon: '/icons/horse racing.png', order: 47, isTop5: false },
  { id: '49', name: 'Ice Skating', icon: '/icons/ice skating.png', order: 48, isTop5: false },
  { id: '50', name: 'Jumps', icon: '/icons/jumps.png', order: 49, isTop5: false },
  { id: '51', name: 'Kayak', icon: '/icons/kayak.png', order: 50, isTop5: false },
  { id: '52', name: 'Kickboxing', icon: '/icons/kick boxing.png', order: 51, isTop5: false },
  { id: '53', name: 'Lifting', icon: '/icons/lifting.png', order: 52, isTop5: false },
  { id: '54', name: 'Modern Dance', icon: '/icons/modern_dance.png', order: 53, isTop5: false },
  { id: '55', name: 'Motoring', icon: '/icons/Motoring.png', order: 54, isTop5: false },
  { id: '56', name: 'Mountain Bike', icon: '/icons/mountain bike.png', order: 55, isTop5: false },
  { id: '57', name: 'MTB', icon: '/icons/MTB.png', order: 56, isTop5: false },
  { id: '58', name: 'Pilates', icon: '/icons/pilaters.png', order: 57, isTop5: false },
  { id: '59', name: 'Ping Pong', icon: '/icons/ping pong.png', order: 58, isTop5: false },
  { id: '60', name: 'Polo', icon: '/icons/polo.png', order: 59, isTop5: false },
  { id: '61', name: 'Powerlifting', icon: '/icons/power_lifting.png', order: 60, isTop5: false },
  { id: '62', name: 'Racquetball', icon: '/icons/raquetball.png', order: 61, isTop5: false },
  { id: '63', name: 'Rhythmic Gymnastics', icon: '/icons/rhythmic gymnastics.png', order: 62, isTop5: false },
  { id: '64', name: 'Sailing', icon: '/icons/sailing.png', order: 63, isTop5: false },
  { id: '65', name: 'Shot Put', icon: '/icons/shot.png', order: 64, isTop5: false },
  { id: '66', name: 'Skateboard', icon: '/icons/skateboard.png', order: 65, isTop5: false },
  { id: '67', name: 'Skating', icon: '/icons/skating.png', order: 66, isTop5: false },
  { id: '68', name: 'Ski Jump', icon: '/icons/ski jump.png', order: 67, isTop5: false },
  { id: '69', name: 'Ski Slalom', icon: '/icons/ski slalom.png', order: 68, isTop5: false },
  { id: '70', name: 'Snorkeling', icon: '/icons/snorkeling.png', order: 69, isTop5: false },
  { id: '71', name: 'Snowboard', icon: '/icons/snowboard.png', order: 70, isTop5: false },
  { id: '72', name: 'Spartan Race', icon: '/icons/spartan.png', order: 71, isTop5: false },
  { id: '73', name: 'Spinning', icon: '/icons/spining.png', order: 72, isTop5: false },
  { id: '74', name: 'Stretching', icon: '/icons/stretching.png', order: 73, isTop5: false },
  { id: '75', name: 'Tango', icon: '/icons/tango.png', order: 74, isTop5: false },
  { id: '76', name: 'Technical Training', icon: '/icons/technical.png', order: 75, isTop5: false },
  { id: '77', name: 'Throws', icon: '/icons/throwes.png', order: 76, isTop5: false },
  { id: '78', name: 'Trekking', icon: '/icons/trekking.png', order: 77, isTop5: false },
  { id: '79', name: 'Triathlon', icon: '/icons/triathlon.png', order: 78, isTop5: false },
  { id: '80', name: 'Walking', icon: '/icons/walking.png', order: 79, isTop5: false },
  { id: '81', name: 'Water Polo', icon: '/icons/water polo.png', order: 80, isTop5: false },
  { id: '82', name: 'Water Ski', icon: '/icons/waterl ski.png', order: 81, isTop5: false },
  { id: '83', name: 'Windsurf', icon: '/icons/windsurf.png', order: 82, isTop5: false },
];

/**
 * Default equipment list
 */
export const DEFAULT_EQUIPMENT: Equipment[] = [
  { id: '1', name: 'Treadmill', category: 'Cardio', sports: ['RUN'], description: 'Running machine', inStock: true },
  { id: '2', name: 'Dumbbells', category: 'Strength', sports: ['BODY_BUILDING'], description: 'Free weights', inStock: true },
  { id: '3', name: 'Yoga Mat', category: 'Flexibility', sports: ['YOGA', 'PILATES', 'STRETCHING'], description: 'Exercise mat', inStock: true },
  { id: '4', name: 'Resistance Bands', category: 'Strength', sports: ['BODY_BUILDING', 'STRETCHING'], description: 'Elastic bands', inStock: true },
  { id: '5', name: 'Pull-up Bar', category: 'Strength', sports: ['BODY_BUILDING', 'GYMNASTIC'], description: 'Upper body equipment', inStock: true },
];

/**
 * Default exercises list
 */
export const DEFAULT_EXERCISES: Exercise[] = [
  {
    id: '1',
    name: 'Push-ups',
    category: 'Strength',
    description: 'Upper body exercise',
    equipment: [],
    difficulty: 'Beginner',
    muscleGroups: ['Chest', 'Triceps', 'Shoulders'],
  },
  {
    id: '2',
    name: 'Squats',
    category: 'Strength',
    description: 'Lower body exercise',
    equipment: [],
    difficulty: 'Beginner',
    muscleGroups: ['Quadriceps', 'Glutes', 'Hamstrings'],
  },
  {
    id: '3',
    name: 'Plank',
    category: 'Core',
    description: 'Core stability exercise',
    equipment: [],
    difficulty: 'Beginner',
    muscleGroups: ['Abs', 'Core'],
  },
];

/**
 * Default devices list
 */
export const DEFAULT_DEVICES: Device[] = [
  {
    id: '1',
    name: 'Garmin Forerunner',
    brand: 'Garmin',
    model: 'Forerunner 945',
    codekey: 'GARM-FR945',
    type: 'Watch',
    compatibility: ['iOS', 'Android'],
    isEnabled: true,
    syncProtocol: 'Bluetooth',
    description: 'GPS running watch',
  },
  {
    id: '2',
    name: 'Apple Watch',
    brand: 'Apple',
    model: 'Series 8',
    codekey: 'APPL-WS8',
    type: 'Watch',
    compatibility: ['iOS'],
    isEnabled: true,
    syncProtocol: 'Bluetooth',
    description: 'Smart watch with fitness tracking',
  },
  {
    id: '3',
    name: 'Fitbit Charge',
    brand: 'Fitbit',
    model: 'Charge 5',
    codekey: 'FITB-CH5',
    type: 'Tracker',
    compatibility: ['iOS', 'Android'],
    isEnabled: true,
    syncProtocol: 'Bluetooth',
    description: 'Fitness tracker',
  },
];

/**
 * LocalStorage keys for tools settings
 */
export const STORAGE_KEYS = {
  PERIODS: 'workoutPeriods',
  SECTIONS: 'workoutSections',
  /** Separate from workout sections — Common daily actions tab only */
  COMMON_DAILY_ACTIONS: 'commonDailyActions',
  /** Work methods (same shape as sections; toolsSettings JSON) */
  WORK_METHODS: 'workMethods',
  SPORTS: 'mainSports',
  EQUIPMENT: 'equipment',
  EXERCISES: 'exercises',
  /** Exercise contraindication tags catalog (Technical Settings → Pathologies) */
  EXERCISE_PATHOLOGY_CATALOG: 'exercisePathologyCatalog',
  DEVICES: 'compatibleDevices',
  EXECUTION_TECHNIQUES: 'executionTechniques',
  BODYBUILDING_TECHNIQUES: 'executionTechniques', // Backward compatibility alias
} as const;

/**
 * Helper: Filter items by search query
 */
export function filterBySearch<T extends { name?: string; title?: string }>(
  items: T[],
  searchQuery: string
): T[] {
  if (!searchQuery.trim()) return items;
  
  const searchLower = searchQuery.toLowerCase();
  return items.filter(item => {
    const name = item.name || item.title || '';
    return name.toLowerCase().includes(searchLower);
  });
}

/**
 * Helper: Filter by category
 */
export function filterByCategory<T extends { category?: string }>(
  items: T[],
  categoryFilter: string
): T[] {
  if (categoryFilter === 'all') return items;
  
  return items.filter(item => item.category === categoryFilter);
}

/**
 * Helper: Sort items by order property
 */
export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/**
 * Helper: Reorder items after drag and drop
 */
export function reorderItems<T extends { id: string; order: number }>(
  items: T[],
  draggedId: string,
  targetId: string
): T[] {
  const draggedIndex = items.findIndex(item => item.id === draggedId);
  const targetIndex = items.findIndex(item => item.id === targetId);
  
  if (draggedIndex === -1 || targetIndex === -1) return items;
  
  const reordered = [...items];
  const [draggedItem] = reordered.splice(draggedIndex, 1);
  reordered.splice(targetIndex, 0, draggedItem);
  
  // Update order numbers
  return reordered.map((item, index) => ({
    ...item,
    order: index
  }));
}

