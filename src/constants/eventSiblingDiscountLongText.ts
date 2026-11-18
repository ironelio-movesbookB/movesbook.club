import { fetchTranslationValues } from './infoRepsLongText';
import { normalizeToolsLanguage } from '@/utils/toolsProfileLanguage';

/** Language → Long texts key shown at the top of "Sibling / relative discount" (event editor). */
export const EVENT_SIBLING_DISCOUNT_INFO_KEY = 'Event_sibling_discount_info' as const;

export const EVENT_SIBLING_DISCOUNT_INFO_EN =
  'By enabling this option, the user can enter the tax code and name of a relative/sibling already registered for the event to receive a discount, which will be applied and immediately visible. The discount does not apply to additional services.';

export const EVENT_SIBLING_DISCOUNT_INFO_IT =
  "Abilitando questa opzione, l'utente può inserire il codice fiscale e il nome di un parente/fratello già iscritto all'evento per ricevere uno sconto, che verrà applicato e sarà subito visibile. Lo sconto non si applica ai servizi aggiuntivi.";

let valuesPromise: Promise<Record<string, string> | null> | null = null;

export async function fetchEventSiblingDiscountInfo(language: string): Promise<string> {
  const lang = normalizeToolsLanguage(language);
  valuesPromise ??= fetchTranslationValues(EVENT_SIBLING_DISCOUNT_INFO_KEY).catch(() => null);
  const values = await valuesPromise;
  const localized = values?.[lang]?.trim();
  if (localized) return localized;
  if (lang === 'it') return EVENT_SIBLING_DISCOUNT_INFO_IT;
  return values?.en?.trim() || EVENT_SIBLING_DISCOUNT_INFO_EN;
}
