'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Menu, Settings } from 'lucide-react';
import MubPreviewModeToggle, {
  MUB_SIZE_COUNTS,
  normalizeMubButtonSize,
  normalizeMubDisplayMode,
  type MubButtonSize,
  type MubDisplayMode,
} from '@/components/mub/MubPreviewModeToggle';
import MubButtonEditorForm, { emptyMubButtonForm, type MubButtonFormState } from '@/components/mub/MubButtonEditorForm';
import MubButtonPreview from '@/components/mub/MubButtonPreview';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import {
  MUB_BACKGROUND_OPTIONS,
  MUB_CATEGORIES,
  MUB_STAFF_ROLE_TEMPLATES,
  mubBackgroundCss,
  roleTemplateFromUserType,
} from '@/lib/mub/constants';
import { sanitizeMubIconPath, sanitizeMubUrl } from '@/lib/mub/mubSanitize';
import type { MubButtonDto, MubCategory, MubPageDto, MubRoleTemplate } from '@/lib/mub/types';
import { mubPageUrl, mubStaffPageUrl } from '@/lib/mub/routes';

type MubPageMode = 'view' | 'edit' | 'staff';
type MubLoadSource = 'user' | 'movesbook';

/**
 * Where the gear-password unlock is remembered for the rest of the browser session.
 *
 * Navigating between MUB categories drops the `edit=1` flag from the URL, which used
 * to lose the unlock — the old code compensated by treating plain `view` mode as
 * editable, which meant the password gate could be skipped entirely. Keeping the
 * unlock here instead lets the gate stay closed. It is a convenience only: every
 * route re-checks permission server-side.
 */
const MUB_UNLOCK_KEYS: Record<'edit' | 'staff', string> = {
  edit: 'mub:unlocked:user',
  staff: 'mub:unlocked:staff',
};

function readUnlockFlag(mode: MubPageMode): boolean {
  if (mode !== 'edit' && mode !== 'staff') return false;
  try {
    return window.sessionStorage.getItem(MUB_UNLOCK_KEYS[mode]) === '1';
  } catch {
    return false;
  }
}

function writeUnlockFlag(mode: 'edit' | 'staff') {
  try {
    window.sessionStorage.setItem(MUB_UNLOCK_KEYS[mode], '1');
  } catch {
    /* private mode — the user re-enters the password on the next page */
  }
}

type MubPageClientProps = {
  mode: MubPageMode;
  staffRoleTemplate?: MubRoleTemplate;
  /** Active sub-panel — null = view-only landing (PHP pic #1). */
  initialPanel?: 'user' | 'background' | null;
  initialCategory?: MubCategory;
  /** True when URL includes /club|workout|social segment. */
  hasCategoryInPath?: boolean;
  /** Reading-mode source from ?load=user|movesbook */
  initialLoadSource?: MubLoadSource | null;
};

function apiQuery(
  mode: MubPageMode,
  category: MubCategory,
  userId: string | undefined,
  staffRoleTemplate?: MubRoleTemplate,
  loadSource?: MubLoadSource | null,
) {
  const params = new URLSearchParams({ category });
  if (mode === 'staff' || loadSource === 'movesbook') {
    params.set('scope', 'STAFF');
    if (staffRoleTemplate) params.set('roleTemplate', staffRoleTemplate);
  } else {
    params.set('scope', 'USER');
    if (userId) params.set('ownerId', userId);
  }
  return params.toString();
}

export default function MubPageClient({
  mode,
  staffRoleTemplate = 'SINGLE_USER',
  initialPanel = null,
  initialCategory = 'CLUB_MANAGEMENT',
  hasCategoryInPath = false,
  initialLoadSource = null,
}: MubPageClientProps) {
  const router = useRouter();
  const { currentLanguage: language } = useLanguage();
  const { user } = useAuth();
  const userRoleTemplate = roleTemplateFromUserType(user?.userType ?? 'ATHLETE');
  const [editUnlocked, setEditUnlocked] = useState(false);
  /** sessionStorage is only readable after hydration; avoids flashing the gate. */
  const [unlockChecked, setUnlockChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'user' | 'background' | null>(initialPanel);
  const [category, setCategory] = useState<MubCategory>(initialCategory);
  const [page, setPage] = useState<MubPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<MubButtonFormState>(() => emptyMubButtonForm('en'));
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [selectedBg, setSelectedBg] = useState('white');
  const [message, setMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<MubDisplayMode>(1);
  const [buttonSize, setButtonSize] = useState<MubButtonSize>(2);
  const [readingPageIndex, setReadingPageIndex] = useState(0);
  const [loadSource, setLoadSource] = useState<MubLoadSource | null>(initialLoadSource);
  const [loadPickerOpen, setLoadPickerOpen] = useState(false);
  /** Reading-mode drag order — discarded when leaving MUB session (not persisted). */
  const [sessionOrderIds, setSessionOrderIds] = useState<string[] | null>(null);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'remove_default' | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const isViewLanding = mode === 'view' && activePanel === null && !hasCategoryInPath;
  const isUserSettingsHub = activePanel === 'user' && !hasCategoryInPath;
  /** Both editing modes are behind the gear password — plain `view` is read-only. */
  const requiresUnlock = mode === 'staff' || mode === 'edit';
  const canEdit = requiresUnlock && editUnlocked;
  /** Staff builder edits templates; user CRUD only on category routes (?setting + /club|workout|social). */
  const showCrud =
    mode === 'staff' ? canEdit : canEdit && activePanel === 'user' && hasCategoryInPath;
  const isReadingSession = Boolean(loadSource) && !showCrud && activePanel !== 'background';
  const showCategoryTabs =
    (activePanel === 'user' && canEdit) || mode === 'staff' || isReadingSession;
  const showBackgroundPanel = canEdit && activePanel === 'background';
  const showLoadPickerButton = (isViewLanding || isUserSettingsHub) && !isReadingSession;
  const pageTitle =
    mode === 'staff'
      ? `Setting page of the 'Most used buttons' by Movesbook staff`
      : isReadingSession || isViewLanding
        ? `'Most used buttons of..'`
        : `Setting page of the 'Most used buttons'`;

  const effectiveStaffRole =
    mode === 'staff' ? staffRoleTemplate : loadSource === 'movesbook' ? userRoleTemplate : staffRoleTemplate;

  const queryString = useMemo(
    () =>
      apiQuery(
        mode === 'staff' ? 'staff' : 'edit',
        category,
        user?.id,
        effectiveStaffRole,
        mode === 'staff' ? null : loadSource,
      ),
    [mode, category, user?.id, effectiveStaffRole, loadSource],
  );

  useEffect(() => {
    setEditUnlocked(readUnlockFlag(mode));
    setUnlockChecked(true);
  }, [mode]);

  useEffect(() => {
    setActivePanel(initialPanel);
  }, [initialPanel]);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setLoadSource(initialLoadSource);
  }, [initialLoadSource]);

  /** Keep `edit=1` on internal navigation so the unlocked session stays in edit mode. */
  const keepEdit = mode === 'edit';
  const goUserSettings = () => router.push(mubPageUrl({ setting: true, edit: keepEdit }));
  const goBackgroundSetting = () =>
    router.push(mubPageUrl({ panel: 'background', edit: keepEdit }));
  const goCategory = (cat: MubCategory) => {
    if (mode === 'staff') {
      // Stay on STAFF scope — never navigate to user MUB (would load personal buttons).
      router.push(mubStaffPageUrl({ role: staffRoleTemplate, category: cat }));
      return;
    }
    if (isReadingSession) {
      setCategory(cat);
      setReadingPageIndex(0);
      setSessionOrderIds(null);
      return;
    }
    router.push(mubPageUrl({ category: cat, setting: true, edit: keepEdit }));
  };
  const goViewLanding = () => router.push(mubPageUrl());

  const chooseLoadSource = (source: MubLoadSource) => {
    setLoadPickerOpen(false);
    setSessionOrderIds(null);
    setReadingPageIndex(0);
    setLoadSource(source);
    // Reading session lives on /users/mub_page?load=… (temp drag discarded when leaving).
    router.push(`/users/mub_page?load=${source}`);
  };

  const loadPage = useCallback(async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    try {
      const res = await fetch(`/api/mub/page?${queryString}&lang=${encodeURIComponent(language)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = (await res.json()) as { page?: MubPageDto; error?: string };
      if (!res.ok) {
        setPage(null);
        setMessage(data.error || 'Could not load this MUB page.');
        return;
      }
      if (data.page) {
        setPage(data.page);
        setSelectedBg(data.page.backgroundColor);
        setPreviewMode(normalizeMubDisplayMode(data.page.displayMode));
        setSessionOrderIds(null);
        setReadingPageIndex(0);
        setMessage(null);
      }
    } catch {
      setPage(null);
      setMessage('Could not load this MUB page.');
    } finally {
      setLoading(false);
    }
  }, [queryString, language]);

  useEffect(() => {
    // Staff templates are only fetched once the gate is open, so a locked page
    // does not fire a request the API will reject anyway.
    const shouldLoad =
      mode === 'staff' ? editUnlocked : hasCategoryInPath || isReadingSession;
    if (shouldLoad) {
      void loadPage();
    } else {
      setLoading(false);
      setPage(null);
    }
  }, [loadPage, mode, hasCategoryInPath, isReadingSession, editUnlocked]);

  const postAction = async (body: Record<string, unknown>) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/mub/actions?${queryString}&lang=${encodeURIComponent(language)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'action_failed');
    if (data.page) setPage(data.page);
    return data;
  };

  const saveButton = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/mub/buttons?${queryString}&lang=${encodeURIComponent(language)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          button: {
            id: form.id,
            buttonColor: form.buttonColor,
            textFont: form.textFont,
            textColor: form.textColor,
            iconPath: form.iconPath || null,
            iconSource: form.iconSource,
            urlToOpen: form.urlToOpen || null,
            pageToOpen: form.pageToOpen,
            translations: form.translations,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save_failed');
      setPage(data.page);
      setFormOpen(false);
      setForm(emptyMubButtonForm(language));
      setMessage(null);
    } catch {
      setMessage('Could not save button. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (btn: MubButtonDto) => {
    setForm({
      id: btn.id,
      buttonColor: btn.buttonColor,
      textFont: btn.textFont,
      textColor: btn.textColor,
      iconPath: btn.iconPath ?? '',
      iconFileName: btn.iconPath?.split('/').pop() ?? '',
      iconSource: btn.iconSource,
      urlToOpen: btn.urlToOpen ?? '',
      pageToOpen: btn.pageToOpen,
      editLang: language,
      translations:
        Object.keys(btn.translations).length > 0
          ? { ...btn.translations }
          : { [language]: { shortText: btn.shortText, extendedText: btn.extendedText } },
    });
    setFormOpen(true);
  };

  const uploadIcon = async (file: File) => {
    setUploadingIcon(true);
    try {
      const token = localStorage.getItem('token');
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/mub/icon-upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'upload_failed');
      setForm((f) => ({ ...f, iconPath: data.path, iconFileName: data.fileName ?? file.name }));
    } catch {
      setMessage('Could not upload icon.');
    } finally {
      setUploadingIcon(false);
    }
  };

  const deleteButton = async (id: string) => {
    if (!window.confirm('Delete this button?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(
      `/api/mub/buttons?${queryString}&lang=${encodeURIComponent(language)}&id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Could not delete this button.');
      return;
    }
    if (data.page) setPage(data.page);
  };

  const verifyPassword = async () => {
    setPasswordError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/mub/verify-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { access?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'verify_failed');

      if (data.access === 'staff') {
        writeUnlockFlag('staff');
        const template = roleTemplateFromUserType(user?.userType ?? 'ATHLETE');
        setPassword('');
        router.push(mubStaffPageUrl({ role: template }));
        return;
      }
      if (data.access === 'club' || data.access === 'user') {
        writeUnlockFlag('edit');
        setEditUnlocked(true);
        setPassword('');
        router.push(mubPageUrl({ setting: true, edit: true }));
        return;
      }
      setPasswordError(data.error || 'Invalid password.');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Invalid password.');
    }
  };

  const handleImport = async () => {
    try {
      // The template is chosen server-side from the account's userType.
      const data = await postAction({ action: 'import' });
      setMessage(
        `${data.importedCount ?? 0} button(s) imported for language "${language}". ` +
          'Previously imported buttons were replaced; your own buttons were kept.',
      );
    } catch {
      setMessage('Could not import Movesbook MUB template.');
    }
  };

  const reorderButtons = async (orderedIds: string[]) => {
    if (!page) return;
    const previous = page;
    setPage({
      ...page,
      buttons: orderedIds
        .map((id) => page.buttons.find((b) => b.id === id))
        .filter((b): b is MubButtonDto => Boolean(b)),
    });
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/mub/buttons?${queryString}&lang=${encodeURIComponent(language)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orderedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'reorder_failed');
      if (data.page) setPage(data.page);
    } catch {
      setPage(previous);
      setMessage('Could not reorder buttons.');
    }
  };

  const orderedButtons = useMemo(() => {
    if (!page) return [] as MubButtonDto[];
    if (!sessionOrderIds?.length) return page.buttons;
    const byId = new Map(page.buttons.map((b) => [b.id, b]));
    const ordered = sessionOrderIds.map((id) => byId.get(id)).filter((b): b is MubButtonDto => Boolean(b));
    const missing = page.buttons.filter((b) => !sessionOrderIds.includes(b.id));
    return [...ordered, ...missing];
  }, [page, sessionOrderIds]);

  const sizeCount = MUB_SIZE_COUNTS[buttonSize];
  const readingPageCount =
    previewMode === 1 ? Math.max(1, Math.ceil(orderedButtons.length / sizeCount)) : 1;
  const visibleButtons = useMemo(() => {
    if (!isReadingSession && !showCrud) return orderedButtons;
    if (previewMode === 1 && isReadingSession) {
      const start = readingPageIndex * sizeCount;
      return orderedButtons.slice(start, start + sizeCount);
    }
    return orderedButtons;
  }, [orderedButtons, previewMode, isReadingSession, showCrud, readingPageIndex, sizeCount]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !page || active.id === over.id) return;
    const fullIds = sessionOrderIds?.length ? [...sessionOrderIds] : page.buttons.map((b) => b.id);
    const oldIndex = fullIds.indexOf(String(active.id));
    const newIndex = fullIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(fullIds, oldIndex, newIndex);
    if (showCrud) {
      setSessionOrderIds(null);
      void reorderButtons(next);
      return;
    }
    // Reading mode — temporary only (not saved when leaving MUB session).
    setSessionOrderIds(next);
  };

  const persistPreviewMode = async (next: MubDisplayMode) => {
    setPreviewMode(next);
    setReadingPageIndex(0);
    if (!showCrud || loadSource === 'movesbook') return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/mub/page?${queryString}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ displayMode: next }),
      });
    } catch {
      /* preview still updates client-side */
    }
  };

  const runProtectedAction = async () => {
    if (!confirmAction) return;
    setConfirmSaving(true);
    setConfirmError(null);
    try {
      await postAction({ action: confirmAction, password: confirmPassword });
      setMessage(
        confirmAction === 'reset'
          ? 'All buttons on this page were removed.'
          : 'Imported (default) buttons were removed.',
      );
      setConfirmAction(null);
      setConfirmPassword('');
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setConfirmSaving(false);
    }
  };

  const saveBackground = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/mub/page?${queryString}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ backgroundColor: selectedBg }),
    });
    const data = await res.json();
    if (data.page) {
      setPage(data.page);
      setActivePanel(null);
    }
  };

  if (requiresUnlock && !editUnlocked) {
    if (!unlockChecked) {
      return <p className="px-4 py-6 text-sm text-gray-600">Loading…</p>;
    }
    return (
      <div className="mx-auto max-w-md rounded-lg border border-gray-300 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Enter admin password</h2>
        <p className="mb-4 text-sm text-gray-600">
          Super Admin password opens staff templates. Club Admin password (or your personal password) unlocks MUB settings.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded border border-gray-300 px-3 py-2"
          placeholder="Password"
        />
        {passwordError ? <p className="mb-2 text-sm text-red-600">{passwordError}</p> : null}
        <div className="flex gap-2">
          <button type="button" onClick={verifyPassword} className="rounded bg-red-700 px-4 py-2 text-white hover:bg-red-800">
            Continue
          </button>
          <Link href={mubPageUrl()} className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-800">
            Back to MUB page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="overflow-hidden rounded border border-gray-400 bg-[#ececec] shadow">
        {/* Top bar — User settings | Background Setting (PHP: movesbook.net/users/mub_page) */}
        <div className="flex items-center justify-between border-b border-gray-400 bg-[#d9d9d9] px-3 py-2">
          <div className="flex items-center gap-4">
            <Menu className="h-4 w-4 shrink-0 text-gray-700" />
            {mode !== 'staff' ? (
              <>
                <button
                  type="button"
                  onClick={goUserSettings}
                  className={`inline-flex items-center gap-1 text-sm font-semibold ${
                    activePanel === 'user' ? 'text-red-700 underline' : 'text-red-700 hover:underline'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  User settings
                </button>
                <button
                  type="button"
                  onClick={goBackgroundSetting}
                  className={`inline-flex items-center gap-1 text-sm font-semibold ${
                    activePanel === 'background' ? 'text-red-700 underline' : 'text-red-700 hover:underline'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  Background Setting
                </button>
              </>
            ) : (
              <span className="text-sm font-semibold text-red-700">Background Setting</span>
            )}
          </div>
          <Menu className="h-4 w-4 shrink-0 text-gray-700" />
        </div>

        <div className="flex items-center justify-between border-b border-gray-400 bg-[#bdbdbd] px-3 py-2 text-sm text-red-700">
          <span>{pageTitle}</span>
          <MubPreviewModeToggle
            value={previewMode}
            onChange={(mode) => void persistPreviewMode(mode)}
            size={buttonSize}
            onSizeChange={(size) => {
              setButtonSize(normalizeMubButtonSize(size));
              setReadingPageIndex(0);
            }}
            disabled={loading}
          />
        </div>

        {mode === 'staff' ? (
          <div className="flex flex-wrap gap-2 border-b border-gray-300 bg-white px-3 py-2">
            {MUB_STAFF_ROLE_TEMPLATES.map((role) => (
              <Link
                key={role.id}
                href={mubStaffPageUrl({ role: role.id, category })}
                className={`rounded px-3 py-1 text-xs font-semibold ${
                  staffRoleTemplate === role.id ? 'bg-red-700 text-white' : 'bg-gray-800 text-white'
                }`}
              >
                {role.label}
              </Link>
            ))}
          </div>
        ) : null}

        {showCategoryTabs ? (
        <div className="flex items-center justify-between border-b border-amber-200 bg-[#fff6bf] px-2 py-2">
          <div className="flex flex-wrap gap-2">
            {MUB_CATEGORIES.map((cat) => {
              const categoryActive =
                category === cat.id && (mode === 'staff' || hasCategoryInPath || isReadingSession);
              return (
              <button
                key={cat.id}
                type="button"
                onClick={() => goCategory(cat.id)}
                className={`rounded px-4 py-1.5 text-sm font-semibold ${
                  categoryActive ? 'bg-red-700 text-white' : 'bg-gray-900 text-white'
                }`}
              >
                {cat.legacyLabel}
              </button>
              );
            })}
          </div>
        </div>
        ) : null}

        {showCrud ? (
          <div className="flex items-center justify-between border-b border-gray-300 bg-[#dbeafe] px-3 py-2">
            <button
              type="button"
              onClick={() => {
                setForm(emptyMubButtonForm(language));
                setFormOpen(true);
              }}
              className="rounded bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Add a button
            </button>
            <div className="flex flex-wrap gap-2">
              {mode !== 'staff' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleImport()}
                    className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Import Movesbook MUB
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmError(null);
                      setConfirmPassword('');
                      setConfirmAction('remove_default');
                    }}
                    className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Remove MUB default
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setConfirmError(null);
                  setConfirmPassword('');
                  setConfirmAction('reset');
                }}
                className="rounded bg-gray-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Reset page
              </button>
            </div>
          </div>
        ) : null}

        {message ? (
          <div className="border-b border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">{message}</div>
        ) : null}

        {showBackgroundPanel ? (
          <div className="border-b border-red-700 bg-white p-4">
            <div className="mb-3 text-sm font-semibold text-red-700">Fill background</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
              {MUB_BACKGROUND_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`cursor-pointer rounded border p-2 text-center text-xs ${
                    selectedBg === opt.id ? 'border-black ring-2 ring-black' : 'border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="mub-bg"
                    className="mb-1"
                    checked={selectedBg === opt.id}
                    onChange={() => setSelectedBg(opt.id)}
                  />
                  <div className="mx-auto mb-1 h-8 w-full rounded border" style={{ backgroundColor: opt.css }} />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={goViewLanding} className="rounded border px-4 py-1.5">
                Cancel
              </button>
              <button type="button" onClick={() => void saveBackground()} className="rounded bg-green-700 px-4 py-1.5 text-white">
                OK
              </button>
            </div>
          </div>
        ) : null}

        {formOpen && canEdit ? (
          <MubButtonEditorForm
            form={form}
            setForm={setForm}
            saving={saving}
            uploadingIcon={uploadingIcon}
            onSave={() => void saveButton()}
            onCancel={() => setFormOpen(false)}
            onIconUpload={(file) => void uploadIcon(file)}
          />
        ) : null}

        <div
          className="min-h-[12rem] p-3"
          style={{ backgroundColor: mubBackgroundCss(page?.backgroundColor ?? 'white') }}
        >
          {loading ? (
            <p className="text-sm text-gray-600">Loading…</p>
          ) : showLoadPickerButton ? (
            <div className="flex min-h-[8rem] items-start">
              <button
                type="button"
                onClick={() => setLoadPickerOpen(true)}
                className="rounded bg-gray-800 px-6 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              >
                Mub to Load
              </button>
            </div>
          ) : !orderedButtons.length ? (
            <p className="text-sm text-gray-600">No buttons configured yet.</p>
          ) : showCrud || isReadingSession ? (
            <div className="space-y-3">
              {isReadingSession && loadSource ? (
                <p className="text-xs text-gray-600">
                  Loaded: {loadSource === 'movesbook' ? `Movesbook MUB (${userRoleTemplate}, ${language})` : 'Your User MUB'}
                  {sessionOrderIds ? ' — temporary order (not saved)' : ''}
                </p>
              ) : null}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={visibleButtons.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  {previewMode === 2 ? (
                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: `repeat(${sizeCount}, minmax(0, 1fr))` }}
                    >
                      {visibleButtons.map((btn) => (
                        <SortableMubButtonRow
                          key={btn.id}
                          button={btn}
                          compact
                          showActions={showCrud}
                          onEdit={showCrud ? () => openEdit(btn) : undefined}
                          onDelete={showCrud ? () => void deleteButton(btn.id) : undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {visibleButtons.map((btn) => (
                        <SortableMubButtonRow
                          key={btn.id}
                          button={btn}
                          showActions={showCrud}
                          onEdit={showCrud ? () => openEdit(btn) : undefined}
                          onDelete={showCrud ? () => void deleteButton(btn.id) : undefined}
                        />
                      ))}
                    </div>
                  )}
                </SortableContext>
              </DndContext>
              {isReadingSession && previewMode === 1 && readingPageCount > 1 ? (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={readingPageIndex <= 0}
                    onClick={() => setReadingPageIndex((p) => Math.max(0, p - 1))}
                    className="rounded border px-3 py-1 text-xs disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-xs text-gray-700">
                    Page {readingPageIndex + 1} / {readingPageCount}
                  </span>
                  <button
                    type="button"
                    disabled={readingPageIndex >= readingPageCount - 1}
                    onClick={() => setReadingPageIndex((p) => Math.min(readingPageCount - 1, p + 1))}
                    className="rounded border px-3 py-1 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {orderedButtons.map((btn) => (
                <div key={btn.id} className="flex items-stretch gap-2 rounded border border-gray-300/80 bg-white/40 p-2">
                  <MubButtonLink button={btn} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded border border-gray-400 bg-white p-5 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-gray-900">
              {confirmAction === 'reset' ? 'Reset page' : 'Remove MUB default'}
            </h3>
            <p className="mb-3 text-sm text-gray-600">
              {confirmAction === 'reset'
                ? 'This removes ALL buttons on this category page (yours and imported). Enter your personal password to continue.'
                : 'This removes only buttons imported from Movesbook MUB. Your manually created buttons stay. Enter your personal password to continue.'}
            </p>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Personal password"
              autoFocus
            />
            {confirmError ? <p className="mb-2 text-sm text-red-600">{confirmError}</p> : null}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmAction(null);
                  setConfirmPassword('');
                  setConfirmError(null);
                }}
                className="rounded border border-gray-400 px-4 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmSaving || !confirmPassword.trim()}
                onClick={() => void runProtectedAction()}
                className="rounded bg-red-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {confirmSaving ? 'Working…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loadPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded border border-gray-400 bg-white p-5 shadow-xl">
            <h3 className="mb-2 text-base font-semibold text-gray-900">Mub to Load</h3>
            <p className="mb-4 text-sm text-gray-600">Choose which MUB page to open in reading mode.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => chooseLoadSource('movesbook')}
                className="rounded bg-gray-900 px-4 py-2 text-left text-sm font-semibold text-white hover:bg-gray-800"
              >
                A — Movesbook MUB
                <span className="mt-0.5 block text-xs font-normal text-gray-300">
                  Template for {userRoleTemplate}, language {language}
                </span>
              </button>
              <button
                type="button"
                onClick={() => chooseLoadSource('user')}
                className="rounded bg-gray-900 px-4 py-2 text-left text-sm font-semibold text-white hover:bg-gray-800"
              >
                B — User MUB page
                <span className="mt-0.5 block text-xs font-normal text-gray-300">Your personal Most used buttons</span>
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setLoadPickerOpen(false)}
                className="rounded border border-gray-400 px-4 py-1.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SortableMubButtonRow({
  button,
  onEdit,
  onDelete,
  compact,
  showActions = true,
}: {
  button: MubButtonDto;
  onEdit?: () => void;
  onDelete?: () => void;
  compact?: boolean;
  showActions?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: button.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch gap-2 rounded border border-gray-300/80 bg-white/40 p-2 ${compact ? 'min-w-0' : ''}`}
    >
      <button
        type="button"
        className="mt-2 shrink-0 cursor-grab text-gray-500 active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <MubButtonLink button={button} compact={compact} />
      {showActions ? (
        <div className="flex shrink-0 flex-col gap-1">
          <button type="button" onClick={onEdit} className="rounded bg-gray-500 px-3 py-1 text-xs text-white">
            Edit
          </button>
          <button type="button" onClick={onDelete} className="rounded bg-amber-400 px-3 py-1 text-xs text-gray-900">
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MubButtonLink({ button, compact }: { button: MubButtonDto; compact?: boolean }) {
  // Re-checked at render: a `javascript:` href stored before sanitising existed
  // (or written straight to the database) must still never become a live link.
  const safeHref = sanitizeMubUrl(button.urlToOpen);
  const href = safeHref ?? '#';
  const hoverTitle = compact ? button.extendedText || button.shortText : undefined;
  const inner = (
    <MubButtonPreview
      button={{
        buttonColor: button.buttonColor,
        textFont: button.textFont,
        textColor: button.textColor,
        iconPath: sanitizeMubIconPath(button.iconPath) ?? '',
        iconSource: button.iconSource,
        shortText: button.shortText,
        extendedText: compact ? '' : button.extendedText,
      }}
      compact={compact}
    />
  );
  if (!safeHref) {
    return (
      <div className="block min-w-0" title={hoverTitle}>
        {inner}
      </div>
    );
  }

  if (button.pageToOpen === 'popup') {
    return (
      <a
        href={href}
        className="block min-w-0"
        title={hoverTitle}
        onClick={(e) => {
          e.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer,width=1024,height=768');
        }}
      >
        {inner}
      </a>
    );
  }

  if (button.pageToOpen === 'new_tab') {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block min-w-0" title={hoverTitle}>
        {inner}
      </a>
    );
  }

  // same_label — open in the central frame of the same tab
  return (
    <a href={href} className="block min-w-0" title={hoverTitle}>
      {inner}
    </a>
  );
}
