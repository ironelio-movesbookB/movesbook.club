import { fetchLongTextTranslation, fetchTranslationValues } from './infoRepsLongText';
import { stripStoredHtml } from '@/lib/promocodes/suggestMovesbookCopy';
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
  if (!values) return stripStoredHtml(fallback);

  const normalized = normalizeToolsLanguage(language);
  const localized = values[normalized]?.trim();
  if (localized) return stripStoredHtml(localized);

  if (lang.startsWith('it')) {
    const it = values.it?.trim();
    return stripStoredHtml(it || SUGGEST_MOVESBOOK_INTRO_IT);
  }

  return stripStoredHtml(await fetchLongTextTranslation(SUGGEST_MOVESBOOK_INTRO_KEY, language, fallback));
}

export const SUGGEST_MOVESBOOK_INVITE_DEFAULT_KEY = 'SuggestMovesbookInviteDefault';

export const SUGGEST_MOVESBOOK_INVITE_DEFAULT_EN =
  'I\'m sending you this invitation to introduce you to the "Movesbook" brand, a tool I\'ve been using with great satisfaction. I invite you to sign up for free so you can see for yourself just how powerful and professional this application is, not to mention more affordable than many others.';

export const SUGGEST_MOVESBOOK_INVITE_DEFAULT_IT =
  'Questo è un messaggio di invito che ti invio per promuovere questo marchio "Movesbook", che sto utilizzando con grande soddisfazione. Ti invito a registrarti gratuitamente così potrai vedere direttamente quanto è potente e professionale questa applicazione, nonchè economica più di tante altre..';

export async function fetchSuggestMovesbookInviteDefaultText(language: string): Promise<string> {
  const lang = (language || 'en').toLowerCase();
  const fallback = lang.startsWith('it')
    ? SUGGEST_MOVESBOOK_INVITE_DEFAULT_IT
    : SUGGEST_MOVESBOOK_INVITE_DEFAULT_EN;

  const values = await fetchTranslationValues(SUGGEST_MOVESBOOK_INVITE_DEFAULT_KEY);
  if (!values) return stripStoredHtml(fallback);

  const normalized = normalizeToolsLanguage(language);
  const localized = values[normalized]?.trim();
  if (localized) return stripStoredHtml(localized);

  if (lang.startsWith('it')) {
    const it = values.it?.trim();
    return stripStoredHtml(it || SUGGEST_MOVESBOOK_INVITE_DEFAULT_IT);
  }

  return stripStoredHtml(
    await fetchLongTextTranslation(SUGGEST_MOVESBOOK_INVITE_DEFAULT_KEY, language, fallback),
  );
}
