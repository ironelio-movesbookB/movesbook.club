import { athleteSportProfileTexts } from '@/lib/sport/athleteSportProfiles';
import { ENTITY_SPORT_OPTIONS } from '@/lib/sport/entitySportOptions';
import {
  MEMBER_PROFILE_UI_LABELS,
  SPORT_UI_LABELS,
  sportLabelKey,
  splitFieldLabel,
} from '@/lib/sport/sportI18n';
import { teamSportProfileTexts } from '@/lib/sport/teamSportProfiles';
import autoTranslateTexts from '@/lib/sport/autoTranslateTexts.json';
import autoTranslatePatterns from '@/lib/sport/autoTranslatePatterns.json';

/** `{ sport_key: 'English text' }` for every text of the sport profiles and statistics screens. */
export function sportI18nCatalog(): Record<string, string> {
  const texts = [
    ...SPORT_UI_LABELS,
    ...MEMBER_PROFILE_UI_LABELS,
    ...autoTranslateTexts,
    ...autoTranslatePatterns,
    ...ENTITY_SPORT_OPTIONS,
    ...athleteSportProfileTexts(),
    ...teamSportProfileTexts(),
  ];
  const out: Record<string, string> = {};
  for (const text of texts) {
    const { label, examples } = splitFieldLabel(text);
    for (const part of [text, label, examples]) {
      if (part && /[A-Za-z]/.test(part)) out[sportLabelKey(part)] ??= part.trim();
    }
  }
  return out;
}
