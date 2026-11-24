import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isRegisteredLongTextKey,
  listRegisteredLongTextKeys,
  registerLongTextKey,
} from '@/lib/languages/longTextKeysRegistry';
import { KNOWN_LONG_TEXT_KEY_SET } from '@/constants/knownLongTextRegistry';
import { LONG_TEXT_THRESHOLD } from '@/constants/language.constants';


export async function GET(request: NextRequest) {
  try {
    // Fetch all translations (no language relationship in current schema)
    const dbTranslations = await prisma.translation.findMany({
      orderBy: { key: 'asc' },
    });

    console.log(`📊 Fetched ${dbTranslations.length} translations from database`);

    // Group translations by key
    const translationsMap: Record<string, any> = {};
    const categoriesSet = new Set<string>();
    const registeredLongTextKeys = new Set(listRegisteredLongTextKeys());

    for (const trans of dbTranslations) {
      if (!translationsMap[trans.key]) {
        translationsMap[trans.key] = {
          key: trans.key,
          category: trans.category || 'general',
          descriptionEn: `Translation for ${trans.key}`,
          isDeleted: trans.isDeleted || false,
          values: {},
        };
      }
      
      // Use language string directly (not language.code)
      translationsMap[trans.key].values[trans.language] = trans.value;
      
      // Update isDeleted if ANY translation for this key is deleted
      if (trans.isDeleted) {
        translationsMap[trans.key].isDeleted = true;
      }
      
      // Add category to set
      if (trans.category) {
        categoriesSet.add(trans.category);
      }
    }

    const translations = Object.values(translationsMap).map((trans: any) => {
      const hasLongValue = Object.values(trans.values as Record<string, string>).some(
        (val) => typeof val === 'string' && val.length > LONG_TEXT_THRESHOLD
      );
      const isLongText =
        Boolean(trans.isLongText) ||
        registeredLongTextKeys.has(trans.key) ||
        KNOWN_LONG_TEXT_KEY_SET.has(trans.key) ||
        hasLongValue ||
        isRegisteredLongTextKey(trans.key);
      return {
        ...trans,
        isLongText,
      };
    });
    const categories = Array.from(categoriesSet).sort();

    console.log(`✅ Returning ${translations.length} translation keys in ${categories.length} categories`);

    return NextResponse.json({
      success: true,
      translations,
      categories,
      longTextKeys: listRegisteredLongTextKeys(),
    });
  } catch (error) {
    console.error('Error fetching translations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch translations' },
      { status: 500 }
    );
  }
}

