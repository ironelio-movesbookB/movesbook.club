import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registerLongTextKey } from '@/lib/languages/longTextKeysRegistry';
import { LONG_TEXT_THRESHOLD } from '@/constants/language.constants';

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
          { status: 400 }
        );
      }

      console.log(`Bulk updating translations for key: ${key} with category: ${category || 'general'}`);
      const results = [];
      const translationCategory = category || 'general';

      for (const [languageCode, value] of Object.entries(translations)) {
        try {
          await prisma.translation.upsert({
            where: {
              key_language: {
                key,
                language: languageCode,
              },
            },
            update: {
              value: (value as string) || '',
              category: translationCategory,
            },
            create: {
              key,
              language: languageCode,
              value: (value as string) || '',
              category: translationCategory,
              isDeleted: false,
            },
          });

          results.push({ languageCode, success: true });
          console.log(`✅ Updated ${languageCode} translation for ${key}`);
        } catch (error) {
          console.error(`Error updating ${languageCode} for ${key}:`, error);
          results.push({ languageCode, success: false, error: String(error) });
        }
      }

      const hasLongValue = Object.values(translations as Record<string, string>).some(
        (val) => typeof val === 'string' && val.length > LONG_TEXT_THRESHOLD
      );
      if (isLongText === true || hasLongValue) {
        registerLongTextKey(String(key));
      }

      return NextResponse.json({
        success: true,
        message: `Updated ${results.filter((r) => r.success).length} language(s)`,
        results,
        isLongText: isLongText === true || hasLongValue,
      });
    }

    // Single language update (old format)
    const { key, languageCode, value, isLongText } = body;

    if (!key || !languageCode) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields (key, languageCode)' },
        { status: 400 }
      );
    }

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
      },
      create: {
        key,
        language: languageCode,
        value: value || '',
        category: 'general',
        isDeleted: false,
      },
    });

    if (isLongText === true || (typeof value === 'string' && value.length > LONG_TEXT_THRESHOLD)) {
      registerLongTextKey(String(key));
    }

    return NextResponse.json({
      success: true,
      translation,
    });
  } catch (error) {
    console.error('Error updating translation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update translation' },
      { status: 500 }
    );
  }
}
