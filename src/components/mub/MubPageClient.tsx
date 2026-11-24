'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
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
  rectSortingStrategy,
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
import MubButtonPreview, { MUB_SIZE_STYLES } from '@/components/mub/MubButtonPreview';
import MubFrameView from '@/components/mub/MubFrameView';
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
import {
  clearMubUnlock,
  mubAuthTokenKey,
  readMubUnlock,
  writeMubUnlock,
  type MubUnlockKind,
} from '@/lib/mub/mubUnlockClient';

type MubPageMode = 'view' | 'edit' | 'staff';

const MUB_SIZE_STORAGE_KEY = 'mub:buttonSize';
type MubLoadSource = 'user' | 'movesbook';
/** What a successful password opens: the settings (A staff / B user) or the background panel. */
type MubGateTarget = 'settings' | 'background';

/**
 * The gear-password unlock is a signed token from `/api/mub/verify-access`, kept for
 * the browser tab (see `mubUnlockClient.ts`) and sent on every MUB write. The server
 * rejects writes without it, so this copy only decides whether to show the gate.
 */
function unlockKindFor(mode: MubPageMode, adminSession: boolean): MubUnlockKind | null {
  if (adminSession) return 'admin';
  return mode === 'edit' || mode === 'staff' ? mode : null;
}

/**
 * The whole button is a drag handle. Releasing the pointer after a drag would
 * otherwise also count as a click and open the button's link.
 */
let lastMubDragEndAt = 0;
const DRAG_CLICK_SUPPRESS_MS = 300;

/**
 * Opens a `same_label` button ("In the central frame of the same tab").
 * Provided by MubPageClient; null outside it (the link then behaves as a plain href).
 */
const MubOpenSameContext = createContext<((href: string, title: string) => void) | null>(null);

/** A Movesbook URL (relative path or this origin) — navigated inside the app, not framed. */
function internalAppPath(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  try {
    const url = new URL(href, window.location.href);
    if (url.origin === window.location.origin) return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    /* not a URL */
  }
  return null;
}

/** Server said the unlock is missing / expired / for another login. */
function isUnlockRequired(data: { code?: string } | null | undefined): boolean {
  return data?.code === 'mub_unlock_required';
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
  /**
   * Staff builder opened from the admin panel (/admin/mub): authenticated with the
   * Super Admin's admin-panel login (`adminToken`), unlocked without a second password.
   */
  adminSession?: boolean;
  /** Where staff-builder links point (user app or admin panel). */
  staffBasePath?: string;
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
  adminSession = false,
  staffBasePath,
}: MubPageClientProps) {
  const router = useRouter();
  const { currentLanguage: language } = useLanguage();
  const { user } = useAuth();
  const userRoleTemplate = roleTemplateFromUserType(user?.userType ?? 'ATHLETE');
  const [unlockToken, setUnlockToken] = useState<string | null>(null);
  const editUnlocked = Boolean(unlockToken);
  const unlockKind = unlockKindFor(mode, adminSession);
  /** Login token for API calls: the admin panel keeps its own (`adminToken`). */
  const authTokenKey = mubAuthTokenKey(adminSession ? 'admin' : 'edit');
  const [adminUnlockError, setAdminUnlockError] = useState<string | null>(null);
  /** sessionStorage is only readable after hydration; avoids flashing the gate. */
  const [unlockChecked, setUnlockChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  /** Inline password box under the top bar — which top-bar link opened it. */
  const [inlineGate, setInlineGate] = useState<MubGateTarget | null>(null);
  /** External page shown in the central frame (same_label buttons). */
  const [frame, setFrame] = useState<{ url: string; title: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
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
  const [buttonSize, setButtonSize] = useState<MubButtonSize>(1);
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
  /** Landing / settings hub have no buttons to show — "Mub to Load" now lives in the top bar. */
  const showLandingHint = (isViewLanding || isUserSettingsHub) && !isReadingSession;
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
    setUnlockToken(unlockKind ? readMubUnlock(unlockKind) : null);
    setUnlockChecked(true);
  }, [unlockKind]);

  // Admin panel: the Super Admin already signed in with username + password, so the
  // staff unlock is requested directly (the server checks he is an active Super Admin).
  useEffect(() => {
    if (!adminSession || !unlockChecked || unlockToken || adminUnlockError) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) throw new Error('Please log in to the admin panel first.');
        const res = await fetch('/api/mub/verify-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ adminSession: true }),
        });
        const data = (await res.json()) as { error?: string; unlockToken?: string; expiresAt?: number };
        if (!res.ok || !data.unlockToken || !data.expiresAt) {
          throw new Error(data.error || 'Could not open the Movesbook MUB settings.');
        }
        if (cancelled) return;
        writeMubUnlock('admin', data.unlockToken, data.expiresAt);
        setUnlockToken(data.unlockToken);
      } catch (err) {
        if (!cancelled) {
          setAdminUnlockError(err instanceof Error ? err.message : 'Could not open the Movesbook MUB settings.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminSession, unlockChecked, unlockToken, adminUnlockError]);

  // S / M / L is a per-browser display preference (no DB column yet).
  useEffect(() => {
    try {
      setButtonSize(normalizeMubButtonSize(Number(localStorage.getItem(MUB_SIZE_STORAGE_KEY) ?? 1)));
    } catch {
      /* storage blocked — keep S */
    }
  }, []);

  const changeButtonSize = (size: MubButtonSize) => {
    const next = normalizeMubButtonSize(size);
    setButtonSize(next);
    setReadingPageIndex(0);
    try {
      localStorage.setItem(MUB_SIZE_STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  };

  /** Headers for MUB API calls: login token plus the unlock token when we have one. */
  const mubHeaders = useCallback(
    (json = false): Record<string, string> => {
      const token = localStorage.getItem(authTokenKey);
      return {
        ...(json ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(unlockToken ? { 'X-Mub-Unlock': unlockToken } : {}),
      };
    },
    [unlockToken, authTokenKey],
  );

  /**
   * same_label — "In the central frame of the same tab":
   * - Movesbook pages: in-app navigation (header and sidebars stay, no reload).
   * - External http(s) pages: shown in the central frame (MubFrameView).
   * - mailto: / tel: — handed to the browser as usual.
   */
  const openInCentralFrame = useCallback(
    (href: string, title: string) => {
      const internal = internalAppPath(href);
      if (internal) {
        router.push(internal);
        return;
      }
      if (/^https?:/i.test(href)) {
        setFrame({ url: href, title });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      window.location.href = href;
    },
    [router],
  );

  /** Drop a stale unlock and send the user back to the password gate. */
  const relock = useCallback(() => {
    if (unlockKind) clearMubUnlock(unlockKind);
    setUnlockToken(null);
    // Admin panel re-unlocks by itself (effect above); elsewhere the gate reappears.
    if (!adminSession) {
      setPasswordError('Your MUB settings session expired. Please enter the password again.');
    }
  }, [unlockKind, adminSession]);

  useEffect(() => {
    setActivePanel(initialPanel);
  }, [initialPanel]);

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setLoadSource(initialLoadSource);
  }, [initialLoadSource]);

  // Any navigation to another MUB view closes the central frame.
  useEffect(() => {
    setFrame(null);
  }, [mode, initialPanel, initialCategory, initialLoadSource, hasCategoryInPath]);

  /** Keep `edit=1` on internal navigation so the unlocked session stays in edit mode. */
  const keepEdit = mode === 'edit';
  const openInlineGate = (target: MubGateTarget) => {
    setPassword('');
    setPasswordError(null);
    setLoadPickerOpen(false);
    setInlineGate(target);
  };
  /**
   * "User settings" always asks for the password: the password decides where it
   * goes (Super Admin → Movesbook MUB settings, club admin → user MUB settings).
   */
  const goUserSettings = () => openInlineGate('settings');
  /** Background only needs the user unlock; ask for it only when it is missing. */
  const goBackgroundSetting = () => {
    if (readMubUnlock('edit')) {
      router.push(mubPageUrl({ panel: 'background', edit: true }));
      return;
    }
    openInlineGate('background');
  };
  const goCategory = (cat: MubCategory) => {
    if (mode === 'staff') {
      // Stay on STAFF scope — never navigate to user MUB (would load personal buttons).
      router.push(mubStaffPageUrl({ role: staffRoleTemplate, category: cat, basePath: staffBasePath }));
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
    const token = localStorage.getItem(authTokenKey);
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
  }, [queryString, language, authTokenKey]);

  useEffect(() => {
    // Staff templates are only fetched once the gate is open, so a locked page
    // does not fire a request the API will reject anyway.
    // The background panel loads too, so it opens on the saved colour instead of "White".
    const shouldLoad =
      mode === 'staff'
        ? editUnlocked
        : hasCategoryInPath || isReadingSession || showBackgroundPanel;
    if (shouldLoad) {
      void loadPage();
    } else {
      setLoading(false);
      setPage(null);
    }
  }, [loadPage, mode, hasCategoryInPath, isReadingSession, editUnlocked, showBackgroundPanel]);

  const postAction = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/mub/actions?${queryString}&lang=${encodeURIComponent(language)}`, {
      method: 'POST',
      headers: mubHeaders(true),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (isUnlockRequired(data)) relock();
    if (!res.ok) throw new Error(data.error || 'action_failed');
    if (data.page) setPage(data.page);
    return data;
  };

  const saveButton = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/mub/buttons?${queryString}&lang=${encodeURIComponent(language)}`, {
        method: 'POST',
        headers: mubHeaders(true),
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
      if (isUnlockRequired(data)) relock();
      if (!res.ok) throw new Error(data.error || 'save_failed');
      setPage(data.page);
      setFormOpen(false);
      setForm(emptyMubButtonForm(language));
      setMessage(null);
    } catch (err) {
      const detail = err instanceof Error && err.message !== 'save_failed' ? ` (${err.message})` : '';
      setMessage(`Could not save button${detail}. Please try again.`);
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
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/mub/icon-upload', {
        method: 'POST',
        headers: mubHeaders(),
        body,
      });
      const data = await res.json();
      if (isUnlockRequired(data)) relock();
      if (!res.ok) throw new Error(data.error || 'upload_failed');
      setForm((f) => ({ ...f, iconPath: data.path, iconFileName: data.fileName ?? file.name }));
    } catch (err) {
      const detail = err instanceof Error && err.message !== 'upload_failed' ? ` ${err.message}` : '';
      setMessage(`Could not upload icon.${detail}`);
    } finally {
      setUploadingIcon(false);
    }
  };

  const deleteButton = async (id: string) => {
    if (!window.confirm('Delete this button?')) return;
    const res = await fetch(
      `/api/mub/buttons?${queryString}&lang=${encodeURIComponent(language)}&id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: mubHeaders(),
      },
    );
    const data = await res.json();
    if (isUnlockRequired(data)) relock();
    if (!res.ok) {
      setMessage(data.error || 'Could not delete this button.');
      return;
    }
    if (data.page) setPage(data.page);
  };

  const verifyPassword = async (target: MubGateTarget = 'settings') => {
    if (!password.trim() || verifying) return;
    setPasswordError(null);
    setVerifying(true);
    try {
      const token = localStorage.getItem(authTokenKey);
      const res = await fetch('/api/mub/verify-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as {
        access?: string;
        error?: string;
        unlockToken?: string;
        expiresAt?: number;
        roleTemplate?: MubRoleTemplate;
      };
      if (!res.ok) throw new Error(data.error || 'verify_failed');
      if (!data.unlockToken || !data.expiresAt) throw new Error('verify_failed');

      if (target === 'background') {
        // Any valid MUB password unlocks the user's own background (the server
        // accepts every unlock level for USER-scope writes).
        writeMubUnlock('edit', data.unlockToken, data.expiresAt);
        setUnlockToken(data.unlockToken);
        setPassword('');
        setInlineGate(null);
        router.push(mubPageUrl({ panel: 'background', edit: true }));
        return;
      }

      // A — Super Admin password: Movesbook MUB settings for this account's user type
      //     (ID5 single user, ID6 coach, ID7 team, ID8 club, ID9 group).
      if (data.access === 'staff') {
        writeMubUnlock('staff', data.unlockToken, data.expiresAt);
        // The server picks the template from the stored account type (ID5–ID9).
        const template = data.roleTemplate ?? roleTemplateFromUserType(user?.userType ?? 'ATHLETE');
        setPassword('');
        setInlineGate(null);
        router.push(mubStaffPageUrl({ role: template }));
        return;
      }
      // B — club admin password (or personal password): the user's MUB settings.
      if (data.access === 'club' || data.access === 'user') {
        writeMubUnlock('edit', data.unlockToken, data.expiresAt);
        setUnlockToken(data.unlockToken);
        setPassword('');
        setInlineGate(null);
        router.push(mubPageUrl({ setting: true, edit: true }));
        return;
      }
      setPasswordError(data.error || 'Invalid password.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setPasswordError(!msg || msg === 'verify_failed' ? 'Invalid password.' : msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleImport = async () => {
    try {
      // The template is chosen server-side from the account's userType.
      const data = await postAction({ action: 'import' });
      const by = (data.importedByCategory ?? {}) as Partial<Record<MubCategory, number>>;
      setMessage(
        `${data.importedCount ?? 0} button(s) imported for language "${language}" ` +
          `(Club management ${by.CLUB_MANAGEMENT ?? 0}, Workout ${by.WORKOUT ?? 0}, Social ${by.SOCIAL ?? 0}). ` +
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
      const res = await fetch(`/api/mub/buttons?${queryString}&lang=${encodeURIComponent(language)}`, {
        method: 'POST',
        headers: mubHeaders(true),
        body: JSON.stringify({ orderedIds }),
      });
      const data = await res.json();
      if (isUnlockRequired(data)) relock();
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
    lastMubDragEndAt = Date.now();
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
      const res = await fetch(`/api/mub/page?${queryString}`, {
        method: 'PATCH',
        headers: mubHeaders(true),
        body: JSON.stringify({ displayMode: next }),
      });
      if (!res.ok && isUnlockRequired(await res.json().catch(() => null))) relock();
    } catch {
      /* preview still updates client-side */
    }
  };

  const runProtectedAction = async () => {
    if (!confirmAction) return;
    setConfirmSaving(true);
    setConfirmError(null);
    try {
      const data = await postAction({ action: confirmAction, password: confirmPassword });
      setMessage(
        confirmAction === 'reset'
          ? 'All buttons on this page were removed.'
          : `${data.removedCount ?? 0} imported (default) button(s) were removed from all sections. Your own buttons were kept.`,
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
    setSaving(true);
    try {
      const res = await fetch(`/api/mub/page?${queryString}`, {
        method: 'PATCH',
        headers: mubHeaders(true),
        body: JSON.stringify({ backgroundColor: selectedBg }),
      });
      const data = await res.json();
      if (isUnlockRequired(data)) relock();
      if (!res.ok || !data.page) throw new Error(data.error || 'background_failed');
      setPage(data.page);
      // Background applies to all three categories — back to the settings hub.
      router.push(mubPageUrl({ setting: true, edit: keepEdit }));
    } catch (err) {
      const detail = err instanceof Error && err.message !== 'background_failed' ? ` (${err.message})` : '';
      setMessage(`Could not save the background${detail}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  if (requiresUnlock && !editUnlocked) {
    if (!unlockChecked) {
      return <p className="px-4 py-6 text-sm text-gray-600">Loading…</p>;
    }
    if (adminSession) {
      return adminUnlockError ? (
        <div className="mx-auto max-w-md rounded-lg border border-red-300 bg-white p-6 text-sm text-red-700 shadow">
          {adminUnlockError}
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-gray-600">Opening the Movesbook MUB settings…</p>
      );
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') void verifyPassword('settings');
          }}
          className="mb-3 w-full rounded border border-gray-300 px-3 py-2"
          placeholder="Password"
          autoFocus
        />
        {passwordError ? <p className="mb-2 text-sm text-red-600">{passwordError}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void verifyPassword('settings')}
            disabled={verifying}
            className="rounded bg-red-700 px-4 py-2 text-white hover:bg-red-800 disabled:opacity-50"
          >
            Continue
          </button>
          <Link href={mubPageUrl()} className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-800">
            Back to MUB page
          </Link>
        </div>
      </div>
    );
  }

  if (frame) {
    return <MubFrameView url={frame.url} title={frame.title} onBack={() => setFrame(null)} />;
  }

  return (
    <MubOpenSameContext.Provider value={openInCentralFrame}>
    <div className="w-full">
      <div className="overflow-hidden rounded border border-gray-400 bg-[#ececec] shadow">
        {/* Top bar — left: Mub to Load · right: User settings | Background Setting */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-400 bg-[#d9d9d9] px-3 py-2">
          <div className="flex items-center gap-4">
            <Menu className="h-4 w-4 shrink-0 text-gray-700" />
            {mode !== 'staff' ? (
              <button
                type="button"
                onClick={() => {
                  setInlineGate(null);
                  setLoadPickerOpen(true);
                }}
                className="rounded bg-gray-800 px-4 py-1 text-sm font-semibold text-white hover:bg-gray-700"
              >
                Mub to Load
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            {mode !== 'staff' ? (
              <>
                <button
                  type="button"
                  onClick={goUserSettings}
                  className={`inline-flex items-center gap-1 text-sm font-semibold ${
                    activePanel === 'user' || inlineGate === 'settings'
                      ? 'text-red-700 underline'
                      : 'text-red-700 hover:underline'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  User settings
                </button>
                <button
                  type="button"
                  onClick={goBackgroundSetting}
                  className={`inline-flex items-center gap-1 text-sm font-semibold ${
                    activePanel === 'background' || inlineGate === 'background'
                      ? 'text-red-700 underline'
                      : 'text-red-700 hover:underline'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  Background Setting
                </button>
              </>
            ) : (
              <span className="text-sm font-semibold text-red-700">Background Setting</span>
            )}
            <Menu className="h-4 w-4 shrink-0 text-gray-700" />
          </div>
        </div>

        {inlineGate ? (
          <form
            className="flex justify-center border-b border-gray-300 bg-white px-3 py-5"
            onSubmit={(e) => {
              e.preventDefault();
              void verifyPassword(inlineGate);
            }}
          >
            <div className="w-full max-w-md rounded border border-red-700 px-5 py-4">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <label htmlFor="mub-inline-password" className="text-sm font-semibold text-red-700">
                  Type the password
                </label>
                <input
                  id="mub-inline-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-56 rounded border border-gray-400 px-2 py-1 text-sm"
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
              {passwordError ? (
                <p className="mt-2 text-center text-sm text-red-600">{passwordError}</p>
              ) : null}
              <div className="mt-3 flex justify-center gap-3">
                <button
                  type="submit"
                  disabled={verifying || !password.trim()}
                  className="rounded bg-red-700 px-6 py-1.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {verifying ? 'Checking…' : 'Ok'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInlineGate(null);
                    setPassword('');
                    setPasswordError(null);
                  }}
                  className="rounded border border-gray-400 px-6 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        ) : null}

        <div className="flex items-center justify-between border-b border-gray-400 bg-[#bdbdbd] px-3 py-2 text-sm text-red-700">
          <span>{pageTitle}</span>
          <MubPreviewModeToggle
            value={previewMode}
            onChange={(mode) => void persistPreviewMode(mode)}
            size={buttonSize}
            onSizeChange={changeButtonSize}
            disabled={loading}
          />
        </div>

        {mode === 'staff' ? (
          <div className="flex flex-wrap gap-2 border-b border-gray-300 bg-white px-3 py-2">
            {MUB_STAFF_ROLE_TEMPLATES.map((role) => (
              <Link
                key={role.id}
                href={mubStaffPageUrl({ role: role.id, category, basePath: staffBasePath })}
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
            <div className="mb-1 text-sm font-semibold text-red-700">Fill background</div>
            <p className="mb-3 text-xs text-gray-600">
              Applies to all MUB sections (Club management, Workout and Social).
            </p>
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
              <button
                type="button"
                onClick={() => void saveBackground()}
                disabled={saving || loading}
                className="rounded bg-green-700 px-4 py-1.5 text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'OK'}
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
          style={{
            backgroundColor: mubBackgroundCss(
              showBackgroundPanel ? selectedBg : (page?.backgroundColor ?? 'white'),
            ),
          }}
        >
          {loading ? (
            <p className="text-sm text-gray-600">Loading…</p>
          ) : showBackgroundPanel ? (
            <p className="text-sm text-gray-600">Background preview</p>
          ) : showLandingHint ? (
            <p className="text-sm text-gray-600">
              {isUserSettingsHub && canEdit
                ? 'Choose Club management, Workout section or Social section to edit its buttons.'
                : "Use 'Mub to Load' to open a MUB page."}
            </p>
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
                <SortableContext
                  items={visibleButtons.map((b) => b.id)}
                  strategy={previewMode === 2 ? rectSortingStrategy : verticalListSortingStrategy}
                >
                  {previewMode === 2 ? (
                    // Label mode (B): every button keeps its S/M/L size and a gap from its
                    // neighbours; rows wrap instead of squeezing buttons into narrow columns.
                    <div
                      className="flex flex-wrap items-start gap-3"
                      style={{ maxWidth: labelRowMaxWidth(buttonSize, sizeCount, showCrud) }}
                    >
                      {visibleButtons.map((btn) => (
                        <SortableMubButtonRow
                          key={btn.id}
                          button={btn}
                          compact
                          size={buttonSize}
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
                          size={buttonSize}
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
                  <MubButtonLink button={btn} size={buttonSize} />
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
                : 'This removes only buttons imported from Movesbook MUB, in all three sections. Your manually created buttons stay. Enter your personal password to continue.'}
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
    </MubOpenSameContext.Provider>
  );
}

function SortableMubButtonRow({
  button,
  onEdit,
  onDelete,
  compact,
  size = 1,
  showActions = true,
}: {
  button: MubButtonDto;
  onEdit?: () => void;
  onDelete?: () => void;
  compact?: boolean;
  size?: MubButtonSize;
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
    // The whole card is the drag handle (not only the grip). The pointer sensor's
    // 6px activation distance keeps plain clicks on the button / Edit / Delete working.
    <div
      ref={setNodeRef}
      style={style}
      className={`flex cursor-grab select-none items-stretch gap-2 rounded border border-gray-300/80 bg-white/40 p-2 active:cursor-grabbing ${
        compact ? 'shrink-0' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <span className="shrink-0 self-center text-gray-500" aria-hidden>
        <GripVertical className="h-4 w-4" />
      </span>
      <MubButtonLink button={button} compact={compact} size={size} />
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

function MubButtonLink({
  button,
  compact,
  size = 1,
}: {
  button: MubButtonDto;
  compact?: boolean;
  size?: MubButtonSize;
}) {
  // Re-checked at render: a `javascript:` href stored before sanitising existed
  // (or written straight to the database) must still never become a live link.
  const safeHref = sanitizeMubUrl(button.urlToOpen);
  const href = safeHref ?? '#';
  const hoverTitle = compact ? button.extendedText || button.shortText : undefined;
  const linkClass = 'block min-w-0';
  const openSame = useContext(MubOpenSameContext);
  const suppressClickAfterDrag = (e: React.MouseEvent) => {
    if (Date.now() - lastMubDragEndAt < DRAG_CLICK_SUPPRESS_MS) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
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
      size={size}
    />
  );
  if (!safeHref) {
    return (
      <div className={linkClass} title={hoverTitle}>
        {inner}
      </div>
    );
  }

  if (button.pageToOpen === 'popup') {
    return (
      <a
        href={href}
        className={linkClass}
        title={hoverTitle}
        draggable={false}
        onClickCapture={suppressClickAfterDrag}
        onClick={(e) => {
          e.preventDefault();
          if (Date.now() - lastMubDragEndAt < DRAG_CLICK_SUPPRESS_MS) return;
          window.open(href, '_blank', 'noopener,noreferrer,width=1024,height=768');
        }}
      >
        {inner}
      </a>
    );
  }

  if (button.pageToOpen === 'new_tab') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        title={hoverTitle}
        draggable={false}
        onClickCapture={suppressClickAfterDrag}
      >
        {inner}
      </a>
    );
  }

  // same_label — open in the central frame of the same tab (never a full-page jump).
  return (
    <a
      href={href}
      className={linkClass}
      title={hoverTitle}
      draggable={false}
      onClickCapture={suppressClickAfterDrag}
      onClick={(e) => {
        if (!openSame) return; // outside the MUB page: plain link
        // Ctrl/Cmd/middle-click keep the browser's own "open in new tab".
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (Date.now() - lastMubDragEndAt < DRAG_CLICK_SUPPRESS_MS) return;
        openSame(href, button.shortText);
      }}
    >
      {inner}
    </a>
  );
}

/**
 * Width cap for label mode (B) so a row holds at most `perRow` buttons
 * (S 8 / M 6 / L 4). Card = padding + grip + gap + button (+ Edit/Delete column).
 */
function labelRowMaxWidth(size: MubButtonSize, perRow: number, withActions: boolean): number {
  const card = 18 + 16 + 8 + MUB_SIZE_STYLES[size].buttonWidth + (withActions ? 8 + 64 : 0);
  const gap = 12;
  return perRow * card + (perRow - 1) * gap;
}
