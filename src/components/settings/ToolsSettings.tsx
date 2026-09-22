'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import {
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  ArrowUpAZ,
  ArrowDownZA,
  Save,
  X,
  Download,
  Globe,
  Image as ImageIcon,
  Smile,
  Grid3x3,
  List,
  ArrowUpDown,
  AlertCircle,
  CheckCircle,
  Building2,
  LogIn,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSettingsLayoutExpand } from '@/contexts/SettingsLayoutExpandContext';
import { useToolsData } from '@/hooks/useToolsData';
import {
  Period,
  WorkoutSection,
  BodyBuildingTechnique,
  Sport,
  Equipment,
  Exercise,
  ExercisePathologyCatalogItem,
  Device,
  IconType,
  ToolsTab,
  SUPPORTED_LANGUAGES,
  supportedLanguagesPeriodAdminOrder,
  DEFAULT_SPORTS,
  filterBySearch,
  filterByCategory,
  reorderItems,
  mergeExerciseWithDefaults,
  finalizeExerciseForStorage,
} from '@/constants/tools.constants';
import { SPORTS_LIST, getSportDisplayName } from '@/constants/moveframe.constants';
import PeriodizationTabPanel from '@/components/settings/PeriodizationTabPanel';
import PeriodizationOverviewPanel from '@/components/settings/PeriodizationOverviewPanel';
import PlannedActionTemplatesEditor from '@/components/settings/PlannedActionTemplatesEditor';
import SportDropdownParametersSettings from '@/components/settings/SportDropdownParametersSettings';
import SportMachinesSection from '@/components/settings/SportMachinesSection';
import SuperAdminCompaniesSection from '@/components/settings/SuperAdminCompaniesSection';
import ExerciseBankTab from '@/components/settings/ExerciseBankTab';
import ExercisePathologiesCatalogSection from '@/components/settings/ExercisePathologiesCatalogSection';
import ExerciseOGPPanel from '@/components/settings/ExerciseOGPPanel';
import SectionExerciseDialog from '@/components/settings/SectionExerciseDialog';
import { useCanManageSportMachineCompanies } from '@/hooks/useCanManageSportMachineCompanies';

function normalizeToolsLanguage(code: string | undefined): string {
  if (!code) return 'en';
  const lower = code.toLowerCase().trim();
  if (SUPPORTED_LANGUAGES.some((l) => l.code === lower)) return lower;
  const two = lower.split('-')[0] || 'en';
  return SUPPORTED_LANGUAGES.some((l) => l.code === two) ? two : 'en';
}

type PeriodizationSubview = 'periodSettings' | 'periodization' | 'overview';

interface ToolsSettingsProps {
  isAdmin?: boolean;
  userType?: string;
  mode?: 'tools' | 'technical';
  initialTab?: ToolsTab;
  /** When true, only the Periods UI is shown (main Settings → Periodization). */
  periodizationOnly?: boolean;
}

function getAllowedTabs(isAdmin: boolean, mode: 'tools' | 'technical'): ToolsTab[] {
  if (mode === 'technical') {
    return [
      'equipmentFactories',
      'muscles',
      'sportsEquipment',
      'sportMachines',
      'exercises',
      'pathologies',
      'myLibrary',
      'devices',
    ];
  }
  if (isAdmin) {
    return [
      'periods',
      'sections',
      'bodyBuildingTechniques',
      'commonDailyActions',
      'insertActions',
      'sportDropdownParameters',
    ];
  }
  // Personal Settings (all users): keep official user tabs only
  // and exclude technical/admin tabs (factories, muscles, sports-equipment).
  return [
    'periods',
    'sections',
    'bodyBuildingTechniques',
    'equipment',
    'exercises',
    'pathologies',
    'myLibrary',
    'devices',
    'insertActions',
  ];
}

/** Category chips for Technical Settings → My Library of Exercises. */
const MY_LIBRARY_CATEGORY_BUTTONS = [
  'Isotonic\\weights',
  'Stretching',
  'Pilates',
  'Gymnastic',
  'Calistenic',
  'Spartan',
  'Crossfit',
  'Aerobic sports',
  'Martial arts',
] as const;

export default function ToolsSettings({
  isAdmin = false,
  userType = 'ATHLETE',
  mode = 'tools',
  initialTab,
  periodizationOnly = false
}: ToolsSettingsProps = {}) {
  const { t, currentLanguage } = useLanguage();
  const layoutExpand = useSettingsLayoutExpand();

  // Use custom hook for data management
  const {
    periods,
    sections,
    bodyBuildingTechniques,
    sports,
    equipment,
    exercises,
    exercisePathologyCatalog,
    devices,
    iconType,
    isLoadingIconPreference,
    isSavingToDatabase,
    lastSavedTime,
    setPeriods,
    setSections,
    setBodyBuildingTechniques,
    setSports,
    setEquipment,
    setExercises,
    setExercisePathologyCatalog,
    setDevices,
    setIconType,
    setIsSavingToDatabase,
    setLastSavedTime,
    loadToolsSettingsFromDatabase,
    saveToLocalStorage,
    saveToDatabase
  } = useToolsData();
  
  const [activeTab, setActiveTab] = useState<ToolsTab>(() => {
    if (periodizationOnly) return 'periods';
    // Keep server + first client paint identical — never read localStorage here (hydration crash).
    return mode === 'technical' ? 'equipmentFactories' : 'periods';
  });
  const [myLibraryCategory, setMyLibraryCategory] = useState<string>(MY_LIBRARY_CATEGORY_BUTTONS[0]);

  useEffect(() => {
    if (activeTab !== 'exercises') {
      layoutExpand?.setContentExpanded(false);
    }
  }, [activeTab, layoutExpand]);

  const exerciseBankWorkspaceExpanded =
    Boolean(layoutExpand?.contentExpanded) && activeTab === 'exercises';

  const [editingItem, setEditingItem] = useState<Period | WorkoutSection | null>(null);
  const [editItemTranslations, setEditItemTranslations] = useState<Record<string, { title: string; description: string }>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    code: '',
    description: '',
    color: '#3b82f6',
    sports: [] as string[],
    picture: ''
  });
  const [newItemTranslations, setNewItemTranslations] = useState<Record<string, { title: string; description: string }>>({});
  const [activeInputLanguage, setActiveInputLanguage] = useState('en');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedSport, setDraggedSport] = useState<string | null>(null);
  const [dragOverSport, setDragOverSport] = useState<string | null>(null);
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const [showExerciseDialog, setShowExerciseDialog] = useState(false);
  const [showDeviceDialog, setShowDeviceDialog] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editingSport, setEditingSport] = useState<Sport | null>(null);
  const [showEditSportDialog, setShowEditSportDialog] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // Equipment view and sort state
  const [equipmentViewMode, setEquipmentViewMode] = useState<'cards' | 'table'>('cards');
  const [equipmentSortField, setEquipmentSortField] = useState<'name' | 'category' | 'company' | 'startDate'>('name');
  const [equipmentSortDirection, setEquipmentSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Language-specific defaults state
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage || 'en');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [superAdminPassword, setSuperAdminPassword] = useState('');
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [equipmentFactoriesMessage, setEquipmentFactoriesMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const { canManage: canManageMachineCompanies, refresh: refreshMachineCompaniesAccess } =
    useCanManageSportMachineCompanies(mode === 'technical');
  const [periodizationSubview, setPeriodizationSubview] =
    useState<PeriodizationSubview>(() => {
      if (typeof window === 'undefined') return 'periodSettings';
      const saved = localStorage.getItem('settings_periodization_subview');
      const valid: PeriodizationSubview[] = ['periodSettings', 'periodization', 'overview'];
      return (saved && valid.includes(saved as PeriodizationSubview))
        ? (saved as PeriodizationSubview)
        : 'periodSettings';
    });
  const allowedTabs = useMemo(() => {
    const base = getAllowedTabs(isAdmin, mode);
    return periodizationOnly ? base.filter((tab) => tab === 'periods') : base;
  }, [isAdmin, mode, periodizationOnly]);

  useEffect(() => {
    if (!periodizationOnly) return;
    setSelectedLanguage(normalizeToolsLanguage(currentLanguage));
  }, [periodizationOnly, currentLanguage]);
  const useEnglishFallbackRules =
    activeTab === 'periods' || activeTab === 'sections' || activeTab === 'bodyBuildingTechniques';

  const adminTranslationLanguages = useMemo(() => {
    if (isAdmin && activeTab === 'periods') return supportedLanguagesPeriodAdminOrder();
    return SUPPORTED_LANGUAGES;
  }, [isAdmin, activeTab]);

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [activeTab, allowedTabs]);

  useEffect(() => {
    if (periodizationOnly) return;
    if (initialTab && allowedTabs.includes(initialTab)) {
      setActiveTab(initialTab);
      return;
    }
    const key = `settings_tools_tab_${mode}`;
    const saved = localStorage.getItem(key) as ToolsTab | null;
    if (saved && allowedTabs.includes(saved)) {
      setActiveTab(saved);
    }
  }, [initialTab, allowedTabs, mode, periodizationOnly]);

  useEffect(() => {
    if (mode !== 'technical' || activeTab !== 'equipmentFactories') return;
    void refreshMachineCompaniesAccess();
  }, [mode, activeTab, refreshMachineCompaniesAccess]);

  // Persist active tab and periodization subview across refreshes
  useEffect(() => {
    if (periodizationOnly) return;
    localStorage.setItem(`settings_tools_tab_${mode}`, activeTab);
  }, [activeTab, mode, periodizationOnly]);

  useEffect(() => {
    localStorage.setItem('settings_periodization_subview', periodizationSubview);
  }, [periodizationSubview]);
  
  // Get current user ID for ownership checking
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  useEffect(() => {
    // Get user ID from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUserId(user.id || null);
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
      }
    }
    
    // Mark initial load as complete after first render
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 500); // Wait 500ms for all data to load
    
    return () => clearTimeout(timer);
  }, []);
  
  // Auto-update selected language when user's language changes
  useEffect(() => {
    if (currentLanguage) {
      setSelectedLanguage(currentLanguage);
    }
  }, [currentLanguage]);

  // For non-admin users, lock selected language to their profile language.
  useEffect(() => {
    if (isAdmin) return;
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    try {
      const parsed = JSON.parse(userStr);
      const profileLanguage = typeof parsed?.language === 'string' ? parsed.language.toLowerCase() : '';
      if (profileLanguage) {
        setSelectedLanguage(profileLanguage);
      }
    } catch (e) {
      console.error('Failed to parse user language from localStorage:', e);
    }
  }, [isAdmin, currentLanguage]);
  
  // Equipment sorting function
  const sortEquipment = (equipmentList: Equipment[]) => {
    return [...equipmentList].sort((a, b) => {
      let aValue: string | number = '';
      let bValue: string | number = '';
      
      switch (equipmentSortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'category':
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case 'company':
          aValue = (a.company || '').toLowerCase();
          bValue = (b.company || '').toLowerCase();
          break;
        case 'startDate':
          aValue = a.startDate ? new Date(a.startDate).getTime() : 0;
          bValue = b.startDate ? new Date(b.startDate).getTime() : 0;
          break;
      }
      
      if (equipmentSortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  };
  
  // Handle equipment column sort
  const handleEquipmentSort = (field: 'name' | 'category' | 'company' | 'startDate') => {
    if (equipmentSortField === field) {
      setEquipmentSortDirection(equipmentSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setEquipmentSortField(field);
      setEquipmentSortDirection('asc');
    }
  };
  
  // Data loading is now handled by useToolsData hook
  // All loading functions removed - handled by useToolsData hook

  // Manual save handler (uses hook)
  const handleManualSave = async () => {
    await saveToDatabase();
    alert('✅ All tools settings saved to database successfully!');
  };

  // Use refs to track previous values and prevent unnecessary re-renders
  const prevPeriodsRef = useRef<Period[]>([]);
  const prevSectionsRef = useRef<WorkoutSection[]>([]);
  const prevBodyBuildingTechniquesRef = useRef<BodyBuildingTechnique[]>([]);
  const prevSportsRef = useRef<Sport[]>([]);
  const prevEquipmentRef = useRef<Equipment[]>([]);
  const prevExercisesRef = useRef<Exercise[]>([]);
  const prevExercisePathologyCatalogRef = useRef<ExercisePathologyCatalogItem[]>([]);
  const prevDevicesRef = useRef<Device[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced auto-save (uses hook)
  useEffect(() => {
    // Don't auto-save during initial load
    if (isInitialLoad) {
      console.log('⏭️ Skipping auto-save: initial load in progress');
      // Update refs on initial load
      prevPeriodsRef.current = periods;
      prevSectionsRef.current = sections;
      prevBodyBuildingTechniquesRef.current = bodyBuildingTechniques;
      prevSportsRef.current = sports;
      prevEquipmentRef.current = equipment;
      prevExercisesRef.current = exercises;
      prevExercisePathologyCatalogRef.current = exercisePathologyCatalog;
      prevDevicesRef.current = devices;
      return;
    }
    
    // Don't auto-save if data is being loaded initially
    if (periods.length === 0 && sections.length === 0 && sports.length === 0) {
      return;
    }
    
    // Check if data actually changed (deep comparison by length and IDs)
    const periodsChanged = JSON.stringify(periods) !== JSON.stringify(prevPeriodsRef.current);
    const sectionsChanged = JSON.stringify(sections) !== JSON.stringify(prevSectionsRef.current);
    const techniquesChanged = JSON.stringify(bodyBuildingTechniques) !== JSON.stringify(prevBodyBuildingTechniquesRef.current);
    const sportsChanged = JSON.stringify(sports) !== JSON.stringify(prevSportsRef.current);
    const equipmentChanged = JSON.stringify(equipment) !== JSON.stringify(prevEquipmentRef.current);
    const exercisesChanged = JSON.stringify(exercises) !== JSON.stringify(prevExercisesRef.current);
    const exercisePathologyCatalogChanged =
      JSON.stringify(exercisePathologyCatalog) !== JSON.stringify(prevExercisePathologyCatalogRef.current);
    const devicesChanged = JSON.stringify(devices) !== JSON.stringify(prevDevicesRef.current);
    
    if (
      !periodsChanged &&
      !sectionsChanged &&
      !techniquesChanged &&
      !sportsChanged &&
      !equipmentChanged &&
      !exercisesChanged &&
      !exercisePathologyCatalogChanged &&
      !devicesChanged
    ) {
      console.log('⏭️ Skipping auto-save: no changes detected');
      return;
    }
    
    // Don't trigger auto-save if a save is already in progress
    if (isSavingToDatabase) {
      console.log('⏭️ Skipping auto-save: save already in progress');
      return;
    }
    
    console.log('💾 Auto-save triggered: changes detected');
    if (periodsChanged) console.log('  - Periods changed');
    if (sectionsChanged) console.log('  - Sections changed');
    if (techniquesChanged) console.log('  - Techniques changed');
    
    // Save to localStorage immediately (backup)
    saveToLocalStorage(
      periods,
      sections,
      bodyBuildingTechniques,
      sports,
      equipment,
      exercises,
      devices,
      exercisePathologyCatalog
    );
    
    // Clear any pending save timeout
    if (saveTimeoutRef.current) {
      console.log('⏱️  Cancelling previous save timeout (debouncing)');
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce database save (wait 1 second after last change)
    saveTimeoutRef.current = setTimeout(() => {
      console.log('💾 Saving to database...');
      saveToDatabase().then(() => {
        console.log('✅ Database save complete');
        saveTimeoutRef.current = null;
      }).catch((error) => {
        console.error('❌ Database save failed:', error);
        saveTimeoutRef.current = null;
      });
    }, 1000);
    
    // Update refs immediately so next change is detected
    prevPeriodsRef.current = periods;
    prevSectionsRef.current = sections;
    prevBodyBuildingTechniquesRef.current = bodyBuildingTechniques;
    prevSportsRef.current = sports;
    prevEquipmentRef.current = equipment;
    prevExercisesRef.current = exercises;
    prevExercisePathologyCatalogRef.current = exercisePathologyCatalog;
    prevDevicesRef.current = devices;
    
    // Cleanup function - only clear timeout, don't return it
    return () => {
      // Don't cancel if save is in progress, just cancel pending timeout
      if (saveTimeoutRef.current) {
        console.log('🧹 Cleanup: clearing pending save timeout');
        clearTimeout(saveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods, sections, bodyBuildingTechniques, sports, equipment, exercises, exercisePathologyCatalog, devices, isInitialLoad, isSavingToDatabase]);

  const getActiveItems = () => {
    if (activeTab === 'periods') return periods;
    if (activeTab === 'sections') return sections;
    if (activeTab === 'commonDailyActions') return sections;
    if (activeTab === 'bodyBuildingTechniques') return bodyBuildingTechniques;
    return sections;
  };

  const setActiveItems = (items: Period[] | WorkoutSection[] | BodyBuildingTechnique[]) => {
    if (activeTab === 'periods') {
      setPeriods(items as Period[]);
    } else if (activeTab === 'sections' || activeTab === 'commonDailyActions') {
      setSections(items as WorkoutSection[]);
    } else if (activeTab === 'bodyBuildingTechniques') {
      setBodyBuildingTechniques(items as BodyBuildingTechnique[]);
    }
  };

  const handleAdd = () => {
    if (isAdmin) {
      if (useEnglishFallbackRules) {
        // Periods/Sections/Execution techniques rule: English title is mandatory
        const englishTitle = newItemTranslations['en']?.title?.trim() || '';
        if (!englishTitle) {
          alert('English title is mandatory.');
          return;
        }
      } else {
        // Other tabs: at least one language title is enough
        const hasAtLeastOneTitle = Object.values(newItemTranslations).some(trans => trans.title.trim());
        if (!hasAtLeastOneTitle) {
          alert('Please enter a title in at least one language');
          return;
        }
      }

      // Validate character limits for all languages
      for (const [lang, trans] of Object.entries(newItemTranslations)) {
        if (trans.title && trans.title.length > 30) {
          alert(`Title in ${lang.toUpperCase()} must be 30 characters or less`);
          return;
        }
        if (trans.description && trans.description.length > 255) {
          alert(`Description in ${lang.toUpperCase()} must be 255 characters or less`);
          return;
        }
      }
    } else {
      // Non-Admin: Only validate current language
      if (!newItem.title || !newItem.title.trim()) {
        alert('Please enter a title');
        return;
      }
      if (newItem.title.length > 30) {
        alert('Title must be 30 characters or less');
        return;
      }
      if (newItem.description && newItem.description.length > 255) {
        alert('Description must be 255 characters or less');
        return;
      }
    }

    const items = getActiveItems();
    const newId = Date.now().toString();

    const isSuperAdminPeriods = isAdmin && activeTab === 'periods';
    const currentLangData = isAdmin
      ? (newItemTranslations[currentLanguage] || newItemTranslations['en'] || { title: '', description: '' })
      : { title: newItem.title, description: newItem.description };

    let descriptionByLanguage: Record<string, string> | undefined;
    if (isSuperAdminPeriods) {
      const m: Record<string, string> = {};
      SUPPORTED_LANGUAGES.forEach((lang) => {
        const d = (newItemTranslations[lang.code]?.description || '').trim();
        if (d) m[lang.code] = d;
      });
      descriptionByLanguage = Object.keys(m).length > 0 ? m : undefined;
    }

    const englishBlock = newItemTranslations['en'] || { title: '', description: '' };

    const newEntry = {
      id: newId,
      title: isAdmin
        ? isSuperAdminPeriods
          ? (englishBlock.title || Object.values(newItemTranslations).find((t) => t.title)?.title || '')
          : (currentLangData.title || Object.values(newItemTranslations).find((t) => t.title)?.title || '')
        : newItem.title,
      description: isSuperAdminPeriods
        ? (englishBlock.description || '').trim()
        : currentLangData.description || '',
      ...(isSuperAdminPeriods && descriptionByLanguage ? { descriptionByLanguage } : {}),
      color: newItem.color,
      order: items.length,
      isUserCreated: !isAdmin, // Tag user-created items
      ...(activeTab === 'sections' && { code: newItem.code || '' }), // Add code field for sections
      ...(activeTab === 'commonDailyActions' && {
        code: newItem.code || '',
        picture: newItem.picture || ''
      }),
      ...(activeTab === 'bodyBuildingTechniques' && { sports: newItem.sports || [] }) // Add sports field for execution techniques
    };

    // Save translations to localStorage
    const itemType = activeTab === 'periods' ? 'periods' : 'sections';
    
    if (isAdmin) {
      // Admin: Save for all languages
      SUPPORTED_LANGUAGES.forEach(lang => {
        const langData = newItemTranslations[lang.code];
        if (langData && (langData.title || langData.description)) {
          // Load existing language library
          const storageKey = `tools_${itemType}_${lang.code}`;
          const existingDataStr = localStorage.getItem(storageKey);
          const existingData = existingDataStr ? JSON.parse(existingDataStr) : [];
          
          // Add new item with translations
          const langEntry = {
            id: newId,
            title: langData.title || '',
            description: langData.description || '',
            color: newItem.color,
            order: items.length,
            isUserCreated: false,
            ...(activeTab === 'commonDailyActions' && {
              code: newItem.code || '',
              picture: newItem.picture || ''
            }),
          };
          
          existingData.push(langEntry);
          localStorage.setItem(storageKey, JSON.stringify(existingData));
        }
      });
    } else {
      // Non-Admin: Only save for current language
      const storageKey = `tools_${itemType}_${selectedLanguage}`;
      const existingDataStr = localStorage.getItem(storageKey);
      const existingData = existingDataStr ? JSON.parse(existingDataStr) : [];
      
      const langEntry = {
        id: newId,
        title: newItem.title,
        description: newItem.description,
        color: newItem.color,
        order: items.length,
        isUserCreated: true,
        ...(activeTab === 'commonDailyActions' && {
          code: newItem.code || '',
          picture: newItem.picture || ''
        }),
      };
      
      existingData.push(langEntry);
      localStorage.setItem(storageKey, JSON.stringify(existingData));
    }

    setActiveItems([...items, newEntry]);
    setNewItem({ title: '', code: '', description: '', color: '#3b82f6', sports: [] as string[], picture: '' });
    setNewItemTranslations({});
    setActiveInputLanguage('en');
    setShowAddDialog(false);
  };

  const handleEdit = (item: Period | WorkoutSection) => {
    // Check if user owns this item
    if (currentUserId && item.userId && item.userId !== currentUserId) {
      alert('⚠️ You cannot edit this item because it was not created by you.\n\nOnly items you created can be edited.');
      return;
    }
    
    setEditingItem({ ...item });

    const skipLocalStorageForPeriodAdmin = activeTab === 'periods' && isAdmin;

    const translations: Record<string, { title: string; description: string }> = {};

    SUPPORTED_LANGUAGES.forEach((lang) => {
      if (useEnglishFallbackRules) {
        const periodItem = item as Period;
        const byLang = periodItem.descriptionByLanguage;
        const descForLang =
          activeTab === 'periods' && isAdmin
            ? (byLang?.[lang.code]?.trim()
                ? (byLang[lang.code] as string)
                : lang.code === 'en'
                  ? (item.description || '')
                  : '')
            : lang.code === 'en'
              ? (item.description || '')
              : '';
        translations[lang.code] = {
          title: lang.code === 'en' ? (item.title || '') : '',
          description: descForLang
        };
      } else {
        translations[lang.code] = {
          title: item.title || '',
          description: item.description || ''
        };
      }

      if (skipLocalStorageForPeriodAdmin) return;

      const itemType = activeTab === 'periods' ? 'periods' : 'sections';
      const storageKey = `tools_${itemType}_${lang.code}`;
      const existingDataStr = localStorage.getItem(storageKey);
      if (existingDataStr) {
        try {
          const existingData = JSON.parse(existingDataStr);
          const existingItem = existingData.find((i: any) => i.id === item.id);
          if (existingItem) {
            translations[lang.code] = {
              title: existingItem.title || item.title || '',
              description: existingItem.description || item.description || ''
            };
          }
        } catch (e) {
          console.error(`Error loading ${lang.code} translation:`, e);
        }
      }
    });

    setEditItemTranslations(translations);
    if (isAdmin && activeTab === 'periods') setActiveInputLanguage('en');
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;

    if (isAdmin) {
      if (useEnglishFallbackRules) {
        // Periods/Sections/Execution techniques rule: English title is mandatory
        const hasEnglish = editItemTranslations['en']?.title && editItemTranslations['en'].title.trim() !== '';
        if (!hasEnglish) {
          alert('English title is mandatory.');
          return;
        }
      } else {
        // Other tabs: at least English or Italian
        const hasEnglish = editItemTranslations['en']?.title && editItemTranslations['en'].title.trim() !== '';
        const hasItalian = editItemTranslations['it']?.title && editItemTranslations['it'].title.trim() !== '';
        if (!hasEnglish && !hasItalian) {
          alert('❌ MANDATORY: At least English or Italian translation is required!\n\nPlease fill in the title for:\n• English (EN) OR\n• Italian (IT)\n\nOne of these two languages must be filled.');
          return;
        }
      }

      // Validate all language translations
      for (const [lang, trans] of Object.entries(editItemTranslations)) {
        if (trans.title && trans.title.length > 30) {
          alert(`Title in ${lang.toUpperCase()} must be 30 characters or less`);
          return;
        }
        if (trans.description && trans.description.length > 255) {
          alert(`Description in ${lang.toUpperCase()} must be 255 characters or less`);
          return;
        }
      }

      if (activeTab === 'periods') {
        const enT = editItemTranslations['en'];
        editingItem.title = (enT?.title?.trim() || editingItem.title || '').trim();
        editingItem.description = (enT?.description || '').trim();
        const descByLang: Record<string, string> = {};
        SUPPORTED_LANGUAGES.forEach((lang) => {
          const d = (editItemTranslations[lang.code]?.description || '').trim();
          if (d) descByLang[lang.code] = d;
        });
        (editingItem as Period).descriptionByLanguage =
          Object.keys(descByLang).length > 0 ? descByLang : undefined;
      } else {
        const currentLangData =
          editItemTranslations[currentLanguage] ||
          editItemTranslations['en'] ||
          Object.values(editItemTranslations)[0];
        if (currentLangData) {
          editingItem.title = currentLangData.title || editingItem.title;
          editingItem.description = currentLangData.description || editingItem.description;
        }
      }
    } else {
      // Non-Admin: Validate current language only
      if (!editingItem.title || !editingItem.title.trim()) {
        alert('Please enter a title');
        return;
      }
      if (editingItem.title.length > 30) {
        alert('Title must be 30 characters or less');
        return;
      }
      if (editingItem.description && editingItem.description.length > 255) {
        alert('Description must be 255 characters or less');
        return;
      }
    }

    console.log('💾 Saving edited item:', {
      id: editingItem.id,
      title: editingItem.title,
      description: editingItem.description,
      currentLanguage,
      translationsKeys: Object.keys(editItemTranslations)
    });

    // Update in current state - Force new array reference for React to detect changes
    const items = getActiveItems();
    const updated = [...items].map(item => 
      item.id === editingItem.id ? { ...editingItem } : item
    );
    setActiveItems(updated);
    
    console.log('✅ State updated with:', updated);
    
    // Save to language libraries
    const itemType = activeTab === 'periods' ? 'periods' : 'sections';
    
    if (isAdmin) {
      // Admin: Save to all language libraries
      SUPPORTED_LANGUAGES.forEach(lang => {
        const langData = editItemTranslations[lang.code];
        if (langData && (langData.title || langData.description)) {
          const storageKey = `tools_${itemType}_${lang.code}`;
          const existingDataStr = localStorage.getItem(storageKey);
          const existingData = existingDataStr ? JSON.parse(existingDataStr) : [];
          
          // Find and update the item
          const itemIndex = existingData.findIndex((i: any) => i.id === editingItem.id);
          if (itemIndex >= 0) {
            existingData[itemIndex] = {
              ...existingData[itemIndex],
              title: langData.title || '',
              description: langData.description || '',
              color: editingItem.color,
              ...(activeTab === 'sections' && { code: (editingItem as any).code || '' }),
              ...(activeTab === 'commonDailyActions' && {
                code: (editingItem as any).code || '',
                picture: (editingItem as any).picture || ''
              })
            };
          } else {
            // Add if doesn't exist
            existingData.push({
              id: editingItem.id,
              title: langData.title || '',
              description: langData.description || '',
              color: editingItem.color,
              order: existingData.length,
            ...(activeTab === 'sections' && { code: (editingItem as any).code || '' }),
            ...(activeTab === 'commonDailyActions' && {
              code: (editingItem as any).code || '',
              picture: (editingItem as any).picture || ''
            })
          });
        }
        
        localStorage.setItem(storageKey, JSON.stringify(existingData));
        }
      });
    } else {
      // Non-Admin: Only save to current language
      const storageKey = `tools_${itemType}_${selectedLanguage}`;
      const existingDataStr = localStorage.getItem(storageKey);
      const existingData = existingDataStr ? JSON.parse(existingDataStr) : [];
      
      const itemIndex = existingData.findIndex((i: any) => i.id === editingItem.id);
      if (itemIndex >= 0) {
        existingData[itemIndex] = {
          ...existingData[itemIndex],
          title: editingItem.title,
          description: editingItem.description,
          color: editingItem.color,
          ...(activeTab === 'sections' && { code: (editingItem as any).code || '' }),
          ...(activeTab === 'commonDailyActions' && {
            code: (editingItem as any).code || '',
            picture: (editingItem as any).picture || ''
          })
        };
      } else {
        // Add if doesn't exist
        existingData.push({
          id: editingItem.id,
          title: editingItem.title,
          description: editingItem.description,
          color: editingItem.color,
          order: existingData.length,
          isUserCreated: true,
          ...(activeTab === 'sections' && { code: (editingItem as any).code || '' }),
          ...(activeTab === 'commonDailyActions' && {
            code: (editingItem as any).code || '',
            picture: (editingItem as any).picture || ''
          })
        });
      }
      
      localStorage.setItem(storageKey, JSON.stringify(existingData));
    }
    
    setEditingItem(null);
    setEditItemTranslations({});
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this item?')) return;
    
    const items = getActiveItems();
    const updated = items.filter(item => item.id !== id);
    setActiveItems(updated);
  };

  const handleSortAZ = () => {
    const items = getActiveItems();
    const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));
    setActiveItems(sorted.map((item, index) => ({ ...item, order: index })));
  };

  const handleSortZA = () => {
    const items = getActiveItems();
    const sorted = [...items].sort((a, b) => b.title.localeCompare(a.title));
    setActiveItems(sorted.map((item, index) => ({ ...item, order: index })));
  };

  const handleDragStart = (id: string) => {
    setDraggedItem(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === id) return;

    const items = getActiveItems();
    const draggedIndex = items.findIndex(item => item.id === draggedItem);
    const targetIndex = items.findIndex(item => item.id === id);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newItems = [...items];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, removed);

    setActiveItems(newItems.map((item, index) => ({ ...item, order: index })));
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedItem(null);
  };

  // Language-specific defaults handlers
  const saveLanguageDefaults = async () => {
    setShowPasswordDialog(true);
  };

  const loadLanguageDefaults = async () => {
    setShowLoadDialog(true);
  };

  const handlePasswordSubmit = async () => {
    if (!superAdminPassword.trim()) {
      alert(`❌ Please enter ${isAdmin ? 'Super Admin' : 'your'} password`);
      return;
    }

    try {
      // Verify password first
      const token = localStorage.getItem('token');
      console.log('🔐 Token from localStorage:', token ? 'Present' : 'Missing');
      
      const verifyEndpoint = isAdmin 
        ? '/api/admin/super-admin/verify' 
        : '/api/user/verify-password';
      
      console.log('🔐 Using endpoint:', verifyEndpoint);
      console.log('🔐 Is admin mode:', isAdmin);
      
      const verifyHeaders: HeadersInit = { 'Content-Type': 'application/json' };
      if (!isAdmin && token) {
        verifyHeaders['Authorization'] = `Bearer ${token}`;
      }
      
      console.log('🔐 Request headers:', verifyHeaders);
      
      const verifyResponse = await fetch(verifyEndpoint, {
        method: 'POST',
        headers: verifyHeaders,
        body: JSON.stringify({ password: superAdminPassword })
      });

      console.log('🔐 Verify response status:', verifyResponse.status);
      const verifyData = await verifyResponse.json();
      console.log('🔐 Verify response data:', verifyData);
      
      if (!verifyData.valid) {
        alert(`❌ Invalid password`);
        return;
      }

      const toolsData = {
        periods,
        sections,
        sports,
        equipment,
        exercises,
        devices
      };

      if (isAdmin) {
        // Admin mode: Save as language defaults
        const response = await fetch('/api/admin/tools-defaults/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: selectedLanguage,
            toolsData,
            password: superAdminPassword
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          const languageName = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name || selectedLanguage;
          alert(`✅ Success! ALL settings saved as ${languageName.toUpperCase()} defaults!\n\n📋 Saved to ${languageName.toUpperCase()}:\n✓ Periods, Sections, Sports\n✓ Equipment, Exercises, Library, Devices\n\n👥 These settings are now available for ${languageName}-speaking users when they click "Load Admin Defaults" button.`);
          setShowPasswordDialog(false);
          setSuperAdminPassword('');
        } else {
          console.error('❌ Save failed:', data);
          alert(`❌ ${data.error || 'Failed to save defaults'}\n\nDetails: ${data.details || 'No additional details'}`);
        }
      } else {
        // Personal mode: Save to user's personal settings
        if (!token) {
          alert('❌ Please login to save settings');
          return;
        }

        const response = await fetch('/api/user/settings/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            toolsSettings: toolsData
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          alert('✅ Personal settings saved successfully!');
          setShowPasswordDialog(false);
          setSuperAdminPassword('');
        } else {
          console.error('❌ Save failed:', data);
          alert(`❌ ${data.error || 'Failed to save settings'}\n\nDetails: ${data.details || 'No additional details'}`);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error saving settings');
    }
  };

  // Auto-load language terms when language is selected
  const loadLanguageTerms = async (languageCode: string) => {
    try {
      console.log('🌍 Loading terms for language:', languageCode);

      // First, apply locally saved language libraries (instant switch in UI)
      const periodsKey = `tools_periods_${languageCode}`;
      const sectionsKey = `tools_sections_${languageCode}`;

      const periodsFromStorage = localStorage.getItem(periodsKey);
      if (periodsFromStorage) {
        try {
          const parsed = JSON.parse(periodsFromStorage);
          if (Array.isArray(parsed)) {
            setPeriods([...parsed]);
          }
        } catch (e) {
          console.error('Error parsing periods language library:', e);
        }
      }

      const sectionsFromStorage = localStorage.getItem(sectionsKey);
      if (sectionsFromStorage) {
        try {
          const parsed = JSON.parse(sectionsFromStorage);
          if (Array.isArray(parsed)) {
            setSections([...parsed]);
            console.log(`✅ Loaded sections from localStorage (${languageCode})`);
          }
        } catch (e) {
          console.error('Error parsing sections language library:', e);
        }
      }

      const response = await fetch(`/api/admin/tools-defaults/load?language=${languageCode}`);
      const data = await response.json();

      if (response.ok && data.toolsData) {
        // Load and force re-render with new array references
        if (data.toolsData.periods) {
          setPeriods([...data.toolsData.periods]);
        }
        if (data.toolsData.sections) {
          setSections([...data.toolsData.sections]);
        }
        if (data.toolsData.sports) {
          setSports([...data.toolsData.sports]);
        }
        if (data.toolsData.equipment) {
          setEquipment([...data.toolsData.equipment]);
        }
        if (data.toolsData.exercises) {
          setExercises([...data.toolsData.exercises]);
        }
        if (data.toolsData.devices) {
          setDevices([...data.toolsData.devices]);
        }
      } else {
      }
    } catch (error) {
    }
  };

  // Handle Load from Movesbook (for non-admin users)
  const handleLoadAdminDefaults = async () => {
    const languageName = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name || selectedLanguage;
    
    const confirmed = window.confirm(
      "Do you want to continue?"
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch(`/api/admin/tools-defaults/load?language=${selectedLanguage}`);
      const data = await response.json();

      if (response.ok && data.toolsData) {
        // Get current user-created items (items with isUserCreated flag)
        const userPeriods = periods.filter((p: any) => p.isUserCreated);
        const userSections = sections.filter((s: any) => s.isUserCreated);
        const userEquipment = equipment.filter((e: any) => e.isUserCreated);
        const userExercises = exercises.filter((ex: any) => ex.isUserCreated);
        const userDevices = devices.filter((d: any) => d.isUserCreated);
        
        // Load admin defaults and merge with user-created items
        if (data.toolsData.periods) {
          setPeriods([...data.toolsData.periods, ...userPeriods]);
        }
        if (data.toolsData.sections) {
          setSections([...data.toolsData.sections, ...userSections]);
        }
        if (data.toolsData.sports) {
          setSports([...data.toolsData.sports]); // Sports are read-only for users
        }
        if (data.toolsData.equipment) {
          setEquipment([...data.toolsData.equipment, ...userEquipment]);
        }
        if (data.toolsData.exercises) {
          setExercises([...data.toolsData.exercises, ...userExercises]);
        }
        if (data.toolsData.devices) {
          setDevices([...data.toolsData.devices, ...userDevices]);
        }
        
        alert(`✅ Success!\n\nMovesbook settings for ${languageName} have been loaded and added to your current list.\n\nYour manually created items are preserved.`);
      } else {
        alert(`❌ No admin defaults found for ${languageName}`);
      }
    } catch (error) {
      alert('❌ Error loading admin defaults. Please try again.');
    }
  };

  const getDisplayTitle = (item: any): { text: string; isRed: boolean } => {
    if (item.title && item.title.trim() !== '') {
      return { text: item.title, isRed: false };
    }
    
    const storageKeyEn = activeTab === 'periods' ? 'tools_periods_en' : (activeTab === 'sections' || activeTab === 'commonDailyActions') ? 'tools_sections_en' : null;
    if (storageKeyEn) {
      const enData = localStorage.getItem(storageKeyEn);
      if (enData) {
        try {
          const parsed = JSON.parse(enData);
          const enItem = parsed.find((i: any) => i.id === item.id);
          if (enItem && enItem.title && enItem.title.trim() !== '') {
            return { text: enItem.title, isRed: true };
          }
        } catch (e) {}
      }
    }
    
    const storageKeyIt = activeTab === 'periods' ? 'tools_periods_it' : (activeTab === 'sections' || activeTab === 'commonDailyActions') ? 'tools_sections_it' : null;
    if (storageKeyIt) {
      const itData = localStorage.getItem(storageKeyIt);
      if (itData) {
        try {
          const parsed = JSON.parse(itData);
          const itItem = parsed.find((i: any) => i.id === item.id);
          if (itItem && itItem.title && itItem.title.trim() !== '') {
            return { text: itItem.title, isRed: true };
          }
        } catch (e) {}
      }
    }
    
    return { text: item.title || 'Untitled', isRed: false };
  };

  const handleLoadConfirm = async () => {
    try {
      const response = await fetch(`/api/admin/tools-defaults/load?language=${selectedLanguage}`);
      const data = await response.json();

      if (response.ok && data.toolsData) {
        const languageName = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name;
        
        if (data.toolsData.periods) {
          const loadedPeriods = [...data.toolsData.periods];
          const existingPeriods = [...periods];
          
          const mergedPeriods = existingPeriods.map(existing => {
            const matchingLoaded = loadedPeriods.find(loaded => 
              loaded.title?.toLowerCase() === existing.title?.toLowerCase()
            );
            
            if (matchingLoaded) {
              return {
                ...matchingLoaded,
                id: existing.id
              };
            }
            
            return existing;
          });
          
          loadedPeriods.forEach(loaded => {
            const alreadyExists = mergedPeriods.some(merged => 
              merged.title?.toLowerCase() === loaded.title?.toLowerCase()
            );
            if (!alreadyExists) {
              mergedPeriods.push(loaded);
            }
          });
          
          setPeriods(mergedPeriods);
          
          const storageKey = `tools_periods_${selectedLanguage}`;
          localStorage.setItem(storageKey, JSON.stringify(mergedPeriods));
        }
        if (data.toolsData.sections) {
          const loadedSections = [...data.toolsData.sections];
          const existingSections = [...sections];
          
          const mergedSections = existingSections.map(existing => {
            const matchingLoaded = loadedSections.find(loaded => 
              loaded.title?.toLowerCase() === existing.title?.toLowerCase()
            );
            
            if (matchingLoaded) {
              return {
                ...matchingLoaded,
                id: existing.id
              };
            }
            
            return existing;
          });
          
          loadedSections.forEach(loaded => {
            const alreadyExists = mergedSections.some(merged => 
              merged.title?.toLowerCase() === loaded.title?.toLowerCase()
            );
            if (!alreadyExists) {
              mergedSections.push(loaded);
            }
          });
          
          setSections(mergedSections);
          
          const storageKey = `tools_sections_${selectedLanguage}`;
          localStorage.setItem(storageKey, JSON.stringify(mergedSections));
        }
        if (data.toolsData.sports) {
          const loadedSports = [...data.toolsData.sports];
          setSports(loadedSports);
        }
        if (data.toolsData.equipment) {
          setEquipment([...data.toolsData.equipment]);
        }
        if (data.toolsData.exercises) {
          setExercises([...data.toolsData.exercises]);
        }
        if (data.toolsData.devices) {
          setDevices([...data.toolsData.devices]);
        }
        
        // Force a re-render by toggling a state
        setTimeout(() => {
          console.log('🔄 Data loaded and state updated');
        }, 100);
        
        alert(`✅ ${languageName} default settings loaded successfully!\n\n📋 All settings loaded (ALL TABS):\n• Periods (${data.toolsData.periods?.length || 0} items)\n• Sections (${data.toolsData.sections?.length || 0} items)\n• Sports\n• Equipment, Exercises, Library, Devices\n\n📝 Next Steps:\n1. Navigate to ANY tab and edit/translate items\n2. Select target language from dropdown (e.g., Russian)\n3. Click "Save to [Language]" to save ALL tabs\n\n💡 Example: Load Spanish → Edit Sports/Periods → Select Russian → Save to RU`);
        setShowLoadDialog(false);
      } else {
        const languageName = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name;
        alert(`ℹ️ No default settings found for ${languageName}.\n\nPlease create defaults for this language by:\n1. Loading English defaults if available\n2. Translating the items\n3. Saving them as ${languageName} defaults`);
        setShowLoadDialog(false);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error loading defaults');
    }
  };

  // Sports-specific handlers
  const handleSportDragStart = (id: string) => {
    console.log('🎯 Drag start:', id);
    setDraggedSport(id);
  };

  const handleSportDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSport(id);
  };

  const handleSportDragEnd = () => {
    console.log('✅ Sport drag ended');
    setDraggedSport(null);
    setDragOverSport(null);
  };

  // Use DEFAULT_SPORTS as fallback if sports array is empty
  const activeSports = (sports && sports.length > 0) ? sports : DEFAULT_SPORTS;

  const handleSportDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedSport || draggedSport === targetId) {
      setDraggedSport(null);
      setDragOverSport(null);
      return;
    }

    console.log('📦 Dropping sport:', draggedSport, 'onto:', targetId);

    // IMPORTANT: Work with the actual sports state, not activeSports
    // If sports is empty, we need to first initialize it with DEFAULT_SPORTS
    const sportsToUse = (sports && sports.length > 0) ? sports : DEFAULT_SPORTS;
    console.log('🔍 Using sports array:', sportsToUse.length, 'sports');
    
    const draggedIndex = sportsToUse.findIndex(sport => sport.id === draggedSport);
    const targetIndex = sportsToUse.findIndex(sport => sport.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      console.error('❌ Sport not found in array. Dragged:', draggedSport, 'Target:', targetId);
      console.error('Available sport IDs:', sportsToUse.map(s => s.id));
      setDraggedSport(null);
      setDragOverSport(null);
      return;
    }

    const newSports = [...sportsToUse];
    const [removed] = newSports.splice(draggedIndex, 1);
    newSports.splice(targetIndex, 0, removed);

    // Update top5 status and order based on new positions
    const updated = newSports.map((sport, index) => ({
      ...sport,
      order: index,
      isTop5: index < 5
    }));

    console.log('💾 Updating sports order:', updated.map(s => s.name));
    console.log('✅ Setting sports state - this should trigger auto-save');
    setSports(updated);
    setDraggedSport(null);
    setDragOverSport(null);
  };
  const top5Sports = activeSports.filter(s => s.isTop5).sort((a, b) => a.order - b.order);
  const otherSports = activeSports.filter(s => !s.isTop5).sort((a, b) => a.order - b.order);

  // Handle icon type change
  const handleIconTypeChange = async (newType: IconType) => {
    setIconType(newType);
    
    // Save to user settings
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sportIconType: newType })
      });
    } catch (error) {
      console.error('Error saving icon type preference:', error);
    }
  };

  // Map sport names to icon filenames
  const getSportIconFilename = (sportName: string): string => {
    const iconMap: Record<string, string> = {
      'Swimming': 'swimming.jpg',
      'Running': 'running.jpg',
      'Cycling': 'cycling.jpg',
      'Weightlifting': 'weights.jpg',
      'Football/Soccer': 'Technical/soccer.jpg',
      'Basketball': 'Technical/basketball.jpg',
      'Tennis': 'Technical/tennis.jpg',
      'Volleyball': 'volley.jpg',
      'Boxing': 'boxe.jpg',
      'Martial Arts': 'Technical/martial_arts.jpg',
      'Rowing': 'rowing.jpg',
      'Yoga': 'yoga.jpg',
      'Gymnastics': 'gymnastics.jpg',
      'Skiing': 'skiing.jpg',
      'Surfing': 'surfing.jpg',
      'Golf': 'golf.jpg',
      'Baseball': 'Technical/baseball.jpg',
      'Ice Hockey': 'ice_hockey.jpg',
      'Rugby': 'Technical/rugby.jpg',
      'Climbing': 'climbing.jpg',
    };
    return iconMap[sportName] || 'running.jpg';
  };

  // Render sport icon based on type
  const renderSportIcon = (sport: Sport) => {
    if (iconType === 'emoji') {
      return <div className="w-8 h-8 flex items-center justify-center text-2xl flex-shrink-0">{sport.icon}</div>;
    } else {
      return (
        <Image 
          src={`/icons/${getSportIconFilename(sport.name)}`} 
          alt={sport.name}
          width={32}
          height={32}
          className="w-8 h-8 object-cover rounded flex-shrink-0"
        />
      );
    }
  };

  return (
    <div className="space-y-6">
      {periodizationOnly && (
        <div className="flex gap-1 sm:gap-2 border-b border-gray-200 dark:border-gray-600 overflow-x-auto pb-0">
          {(['periodSettings', 'periodization', 'overview'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriodizationSubview(key)}
              className={`px-4 sm:px-6 py-3 font-semibold transition whitespace-nowrap ${
                periodizationSubview === key
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {key === 'periodSettings' && t('settings_periodization_tab_period_settings')}
              {key === 'periodization' && t('settings_periodization_tab_periodization')}
              {key === 'overview' && t('settings_periodization_tab_overview')}
            </button>
          ))}
        </div>
      )}

      {/* Header (Tools / Technical only — Periodization uses sidebar title + sub-tabs) */}
      {!periodizationOnly && !exerciseBankWorkspaceExpanded && (
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {mode === 'technical' ? 'Technical Settings' : 'Tools Settings'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {mode === 'technical'
              ? 'Manage factories, muscles, equipment, exercises, libraries, and devices'
              : 'Manage your workout periods, sections, sports, and equipment'}
          </p>
          {!isAdmin && mode === 'tools' && (
            <p className="mt-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2.5 py-1.5 inline-block">
              Admin creates language defaults. Choose your display language and load that template as your personal starting point.
            </p>
          )}
        </div>
      )}

      {/* Tabs */}
      {allowedTabs.length > 1 && !exerciseBankWorkspaceExpanded && (
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-600">
        {allowedTabs.includes('periods') && (
          <button
            onClick={() => setActiveTab('periods')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'periods'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Periods
          </button>
        )}
        {allowedTabs.includes('sections') && (
          <button
            onClick={() => setActiveTab('sections')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'sections'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Workout Sections
          </button>
        )}
        {allowedTabs.includes('bodyBuildingTechniques') && (
          <button
            onClick={() => setActiveTab('bodyBuildingTechniques')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'bodyBuildingTechniques'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Execution Techniques
          </button>
        )}
        {allowedTabs.includes('commonDailyActions') && (
          <button
            onClick={() => setActiveTab('commonDailyActions')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'commonDailyActions'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Common daily actions
          </button>
        )}
        {allowedTabs.includes('equipment') && (
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'equipment'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Personal Equipment
          </button>
        )}
        {allowedTabs.includes('equipmentFactories') && (
          <button
            onClick={() => setActiveTab('equipmentFactories')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'equipmentFactories'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sports Equipment Factories
          </button>
        )}
        {allowedTabs.includes('muscles') && (
          <button
            onClick={() => setActiveTab('muscles')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'muscles'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Muscles Settings
          </button>
        )}
        {allowedTabs.includes('sportsEquipment') && (
          <button
            onClick={() => setActiveTab('sportsEquipment')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'sportsEquipment'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sports Equipment
          </button>
        )}
        {allowedTabs.includes('sportMachines') && (
          <button
            onClick={() => setActiveTab('sportMachines')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'sportMachines'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Machines
          </button>
        )}
        {allowedTabs.includes('exercises') && (
          <button
            onClick={() => setActiveTab('exercises')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'exercises'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Exercise Bank
          </button>
        )}
        {allowedTabs.includes('pathologies') && (
          <button
            onClick={() => setActiveTab('pathologies')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'pathologies'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pathologies
          </button>
        )}
        {allowedTabs.includes('myLibrary') && (
          <button
            onClick={() => setActiveTab('myLibrary')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'myLibrary'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex flex-col items-center leading-tight">
              <span>My Library of Exercises</span>
            </span>
          </button>
        )}
        {allowedTabs.includes('insertActions') && (
          <button
            onClick={() => setActiveTab('insertActions')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'insertActions'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Action settings
          </button>
        )}
        {allowedTabs.includes('sportDropdownParameters') && (
          <button
            onClick={() => setActiveTab('sportDropdownParameters')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'sportDropdownParameters'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Dropdown parameters for sport
          </button>
        )}
        {allowedTabs.includes('devices') && (
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'devices'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex flex-col items-center leading-tight">
              <span>Device Enabled</span>
            </span>
          </button>
        )}
      </div>
      )}

      {/* Language selector + load (hidden in Periodization — language follows profile) */}
      {!periodizationOnly && activeTab !== 'sportDropdownParameters' && (
      <div className="grid grid-cols-1 gap-3">

        {activeTab === 'myLibrary' && (
          <div className="w-full rounded border border-gray-300 bg-white px-2.5 py-2">
            <div className="flex w-full flex-nowrap items-center gap-2">
              {MY_LIBRARY_CATEGORY_BUTTONS.map((label) => {
                const isActive = myLibraryCategory === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setMyLibraryCategory(label)}
                    className={`flex h-8 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-[3px] border px-2 text-[13px] leading-5 text-black ${
                      isActive
                        ? 'border-[#5f6658] bg-[#e6f5cc]'
                        : 'border-[#7a8172] bg-[#F4FEE5] hover:bg-[#eef9db]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Instructions Banner - HIDDEN (code preserved for future use) */}
        <div className="hidden bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
          <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {isAdmin ? 'Multi-Language Settings Workflow (Admin)' : 'Personal Settings Workflow'}
          </h4>
          {isAdmin ? (
            <>
              <ol className="text-sm text-indigo-800 space-y-1 ml-6 list-decimal">
                <li><strong>Select Language:</strong> Choose a language from the dropdown - terms load automatically</li>
                <li><strong>Add/Edit:</strong> When adding or editing items, fill translations in ALL languages you want</li>
                <li><strong>Required:</strong> ⚠️ At least <span className="font-bold text-red-600">English OR Italian</span> must be filled (mandatory)</li>
                <li><strong>Missing Translations:</strong> Items without translation in selected language appear in <span className="font-bold text-red-600">RED</span> (English/Italian fallback)</li>
              </ol>
              <p className="text-xs text-indigo-600 mt-2 italic">
                <strong>💡 Example:</strong> Add "Special Period" with EN/FR/IT → Select RU → Item appears in RED (needs Russian translation)
              </p>
            </>
          ) : (
            <>
              <ol className="text-sm text-indigo-800 space-y-1 ml-6 list-decimal">
                <li><strong>Select Language:</strong> Choose your language - terms load automatically</li>
                <li><strong>Load Defaults:</strong> Click "Load Admin Defaults" to get Movesbook's settings in your language</li>
                <li><strong>Add/Edit:</strong> Create or edit items in your language - they're automatically saved</li>
                <li><strong>Your Items:</strong> Items you create manually are preserved when loading admin defaults</li>
              </ol>
              <p className="text-xs text-indigo-600 mt-2 italic">
                <strong>💡 Tip:</strong> All settings are automatically available in your workout panels - no save button needed!
              </p>
            </>
          )}
          <p className="text-xs text-purple-600 mt-2 font-semibold">
            This applies to: Periods, Sections, {isAdmin ? 'Sports, ' : ''}Equipment, Exercises, Library, Devices
          </p>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-4 p-4 bg-white border-2 border-indigo-300 rounded-lg shadow-sm">
          <Globe className="w-5 h-5 text-indigo-500" />
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 mb-1">{isAdmin ? 'Display Language:' : ''}</span>
            <select
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                // Auto-load terms for selected language
                loadLanguageTerms(e.target.value);
              }}
              disabled={!isAdmin}
              className="px-3 py-2 text-sm font-medium border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name} ({lang.code.toUpperCase()})</option>
              ))}
            </select>
          </div>
          
          {/* For non-admin: Show Load from Movesbook button */}
          {!isAdmin && (
            <button
              onClick={handleLoadAdminDefaults}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md font-medium"
              title="Load period settings from Movesbook in your language"
            >
              <Download className="w-4 h-4" />
              Load from Movesbook
            </button>
          )}

        </div>
      </div>
      )}

      {periodizationOnly && periodizationSubview === 'periodSettings' && (
        <div className="flex flex-wrap justify-end gap-2 items-center">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => loadLanguageDefaults()}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg text-white bg-violet-600 hover:bg-violet-700 shadow-md transition"
                title="Load admin period/tools defaults in your profile language"
              >
                <Download className="w-4 h-4" />
                Load from Movesbook
              </button>
              <button
                type="button"
                onClick={() => saveLanguageDefaults()}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg text-white bg-orange-500 hover:bg-orange-600 shadow-md transition"
                title="Save current tools as language defaults (super admin)"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleLoadAdminDefaults}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg text-white bg-violet-600 hover:bg-violet-700 shadow-md transition"
                title="Load period settings from Movesbook in your profile language only"
              >
                <Download className="w-4 h-4" />
                Load from Movesbook
              </button>
              <button
                type="button"
                onClick={() => void handleManualSave()}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg text-white bg-orange-500 hover:bg-orange-600 shadow-md transition"
                title="Save your personal period settings"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </>
          )}
        </div>
      )}

      {periodizationOnly && periodizationSubview === 'periodization' && (
        <PeriodizationTabPanel periods={periods} />
      )}

      {periodizationOnly && periodizationSubview === 'overview' && (
        <PeriodizationOverviewPanel periods={periods} />
      )}

      {/* Periods, Sections & Execution Techniques Tab Content */}
      {((!periodizationOnly &&
        (activeTab === 'periods' ||
          activeTab === 'sections' ||
          activeTab === 'commonDailyActions' ||
          activeTab === 'bodyBuildingTechniques')) ||
        (periodizationOnly && periodizationSubview === 'periodSettings')) && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (isAdmin && activeTab === 'periods') setActiveInputLanguage('en');
                  setShowAddDialog(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Add New
              </button>
              <button
                onClick={handleSortAZ}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <ArrowUpAZ className="w-4 h-4" />
                A-Z
              </button>
              <button
                onClick={handleSortZA}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <ArrowDownZA className="w-4 h-4" />
                Z-A
              </button>
            </div>
            <div className="text-sm text-gray-600">
              Drag to reorder • {getActiveItems().length} items
            </div>
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getActiveItems().map((item) => (
              <div
                key={item.id}
                draggable={true}
                onDragStart={() => handleDragStart(item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                className={`bg-white rounded-xl border-2 p-4 cursor-move transition ${
                  draggedItem === item.id 
                    ? 'opacity-50 border-blue-500' 
                    : currentUserId && item.userId && item.userId !== currentUserId
                      ? 'border-gray-300 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                  
                  <div className="flex-1 min-w-0">
                    {activeTab === 'commonDailyActions' && (item as any).picture && (
                      <div className="mb-2">
                        <Image
                          src={(item as any).picture}
                          alt={item.title}
                          width={48}
                          height={48}
                          className="w-12 h-12 object-cover rounded border border-gray-200"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <h3 className={`font-semibold truncate ${getDisplayTitle(item).isRed ? 'text-red-600' : 'text-gray-900'}`}>
                        {getDisplayTitle(item).text}
                      </h3>
                      {currentUserId && item.userId && item.userId !== currentUserId && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full flex-shrink-0">
                          Read-only
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(item)}
                      disabled={!!(currentUserId && item.userId && item.userId !== currentUserId)}
                      className={`p-2 rounded-lg transition ${
                        currentUserId && item.userId && item.userId !== currentUserId
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-blue-600 hover:bg-blue-50'
                      }`}
                      title={currentUserId && item.userId && item.userId !== currentUserId ? 'Cannot edit - not created by you' : 'Edit'}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={!!(currentUserId && item.userId && item.userId !== currentUserId)}
                      className={`p-2 rounded-lg transition ${
                        currentUserId && item.userId && item.userId !== currentUserId
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                      title={currentUserId && item.userId && item.userId !== currentUserId ? 'Cannot delete - not created by you' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {getActiveItems().length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-gray-600 mb-4">No items yet. Click "Add New" to get started!</p>
            </div>
          )}
        </div>
      )}

      {/* Personal Equipment Tab */}
      {activeTab === 'equipment' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingEquipment({ 
                    id: '', 
                    name: '', 
                    picture: '',
                    category: '', 
                    sports: [],
                    company: '',
                    description: '', 
                    inStock: true,
                    startDate: '',
                    durationAlarm: { days: undefined, km: undefined, time: '' }
                  });
                  setShowEquipmentDialog(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Add Equipment
              </button>
              
              {/* View Toggle */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setEquipmentViewMode('cards')}
                  className={`px-3 py-2 flex items-center gap-2 transition ${
                    equipmentViewMode === 'cards'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title="Card View"
                >
                  <Grid3x3 className="w-4 h-4" />
                  Cards
                </button>
                <button
                  onClick={() => setEquipmentViewMode('table')}
                  className={`px-3 py-2 flex items-center gap-2 transition border-l border-gray-300 ${
                    equipmentViewMode === 'table'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title="Table View"
                >
                  <List className="w-4 h-4" />
                  Table
                </button>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="Cardio">Cardio</option>
                <option value="Weights">Weights</option>
                <option value="Accessories">Accessories</option>
                <option value="Machines">Machines</option>
                <option value="Clothes">Clothes</option>
                <option value="Shoes">Shoes</option>
                <option value="Beverages">Beverages</option>
                <option value="Sport devices">Sport devices</option>
              </select>
              <div className="text-sm text-gray-600">
                {equipment.filter(e => categoryFilter === 'all' || e.category === categoryFilter).length} items
              </div>
            </div>
          </div>

          {/* Equipment Cards View */}
          {equipmentViewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortEquipment(equipment.filter(e => categoryFilter === 'all' || e.category === categoryFilter))
                .map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition"
                >
                  <div className="flex items-start gap-3 mb-3">
                    {item.picture && (
                      <Image src={item.picture} alt={item.name} width={64} height={64} className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200 flex-shrink-0" unoptimized />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 mb-1 truncate">{item.name}</h3>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                        {item.category}
                      </span>
                      {item.company && (
                        <p className="text-xs text-gray-500 mt-1">{item.company}</p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditingEquipment(item);
                          setShowEquipmentDialog(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this equipment?')) {
                            setEquipment(equipment.filter(e => e.id !== item.id));
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Sports Tags */}
                  {item.sports && item.sports.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.sports.map((sportId, index) => {
                        const sport = sports.find(s => s.id === sportId);
                        return sport ? (
                          <span key={index} className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                            {sport.icon} {sport.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                  
                  {/* Athlete fields */}
                  {!isAdmin && item.startDate && (
                    <div className="mb-3 p-2 bg-blue-50 rounded-lg text-xs">
                      <p className="text-gray-700"><strong>Start:</strong> {new Date(item.startDate).toLocaleDateString()}</p>
                      {item.durationAlarm && (
                        <p className="text-gray-700 mt-1">
                          <strong>Alarm:</strong> 
                          {item.durationAlarm.days && ` ${item.durationAlarm.days}d`}
                          {item.durationAlarm.km && ` ${item.durationAlarm.km}km`}
                          {item.durationAlarm.time && ` ${item.durationAlarm.time}`}
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${item.inStock ? 'text-green-600' : 'text-red-600'}`}>
                      {item.inStock ? '✓ In Stock' : '✗ Out of Stock'}
                    </span>
                    <button
                      onClick={() => {
                        setEquipment(equipment.map(e => 
                          e.id === item.id ? { ...e, inStock: !e.inStock } : e
                        ));
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Toggle
                    </button>
                  </div>
                </div>
                ))}
            </div>
          )}
          
          {/* Equipment Table View */}
          {equipmentViewMode === 'table' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition"
                      onClick={() => handleEquipmentSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Name
                        {equipmentSortField === 'name' && (
                          <ArrowUpDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition"
                      onClick={() => handleEquipmentSort('category')}
                    >
                      <div className="flex items-center gap-2">
                        Category
                        {equipmentSortField === 'category' && (
                          <ArrowUpDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition"
                      onClick={() => handleEquipmentSort('company')}
                    >
                      <div className="flex items-center gap-2">
                        Company
                        {equipmentSortField === 'company' && (
                          <ArrowUpDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                    {!isAdmin && (
                      <th 
                        className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => handleEquipmentSort('startDate')}
                      >
                        <div className="flex items-center gap-2">
                          Date Start
                          {equipmentSortField === 'startDate' && (
                            <ArrowUpDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortEquipment(equipment.filter(e => categoryFilter === 'all' || e.category === categoryFilter))
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {item.picture && (
                              <Image src={item.picture} alt={item.name} width={40} height={40} className="w-10 h-10 object-cover rounded border border-gray-200 flex-shrink-0" unoptimized />
                            )}
                            <div>
                              <div className="font-semibold text-gray-900">{item.name}</div>
                              {item.sports && item.sports.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {item.sports.slice(0, 2).map((sportId, index) => {
                                    const sport = sports.find(s => s.id === sportId);
                                    return sport ? (
                                      <span key={index} className="text-xs">
                                        {sport.icon}
                                      </span>
                                    ) : null;
                                  })}
                                  {item.sports.length > 2 && (
                                    <span className="text-xs text-gray-500">+{item.sports.length - 2}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-700">{item.company || '—'}</div>
                        </td>
                        {!isAdmin && (
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-700">
                              {item.startDate ? new Date(item.startDate).toLocaleDateString() : '—'}
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingEquipment(item);
                                setShowEquipmentDialog(true);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Delete this equipment?')) {
                                  setEquipment(equipment.filter(e => e.id !== item.id));
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {equipment.filter(e => categoryFilter === 'all' || e.category === categoryFilter).length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-gray-600">No equipment found. Click "Add Equipment" to get started!</p>
            </div>
          )}
        </div>
      )}

      {/* Sports Equipment Factories Tab — machine manufacturer catalog (Super Admin / Admin panel) */}
      {activeTab === 'equipmentFactories' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 rounded-xl border border-purple-200 dark:border-purple-800 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="text-2xl">🏭</span>
              Equipment factories
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Register brands that build gym and sport machines. This catalog feeds the{' '}
              <span className="font-semibold text-purple-600 dark:text-purple-400">Machines</span> section.
              Editing is limited to{' '}
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                Super Admin or Admin panel (ADMIN user)
              </span>
              .
            </p>
          </div>

          {equipmentFactoriesMessage && (
            <div
              className={`flex items-center gap-2 p-4 rounded-lg ${
                equipmentFactoriesMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
              }`}
            >
              {equipmentFactoriesMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
              <span className="text-sm font-medium">{equipmentFactoriesMessage.text}</span>
            </div>
          )}

          {canManageMachineCompanies ? (
            <SuperAdminCompaniesSection onNotify={setEquipmentFactoriesMessage} />
          ) : (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-8 text-center space-y-4">
              <Building2 className="w-12 h-12 text-amber-700 dark:text-amber-500 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Companies (machine manufacturers)</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 max-w-lg mx-auto">
                  Sign in with the <strong>admin panel</strong> (red admin bar) as an ADMIN user, or log in as{' '}
                  <strong>Super Admin</strong> under{' '}
                  <span className="whitespace-nowrap">Admin Management</span>. Then return here or refresh the page.
                </p>
              </div>
              <a
                href="/settings/admin-management"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                <LogIn className="w-4 h-4" />
                Open Admin Management
              </a>
            </div>
          )}
        </div>
      )}

      {/* Muscles Settings Tab */}
      {activeTab === 'muscles' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span className="text-2xl">💪</span>
              Muscles Settings
            </h3>
            <p className="text-gray-600 text-sm">
              Configure muscle groups, anatomical references, and training targets. Admin only section.
            </p>
          </div>

          {/* Placeholder Content */}
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">💪</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Muscles Settings</h3>
            <p className="text-gray-600 mb-4">
              Define muscle groups, add anatomical descriptions, and set training parameters.
            </p>
            <button className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">
              <Plus className="w-4 h-4 inline-block mr-2" />
              Add Muscle Group
            </button>
          </div>
        </div>
      )}

      {/* Sports Equipment Tab */}
      {activeTab === 'sportsEquipment' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span className="text-2xl">⚽</span>
              Sports Equipment
            </h3>
            <p className="text-gray-600 text-sm">
              Manage all types of sports equipment and gear. This section is available for{' '}
              <span className="font-semibold text-cyan-600">all users</span>.
            </p>
          </div>

          {/* Placeholder Content */}
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">⚽</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Sports Equipment</h3>
            <p className="text-gray-600 mb-4">
              Add sports-specific equipment, accessories, and gear for your training sessions.
            </p>
            <button className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition font-semibold">
              <Plus className="w-4 h-4 inline-block mr-2" />
              Add Equipment
            </button>
          </div>
        </div>
      )}

      {activeTab === 'sportMachines' && <SportMachinesSection />}

      {activeTab === 'myLibrary' && (
        <div className="mt-2">
          <ExerciseOGPPanel category={myLibraryCategory} adminContext={isAdmin} />
        </div>
      )}

      {activeTab === 'pathologies' && (
        <ExercisePathologiesCatalogSection
          pathologies={exercisePathologyCatalog}
          setPathologies={setExercisePathologyCatalog}
        />
      )}

      {/* Exercises Tab — Exercise Bank + full Section Exercise editor */}
      {activeTab === 'exercises' && (
        <div className="space-y-4">
          <ExerciseBankTab
            exercises={exercises}
            setExercises={setExercises}
            sports={sports}
            pathologyCatalog={exercisePathologyCatalog}
            onAddExercise={() => {
              setEditingExercise(
                mergeExerciseWithDefaults({
                  id: '',
                  isUserCreated: !isAdmin,
                })
              );
              setShowExerciseDialog(true);
            }}
            onEditExercise={(ex) => {
              setEditingExercise(mergeExerciseWithDefaults(ex));
              setShowExerciseDialog(true);
            }}
          />
        </div>
      )}

      {activeTab === 'insertActions' && (
        <div className="space-y-4">
          <PlannedActionTemplatesEditor />
        </div>
      )}

      {activeTab === 'sportDropdownParameters' && (
        <div className="space-y-4">
          <SportDropdownParametersSettings />
        </div>
      )}

      {/* Device Enabled Tab */}
      {activeTab === 'devices' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <span className="text-2xl">📱</span>
              Device Management - Super Admin Only
            </h3>
            <p className="text-gray-600 text-sm mb-3">
              Add new devices and their descriptions that will be shown to users when they select their Services.
            </p>
            <div className="bg-white rounded-lg p-3 border border-purple-100">
              <p className="text-xs text-gray-500">
                <strong className="text-purple-700">Note:</strong> Device communication protocols will be synced and linked to official reading protocols in future updates. 
                Users will be able to configure their personal device settings after login.
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex justify-between items-center">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingDevice({ 
                    id: '', 
                    name: '', 
                    brand: '',
                    model: '',
                    codekey: '',
                    type: 'Watch',
                    compatibility: [],
                    isEnabled: true,
                    syncProtocol: '',
                    description: ''
                  });
                  setShowDeviceDialog(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
              >
                <Plus className="w-4 h-4" />
                Add Device
              </button>
            </div>
            <div className="flex gap-3 items-center">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Device Types</option>
                <option value="Watch">Smart Watches</option>
                <option value="Tracker">Fitness Trackers</option>
                <option value="Monitor">Heart Rate Monitors</option>
                <option value="Scale">Smart Scales</option>
                <option value="Sensor">Sensors</option>
                <option value="Other">Other Devices</option>
              </select>
              <div className="text-sm text-gray-600">
                {devices.filter(d => categoryFilter === 'all' || d.type === categoryFilter).length} devices
              </div>
            </div>
          </div>

          {/* Devices Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices
              .filter(d => categoryFilter === 'all' || d.type === categoryFilter)
              .map((device) => (
                <div
                  key={device.id}
                  className={`bg-white rounded-xl border-2 p-5 transition ${
                    device.isEnabled ? 'border-green-200 bg-green-50/30' : 'border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{device.name}</h3>
                        <span className={`w-3 h-3 rounded-full ${device.isEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{device.brand} {device.model}</p>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                          {device.type}
                        </span>
                        {device.codekey && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-mono font-bold rounded border border-orange-300">
                            {device.codekey}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingDevice(device);
                          setShowDeviceDialog(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this device?')) {
                            setDevices(devices.filter(d => d.id !== device.id));
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{device.description}</p>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500">Sync:</span>
                      <span className="text-xs text-gray-700 font-medium">{device.syncProtocol}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500">Compatible:</span>
                      <div className="flex flex-wrap gap-1">
                        {device.compatibility.map((comp, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                            {comp}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <span className={`text-sm font-semibold ${device.isEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                      {device.isEnabled ? '✓ Enabled' : '✗ Disabled'}
                    </span>
                    <button
                      onClick={() => {
                        setDevices(devices.map(d => 
                          d.id === device.id ? { ...d, isEnabled: !d.isEnabled } : d
                        ));
                      }}
                      className="text-xs text-purple-600 hover:underline font-medium"
                    >
                      Toggle
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {devices.filter(d => categoryFilter === 'all' || d.type === categoryFilter).length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-gray-600">No devices found. Click "Add Device" to register a compatible device!</p>
            </div>
          )}

          {/* Device Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-900">{devices.length}</div>
              <div className="text-sm text-gray-600">Total Devices</div>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4">
              <div className="text-2xl font-bold text-green-600">{devices.filter(d => d.isEnabled).length}</div>
              <div className="text-sm text-gray-600">Enabled</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl font-bold text-gray-600">{devices.filter(d => !d.isEnabled).length}</div>
              <div className="text-sm text-gray-600">Disabled</div>
            </div>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6">
              Add New {activeTab === 'periods' ? 'Period' : activeTab === 'sections' ? 'Section' : activeTab === 'commonDailyActions' ? 'Common Daily Action' : 'Execution Technique'}
            </h3>
            
            {/* Info Banner */}
            <div className="mb-6 p-3 bg-blue-50 border-2 border-blue-300 rounded-lg">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-700" />
                <span className="text-sm font-semibold text-blue-900">
                  Edit in all languages simultaneously - changes save to all language libraries at once!
                </span>
              </div>
            </div>

            {isAdmin && activeTab === 'periods' && (
              <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-950">
                  <span className="font-semibold">Super Admin — Periods:</span> English (EN) is the default reference
                  language. The stored primary name and description are the English fields; other languages are saved as
                  translations. Language blocks are listed with English first.
                </p>
              </div>
            )}
            
            {/* Global Fields (Code & Color) */}
            <div className="space-y-4 mb-6">
              {(activeTab === 'sections' || activeTab === 'commonDailyActions') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Code <span className="text-gray-500">(max 5 characters, same for all languages)</span>
                  </label>
                  <input
                    type="text"
                    value={newItem.code || ''}
                    onChange={(e) => {
                      const value = e.target.value.slice(0, 5).toUpperCase();
                      setNewItem({ ...newItem, code: value });
                    }}
                    placeholder="Enter code..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                    maxLength={5}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {(newItem.code || '').length}/5 - Short code for compact display
                  </div>
                </div>
              )}

              {activeTab === 'commonDailyActions' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Picture <span className="text-gray-500">(same for all languages)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setNewItem({ ...newItem, picture: (reader.result as string) || '' });
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    {newItem.picture && (
                      <Image
                        src={newItem.picture}
                        alt="Preview"
                        width={56}
                        height={56}
                        className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                        unoptimized
                      />
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Color <span className="text-gray-500">(same for all languages)</span>
                </label>
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer"
                    style={{ backgroundColor: newItem.color }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'color';
                      input.value = newItem.color;
                      input.onchange = (e) => setNewItem({ ...newItem, color: (e.target as HTMLInputElement).value });
                      input.click();
                    }}
                  />
                  <input
                    type="text"
                    value={newItem.color}
                    onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Per-Language Fields */}
            {isAdmin ? (
              // Admin: Show all languages
              <div className="space-y-6">
                <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Translations</h4>
                
                {adminTranslationLanguages.map((lang) => (
                  <div key={lang.code} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md font-bold text-sm">
                        {lang.code.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{lang.name}</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          Title <span className="text-gray-400">(max 30 chars)</span>
                        </label>
                        <input
                          type="text"
                          value={
                            useEnglishFallbackRules
                              ? (
                                  newItemTranslations[lang.code]?.title ||
                                  (lang.code !== 'en' ? (newItemTranslations['en']?.title || '') : '')
                                )
                              : (newItemTranslations[lang.code]?.title || '')
                          }
                          onChange={(e) => {
                            const value = e.target.value.slice(0, 30);
                            setNewItemTranslations({
                              ...newItemTranslations,
                              [lang.code]: {
                                title: value,
                                description: newItemTranslations[lang.code]?.description || ''
                              }
                            });
                          }}
                          placeholder={`Enter ${lang.name} title...`}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                            useEnglishFallbackRules &&
                            lang.code !== 'en' &&
                            !(newItemTranslations[lang.code]?.title || '').trim() &&
                            !!(newItemTranslations['en']?.title || '').trim()
                              ? 'text-red-600'
                              : 'text-gray-900'
                          }`}
                          maxLength={30}
                        />
                        <div className="text-xs text-gray-400 mt-0.5">
                          {(
                            useEnglishFallbackRules
                              ? (
                                  newItemTranslations[lang.code]?.title ||
                                  (lang.code !== 'en' ? (newItemTranslations['en']?.title || '') : '')
                                )
                              : (newItemTranslations[lang.code]?.title || '')
                          ).length}/30
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          Description <span className="text-gray-400">(max 255 chars)</span>
                        </label>
                        <textarea
                          value={
                            useEnglishFallbackRules
                              ? (
                                  newItemTranslations[lang.code]?.description ||
                                  (lang.code !== 'en' ? (newItemTranslations['en']?.description || '') : '')
                                )
                              : (newItemTranslations[lang.code]?.description || '')
                          }
                          onChange={(e) => {
                            const value = e.target.value.slice(0, 255);
                            setNewItemTranslations({
                              ...newItemTranslations,
                              [lang.code]: {
                                title: newItemTranslations[lang.code]?.title || '',
                                description: value
                              }
                            });
                          }}
                          placeholder={`Enter ${lang.name} description...`}
                          rows={2}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                            useEnglishFallbackRules &&
                            lang.code !== 'en' &&
                            !(newItemTranslations[lang.code]?.description || '').trim() &&
                            !!(newItemTranslations['en']?.description || '').trim()
                              ? 'text-red-600'
                              : 'text-gray-900'
                          }`}
                          maxLength={255}
                        />
                        <div className="text-xs text-gray-400 mt-0.5">
                          {(
                            useEnglishFallbackRules
                              ? (
                                  newItemTranslations[lang.code]?.description ||
                                  (lang.code !== 'en' ? (newItemTranslations['en']?.description || '') : '')
                                )
                              : (newItemTranslations[lang.code]?.description || '')
                          ).length}/255
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Non-Admin: Only show current language fields
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Title <span className="text-gray-500">(max 30 chars)</span>
                  </label>
                  <input
                    type="text"
                    value={newItem.title}
                    onChange={(e) => setNewItem({ ...newItem, title: e.target.value.slice(0, 30) })}
                    placeholder="Enter title..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={30}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {newItem.title.length}/30
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description <span className="text-gray-500">(max 255 chars)</span>
                  </label>
                  <textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value.slice(0, 255) })}
                    placeholder="Enter description..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={255}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {newItem.description.length}/255
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button
                onClick={handleAdd}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                {isAdmin ? 'Save to All Languages' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowAddDialog(false);
                  setNewItem({ title: '', code: '', description: '', color: '#3b82f6', sports: [] as string[], picture: '' });
                  setNewItemTranslations({});
                  setActiveInputLanguage('en');
                }}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6">
              Edit {activeTab === 'periods' ? 'Period' : activeTab === 'sections' ? 'Section' : activeTab === 'commonDailyActions' ? 'Common Daily Action' : 'Execution Technique'}
            </h3>
            
            {/* Info Banner - Only for Admin */}
            {isAdmin && (
              <div className="mb-6 p-3 bg-blue-50 border-2 border-blue-300 rounded-lg">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-700" />
                  <span className="text-sm font-semibold text-blue-900">
                    Edit in all languages simultaneously - changes save to all language libraries at once!
                  </span>
                </div>
              </div>
            )}

            {isAdmin && activeTab === 'periods' && (
              <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-950">
                  <span className="font-semibold">Super Admin — Periods:</span> English (EN) is the default reference
                  language. The stored primary name and description are the English fields; other languages are saved as
                  translations. Language blocks are listed with English first.
                </p>
              </div>
            )}

            {/* Global Fields (Code & Color) */}
            <div className="space-y-4 mb-6">
              {(activeTab === 'sections' || activeTab === 'commonDailyActions') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Code <span className="text-gray-500">(max 5 characters, same for all languages)</span>
                  </label>
                  <input
                    type="text"
                    value={(editingItem as any).code || ''}
                    onChange={(e) => {
                      const value = e.target.value.slice(0, 5).toUpperCase();
                      setEditingItem({ ...editingItem, code: value } as any);
                    }}
                    placeholder="Enter code..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                    maxLength={5}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {((editingItem as any).code || '').length}/5 - Short code for compact display
                  </div>
                </div>
              )}

              {activeTab === 'commonDailyActions' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Picture <span className="text-gray-500">(same for all languages)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file || !editingItem) return;
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setEditingItem({ ...editingItem, picture: (reader.result as string) || '' } as any);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    {(editingItem as any).picture && (
                      <Image
                        src={(editingItem as any).picture}
                        alt="Preview"
                        width={56}
                        height={56}
                        className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                        unoptimized
                      />
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Color <span className="text-gray-500">(same for all languages)</span>
                </label>
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer"
                    style={{ backgroundColor: editingItem.color }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'color';
                      input.value = editingItem.color;
                      input.onchange = (e) => setEditingItem({ ...editingItem, color: (e.target as HTMLInputElement).value });
                      input.click();
                    }}
                  />
                  <input
                    type="text"
                    value={editingItem.color}
                    onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Per-Language Fields */}
            {isAdmin ? (
              // Admin: Show all languages
              <div className="space-y-6">
                <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">Translations</h4>
                
                {adminTranslationLanguages.map((lang) => (
                  <div key={lang.code} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md font-bold text-sm">
                        {lang.code.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{lang.name}</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          Title <span className="text-gray-400">(max 30 chars)</span>
                        </label>
                        <input
                          type="text"
                          value={
                            useEnglishFallbackRules
                              ? (
                                  editItemTranslations[lang.code]?.title ||
                                  (lang.code !== 'en' ? (editItemTranslations['en']?.title || '') : '')
                                )
                              : (editItemTranslations[lang.code]?.title || '')
                          }
                          onChange={(e) => {
                            const value = e.target.value.slice(0, 30);
                            setEditItemTranslations({
                              ...editItemTranslations,
                              [lang.code]: {
                                title: value,
                                description: editItemTranslations[lang.code]?.description || ''
                              }
                            });
                          }}
                          placeholder={`Enter ${lang.name} title...`}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                            useEnglishFallbackRules &&
                            lang.code !== 'en' &&
                            !(editItemTranslations[lang.code]?.title || '').trim() &&
                            !!(editItemTranslations['en']?.title || '').trim()
                              ? 'text-red-600'
                              : 'text-gray-900'
                          }`}
                          maxLength={30}
                        />
                        <div className="text-xs text-gray-400 mt-0.5">
                          {(
                            useEnglishFallbackRules
                              ? (
                                  editItemTranslations[lang.code]?.title ||
                                  (lang.code !== 'en' ? (editItemTranslations['en']?.title || '') : '')
                                )
                              : (editItemTranslations[lang.code]?.title || '')
                          ).length}/30
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          Description <span className="text-gray-400">(max 255 chars)</span>
                        </label>
                        <textarea
                          value={
                            useEnglishFallbackRules
                              ? (
                                  editItemTranslations[lang.code]?.description ||
                                  (lang.code !== 'en' ? (editItemTranslations['en']?.description || '') : '')
                                )
                              : (editItemTranslations[lang.code]?.description || '')
                          }
                          onChange={(e) => {
                            const value = e.target.value.slice(0, 255);
                            setEditItemTranslations({
                              ...editItemTranslations,
                              [lang.code]: {
                                title: editItemTranslations[lang.code]?.title || '',
                                description: value
                              }
                            });
                          }}
                          placeholder={`Enter ${lang.name} description...`}
                          rows={2}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                            useEnglishFallbackRules &&
                            lang.code !== 'en' &&
                            !(editItemTranslations[lang.code]?.description || '').trim() &&
                            !!(editItemTranslations['en']?.description || '').trim()
                              ? 'text-red-600'
                              : 'text-gray-900'
                          }`}
                          maxLength={255}
                        />
                        <div className="text-xs text-gray-400 mt-0.5">
                          {(
                            useEnglishFallbackRules
                              ? (
                                  editItemTranslations[lang.code]?.description ||
                                  (lang.code !== 'en' ? (editItemTranslations['en']?.description || '') : '')
                                )
                              : (editItemTranslations[lang.code]?.description || '')
                          ).length}/255
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Non-Admin: Only show current language fields
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Title <span className="text-gray-500">(max 30 chars)</span>
                  </label>
                  <input
                    type="text"
                    value={editingItem.title}
                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value.slice(0, 30) })}
                    placeholder="Enter title..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={30}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {editingItem.title.length}/30
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description <span className="text-gray-500">(max 255 chars)</span>
                  </label>
                  <textarea
                    value={editingItem.description}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value.slice(0, 255) })}
                    placeholder="Enter description..."
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength={255}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {editingItem.description.length}/255
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8">
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isAdmin ? 'Save to All Languages' : 'Save'}
              </button>
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Equipment Dialog */}
      {showEquipmentDialog && editingEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full my-8">
            <h3 className="text-2xl font-bold mb-6">
              {editingEquipment.id ? 'Edit Equipment' : 'Add New Equipment'}
            </h3>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={editingEquipment.name}
                  onChange={(e) => setEditingEquipment({ ...editingEquipment, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Equipment name"
                />
              </div>

              {/* Picture */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Picture</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // For now, store as data URL. In production, upload to server
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setEditingEquipment({ ...editingEquipment, picture: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    style={{ position: 'relative', zIndex: 1 }}
                  />
                  {editingEquipment.picture && (
                    <Image src={editingEquipment.picture} alt="Preview" width={64} height={64} className="w-16 h-16 object-cover rounded-lg border-2 border-gray-300" unoptimized />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Upload an image of the equipment</p>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                <select
                  value={editingEquipment.category}
                  onChange={(e) => setEditingEquipment({ ...editingEquipment, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  <option value="Cardio">Cardio</option>
                  <option value="Weights">Weights</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Machines">Machines</option>
                  <option value="Clothes">Clothes</option>
                  <option value="Shoes">Shoes</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Sport devices">Sport devices</option>
                </select>
              </div>

              {/* Sport Tags */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sport *</label>
                <div className="border border-gray-300 rounded-lg p-3 min-h-[100px]">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editingEquipment.sports?.map((sportId, index) => {
                      const sport = sports.find(s => s.id === sportId);
                      return sport ? (
                        <span key={index} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {sport.icon} {sport.name}
                          <button
                            onClick={() => {
                              setEditingEquipment({
                                ...editingEquipment,
                                sports: editingEquipment.sports?.filter((_, i) => i !== index) || []
                              });
                            }}
                            className="ml-1 hover:text-blue-900"
                          >
                            ×
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                  <select
                    onChange={(e) => {
                      const sportId = e.target.value;
                      console.log('Sport selected:', sportId);
                      console.log('Current equipment sports:', editingEquipment.sports);
                      
                      if (sportId && editingEquipment && !editingEquipment.sports?.includes(sportId)) {
                        const updatedSports = [...(editingEquipment.sports || []), sportId];
                        console.log('Updating sports to:', updatedSports);
                        
                        setEditingEquipment({
                          ...editingEquipment,
                          sports: updatedSports
                        });
                      }
                      // Reset select to default
                      setTimeout(() => {
                        e.target.value = '';
                      }, 0);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white cursor-pointer"
                    value=""
                  >
                    <option value="" disabled>+ Add sport</option>
                    {(sports && sports.length > 0 ? sports : DEFAULT_SPORTS)
                      .filter(s => !editingEquipment?.sports?.includes(s.id))
                      .map(sport => (
                        <option key={sport.id} value={sport.id}>
                          {sport.icon} {sport.name}
                        </option>
                      ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">Select one or more sports this equipment is used for</p>
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Company</label>
                <input
                  type="text"
                  value={editingEquipment.company || ''}
                  onChange={(e) => setEditingEquipment({ ...editingEquipment, company: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Manufacturer or brand name"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  value={editingEquipment.description}
                  onChange={(e) => setEditingEquipment({ ...editingEquipment, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Equipment description"
                />
              </div>

              {/* Athlete-specific fields */}
              {!isAdmin && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold text-gray-700 mb-3">Athlete Tracking</h4>
                    
                    {/* Start Date */}
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        value={editingEquipment.startDate || ''}
                        onChange={(e) => setEditingEquipment({ ...editingEquipment, startDate: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Duration Alarm */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Duration Alarm</label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Days (autofilled)</label>
                          <input
                            type="number"
                            value={editingEquipment.durationAlarm?.days || ''}
                            onChange={(e) => setEditingEquipment({
                              ...editingEquipment,
                              durationAlarm: {
                                ...editingEquipment.durationAlarm,
                                days: parseInt(e.target.value) || undefined
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Days"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Km (autofilled)</label>
                          <input
                            type="number"
                            value={editingEquipment.durationAlarm?.km || ''}
                            onChange={(e) => setEditingEquipment({
                              ...editingEquipment,
                              durationAlarm: {
                                ...editingEquipment.durationAlarm,
                                km: parseInt(e.target.value) || undefined
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="Km"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Time (autofilled)</label>
                          <input
                            type="text"
                            value={editingEquipment.durationAlarm?.time || ''}
                            onChange={(e) => setEditingEquipment({
                              ...editingEquipment,
                              durationAlarm: {
                                ...editingEquipment.durationAlarm,
                                time: e.target.value
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder="HH:MM:SS"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Set automatic alarms based on usage duration</p>
                    </div>
                  </div>
                </>
              )}

              {/* In Stock */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="inStock"
                  checked={editingEquipment.inStock}
                  onChange={(e) => setEditingEquipment({ ...editingEquipment, inStock: e.target.checked })}
                  className="w-5 h-5 text-blue-600"
                />
                <label htmlFor="inStock" className="text-sm font-semibold text-gray-700">
                  In Stock
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  if (!editingEquipment.name || !editingEquipment.category) {
                    alert('Please fill in all required fields (Name, Category, Sport)');
                    return;
                  }
                  if (!editingEquipment.sports || editingEquipment.sports.length === 0) {
                    alert('Please select at least one sport');
                    return;
                  }
                  if (editingEquipment.id) {
                    setEquipment(equipment.map(e => e.id === editingEquipment.id ? editingEquipment : e));
                  } else {
                    setEquipment([...equipment, { ...editingEquipment, id: Date.now().toString(), isUserCreated: !isAdmin }]);
                  }
                  setShowEquipmentDialog(false);
                  setEditingEquipment(null);
                }}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                {editingEquipment.id ? 'Save' : 'Add'}
              </button>
              <button
                onClick={() => {
                  setShowEquipmentDialog(false);
                  setEditingEquipment(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Section Exercise editor (replaces legacy simple modal) */}
      {showExerciseDialog && editingExercise && (
        <SectionExerciseDialog
          exercise={editingExercise}
          onChange={(next) => setEditingExercise(next)}
          sports={sports}
          allExercises={exercises}
          pathologyCatalog={exercisePathologyCatalog}
          onSave={() => {
            const nameOk = (editingExercise.name || '').trim();
            const codeOk = (editingExercise.exerciseCode || '').trim();
            if (!nameOk) {
              alert('Please enter the exercise name in English.');
              return;
            }
            if (!codeOk) {
              alert('Please enter a reference code for this exercise.');
              return;
            }
            const finalized = finalizeExerciseForStorage(editingExercise);
            const existingId = (finalized.id || '').trim();
            const id =
              existingId && exercises.some((x) => x.id === existingId)
                ? existingId
                : existingId || `ex-${Date.now()}`;
            const toSave: Exercise = {
              ...finalized,
              id,
              isUserCreated:
                finalized.isUserCreated !== undefined ? finalized.isUserCreated : !isAdmin,
            };
            const exists = exercises.some((e) => e.id === id);
            if (exists) {
              setExercises((prev) => prev.map((e) => (e.id === id ? toSave : e)));
            } else {
              setExercises((prev) => [...prev, toSave]);
            }
            setShowExerciseDialog(false);
            setEditingExercise(null);
          }}
          onCancel={() => {
            setShowExerciseDialog(false);
            setEditingExercise(null);
          }}
        />
      )}

      {/* Device Dialog */}
      {showDeviceDialog && editingDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full my-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-2xl">📱</span>
                {editingDevice.id ? 'Edit Device' : 'Add New Compatible Device'}
              </h3>
              {editingDevice.codekey && (
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 border-2 border-purple-300 rounded-lg">
                  <span className="text-xs font-semibold text-purple-700">CODEKEY:</span>
                  <span className="text-sm font-bold text-purple-900 tracking-wider">{editingDevice.codekey}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Device Name *</label>
                  <input
                    type="text"
                    value={editingDevice.name}
                    onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., GARMIN FORERUNNER 945"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Codekey *</label>
                  <input
                    type="text"
                    value={editingDevice.codekey || ''}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
                      setEditingDevice({ ...editingDevice, codekey: value });
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono font-bold tracking-wider"
                    placeholder="e.g., GARM-FR945"
                    maxLength={20}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique protocol identifier (uppercase, numbers, - and _ only)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Brand *</label>
                  <input
                    type="text"
                    value={editingDevice.brand}
                    onChange={(e) => setEditingDevice({ ...editingDevice, brand: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Apple, Garmin, Fitbit"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Model</label>
                  <input
                    type="text"
                    value={editingDevice.model}
                    onChange={(e) => setEditingDevice({ ...editingDevice, model: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Series 9, Forerunner 945"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Device Type *</label>
                  <select
                    value={editingDevice.type}
                    onChange={(e) => setEditingDevice({ ...editingDevice, type: e.target.value as Device['type'] })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Watch">Smart Watch</option>
                    <option value="Tracker">Fitness Tracker</option>
                    <option value="Monitor">Heart Rate Monitor</option>
                    <option value="Scale">Smart Scale</option>
                    <option value="Sensor">Sensor</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Sync Protocol *</label>
                  <input
                    type="text"
                    value={editingDevice.syncProtocol}
                    onChange={(e) => setEditingDevice({ ...editingDevice, syncProtocol: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Bluetooth LE, HealthKit, Garmin API, ANT+"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Compatibility (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editingDevice.compatibility.join(', ')}
                    onChange={(e) => setEditingDevice({ 
                      ...editingDevice, 
                      compatibility: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., iOS, Android, Windows, macOS, Bluetooth, Wi-Fi"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description (Shown to Users)</label>
                  <textarea
                    value={editingDevice.description}
                    onChange={(e) => setEditingDevice({ ...editingDevice, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter description that users will see when selecting this device in their Services"
                  />
                </div>

                <div className="col-span-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="deviceEnabled"
                      checked={editingDevice.isEnabled}
                      onChange={(e) => setEditingDevice({ ...editingDevice, isEnabled: e.target.checked })}
                      className="w-5 h-5 text-purple-600"
                    />
                    <label htmlFor="deviceEnabled" className="text-sm font-semibold text-gray-700">
                      Make this device available to users
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 ml-8">
                    When enabled, users will see this device option in their Services and can select it for workout tracking
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  if (!editingDevice.name || !editingDevice.brand || !editingDevice.codekey || !editingDevice.syncProtocol) {
                    alert('Please fill in all required fields (Name, Brand, Codekey, Sync Protocol)');
                    return;
                  }
                  // Check for duplicate codekey
                  const existingDevice = devices.find(d => d.codekey === editingDevice.codekey && d.id !== editingDevice.id);
                  if (existingDevice) {
                    alert(`⚠️ Codekey "${editingDevice.codekey}" is already in use by "${existingDevice.name}".\n\nEach device must have a unique codekey.`);
                    return;
                  }
                  if (editingDevice.id) {
                    setDevices(devices.map(d => d.id === editingDevice.id ? editingDevice : d));
                  } else {
                    setDevices([...devices, { ...editingDevice, id: Date.now().toString(), isUserCreated: !isAdmin }]);
                  }
                  setShowDeviceDialog(false);
                  setEditingDevice(null);
                }}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold"
              >
                {editingDevice.id ? 'Save Device' : 'Add Device'}
              </button>
              <button
                onClick={() => {
                  setShowDeviceDialog(false);
                  setEditingDevice(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Dialog (Admin or Personal) */}
      {showPasswordDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">
              🔐 {isAdmin ? 'Super Admin Authentication' : 'Confirm Your Identity'}
            </h3>
            <p className="text-gray-600 mb-4">
              {isAdmin ? (
                <>
                  You are about to save <strong>ALL CURRENT SETTINGS FROM ALL TABS</strong> as <strong>DEFAULT</strong> for <strong>{SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name}</strong>.
                </>
              ) : (
                <>
                  Please enter your password to confirm and save your <strong>personal settings</strong>.
                </>
              )}
            </p>
            {isAdmin && (
              <div className="text-sm text-orange-700 bg-orange-50 p-3 rounded-lg mb-4 space-y-2">
                <p><strong>📌 What will be saved to {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name.toUpperCase()}:</strong></p>
                <ul className="list-disc ml-5 space-y-1">
                  <li><strong>Periods:</strong> All periods from Periods tab</li>
                  <li><strong>Sections:</strong> All sections from Sections tab</li>
                  <li><strong>Sports:</strong> Managed in Favourite - Favourite Sports</li>
                  <li><strong>Equipment:</strong> All equipment from Personal Equipment tab</li>
                  <li><strong>Exercises:</strong> All exercises from Exercise Bank tab</li>
                  <li><strong>Devices:</strong> All devices from Device Enabled tab</li>
                </ul>
                <p className="pt-2 font-semibold"><strong>👥 For users:</strong> All these settings will be available when they click "Load Admin Defaults" button.</p>
              </div>
            )}
            {!isAdmin && (
              <div className="text-sm text-blue-700 bg-blue-50 p-3 rounded-lg mb-4">
                <p><strong>💾 Saving Your Personal Settings:</strong></p>
                <p className="mt-1">These settings will be saved to your account only and will not affect other users.</p>
              </div>
            )}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isAdmin ? 'Super Admin Password:' : 'Your Password:'}
              </label>
              <input
                type="password"
                value={superAdminPassword}
                onChange={(e) => setSuperAdminPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder="Enter password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold"
              >
                {isAdmin ? 'Save Defaults' : 'Save My Settings'}
              </button>
              <button
                onClick={() => {
                  setShowPasswordDialog(false);
                  setSuperAdminPassword('');
                }}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Language Defaults Dialog */}
      {showLoadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">📥 Load {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name} Defaults</h3>
            <p className="text-gray-600 mb-4">
              Load default tools settings for <strong>{SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name}</strong>?
            </p>
            <div className="text-sm text-blue-700 bg-blue-50 p-3 rounded-lg mb-3">
              <p className="font-semibold mb-1">📖 How it works:</p>
              <ol className="list-decimal ml-5 space-y-1">
                <li>Loads {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name} defaults for ALL tabs</li>
                <li>You can edit/translate items in any tab (Sports, Equipment, etc.)</li>
                <li>Select a different language if needed (e.g., Russian)</li>
                <li>Click "Save to [Language]" to save ALL tabs at once</li>
              </ol>
            </div>
            <p className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg mb-4">
              ⚠️ <strong>Note:</strong> This will replace ALL current unsaved changes in ALL tabs with the {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name} defaults.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleLoadConfirm}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold"
              >
                Load {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name}
              </button>
              <button
                onClick={() => setShowLoadDialog(false)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sport Dialog */}
      {showEditSportDialog && editingSport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-6">
              ✏️ Edit Sport - Translation
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sport Name</label>
                <input
                  type="text"
                  value={editingSport.name}
                  onChange={(e) => setEditingSport({ ...editingSport, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter sport name in your language"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Translate the sport name into {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sport Icon (Emoji)</label>
                <input
                  type="text"
                  value={editingSport.icon}
                  onChange={(e) => setEditingSport({ ...editingSport, icon: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-2xl text-center"
                  placeholder="🏊‍♂️"
                  maxLength={5}
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can change the emoji icon if needed
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>💡 Tip:</strong> After translating all sports, click "Save as DEFAULT" at the top to save them for {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  if (!editingSport.name.trim()) {
                    alert('Please enter a sport name');
                    return;
                  }
                  setSports(sports.map(s => s.id === editingSport.id ? editingSport : s));
                  setShowEditSportDialog(false);
                  setEditingSport(null);
                }}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={() => {
                  setShowEditSportDialog(false);
                  setEditingSport(null);
                }}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-semibold flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
