import { normalizeToolsLanguage, resolveProfileLanguageCodeForToolsLoad } from '@/utils/toolsProfileLanguage';
import { getAuthHeaders } from '@/utils/auth.utils';

/** Short footer shown after the full article (also stored in DB when only a stub exists). */
export const INFO_REPS_SUMMARY_EN =
  'Reps and % of one-rep max are linked: higher reps usually mean a lower %1RM for the same effort. ' +
  'Use the table in your Tools / language settings for the full article when available.';

export const INFO_REPS_SUMMARY_IT =
  'Ripetizioni e % del massimale (1RM) sono collegate: più ripetizioni di solito corrispondono a una %1RM più bassa per lo stesso sforzo. ' +
  "Consulta la tabella in Strumenti / impostazioni lingua per l'articolo completo quando disponibile.";

/** Full article fallback when Language → Long texts has no long `InfoReps` entry for the user locale. */
export const INFO_REPS_ARTICLE_EN =
  "It's helpful to give an example and explain the factors used to calculate the percentage of load relative to the number of repetitions and vice versa.\n\n" +
  'Example:\n' +
  'For a number of 15 repetitions in bodybuilding, the percentage of load relative to the maximum (1RM) is generally between 60% and 65%. This estimate may vary slightly depending on the formula used and the individual characteristics of the athlete (such as the prevalence of muscle fibers or training experience).\n\n' +
  'Application in Bodybuilding\n' +
  'Hypertrophy, and Resistance: A 15-rep range is often used for metabolic hypertrophy or local muscular endurance work.\n' +
  'Failure and Buffer: These percentages indicate the load that takes you to exact failure on the 15th repetition. If your goal is a "buffer" workout (e.g., 15 reps but with 2-3 left over), you\'ll need to further scale this percentage by about 5%.\n\n' +
  'For high repetitions, standard bodybuilding formulas cease to be accurate, as they are designed for strength and hypertrophy ranges (usually up to 15-20 repetitions).\n\n' +
  'Why is it difficult to define an exact %?\n\n' +
  'Formula Limitation:\n' +
  'If we were to rigidly apply the "classic" formula, we would obtain a negative or absurd result, since the formula is linear and does not account for the transition to pure endurance.\n\n' +
  'Metabolic Factor:\n' +
  "With very high repetitions, the limit is no longer the muscle's contractile strength (mechanical tension), but the body's ability to manage lactic acid and supply the muscles with oxygen (cardiovascular and metabolic efficiency).\n\n" +
  'Type of Exercise:\n' +
  'There is a huge difference between doing 50 reps of squats (extremely taxing on the nervous and respiratory systems) and 50 reps of bicep curls or calf raises.\n\n' +
  'Approximate estimates for high repetitions.\n' +
  'Generally, in athletic training, these are the benchmarks for endurance:\n\n' +
  '20-30 repetitions: approximately 50-60% of 1RM.\n\n' +
  '50+ repetitions: These are generally referred to as "endurance" loads, falling below 40%.\n\n' +
  'Very high repetitions: This involves a regimen similar to basic calisthenics or extreme endurance tests, where the load is often just body weight or a minimal load (e.g., 20-30% of 1RM).\n' +
  'In this case, you should use a weight that feels "very light" at first, as fatigue will build exponentially after the first 40-50 repetitions.\n\n' +
  'Note: The in-app estimate % ≈ 100 − (reps × 2.5) is meaningful only for about 1–40 repetitions; above 40 reps it can show 0% or negative values.';

export const INFO_REPS_ARTICLE_IT =
  'È utile fare un esempio e spiegare i fattori usati per calcolare la percentuale di carico rispetto al numero di ripetizioni e viceversa.\n\n' +
  'Esempio:\n' +
  'Per 15 ripetizioni in bodybuilding, la percentuale di carico rispetto al massimale (1RM) è generalmente tra il 60% e il 65%. Questa stima può variare leggermente in base alla formula usata e alle caratteristiche individuali dell\'atleta (prevalenza delle fibre muscolari, esperienza di allenamento, ecc.).\n\n' +
  'Applicazione nel bodybuilding\n' +
  'Ipertrofia e resistenza: un range di 15 ripetizioni è spesso usato per ipertrofia metabolica o lavoro di resistenza muscolare locale.\n' +
  'Cedimento e margine: queste percentuali indicano il carico che porta al cedimento esatto alla 15ª ripetizione. Se l\'obiettivo è un allenamento con margine (es. 15 ripetizioni ma con 2-3 ripetizioni di riserva), riduci ulteriormente questa percentuale di circa il 5%.\n\n' +
  'Per ripetizioni elevate, le formule standard del bodybuilding smettono di essere accurate, perché sono progettate per forza e ipertrofia (di solito fino a 15-20 ripetizioni).\n\n' +
  'Perché è difficile definire una % esatta?\n\n' +
  'Limite delle formule:\n' +
  'Applicando rigidamente la formula "classica" si otterrebbero risultati negativi o assurdi, perché la formula è lineare e non considera il passaggio alla resistenza pura.\n\n' +
  'Fattore metabolico:\n' +
  'Con ripetizioni molto alte, il limite non è più la forza contrattile del muscolo (tensione meccanica), ma la capacità del corpo di gestire l\'acido lattico e ossigenare i muscoli (efficienza cardiovascolare e metabolica).\n\n' +
  'Tipo di esercizio:\n' +
  'C\'è una grande differenza tra fare 50 squat (molto gravosi per sistema nervoso e respiratorio) e 50 curl per i bicipiti o calf raise.\n\n' +
  'Stime approssimative per ripetizioni alte.\n' +
  'In generale, nell\'allenamento sportivo, questi sono i riferimenti per la resistenza:\n\n' +
  '20-30 ripetizioni: circa 50-60% del 1RM.\n\n' +
  '50+ ripetizioni: carichi di "resistenza", generalmente sotto il 40%.\n\n' +
  'Ripetizioni molto alte: regime simile alla calisthenics di base o a test di resistenza estrema, spesso solo peso corporeo o carico minimo (es. 20-30% del 1RM).\n' +
  'In questo caso, usa un peso che all\'inizio sembri "molto leggero", perché la fatica cresce in modo esponenziale dopo le prime 40-50 ripetizioni.\n\n' +
  'Nota: la stima in-app % ≈ 100 − (ripetizioni × 2,5) ha senso solo per circa 1–40 ripetizioni; oltre 40 ripetizioni può mostrare 0% o valori negativi.';

/** @deprecated Use INFO_REPS_ARTICLE_EN */
export const INFO_REPS_DEFAULT_EN = INFO_REPS_ARTICLE_EN;

/** DB / Language settings → Long texts key (Settings → Language → Long texts). */
export const INFO_REPS_TRANSLATION_KEY = 'InfoReps' as const;

type TranslationRow = {
  key: string;
  values?: Record<string, string>;
  isDeleted?: boolean;
};

const SHORT_STUB_MAX_LEN = 380;

function isShortInfoRepsStub(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.length > SHORT_STUB_MAX_LEN) return false;
  return (
    t.includes('Tools / language settings') ||
    t.includes('Strumenti / impostazioni lingua') ||
    t.includes('one-rep max') ||
    t.includes('massimale (1RM)')
  );
}

function infoRepsArticleFallback(language: string): string {
  const lang = normalizeToolsLanguage(language);
  return lang === 'it' ? INFO_REPS_ARTICLE_IT : INFO_REPS_ARTICLE_EN;
}

function infoRepsSummaryFallback(language: string): string {
  const lang = normalizeToolsLanguage(language);
  return lang === 'it' ? INFO_REPS_SUMMARY_IT : INFO_REPS_SUMMARY_EN;
}

/** Profile language first, then UI language picker (navbar). */
export function resolveLongTextLanguage(uiLanguage: string): string {
  const profile = resolveProfileLanguageCodeForToolsLoad();
  if (profile !== 'en') return profile;
  return normalizeToolsLanguage(uiLanguage);
}

export function getInfoRepsModalTitle(language: string): string {
  return normalizeToolsLanguage(language) === 'it'
    ? 'Info Ripetizioni — % carico su 1 MR'
    : 'Info Reps — % of load on 1 MR';
}

export function getInfoRepsCloseLabel(language: string): string {
  return normalizeToolsLanguage(language) === 'it' ? 'Chiudi' : 'Close';
}

export async function fetchTranslationValues(key: string): Promise<Record<string, string> | null> {
  try {
    const res = await fetch('/api/admin/translations', { headers: { ...getAuthHeaders() } });
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean; translations?: TranslationRow[] };
    if (!data.success || !Array.isArray(data.translations)) return null;
    const item = data.translations.find((t) => t.key === key && !t.isDeleted);
    return item?.values ?? null;
  } catch {
    return null;
  }
}

/** Load long text from `/api/admin/translations` for the given key and language. */
export async function fetchLongTextTranslation(
  key: string,
  language: string,
  fallbackEn: string,
): Promise<string> {
  const values = await fetchTranslationValues(key);
  if (!values) return fallbackEn;
  const lang = normalizeToolsLanguage(language);
  const localized = values[lang]?.trim();
  if (localized) return localized;
  const en = values.en?.trim();
  if (en) return en;
  const first = Object.values(values).find((v) => v?.trim());
  return first?.trim() || fallbackEn;
}

/**
 * Full Info Reps dialog body: long article + summary footer, stable (no flicker).
 * DB long text replaces the article; short DB stubs become the footer only.
 */
export async function fetchInfoRepsDisplay(language: string): Promise<string> {
  const lang = normalizeToolsLanguage(language);
  const values = await fetchTranslationValues(INFO_REPS_TRANSLATION_KEY);
  const dbLocalized = values?.[lang]?.trim() ?? '';
  const dbEn = values?.en?.trim() ?? '';

  let article: string;
  if (dbLocalized && !isShortInfoRepsStub(dbLocalized)) {
    article = dbLocalized;
  } else if (lang === 'en' && dbEn && !isShortInfoRepsStub(dbEn)) {
    article = dbEn;
  } else {
    article = infoRepsArticleFallback(lang);
  }

  let summary: string;
  if (dbLocalized && isShortInfoRepsStub(dbLocalized)) {
    summary = dbLocalized;
  } else if (values?.[lang]?.trim() && isShortInfoRepsStub(values[lang]!)) {
    summary = values[lang]!.trim();
  } else {
    summary = infoRepsSummaryFallback(lang);
  }

  if (article.includes(summary.slice(0, Math.min(48, summary.length)))) {
    return article;
  }

  return `${article}\n\n${summary}`;
}

/** @deprecated Use fetchInfoRepsDisplay */
export async function fetchInfoRepsText(language: string): Promise<string> {
  return fetchInfoRepsDisplay(language);
}
