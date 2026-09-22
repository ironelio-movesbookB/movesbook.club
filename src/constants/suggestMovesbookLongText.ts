import { fetchLongTextTranslation, fetchTranslationValues } from './infoRepsLongText';
import { normalizeToolsLanguage } from '@/utils/toolsProfileLanguage';

export const SUGGEST_MOVESBOOK_INTRO_KEY = 'SuggestMovesbookIntro';

export const SUGGEST_MOVESBOOK_INTRO_EN =
  'Invite friends to Movesbook and you both benefit. When someone registers with your promocode they get a discount on their subscription, and you earn credits each time a friend — or a friend of a friend — completes registration. Share by email, WhatsApp or Telegram. If your promocode allows it, you can also create your own promocodes to grow your network.';

export const SUGGEST_MOVESBOOK_INTRO_IT =
  'Invita amici su Movesbook e beneficiate entrambi. Quando qualcuno si registra con il tuo codice promozionale ottiene uno sconto sull\'abbonamento, e tu guadagni crediti ogni volta che un amico — o un amico di un amico — completa la registrazione. Condividi via email, WhatsApp o Telegram. Se il tuo codice promozionale lo consente, puoi anche creare i tuoi codici promozionali per far crescere la tua rete.';

export async function fetchSuggestMovesbookIntroText(language: string): Promise<string> {
  const lang = (language || 'en').toLowerCase();
  const fallback = lang.startsWith('it') ? SUGGEST_MOVESBOOK_INTRO_IT : SUGGEST_MOVESBOOK_INTRO_EN;

  const values = await fetchTranslationValues(SUGGEST_MOVESBOOK_INTRO_KEY);
  if (!values) return fallback;

  const normalized = normalizeToolsLanguage(language);
  const localized = values[normalized]?.trim();
  if (localized) return localized;

  if (lang.startsWith('it')) {
    const it = values.it?.trim();
    return it || SUGGEST_MOVESBOOK_INTRO_IT;
  }

  return fetchLongTextTranslation(SUGGEST_MOVESBOOK_INTRO_KEY, language, fallback);
}
