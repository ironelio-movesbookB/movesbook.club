import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registerLongTextKey } from '@/lib/languages/longTextKeysRegistry';
import { LONG_TEXT_THRESHOLD } from '@/constants/language.constants';

function safeRegisterLongTextKey(key: string): void {
  try {
    registerLongTextKey(key);
  } catch (error) {
    // File registry is optional (prod FS may be read-only); DB isLongText is source of truth.
    console.warn('long-text-keys.json register skipped:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received translation update request:', body);

    // Check if this is a delete/restore operation (only isDeleted field)
    if (body.isDeleted !== undefined && body.key && !body.translations) {
      const { key, isDeleted } = body;

      console.log(`Updating isDeleted status for key: ${key} to ${isDeleted}`);

      const updateResult = await prisma.translation.updateMany({
        where: { key },
        data: { isDeleted },
      });

      return NextResponse.json({
        success: true,
        message: `Updated ${updateResult.count} translation(s) delete status`,
        count: updateResult.count,
      });
    }

    // Bulk update for all languages: { key, translations, category, isLongText? }
    if (body.translations && typeof body.translations === 'object') {
      const { key, translations, category, isLongText } = body;

      if (!key || !translations) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields (key, translations)' },
          { status: 400 },
        );
      }

      console.log(`Bulk updating translations for key: ${key} with category: ${category || 'general'}`);
      const results = [];
      const translationCategory = category || 'general';
      const hasLongValue = Object.values(translations as Record<string, string>).some(
        (val) => typeof val === 'string' && val.length > LONG_TEXT_THRESHOLD,
      );
      const markLongText = isLongText === true || hasLongValue;

      for (const [languageCode, value] of Object.entries(translations)) {
        const text = typeof value === 'string' ? value : '';
        // Skip blank languages on create/update so we do not flood empty rows,
        // but always keep English (required for Long Texts).
        if (!text.trim() && languageCode !== 'en' && !markLongText) {
          results.push({ languageCode, success: true, skipped: true });
          continue;
        }
        try {
          await prisma.translation.upsert({
            where: {
              key_language: {
                key,
                language: languageCode,
              },
            },
            update: {
              value: text,
              category: translationCategory,
              ...(markLongText ? { isLongText: true } : {}),
            },
            create: {
              key,
              language: languageCode,
              value: text,
              category: translationCategory,
              isDeleted: false,
              isLongText: markLongText,
            },
          });

          results.push({ languageCode, success: true });
          console.log(`✅ Updated ${languageCode} translation for ${key}`);
        } catch (error) {
          console.error(`Error updating ${languageCode} for ${key}:`, error);
          results.push({ languageCode, success: false, error: String(error) });
        }
      }

      if (markLongText) {
        // Ensure at least one row carries isLongText even if only EN was written earlier.
        await prisma.translation.updateMany({
          where: { key: String(key) },
          data: { isLongText: true },
        });
        safeRegisterLongTextKey(String(key));
      }

      const okCount = results.filter((r) => r.success).length;
      if (okCount === 0) {
        return NextResponse.json(
          { success: false, error: 'Failed to save any language translations' },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        message: `Updated ${okCount} language(s)`,
        results,
        isLongText: markLongText,
      });
    }

    // Single language update (old format)
    const { key, languageCode, value, isLongText } = body;

    if (!key || !languageCode) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields (key, languageCode)' },
        { status: 400 },
      );
    }

    const markLongText =
      isLongText === true || (typeof value === 'string' && value.length > LONG_TEXT_THRESHOLD);

    const translation = await prisma.translation.upsert({
      where: {
        key_language: {
          key,
          language: languageCode,
        },
      },
      update: {
        value: value || '',
        category: 'general',
        ...(markLongText ? { isLongText: true } : {}),
      },
      create: {
        key,
        language: languageCode,
        value: value || '',
        category: 'general',
        isDeleted: false,
        isLongText: markLongText,
      },
    });

    if (markLongText) {
      await prisma.translation.updateMany({
        where: { key: String(key) },
        data: { isLongText: true },
      });
      safeRegisterLongTextKey(String(key));
    }

    return NextResponse.json({
      success: true,
      translation,
    });
  } catch (error) {
    console.error('Error updating translation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update translation' },
      { status: 500 },
    );
  }
}
