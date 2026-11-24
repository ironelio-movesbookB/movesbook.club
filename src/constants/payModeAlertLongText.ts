import { fetchTranslationValues } from './infoRepsLongText';
import { normalizeToolsLanguage } from '@/utils/toolsProfileLanguage';

/** Language → Long texts key shown under every "Pay mode" dropdown. */
export const PAY_MODE_ALERT_KEY = 'Pay_mode_alert' as const;

export const PAY_MODE_ALERT_EN =
  'Payments marked in red will be processed by sending a link to the buyer; upon opening this link, the buyer can complete the payment, which will then be automatically recorded in the system. Modalities of payment marked in blue are processed externally by the member and must be verified';

export const PAY_MODE_ALERT_IT =
  "I pagamenti contrassegnati in rosso verranno elaborati inviando un link all'acquirente; aprendo questo link, l'acquirente potrà completare il pagamento, che verrà poi registrato automaticamente nel sistema. Le modalità di pagamento contrassegnate in blu vengono gestite esternamente dal membro e devono essere verificate";

let valuesPromise: Promise<Record<string, string> | null> | null = null;

export async function fetchPayModeAlertText(language: string): Promise<string> {
  const lang = normalizeToolsLanguage(language);
  valuesPromise ??= fetchTranslationValues(PAY_MODE_ALERT_KEY).catch(() => null);
  const values = await valuesPromise;
  const localized = values?.[lang]?.trim();
  if (localized) return localized;
  if (lang === 'it') return PAY_MODE_ALERT_IT;
  return values?.en?.trim() || PAY_MODE_ALERT_EN;
}
