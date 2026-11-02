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
  PAYMENT_INFO_DEFAULT_EN,
  PAYMENT_INFO_DEFAULT_IT,
  PAYMENT_INFO_TRANSLATION_KEY,
} from './paymentInfoLongText';
import {
  ADD_AVAILABLE_SLOTS_FORM_EN,
  ADD_AVAILABLE_SLOTS_FORM_IT,
  ADD_AVAILABLE_SLOTS_FORM_KEY,
  ARCHIVE_LOW_SLOTS_NOTICE_EN,
  ARCHIVE_LOW_SLOTS_NOTICE_IT,
  ARCHIVE_LOW_SLOTS_NOTICE_KEY,
  MEMBER_REMOVE_SLOTS_INFO_EN,
  MEMBER_REMOVE_SLOTS_INFO_IT,
  MEMBER_REMOVE_SLOTS_INFO_KEY,
} from './memberArchiveSlotsLongText';
import {
  MEMBER_RENAME_INFO_EN,
  MEMBER_RENAME_INFO_IT,
  MEMBER_RENAME_INFO_KEY,
} from './memberRenameQuotaLongText';
import {
  SUGGEST_MOVESBOOK_INTRO_EN,
  SUGGEST_MOVESBOOK_INTRO_IT,
  SUGGEST_MOVESBOOK_INTRO_KEY,
} from './suggestMovesbookLongText';
import {
  ACTIVATION_EMAIL_BODY_EN,
  ACTIVATION_EMAIL_BODY_KEY,
  ACTIVATION_EMAIL_BUTTON_EN,
  ACTIVATION_EMAIL_BUTTON_KEY,
  ACTIVATION_EMAIL_SUBJECT_EN,
  ACTIVATION_EMAIL_SUBJECT_KEY,
  PAYMENT_SUCCESS_LONG_TEXT_EN,
  PAYMENT_SUCCESS_LONG_TEXT_KEY,
} from './activationEmailLongText';

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
    key: PAYMENT_INFO_TRANSLATION_KEY,
    category: 'management',
    descriptionEn: 'Member profile Settings — “Type of payments — method default” Info popup.',
    values: { en: PAYMENT_INFO_DEFAULT_EN, it: PAYMENT_INFO_DEFAULT_IT },
  },
  {
    key: MEMBER_REMOVE_SLOTS_INFO_KEY,
    category: 'management',
    descriptionEn:
      'Archive of Users — message when removing a member (slots are not freed; Members added is progressive).',
    values: { en: MEMBER_REMOVE_SLOTS_INFO_EN, it: MEMBER_REMOVE_SLOTS_INFO_IT },
  },
  {
    key: ARCHIVE_LOW_SLOTS_NOTICE_KEY,
    category: 'management',
    descriptionEn:
      'Archive of Members — notice when residual slots are below 10 (prompt to add new available slots).',
    values: { en: ARCHIVE_LOW_SLOTS_NOTICE_EN, it: ARCHIVE_LOW_SLOTS_NOTICE_IT },
  },
  {
    key: ADD_AVAILABLE_SLOTS_FORM_KEY,
    category: 'management',
    descriptionEn:
      'Archive of Members — “Add new available slots” modal body (purchase form placeholder).',
    values: { en: ADD_AVAILABLE_SLOTS_FORM_EN, it: ADD_AVAILABLE_SLOTS_FORM_IT },
  },
  {
    key: MEMBER_RENAME_INFO_KEY,
    category: 'management',
    descriptionEn:
      'Member profile Data for Login — info that renaming is allowed for 10% of total enabled slots.',
    values: { en: MEMBER_RENAME_INFO_EN, it: MEMBER_RENAME_INFO_IT },
  },
  {
    key: SUGGEST_MOVESBOOK_INTRO_KEY,
    category: 'social',
    descriptionEn:
      'Suggest Movesbook — intro explaining advantages of inviting friends (login prompt + Suggest Movesbook page).',
    values: { en: SUGGEST_MOVESBOOK_INTRO_EN, it: SUGGEST_MOVESBOOK_INTRO_IT },
  },
  {
    key: ACTIVATION_EMAIL_SUBJECT_KEY,
    category: 'system',
    descriptionEn: 'Registration activation email — subject line. Placeholders: none.',
    values: { en: ACTIVATION_EMAIL_SUBJECT_EN },
  },
  {
    key: ACTIVATION_EMAIL_BODY_KEY,
    category: 'system',
    descriptionEn:
      'Registration activation email — body. Placeholders: {name}, {username}, {link}.',
    values: { en: ACTIVATION_EMAIL_BODY_EN },
  },
  {
    key: ACTIVATION_EMAIL_BUTTON_KEY,
    category: 'system',
    descriptionEn: 'Registration activation email — green button label.',
    values: { en: ACTIVATION_EMAIL_BUTTON_EN },
  },
  {
    key: PAYMENT_SUCCESS_LONG_TEXT_KEY,
    category: 'system',
    descriptionEn: 'Shown on /register/success after payment or free/test registration.',
    values: { en: PAYMENT_SUCCESS_LONG_TEXT_EN },
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
