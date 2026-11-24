'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutGrid,
  MessageCircle,
  Send,
  Reply,
  Copy,
  Forward,
  Pin,
  Trash2,
  Search,
  Settings,
  Volume2,
  X,
  ChevronRight,
  ChevronDown,
  Mic,
  Square,
} from 'lucide-react';
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

type ReplierUser = {
  id: string;
  name: string;
  image: string | null;
  telegramAccount: string | null;
  isOnline: boolean;
  lastMessageAt: string;
  lastMessagePreview: string;
  conversationId: string | null;
  replyCount: number;
};

type BroadcastReply = {
  id: string;
  content: string;
  createdAt: string;
  senderUserId: string;
  senderName: string;
  senderImage: string | null;
  parentId: string | null;
  parentContent: string | null;
  parentSenderName: string | null;
  isOwn: boolean;
  source: 'broadcast_reply';
};

/** Admin message sent from Chat users → All (channel-only, not 1:1). */
type ChannelMessage = {
  id: string;
  content: string;
  createdAt: string;
  senderName: string;
  isOwn: boolean;
  source: 'channel';
};

type ConversationMessage = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isOwn: boolean;
  source: 'conversation';
};

type ThreadMessage = (BroadcastReply | ChannelMessage | ConversationMessage) & {
  senderName: string;
  content: string;
  createdAt: string;
  isOwn: boolean;
};

type ConversationOption = {
  id: string;
  otherUser: { id: string; name: string };
};

type ContextMenuState = {
  x: number;
  y: number;
  message: ThreadMessage;
};

type AdminChatUsersPanelProps = {
  getAuthHeaders: () => Record<string, string>;
  onCountChange?: (count: number) => void;
  /** When set, scopes Chat users / repliers to this club's channel. */
  clubId?: string | null;
};

function withClubQuery(url: string, clubId?: string | null): string {
  const id = typeof clubId === 'string' ? clubId.trim() : '';
  if (!id) return url;
  const q = `clubId=${encodeURIComponent(id)}`;
  return url.includes('?') ? `${url}&${q}` : `${url}?${q}`;
}

const AVATAR_COLORS = [
  '#e17076',
  '#7bc862',
  '#e5ca4f',
  '#65aadd',
  '#ee7aae',
  '#6ec9cb',
  '#faa774',
];

const MUTE_KEY = 'adminChatUsersMuted';
const PIN_KEY_PREFIX = 'adminChatUsersPinned:';
const HIDDEN_KEY_PREFIX = 'adminChatUsersHidden:';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function previewText(content: string, max = 100): string {
  return messagePreview(content, max);
}

function storageScope(selectedUserId: string | null): string {
  return selectedUserId ?? 'all';
}

function loadPinnedId(scope: string): string | null {
  try {
    return localStorage.getItem(`${PIN_KEY_PREFIX}${scope}`);
  } catch {
    return null;
  }
}

function savePinnedId(scope: string, id: string | null) {
  try {
    const key = `${PIN_KEY_PREFIX}${scope}`;
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function loadHiddenIds(scope: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${HIDDEN_KEY_PREFIX}${scope}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function saveHiddenIds(scope: string, ids: Set<string>) {
  try {
    localStorage.setItem(`${HIDDEN_KEY_PREFIX}${scope}`, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function messageSource(msg: ThreadMessage): string {
  return 'source' in msg ? msg.source : 'msg';
}

function UserAvatar({
  name,
  image,
  size = 44,
  online,
}: {
  name: string;
  image?: string | null;
  size?: number;
  online?: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center rounded-full text-[13px] font-semibold text-white"
          style={{ backgroundColor: avatarColor(name) }}
        >
          {initials(name)}
        </span>
      )}
      {online != null && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
            online ? 'bg-[#4caf50]' : 'bg-gray-400'
          }`}
        />
      )}
    </span>
  );
}

export default function AdminChatUsersPanel({
  getAuthHeaders,
  onCountChange,
  clubId = null,
}: AdminChatUsersPanelProps) {
  const defaultSenderName = clubId ? 'Club admin' : 'Movesbook admin';
  const [users, setUsers] = useState<ReplierUser[]>([]);
  const [replies, setReplies] = useState<BroadcastReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null); // null = All
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  /** Staged paste preview; Send posts image + caption together. */
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  /** Channel-only messages from Chat users → All (mode=repliers). Never shown in 1:1. */
  const [channelMessages, setChannelMessages] = useState<ChannelMessage[]>([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<ThreadMessage | null>(null);
  const [conversations, setConversations] = useState<ConversationOption[]>([]);
  const [forwarding, setForwarding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ThreadMessage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resettingChat, setResettingChat] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [floatingDayLabel, setFloatingDayLabel] = useState<string | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const composeInputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);
  const floatingDayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scope = storageScope(selectedUserId);

  const loadRepliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(withClubQuery('/api/chat/broadcast/repliers', clubId), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.users) ? (data.users as ReplierUser[]) : [];
      const replyList = Array.isArray(data.replies) ? (data.replies as BroadcastReply[]) : [];
      const channelList = Array.isArray(data.channelMessages)
        ? (data.channelMessages as ChannelMessage[])
        : [];
      setUsers(list);
      setReplies(replyList);
      setChannelMessages(channelList);
      onCountChange?.(typeof data.count === 'number' ? data.count : list.length);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, onCountChange, clubId]);

  useEffect(() => {
    void loadRepliers();
    const interval = setInterval(() => void loadRepliers(), 20_000);
    return () => clearInterval(interval);
  }, [loadRepliers]);

  useEffect(() => {
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === '1');
    } catch {
      setMuted(false);
    }
  }, []);

  useEffect(() => {
    setPinnedId(loadPinnedId(scope));
    setHiddenIds(loadHiddenIds(scope));
    setReplyingTo(null);
    setSearchQuery('');
    setContextMenu(null);
    setMenuOpen(false);
    stickToBottomRef.current = true;
    setShowScrollToBottom(false);
    setFloatingDayLabel(null);
  }, [scope]);

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

  const ensureConversation = useCallback(
    async (userId: string): Promise<string | null> => {
      try {
        const res = await fetch('/api/chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ participantId: userId }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const id = typeof data.id === 'string' ? data.id : null;
        if (id) {
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, conversationId: id } : u))
          );
        }
        return id;
      } catch {
        return null;
      }
    },
    [getAuthHeaders]
  );

  const loadConversationMessages = useCallback(
    async (convId: string) => {
      try {
        const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          setConversationMessages([]);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data.messages) ? data.messages : [];
        setConversationMessages(
          list.map(
            (m: {
              id: string;
              senderId: string;
              senderName: string;
              content: string;
              createdAt: string;
              isOwn: boolean;
            }) => ({
              id: m.id,
              senderId: m.senderId,
              senderName: m.senderName,
              content: m.content,
              createdAt:
                typeof m.createdAt === 'string' ? m.createdAt : new Date(m.createdAt).toISOString(),
              isOwn: Boolean(m.isOwn),
              source: 'conversation' as const,
            })
          )
        );
      } catch {
        setConversationMessages([]);
      }
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    setPendingImage(null);
    setMessage('');
    setReplyingTo(null);
  }, [selectedUserId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedUserId) {
        setConversationId(null);
        setConversationMessages([]);
        setLoadingThread(false);
        return;
      }
      setLoadingThread(true);
      const convId = await ensureConversation(selectedUserId);
      if (cancelled) return;
      setConversationId(convId);
      if (convId) await loadConversationMessages(convId);
      else setConversationMessages([]);
      if (!cancelled) setLoadingThread(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, ensureConversation, loadConversationMessages]);

  const selectedUser = selectedUserId
    ? users.find((u) => u.id === selectedUserId) ?? null
    : null;

  const threadMessages: ThreadMessage[] = useMemo(() => {
    if (!selectedUserId) {
      const merged: ThreadMessage[] = [...replies, ...channelMessages];
      return merged.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
    const userReplies = replies.filter((r) => r.senderUserId === selectedUserId);
    const channelContents = new Set(channelMessages.map((m) => m.content));
    const dmOnly = conversationMessages.filter(
      (m) => !(m.isOwn && channelContents.has(m.content))
    );
    const merged: ThreadMessage[] = [...userReplies, ...dmOnly];
    return merged.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [selectedUserId, replies, conversationMessages, channelMessages]);

  const visibleMessages = useMemo(() => {
    let list = threadMessages.filter((m) => !hiddenIds.has(m.id));
    if (searchOpen && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (m) =>
          m.content.toLowerCase().includes(q) ||
          m.senderName.toLowerCase().includes(q) ||
          ('parentContent' in m &&
            typeof m.parentContent === 'string' &&
            m.parentContent.toLowerCase().includes(q))
      );
    }
    return list;
  }, [threadMessages, hiddenIds, searchOpen, searchQuery]);

  const pinnedMessage = useMemo(
    () => (pinnedId ? visibleMessages.find((m) => m.id === pinnedId) ?? null : null),
    [pinnedId, visibleMessages]
  );

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
    setShowScrollToBottom(!atBottom && visibleMessages.length > 0);
    if (!atBottom) updateFloatingDayFromScroll();
    else setFloatingDayLabel(null);
  }, [updateFloatingDayFromScroll, visibleMessages.length]);

  useEffect(() => {
    return () => {
      if (floatingDayTimerRef.current) clearTimeout(floatingDayTimerRef.current);
      if (highlightClearTimerRef.current) clearTimeout(highlightClearTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Keep pinned to latest only when the user is already near the bottom (or switched thread).
    if (!stickToBottomRef.current && visibleMessages.length > 0) {
      setShowScrollToBottom(true);
      return;
    }
    scrollToBottom('auto');
  }, [visibleMessages.length, selectedUserId, scrollToBottom]);

  const setMute = (value: boolean) => {
    setMuted(value);
    try {
      localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const hideMessageLocally = (messageId: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      saveHiddenIds(scope, next);
      return next;
    });
    if (pinnedId === messageId) {
      setPinnedId(null);
      savePinnedId(scope, null);
    }
  };

  const buildContentWithReply = (content: string) => {
    if (!replyingTo) return content;
    const excerpt = messagePreview(replyingTo.content, 80);
    return `> ${replyingTo.senderName}: ${excerpt}\n\n${content}`;
  };

  const postToConversation = async (
    convId: string,
    content: string
  ): Promise<ConversationMessage | null> => {
    const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      senderId: data.senderId,
      senderName: data.senderName,
      content: data.content,
      createdAt:
        typeof data.createdAt === 'string'
          ? data.createdAt
          : new Date(data.createdAt).toISOString(),
      isOwn: true,
      source: 'conversation',
    };
  };

  const sendMessage = async (rawContent: string) => {
    if (!rawContent || sending) return;
    const content = buildContentWithReply(rawContent);

    if (!selectedUserId) {
      if (users.length === 0) return;
      setSending(true);
      try {
        const res = await fetch('/api/chat/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            content,
            mode: 'repliers',
            subscriberIds: users.map((u) => u.id),
            senderName: defaultSenderName,
            ...(clubId ? { clubId } : {}),
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const msg = data?.message;
        if (msg && typeof msg.id === 'string') {
          setChannelMessages((prev) => [
            ...prev,
            {
              id: msg.id,
              content: typeof msg.content === 'string' ? msg.content : content,
              createdAt:
                typeof msg.createdAt === 'string'
                  ? msg.createdAt
                  : new Date().toISOString(),
              senderName:
                typeof msg.senderName === 'string' ? msg.senderName : defaultSenderName,
              isOwn: true,
              source: 'channel',
            },
          ]);
        }
        setMessage('');
        setPendingImage(null);
        setReplyingTo(null);
        void loadRepliers();
      } catch {
        /* ignore */
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      let convId = conversationId;
      if (!convId) {
        convId = await ensureConversation(selectedUserId);
        setConversationId(convId);
      }
      if (!convId) return;
      const sent = await postToConversation(convId, content);
      if (!sent) return;
      setConversationMessages((prev) => [...prev, sent]);
      setMessage('');
      setPendingImage(null);
      setReplyingTo(null);
      void loadRepliers();
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    const content = pendingImage
      ? buildImageContent(pendingImage, message)
      : message.trim();
    if (!content) return;
    void sendMessage(content);
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
    canStart: !pendingImage && (Boolean(selectedUserId) || users.length > 0),
    busy: sending,
    onRecorded: async (audioDataUrl) => {
      await sendMessage(buildAudioContent(audioDataUrl));
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

  const handleMessageContextMenu = (e: React.MouseEvent, msg: ThreadMessage) => {
    e.preventDefault();
    e.stopPropagation();
    const pad = 8;
    const menuW = 200;
    const menuH = 240;
    const x = Math.min(e.clientX, window.innerWidth - menuW - pad);
    const y = Math.min(e.clientY, window.innerHeight - menuH - pad);
    setContextMenu({ x: Math.max(pad, x), y: Math.max(pad, y), message: msg });
  };

  const handleContextReply = () => {
    if (!contextMenu) return;
    setReplyingTo(contextMenu.message);
    setContextMenu(null);
    requestAnimationFrame(() => composeInputRef.current?.focus());
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
    savePinnedId(scope, next);
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
      const content = isImageContent(forwardingMessage.content)
        ? forwardingMessage.content
        : `Forwarded from ${forwardingMessage.senderName}: ${forwardingMessage.content}`;
      const res = await fetch(`/api/chat/conversations/${targetConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setForwardingMessage(null);
        if (targetConversationId === conversationId) {
          const data = await res.json();
          setConversationMessages((prev) => [
            ...prev,
            {
              id: data.id,
              senderId: data.senderId,
              senderName: data.senderName,
              content: data.content,
              createdAt:
                typeof data.createdAt === 'string'
                  ? data.createdAt
                  : new Date(data.createdAt).toISOString(),
              isOwn: true,
              source: 'conversation',
            },
          ]);
        }
      }
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
      const src = messageSource(deleteTarget);
      let ok = false;
      if (src === 'conversation' && conversationId) {
        const res = await fetch(
          `/api/chat/conversations/${conversationId}/messages/${encodeURIComponent(deleteTarget.id)}`,
          { method: 'DELETE', headers: getAuthHeaders() }
        );
        ok = res.ok;
        if (ok) {
          setConversationMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
        }
      } else if (src === 'channel' || src === 'broadcast_reply') {
        const res = await fetch(
          withClubQuery(
            `/api/chat/broadcast?messageId=${encodeURIComponent(deleteTarget.id)}`,
            clubId
          ),
          { method: 'DELETE', headers: getAuthHeaders() }
        );
        ok = res.ok;
        if (ok) {
          if (src === 'channel') {
            setChannelMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
          } else {
            setReplies((prev) => prev.filter((m) => m.id !== deleteTarget.id));
          }
        }
      }
      if (ok) {
        hideMessageLocally(deleteTarget.id);
        setDeleteTarget(null);
      }
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  const resetAllChat = async () => {
    const label = selectedUser
      ? `Reset all chat with ${selectedUser.name}?`
      : 'Reset all chat (all broadcast replies)?';
    if (!window.confirm(`${label}\n\nThis cannot be undone.`)) return;
    if (resettingChat) return;
    setResettingChat(true);
    try {
      if (!selectedUserId) {
        const res = await fetch(withClubQuery('/api/chat/broadcast/repliers', clubId), {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          window.alert('Failed to reset chat');
          return;
        }
        setReplies([]);
        setChannelMessages([]);
        setUsers([]);
        onCountChange?.(0);
      } else {
        // Clear 1:1 DMs and this user's broadcast replies (both appear in the thread).
        let convId = conversationId;
        if (!convId) {
          convId = await ensureConversation(selectedUserId);
          setConversationId(convId);
        }
        const [dmRes, repliesRes] = await Promise.all([
          convId
            ? fetch(`/api/chat/conversations/${convId}/messages`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
              })
            : Promise.resolve(null),
          fetch(
            withClubQuery(
              `/api/chat/broadcast/repliers?userId=${encodeURIComponent(selectedUserId)}`,
              clubId
            ),
            { method: 'DELETE', headers: getAuthHeaders() }
          ),
        ]);
        if ((dmRes && !dmRes.ok) || !repliesRes.ok) {
          window.alert('Failed to reset chat');
          return;
        }
        setConversationMessages([]);
        setReplies((prev) => prev.filter((r) => r.senderUserId !== selectedUserId));
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selectedUserId
              ? { ...u, replyCount: 0, lastMessagePreview: '', lastMessageAt: '' }
              : u
          )
        );
      }
      setHiddenIds(new Set());
      saveHiddenIds(scope, new Set());
      setPinnedId(null);
      savePinnedId(scope, null);
      setPendingImage(null);
      setMessage('');
      setReplyingTo(null);
      setSearchQuery('');
      setContextMenu(null);
    } catch {
      window.alert('Failed to reset chat');
    } finally {
      setResettingChat(false);
    }
  };

  const headerTitle = selectedUser ? selectedUser.name : 'All broadcast replies';
  const canCompose = selectedUserId ? true : users.length > 0;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[#e6ebee]">
      {/* Contacts rail */}
      <aside className="flex w-[120px] shrink-0 flex-col overflow-y-auto border-r border-[#d5dee3] bg-[#f0f4f7]">
        <div className="flex flex-col items-center gap-1 border-b border-[#d5dee3] py-2">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#708499] hover:bg-white/80"
            title="Menu"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setSelectedUserId(null)}
            className={`flex w-full flex-col items-center gap-0.5 px-1 py-2 transition ${
              selectedUserId === null ? 'bg-[#dce8f0]' : 'hover:bg-white/70'
            }`}
            title="All"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full ${
                selectedUserId === null ? 'bg-[#3390ec] text-white' : 'bg-[#c5d0da] text-white'
              }`}
            >
              <MessageCircle className="h-5 w-5" />
            </span>
            <span className="max-w-full truncate px-0.5 text-[11px] font-medium text-[#222]">
              All
            </span>
          </button>
        </div>

        <div className="flex flex-1 flex-col items-stretch">
          {loading && users.length === 0 ? (
            <p className="px-2 py-4 text-center text-[11px] text-gray-500">Loading…</p>
          ) : users.length === 0 ? (
            <p className="px-2 py-4 text-center text-[11px] leading-snug text-gray-500">
              No Telegram replies yet
            </p>
          ) : (
            users.map((u) => {
              const active = selectedUserId === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`flex w-full flex-col items-center gap-0.5 px-1 py-2 transition ${
                    active ? 'bg-[#dce8f0]' : 'hover:bg-white/70'
                  }`}
                  title={u.name}
                >
                  <UserAvatar name={u.name} image={u.image} online={u.isOnline} size={44} />
                  <span className="max-w-full truncate px-0.5 text-[11px] font-medium text-[#222]">
                    {u.name}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#b2c7d9]">
        <header className="flex shrink-0 items-center gap-3 border-b border-[#9eb4c7] bg-[#eff3f6] px-4 py-2.5">
          {selectedUser ? (
            <UserAvatar
              name={selectedUser.name}
              image={selectedUser.image}
              online={selectedUser.isOnline}
              size={40}
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3390ec] text-white">
              <MessageCircle className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-[#222]">{headerTitle}</h2>
            <p className="truncate text-[12px] text-[#708499]">
              {selectedUser
                ? selectedUser.telegramAccount
                  ? `@${selectedUser.telegramAccount.replace(/^@+/, '')}`
                  : selectedUser.isOnline
                    ? 'online'
                    : 'Telegram user'
                : `${users.length} user${users.length === 1 ? '' : 's'} who replied to broadcasts`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void resetAllChat()}
            disabled={resettingChat || visibleMessages.length === 0}
            className="shrink-0 text-[13px] font-medium text-red-600 hover:text-red-700 disabled:opacity-40"
            title="Reset all chat"
          >
            {resettingChat ? 'Resetting…' : 'Reset all chat'}
          </button>
        </header>

        {searchOpen && (
          <div className="flex shrink-0 items-center gap-2 border-b border-[#9eb4c7] bg-white px-3 py-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={selectedUserId ? 'Search conversation…' : 'Search channel…'}
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
                  {previewText(pinnedMessage.content, 120)}
                </div>
              </div>
            </button>
            <button
              type="button"
              className="shrink-0 text-amber-700/70 hover:text-amber-900"
              title="Unpin"
              onClick={() => {
                setPinnedId(null);
                savePinnedId(scope, null);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          {floatingDayLabel && visibleMessages.length > 0 && (
            <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2">
              <span className="inline-block rounded-full bg-black/55 px-3 py-1 text-[12px] font-medium text-white shadow-sm backdrop-blur-sm">
                {floatingDayLabel}
              </span>
            </div>
          )}
          <div
            ref={messagesContainerRef}
            className="h-full overflow-y-auto px-3 py-3"
            onScroll={handleMessagesScroll}
          >
            {loadingThread && selectedUserId ? (
              <p className="py-8 text-center text-sm text-[#4a667a]">Loading conversation…</p>
            ) : visibleMessages.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#4a667a]">
                {searchOpen && searchQuery.trim()
                  ? 'No messages match your search.'
                  : selectedUserId
                    ? 'No messages yet. Send a reply below.'
                    : 'When users with a Telegram account reply to a Movesbook broadcast, they appear here.'}
              </p>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-2">
                {visibleMessages.map((msg, index) => {
                  const isOwn = msg.isOwn;
                  const isBroadcastReply = 'source' in msg && msg.source === 'broadcast_reply';
                  const showSender = !isOwn && (!selectedUserId || isBroadcastReply);
                  const clickableAll =
                    !selectedUserId && isBroadcastReply && 'senderUserId' in msg;
                  const dayKey = chatDayKey(msg.createdAt);
                  const prevDayKey =
                    index > 0 ? chatDayKey(visibleMessages[index - 1].createdAt) : null;
                  const showDaySeparator = Boolean(dayKey && dayKey !== prevDayKey);
                  const dayLabel = showDaySeparator ? chatDayLabel(msg.createdAt) : null;
                  return (
                    <div key={`${messageSource(msg)}-${msg.id}`} className="contents">
                      {showDaySeparator && dayLabel ? (
                        <div
                          data-chat-day-label={dayLabel}
                          className="my-2 flex justify-center"
                        >
                          <span className="rounded-full bg-[#dbe6ef] px-3 py-1 text-[12px] font-medium text-[#4a667a] shadow-sm">
                            {dayLabel}
                          </span>
                        </div>
                      ) : null}
                      <div
                        data-message-id={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                      >
                        <button
                          type="button"
                          disabled={!clickableAll}
                          onClick={() => {
                            if (clickableAll && 'senderUserId' in msg) {
                              setSelectedUserId(msg.senderUserId);
                            }
                          }}
                          className={`max-w-[78%] rounded-xl px-3 py-1.5 text-left shadow-sm ${
                            isOwn
                              ? 'rounded-br-sm bg-[#eeffde] text-[#222]'
                              : 'rounded-bl-sm bg-white text-[#222]'
                          } ${clickableAll ? 'cursor-pointer hover:brightness-[0.98]' : 'cursor-default'} ${
                            highlightMessageId === msg.id || pinnedId === msg.id
                              ? 'ring-2 ring-amber-400'
                              : ''
                          }`}
                        >
                          {showSender && (
                            <p className="mb-0.5 text-[13px] font-semibold text-[#3390ec]">
                              {msg.senderName}
                            </p>
                          )}
                          {isBroadcastReply &&
                            'parentContent' in msg &&
                            msg.parentContent &&
                            !isImageContent(msg.parentContent) && (
                              <div className="mb-1 rounded border-l-2 border-[#3390ec] bg-black/5 px-2 py-1 text-[12px] text-[#5a6b7b]">
                                <span className="font-medium text-[#3390ec]">
                                  {msg.parentSenderName || 'Broadcast'}
                                </span>
                                <p className="truncate">{previewText(msg.parentContent, 60)}</p>
                              </div>
                            )}
                          {(() => {
                            const image = parseImageContent(msg.content);
                            if (image) {
                              return (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={image.src}
                                    alt="Shared"
                                    className="max-h-56 max-w-full rounded object-contain"
                                  />
                                  {image.caption ? (
                                    <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-snug">
                                      {image.caption}
                                    </p>
                                  ) : null}
                                </>
                              );
                            }
                            const audio = parseAudioContent(msg.content);
                            if (audio) {
                              return (
                                <audio
                                  controls
                                  preload="metadata"
                                  src={audio.src}
                                  className="mt-0.5 max-w-full"
                                  style={{ width: '240px' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Your browser does not support audio playback.
                                </audio>
                              );
                            }
                            return (
                              <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">
                                {msg.content}
                              </p>
                            );
                          })()}
                          <div className="mt-0.5 flex items-center justify-end gap-1">
                            {isBroadcastReply && !isOwn && (
                              <span className="mr-auto text-[10px] text-[#8aa0b0]">
                                via broadcast
                              </span>
                            )}
                            {!selectedUserId &&
                              isOwn &&
                              'source' in msg &&
                              msg.source === 'channel' && (
                                <span className="mr-auto text-[10px] text-[#8aa0b0]">channel</span>
                              )}
                            {pinnedId === msg.id && (
                              <Pin className="h-3 w-3 text-amber-600" />
                            )}
                            <span className="text-[11px] text-[#8aa0b0]">
                              {formatTime(msg.createdAt)}
                            </span>
                            {isOwn && <span className="text-[11px] text-[#4fae4e]">✓✓</span>}
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {showScrollToBottom && visibleMessages.length > 0 && (
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

        <div className="relative shrink-0 border-t border-[#9eb4c7] bg-[#f0f4f7] px-3 py-2">
          {replyingTo && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-[#3390ec] bg-white px-2 py-1.5 text-[12px] text-[#5a6b7b] shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[#3390ec]">
                  Replying to {replyingTo.senderName}
                </div>
                <div className="truncate">{previewText(replyingTo.content, 80)}</div>
              </div>
              <button
                type="button"
                className="shrink-0 text-gray-400 hover:text-gray-700"
                onClick={() => setReplyingTo(null)}
                aria-label="Cancel reply"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

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
            <p className="mb-2 px-1 text-sm text-red-600" role="alert">
              {voiceError}
            </p>
          )}

          <div className="flex items-end gap-1">
            <div className="relative mb-1 shrink-0" ref={menuRef}>
              <button
                type="button"
                className="rounded-full p-2 text-[#708499] hover:bg-white/80"
                title="Settings"
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
                </div>
              )}
            </div>
            <button
              type="button"
              className={`mb-1 shrink-0 rounded-full p-2 hover:bg-white/80 ${
                searchOpen ? 'bg-white text-[#3390ec]' : 'text-[#708499]'
              }`}
              title="Search"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <Search className="h-5 w-5" />
            </button>
            {muted && (
              <button
                type="button"
                onClick={() => setMute(false)}
                className="mb-1 shrink-0 rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-[#555] shadow-sm ring-1 ring-[#d0dbe3]"
              >
                Unmute
              </button>
            )}

            {canCompose ? (
              isRecording ? (
                <>
                  <div className="mb-1 flex min-h-[40px] min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-[#d0dbe3]">
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="shrink-0 rounded-full p-1 text-[#708499] hover:bg-gray-100 hover:text-[#222]"
                      title="Cancel recording"
                      aria-label="Cancel recording"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <span className="inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                    <span className="text-sm font-medium tabular-nums text-red-600">
                      {formatRecordingTime(recordingSeconds)}
                    </span>
                    <span className="truncate text-sm text-[#708499]">Recording…</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopAndSendVoiceRecording}
                    disabled={sending || recordingSeconds < 1}
                    className="mb-1 shrink-0 rounded-full bg-[#3390ec] p-2.5 text-white hover:bg-[#2b7fd0] disabled:opacity-40"
                    title="Send voice message"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                </>
              ) : (
                <>
                  <textarea
                    ref={composeInputRef}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (voiceError) setVoiceError(null);
                    }}
                    onPaste={handlePaste}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={1}
                    placeholder={
                      pendingImage
                        ? 'Add a caption…'
                        : selectedUserId
                          ? 'Write a message… (paste image, add caption, then Send)'
                          : `Message all ${users.length} user${users.length === 1 ? '' : 's'} who replied… (paste image, add caption, then Send)`
                    }
                    className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border-0 bg-white px-3 py-2.5 text-[14px] text-[#222] outline-none ring-1 ring-[#d0dbe3] focus:ring-[#3390ec]"
                  />
                  {showVoiceButton ? (
                    <button
                      type="button"
                      onClick={() => void startVoiceRecording()}
                      disabled={sending}
                      className="mb-1 shrink-0 rounded-full p-2.5 text-[#708499] hover:bg-white hover:text-[#222] disabled:opacity-40"
                      title="Record voice message"
                      aria-label="Record voice message"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={sending || !canSendText}
                      className="mb-1 shrink-0 rounded-full bg-[#3390ec] p-2.5 text-white hover:bg-[#2b7fd0] disabled:opacity-40"
                      title={selectedUserId ? 'Send' : 'Send to all repliers'}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </>
              )
            ) : (
              <p className="flex-1 py-2 text-center text-[13px] text-[#708499]">
                When users reply to a broadcast, you can message them all here
              </p>
            )}
          </div>
        </div>
      </section>

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
              Remove this message only for you, or also for everyone?
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
                {previewText(forwardingMessage.content, 60)}
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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3390ec] font-semibold text-white">
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
