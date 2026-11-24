import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getBearerToken } from '@/lib/adminAuth';
import { translateTexts } from '@/lib/translation/translateBatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_TEXTS = 120;
const MAX_TEXT_LENGTH = 2000;

/** Any logged-in session (super-admin, staff, athlete, club, team, …). */
function requireLoggedIn(request: NextRequest): { ok: true } | { ok: false; status: number; error: string } {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const decoded = verifyToken(token);
  if (!decoded?.userId) {
    return { ok: false, status: 401, error: 'Invalid token' };
  }
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const auth = requireLoggedIn(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as {
      texts?: unknown;
      targetLanguage?: unknown;
      sourceLanguage?: unknown;
    };

    const targetLanguage =
      typeof body.targetLanguage === 'string' ? body.targetLanguage.trim() : '';
    const sourceLanguage =
      typeof body.sourceLanguage === 'string' && body.sourceLanguage.trim()
        ? body.sourceLanguage.trim()
        : 'en';

    if (!targetLanguage) {
      return NextResponse.json({ error: 'targetLanguage is required' }, { status: 400 });
    }

    if (!Array.isArray(body.texts)) {
      return NextResponse.json({ error: 'texts must be an array' }, { status: 400 });
    }

    const texts = body.texts
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= MAX_TEXT_LENGTH)
      .slice(0, MAX_TEXTS);

    if (texts.length === 0) {
      return NextResponse.json({ translations: {} });
    }

    if (targetLanguage === sourceLanguage) {
      return NextResponse.json({
        translations: Object.fromEntries(texts.map((t) => [t, t])),
      });
    }

    const unique: string[] = [];
    const seen = new Set<string>();
    for (const text of texts) {
      if (seen.has(text)) continue;
      seen.add(text);
      unique.push(text);
    }

    const translated = await translateTexts(unique, targetLanguage, sourceLanguage);
    const translations: Record<string, string> = {};
    unique.forEach((text, i) => {
      const value = translated[i]?.trim();
      if (value) translations[text] = value;
    });

    return NextResponse.json({ translations });
  } catch (error) {
    console.error('Admin page-translate error:', error);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
