import { normalizeToolsLanguage } from '@/utils/toolsProfileLanguage';

/** Info line next to Last name (operator / club admin). */
export const MEMBER_RENAME_INFO_KEY = 'Member_rename_quota_info' as const;

export const MEMBER_RENAME_INFO_EN =
  'rename is allowed for the 10% of total enabled slots';

export const MEMBER_RENAME_INFO_IT =
  'la rinomina è consentita per il 10% dei posti totali abilitati';

export function getMemberRenameInfoLabel(language: string): string {
  return normalizeToolsLanguage(language) === 'it'
    ? MEMBER_RENAME_INFO_IT
    : MEMBER_RENAME_INFO_EN;
}

export function getMemberRenameResidualLabel(
  language: string,
  residual: number | null,
  unlimited: boolean,
): string {
  const lang = normalizeToolsLanguage(language);
  if (unlimited || residual == null) {
    return lang === 'it'
      ? 'Rinomine residuali disponibili Illimitate'
      : 'Residual available renamings Unlimited';
  }
  return lang === 'it'
    ? `Rinomine residuali disponibili ${residual}`
    : `Residual available renamings ${residual}`;
}
