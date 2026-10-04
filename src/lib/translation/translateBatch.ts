import {
  mapLangForTranslationApi,
  translatePlainTextGtx,
  translatePlainTextMyMemory,
} from '@/utils/richTextTranslation';

const GOOGLE_BATCH = 100;

async function googleBatch(
  texts: string[],
  lang: string,
  sourceLang: string,
  apiKey: string,
): Promise<(string | null)[]> {
  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: texts,
          source: mapLangForTranslationApi(sourceLang),
          target: mapLangForTranslationApi(lang),
          format: 'text',
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    const data = (await response.json()) as {
      data?: { translations?: { translatedText?: string }[] };
    };
    const rows = data.data?.translations ?? [];
    return texts.map((_, i) => rows[i]?.translatedText?.trim() || null);
  } catch {
    return texts.map(() => null);
  }
}

const GTX_BATCH_CHARS = 3500;
/** Above this many leftovers the providers are throttling us; one request per text would make it worse. */
const SINGLE_FALLBACK_LIMIT = 40;

/** Free Google endpoint, many short lines per request (one text per line). */
async function gtxBatch(
  texts: string[],
  lang: string,
  sourceLang: string,
): Promise<(string | null)[] | null> {
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
        mapLangForTranslationApi(sourceLang),
      )}&tl=${encodeURIComponent(mapLangForTranslationApi(lang))}&dt=t`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (compatible; MovesBook/1.0)',
        },
        body: `q=${encodeURIComponent(texts.join('\n'))}`,
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
    const joined = (data[0] as unknown[][])
      .map((part) => (typeof part?.[0] === 'string' ? part[0] : ''))
      .join('');
    const lines = joined.split('\n').map((l) => l.trim());
    return lines.length === texts.length ? lines.map((l) => l || null) : null;
  } catch {
    return null;
  }
}

function chunkByChars(texts: string[], maxChars: number): [number, string[]][] {
  const chunks: [number, string[]][] = [];
  let start = 0;
  let current: string[] = [];
  let size = 0;
  texts.forEach((text, i) => {
    if (current.length > 0 && size + text.length + 1 > maxChars) {
      chunks.push([start, current]);
      start = i;
      current = [];
      size = 0;
    }
    current.push(text);
    size += text.length + 1;
  });
  if (current.length > 0) chunks.push([start, current]);
  return chunks;
}

/** Short UI texts → target language; `null` where every provider failed. */
export async function translateTexts(
  texts: string[],
  lang: string,
  sourceLang = 'en',
): Promise<(string | null)[]> {
  if (lang === sourceLang) return [...texts];
  const out: (string | null)[] = texts.map(() => null);
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

  if (apiKey) {
    for (let start = 0; start < texts.length; start += GOOGLE_BATCH) {
      const chunk = texts.slice(start, start + GOOGLE_BATCH);
      const translated = await googleBatch(chunk, lang, sourceLang, apiKey);
      translated.forEach((value, i) => {
        out[start + i] = value;
      });
    }
  }

  const pending = texts.map((_, i) => i).filter((i) => !out[i] && !texts[i].includes('\n'));
  for (const [offset, chunk] of chunkByChars(
    pending.map((i) => texts[i]),
    GTX_BATCH_CHARS,
  )) {
    let translated = await gtxBatch(chunk, lang, sourceLang);
    if (!translated) {
      await new Promise((r) => setTimeout(r, 1500));
      translated = await gtxBatch(chunk, lang, sourceLang);
    }
    translated?.forEach((value, j) => {
      out[pending[offset + j]] = value;
    });
    await new Promise((r) => setTimeout(r, 400));
  }

  const left = out.filter((v) => !v).length;
  for (let i = 0; i < texts.length && left <= SINGLE_FALLBACK_LIMIT; i++) {
    if (out[i]) continue;
    out[i] =
      (await translatePlainTextGtx(texts[i], lang, sourceLang)) ||
      (await translatePlainTextMyMemory(texts[i], lang, sourceLang));
  }
  return out;
}
