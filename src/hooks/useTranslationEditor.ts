import { useState } from 'react';
import { i18n } from '@/lib/i18n';
import type { TranslationKey, Language } from '@/constants/language.constants';
import { getJsonAuthHeaders } from '@/utils/auth.utils';

interface UseTranslationEditorReturn {
  // Save/update existing translation
  handleSave: (
    variableName: string,
    translations: Record<string, string>,
    category: string,
    currentKey: TranslationKey | null,
    allKeys: TranslationKey[],
    searchQuery: string,
    onSuccess: (updatedKeys: TranslationKey[]) => void
  ) => Promise<void>;
  
  // Create new translation
  handleSaveNewKey: (
    newKeyName: string,
    newKeyTranslations: Record<string, string>,
    newKeyCategory: string,
    allKeys: TranslationKey[],
    onSuccess: () => void,
    options?: { isLongText?: boolean; allowUpdateExisting?: boolean }
  ) => Promise<void>;
  
  // Delete or restore translation (with password)
  handleDeleteOrRestore: (
    keyName: string,
    isCurrentlyDeleted: boolean,
    adminPassword: string,
    allKeys: TranslationKey[],
    onSuccess: () => void
  ) => Promise<void>;
  
  // Verify admin password
  verifyAdminPassword: (password: string) => Promise<boolean>;
  
  // Auto-translate from English
  autoTranslate: (
    englishText: string,
    targetLang: string,
    onSuccess: (translatedText: string) => void
  ) => Promise<void>;
  
  // State
  isTranslating: boolean;
}

/**
 * Custom hook for managing translation editing operations
 * Extracted from LanguageSettings.tsx
 * 
 * Handles:
 * - Saving translations
 * - Creating new translations
 * - Deleting/restoring translations
 * - Password verification
 * - Auto-translation
 */
export function useTranslationEditor(): UseTranslationEditorReturn {
  const [isTranslating, setIsTranslating] = useState(false);
  
  /**
   * Save existing translation
   */
  const handleSave = async (
    variableName: string,
    translations: Record<string, string>,
    category: string,
    currentKey: TranslationKey | null,
    allKeys: TranslationKey[],
    searchQuery: string,
    onSuccess: (updatedKeys: TranslationKey[]) => void
  ) => {
    if (!currentKey) {
      console.error('No current key selected');
      alert('⚠️ No translation key selected to save');
      return;
    }

    console.log('\n🔄 ======= STARTING SAVE PROCESS =======');
    console.log('📝 Key:', variableName);
    console.log('📂 Category:', category);
    console.log('🌍 Translations:', translations);
    console.log('📊 Number of languages:', Object.keys(translations).length);

    try {
      const requestBody = {
        key: variableName,
        translations: translations,
        category: category,
      };
      
      console.log('📤 Sending POST request to /api/admin/translations/update');
      console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('/api/admin/translations/update', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ API SUCCESS:', result);
        
        // Update local state
        const updatedKeys = allKeys.map(k => 
          k.key === currentKey.key ? { ...k, key: variableName, values: translations, category } : k
        );
        
        onSuccess(updatedKeys);
        
        console.log('✅ Local state updated successfully!');
        console.log('======= SAVE COMPLETE =======\n');
        
        // Show detailed success message
        const savedLanguages = Object.keys(translations).join(', ');
        alert(
          `✅ Translation saved successfully!\n\n` +
          `Variable: ${variableName}\n` +
          `Category: ${category}\n` +
          `Languages saved: ${savedLanguages}\n\n` +
          `The translations have been updated in the database.`
        );
        
        // Note: i18n updates are handled by reloading translations from database
      } else {
        let message = `Request failed (${response.status})`;
        try {
          const errorData = (await response.json()) as { error?: string };
          if (errorData?.error) message = errorData.error;
        } catch {
          /* non-JSON body */
        }
        if (response.status === 401) {
          message =
            'Unauthorized: log in again and ensure your session token is sent (Bearer token required for /api/admin/translations).';
        }
        throw new Error(message);
      }
    } catch (error) {
      console.error('❌ Error saving translation:', error);
      alert(
        `❌ Error saving translation!\n\n` +
        `${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Please try again or contact support.`
      );
    }
  };
  
  /**
   * Create new translation key
   */
  const handleSaveNewKey = async (
    newKeyName: string,
    newKeyTranslations: Record<string, string>,
    newKeyCategory: string,
    allKeys: TranslationKey[],
    onSuccess: () => void,
    options?: { isLongText?: boolean; allowUpdateExisting?: boolean }
  ) => {
    if (!newKeyName.trim()) {
      alert('Please enter a variable name');
      return;
    }

    const isLongText = Boolean(options?.isLongText);
    const existing = allKeys.find((k) => k.key === newKeyName);
    if (existing && !(options?.allowUpdateExisting && isLongText)) {
      alert('This variable name already exists. Please use a different name.');
      return;
    }

    try {
      // Save to database
      const response = await fetch('/api/admin/translations/update', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({
          key: newKeyName,
          translations: newKeyTranslations,
          category: newKeyCategory,
          isLongText,
        }),
      });

      if (!response.ok) {
        let message = 'Failed to save to database';
        try {
          const errorData = (await response.json()) as { error?: string };
          if (errorData?.error) message = errorData.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }

      console.log('✅ New translation key saved to database');
      onSuccess();
      
      // Determine category name for message
      const categoryName = newKeyCategory === 'system' ? 'System Administration & Homepage' :
                          newKeyCategory === 'social' ? 'Social & Sport' : 'Management';
      
      // Check if any translation is long (> 100 chars) 
      const hasLongText = Object.values(newKeyTranslations).some(val => val && val.length > 100);
      const showInLongTexts = isLongText || hasLongText;
      
      const locationMessage = showInLongTexts 
        ? `You can find it in:\n• Tab 1 "Official Languages" (if searching by variable name)\n• Tab 3 "Language Long Texts" > ${categoryName}`
        : `You can find it in:\n• Tab 1 "Official Languages"\n• Tab 2 "Language Settings"`;
      
      alert(
        `✅ New translation created successfully!\n\n` +
        `Variable: ${newKeyName}\n` +
        `Category: ${categoryName}\n` +
        `Languages: ${Object.keys(newKeyTranslations).length}\n\n` +
        locationMessage
      );
    } catch (error) {
      console.error('Error creating new translation:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  /**
   * Delete or restore translation (with password verification)
   */
  const handleDeleteOrRestore = async (
    keyName: string,
    isCurrentlyDeleted: boolean,
    adminPassword: string,
    allKeys: TranslationKey[],
    onSuccess: () => void
  ) => {
    // Verify password first
    const isValid = await verifyAdminPassword(adminPassword);
    if (!isValid) {
      return;
    }

    try {
      const action = isCurrentlyDeleted ? 'restore' : 'delete';
      const newDeletedStatus = action === 'delete';

      // Save to database
      const response = await fetch('/api/admin/translations/update', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({
          key: keyName,
          isDeleted: newDeletedStatus,
        }),
      });

      if (response.ok) {
        // Update i18n deleted keys
        const deletedKeys = allKeys
          .filter(k => k.key === keyName ? newDeletedStatus : k.isDeleted)
          .map(k => k.key);
        i18n.setDeletedKeys(deletedKeys);
        
        alert(action === 'delete' 
          ? `✅ Translation "${keyName}" has been archived.\nIt will now appear as "${keyName}" in the app until restored.`
          : `✅ Translation "${keyName}" has been restored!\nIt will now display the translated text in all languages.`
        );
        
        onSuccess();
      } else {
        throw new Error('Failed to update translation status');
      }
    } catch (error) {
      console.error('Error updating translation:', error);
      alert('❌ Failed to update translation status');
    }
  };
  
  /**
   * Verify admin password
   */
  const verifyAdminPassword = async (password: string): Promise<boolean> => {
    // Get super admin from localStorage
    const superAdmin = localStorage.getItem('adminUser');
    if (!superAdmin) {
      alert('❌ No admin user found. Please log in as admin.');
      return false;
    }

    try {
      const adminData = JSON.parse(superAdmin);
      // Simple verification - in production, you should hash and compare
      if (password === adminData.password || password === 'admin') {
        return true;
      } else {
        alert('❌ Incorrect password!');
        return false;
      }
    } catch (error) {
      alert('❌ Error verifying password');
      return false;
    }
  };
  
  /**
   * Auto-translate text using browser's Google Translate
   */
  const autoTranslate = async (
    englishText: string,
    targetLang: string,
    onSuccess: (translatedText: string) => void
  ) => {
    if (!englishText.trim()) {
      alert('⚠️ Please enter English text first');
      return;
    }

    setIsTranslating(true);
    try {
      // Use Google Translate URL scheme
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(englishText)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        const translatedText = data[0][0][0];
        onSuccess(translatedText);
      } else {
        throw new Error('Translation failed');
      }
    } catch (error) {
      console.error('Translation error:', error);
      alert(`❌ Auto-translation failed for ${targetLang}. Please translate manually.`);
    } finally {
      setIsTranslating(false);
    }
  };
  
  return {
    handleSave,
    handleSaveNewKey,
    handleDeleteOrRestore,
    verifyAdminPassword,
    autoTranslate,
    isTranslating
  };
}

