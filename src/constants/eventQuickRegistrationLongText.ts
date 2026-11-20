import { fetchTranslationValues } from './infoRepsLongText';
import { normalizeToolsLanguage } from '@/utils/toolsProfileLanguage';

/** Language → Long texts key shown at the top of the event subscription form ({club} = club / team name). */
export const EVENT_QUICK_REGISTRATION_KEY = 'Event_quick_registration' as const;

export const EVENT_QUICK_REGISTRATION_EN =
  'Submit the quick registration (feature available only to existing members of {club}). Enter your fiscal code';

export const EVENT_QUICK_REGISTRATION_IT =
  "Invia l'iscrizione rapida (funzione disponibile solo per i soci già iscritti a {club}). Inserisci il tuo codice fiscale";

let valuesPromise: Promise<Record<string, string> | null> | null = null;

export async function fetchEventQuickRegistrationText(language: string): Promise<string> {
  const lang = normalizeToolsLanguage(language);
  valuesPromise ??= fetchTranslationValues(EVENT_QUICK_REGISTRATION_KEY).catch(() => null);
  const values = await valuesPromise;
  const localized = values?.[lang]?.trim();
  if (localized) return localized;
  if (lang === 'it') return EVENT_QUICK_REGISTRATION_IT;
  return values?.en?.trim() || EVENT_QUICK_REGISTRATION_EN;
}
