'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Bell,
  Link2,
  QrCode,
  Settings,
  UserPlus,
  User,
  Users,
  VolumeX,
  Search,
  Trash2,
  ChevronRight,
  ChevronDown,
  Send,
  Camera,
  Shield,
  SlidersHorizontal,
  X,
  Check,
  ArrowLeft,
  ShieldPlus,
  Copy,
  Forward,
  Pin,
  Mic,
  Square,
} from 'lucide-react';
import ChatSettingsUsersModal, {
  defaultChatUserFilterSettings,
  type ChatUserFilterSettings,
} from './ChatSettingsUsersModal';
import ChatMemberGroupSelectModal from './ChatMemberGroupSelectModal';
import AdminChatUsersPanel from './AdminChatUsersPanel';
import {
  buildAudioContent,
  buildImageContent,
  isImageContent,
  messagePreview,
  parseAudioContent,
  parseImageContent,
} from '@/lib/chat/messageContent';
import { chatDayKey, chatDayLabel } from '@/lib/chat/chatDayLabel';
import { useChatVoiceRecording } from '@/hooks/useChatVoiceRecording';

type BroadcastMode = 'all' | 'group' | 'subscribers' | 'favourites';

/** Owner-sent channel broadcasts only (never replies / Chat-users channel posts). */
const OWNER_BROADCAST_MODES = new Set<string>(['all', 'group', 'subscribers', 'favourites']);

type BroadcastMessage = {
  id: string;
  content: string;
  createdAt: string;
  mode: BroadcastMode;
  senderName?: string;
};

type ConversationOption = {
  id: string;
  otherUser: { id: string; name: string };
};

type ContextMenuState = {
  x: number;
  y: number;
  message: BroadcastMessage;
};

function previewText(content: string, max = 80): string {
  return messagePreview(content, max);
}

type ChannelSubscriber = {
  id: number | string;
  name: string;
  telegramAccount: string | null;
  image: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt?: string | null;
};

function formatTelegramId(telegramAccount: string | null | undefined): string {
  const raw = (telegramAccount || '').trim();
  if (!raw) return '';
  return raw.startsWith('@') ? raw : `@${raw}`;
}

function formatSubscriberPrimaryLabel(
  name: string,
  telegramAccount: string | null | undefined
): string {
  const memberName = (name || '').trim();
  const tg = formatTelegramId(telegramAccount);
  if (memberName && tg) {
    const nameNorm = memberName.toLowerCase().replace(/^@+/, '');
    const tgNorm = tg.toLowerCase().replace(/^@+/, '');
    if (nameNorm === tgNorm) return tg;
    return `${memberName} · ${tg}`;
  }
  return tg || memberName || 'Member';
}

function formatJoinedAt(iso: string | null | undefined): string {
  if (!iso) return 'joined recently';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'joined recently';
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `joined ${datePart} at ${timePart}`;
}

type OptionsPayload = {
  sports: { value: string; label: string }[];
  userTypes: { value: string; label: string }[];
  countries: string[];
};

const SETTINGS_KEY = 'adminChatUserSettings';
const MEMBER_GROUP_KEY = 'selectedMemberGroupId';
const MEMBER_GROUP_NAME_KEY = 'selectedMemberGroupName';
const HISTORY_KEY = 'adminChatBroadcastHistory';
const MUTE_KEY = 'adminChatMute';
const PHOTO_KEY = 'adminChatChannelPhoto';
const SIGN_MESSAGES_KEY = 'adminChatSignMessages';
const SHOW_AUTHORS_KEY = 'adminChatShowAuthorsProfiles';
const PIN_KEY = 'adminChatBroadcastPinnedId';
const HIDDEN_KEY = 'adminChatBroadcastHiddenIds';
/** Persisted user IDs that belong to this broadcast channel (not all platform users). */
const SUBSCRIBERS_KEY = 'adminChatChannelSubscriberIds';
/** Persisted channel admin user IDs (in addition to the owner). */
const ADMINS_KEY = 'adminChatChannelAdminIds';

function loadPinnedId(clubId?: string | null): string | null {
  try {
    return localStorage.getItem(storageKey(PIN_KEY, clubId));
  } catch {
    return null;
  }
}

function savePinnedId(id: string | null, clubId?: string | null) {
  try {
    const key = storageKey(PIN_KEY, clubId);
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function loadHiddenIds(clubId?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(HIDDEN_KEY, clubId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map(String).filter(Boolean));
  } catch {
    return new Set();
  }
}

function saveHiddenIds(ids: Set<string>, clubId?: string | null) {
  try {
    localStorage.setItem(storageKey(HIDDEN_KEY, clubId), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function loadIdList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => String(id)).filter(Boolean);
  } catch {
    return [];
  }
}

function saveIdList(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify([...new Set(ids)]));
}

function loadSubscriberIds(clubId?: string | null): string[] {
  return loadIdList(storageKey(SUBSCRIBERS_KEY, clubId));
}

function saveSubscriberIds(ids: string[], clubId?: string | null) {
  saveIdList(storageKey(SUBSCRIBERS_KEY, clubId), ids);
}

function loadAdminIds(clubId?: string | null): string[] {
  return loadIdList(storageKey(ADMINS_KEY, clubId));
}

function saveAdminIds(ids: string[], clubId?: string | null) {
  saveIdList(storageKey(ADMINS_KEY, clubId), ids);
}

function loadSelectedMemberGroupId(clubId?: string | null): string | null {
  try {
    return localStorage.getItem(storageKey(MEMBER_GROUP_KEY, clubId));
  } catch {
    return null;
  }
}

function saveSelectedMemberGroupId(groupId: string | null, clubId?: string | null) {
  try {
    const idKey = storageKey(MEMBER_GROUP_KEY, clubId);
    const nameKey = storageKey(MEMBER_GROUP_NAME_KEY, clubId);
    if (groupId) localStorage.setItem(idKey, groupId);
    else localStorage.removeItem(idKey);
    if (!groupId) localStorage.removeItem(nameKey);
  } catch {
    /* ignore */
  }
}

function saveSelectedMemberGroupName(name: string | null, clubId?: string | null) {
  try {
    const nameKey = storageKey(MEMBER_GROUP_NAME_KEY, clubId);
    if (name?.trim()) localStorage.setItem(nameKey, name.trim());
    else localStorage.removeItem(nameKey);
  } catch {
    /* ignore */
  }
}

function loadSelectedMemberGroupName(clubId?: string | null): string {
  try {
    return localStorage.getItem(storageKey(MEMBER_GROUP_NAME_KEY, clubId)) ?? '';
  } catch {
    return '';
  }
}

function loadUserSettingsFromStorage(clubId?: string | null): ChatUserFilterSettings {
  try {
    if (typeof window === 'undefined') return defaultChatUserFilterSettings;
    const saved = localStorage.getItem(storageKey(SETTINGS_KEY, clubId));
    if (!saved) return defaultChatUserFilterSettings;
    const parsed = JSON.parse(saved) as Partial<ChatUserFilterSettings> | null;
    if (!parsed || typeof parsed !== 'object') return defaultChatUserFilterSettings;
    return {
      sports: Array.isArray(parsed.sports) ? parsed.sports.map(String) : [],
      userTypes: Array.isArray(parsed.userTypes) ? parsed.userTypes.map(String) : [],
      countries: Array.isArray(parsed.countries) ? parsed.countries.map(String) : [],
    };
  } catch {
    return defaultChatUserFilterSettings;
  }
}

const PLATFORM_MODE_LABELS: Record<BroadcastMode, string> = {
  all: 'Start chat with all users',
  group: 'Start chat with group selected',
  subscribers: 'Start chat with subscribers',
  favourites: 'Start chat with favourites',
};

const CLUB_MODE_LABELS: Record<BroadcastMode, string> = {
  all: 'Start chat with all members',
  group: 'Start chat with group selected',
  subscribers: 'Start chat with subscribers',
  favourites: 'Start chat with favourites',
};

/** Audience label shown on each owner broadcast bubble. */
const PLATFORM_SENT_LABELS: Record<BroadcastMode, string> = {
  all: 'Sent to all users',
  group: 'Sent to only group selected',
  subscribers: 'Sent to only subscribers',
  favourites: 'Sent to only favourites',
};

const CLUB_SENT_LABELS: Record<BroadcastMode, string> = {
  all: 'Sent to all members',
  group: 'Sent to only group selected',
  subscribers: 'Sent to only subscribers',
  favourites: 'Sent to only favourites',
};

/** Display handle under Scan QR code, e.g. "Movesbook" → "t.me/movesbook". */
function channelNameToTelegramHandle(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `t.me/${slug || 'channel'}`;
}

function storageKey(base: string, clubId?: string | null): string {
  const id = typeof clubId === 'string' ? clubId.trim() : '';
  return id ? `clubChat:${id}:${base}` : base;
}

function clubQuery(clubId?: string | null): string {
  const id = typeof clubId === 'string' ? clubId.trim() : '';
  return id ? `clubId=${encodeURIComponent(id)}` : '';
}

function withClubQuery(url: string, clubId?: string | null): string {
  const q = clubQuery(clubId);
  if (!q) return url;
  return url.includes('?') ? `${url}&${q}` : `${url}?${q}`;
}

const AVATAR_COLORS = [
  '#e17076',
  '#efa5bb',
  '#a695e7',
  '#7bc862',
  '#6ec9cb',
  '#65aadd',
  '#ee7aae',
  '#e4b562',
];

function subscriberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function subscriberAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type AdminChatExperienceProps = {
  getAuthHeaders: () => Record<string, string>;
  /** When set, scopes broadcast to this club's members (Club Channel). */
  clubId?: string | null;
};

export default function AdminChatExperience({
  getAuthHeaders,
  clubId = null,
}: AdminChatExperienceProps) {
  const isClubChannel = Boolean(clubId?.trim());
  const MODE_LABELS = isClubChannel ? CLUB_MODE_LABELS : PLATFORM_MODE_LABELS;
  const BROADCAST_SENT_LABELS = isClubChannel ? CLUB_SENT_LABELS : PLATFORM_SENT_LABELS;
  const defaultSenderName = isClubChannel ? 'Club admin' : 'Movesbook admin';
  const channelAvatarFallback = isClubChannel ? 'CC' : 'MB';
  const histKey = storageKey(HISTORY_KEY, clubId);
  const muteKey = storageKey(MUTE_KEY, clubId);
  const photoKey = storageKey(PHOTO_KEY, clubId);
  const signKey = storageKey(SIGN_MESSAGES_KEY, clubId);
  const authorsKey = storageKey(SHOW_AUTHORS_KEY, clubId);
  const settingsKey = storageKey(SETTINGS_KEY, clubId);

  const [mode, setMode] = useState<BroadcastMode>('all');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<BroadcastMessage[]>([]);
  /** Users with Telegram who replied to channel broadcasts (Chat users inbox). */
  const [chatUsersCount, setChatUsersCount] = useState(0);
  const [modeCounts, setModeCounts] = useState<Record<BroadcastMode, number>>({
    all: 0,
    group: 0,
    subscribers: 0,
    favourites: 0,
  });

  const [showSettingsUsers, setShowSettingsUsers] = useState(false);
  const [showMemberGroupSelect, setShowMemberGroupSelect] = useState(false);
  const [selectedMemberGroupId, setSelectedMemberGroupId] = useState<string | null>(() =>
    isClubChannel ? loadSelectedMemberGroupId(clubId) : null
  );
  const [selectedMemberGroupName, setSelectedMemberGroupName] = useState(() =>
    isClubChannel ? loadSelectedMemberGroupName(clubId) : ''
  );
  const [userSettings, setUserSettings] = useState<ChatUserFilterSettings>(() =>
    loadUserSettingsFromStorage(clubId)
  );
  const [options, setOptions] = useState<OptionsPayload | null>(null);

  const [showComposerMenu, setShowComposerMenu] = useState(false);
  const [showMuteSubmenu, setShowMuteSubmenu] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  /** Toolbar section: Broadcast chat vs Chat users (1:1). Null = neither open yet. */
  const [mainView, setMainView] = useState<'broadcast' | 'chatUsers' | null>(null);
  const [showBroadcastPanel, setShowBroadcastPanel] = useState(false);
  const [broadcastPanelView, setBroadcastPanelView] = useState<
    'invite' | 'edit' | 'subscribers' | 'administrators' | 'addSubscribers' | 'addAdministrators'
  >('invite');
  const [channelPhoto, setChannelPhoto] = useState<string | null>(null);
  const [channelName, setChannelName] = useState(isClubChannel ? 'Club Channel' : 'Movesbook channel');
  const [channelDescription, setChannelDescription] = useState('');
  const [savingChannelSettings, setSavingChannelSettings] = useState(false);
  const [subscriberIds, setSubscriberIds] = useState<string[]>([]);
  const [subscribers, setSubscribers] = useState<ChannelSubscriber[]>([]);
  const [subscriberSearchOpen, setSubscriberSearchOpen] = useState(false);
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [channelAdmins, setChannelAdmins] = useState<ChannelSubscriber[]>([]);
  const [addCandidates, setAddCandidates] = useState<ChannelSubscriber[]>([]);
  const [addSearch, setAddSearch] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addAdminSearchOpen, setAddAdminSearchOpen] = useState(false);
  const [ownerName, setOwnerName] = useState(isClubChannel ? 'Club admin' : 'Admin');
  const [signMessages, setSignMessages] = useState(false);
  const [showAuthorsProfiles, setShowAuthorsProfiles] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [forwardingMessage, setForwardingMessage] = useState<BroadcastMessage | null>(null);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BroadcastMessage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [floatingDayLabel, setFloatingDayLabel] = useState<string | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);

  const composerMenuRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const floatingDayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/register?invite=${isClubChannel ? `club-${clubId}` : 'movesbook-admin'}`
      : isClubChannel
        ? 'https://movesbook.app/register?invite=club'
        : 'https://movesbook.app/register?invite=movesbook-admin';
  useEffect(() => {
    try {
      // Settings are initialized from localStorage; refresh other persisted UI state here.
      const hist = localStorage.getItem(histKey);
      if (hist) {
        const parsed = JSON.parse(hist) as unknown;
        if (Array.isArray(parsed)) {
          setHistory(
            parsed.filter(
              (m): m is BroadcastMessage =>
                !!m &&
                typeof m === 'object' &&
                typeof (m as BroadcastMessage).content === 'string' &&
                OWNER_BROADCAST_MODES.has(String((m as BroadcastMessage).mode))
            ) as BroadcastMessage[]
          );
        }
      }
      setMuted(localStorage.getItem(muteKey) === '1');
      setPinnedId(loadPinnedId(clubId));
      setHiddenIds(loadHiddenIds(clubId));
      const photo = localStorage.getItem(photoKey);
      if (photo) setChannelPhoto(photo);
      setSignMessages(localStorage.getItem(signKey) === '1');
      setShowAuthorsProfiles(localStorage.getItem(authorsKey) === '1');
      setSubscriberIds(loadSubscriberIds(clubId));
      setAdminIds(loadAdminIds(clubId));
      if (isClubChannel) {
        try {
          const raw = localStorage.getItem('user');
          if (raw) {
            const parsed = JSON.parse(raw) as { name?: string; username?: string };
            setOwnerName(parsed.name || parsed.username || 'Club admin');
          }
        } catch {
          setOwnerName('Club admin');
        }
      } else {
        const adminData = localStorage.getItem('adminUser');
        if (adminData) {
          const parsed = JSON.parse(adminData) as { name?: string; username?: string };
          setOwnerName(parsed.name || parsed.username || 'Admin');
        }
      }
    } catch {
      /* ignore */
    }

    // Prefer server-persisted channel photo so users see the same icon.
    void (async () => {
      try {
        const res = await fetch(withClubQuery('/api/chat/channel-settings', clubId), {
          headers: getAuthHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.channelName === 'string' && data.channelName.trim()) {
          setChannelName(data.channelName.trim());
        }
        if (typeof data.channelPhoto === 'string' && data.channelPhoto.trim()) {
          setChannelPhoto(data.channelPhoto);
          try {
            localStorage.setItem(photoKey, data.channelPhoto);
          } catch {
            /* ignore */
          }
          return;
        }
        // Migrate legacy localStorage-only photo to the server once.
        const legacy = localStorage.getItem(photoKey);
        if (legacy && legacy.startsWith('data:image/')) {
          const uploadRes = await fetch('/api/chat/channel-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({
              photoDataUrl: legacy,
              ...(clubId ? { clubId } : {}),
            }),
          });
          if (uploadRes.ok) {
            const uploaded = await uploadRes.json();
            if (typeof uploaded.channelPhoto === 'string' && uploaded.channelPhoto.trim()) {
              setChannelPhoto(uploaded.channelPhoto);
              try {
                localStorage.setItem(photoKey, uploaded.channelPhoto);
              } catch {
                /* ignore */
              }
            }
          }
        }
      } catch {
        /* ignore */
      }
    })();

    // Load broadcast history from DB; migrate any legacy localStorage-only posts.
    void (async () => {
      try {
        let legacy: BroadcastMessage[] = [];
        try {
          const raw = localStorage.getItem(histKey);
          if (raw) {
            const parsed = JSON.parse(raw) as unknown;
            if (Array.isArray(parsed)) {
              legacy = parsed.filter(
                (m): m is BroadcastMessage =>
                  !!m &&
                  typeof m === 'object' &&
                  typeof (m as BroadcastMessage).content === 'string' &&
                  typeof (m as BroadcastMessage).mode === 'string'
              );
            }
          }
        } catch {
          legacy = [];
        }

        if (legacy.length > 0) {
          await fetch('/api/chat/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({
              ...(clubId ? { clubId } : {}),
              messages: legacy.map((m) => ({
                content: m.content,
                mode: m.mode,
                createdAt: m.createdAt,
                senderName: defaultSenderName,
              })),
            }),
          });
        }

        const res = await fetch(withClubQuery('/api/chat/broadcast?all=1', clubId), {
          headers: getAuthHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data.messages) ? (data.messages as BroadcastMessage[]) : [];
        const normalized: BroadcastMessage[] = list
          .filter((m) => OWNER_BROADCAST_MODES.has(String(m.mode)))
          .map((m) => ({
            id: String(m.id),
            content: String(m.content),
            createdAt: String(m.createdAt),
            mode: m.mode as BroadcastMode,
            senderName:
              typeof (m as { senderName?: string }).senderName === 'string'
                ? (m as { senderName?: string }).senderName
                : defaultSenderName,
          }));
        setHistory(normalized);
        try {
          localStorage.setItem(histKey, JSON.stringify(normalized));
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore */
      }
    })();
  }, [
    getAuthHeaders,
    clubId,
    histKey,
    muteKey,
    photoKey,
    signKey,
    authorsKey,
    isClubChannel,
    defaultSenderName,
  ]);

  const pingPresence = useCallback(async () => {
    try {
      await fetch('/api/chat/presence', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      });
    } catch {
      /* ignore */
    }
  }, [getAuthHeaders]);

  const mapChannelUser = (s: ChannelSubscriber): ChannelSubscriber => ({
    id: s.id,
    name: s.name,
    telegramAccount: s.telegramAccount ?? null,
    image: s.image ?? null,
    isOnline: Boolean(s.isOnline),
    lastSeenAt: s.lastSeenAt ?? null,
    createdAt: s.createdAt ?? null,
  });

  const loadStats = useCallback(async () => {
    try {
      const subIds = loadSubscriberIds(clubId);
      const admIds = loadAdminIds(clubId);
      // POST body carries group filters — a GET query with ~193 countries is too large and fails after refresh.
      const res = await fetch('/api/chat/admin-stats', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriberIds: subIds,
          adminIds: admIds,
          sports: isClubChannel ? [] : userSettings.sports,
          userTypes: isClubChannel ? [] : userSettings.userTypes,
          countries: isClubChannel ? [] : userSettings.countries,
          ...(isClubChannel && selectedMemberGroupId
            ? { memberGroupId: selectedMemberGroupId }
            : {}),
          ...(clubId ? { clubId } : {}),
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const counts = data.modeCounts as Partial<Record<BroadcastMode, number>> | undefined;
      setModeCounts({
        all: counts?.all ?? 0,
        group: counts?.group ?? 0,
        subscribers: counts?.subscribers ?? data.subscriberCount ?? subIds.length,
        favourites: counts?.favourites ?? 0,
      });
      if (Array.isArray(data.subscribers)) {
        setSubscribers(data.subscribers.map(mapChannelUser));
      } else {
        setSubscribers([]);
      }
      if (Array.isArray(data.admins)) {
        setChannelAdmins(data.admins.map(mapChannelUser));
      } else {
        setChannelAdmins([]);
      }
    } catch {
      /* ignore */
    }
  }, [getAuthHeaders, userSettings, clubId, isClubChannel, selectedMemberGroupId]);

  const loadRepliersCount = useCallback(async () => {
    try {
      const res = await fetch(withClubQuery('/api/chat/broadcast/repliers', clubId), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.count === 'number') setChatUsersCount(data.count);
      else if (Array.isArray(data.users)) setChatUsersCount(data.users.length);
    } catch {
      /* ignore */
    }
  }, [getAuthHeaders, clubId]);

  const loadAddCandidates = useCallback(
    async (search: string, mode: 'subscribers' | 'admins' = 'subscribers') => {
      setAddLoading(true);
      try {
        const subIds = loadSubscriberIds(clubId);
        const admIds = loadAdminIds(clubId);
        const params = new URLSearchParams({ candidates: '1', candidateMode: mode });
        if (subIds.length > 0) params.set('subscriberIds', subIds.join(','));
        if (admIds.length > 0) params.set('adminIds', admIds.join(','));
        if (search.trim()) params.set('candidateSearch', search.trim());
        if (clubId) params.set('clubId', clubId);
        const res = await fetch(`/api/chat/admin-stats?${params}`, { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.candidates)) {
          setAddCandidates(data.candidates.map(mapChannelUser));
        } else {
          setAddCandidates([]);
        }
      } catch {
        /* ignore */
      } finally {
        setAddLoading(false);
      }
    },
    [getAuthHeaders, clubId]
  );

  const addSubscriber = (user: ChannelSubscriber) => {
    const id = String(user.id);
    setSubscriberIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveSubscriberIds(next, clubId);
      return next;
    });
    setSubscribers((prev) => (prev.some((s) => String(s.id) === id) ? prev : [...prev, user]));
    setAddCandidates((prev) => prev.filter((c) => String(c.id) !== id));
  };

  const removeSubscriber = (userId: string | number) => {
    const id = String(userId);
    setSubscriberIds((prev) => {
      const next = prev.filter((x) => x !== id);
      saveSubscriberIds(next, clubId);
      return next;
    });
    setSubscribers((prev) => prev.filter((s) => String(s.id) !== id));
  };

  const addChannelAdmin = (user: ChannelSubscriber) => {
    const id = String(user.id);
    setAdminIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveAdminIds(next, clubId);
      return next;
    });
    setChannelAdmins((prev) => (prev.some((s) => String(s.id) === id) ? prev : [...prev, user]));
    setAddCandidates((prev) => prev.filter((c) => String(c.id) !== id));
  };

  const removeChannelAdmin = (userId: string | number) => {
    const id = String(userId);
    setAdminIds((prev) => {
      const next = prev.filter((x) => x !== id);
      saveAdminIds(next, clubId);
      return next;
    });
    setChannelAdmins((prev) => prev.filter((s) => String(s.id) !== id));
  };

  useEffect(() => {
    if (!isClubChannel) return;
    setSelectedMemberGroupId(loadSelectedMemberGroupId(clubId));
    setSelectedMemberGroupName(loadSelectedMemberGroupName(clubId));
  }, [clubId, isClubChannel]);

  useEffect(() => {
    pingPresence();
    loadStats();
    void loadRepliersCount();
    const presenceTimer = setInterval(pingPresence, 30_000);
    const statsTimer = setInterval(loadStats, 60_000);
    const repliersTimer = setInterval(() => void loadRepliersCount(), 60_000);
    return () => {
      clearInterval(presenceTimer);
      clearInterval(statsTimer);
      clearInterval(repliersTimer);
    };
  }, [pingPresence, loadStats, loadRepliersCount]);

  useEffect(() => {
    if (broadcastPanelView !== 'addSubscribers' && broadcastPanelView !== 'addAdministrators') return;
    const mode = broadcastPanelView === 'addAdministrators' ? 'admins' : 'subscribers';
    const t = setTimeout(() => {
      void loadAddCandidates(addSearch, mode);
    }, 250);
    return () => clearTimeout(t);
  }, [broadcastPanelView, addSearch, loadAddCandidates]);

  useEffect(() => {
    fetch('/api/news/ogp-settings-options', { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setOptions({
            sports: data.sports ?? [],
            userTypes: data.userTypes ?? [],
            countries: data.countries ?? [],
          });
        }
      })
      .catch(() => {});
  }, [getAuthHeaders]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (composerMenuRef.current && !composerMenuRef.current.contains(e.target as Node)) {
        setShowComposerMenu(false);
        setShowMuteSubmenu(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', close, true);
    };
  }, [contextMenu]);

  const saveMemberGroupSelection = (group: { id: string; name: string } | null) => {
    const nextId = group?.id ?? null;
    const nextName = group?.name ?? '';
    setSelectedMemberGroupId(nextId);
    setSelectedMemberGroupName(nextName);
    saveSelectedMemberGroupId(nextId, clubId);
    saveSelectedMemberGroupName(nextName || null, clubId);
    void loadStats();
  };

  const saveUserSettings = (settings: ChatUserFilterSettings) => {
    setUserSettings(settings);
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  };

  const deleteUserSettings = () => {
    setUserSettings(defaultChatUserFilterSettings);
    localStorage.removeItem(settingsKey);
  };

  // Keep subscriber mode count in sync when channel subscribers are added/removed locally.
  useEffect(() => {
    setModeCounts((prev) =>
      prev.subscribers === subscriberIds.length ? prev : { ...prev, subscribers: subscriberIds.length }
    );
  }, [subscriberIds]);

  const setMute = (value: boolean) => {
    setMuted(value);
    localStorage.setItem(muteKey, value ? '1' : '0');
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(histKey);
    setShowComposerMenu(false);
    setShowMuteSubmenu(false);
    void fetch(withClubQuery(`/api/chat/broadcast?mode=${encodeURIComponent(mode)}`, clubId), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    }).catch(() => {});
  };

  const openBroadcastView = () => {
    if (mainView === 'broadcast') {
      setMainView(null);
      setShowBroadcastPanel(false);
      setBroadcastPanelView('invite');
      setSubscriberSearchOpen(false);
      setSubscriberSearch('');
      setAddSearch('');
      setAddCandidates([]);
      setAddAdminSearchOpen(false);
      return;
    }
    setMainView('broadcast');
  };

  const openChatUsersView = () => {
    setMainView(mainView === 'chatUsers' ? null : 'chatUsers');
    setShowBroadcastPanel(false);
    setBroadcastPanelView('invite');
    setSubscriberSearchOpen(false);
    setSubscriberSearch('');
  };

  const openBroadcastPanel = () => {
    setMainView('broadcast');
    setBroadcastPanelView('invite');
    setSubscriberSearchOpen(false);
    setSubscriberSearch('');
    setShowBroadcastPanel(true);
  };

  const closeBroadcastPanel = () => {
    setShowBroadcastPanel(false);
    setBroadcastPanelView('invite');
    setSubscriberSearchOpen(false);
    setSubscriberSearch('');
    setAddSearch('');
    setAddCandidates([]);
    setAddAdminSearchOpen(false);
  };

  const saveChannelName = async (name: string): Promise<boolean> => {
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      alert('Channel name cannot be empty.');
      return false;
    }
    setSavingChannelSettings(true);
    try {
      const res = await fetch('/api/chat/channel-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          channelName: trimmed,
          ...(clubId ? { clubId } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to save channel name');
        return false;
      }
      const data = await res.json();
      if (typeof data.channelName === 'string' && data.channelName.trim()) {
        setChannelName(data.channelName.trim());
      } else {
        setChannelName(trimmed);
      }
      return true;
    } catch {
      alert('Failed to save channel name');
      return false;
    } finally {
      setSavingChannelSettings(false);
    }
  };

  const finishChannelSettingsEdit = async () => {
    const ok = await saveChannelName(channelName);
    if (ok) setBroadcastPanelView('invite');
  };

  const onChannelPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image is too large (max 5MB).');
      return;
    }

    void (async () => {
      try {
        // Same pattern as operator / athlete avatar: multipart file → server stores data URL.
        const form = new FormData();
        form.append('file', file);
        if (clubId) form.append('clubId', clubId);

        const res = await fetch('/api/chat/channel-settings', {
          method: 'POST',
          headers: { ...getAuthHeaders() },
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert(
            typeof (data as { error?: string }).error === 'string'
              ? (data as { error: string }).error
              : 'Failed to upload channel photo'
          );
          return;
        }
        const photo =
          typeof (data as { channelPhoto?: string }).channelPhoto === 'string'
            ? (data as { channelPhoto: string }).channelPhoto.trim()
            : '';
        if (!photo) {
          alert('Failed to upload channel photo');
          return;
        }
        setChannelPhoto(photo);
        try {
          localStorage.setItem(photoKey, photo);
        } catch {
          /* ignore quota */
        }
      } catch {
        alert('Failed to upload channel photo');
      }
    })();
  };

  const filteredSubscribers =
    subscriberSearch.trim().length > 0
      ? subscribers.filter((s) => {
          const q = subscriberSearch.trim().toLowerCase().replace(/^@+/, '');
          const tg = (s.telegramAccount || '').toLowerCase().replace(/^@+/, '');
          return tg.includes(q) || s.name.toLowerCase().includes(q);
        })
      : subscribers;

  const sendBroadcast = async (rawContent?: string) => {
    const source =
      rawContent != null
        ? rawContent
        : pendingImage
          ? buildImageContent(pendingImage, message)
          : message;
    const content =
      source.startsWith('data:image/') || source.startsWith('data:audio/')
        ? source
        : source.trim();
    if (!content || sendingBroadcast) return;
    if (isClubChannel && mode === 'group' && !selectedMemberGroupId) {
      window.alert('Select a member group using the settings button first.');
      return;
    }
    setSendingBroadcast(true);
    try {
      const res = await fetch('/api/chat/broadcast', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          mode,
          senderName: ownerName || defaultSenderName,
          subscriberIds: mode === 'subscribers' ? loadSubscriberIds(clubId) : [],
          sports: !isClubChannel && mode === 'group' ? userSettings.sports : [],
          userTypes: !isClubChannel && mode === 'group' ? userSettings.userTypes : [],
          countries: !isClubChannel && mode === 'group' ? userSettings.countries : [],
          ...(isClubChannel && mode === 'group' && selectedMemberGroupId
            ? { memberGroupId: selectedMemberGroupId }
            : {}),
          ...(clubId ? { clubId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof data.error === 'string' ? data.error : 'Failed to send broadcast');
        return;
      }
      const created = data.message as
        | { id?: string; content?: string; createdAt?: string; mode?: BroadcastMode; senderName?: string }
        | undefined;
      const entry: BroadcastMessage = {
        id: created?.id || `${Date.now()}`,
        content: created?.content || content,
        createdAt: created?.createdAt || new Date().toISOString(),
        mode: (created?.mode as BroadcastMode) || mode,
        senderName: created?.senderName || ownerName || defaultSenderName,
      };
      const next = [...history, entry];
      setHistory(next);
      try {
        localStorage.setItem(histKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      setMessage('');
      setPendingImage(null);
    } catch {
      window.alert('Failed to send broadcast');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const {
    isRecording,
    recordingSeconds,
    voiceError,
    setVoiceError,
    startVoiceRecording,
    cancelVoiceRecording,
    stopAndSendVoiceRecording,
    formatRecordingTime,
  } = useChatVoiceRecording({
    canStart: !pendingImage,
    busy: sendingBroadcast,
    onRecorded: async (audioDataUrl) => {
      await sendBroadcast(buildAudioContent(audioDataUrl));
    },
  });

  const canSendText = Boolean(message.trim() || pendingImage);
  const showVoiceButton = !canSendText && !isRecording;

  const attachImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 4 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.startsWith('data:image/')) {
        // Keep pending so caption can be typed, then Send posts both together.
        setPendingImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) attachImageFile(file);
        return;
      }
    }
  };

  const hideMessageLocally = (messageId: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      saveHiddenIds(next, clubId);
      return next;
    });
    if (pinnedId === messageId) {
      setPinnedId(null);
      savePinnedId(null, clubId);
    }
  };

  const handleMessageContextMenu = (e: React.MouseEvent, msg: BroadcastMessage) => {
    e.preventDefault();
    e.stopPropagation();
    const pad = 8;
    const menuW = 200;
    const menuH = 220;
    const x = Math.min(e.clientX, window.innerWidth - menuW - pad);
    const y = Math.min(e.clientY, window.innerHeight - menuH - pad);
    setContextMenu({ x: Math.max(pad, x), y: Math.max(pad, y), message: msg });
  };

  const handleContextCopy = async () => {
    if (!contextMenu) return;
    const msg = contextMenu.message;
    setContextMenu(null);
    const image = parseImageContent(msg.content);
    try {
      if (image) {
        const res = await fetch(image.src);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      } else {
        await navigator.clipboard.writeText(msg.content);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(image?.caption || messagePreview(msg.content));
      } catch {
        /* ignore */
      }
    }
  };

  const handleContextPin = () => {
    if (!contextMenu) return;
    const id = contextMenu.message.id;
    setContextMenu(null);
    const next = pinnedId === id ? null : id;
    setPinnedId(next);
    savePinnedId(next, clubId);
  };

  const handleContextForward = async () => {
    if (!contextMenu) return;
    const msg = contextMenu.message;
    setContextMenu(null);
    setForwardingMessage(msg);
    try {
      const res = await fetch('/api/chat/conversations', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConversations(
          Array.isArray(data.conversations)
            ? data.conversations.map((c: ConversationOption) => ({
                id: c.id,
                otherUser: { id: c.otherUser.id, name: c.otherUser.name },
              }))
            : []
        );
      } else {
        setConversations([]);
      }
    } catch {
      setConversations([]);
    }
  };

  const handleForwardTo = async (targetConversationId: string) => {
    if (!forwardingMessage || forwarding) return;
    setForwarding(true);
    try {
      const sender = forwardingMessage.senderName || ownerName || defaultSenderName;
      const content = isImageContent(forwardingMessage.content)
        ? forwardingMessage.content
        : `Forwarded from ${sender}: ${forwardingMessage.content}`;
      const res = await fetch(`/api/chat/conversations/${targetConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ content }),
      });
      if (res.ok) setForwardingMessage(null);
    } catch {
      /* ignore */
    } finally {
      setForwarding(false);
    }
  };

  const handleContextDelete = () => {
    if (!contextMenu) return;
    setDeleteTarget(contextMenu.message);
    setContextMenu(null);
  };

  const deleteForMe = () => {
    if (!deleteTarget) return;
    hideMessageLocally(deleteTarget.id);
    setDeleteTarget(null);
  };

  const deleteForEveryone = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(
        withClubQuery(
          `/api/chat/broadcast?messageId=${encodeURIComponent(deleteTarget.id)}`,
          clubId
        ),
        { method: 'DELETE', headers: getAuthHeaders() }
      );
      if (res.ok) {
        setHistory((prev) => {
          const next = prev.filter((m) => m.id !== deleteTarget.id);
          try {
            localStorage.setItem(histKey, JSON.stringify(next));
          } catch {
            /* ignore */
          }
          return next;
        });
        hideMessageLocally(deleteTarget.id);
        setDeleteTarget(null);
      }
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  const filteredHistory = history.filter((m) => {
    if (!OWNER_BROADCAST_MODES.has(m.mode)) return false;
    if (m.mode !== mode) return false;
    if (hiddenIds.has(m.id)) return false;
    if (searchOpen && searchQuery.trim()) {
      if (isImageContent(m.content)) {
        const q = searchQuery.trim().toLowerCase();
        return messagePreview(m.content).toLowerCase().includes(q) || '[image]'.includes(q);
      }
      return m.content.toLowerCase().includes(searchQuery.trim().toLowerCase());
    }
    return true;
  });

  const pinnedMessage = pinnedId
    ? filteredHistory.find((m) => m.id === pinnedId) ?? null
    : null;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const target = el.scrollHeight - el.clientHeight;
    if (behavior === 'smooth') {
      el.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      el.scrollTop = target;
    }
    stickToBottomRef.current = true;
    setShowScrollToBottom(false);
    setFloatingDayLabel(null);
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const container = messagesContainerRef.current;
    if (!container || !messageId) return;
    const target = container.querySelector(
      `[data-message-id="${CSS.escape(messageId)}"]`
    ) as HTMLElement | null;
    if (!target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop =
      targetRect.top -
      containerRect.top +
      container.scrollTop -
      Math.max(24, container.clientHeight * 0.25);
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    stickToBottomRef.current = false;
    setShowScrollToBottom(true);

    setHighlightMessageId(messageId);
    if (highlightClearTimerRef.current) clearTimeout(highlightClearTimerRef.current);
    highlightClearTimerRef.current = setTimeout(() => {
      setHighlightMessageId((cur) => (cur === messageId ? null : cur));
    }, 1600);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightClearTimerRef.current) clearTimeout(highlightClearTimerRef.current);
    };
  }, []);

  const updateFloatingDayFromScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const containerTop = el.getBoundingClientRect().top;
    const markers = el.querySelectorAll<HTMLElement>('[data-chat-day-label]');
    let label: string | null = null;
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      const top = marker.getBoundingClientRect().top - containerTop;
      if (top <= 28) {
        label = marker.dataset.chatDayLabel || null;
      } else {
        break;
      }
    }
    if (!label && markers.length > 0) {
      label = markers[0].dataset.chatDayLabel || null;
    }
    if (label) {
      setFloatingDayLabel(label);
      if (floatingDayTimerRef.current) clearTimeout(floatingDayTimerRef.current);
      floatingDayTimerRef.current = setTimeout(() => setFloatingDayLabel(null), 1200);
    }
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atBottom = scrollHeight - scrollTop - clientHeight < 80;
    stickToBottomRef.current = atBottom;
    setShowScrollToBottom(!atBottom && filteredHistory.length > 0);
    if (!atBottom) updateFloatingDayFromScroll();
    else setFloatingDayLabel(null);
  }, [filteredHistory.length, updateFloatingDayFromScroll]);

  useEffect(() => {
    return () => {
      if (floatingDayTimerRef.current) clearTimeout(floatingDayTimerRef.current);
    };
  }, []);

  useEffect(() => {
    stickToBottomRef.current = true;
    setShowScrollToBottom(false);
    setFloatingDayLabel(null);
  }, [mode]);

  useEffect(() => {
    if (!stickToBottomRef.current && filteredHistory.length > 0) {
      setShowScrollToBottom(true);
      return;
    }
    scrollToBottom('auto');
  }, [filteredHistory.length, mode, scrollToBottom]);

  const toolbarBtn =
    'inline-flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-[#7ec8e3] hover:bg-white/10 rounded transition';

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-1 flex-col bg-[#e8e8e8] px-4 py-2 sm:px-5 lg:px-6">
      {/* Chat section — inset from sidebars on both sides */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border border-[#bdbdbd] bg-white shadow-sm">
        {/* Dark toolbar */}
        <div className="flex w-full shrink-0 flex-wrap items-center gap-1 bg-[#1e2329] px-2 py-1.5 text-[#7ec8e3]">
          <button
            type="button"
            onClick={() => (showBroadcastPanel ? closeBroadcastPanel() : openBroadcastPanel())}
            className={`mr-1 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#8b1a1a] text-[10px] font-bold text-white transition ring-offset-1 ring-offset-[#1e2329] hover:brightness-110 ${
              showBroadcastPanel ? 'ring-2 ring-[#7ec8e3]' : ''
            }`}
            title="Broadcast profile"
            aria-pressed={showBroadcastPanel}
          >
            {channelPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={channelPhoto} alt="Broadcast" className="h-full w-full object-cover" />
            ) : (
              channelAvatarFallback
            )}
          </button>
          <button type="button" className={toolbarBtn} onClick={() => setShowQrModal(true)}>
            <QrCode className="h-4 w-4" />
            Invite by QR Code
          </button>
          <button type="button" className={toolbarBtn} onClick={() => setMute(!muted)} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Bell className="h-4 w-4" />}
            Mute
          </button>
          <button
            type="button"
            className={toolbarBtn}
            title="Add subscribers"
            onClick={() => {
              setMainView('broadcast');
              setShowBroadcastPanel(true);
              setAddSearch('');
              setBroadcastPanelView('addSubscribers');
            }}
          >
            <UserPlus className="h-4 w-4" />
            Add subscribers
          </button>
          <button type="button" className={toolbarBtn} onClick={() => setShowInviteLink(true)}>
            <Link2 className="h-4 w-4" />
            Invite via Link
          </button>
          <button
            type="button"
            onClick={openBroadcastView}
            className={`mx-2 rounded px-1.5 py-1 text-[12px] transition hover:bg-white/10 ${
              mainView === 'broadcast'
                ? 'font-bold text-white'
                : 'font-medium text-[#7ec8e3]'
            }`}
            aria-pressed={mainView === 'broadcast'}
          >
            Broadcast
          </button>
          <button
            type="button"
            onClick={openChatUsersView}
            className={`rounded px-1.5 py-1 text-[12px] transition hover:bg-white/10 ${
              mainView === 'chatUsers'
                ? 'font-bold text-white'
                : 'font-medium text-[#7ec8e3]'
            }`}
            aria-pressed={mainView === 'chatUsers'}
          >
            Chat {isClubChannel ? 'members' : 'users'} ({chatUsersCount})
          </button>
          <div className="ml-auto">
            <button type="button" className="rounded p-1.5 text-[#7ec8e3] hover:bg-white/10" title="Notifications">
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-1">
          {mainView === 'chatUsers' ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <AdminChatUsersPanel
                getAuthHeaders={getAuthHeaders}
                onCountChange={setChatUsersCount}
                clubId={clubId}
              />
            </div>
          ) : mainView === 'broadcast' ? (
            <>
          {/* Broadcast invite / settings panel (MB button) — left */}
          {showBroadcastPanel && (
            <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden border-r border-[#15202b] bg-[#1c242f] text-white">
              {broadcastPanelView === 'edit' ? (
                <>
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <button
                      type="button"
                      className="rounded p-1 text-[#8ab4d9] hover:bg-white/10 disabled:opacity-50"
                      onClick={() => setBroadcastPanelView('invite')}
                      title="Back"
                      disabled={savingChannelSettings}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <span className="text-[16px] font-medium">Channel Settings</span>
                    <button
                      type="button"
                      className="rounded p-1 text-[#8ab4d9] hover:bg-white/10 disabled:opacity-50"
                      onClick={() => void finishChannelSettingsEdit()}
                      title="Save"
                      disabled={savingChannelSettings}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
                    <div className="flex flex-col items-center gap-3">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="relative h-24 w-24 overflow-hidden rounded-full bg-[#2b3645]"
                      >
                        {channelPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={channelPhoto} alt="Channel" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-white">{channelAvatarFallback}</span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-black/45 py-1 text-center text-[10px] text-white">
                          Edit
                        </span>
                      </button>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-[#8ab4d9]">Channel name</span>
                      <input
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void finishChannelSettingsEdit();
                          }
                        }}
                        maxLength={64}
                        placeholder={isClubChannel ? 'Club Channel' : 'Movesbook channel'}
                        className="w-full rounded-lg border-0 bg-[#2b3645] px-3 py-2.5 text-sm text-white outline-none ring-1 ring-transparent focus:ring-[#50a2e9]"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-[#8ab4d9]">Description</span>
                      <textarea
                        value={channelDescription}
                        onChange={(e) => setChannelDescription(e.target.value)}
                        rows={4}
                        placeholder="Describe your channel"
                        className="w-full resize-none rounded-lg border-0 bg-[#2b3645] px-3 py-2.5 text-sm text-white outline-none ring-1 ring-transparent placeholder:text-white/30 focus:ring-[#50a2e9]"
                      />
                    </label>
                    {savingChannelSettings && (
                      <p className="text-center text-[12px] text-[#8ab4d9]">Saving…</p>
                    )}
                  </div>
                </>
              ) : broadcastPanelView === 'subscribers' ? (
                <>
                  <div className="flex shrink-0 items-center gap-1 px-2 py-2.5">
                    <button
                      type="button"
                      className="rounded p-1.5 text-white hover:bg-white/10"
                      onClick={() => {
                        setBroadcastPanelView('invite');
                        setSubscriberSearchOpen(false);
                        setSubscriberSearch('');
                      }}
                      title="Back"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    {subscriberSearchOpen ? (
                      <input
                        value={subscriberSearch}
                        onChange={(e) => setSubscriberSearch(e.target.value)}
                        placeholder="Search"
                        autoFocus
                        className="min-w-0 flex-1 border-0 bg-transparent px-1 text-[16px] text-white outline-none placeholder:text-white/40"
                      />
                    ) : (
                      <span className="flex-1 text-[17px] font-medium text-white">Subscribers</span>
                    )}
                    <button
                      type="button"
                      className="rounded p-1.5 text-white hover:bg-white/10"
                      onClick={() => {
                        if (subscriberSearchOpen) {
                          setSubscriberSearchOpen(false);
                          setSubscriberSearch('');
                        } else {
                          setSubscriberSearchOpen(true);
                        }
                      }}
                      title={subscriberSearchOpen ? 'Close search' : 'Search'}
                    >
                      {subscriberSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                    </button>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <button
                      type="button"
                      className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-white/5"
                      onClick={() => {
                        setAddSearch('');
                        setBroadcastPanelView('addSubscribers');
                      }}
                    >
                      <UserPlus className="h-5 w-5 shrink-0 text-[#64b5f6]" />
                      <span className="text-[16px] text-[#64b5f6]">Add subscribers</span>
                    </button>

                    <div className="mx-4 border-t border-white/10" />

                    <p className="px-4 pb-2 pt-3 text-[13px] text-[#8a94a0]">Contacts in this channel</p>

                    {filteredSubscribers.length === 0 ? (
                      <p className="px-4 py-6 text-center text-[13px] text-[#8a94a0]">No subscribers found</p>
                    ) : (
                      filteredSubscribers.map((s) => {
                        const memberName = (s.name || '').trim();
                        const telegramId = formatTelegramId(s.telegramAccount);
                        const label = formatSubscriberPrimaryLabel(s.name, s.telegramAccount);
                        return (
                          <div
                            key={String(s.id)}
                            className="flex w-full items-center gap-3 px-4 py-2.5"
                          >
                            {s.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={s.image}
                                alt=""
                                className="h-11 w-11 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <span
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                                style={{
                                  backgroundColor: subscriberAvatarColor(memberName || label),
                                }}
                              >
                                {subscriberInitials(memberName || label)}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[16px] text-white">
                                {memberName && telegramId && memberName.toLowerCase().replace(/^@+/, '') !== telegramId.toLowerCase().replace(/^@+/, '')
                                  ? memberName
                                  : label}
                              </span>
                              <span
                                className={`block truncate text-[13px] ${
                                  s.isOnline ? 'text-[#64b5f6]' : 'text-[#8a94a0]'
                                }`}
                              >
                                {telegramId && memberName && memberName.toLowerCase().replace(/^@+/, '') !== telegramId.toLowerCase().replace(/^@+/, '')
                                  ? `${telegramId} · ${s.isOnline ? 'online' : 'last seen recently'}`
                                  : s.isOnline
                                    ? 'online'
                                    : 'last seen recently'}
                              </span>
                            </span>
                            <button
                              type="button"
                              className="rounded px-2 py-1 text-[12px] text-[#e17076] hover:bg-white/5"
                              title="Remove subscriber"
                              onClick={() => removeSubscriber(s.id)}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })
                    )}

                    <p className="px-4 py-4 text-center text-[12px] leading-snug text-[#6b7580]">
                      Only channel admins can see this list.
                    </p>
                  </div>
                </>
              ) : broadcastPanelView === 'addSubscribers' ? (
                <>
                  <div className="flex shrink-0 items-center gap-1 px-2 py-2.5">
                    <button
                      type="button"
                      className="rounded p-1.5 text-white hover:bg-white/10"
                      onClick={() => {
                        setBroadcastPanelView('subscribers');
                        setAddSearch('');
                        setAddCandidates([]);
                      }}
                      title="Back"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <input
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      placeholder="Search name or Telegram ID"
                      autoFocus
                      className="min-w-0 flex-1 border-0 bg-transparent px-1 text-[16px] text-white outline-none placeholder:text-white/40"
                    />
                    <button
                      type="button"
                      className="rounded p-1.5 text-white hover:bg-white/10"
                      onClick={() => {
                        setBroadcastPanelView('subscribers');
                        setAddSearch('');
                        setAddCandidates([]);
                      }}
                      title="Done"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <p className="px-4 pb-2 pt-1 text-[13px] text-[#8a94a0]">
                      Select Telegram users to add as channel subscribers
                    </p>
                    {addLoading && addCandidates.length === 0 ? (
                      <p className="px-4 py-6 text-center text-[13px] text-[#8a94a0]">Loading…</p>
                    ) : addCandidates.length === 0 ? (
                      <p className="px-4 py-6 text-center text-[13px] text-[#8a94a0]">
                        No Telegram users found
                      </p>
                    ) : (
                      addCandidates.map((s) => {
                        const memberName = (s.name || '').trim();
                        const telegramId = formatTelegramId(s.telegramAccount);
                        const label = formatSubscriberPrimaryLabel(s.name, s.telegramAccount);
                        const showNameAndTg =
                          Boolean(memberName) &&
                          Boolean(telegramId) &&
                          memberName.toLowerCase().replace(/^@+/, '') !==
                            telegramId.toLowerCase().replace(/^@+/, '');
                        return (
                          <button
                            key={String(s.id)}
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5"
                            onClick={() => addSubscriber(s)}
                          >
                            <span
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                              style={{
                                backgroundColor: subscriberAvatarColor(memberName || label),
                              }}
                            >
                              {subscriberInitials(memberName || label)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[16px] text-white">
                                {showNameAndTg ? memberName : label}
                              </span>
                              <span
                                className={`block truncate text-[13px] ${
                                  s.isOnline ? 'text-[#64b5f6]' : 'text-[#8a94a0]'
                                }`}
                              >
                                {showNameAndTg
                                  ? `${telegramId} · ${s.isOnline ? 'online' : 'last seen recently'}`
                                  : s.isOnline
                                    ? 'online'
                                    : 'last seen recently'}
                              </span>
                            </span>
                            <UserPlus className="h-4 w-4 shrink-0 text-[#64b5f6]" />
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              ) : broadcastPanelView === 'administrators' ? (
                <>
                  <div className="flex shrink-0 items-center gap-1 px-2 py-2.5">
                    <button
                      type="button"
                      className="rounded p-1.5 text-white hover:bg-white/10"
                      onClick={() => setBroadcastPanelView('invite')}
                      title="Back"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <span className="flex-1 text-[17px] font-medium text-white">Administrators</span>
                    <button
                      type="button"
                      className="rounded p-1.5 text-white hover:bg-white/10"
                      onClick={() => setBroadcastPanelView('invite')}
                      title="Done"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#17212b]">
                    <div className="bg-[#1c2733]">
                      <button
                        type="button"
                        className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-white/5"
                        onClick={() => {
                          setAddSearch('');
                          setAddAdminSearchOpen(false);
                          setAddCandidates([]);
                          setBroadcastPanelView('addAdministrators');
                        }}
                      >
                        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center text-[#64b5f6]">
                          <ShieldPlus className="h-6 w-6" strokeWidth={1.75} />
                        </span>
                        <span className="text-[16px] text-[#64b5f6]">Add Admin</span>
                      </button>

                      <div className="mx-4 border-t border-white/10" />

                      <div className="flex w-full items-center gap-3 px-4 py-2.5">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                          style={{ backgroundColor: subscriberAvatarColor(ownerName) }}
                        >
                          {subscriberInitials(ownerName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] text-white">{ownerName}</span>
                          <span className="block text-[13px] text-[#8a94a0]">Owner</span>
                        </span>
                      </div>

                      {channelAdmins.map((a) => {
                        const memberName = (a.name || '').trim();
                        const telegramId = formatTelegramId(a.telegramAccount);
                        const label = formatSubscriberPrimaryLabel(a.name, a.telegramAccount);
                        const showNameAndTg =
                          Boolean(memberName) &&
                          Boolean(telegramId) &&
                          memberName.toLowerCase().replace(/^@+/, '') !==
                            telegramId.toLowerCase().replace(/^@+/, '');
                        return (
                          <div
                            key={String(a.id)}
                            className="flex w-full items-center gap-3 px-4 py-2.5"
                          >
                            <span
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                              style={{
                                backgroundColor: subscriberAvatarColor(memberName || label),
                              }}
                            >
                              {subscriberInitials(memberName || label)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[16px] text-white">
                                {showNameAndTg ? memberName : label}
                              </span>
                              <span className="block truncate text-[13px] text-[#8a94a0]">
                                {showNameAndTg ? `${telegramId} · Admin` : 'Admin'}
                              </span>
                            </span>
                            <button
                              type="button"
                              className="rounded px-2 py-1 text-[12px] text-[#e17076] hover:bg-white/5"
                              title="Remove admin"
                              onClick={() => removeChannelAdmin(a.id)}
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <p className="px-4 py-3 text-[13px] leading-snug text-[#708499]">
                      You can add admins to help you manage your channel. Press and hold to remove admins.
                    </p>

                    <div className="bg-[#1c2733]">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5"
                        onClick={() => {
                          setSignMessages((v) => {
                            const next = !v;
                            localStorage.setItem(signKey, next ? '1' : '0');
                            return next;
                          });
                        }}
                      >
                        <span className="flex-1 text-[16px] text-white">Sign Messages</span>
                        <span
                          className={`relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors ${
                            signMessages ? 'bg-[#64b5f6]' : 'bg-[#4a5560]'
                          }`}
                          role="switch"
                          aria-checked={signMessages}
                        >
                          <span
                            className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
                              signMessages ? 'translate-x-[20px]' : 'translate-x-[2px]'
                            }`}
                          />
                        </span>
                      </button>

                      {signMessages && (
                        <>
                          <div className="mx-4 border-t border-white/10" />
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/5"
                            onClick={() => {
                              setShowAuthorsProfiles((v) => {
                                const next = !v;
                                localStorage.setItem(authorsKey, next ? '1' : '0');
                                return next;
                              });
                            }}
                          >
                            <span className="flex-1 text-[16px] text-white">Show Authors&apos; Profiles</span>
                            <span
                              className={`relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full transition-colors ${
                                showAuthorsProfiles ? 'bg-[#64b5f6]' : 'bg-[#4a5560]'
                              }`}
                              role="switch"
                              aria-checked={showAuthorsProfiles}
                            >
                              <span
                                className={`inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
                                  showAuthorsProfiles ? 'translate-x-[20px]' : 'translate-x-[2px]'
                                }`}
                              />
                            </span>
                          </button>
                        </>
                      )}
                    </div>

                    <p className="px-4 py-3 text-[13px] leading-snug text-[#708499]">
                      {signMessages
                        ? "Allow admins to post as their channel or personal account, linking to their profile."
                        : 'Add the names of admins to messages they post.'}
                    </p>
                  </div>
                </>
              ) : broadcastPanelView === 'addAdministrators' ? (
                <>
                  <div className="flex shrink-0 items-center gap-1 px-2 py-2.5">
                    <button
                      type="button"
                      className="rounded p-1.5 text-white hover:bg-white/10"
                      onClick={() => {
                        setBroadcastPanelView('administrators');
                        setAddSearch('');
                        setAddCandidates([]);
                        setAddAdminSearchOpen(false);
                      }}
                      title="Back"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    {addAdminSearchOpen ? (
                      <input
                        value={addSearch}
                        onChange={(e) => setAddSearch(e.target.value)}
                        placeholder="Search"
                        autoFocus
                        className="min-w-0 flex-1 border-0 bg-transparent px-1 text-[16px] text-white outline-none placeholder:text-white/40"
                      />
                    ) : (
                      <span className="flex-1 text-center text-[17px] font-medium text-white">
                        Add Admin
                      </span>
                    )}
                    <button
                      type="button"
                      className="rounded p-1.5 text-white hover:bg-white/10"
                      onClick={() => {
                        if (addAdminSearchOpen) {
                          setAddAdminSearchOpen(false);
                          setAddSearch('');
                        } else {
                          setAddAdminSearchOpen(true);
                        }
                      }}
                      title={addAdminSearchOpen ? 'Close search' : 'Search'}
                    >
                      {addAdminSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                    </button>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <p className="px-4 pb-2 pt-3 text-[13px] text-[#8a94a0]">Contacts in this channel</p>

                    {addLoading && addCandidates.length === 0 ? (
                      <p className="px-4 py-6 text-center text-[13px] text-[#8a94a0]">Loading…</p>
                    ) : addCandidates.length === 0 ? (
                      <p className="px-4 py-6 text-center text-[13px] text-[#8a94a0]">
                        No Telegram users found
                      </p>
                    ) : (
                      addCandidates.map((s) => {
                        const memberName = (s.name || '').trim();
                        const telegramId = formatTelegramId(s.telegramAccount);
                        const label = formatSubscriberPrimaryLabel(s.name, s.telegramAccount);
                        const showNameAndTg =
                          Boolean(memberName) &&
                          Boolean(telegramId) &&
                          memberName.toLowerCase().replace(/^@+/, '') !==
                            telegramId.toLowerCase().replace(/^@+/, '');
                        return (
                          <button
                            key={String(s.id)}
                            type="button"
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5"
                            onClick={() => addChannelAdmin(s)}
                          >
                            {s.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={s.image}
                                alt=""
                                className="h-11 w-11 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <span
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                                style={{
                                  backgroundColor: subscriberAvatarColor(memberName || label),
                                }}
                              >
                                {subscriberInitials(memberName || label)}
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[16px] text-white">
                                {showNameAndTg ? memberName : label}
                              </span>
                              <span className="block truncate text-[13px] text-[#8a94a0]">
                                {showNameAndTg
                                  ? `${telegramId} · ${formatJoinedAt(s.createdAt)}`
                                  : formatJoinedAt(s.createdAt)}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <button
                    type="button"
                    className="absolute right-2 top-2 z-10 rounded p-1 text-[#8ab4d9]/80 hover:bg-white/10 hover:text-[#8ab4d9]"
                    onClick={closeBroadcastPanel}
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide px-4 pb-3 pt-4">
                    {/* Photo + Set New Photo */}
                    <div className="mb-5 flex items-center gap-3 rounded border border-[#4a7ab0]/70 bg-transparent p-2">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded bg-[#2b3645]"
                      >
                        {channelPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={channelPhoto} alt="Channel" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-7 w-7 text-white/85" strokeWidth={1.25} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="inline-flex items-center gap-2 text-[14px] font-medium text-[#50a2e9] hover:text-[#7ec8e3]"
                      >
                        <span className="relative inline-flex">
                          <Camera className="h-5 w-5" />
                          <span className="absolute -bottom-0.5 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#50a2e9] text-[9px] leading-none font-bold text-[#1c242f]">
                            +
                          </span>
                        </span>
                        Set New Photo
                      </button>
                    </div>

                    <p className="mb-3 text-center text-[14px] text-[#b8c0c8]">Invite by QR Code</p>

                    <div className="mx-auto mb-3 flex h-[190px] w-[190px] items-center justify-center bg-white p-2.5">
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(inviteUrl)}`}
                          alt="Invite QR code"
                          width={170}
                          height={170}
                          className="block"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2AABEE] shadow">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden>
                              <path d="M9.78 14.25l-.3 4.2c.43 0 .62-.18.85-.4l2.04-1.96 4.23 3.11c.78.43 1.33.2 1.54-.72l2.8-13.17h.01c.25-1.16-.42-1.62-1.18-1.34L3.3 10.1c-1.13.44-1.11 1.07-.19 1.35l4.6 1.44 10.68-6.73c.5-.33.96-.15.58.21" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mb-5 px-1 text-center text-[12px] leading-snug text-[#8a94a0]">
                      Everyone on Telegram can scan this code to write to your channel.
                    </p>

                    <div className="mb-2">
                      <p className="mb-0.5 text-[13px] text-[#8a94a0]">Scan QR code</p>
                      <p className="text-[14px] tracking-tight text-[#b8c0c8]">
                        {channelNameToTelegramHandle(channelName)}
                      </p>
                      <button
                        type="button"
                        className="mt-0.5 text-[14px] font-medium text-[#50a2e9] hover:underline"
                        onClick={() => {
                          void navigator.clipboard?.writeText(inviteUrl);
                        }}
                      >
                        Invite Link
                      </button>
                    </div>
                  </div>

                  <div className="shrink-0 overflow-hidden rounded-xl bg-[#232d3b] mx-4 mb-4">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-white/5"
                      onClick={() => {
                        setSubscriberSearchOpen(false);
                        setSubscriberSearch('');
                        setBroadcastPanelView('subscribers');
                        void loadStats();
                      }}
                    >
                      <Users className="h-[18px] w-[18px] shrink-0 text-[#8ab4d9]" />
                      <span className="flex-1 text-[15px] text-white">Subscribers</span>
                      <span className="text-[15px] text-[#50a2e9]">{subscriberIds.length}</span>
                    </button>
                    <div className="mx-3.5 border-t border-white/10" />
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-white/5"
                      onClick={() => setBroadcastPanelView('administrators')}
                    >
                      <Shield className="h-[18px] w-[18px] shrink-0 text-[#8ab4d9]" />
                      <span className="flex-1 text-[15px] text-white">Administrators</span>
                      <span className="text-[15px] text-[#50a2e9]">{1 + adminIds.length}</span>
                    </button>
                    <div className="mx-3.5 border-t border-white/10" />
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-white/5"
                      onClick={() => setBroadcastPanelView('edit')}
                    >
                      <SlidersHorizontal className="h-[18px] w-[18px] shrink-0 text-[#8ab4d9]" />
                      <span className="flex-1 text-[15px] text-white">Channel Settings</span>
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={photoInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={onChannelPhotoChange}
              />
            </aside>
          )}

          {/* Left start-chat column */}
          <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#e0e0e0] bg-white">
            {(Object.keys(MODE_LABELS) as BroadcastMode[]).map((key) => (
              <div
                key={key}
                className={`flex items-center gap-1 border-b border-[#f0f0f0] ${
                  mode === key ? 'bg-[#eef6ff]' : 'hover:bg-[#f7f7f7]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setMode(key)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-[12px] font-medium text-[#2a6db0] hover:underline"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#c5d8ea] bg-[#e8f4fc] text-[#2a6db0]">
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">
                    {MODE_LABELS[key]}
                    <span className="ml-1 font-semibold text-[#1a5a9a]">({modeCounts[key]})</span>
                  </span>
                </button>
                {key === 'group' && (
                  <button
                    type="button"
                    onClick={() =>
                      isClubChannel ? setShowMemberGroupSelect(true) : setShowSettingsUsers(true)
                    }
                    className="mr-2 rounded p-1 text-[#666] hover:bg-[#e8e8e8]"
                    title={
                      isClubChannel
                        ? selectedMemberGroupName
                          ? `Selected group: ${selectedMemberGroupName}`
                          : 'Select member group'
                        : 'Settings users'
                    }
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </aside>

          {/* Main broadcast pane */}
          <section className="flex min-w-0 flex-1 flex-col bg-[#f7f7f7]">
            {searchOpen && (
              <div className="flex shrink-0 items-center gap-2 border-b border-[#ddd] bg-white px-3 py-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search broadcast history…"
                  className="flex-1 border-0 bg-transparent text-sm outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:underline"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                >
                  Close
                </button>
              </div>
            )}

            {pinnedMessage && (
              <div className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-2 rounded text-left hover:bg-amber-100/70"
                  title="Jump to pinned message"
                  onClick={() => scrollToMessage(pinnedMessage.id)}
                >
                  <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">Pinned</div>
                    <div className="truncate">{previewText(pinnedMessage.content, 100)}</div>
                  </div>
                </button>
                <button
                  type="button"
                  className="shrink-0 text-amber-700 hover:underline"
                  onClick={() => {
                    setPinnedId(null);
                    savePinnedId(null, clubId);
                  }}
                >
                  Unpin
                </button>
              </div>
            )}

            <div className="relative min-h-0 flex-1">
              {floatingDayLabel && filteredHistory.length > 0 && (
                <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2">
                  <span className="inline-block rounded-full bg-black/55 px-3 py-1 text-[12px] font-medium text-white shadow-sm backdrop-blur-sm">
                    {floatingDayLabel}
                  </span>
                </div>
              )}
              <div
                ref={messagesContainerRef}
                className="relative h-full overflow-y-auto"
                onScroll={handleMessagesScroll}
              >
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.09]">
                  <div className="relative text-[#9a9a9a]">
                    <svg width="240" height="240" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.7">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" />
                    </svg>
                    <div className="absolute bottom-8 right-1 rounded-full bg-[#b0b0b0] p-1.5 text-white">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 flex min-h-full flex-col gap-2 p-4">
                  {filteredHistory.length === 0 ? null : (
                    filteredHistory.map((m, index) => {
                      const dayKey = chatDayKey(m.createdAt);
                      const prevDayKey =
                        index > 0 ? chatDayKey(filteredHistory[index - 1].createdAt) : null;
                      const showDaySeparator = Boolean(dayKey && dayKey !== prevDayKey);
                      const dayLabel = showDaySeparator ? chatDayLabel(m.createdAt) : null;
                      return (
                        <div key={m.id} className="contents">
                          {showDaySeparator && dayLabel ? (
                            <div
                              data-chat-day-label={dayLabel}
                              className="my-1 flex justify-center"
                            >
                              <span className="rounded-full bg-[#dbe6ef] px-3 py-1 text-[12px] font-medium text-[#4a667a] shadow-sm">
                                {dayLabel}
                              </span>
                            </div>
                          ) : null}
                          <div
                            data-message-id={m.id}
                            onContextMenu={(e) => handleMessageContextMenu(e, m)}
                            className={`ml-auto max-w-[85%] cursor-context-menu rounded-lg bg-[#dcf8c6] px-3 py-2 text-sm text-[#222] shadow-sm ${
                              highlightMessageId === m.id || pinnedId === m.id
                                ? 'ring-2 ring-amber-400'
                                : ''
                            }`}
                          >
                            <div className="mb-0.5 text-[10px] font-semibold uppercase text-[#5a7a3a]">
                              {BROADCAST_SENT_LABELS[m.mode]}
                            </div>
                            {(() => {
                              const image = parseImageContent(m.content);
                              if (image) {
                                return (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={image.src}
                                      alt="Broadcast"
                                      className="max-h-56 max-w-full rounded object-contain"
                                    />
                                    {image.caption ? (
                                      <div className="mt-2 whitespace-pre-wrap break-words">
                                        {image.caption}
                                      </div>
                                    ) : null}
                                  </>
                                );
                              }
                              const audio = parseAudioContent(m.content);
                              if (audio) {
                                return (
                                  <audio
                                    controls
                                    preload="metadata"
                                    src={audio.src}
                                    className="mt-0.5 max-w-full"
                                    style={{ width: '240px' }}
                                  >
                                    Your browser does not support audio playback.
                                  </audio>
                                );
                              }
                              return (
                                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                              );
                            })()}
                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-500">
                              {pinnedId === m.id && <Pin className="h-3 w-3 text-amber-600" />}
                              <span>{new Date(m.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              {showScrollToBottom && filteredHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => scrollToBottom('smooth')}
                  className="absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-gray-700 text-white shadow-lg transition-opacity hover:bg-gray-800"
                  title="Jump to latest messages"
                >
                  <ChevronDown className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Broadcast composer */}
            <div className="relative shrink-0 border-t border-[#cfcfcf] bg-white px-2 py-1.5" ref={composerMenuRef}>
              {pendingImage && (
                <div className="mb-2 flex items-center gap-2 px-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingImage}
                    alt="Paste preview"
                    className="h-14 w-14 rounded border border-gray-300 object-cover"
                  />
                  <span className="min-w-0 flex-1 text-sm text-gray-600">
                    Image ready — add a caption, then Send (both post together)
                  </span>
                  <button
                    type="button"
                    className="text-sm text-gray-500 hover:text-gray-800"
                    onClick={() => setPendingImage(null)}
                  >
                    Remove
                  </button>
                </div>
              )}
              {voiceError && (
                <p className="mb-1 px-1 text-sm text-red-600" role="alert">
                  {voiceError}
                </p>
              )}
              {showComposerMenu && (
                <div className="absolute bottom-full left-2 z-20 mb-1 min-w-[180px] rounded border border-[#ccc] bg-white py-1 shadow-lg">
                  {!showMuteSubmenu ? (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100"
                        onClick={() => setShowMuteSubmenu(true)}
                      >
                        Mute
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100"
                        onClick={() => {
                          setSearchOpen(true);
                          setShowComposerMenu(false);
                        }}
                      >
                        <Search className="h-3.5 w-3.5" />
                        Search
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={clearHistory}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear History
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100"
                        onClick={() => setShowMuteSubmenu(false)}
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                        onClick={() => {
                          setMute(true);
                          setShowComposerMenu(false);
                          setShowMuteSubmenu(false);
                        }}
                      >
                        Disable sound
                      </button>
                      <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100">
                        Mute for…
                      </button>
                      <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100">
                        Customize
                      </button>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setMute(true);
                          setShowComposerMenu(false);
                          setShowMuteSubmenu(false);
                        }}
                      >
                        Mute Forever
                      </button>
                    </>
                  )}
                </div>
              )}

              {isRecording ? (
                <div className="flex items-center gap-2 rounded border border-[#cfcfcf] bg-white px-1.5 py-1">
                  <button
                    type="button"
                    onClick={cancelVoiceRecording}
                    className="mb-0.5 shrink-0 rounded p-1 text-gray-500 hover:bg-[#e8e8e8] hover:text-gray-800"
                    title="Cancel recording"
                    aria-label="Cancel recording"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
                    <span className="text-sm font-medium tabular-nums text-red-600">
                      {formatRecordingTime(recordingSeconds)}
                    </span>
                    <span className="truncate text-sm text-gray-500">Recording…</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopAndSendVoiceRecording}
                    disabled={sendingBroadcast || recordingSeconds < 1}
                    className="mb-0.5 shrink-0 rounded bg-[#8b1a1a] p-1 text-white hover:bg-[#6e1414] disabled:opacity-40"
                    title="Send voice message"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-1.5 rounded border border-[#cfcfcf] bg-white px-1.5 py-1">
                  <button
                    type="button"
                    className="mb-0.5 shrink-0 rounded p-1 text-[#555] hover:bg-[#e8e8e8]"
                    onClick={() => {
                      setShowComposerMenu((v) => !v);
                      setShowMuteSubmenu(false);
                    }}
                    title="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <textarea
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (voiceError) setVoiceError(null);
                    }}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendBroadcast();
                      }
                    }}
                    rows={1}
                    placeholder={
                      pendingImage
                        ? 'Add a caption…'
                        : 'Broadcast (paste image, add caption, then Send)'
                    }
                    className="max-h-28 min-h-[28px] min-w-0 flex-1 resize-none border-0 bg-transparent py-1 text-sm leading-5 outline-none placeholder:text-gray-400 scrollbar-hide"
                  />
                  {showVoiceButton ? (
                    <button
                      type="button"
                      onClick={() => void startVoiceRecording()}
                      disabled={sendingBroadcast}
                      className="mb-0.5 shrink-0 rounded p-1 text-[#555] hover:bg-[#e8e8e8] hover:text-[#222] disabled:opacity-40"
                      title="Record voice message"
                      aria-label="Record voice message"
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void sendBroadcast()}
                      disabled={sendingBroadcast || !canSendText}
                      className="mb-0.5 shrink-0 rounded bg-[#8b1a1a] p-1 text-white hover:bg-[#6e1414] disabled:opacity-40"
                      title="Send broadcast"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center bg-[#f7f7f7] text-sm text-gray-500">
              Click <span className="mx-1 font-semibold text-[#2a6db0]">Broadcast</span> or{' '}
              <span className="mx-1 font-semibold text-[#2a6db0]">Chat users</span> to open
            </div>
          )}
        </div>
      </div>

      {!isClubChannel ? (
        <ChatSettingsUsersModal
          isOpen={showSettingsUsers}
          onClose={() => setShowSettingsUsers(false)}
          initialSettings={userSettings}
          onSave={saveUserSettings}
          onDeleteSettings={deleteUserSettings}
          options={options}
        />
      ) : (
        <ChatMemberGroupSelectModal
          isOpen={showMemberGroupSelect}
          onClose={() => setShowMemberGroupSelect(false)}
          selectedGroupId={selectedMemberGroupId}
          onSelect={saveMemberGroupSelection}
        />
      )}

      {showInviteLink && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setShowInviteLink(false)}
        >
          <div
            className="w-full max-w-md rounded-md border border-[#ccc] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold">Invite via Link</h3>
            <input
              readOnly
              value={inviteUrl}
              className="mb-3 w-full rounded border border-[#ccc] px-3 py-2 text-sm"
              onFocus={(e) => e.target.select()}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-[#8b1a1a] px-3 py-1.5 text-sm text-white hover:bg-[#6e1414]"
                onClick={() => {
                  void navigator.clipboard?.writeText(inviteUrl);
                }}
              >
                Copy link
              </button>
              <button
                type="button"
                className="rounded border border-[#ccc] px-3 py-1.5 text-sm hover:bg-gray-50"
                onClick={() => setShowInviteLink(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showQrModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-md border border-[#ccc] bg-white p-4 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold">Invite by QR Code</h3>
            <div className="mx-auto mb-3 flex h-48 w-48 items-center justify-center border border-[#ddd] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteUrl)}`}
                alt="Invite QR code"
                width={180}
                height={180}
              />
            </div>
            <p className="mb-3 break-all text-[11px] text-gray-500">{inviteUrl}</p>
            <button
              type="button"
              className="rounded border border-[#ccc] px-4 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => setShowQrModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-[80] min-w-[200px] overflow-hidden rounded-xl border border-[#2a3544] bg-[#1e2733] py-1 text-white shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => void handleContextCopy()}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-white/10"
          >
            <Copy className="h-4 w-4 shrink-0 opacity-90" />
            Copy
          </button>
          <button
            type="button"
            onClick={() => void handleContextForward()}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-white/10"
          >
            <Forward className="h-4 w-4 shrink-0 opacity-90" />
            Forward
          </button>
          <button
            type="button"
            onClick={handleContextPin}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-white/10"
          >
            <Pin className="h-4 w-4 shrink-0 opacity-90" />
            {pinnedId === contextMenu.message.id ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            onClick={handleContextDelete}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] text-red-300 hover:bg-white/10"
          >
            <Trash2 className="h-4 w-4 shrink-0 opacity-90" />
            Delete
          </button>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-md border border-[#ccc] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold text-gray-900">Delete message</h3>
            <p className="mb-4 text-sm text-gray-600">
              Remove this message only for you, or also for everyone who can see the channel?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={deleting}
                className="rounded border border-[#ccc] px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                onClick={deleteForMe}
              >
                Delete for me
              </button>
              <button
                type="button"
                disabled={deleting}
                className="rounded bg-[#8b1a1a] px-3 py-2 text-sm text-white hover:bg-[#6e1414] disabled:opacity-50"
                onClick={() => void deleteForEveryone()}
              >
                {deleting ? 'Deleting…' : 'Delete for everyone'}
              </button>
              <button
                type="button"
                disabled={deleting}
                className="rounded px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {forwardingMessage && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4"
          onClick={() => !forwarding && setForwardingMessage(null)}
        >
          <div
            className="w-full max-w-sm rounded-md border border-[#ccc] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold text-gray-900">Forward message</h3>
            <p className="mb-3 truncate text-sm text-gray-600">
              {previewText(forwardingMessage.content, 100)}
            </p>
            <div className="mb-3 max-h-56 overflow-y-auto rounded border border-[#e5e5e5]">
              {conversations.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-gray-500">No conversations found</p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={forwarding}
                    className="flex w-full items-center px-3 py-2.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
                    onClick={() => void handleForwardTo(c.id)}
                  >
                    {c.otherUser.name}
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={forwarding}
              className="rounded border border-[#ccc] px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              onClick={() => setForwardingMessage(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
