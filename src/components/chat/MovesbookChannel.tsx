'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  DoorOpen,
  Eye,
  Forward,
  ImagePlus,
  MessageSquare,
  Pencil,
  Pin,
  QrCode,
  Reply,
  Search,
  Send,
  Settings,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  buildImageContent,
  isImageContent,
  messagePreview,
  parseImageContent,
} from '@/lib/chat/messageContent';

export type ChannelBroadcastMessage = {
  id: string;
  content: string;
  mode: string;
  senderName: string;
  createdAt: string;
  isReply?: boolean;
  isOwn?: boolean;
  parentId?: string | null;
  parentContent?: string | null;
  parentSenderName?: string | null;
};

const MUTE_KEY = 'movesbookChannelMuted';
const LEFT_KEY = 'movesbookChannelLeft';
const READ_AT_KEY = 'movesbookChannelReadAt';
const PIN_KEY = 'movesbookChannelPinnedId';
const HIDDEN_KEY = 'movesbookChannelHiddenIds';

function storageKey(base: string, clubId?: string | null): string {
  const id = typeof clubId === 'string' ? clubId.trim() : '';
  return id ? `clubChannel:${id}:${base}` : base;
}

function withClubQuery(url: string, clubId?: string | null): string {
  const id = typeof clubId === 'string' ? clubId.trim() : '';
  if (!id) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}clubId=${encodeURIComponent(id)}`;
}

function channelLeftEventName(clubId?: string | null): string {
  const id = typeof clubId === 'string' ? clubId.trim() : '';
  return id ? `club-channel-left:${id}` : 'movesbook-channel-left';
}

function channelRejoinedEventName(clubId?: string | null): string {
  const id = typeof clubId === 'string' ? clubId.trim() : '';
  return id ? `club-channel-rejoined:${id}` : 'movesbook-channel-rejoined';
}

type ConversationOption = {
  id: string;
  otherUser: { id: string; name: string };
};

type ContextMenuState = {
  x: number;
  y: number;
  message: ChannelBroadcastMessage;
};

/** Audience labels shown on each broadcast bubble for normal users. */
const PLATFORM_BROADCAST_MODE_LABELS: Record<string, string> = {
  all: 'Sent to all users',
  subscribers: 'Sent to only subscribers',
  group: 'Sent to only group selected',
  favourites: 'Sent to only favourites',
  repliers: 'Channel chat',
};

const CLUB_BROADCAST_MODE_LABELS: Record<string, string> = {
  all: 'Sent to all members',
  subscribers: 'Sent to only subscribers',
  group: 'Sent to only group selected',
  favourites: 'Sent to only favourites',
  repliers: 'Channel chat',
};

function broadcastModeLabel(mode: string, clubId?: string | null): string {
  const labels = clubId ? CLUB_BROADCAST_MODE_LABELS : PLATFORM_BROADCAST_MODE_LABELS;
  return labels[mode] ?? (clubId ? 'Sent to all members' : 'Sent to all users');
}

type MovesbookChannelProps = {
  getAuthHeaders: () => Record<string, string>;
  selected: boolean;
  onSelect: () => void;
  /** When true, render only the top header strip (left column). */
  variant: 'header' | 'pane';
  onCloseEmbedded?: () => void;
  /**
   * When set, shows Club Channel for that club (member view of admin broadcasts)
   * instead of the platform Movesbook Channel.
   */
  clubId?: string | null;
};

/** Channel avatar — uses admin-set photo when available. */
export function ChannelAvatar({
  size = 36,
  className = '',
  photoUrl,
  alt = 'Channel',
}: {
  size?: number;
  className?: string;
  photoUrl?: string | null;
  alt?: string;
}) {
  if (photoUrl) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ${className}`}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={alt} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" width={size * 0.78} height={size * 0.78} fill="none">
        <circle cx="20" cy="20" r="18" stroke="#1a2332" strokeWidth="1.2" opacity="0.15" />
        <path
          d="M12 26c1.5-3.5 4.2-5.5 8-5.5s6.5 2 8 5.5"
          stroke="#1a2332"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M14 18.5c.8-4 2.8-7 6-7s5.2 3 6 7"
          stroke="#1a2332"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="15.5" cy="19" r="1.3" fill="#1a2332" />
        <circle cx="24.5" cy="19" r="1.3" fill="#1a2332" />
        <path
          d="M20 11.5v3.5M17 13l1.5 1.5M23 13l-1.5 1.5M12.5 22.5h3M24.5 22.5h3"
          stroke="#1a2332"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d="M10 16.5c1.2-1 2.2-1.4 3.2-1.6M30 16.5c-1.2-1-2.2-1.4-3.2-1.6"
          stroke="#1a2332"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

function loadHiddenIds(clubId?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(HIDDEN_KEY, clubId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((v) => String(v)));
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

export function loadChannelLeft(clubId?: string | null): boolean {
  try {
    return localStorage.getItem(storageKey(LEFT_KEY, clubId)) === '1';
  } catch {
    return false;
  }
}

export function rejoinMovesbookChannel(clubId?: string | null): void {
  try {
    localStorage.removeItem(storageKey(LEFT_KEY, clubId));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(channelRejoinedEventName(clubId)));
}

export function getChannelLeftEventName(clubId?: string | null): string {
  return channelLeftEventName(clubId);
}

export function getChannelRejoinedEventName(clubId?: string | null): string {
  return channelRejoinedEventName(clubId);
}

export default function MovesbookChannel({
  getAuthHeaders,
  selected,
  onSelect,
  variant,
  onCloseEmbedded,
  clubId = null,
}: MovesbookChannelProps) {
  const [messages, setMessages] = useState<ChannelBroadcastMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [channelPhoto, setChannelPhoto] = useState<string | null>(null);
  const [channelName, setChannelName] = useState(
    clubId ? 'Club Channel' : 'Movesbook channel'
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [editingMessage, setEditingMessage] = useState<ChannelBroadcastMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChannelBroadcastMessage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<ChannelBroadcastMessage | null>(null);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const highlightClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickToBottomRef = useRef(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const inviteUrl =
    typeof window !== 'undefined'
      ? clubId
        ? `${window.location.origin}/register?invite=club-${clubId}`
        : `${window.location.origin}/register?invite=movesbook-channel`
      : clubId
        ? 'https://movesbook.app/register?invite=club'
        : 'https://movesbook.app/register?invite=movesbook-channel';

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(withClubQuery('/api/chat/broadcast', clubId), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.messages) ? (data.messages as ChannelBroadcastMessage[]) : [];
      setMessages(list);
      if (typeof data.channelPhoto === 'string' && data.channelPhoto.trim()) {
        setChannelPhoto(data.channelPhoto.trim());
      }
      if (typeof data.channelName === 'string' && data.channelName.trim()) {
        // Normalize casing for Club Channel display
        const name = data.channelName.trim();
        setChannelName(
          clubId && name.toLowerCase() === 'club channel' ? 'Club Channel' : name
        );
      }

      let readAt = 0;
      try {
        readAt = Number(localStorage.getItem(storageKey(READ_AT_KEY, clubId)) || '0');
      } catch {
        readAt = 0;
      }
      const unread = list.filter(
        (m) =>
          m.mode !== 'reply' &&
          !m.isReply &&
          new Date(m.createdAt).getTime() > readAt
      ).length;
      setUnreadCount(unread);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, clubId]);

  useEffect(() => {
    try {
      setMuted(localStorage.getItem(storageKey(MUTE_KEY, clubId)) === '1');
    } catch {
      /* ignore */
    }
    setPinnedId(loadPinnedId(clubId));
    setHiddenIds(loadHiddenIds(clubId));
    setChannelName(clubId ? 'Club Channel' : 'Movesbook channel');
    void loadMessages();
    const t = setInterval(() => void loadMessages(), 60_000);
    return () => clearInterval(t);
  }, [loadMessages, clubId]);

  useEffect(() => {
    if (!selected) return;
    try {
      localStorage.setItem(storageKey(READ_AT_KEY, clubId), String(Date.now()));
    } catch {
      /* ignore */
    }
    setUnreadCount(0);
    void loadMessages();
  }, [selected, loadMessages, clubId]);

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
  }, []);

  useEffect(() => {
    if (!selected) return;
    stickToBottomRef.current = true;
    setShowScrollToBottom(false);
  }, [selected, clubId]);

  useEffect(() => {
    return () => {
      if (highlightClearTimerRef.current) clearTimeout(highlightClearTimerRef.current);
    };
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const container = messagesContainerRef.current;
    if (!container || !messageId) return;
    const target = container.querySelector(
      `[data-message-id="${CSS.escape(messageId)}"]`,
    ) as HTMLElement | null;
    if (!target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop =
      targetRect.top - containerRect.top + container.scrollTop - Math.max(24, container.clientHeight * 0.25);
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
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

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

  const setMute = (value: boolean) => {
    setMuted(value);
    try {
      localStorage.setItem(storageKey(MUTE_KEY, clubId), value ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const requestLeaveChannel = () => {
    setMenuOpen(false);
    setLeaveConfirmOpen(true);
  };

  const confirmLeaveChannel = () => {
    try {
      localStorage.setItem(storageKey(LEFT_KEY, clubId), '1');
    } catch {
      /* ignore */
    }
    setLeaveConfirmOpen(false);
    window.dispatchEvent(new Event(channelLeftEventName(clubId)));
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

  const handleMessageContextMenu = (e: React.MouseEvent, msg: ChannelBroadcastMessage) => {
    e.preventDefault();
    e.stopPropagation();
    const pad = 8;
    const menuW = 200;
    const menuH = msg.isOwn ? 280 : 240;
    const x = Math.min(e.clientX, window.innerWidth - menuW - pad);
    const y = Math.min(e.clientY, window.innerHeight - menuH - pad);
    setContextMenu({ x: Math.max(pad, x), y: Math.max(pad, y), message: msg });
  };

  const handleContextReply = () => {
    if (!contextMenu) return;
    const msg = contextMenu.message;
    const targetId =
      msg.isReply || msg.mode === 'reply'
        ? msg.parentId || msg.id
        : msg.id;
    setContextMenu(null);
    openReply(targetId);
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

  const handleContextEdit = () => {
    if (!contextMenu?.message.isOwn) return;
    setEditingMessage(contextMenu.message);
    setEditText(contextMenu.message.content);
    setContextMenu(null);
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
      }
    } catch {
      setConversations([]);
    }
  };

  const handleForwardTo = async (conversationId: string) => {
    if (!forwardingMessage || forwarding) return;
    setForwarding(true);
    try {
      const content = isImageContent(forwardingMessage.content)
        ? forwardingMessage.content
        : `Forwarded from ${forwardingMessage.senderName}: ${forwardingMessage.content}`;
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
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
    const msg = contextMenu.message;
    setContextMenu(null);
    if (msg.isOwn) {
      setDeleteTarget(msg);
    } else {
      hideMessageLocally(msg.id);
    }
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
        `/api/chat/broadcast/reply?messageId=${encodeURIComponent(deleteTarget.id)}`,
        { method: 'DELETE', headers: getAuthHeaders() }
      );
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
        hideMessageLocally(deleteTarget.id);
        setDeleteTarget(null);
      }
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  const saveEdit = async () => {
    if (!editingMessage || savingEdit) return;
    const content = editText.trim();
    if (!content) return;
    setSavingEdit(true);
    try {
      const res = await fetch('/api/chat/broadcast/reply', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ messageId: editingMessage.id, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === editingMessage.id ? { ...m, ...data.message } : m))
        );
        setEditingMessage(null);
        setEditText('');
      }
    } catch {
      /* ignore */
    } finally {
      setSavingEdit(false);
    }
  };

  const broadcastMessages = messages.filter((m) => !m.isReply && m.mode !== 'reply');

  const openReply = (messageId?: string) => {
    const targetId =
      messageId ??
      replyToId ??
      broadcastMessages[broadcastMessages.length - 1]?.id ??
      null;
    if (!targetId) {
      setReplyError('No broadcast message to reply to yet.');
      setReplyOpen(true);
      return;
    }
    setReplyToId(targetId);
    setReplyError(null);
    setReplyOpen(true);
  };

  const closeReply = () => {
    setReplyOpen(false);
    setReplyText('');
    setPendingImage(null);
    setReplyError(null);
  };

  const readImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setReplyError('Only image files are supported.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setReplyError('Image must be under 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl.startsWith('data:image/')) {
        setReplyError('Failed to read image.');
        return;
      }
      setPendingImage(dataUrl);
      setReplyError(null);
    };
    reader.onerror = () => setReplyError('Failed to read image.');
    reader.readAsDataURL(file);
  };

  const handleReplyPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) readImageFile(file);
        return;
      }
    }
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) readImageFile(file);
  };

  const sendReply = async () => {
    const text = replyText.trim();
    const image = pendingImage;
    const targetId = replyToId ?? broadcastMessages[broadcastMessages.length - 1]?.id ?? null;
    if ((!text && !image) || !targetId || sendingReply) return;

    setSendingReply(true);
    setReplyError(null);
    try {
      // Image + optional caption in one message (Telegram-style).
      const content = image ? buildImageContent(image, text) : text;
      const res = await fetch('/api/chat/broadcast/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ content, replyToId: targetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReplyError(typeof data.error === 'string' ? data.error : 'Failed to send reply');
        return;
      }
      if (data.message) {
        setMessages((prev) => [...prev, data.message as ChannelBroadcastMessage]);
      } else {
        await loadMessages();
      }
      setReplyText('');
      setPendingImage(null);
      setReplyOpen(false);
    } catch {
      setReplyError('Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const replyTarget = replyToId
    ? broadcastMessages.find((m) => m.id === replyToId) ?? null
    : broadcastMessages[broadcastMessages.length - 1] ?? null;

  const filtered =
    (searchOpen && searchQuery.trim()
      ? messages.filter((m) => {
          const q = searchQuery.trim().toLowerCase();
          if (isImageContent(m.content)) {
            return messagePreview(m.content).toLowerCase().includes(q) || '[image]'.includes(q);
          }
          return m.content.toLowerCase().includes(q);
        })
      : messages
    ).filter((m) => !hiddenIds.has(m.id));

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atBottom = scrollHeight - scrollTop - clientHeight < 80;
    stickToBottomRef.current = atBottom;
    setShowScrollToBottom(!atBottom && filtered.length > 0);
  }, [filtered.length]);

  useEffect(() => {
    if (!selected || variant !== 'pane') return;
    // Keep pinned to latest only when the user is already near the bottom.
    if (!stickToBottomRef.current && filtered.length > 0) {
      setShowScrollToBottom(true);
      return;
    }
    scrollToBottom('auto');
  }, [selected, filtered.length, variant, scrollToBottom]);

  const pinnedMessage = pinnedId ? messages.find((m) => m.id === pinnedId && !hiddenIds.has(m.id)) : null;

  const inviteModal = showInvite ? (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
      onClick={() => setShowInvite(false)}
    >
      <div
        className="w-full max-w-md rounded-md border border-[#ccc] bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-base font-semibold">Share invite</h3>
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
            onClick={() => void navigator.clipboard?.writeText(inviteUrl)}
          >
            Copy link
          </button>
          <button
            type="button"
            className="rounded border border-[#ccc] px-3 py-1.5 text-sm hover:bg-gray-50"
            onClick={() => setShowInvite(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const leaveConfirmModal = leaveConfirmOpen ? (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
      onClick={() => setLeaveConfirmOpen(false)}
    >
      <div
        className="w-full max-w-sm rounded-md border border-[#ccc] bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-base font-semibold text-gray-900">
          Leave {channelName}?
        </h3>
        <p className="mb-4 text-sm text-gray-600">
          You will stop seeing broadcast messages here. You can rejoin anytime from the chat list.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-[#ccc] px-3 py-1.5 text-sm hover:bg-gray-50"
            onClick={() => setLeaveConfirmOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-[#8b1a1a] px-3 py-1.5 text-sm text-white hover:bg-[#6e1414]"
            onClick={confirmLeaveChannel}
          >
            Leave Channel
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (variant === 'header') {
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onMouseDown={(e) => {
            // Keep page scroll position stable when focusing this control.
            e.preventDefault();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect();
            }
          }}
          className={`flex w-full shrink-0 cursor-pointer items-start gap-2.5 border-b border-[#15202b] px-3 py-2.5 text-left transition ${
            selected ? 'bg-[#252d38]' : 'bg-[#1a2332] hover:bg-[#222b38]'
          }`}
        >
          <ChannelAvatar size={40} className="mt-0.5 shadow-sm" photoUrl={channelPhoto} alt={channelName} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1.5">
              <span className="truncate text-[15px] font-semibold text-white">{channelName}</span>
              {unreadCount > 0 && !muted && (
                <span className="shrink-0 text-[15px] font-bold text-[#e8a317]">({unreadCount})</span>
              )}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowInvite(true);
              }}
              className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-[#8ab4d9] hover:underline"
              title="Share invite"
            >
              <QrCode className="h-3.5 w-3.5" />
              Share invite.
            </button>
          </span>
        </div>
        {inviteModal}
        {leaveConfirmModal}
      </>
    );
  }

  // pane variant — message view matching legacy Movesbook channel
  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col bg-[#e8e8e8]">
      {onCloseEmbedded && (
        <div className="flex shrink-0 items-center justify-end border-b border-gray-200 bg-[#e8e8e8] px-2 py-1">
          <button
            type="button"
            onClick={onCloseEmbedded}
            className="rounded-lg p-2 text-gray-500 hover:bg-black/5 hover:text-gray-800"
            title="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {searchOpen && (
        <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channel…"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
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
        <div className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-[#fff8e7] px-3 py-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2 rounded text-left hover:bg-amber-100/70"
            title="Jump to pinned message"
            onClick={() => scrollToMessage(pinnedMessage.id)}
          >
            <Pin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                Pinned · {pinnedMessage.senderName}
              </div>
              <div className="truncate text-[13px] text-gray-800">
                {messagePreview(pinnedMessage.content, 120)}
              </div>
            </div>
          </button>
          <button
            type="button"
            className="shrink-0 text-amber-700/70 hover:text-amber-900"
            title="Unpin"
            onClick={() => {
              setPinnedId(null);
              savePinnedId(null, clubId);
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
      <div
        ref={messagesContainerRef}
        className="h-full overflow-y-auto bg-[#e8e8e8] p-4"
        onScroll={handleMessagesScroll}
      >
        {loading && messages.length === 0 ? (
          <p className="text-center text-sm text-gray-500">Loading channel…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-500">No channel messages yet.</p>
        ) : (
          <div className="flex w-full flex-col gap-5">
            {filtered.map((msg) => {
              const isReply = Boolean(msg.isReply || msg.mode === 'reply');
              const isHighlighted = highlightMessageId === msg.id;
              if (isReply) {
                const parentId = msg.parentId?.trim() || null;
                return (
                  <div
                    key={msg.id}
                    data-message-id={msg.id}
                    className={`flex flex-col gap-1 ${msg.isOwn ? 'items-end' : 'items-start'}`}
                    onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                  >
                    {!msg.isOwn && (
                      <div className="flex items-center gap-2 px-0.5">
                        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#5b8def] text-[10px] font-semibold text-white">
                          {(msg.senderName || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="text-[13px] font-medium text-[#2e7d32]">{msg.senderName}</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 shadow-sm transition ring-offset-1 ${
                        msg.isOwn
                          ? 'rounded-tr-md bg-[#dcf8c6]'
                          : 'rounded-tl-md bg-white'
                      } ${pinnedId === msg.id ? 'ring-2 ring-amber-400' : ''} ${
                        isHighlighted ? 'ring-2 ring-[#3390ec]' : ''
                      }`}
                    >
                      {(msg.parentContent || msg.parentSenderName) && (
                        <button
                          type="button"
                          disabled={!parentId}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (parentId) scrollToMessage(parentId);
                          }}
                          className={`mb-1.5 w-full rounded-md border-l-2 border-[#6b9e3a] bg-black/5 px-2 py-1 text-left text-[11px] text-gray-600 transition ${
                            parentId
                              ? 'cursor-pointer hover:bg-black/10'
                              : 'cursor-default'
                          }`}
                          title={parentId ? 'Go to original message' : undefined}
                        >
                          <div className="font-semibold text-[#4a6b2a]">
                            {msg.parentSenderName || 'Broadcast'}
                          </div>
                          <div className="truncate">{messagePreview(msg.parentContent || '', 100)}</div>
                        </button>
                      )}
                      {(() => {
                        const image = parseImageContent(msg.content);
                        if (image) {
                          return (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={image.src}
                                alt="Shared media"
                                className="max-h-64 max-w-full rounded-lg object-contain"
                              />
                              {image.caption ? (
                                <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-snug text-gray-900">
                                  {image.caption}
                                </p>
                              ) : null}
                            </>
                          );
                        }
                        return (
                          <p className="whitespace-pre-wrap break-words text-[14px] leading-snug text-gray-900">
                            {msg.content}
                          </p>
                        );
                      })()}
                      <div className="mt-1.5 flex items-center justify-end gap-2 text-[11px] text-gray-400">
                        {pinnedId === msg.id && <Pin className="h-3 w-3 text-amber-600" />}
                        <span>{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              const selectedForReply = replyOpen && replyToId === msg.id;
              return (
                <div
                  key={msg.id}
                  data-message-id={msg.id}
                  className="flex flex-col items-start gap-1"
                  onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                >
                  <div className="flex items-center gap-2 px-0.5">
                    <ChannelAvatar size={22} photoUrl={channelPhoto} />
                    <span className="text-[13px] font-medium text-[#2e7d32]">{msg.senderName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openReply(msg.id)}
                    className={`max-w-[92%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-left shadow-sm transition ring-offset-1 ${
                      selectedForReply ? 'ring-2 ring-[#8ab4d9]' : 'hover:bg-gray-50'
                    } ${pinnedId === msg.id ? 'ring-2 ring-amber-400' : ''} ${
                      isHighlighted ? 'ring-2 ring-[#3390ec]' : ''
                    }`}
                    title="Reply to this broadcast"
                  >
                    <div className="whitespace-pre-wrap break-words text-[14px] leading-snug text-gray-900">
                      {(() => {
                        const image = parseImageContent(msg.content);
                        if (image) {
                          return (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={image.src}
                                alt="Shared media"
                                className="max-h-64 max-w-full rounded-lg object-contain"
                              />
                              {image.caption ? (
                                <p className="mt-2 whitespace-pre-wrap break-words">{image.caption}</p>
                              ) : null}
                            </>
                          );
                        }
                        return msg.content;
                      })()}
                    </div>
                    <div className="mt-1.5 flex items-end justify-between gap-3 text-[11px] text-gray-400">
                      <span className="min-w-0 flex-1 leading-snug text-[#6b7280]">
                        {broadcastModeLabel(msg.mode, clubId)}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-2">
                        {pinnedId === msg.id && <Pin className="h-3 w-3 text-amber-600" />}
                        <span className="inline-flex items-center gap-0.5">
                          <Eye className="h-3 w-3" />
                          <span>1</span>
                        </span>
                        <span>{formatTime(msg.createdAt)}</span>
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>
      {showScrollToBottom && filtered.length > 0 && (
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

      <div className="relative shrink-0 border-t border-gray-300 bg-[#dcdcdc] px-3 py-2.5">
        {replyOpen && (
          <div className="mb-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-gray-200">
            {replyTarget ? (
              <div className="mb-2 flex items-start gap-2 border-l-2 border-[#6b9e3a] bg-[#f4faf0] px-2 py-1.5 text-[12px] text-gray-600">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#4a6b2a]">
                    Replying to {replyTarget.senderName}
                  </div>
                  <div className="truncate">{messagePreview(replyTarget.content, 80)}</div>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-gray-400 hover:text-gray-700"
                  onClick={closeReply}
                  aria-label="Cancel reply"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="mb-2 flex items-center justify-between text-[12px] text-gray-500">
                <span>Select a broadcast to reply to</span>
                <button type="button" className="hover:underline" onClick={closeReply}>
                  Cancel
                </button>
              </div>
            )}
            {pendingImage && (
              <div className="mb-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingImage}
                  alt="Selected media"
                  className="h-16 w-16 rounded border border-gray-300 object-cover"
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
            <div className="flex items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageInputChange}
              />
              <button
                type="button"
                className="rounded-full p-2 text-gray-600 hover:bg-black/5 disabled:opacity-40"
                title="Attach image"
                disabled={sendingReply || !replyTarget}
                onClick={() => imageInputRef.current?.click()}
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onPaste={handleReplyPaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendReply();
                  }
                }}
                placeholder={
                  pendingImage ? 'Add a caption…' : 'Reply… (or paste / attach an image)'
                }
                className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                autoFocus
                disabled={sendingReply || !replyTarget}
              />
              <button
                type="button"
                onClick={() => void sendReply()}
                disabled={sendingReply || (!replyText.trim() && !pendingImage) || !replyTarget}
                className="inline-flex items-center justify-center rounded-full bg-[#2e7d32] p-2 text-white transition hover:bg-[#256628] disabled:cursor-not-allowed disabled:opacity-40"
                title="Send reply"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            {replyError && <p className="mt-1 text-[11px] text-red-600">{replyError}</p>}
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="rounded-full p-2 text-gray-600 hover:bg-black/5"
              title="Channel settings"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <Settings className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="absolute bottom-full left-0 z-30 mb-1.5 w-[220px] overflow-hidden rounded-md border border-[#d0d0d0] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.18)]">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-[15px] text-[#222] hover:bg-gray-50"
                  onClick={() => {
                    setMute(!muted);
                    setMenuOpen(false);
                  }}
                >
                  <Volume2 className="h-[18px] w-[18px] shrink-0 text-[#444]" />
                  <span className="flex-1">{muted ? 'Unmute' : 'Mute'}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#888]" />
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-[15px] text-[#222] hover:bg-gray-50"
                  onClick={() => {
                    setSearchOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  <Search className="h-[18px] w-[18px] shrink-0 text-[#444]" />
                  <span className="flex-1">Search</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-[15px] text-[#222] hover:bg-gray-50"
                  onClick={requestLeaveChannel}
                >
                  <DoorOpen className="h-[18px] w-[18px] shrink-0 text-[#444]" />
                  <span className="flex-1">Leave Channel</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="rounded-full p-2 text-gray-600 hover:bg-black/5"
            title="Search channel"
            onClick={() => setSearchOpen((v) => !v)}
          >
            <Search className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setMute(!muted)}
            className="flex flex-1 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition hover:bg-gray-50"
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>

          <button
            type="button"
            className={`rounded-full p-2 transition ${
              replyOpen ? 'bg-[#2e7d32]/15 text-[#2e7d32]' : 'text-gray-600 hover:bg-black/5'
            }`}
            title="Reply to broadcast"
            onClick={() => {
              if (replyOpen) closeReply();
              else openReply();
            }}
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        </div>
      </div>
      {inviteModal}
      {leaveConfirmModal}

      {contextMenu && (
        <div
          className="fixed z-[80] min-w-[200px] overflow-hidden rounded-xl border border-[#2a3544] bg-[#1e2733] py-1 text-white shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={handleContextReply}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-white/10"
          >
            <Reply className="h-4 w-4 shrink-0 opacity-90" />
            Reply
          </button>
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
          {contextMenu.message.isOwn && !isImageContent(contextMenu.message.content) && (
            <button
              type="button"
              onClick={handleContextEdit}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-white/10"
            >
              <Pencil className="h-4 w-4 shrink-0 opacity-90" />
              Edit
            </button>
          )}
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
                className="rounded px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMessage && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-4"
          onClick={() => !savingEdit && setEditingMessage(null)}
        >
          <div
            className="w-full max-w-md rounded-md border border-[#ccc] bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold text-gray-900">Edit message</h3>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="mb-3 w-full rounded border border-[#ccc] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-[#ccc] px-3 py-1.5 text-sm hover:bg-gray-50"
                disabled={savingEdit}
                onClick={() => setEditingMessage(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-[#2e7d32] px-3 py-1.5 text-sm text-white hover:bg-[#256628] disabled:opacity-50"
                disabled={savingEdit || !editText.trim()}
                onClick={() => void saveEdit()}
              >
                {savingEdit ? 'Saving…' : 'Save'}
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
            className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900">Forward to</h3>
              <p className="mt-0.5 truncate text-sm text-gray-500">
                {messagePreview(forwardingMessage.content, 60)}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <p className="p-4 text-center text-sm text-gray-500">
                  No conversations yet. Start a chat first.
                </p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={forwarding}
                    onClick={() => void handleForwardTo(c.id)}
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-gray-50 disabled:opacity-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 font-semibold text-white">
                      {c.otherUser.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate font-medium text-gray-900">{c.otherUser.name}</span>
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-gray-200 p-2">
              <button
                type="button"
                className="w-full rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-100"
                onClick={() => setForwardingMessage(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
