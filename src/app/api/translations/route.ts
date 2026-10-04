import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Section languages for the site: `{ strings: { en: {...}, it: {...} } }` (English always included). */
export async function GET(request: NextRequest) {
  const lang = (request.nextUrl.searchParams.get('lang') || 'en').trim().slice(0, 8);
  const languages = lang === 'en' ? ['en'] : ['en', lang];
  try {
    const rows = await prisma.translation.findMany({
      where: { language: { in: languages }, isDeleted: false },
      select: { key: true, language: true, value: true },
    });
    const strings: Record<string, Record<string, string>> = {};
    for (const code of languages) strings[code] = {};
    for (const row of rows) {
      if (row.value.trim()) strings[row.language][row.key] = row.value;
    }
    return NextResponse.json(
      { strings },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
    );
  } catch (error) {
    console.error('Error loading translations:', error);
    return NextResponse.json({ strings: {} }, { status: 500 });
  }
}
