'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Globe, Settings as SettingsIcon, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { i18n } from '@/lib/i18n';
import RichTextEditor from './RichTextEditor';
import SportLabelsSyncCard from './SportLabelsSyncCard';
import { useLanguageData } from '@/hooks/useLanguageData';
import { useColumnResize } from '@/hooks/useColumnResize';
import { useTranslationEditor } from '@/hooks/useTranslationEditor';
import {
  Language,
  TranslationKey,
  LanguageTab,
  ITEMS_PER_PAGE,
  LONG_TEXT_THRESHOLD,
  SEARCH_FIELD_OPTIONS,
  TranslationCategory,
  ALL_LANGUAGES,
  getFlagImageSrc,
  getFlagSizeClass,
  filterLongTexts,
  filterByCategory,
  filterBySearch
} from '@/constants/language.constants';
import { getJsonAuthHeaders } from '@/utils/auth.utils';
import {
  hasRichTextContent,
  plainTextToRichHtml,
  richTextToPlainText,
  fetchLongTextTranslations,
  paragraphsToRichHtml,
  splitPlainTextParagraphs,
} from '@/utils/richTextTranslation';
import { KNOWN_LONG_TEXT_ENTRIES } from '@/constants/knownLongTextRegistry';

const KNOWN_LONG_TEXT_DESCRIPTIONS = Object.fromEntries(
  KNOWN_LONG_TEXT_ENTRIES.map((e) => [e.key, e.descriptionEn]),
);

/** Plain DB strings → HTML for RichTextEditor; leave existing HTML unchanged. */
function toEditorHtml(text: string): string {
  if (!text?.trim()) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return plainTextToRichHtml(text);
}

/** Ensure every supported locale has an editor value (empty string when missing). */
function normalizeEditorTranslations(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    ALL_LANGUAGES.map((lang) => [lang.code, toEditorHtml(values[lang.code] || '')])
  );
}

export default function LanguageSettings() {
  // Use custom hooks for data and logic management
  const {
    languages,
    allKeys,
    filteredKeys,
    isLoading,
    loadLanguagesData,
    loadStaticTranslations,
    saveLanguageOrder,
    setLanguages,
    setAllKeys,
    setFilteredKeys,
    setIsLoading
  } = useLanguageData();
  
  const [activeTab, setActiveTab] = useState<LanguageTab>('official');
  
  const {
    columnWidths,
    resizingColumn,
    scrollbarWidth,
    scrollbarLeft,
    scrollbarContainerWidth,
    tableContainerRef,
    scrollbarRef,
    startResize,
    setColumnWidths
  } = useColumnResize(activeTab);
  
  const {
    handleSave: saveTranslation,
    handleSaveNewKey: saveNewTranslationKey,
    handleDeleteOrRestore: deleteOrRestoreTranslation
  } = useTranslationEditor();
  
  // Local state for translation progress
  const [isTranslating, setIsTranslating] = useState(false);

  // Tab 1 state (Official Languages)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentKey, setCurrentKey] = useState<TranslationKey | null>(null);
  const [variableName, setVariableName] = useState('');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [searchField, setSearchField] = useState('variable_name');
  const [searchQuery, setSearchQuery] = useState('');

  // Language settings state
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [fallbackLanguage, setFallbackLanguage] = useState('en');
  const [autoDetect, setAutoDetect] = useState(true);
  
  // Category filter for Language Long Texts
  const [selectedCategory, setSelectedCategory] = useState<TranslationCategory>('system');
  
  // New language/translation key state
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyCategory, setNewKeyCategory] = useState('system');
  const [newKeyTranslations, setNewKeyTranslations] = useState<Record<string, string>>({});
  const [isLongTextModal, setIsLongTextModal] = useState(false);
  
  // Auto-translation state
  const [englishText, setEnglishText] = useState('');
  const [translationBannerVisible, setTranslationBannerVisible] = useState(false);
  const [translationRevision, setTranslationRevision] = useState(0);
  const tab3OtherLanguagesRef = useRef<HTMLDivElement | null>(null);
  /** Avoid wiping in-progress editor state when filteredKeys refreshes after save/translate. */
  const lastLoadedEditorKeyRef = useRef<string | null>(null);
  
  // Tab 2 pagination state
  const [tab2Page, setTab2Page] = useState(1);
  
  // Tab 2 search and edit state
  const [tab2SearchQuery, setTab2SearchQuery] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  
  // Tab 3 search, view, and pagination state
  const [tab3SearchQuery, setTab3SearchQuery] = useState('');
  const [tab3ViewMode, setTab3ViewMode] = useState<'list' | 'editor'>('list');
  const [tab3SelectedKey, setTab3SelectedKey] = useState<TranslationKey | null>(null);
  const [tab3Page, setTab3Page] = useState(1);
  
  // Super Admin password dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordAction, setPasswordAction] = useState<'delete' | 'restore'>('delete');
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');

  // Data loading is now handled by useLanguageData hook

  // Handle search and category filtering
  useEffect(() => {
    let filtered = allKeys;
    
    // Tab 3: Filter for LONG texts only (any translation > LONG_TEXT_THRESHOLD characters)
    if (activeTab === 'texts') {
      filtered = filterLongTexts(filtered);
      
      // Filter by Tab 3 search query - searches across ALL categories
      if (tab3SearchQuery.trim() !== '') {
        filtered = filterBySearch(filtered, tab3SearchQuery);
      } else {
        // Only apply category filter when there's NO search query
        filtered = filterByCategory(filtered, selectedCategory);
      }
    }
    
    // Filter by category for Tab 2 (not affected by Tab 3 search)
    if (activeTab === 'settings') {
      filtered = filtered.filter(key => key.category === selectedCategory);
    }
    
    // Filter by Tab 2 search query (applies only to Tab 2)
    if (activeTab === 'settings' && tab2SearchQuery.trim() !== '') {
      filtered = filtered.filter((key) => {
        const searchLower = tab2SearchQuery.toLowerCase();
        return key.key.toLowerCase().includes(searchLower) ||
               Object.values(key.values).some(val => val.toLowerCase().includes(searchLower));
      });
    }
    
    // Filter by search query (legacy - keeping for compatibility)
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter((key) => {
        if (searchField === 'variable_name') {
          return key.key.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      });
    }
    
    setFilteredKeys(filtered);
    setCurrentIndex(0);
    setTab2Page(1); // Reset to page 1 when filters change
    setTab3Page(1); // Reset Tab 3 to page 1 when filters change
  }, [searchQuery, searchField, allKeys, selectedCategory, activeTab, tab2SearchQuery, tab3SearchQuery, setFilteredKeys]);

  // Load editor content only when the selected key changes (not on every filteredKeys refresh).
  useEffect(() => {
    if (filteredKeys.length === 0 || currentIndex < 0 || currentIndex >= filteredKeys.length) {
      return;
    }
    const key = filteredKeys[currentIndex];
    setCurrentKey(key);
    setVariableName(key.key);

    if (lastLoadedEditorKeyRef.current === key.key) {
      return;
    }
    lastLoadedEditorKeyRef.current = key.key;
    const normalizedValues = normalizeEditorTranslations(key.values);
    setTranslations(normalizedValues);
    setEnglishText(normalizedValues.en || '');
    setTranslationBannerVisible(false);
  }, [currentIndex, filteredKeys]);

  // Reset to list view when switching to Tab 3
  useEffect(() => {
    if (activeTab === 'texts') {
      setTab3ViewMode('list');
      setTab3SelectedKey(null);
    }
  }, [activeTab]);

  // Flag component helper (now uses constants)
  const getFlagComponent = (code: string, size: 'small' | 'medium' | 'large' = 'medium') => {
    return (
      <div className={`flex items-center justify-center ${getFlagSizeClass(size)} rounded overflow-hidden relative`}>
        <Image 
          src={getFlagImageSrc(code)} 
          alt={`${code} flag`}
          fill
          sizes={size === 'small' ? '20px' : size === 'large' ? '40px' : '28px'}
          className="object-cover"
        />
      </div>
    );
  };

  const handleSave = async () => {
    const keyMeta = activeEditorKey();
    if (!keyMeta) {
      alert('⚠️ No translation key selected to save');
      return;
    }
    const mergedTranslations = { ...translations, en: englishText };
    await saveTranslation(
      variableName,
      mergedTranslations,
      keyMeta.category || 'general',
      keyMeta,
      allKeys,
      searchQuery,
      (updatedKeys) => {
        setAllKeys(updatedKeys);
        setFilteredKeys(updatedKeys.filter(k => 
          searchQuery.trim() === '' || k.key.toLowerCase().includes(searchQuery.toLowerCase())
        ));
        const saved = updatedKeys.find((k) => k.key === variableName);
        if (saved) {
          lastLoadedEditorKeyRef.current = saved.key;
          setTranslations(normalizeEditorTranslations(saved.values));
          setEnglishText(saved.values.en || englishText);
        }
        setTranslationRevision((r) => r + 1);
        
        if (activeTab === 'texts' && tab3ViewMode === 'editor') {
          setTab3ViewMode('list');
          setTab3SelectedKey(null);
        }
      }
    );
  };

  const handleReset = () => {
    if (currentKey) {
      lastLoadedEditorKeyRef.current = null;
      setVariableName(currentKey.key);
      const normalizedValues = normalizeEditorTranslations(currentKey.values);
      setTranslations(normalizedValues);
      setEnglishText(normalizedValues.en || '');
      setTranslationBannerVisible(false);
      lastLoadedEditorKeyRef.current = currentKey.key;
    }
  };

  const handleManualEdit = () => {
    tab3OtherLanguagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Tab 2 specific handlers
  const handleEditStart = (key: TranslationKey) => {
    setEditingKey(key.key);
    setEditedValues({ ...key.values });
  };

  const handleEditSave = async (keyName: string) => {
    const key = allKeys.find(k => k.key === keyName);
    if (!key) return;
    
    await saveTranslation(
      keyName,
      editedValues,
      key.category,
      key,
      allKeys,
      '',
      (updatedKeys) => {
        setAllKeys(updatedKeys);
        setEditingKey(null);
        loadStaticTranslations();
      }
    );
  };

  const handleEditCancel = () => {
    setEditingKey(null);
    setEditedValues({});
  };
  
  // Column resize handlers
  // Column resize handler (uses hook)
  const handleResizeStart = (e: React.MouseEvent, columnName: string) => {
    e.preventDefault();
    startResize(columnName, e.clientX, columnWidths[columnName as keyof typeof columnWidths]);
  };
  
  // Scrollbar syncing is now handled by useColumnResize hook

  const handleDeleteOrRestore = (keyName: string, isCurrentlyDeleted: boolean) => {
    setPendingActionKey(keyName);
    setPasswordAction(isCurrentlyDeleted ? 'restore' : 'delete');
    setShowPasswordDialog(true);
  };

  const handlePasswordConfirm = async () => {
    if (!pendingActionKey) return;

    const isCurrentlyDeleted = passwordAction === 'restore';
    
    await deleteOrRestoreTranslation(
      pendingActionKey,
      isCurrentlyDeleted,
      adminPassword,
      allKeys,
      () => {
        loadStaticTranslations();
      setShowPasswordDialog(false);
      setAdminPassword('');
      setPendingActionKey(null);
    }
    );
  };

  const toggleLanguage = (langCode: string) => {
    setLanguages(prev => {
      const updated = prev.map(lang => 
        lang.code === langCode ? { ...lang, isActive: !lang.isActive } : lang
      );
      
      // Save active languages to localStorage
      const activeLanguageCodes = updated.filter(l => l.isActive).map(l => l.code);
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeLanguages', JSON.stringify(activeLanguageCodes));
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('activeLanguagesChanged'));
      }
      
      return updated;
    });
  };

  const goToPage = (pageNumber: number) => {
    const index = pageNumber - 1;
    if (index >= 0 && index < filteredKeys.length) {
      setCurrentIndex(index);
    }
  };

  const nextPage = () => {
    if (currentIndex < filteredKeys.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevPage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSearch = () => {
    // Trigger search (already handled by useEffect)
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    setSearchField('variable_name');
  };

  const handleNewKey = () => {
    setShowNewKeyModal(true);
    setNewKeyName('');
    setNewKeyCategory('system');
    setNewKeyTranslations(initNewKeyTranslations());
  };

  const handleSaveNewKey = async () => {
    await saveNewTranslationKey(
      newKeyName,
      newKeyTranslations,
      newKeyCategory,
      allKeys,
      () => {
        loadStaticTranslations();
        setShowNewKeyModal(false);

        const hasLongText = Object.values(newKeyTranslations).some(
          (val) => val && val.length > LONG_TEXT_THRESHOLD
        );

        if (isLongTextModal || hasLongText) {
          setActiveTab('texts');
          setSelectedCategory(newKeyCategory as TranslationCategory);
        } else {
          setActiveTab('settings');
          setSelectedCategory(newKeyCategory as TranslationCategory);
        }

        setIsLongTextModal(false);
      },
      {
        isLongText: isLongTextModal,
        allowUpdateExisting: isLongTextModal,
      }
    );
  };

  const handleCancelNewKey = () => {
    setShowNewKeyModal(false);
    setNewKeyName('');
    setNewKeyTranslations({});
    setIsLongTextModal(false);
  };

  const longTextTargetLanguages = () =>
    ALL_LANGUAGES.map((l) => l.code).filter((code) => code !== 'en');

  const applyPlainTranslationsToHtml = (
    sourceHtml: string,
    trans: Record<string, string>,
    targetLangs: string[],
    existing: Record<string, string> = {},
  ): Record<string, string> => {
    const sourceParagraphs = splitPlainTextParagraphs(richTextToPlainText(sourceHtml));
    const out: Record<string, string> = { en: sourceHtml, ...existing };
    for (const lang of targetLangs) {
      const plain = trans[lang]?.trim() ?? '';
      if (!plain) continue;
      const translatedParagraphs = splitPlainTextParagraphs(plain);
      if (sourceParagraphs.length > 1 && translatedParagraphs.length === sourceParagraphs.length) {
        out[lang] = paragraphsToRichHtml(translatedParagraphs);
      } else {
        out[lang] = plainTextToRichHtml(plain);
      }
    }
    return out;
  };

  const activeEditorKey = (): TranslationKey | null => tab3SelectedKey || currentKey;

  const initNewKeyTranslations = (): Record<string, string> =>
    Object.fromEntries(ALL_LANGUAGES.map((lang) => [lang.code, '']));

  const persistLongTextTranslations = async (
    key: string,
    category: string,
    values: Record<string, string>,
  ): Promise<boolean> => {
    const persistRes = await fetch('/api/admin/translations/update', {
      method: 'POST',
      headers: getJsonAuthHeaders(),
      body: JSON.stringify({ key, translations: values, category, isLongText: true }),
    });
    if (!persistRes.ok) return false;
    setAllKeys((prev) =>
      prev.map((k) => (k.key === key ? { ...k, values, category } : k)),
    );
    setCurrentKey((prev) => (prev?.key === key ? { ...prev, values, category } : prev));
    setTab3SelectedKey((prev) => (prev?.key === key ? { ...prev, values, category } : prev));
    lastLoadedEditorKeyRef.current = key;
    return true;
  };

  const handleAutoTranslate = async () => {
    const sourceHtml = englishText;
    const plainSource = richTextToPlainText(sourceHtml);

    if (!plainSource.trim()) {
      alert('⚠️ Please enter English text first');
      return;
    }

    setIsTranslating(true);

    try {
      const targetLanguages = longTextTargetLanguages();
      const { translations: trans, failedLanguages } = await fetchLongTextTranslations(
        plainSource,
        targetLanguages,
      );

      const updatedTranslations = applyPlainTranslationsToHtml(
        sourceHtml,
        trans,
        targetLanguages,
        translations,
      );

      setTranslations(updatedTranslations);
      setTranslationBannerVisible(true);
      setTranslationRevision((r) => r + 1);

      const keyMeta = activeEditorKey();
      const keyToSave = variableName || keyMeta?.key;
      if (keyToSave) {
        const saved = await persistLongTextTranslations(
          keyToSave,
          keyMeta?.category || 'general',
          updatedTranslations,
        );
        if (!saved) {
          alert(
            '⚠️ Translations were generated but could not be saved automatically.\n\nClick Save to store them in the database.',
          );
        } else if (failedLanguages.length === 0) {
          setTranslationBannerVisible(true);
        }
      }

      if (failedLanguages.length > 0) {
        alert(
          `⚠️ Translation completed with partial results.\n\nMissing languages: ${failedLanguages.join(', ')}\n\nYou can press Translation again or fill them manually, then Save.`,
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(
        `❌ TRANSLATION FAILED!\n\nError: ${errorMessage}\n\nTry again or use Manual Edit.`,
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAutoTranslateNewKey = async () => {
    const sourceHtml = newKeyTranslations.en || '';
    const plainSource = richTextToPlainText(sourceHtml);
    if (!plainSource.trim()) {
      alert('⚠️ Please enter English text first');
      return;
    }
    setIsTranslating(true);
    try {
      const targetLanguages = longTextTargetLanguages();
      const { translations: trans, failedLanguages } = await fetchLongTextTranslations(
        plainSource,
        targetLanguages,
      );
      const htmlByLang = applyPlainTranslationsToHtml(
        sourceHtml,
        trans,
        targetLanguages,
        newKeyTranslations,
      );
      setNewKeyTranslations(htmlByLang);
      setTranslationRevision((r) => r + 1);
      if (failedLanguages.length > 0) {
        alert(
          `⚠️ Some languages could not be translated: ${failedLanguages.join(', ')}\n\nPress Translation again or edit manually before Create.`,
        );
      }
    } catch (error) {
      alert(`❌ Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSaveLanguageSelection = () => {
    const activeCount = languages.filter(l => l.isActive).length;
    
    // Save active languages in custom priority order to localStorage
    // This order will be reflected in the navbar language selector
    const activeLanguagesInOrder = languages
      .filter(l => l.isActive)
      .map(l => l.code);
    
    localStorage.setItem('activeLanguages', JSON.stringify(activeLanguagesInOrder));
    
    // Also save the full language order (including inactive ones) for reference
    const allLanguagesOrder = languages.map(l => l.code);
    localStorage.setItem('languageOrder', JSON.stringify(allLanguagesOrder));
    
    // Dispatch event to update navbar immediately
    window.dispatchEvent(new Event('activeLanguagesChanged'));
    
    alert(`✅ Language selection saved!\n\n${activeCount} languages are now active.\nThe navbar language selector will now display them in this priority order.`);
  };

  const moveLanguageUp = (index: number) => {
    if (index === 0) return; // Already at top
    
    const newLanguages = [...languages];
    // Swap with previous item
    [newLanguages[index - 1], newLanguages[index]] = [newLanguages[index], newLanguages[index - 1]];
    setLanguages(newLanguages);
  };

  const moveLanguageDown = (index: number) => {
    if (index === languages.length - 1) return; // Already at bottom
    
    const newLanguages = [...languages];
    // Swap with next item
    [newLanguages[index], newLanguages[index + 1]] = [newLanguages[index + 1], newLanguages[index]];
    setLanguages(newLanguages);
  };

  const totalPages = filteredKeys.length;
  const currentPage = currentIndex + 1;
  
  const getPageNumbers = () => {
    const pages = [];
    const maxPages = 9;
    let start = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let end = Math.min(totalPages, start + maxPages - 1);
    
    if (end - start + 1 < maxPages) {
      start = Math.max(1, end - maxPages + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Language Management</h2>
      </div>

      <SportLabelsSyncCard />

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-300">
        <button
          onClick={() => setActiveTab('official')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all duration-300 border-b-4 ${
            activeTab === 'official'
              ? 'border-blue-600 text-blue-600 bg-blue-50'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Globe className="w-5 h-5" />
          Set Official Languages
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all duration-300 border-b-4 ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-600 bg-blue-50'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
          Language Settings
        </button>
        <button
          onClick={() => setActiveTab('texts')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all duration-300 border-b-4 ${
            activeTab === 'texts'
              ? 'border-blue-600 text-blue-600 bg-blue-50'
              : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-5 h-5" />
          Language Long Texts
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* Tab 1: Set Official Languages */}
        {activeTab === 'official' && (
          <div className="bg-white border border-gray-300 rounded-lg p-6 shadow">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Globe className="w-6 h-6 text-blue-600" />
              Set languages to be used in Movesbook
            </h3>
            
            {/* Center the table with max-width */}
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Flag</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Language</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Move</th>
                    </tr>
                  </thead>
                  <tbody>
                    {languages.map((lang, index) => (
                      <tr key={lang.code} className="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3 w-20">
                          {getFlagComponent(lang.code, 'small')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">{lang.name}</span>
                            <span className="text-xs text-gray-500">{lang.nativeName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center w-32">
                          <button
                            onClick={() => toggleLanguage(lang.code)}
                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm ${
                              lang.isActive ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                                lang.isActive ? 'translate-x-8' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center w-32">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => moveLanguageUp(index)}
                              disabled={index === 0}
                              className={`p-1.5 rounded transition-all ${
                                index === 0
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                              }`}
                              title="Move up"
                            >
                              <ArrowUp className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => moveLanguageDown(index)}
                              disabled={index === languages.length - 1}
                              className={`p-1.5 rounded transition-all ${
                                index === languages.length - 1
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                              }`}
                              title="Move down"
                            >
                              <ArrowDown className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  <strong>{languages.filter(l => l.isActive).length}</strong> of <strong>{languages.length}</strong> languages active
                </p>
                <button 
                  onClick={handleSaveLanguageSelection}
                  className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow"
                >
                  Save Language Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Language Settings */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between bg-white border border-gray-300 p-4 rounded">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-gray-900">Languages</h3>
                <button 
                  onClick={() => {
                    setShowNewKeyModal(true);
                    setIsLongTextModal(false);
                    setNewKeyName('');
                    setNewKeyCategory('system');
                    const initialTranslations: Record<string, string> = {};
                    languages.filter(l => l.isActive).forEach(lang => {
                      initialTranslations[lang.code] = '';
                    });
                    setNewKeyTranslations(initialTranslations);
                  }}
                  className="px-6 py-2 bg-gray-700 text-white font-semibold hover:bg-gray-800 transition"
                >
                  New Language
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">Language Page</span>
                
                {/* Previous Button */}
                    <button 
                  onClick={() => setTab2Page(Math.max(1, tab2Page - 1))}
                  disabled={tab2Page === 1}
                  className={`px-3 py-2 font-semibold transition ${
                    tab2Page === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                >
                  ←
                </button>
                
                {(() => {
                  const totalPages = Math.ceil(filteredKeys.length / ITEMS_PER_PAGE);
                  const pages = [];
                  
                  // Always show first page
                  if (totalPages > 0) {
                    pages.push(
                      <button 
                        key={1}
                        onClick={() => setTab2Page(1)}
                      className={`px-4 py-2 font-semibold transition ${
                          tab2Page === 1
                          ? 'bg-gray-700 text-white'
                          : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                      }`}
                    >
                        1
                    </button>
                    );
                  }
                  
                  // Add ellipsis if needed
                  if (tab2Page > 3) {
                    pages.push(
                      <span key="ellipsis1" className="px-2 text-gray-600">
                        ...
                  </span>
                    );
                  }
                  
                  // Show pages around current page
                  const start = Math.max(2, tab2Page - 1);
                  const end = Math.min(totalPages - 1, tab2Page + 1);
                  
                  for (let i = start; i <= end; i++) {
                    pages.push(
                      <button 
                        key={i}
                        onClick={() => setTab2Page(i)}
                        className={`px-4 py-2 font-semibold transition ${
                          tab2Page === i
                            ? 'bg-gray-700 text-white'
                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }
                  
                  // Add ellipsis if needed
                  if (tab2Page < totalPages - 2) {
                    pages.push(
                      <span key="ellipsis2" className="px-2 text-gray-600">
                        ...
                      </span>
                    );
                  }
                  
                  // Always show last page (if more than 1 page)
                  if (totalPages > 1) {
                    pages.push(
                      <button 
                        key={totalPages}
                        onClick={() => setTab2Page(totalPages)}
                        className={`px-4 py-2 font-semibold transition ${
                          tab2Page === totalPages
                            ? 'bg-gray-700 text-white'
                            : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        }`}
                      >
                        {totalPages}
                      </button>
                    );
                  }
                  
                  return pages;
                })()}
                
                {/* Next Button */}
                <button
                  onClick={() => setTab2Page(Math.min(Math.ceil(filteredKeys.length / ITEMS_PER_PAGE), tab2Page + 1))}
                  disabled={tab2Page >= Math.ceil(filteredKeys.length / ITEMS_PER_PAGE)}
                  className={`px-3 py-2 font-semibold transition ${
                    tab2Page >= Math.ceil(filteredKeys.length / ITEMS_PER_PAGE)
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                >
                  →
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white border border-gray-300 p-4 rounded">
              <div className="flex items-center gap-4">
                <label className="font-semibold text-gray-700">Search:</label>
                <input
                  type="text"
                  value={tab2SearchQuery}
                  onChange={(e) => setTab2SearchQuery(e.target.value)}
                  placeholder="Search in selected category..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
                {tab2SearchQuery && (
                  <button
                    onClick={() => setTab2SearchQuery('')}
                    className="px-4 py-2 bg-gray-500 text-white font-semibold hover:bg-gray-600 transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCategory('system')}
                className={`px-6 py-3 font-semibold transition ${
                  selectedCategory === 'system'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                System Administration & Homepage
              </button>
              <button
                onClick={() => setSelectedCategory('social')}
                className={`px-6 py-3 font-semibold transition ${
                  selectedCategory === 'social'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                Social & Sport
              </button>
              <button
                onClick={() => setSelectedCategory('management')}
                className={`px-6 py-3 font-semibold transition ${
                  selectedCategory === 'management'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                Management
              </button>
            </div>

            {/* Table View - Horizontal Scroll with Sticky En & It */}
            <div 
              ref={tableContainerRef}
              className="bg-white border border-gray-300 relative" 
              id="language-table-container" 
              style={{
                maxHeight: 'calc(100vh - 360px)', 
                overflowY: 'auto',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              <table style={{ 
                tableLayout: 'fixed', 
                width: `${Object.values(columnWidths).reduce((sum, w) => sum + w, 0)}px`,
                minWidth: '1400px'
              }}>
                <thead className="bg-gray-100 border-b border-gray-300 sticky top-0 z-30">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 sticky left-0 bg-gray-100 z-40 select-none" style={{width: `${columnWidths.srNo}px`}}>
                      Sr.No
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'srNo')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 sticky bg-gray-100 z-40 select-none" style={{width: `${columnWidths.varName}px`, left: `${columnWidths.srNo}px`}}>
                      Variable_name
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'varName')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-red-700 sticky bg-gray-100 z-40 select-none" style={{width: `${columnWidths.en}px`, left: `${columnWidths.srNo + columnWidths.varName}px`}}>
                      En
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'en')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-red-700 sticky bg-gray-100 z-40 select-none" style={{width: `${columnWidths.it}px`, left: `${columnWidths.srNo + columnWidths.varName + columnWidths.en}px`}}>
                      It
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'it')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 relative select-none" style={{width: `${columnWidths.fr}px`}}>
                      Fr
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'fr')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 relative select-none" style={{width: `${columnWidths.de}px`}}>
                      De
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'de')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 relative select-none" style={{width: `${columnWidths.es}px`}}>
                      Es
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'es')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 relative select-none" style={{width: `${columnWidths.pt}px`}}>
                      Pt
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'pt')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 relative select-none" style={{width: `${columnWidths.ru}px`}}>
                      Ru
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'ru')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 relative select-none" style={{width: `${columnWidths.hi}px`}}>
                      Hi
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'hi')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 relative select-none" style={{width: `${columnWidths.ja}px`}}>
                      Ja
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'ja')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 relative select-none" style={{width: `${columnWidths.id}px`}}>
                      Id
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'id')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 relative select-none" style={{width: `${columnWidths.zh}px`}}>
                      Zh
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'zh')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 relative select-none" style={{width: `${columnWidths.ar}px`}}>
                      Ar
                      <div 
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group"
                        onMouseDown={(e) => handleResizeStart(e, 'ar')}
                      >
                        <div className="w-full h-full group-hover:bg-blue-500"></div>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 sticky right-0 bg-gray-100 z-40 shadow-lg select-none" style={{width: `${columnWidths.actions}px`}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKeys.slice((tab2Page - 1) * ITEMS_PER_PAGE, tab2Page * ITEMS_PER_PAGE).map((key, index) => {
                    const isEditing = editingKey === key.key;
                    const isDeleted = key.isDeleted || false;
                    const rowClasses = `border-b border-gray-200 transition ${
                      isDeleted ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'
                    }`;
                    const textClasses = isDeleted ? 'text-gray-400 line-through' : 'text-gray-900';
                    
                    const stickyBg = isDeleted ? 'bg-gray-100' : 'bg-white';
                    const leftOffsets = {
                      srNo: 0,
                      varName: columnWidths.srNo,
                      en: columnWidths.srNo + columnWidths.varName,
                      it: columnWidths.srNo + columnWidths.varName + columnWidths.en
                    };
                    
                    return (
                      <tr key={key.key} className={rowClasses}>
                        <td className={`px-4 py-3 text-sm font-medium ${textClasses} sticky left-0 z-10 ${stickyBg} overflow-hidden`} style={{width: `${columnWidths.srNo}px`}}>
                          <div className="truncate">{(tab2Page - 1) * ITEMS_PER_PAGE + index + 1}</div>
                        </td>
                        <td className={`px-4 py-3 text-sm font-semibold ${isDeleted ? 'text-gray-400 line-through' : 'text-red-700'} sticky z-10 ${stickyBg} overflow-hidden`} style={{left: `${leftOffsets.varName}px`, width: `${columnWidths.varName}px`}}>
                          <div className="truncate" title={key.key}>{key.key}</div>
                        </td>
                        
                        {/* English - Sticky RED column */}
                        <td className={`px-4 py-3 text-sm sticky z-10 ${stickyBg} overflow-hidden`} style={{left: `${leftOffsets.en}px`, width: `${columnWidths.en}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.en || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, en: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.en}>
                            <span className={textClasses}>{key.values.en || ''}</span>
                            </div>
                          )}
                        </td>
                        
                        {/* Italian - Sticky RED column */}
                        <td className={`px-4 py-3 text-sm sticky z-10 ${stickyBg} overflow-hidden`} style={{left: `${leftOffsets.it}px`, width: `${columnWidths.it}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.it || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, it: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.it}>
                            <span className={textClasses}>{key.values.it || ''}</span>
                            </div>
                          )}
                        </td>
                        
                        {/* French - Scrollable */}
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{width: `${columnWidths.fr}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.fr || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, fr: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.fr}>
                            <span className={textClasses}>{key.values.fr || ''}</span>
                            </div>
                          )}
                        </td>
                        
                        {/* German - Scrollable */}
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{width: `${columnWidths.de}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.de || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, de: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.de}><span className={textClasses}>{key.values.de || ''}</span></div>
                          )}
                        </td>
                        
                        {/* Spanish - Scrollable */}
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{width: `${columnWidths.es}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.es || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, es: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.es}><span className={textClasses}>{key.values.es || ''}</span></div>
                          )}
                        </td>
                        
                        {/* Portuguese - Scrollable */}
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{width: `${columnWidths.pt}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.pt || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, pt: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.pt}><span className={textClasses}>{key.values.pt || ''}</span></div>
                          )}
                        </td>
                        
                        {/* Russian - Scrollable */}
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{width: `${columnWidths.ru}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.ru || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, ru: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.ru}><span className={textClasses}>{key.values.ru || ''}</span></div>
                          )}
                        </td>
                        
                        {/* Hindi - Scrollable */}
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{width: `${columnWidths.hi}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.hi || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, hi: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.hi}><span className={textClasses}>{key.values.hi || ''}</span></div>
                          )}
                        </td>
                        
                        {/* Japanese - Scrollable */}
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{width: `${columnWidths.ja}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.ja || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, ja: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.ja}><span className={textClasses}>{key.values.ja || ''}</span></div>
                          )}
                        </td>
                        
                        {/* Indonesian - Scrollable */}
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{width: `${columnWidths.id}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.id || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, id: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.id}><span className={textClasses}>{key.values.id || ''}</span></div>
                          )}
                        </td>
                        
                        {/* Chinese - Scrollable */}
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{width: `${columnWidths.zh}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.zh || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, zh: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.zh}><span className={textClasses}>{key.values.zh || ''}</span></div>
                          )}
                        </td>
                        
                        {/* Arabic - Scrollable */}
                        <td className="px-4 py-3 text-sm overflow-hidden" style={{width: `${columnWidths.ar}px`}}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedValues.ar || ''}
                              onChange={(e) => setEditedValues(prev => ({ ...prev, ar: e.target.value }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            <div className="truncate" title={key.values.ar}><span className={textClasses}>{key.values.ar || ''}</span></div>
                          )}
                        </td>
                        
                        {/* Actions - Sticky Right */}
                        <td className={`px-4 py-3 text-center sticky right-0 z-10 ${stickyBg} shadow-lg`} style={{width: `${columnWidths.actions}px`}}>
                          <div className="flex items-center justify-center gap-2">
                            {isEditing ? (
                              <>
                                <button 
                                  onClick={() => handleEditSave(key.key)}
                                  className="px-4 py-1 bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition"
                                >
                                  Save
                                </button>
                                <button 
                                  onClick={handleEditCancel}
                                  className="px-4 py-1 bg-gray-500 text-white font-semibold text-sm hover:bg-gray-600 transition"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => handleEditStart(key)}
                                  className={`px-4 py-1 font-semibold text-sm transition ${
                                    isDeleted 
                                      ? 'bg-gray-400 text-white cursor-not-allowed'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                  disabled={isDeleted}
                                >
                                  Edit
                                </button>
                                <button 
                                  onClick={() => handleDeleteOrRestore(key.key, isDeleted)}
                                  className={`px-4 py-1 font-semibold text-sm transition ${
                                    isDeleted
                                      ? 'bg-green-600 text-white hover:bg-green-700'
                                      : 'bg-red-600 text-white hover:bg-red-700'
                                  }`}
                                >
                                  {isDeleted ? 'Restore' : 'Delete'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <style jsx>{`
                #language-table-container::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
            </div>
            
            {/* Sticky Horizontal Scrollbar - Always visible at window bottom */}
            {activeTab === 'settings' && (
              <div 
                ref={scrollbarRef}
                className="fixed bottom-0 overflow-x-auto z-50"
                style={{
                  height: '32px',
                  backgroundColor: '#374151',
                  left: scrollbarLeft > 0 ? `${scrollbarLeft}px` : '0',
                  width: scrollbarContainerWidth > 0 ? `${scrollbarContainerWidth}px` : '100%',
                  boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              >
                <div 
                  style={{ 
                    width: `${scrollbarWidth || 2200}px`, 
                    height: '32px', 
                    backgroundColor: 'rgba(156, 163, 175, 0.3)',
                    minWidth: '2200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                </div>
              </div>
            )}

          </div>
        )}

        {/* Tab 3: Language Long Texts */}
        {activeTab === 'texts' && (
          <div className="space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between bg-white border border-gray-300 p-4 rounded">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-gray-900">System Administration & Homepage</h3>
                <button 
                  onClick={() => {
                    setShowNewKeyModal(true);
                    setIsLongTextModal(true);
                    setNewKeyName('');
                    setNewKeyCategory('system');
                    setNewKeyTranslations(initNewKeyTranslations());
                  }}
                  className="px-6 py-2 bg-gray-700 text-white font-semibold hover:bg-gray-800 transition"
                >
                  New Language Long Text
                </button>
              </div>
            </div>

            {/* Search Bar for Tab 3 */}
            <div className="bg-white border border-gray-300 p-4 rounded">
              <div className="flex items-center gap-4">
                <label className="font-semibold text-gray-700">Search Long Texts:</label>
                <input
                  type="text"
                  value={tab3SearchQuery}
                  onChange={(e) => setTab3SearchQuery(e.target.value)}
                  placeholder="Search by variable name or content..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {tab3SearchQuery && (
                  <button
                    onClick={() => setTab3SearchQuery('')}
                    className="px-4 py-2 bg-gray-500 text-white font-semibold hover:bg-gray-600 transition"
                  >
                    Clear
                  </button>
                )}
                <div className="text-sm text-gray-600">
                  Found: <span className="font-bold">{filteredKeys.length}</span> long text{filteredKeys.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCategory('system')}
                className={`px-6 py-3 font-semibold transition ${
                  selectedCategory === 'system'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                System Administration & Homepage
              </button>
              <button
                onClick={() => setSelectedCategory('social')}
                className={`px-6 py-3 font-semibold transition ${
                  selectedCategory === 'social'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                Social & Sport
              </button>
              <button
                onClick={() => setSelectedCategory('management')}
                className={`px-6 py-3 font-semibold transition ${
                  selectedCategory === 'management'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                }`}
              >
                Management
              </button>
            </div>
            
            {/* LIST VIEW - Show all long texts as cards */}
            {tab3ViewMode === 'list' && (
              <div className="space-y-4">
                {filteredKeys.length === 0 ? (
                  <div className="bg-white border border-gray-300 p-12 text-center rounded-lg">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2">No Long Texts Found</h3>
                    <p className="text-gray-600 mb-4">
                      {tab3SearchQuery 
                        ? 'No long texts match your search. Try a different term or clear the search.'
                        : 'No long texts in this category yet. Click "New Language Long Text" to create one.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Tab 3 Pagination Controls - TOP */}
                    {filteredKeys.length > ITEMS_PER_PAGE && (
                      <div className="flex items-center justify-between bg-white border border-gray-300 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">
                          Showing {((tab3Page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(tab3Page * ITEMS_PER_PAGE, filteredKeys.length)} of {filteredKeys.length} long texts
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setTab3Page(tab3Page - 1)}
                            disabled={tab3Page === 1}
                            className="px-4 py-2 bg-gray-600 text-white font-semibold rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 transition"
                          >
                            ← Previous
                          </button>
                          
                          <div className="flex items-center gap-1">
                            {(() => {
                              const totalPages = Math.ceil(filteredKeys.length / ITEMS_PER_PAGE);
                              const pages = [];
                              
                              // Always show first page
                              if (totalPages > 0) {
                                pages.push(
                              <button
                                    key={1}
                                    onClick={() => setTab3Page(1)}
                                className={`w-10 h-10 rounded font-semibold transition ${
                                      tab3Page === 1
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                    1
                              </button>
                                );
                              }
                              
                              // Add ellipsis if needed
                              if (tab3Page > 4) {
                                pages.push(
                                  <span key="ellipsis1" className="px-2 text-gray-600">
                                    ...
                                  </span>
                                );
                              }
                              
                              // Show pages around current page
                              const start = Math.max(2, tab3Page - 2);
                              const end = Math.min(totalPages - 1, tab3Page + 2);
                              
                              for (let i = start; i <= end; i++) {
                                pages.push(
                                  <button
                                    key={i}
                                    onClick={() => setTab3Page(i)}
                                    className={`w-10 h-10 rounded font-semibold transition ${
                                      tab3Page === i
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                  >
                                    {i}
                                  </button>
                                );
                              }
                              
                              // Add ellipsis if needed
                              if (tab3Page < totalPages - 3) {
                                pages.push(
                                  <span key="ellipsis2" className="px-2 text-gray-600">
                                    ...
                                  </span>
                                );
                              }
                              
                              // Always show last page (if more than 1 page)
                              if (totalPages > 1) {
                                pages.push(
                                  <button
                                    key={totalPages}
                                    onClick={() => setTab3Page(totalPages)}
                                    className={`w-10 h-10 rounded font-semibold transition ${
                                      tab3Page === totalPages
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                  >
                                    {totalPages}
                                  </button>
                                );
                              }
                              
                              return pages;
                            })()}
                          </div>
                          
                          <button
                            onClick={() => setTab3Page(tab3Page + 1)}
                            disabled={tab3Page >= Math.ceil(filteredKeys.length / ITEMS_PER_PAGE)}
                            className="px-4 py-2 bg-gray-600 text-white font-semibold rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 transition"
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-4">
                      {(() => {
                        // Calculate pagination
                        const startIndex = (tab3Page - 1) * ITEMS_PER_PAGE;
                        const endIndex = startIndex + ITEMS_PER_PAGE;
                        const paginatedKeys = filteredKeys.slice(startIndex, endIndex);
                        
                        return paginatedKeys.map((key, paginatedIndex) => {
                          const index = startIndex + paginatedIndex; // Actual index in full list
                      const isDeleted = key.isDeleted || false;
                      const textPreview = richTextToPlainText(
                        key.values.en || Object.values(key.values)[0] || '',
                      );
                      const preview = textPreview.length > 150 
                        ? textPreview.substring(0, 150) + '...' 
                        : textPreview;
                      const usageHint = KNOWN_LONG_TEXT_DESCRIPTIONS[key.key];
                      const langCount = Object.values(key.values).filter(v => v && v.trim()).length;
                      const categoryName = key.category === 'system' ? 'System' : 
                                          key.category === 'social' ? 'Social & Sport' : 'Management';
                      
                      return (
                        <div 
                          key={key.key} 
                          className={`bg-white border-2 rounded-lg p-5 transition-all hover:shadow-lg ${
                            isDeleted 
                              ? 'border-gray-300 bg-gray-50 opacity-60' 
                              : 'border-gray-200 hover:border-blue-400'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            {/* Left side - Content */}
                            <div className="flex-1 min-w-0">
                              {/* Variable Name */}
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">📝</span>
                                <h3 className={`text-lg font-bold ${
                                  isDeleted ? 'text-gray-400 line-through' : 'text-red-700'
                                }`}>
                                  {key.key}
                                </h3>
                              </div>

                              {usageHint ? (
                                <p className="text-xs text-blue-700 mb-2">{usageHint}</p>
                              ) : null}
                              
                              {/* Text Preview */}
                              <p className={`text-sm mb-3 leading-relaxed ${
                                isDeleted ? 'text-gray-400' : 'text-gray-700'
                              }`}>
                                {preview}
                              </p>
                              
                              {/* Metadata */}
                              <div className="flex items-center gap-4 text-xs">
                                <span className={`px-3 py-1 rounded-full font-medium ${
                                  isDeleted 
                                    ? 'bg-gray-200 text-gray-500'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  🌍 {langCount} language{langCount !== 1 ? 's' : ''}
                                </span>
                                <span className={`px-3 py-1 rounded-full font-medium ${
                                  isDeleted
                                    ? 'bg-gray-200 text-gray-500'
                                    : 'bg-purple-100 text-purple-700'
                                }`}>
                                  📂 {categoryName}
                                </span>
                                <span className="text-gray-500">
                                  #{index + 1} of {filteredKeys.length}
                                </span>
                                {isDeleted && (
                                  <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">
                                    🗑️ Deleted
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Right side - Actions */}
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  lastLoadedEditorKeyRef.current = null;
                                  const normalizedValues = normalizeEditorTranslations(key.values);
                                  setTab3ViewMode('editor');
                                  setTab3SelectedKey(key);
                                  setCurrentIndex(index);
                                  setVariableName(key.key);
                                  setTranslations(normalizedValues);
                                  setEnglishText(normalizedValues.en || '');
                                  setTranslationBannerVisible(false);
                                  lastLoadedEditorKeyRef.current = key.key;
                                  requestAnimationFrame(() => {
                                    tab3OtherLanguagesRef.current?.scrollIntoView({
                                      behavior: 'smooth',
                                      block: 'start',
                                    });
                                  });
                                }}
                                disabled={isDeleted}
                                className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all ${
                                  isDeleted
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                                }`}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleDeleteOrRestore(key.key, isDeleted)}
                                className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all ${
                                  isDeleted
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-md'
                                }`}
                              >
                                {isDeleted ? '♻️ Restore' : '🗑️ Delete'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                        });
                      })()}
                    </div>
                    
                    {/* Tab 3 Pagination Controls */}
                    {filteredKeys.length > ITEMS_PER_PAGE && (
                      <div className="flex items-center justify-between bg-white border border-gray-300 p-4 rounded-lg">
                        <div className="text-sm text-gray-600">
                          Showing {((tab3Page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(tab3Page * ITEMS_PER_PAGE, filteredKeys.length)} of {filteredKeys.length} long texts
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setTab3Page(tab3Page - 1)}
                            disabled={tab3Page === 1}
                            className="px-4 py-2 bg-gray-600 text-white font-semibold rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 transition"
                          >
                            ← Previous
                          </button>
                          
                          <div className="flex items-center gap-1">
                            {(() => {
                              const totalPages = Math.ceil(filteredKeys.length / ITEMS_PER_PAGE);
                              const pages = [];
                              
                              // Always show first page
                              if (totalPages > 0) {
                                pages.push(
                              <button
                                    key={1}
                                    onClick={() => setTab3Page(1)}
                                className={`w-10 h-10 rounded font-semibold transition ${
                                      tab3Page === 1
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                    1
                              </button>
                                );
                              }
                              
                              // Add ellipsis if needed
                              if (tab3Page > 4) {
                                pages.push(
                                  <span key="ellipsis1" className="px-2 text-gray-600">
                                    ...
                                  </span>
                                );
                              }
                              
                              // Show pages around current page
                              const start = Math.max(2, tab3Page - 2);
                              const end = Math.min(totalPages - 1, tab3Page + 2);
                              
                              for (let i = start; i <= end; i++) {
                                pages.push(
                                  <button
                                    key={i}
                                    onClick={() => setTab3Page(i)}
                                    className={`w-10 h-10 rounded font-semibold transition ${
                                      tab3Page === i
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                  >
                                    {i}
                                  </button>
                                );
                              }
                              
                              // Add ellipsis if needed
                              if (tab3Page < totalPages - 3) {
                                pages.push(
                                  <span key="ellipsis2" className="px-2 text-gray-600">
                                    ...
                                  </span>
                                );
                              }
                              
                              // Always show last page (if more than 1 page)
                              if (totalPages > 1) {
                                pages.push(
                                  <button
                                    key={totalPages}
                                    onClick={() => setTab3Page(totalPages)}
                                    className={`w-10 h-10 rounded font-semibold transition ${
                                      tab3Page === totalPages
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                  >
                                    {totalPages}
                                  </button>
                                );
                              }
                              
                              return pages;
                            })()}
                          </div>
                          
                          <button
                            onClick={() => setTab3Page(tab3Page + 1)}
                            disabled={tab3Page >= Math.ceil(filteredKeys.length / ITEMS_PER_PAGE)}
                            className="px-4 py-2 bg-gray-600 text-white font-semibold rounded disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 transition"
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* EDITOR VIEW - Full editor for selected text */}
            {tab3ViewMode === 'editor' && tab3SelectedKey && (
              <div className="space-y-6">
                {/* Back to List Button */}
                <div className="flex items-center gap-4 bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
                  <button
                    onClick={() => {
                      setTab3ViewMode('list');
                      setTab3SelectedKey(null);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg hover:bg-gray-50 border-2 border-gray-300 hover:border-gray-400 transition-all"
                  >
                    <span className="text-xl">←</span>
                    Back to List
                  </button>
                  <div className="flex-1">
                    <div className="text-sm text-gray-600">Editing Long Text:</div>
                    <div className="text-lg font-bold text-gray-900">{tab3SelectedKey.key}</div>
                    {tab3SelectedKey.key === 'AutoProcessInfo' ? (
                      <p className="text-xs text-amber-800 mt-1 max-w-xl">
                        Use blank lines between paragraphs. The <strong>last paragraph</strong> is shown in the yellow confirmation box; all preceding paragraphs appear as the main dialog text.
                      </p>
                    ) : null}
                  </div>
                </div>
                
                {/* Pagination */}
                <div className="flex items-center justify-center gap-2 bg-gray-100 p-3 rounded">
                  <button
                    onClick={prevPage}
                    disabled={currentIndex === 0}
                    className="px-4 py-2 bg-gray-600 text-white font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-gray-700 transition"
                  >
                    prev
                  </button>
                  {getPageNumbers().map((page) => (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-4 py-2 font-semibold transition ${
                        page === currentPage
                          ? 'bg-gray-800 text-white'
                          : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={nextPage}
                    disabled={currentIndex === filteredKeys.length - 1}
                    className="px-4 py-2 bg-gray-600 text-white font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-gray-700 transition"
                  >
                    next
                  </button>
                </div>

                {/* Detailed Editor */}
                <div className="bg-white border border-gray-300 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4 flex-1">
                      <label className="font-semibold text-gray-700">
                        Sr.No {currentPage} <span className="ml-2">variable_name</span>
                      </label>
                      <input
                        type="text"
                        value={variableName}
                        onChange={(e) => setVariableName(e.target.value)}
                        className="flex-1 max-w-md px-4 py-2 border-2 border-red-500 focus:outline-none focus:border-red-600"
                      />
                    </div>
                    <button
                      onClick={handleReset}
                      className="px-6 py-2 bg-red-500 text-white font-semibold hover:bg-red-600 transition"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Auto-Translation Section */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-lg overflow-hidden relative">
                        <Image 
                          src="/flags/en.png" 
                          alt="English flag"
                          fill
                          sizes="32px"
                          className="object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg">English (Source)</h4>
                        <p className="text-sm text-gray-600">Enter your text in English - we'll translate it for you</p>
                      </div>
                    </div>
                    
                    <RichTextEditor
                      key={`en-${tab3SelectedKey?.key ?? variableName}-${translationRevision}`}
                      value={englishText}
                      revision={translationRevision}
                      onChange={(newValue) => {
                        setEnglishText(newValue);
                        setTranslations((prev) => ({ ...prev, en: newValue }));
                      }}
                      placeholder="Type your English text here..."
                      minHeight="280px"
                      language="English"
                    />

                    <div className="flex gap-3 mt-4 items-center">
                      <button
                        onClick={handleAutoTranslate}
                        disabled={isTranslating || !hasRichTextContent(englishText)}
                        className={`flex items-center justify-center gap-2 px-8 py-3 font-bold rounded transition-all duration-300 ${
                          isTranslating || !hasRichTextContent(englishText)
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-2 border-gray-300'
                            : 'bg-white text-gray-800 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                        }`}
                      >
                        {isTranslating ? 'Translating...' : 'Translation'}
                      </button>
                      
                      <button
                        onClick={handleSave}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-white text-gray-800 font-bold rounded border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all"
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={handleManualEdit}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-white border-2 border-gray-300 text-gray-800 font-bold rounded hover:bg-gray-50 hover:border-gray-400 transition-all"
                      >
                        Manual Edit
                      </button>
                    </div>
                  </div>

                  {/* Other languages — always visible in long-text editor */}
                  <div ref={tab3OtherLanguagesRef} className="mt-8 space-y-6">
                    {translationBannerVisible && (
                      <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                        <p className="text-sm text-green-900 font-semibold">
                          ✅ Translations generated and saved. Review other languages below, then Save if you made edits.
                        </p>
                      </div>
                    )}

                    <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700">
                      Other languages
                    </h4>

                    {ALL_LANGUAGES.filter((l) => l.code !== 'en').map((lang) => {
                      const activeMeta = languages.find((l) => l.code === lang.code);
                      const isActive = activeMeta?.isActive ?? true;
                      return (
                      <div key={lang.code} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-6 py-3 flex items-center gap-3 border-b">
                          <div className="w-6 h-6 rounded overflow-hidden relative">
                            <Image
                              src={getFlagImageSrc(lang.code)}
                              alt={`${lang.name} flag`}
                              fill
                              sizes="24px"
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 text-lg">{lang.name}</span>
                            <span className="text-sm text-gray-600 ml-2">({lang.nativeName})</span>
                            {!isActive ? (
                              <span className="ml-2 text-xs text-amber-700">inactive</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="p-4 bg-white">
                          <RichTextEditor
                            key={`${lang.code}-${tab3SelectedKey?.key ?? variableName}-${translationRevision}`}
                            revision={translationRevision}
                            value={translations[lang.code] || ''}
                            onChange={(newValue) =>
                              setTranslations((prev) => ({ ...prev, [lang.code]: newValue }))
                            }
                            placeholder={`${lang.name} translation...`}
                            minHeight="220px"
                            language={lang.name}
                          />
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Language Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto ${isLongTextModal ? 'max-w-4xl' : 'max-w-2xl'}`}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <h3 className="text-xl font-bold text-gray-900">
                {isLongTextModal ? 'Add New Language Long Text' : 'Add New Translation Key'}
              </h3>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Variable Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Variable Name (Key) *
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., welcome_message, button_submit"
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={newKeyCategory}
                  onChange={(e) => setNewKeyCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                >
                  <option value="system">System Administration & Homepage</option>
                  <option value="social">Social & Sport</option>
                  <option value="management">Management</option>
                </select>
              </div>

              {/* Translation Fields */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold text-gray-900">
                    {isLongTextModal ? 'Long Text Translations' : 'Translations'}
                  </h4>
                  {isLongTextModal ? (
                    <button
                      type="button"
                      onClick={() => void handleAutoTranslateNewKey()}
                      disabled={isTranslating || !hasRichTextContent(newKeyTranslations.en || '')}
                      className="rounded-md border-2 border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isTranslating ? 'Translating…' : 'Translation'}
                    </button>
                  ) : null}
                </div>
                {(isLongTextModal ? ALL_LANGUAGES : languages).map((lang) => (
                  <div key={lang.code}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {lang.name} ({lang.nativeName})
                    </label>
                    {isLongTextModal ? (
                      <RichTextEditor
                        key={`new-${lang.code}-${translationRevision}`}
                        revision={translationRevision}
                        value={newKeyTranslations[lang.code] || ''}
                        onChange={(newValue) =>
                          setNewKeyTranslations((prev) => ({
                            ...prev,
                            [lang.code]: newValue,
                          }))
                        }
                        placeholder={`Enter ${lang.name} long text translation...`}
                        minHeight={lang.code === 'en' ? '320px' : '220px'}
                        language={lang.name}
                      />
                    ) : (
                      <input
                        type="text"
                        value={newKeyTranslations[lang.code] || ''}
                        onChange={(e) =>
                          setNewKeyTranslations((prev) => ({
                            ...prev,
                            [lang.code]: e.target.value,
                          }))
                        }
                        placeholder={`Enter ${lang.name} translation...`}
                        className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={handleCancelNewKey}
                className="px-6 py-2 bg-gray-300 text-gray-700 font-semibold rounded hover:bg-gray-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewKey}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition"
              >
                {isLongTextModal ? 'Create Long Text' : 'Create Translation Key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin Password Confirmation Dialog */}
      {showPasswordDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 px-6 py-4 rounded-t-lg">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🔐</span>
                Super Admin Confirmation Required
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="text-sm text-yellow-800 font-semibold">
                  ⚠️ {passwordAction === 'delete' ? 'Delete' : 'Restore'} Translation Term
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  {passwordAction === 'delete' ? (
                    <>
                      Deleted terms will display as <code className="bg-yellow-200 px-1 rounded">{pendingActionKey}</code> in the application until restored.
                    </>
                  ) : (
                    `This will restore "${pendingActionKey}" and make it available in all languages again.`
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Enter Super Admin Password *
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter your admin password..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-red-500 text-lg"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handlePasswordConfirm();
                    }
                  }}
                />
              </div>

              <p className="text-xs text-gray-500">
                Term: <code className="bg-gray-100 px-2 py-1 rounded font-mono">{pendingActionKey}</code>
              </p>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
              <button
                onClick={() => {
                  setShowPasswordDialog(false);
                  setAdminPassword('');
                  setPendingActionKey(null);
                }}
                className="px-6 py-2 bg-gray-300 text-gray-700 font-semibold rounded hover:bg-gray-400 transition"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordConfirm}
                className={`px-6 py-2 font-semibold rounded transition text-white ${
                  passwordAction === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {passwordAction === 'delete' ? 'Confirm Delete' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


