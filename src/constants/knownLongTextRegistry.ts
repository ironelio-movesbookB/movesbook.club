import type { TranslationCategory, TranslationKey } from './language.constants';
import {
  AUTO_PROCESS_INFO_DEFAULT_EN,
  AUTO_PROCESS_INFO_TRANSLATION_KEY,
} from './autoProcessInfoLongText';
import {
  INFO_REPS_ARTICLE_EN,
  INFO_REPS_ARTICLE_IT,
  INFO_REPS_TRANSLATION_KEY,
} from './infoRepsLongText';
import {
  IDENTIFICATION_DEVICES_INFO_DEFAULT_EN,
  IDENTIFICATION_DEVICES_INFO_TRANSLATION_KEY,
} from './identificationDevicesInfoLongText';
import {
  SUGGEST_MOVESBOOK_INTRO_EN,
  SUGGEST_MOVESBOOK_INTRO_IT,
  SUGGEST_MOVESBOOK_INTRO_KEY,
} from './suggestMovesbookLongText';

export type KnownLongTextEntry = {
  key: string;
  category: TranslationCategory;
  descriptionEn: string;
  values: Record<string, string>;
};

/** App-linked long texts that must always appear under Language → Long texts. */
export const KNOWN_LONG_TEXT_ENTRIES: KnownLongTextEntry[] = [
  {
    key: AUTO_PROCESS_INFO_TRANSLATION_KEY,
    category: 'social',
    descriptionEn:
      'Plan Gym Week — “Automatic processing procedure” dialog body and yellow confirmation box (last paragraph).',
    values: { en: AUTO_PROCESS_INFO_DEFAULT_EN },
  },
  {
    key: INFO_REPS_TRANSLATION_KEY,
    category: 'social',
    descriptionEn: 'Info Reps modal — full article about repetitions and %1RM.',
    values: { en: INFO_REPS_ARTICLE_EN, it: INFO_REPS_ARTICLE_IT },
  },
  {
    key: IDENTIFICATION_DEVICES_INFO_TRANSLATION_KEY,
    category: 'management',
    descriptionEn: 'Club access settings — identification devices help panel.',
    values: { en: IDENTIFICATION_DEVICES_INFO_DEFAULT_EN },
  },
  {
    key: SUGGEST_MOVESBOOK_INTRO_KEY,
    category: 'social',
    descriptionEn:
      'Suggest Movesbook — intro explaining advantages of inviting friends (login prompt + Suggest Movesbook page).',
    values: { en: SUGGEST_MOVESBOOK_INTRO_EN, it: SUGGEST_MOVESBOOK_INTRO_IT },
  },
];

export const KNOWN_LONG_TEXT_KEY_SET = new Set(
  KNOWN_LONG_TEXT_ENTRIES.map((e) => e.key),
);

/** Merge DB/i18n keys with built-in long-text defaults (DB wins on conflict). */
export function mergeKnownLongTexts(keys: TranslationKey[]): TranslationKey[] {
  const byKey = new Map(keys.map((k) => [k.key, k]));

  for (const known of KNOWN_LONG_TEXT_ENTRIES) {
    const existing = byKey.get(known.key);
    if (existing) {
      byKey.set(known.key, {
        ...existing,
        category: (existing.category || known.category) as TranslationCategory,
        descriptionEn: existing.descriptionEn || known.descriptionEn,
        values: { ...known.values, ...existing.values },
        isLongText: true,
      });
    } else {
      byKey.set(known.key, {
        key: known.key,
        category: known.category,
        descriptionEn: known.descriptionEn,
        values: { ...known.values },
        isLongText: true,
      });
    }
  }

  return Array.from(byKey.values());
}
