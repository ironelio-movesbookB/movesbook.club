'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Send, Search, Menu, UserPlus, X, Trash2, Settings, ChevronDown, Reply, Copy, Forward, Pin, Mic, Square } from 'lucide-react';
import ChatSettingsModal, {
  loadChatTheme,
  saveChatTheme,
  type ChatTheme,
} from './ChatSettingsModal';
import MovesbookChannel, {
  ChannelAvatar,
  loadChannelLeft,
  rejoinMovesbookChannel,
  getChannelLeftEventName,
  getChannelRejoinedEventName,
} from './MovesbookChannel';
import type { ChatAudience } from '@/lib/chat/chatAudience';
import { notifyChatUnreadCountChanged } from '@/lib/chat/chatUnreadEvents';
import {
  buildAudioContent,
  buildImageContent,
  isAudioContent,
  isImageContent,
  messagePreview,
  parseAudioContent,
  parseImageContent,
  parseReplyQuote,
} from '@/lib/chat/messageContent';
import { isClubAccountUserType } from '@/utils/dashboardRouting';

const PIN_KEY_PREFIX = 'chatPanelPinned:';
/** Keep voice data URLs under MySQL TEXT (~64KB) after base64 overhead. */
const MAX_VOICE_SECONDS = 45;
const MAX_VOICE_DATA_URL_CHARS = 58_000;

function loadPinnedId(conversationId: string | null): string | null {
  if (!conversationId) return null;
  try {
    return localStorage.getItem(`${PIN_KEY_PREFIX}${conversationId}`);
  } catch {
    return null;
  }
}

function savePinnedId(conversationId: string | null, id: string | null) {
  if (!conversationId) return;
  try {
    const key = `${PIN_KEY_PREFIX}${conversationId}`;
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Turn URLs in text into clickable links (http/https only). Returns array of React nodes. */
function linkify(text: string, isOwn: boolean): (string | React.ReactNode)[] {
  const urlRegex = /(https?:\/\/[^\s<>]+)/g;
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[0];
    const href = url.replace(/[.,;:!?)]+$/, ''); // trim trailing punctuation from link
    parts.push(
      <a
        key={key++}
        href={href.startsWith('http') ? href : `https://${href}`}
        target="_blank"
        rel="noopener noreferrer"
        className={isOwn ? 'underline text-blue-100' : 'underline text-blue-600'}
      >
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function findRepliedMessageId(messages: MessageItem[], senderName: string, excerpt: string): string | null {
  const norm = excerpt.trim().slice(0, 80);
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.senderName !== senderName) continue;
    if ((norm === '[Image]' || norm.startsWith('[Image]')) && isImageContent(m.content)) return m.id;
    if (norm === '[Voice message]' && isAudioContent(m.content)) return m.id;
    const preview = messagePreview(m.content, 80);
    if (preview === norm || preview.startsWith(norm) || norm.startsWith(preview)) return m.id;
    const firstLine = m.content.split('\n')[0].trim();
    if (!firstLine) continue;
    if (firstLine === norm || firstLine.startsWith(norm) || norm.startsWith(firstLine)) return m.id;
    if (m.content.startsWith(norm) || norm.startsWith(m.content.slice(0, 80))) return m.id;
  }
  return null;
}

export type ConversationItem = {
  id: string;
  otherUser: {
    id: string;
    name: string;
    telegramAccount: string | null;
    lastSeenAt: string | null;
    isOnline: boolean;
  };
  lastMessage: { content: string; createdAt: string; isOwn: boolean } | null;
  updatedAt: string;
  unreadCount: number;
};

export type ChatUser = {
  id: string;
  name: string;
  username: string;
  telegramAccount: string | null;
  /** True when whole name is hidden by the peer's club-member visibility setting. */
  nameHidden?: boolean;
  lastSeenAt: string | null;
  isOnline: boolean;
};

type MemberClubForAdminChat = {
  id: string;
  name: string;
  adminId: string | null;
  admin: {
    id: string;
    name: string;
    username: string;
    telegramAccount: string | null;
    lastSeenAt: string | null;
    isOnline: boolean;
  } | null;
};

type MessageItem = {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isOwn: boolean;
};

type ChatPanelProps = {
  /** When true, panel is embedded (e.g. in dashboard); uses flexible height and can show close button */
  embedded?: boolean;
  /** Called when user clicks close (only relevant when embedded) */
  onClose?: () => void;
  /** Auth token provider - if not given, uses localStorage token */
  getAuthHeaders?: () => Record<string, string>;
  /** Show broadcast channel (Movesbook Channel or Club Channel). Default true. */
  showMovesbookChannel?: boolean;
  /**
   * Restrict 1:1 conversations / start-chat user list to this audience
   * (e.g. Movesbook Staff vs Movesbook User).
   */
  chatAudience?: ChatAudience | null;
  /**
   * When set, shows Club Channel for this club and scopes 1:1 lists to that club's members
   * when chatAudience is club-member / club-admin.
   */
  clubId?: string | null;
  /**
   * Current user type — club owner accounts (CLUB / CLUB_TRAINER) pick from owned clubs
   * for club-staff / club-member audiences.
   */
  userType?: string | null;
  /**
   * When the chat header name is clicked, open User Info for this peer in the dashboard right sidebar.
   * Pass null when leaving a 1:1 conversation (channel selected / chat closed).
   */
  onPeerInfoSelect?: (userId: string | null) => void;
};

type SelectedPeer = {
  id: string;
  name: string;
  telegramAccount?: string | null;
  lastSeenAt?: string | null;
  isOnline?: boolean;
};

const defaultGetAuthHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

export default function ChatPanel({
  embedded,
  onClose,
  getAuthHeaders: getAuthHeadersProp,
  showMovesbookChannel = true,
  chatAudience = null,
  clubId = null,
  userType = null,
  onPeerInfoSelect,
}: ChatPanelProps) {
  const getAuthHeaders = getAuthHeadersProp ?? defaultGetAuthHeaders;
  const effectiveAudience: ChatAudience | null =
    chatAudience ?? (clubId ? 'club-member' : null);
  const channelTitle = clubId ? 'Club Channel' : 'Movesbook channel';
  const usesOwnedClubs = isClubAccountUserType(String(userType ?? ''));

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedOtherUser, setSelectedOtherUser] = useState<SelectedPeer | null>(null);
  const [channelSelected, setChannelSelected] = useState(false);
  const [channelLeft, setChannelLeft] = useState(false);
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [memberClubs, setMemberClubs] = useState<MemberClubForAdminChat[]>([]);
  const [loadingMemberClubs, setLoadingMemberClubs] = useState(false);
  /** Selected club for club-staff / club-member two-step start-chat flow. */
  const [audienceClubPick, setAudienceClubPick] = useState<{ id: string; name: string } | null>(null);
  const [loadingAudienceUsers, setLoadingAudienceUsers] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isClubAdminAudience = effectiveAudience === 'club-admin';
  const isClubStaffAudience = effectiveAudience === 'club-staff';
  const isClubMemberAudience = effectiveAudience === 'club-member';
  /** Two-step pick-club flow when no clubId prop is already scoped (e.g. Club Chat). */
  const needsAudienceClubPick =
    (isClubStaffAudience || isClubMemberAudience) && !clubId;
  /** Club picker step: club-admin, or staff/member before a club is chosen. */
  const usesClubPicker =
    isClubAdminAudience || (needsAudienceClubPick && !audienceClubPick);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MessageItem | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: MessageItem } | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<MessageItem | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const highlightClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSendOnStopRef = useRef(false);
  const [chatTheme, setChatTheme] = useState<ChatTheme>({
    textColor: '#111827',
    backgroundType: 'color',
    backgroundColor: '#ffffff',
    backgroundImage: null,
    watermark: null,
  });

  useEffect(() => {
    setChatTheme(loadChatTheme());
  }, []);

  // Club-admin / club-staff / club-member (unscoped): open the club picker immediately
  useEffect(() => {
    if (isClubAdminAudience || needsAudienceClubPick) {
      setShowUserList(true);
      setAudienceClubPick(null);
    }
  }, [isClubAdminAudience, needsAudienceClubPick]);

  useEffect(() => {
    if (!showMovesbookChannel) return;
    setChannelLeft(loadChannelLeft(clubId));
    const leftEvent = getChannelLeftEventName(clubId);
    const rejoinedEvent = getChannelRejoinedEventName(clubId);
    const onLeft = () => {
      setChannelLeft(true);
      setChannelSelected(false);
    };
    const onRejoined = () => {
      setChannelLeft(false);
      setChannelSelected(true);
      setSelectedConversationId(null);
      setSelectedOtherUser(null);
      setReplyingTo(null);
      setDeleteTarget(null);
    };
    window.addEventListener(leftEvent, onLeft);
    window.addEventListener(rejoinedEvent, onRejoined);
    return () => {
      window.removeEventListener(leftEvent, onLeft);
      window.removeEventListener(rejoinedEvent, onRejoined);
    };
  }, [showMovesbookChannel, clubId]);

  // Reset selection when switching clubs
  useEffect(() => {
    setChannelSelected(false);
    setSelectedConversationId(null);
    setSelectedOtherUser(null);
    setReplyingTo(null);
    setDeleteTarget(null);
    setChannelLeft(showMovesbookChannel ? loadChannelLeft(clubId) : false);
  }, [clubId, showMovesbookChannel]);

  const selectChannel = () => {
    setChannelSelected(true);
    setSelectedConversationId(null);
    setSelectedOtherUser(null);
    setReplyingTo(null);
    setDeleteTarget(null);
    onPeerInfoSelect?.(null);
  };

  const selectConversation = (c: ConversationItem) => {
    setChannelSelected(false);
    setSelectedConversationId(c.id);
    setSelectedOtherUser({
      id: c.otherUser.id,
      name: c.otherUser.name,
      telegramAccount: c.otherUser.telegramAccount,
      lastSeenAt: c.otherUser.lastSeenAt,
      isOnline: c.otherUser.isOnline,
    });
  };

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const params = new URLSearchParams();
      if (effectiveAudience) params.set('audience', effectiveAudience);
      if (clubId) params.set('clubId', clubId);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/chat/conversations${qs}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (e) {
      console.error('Load conversations:', e);
    } finally {
      setLoadingConversations(false);
    }
  }, [getAuthHeaders, effectiveAudience, clubId]);

  const loadUsers = useCallback(async (search?: string, scopedClubId?: string | null) => {
    try {
      const params = new URLSearchParams();
      if (search != null && search.trim() !== '') params.set('search', search.trim());
      if (effectiveAudience) params.set('audience', effectiveAudience);
      const effectiveClubId = scopedClubId ?? clubId;
      if (effectiveClubId) params.set('clubId', effectiveClubId);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/chat/users${qs}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error('Load users:', e);
    }
  }, [getAuthHeaders, effectiveAudience, clubId]);

  const loadMemberClubs = useCallback(async () => {
    setLoadingMemberClubs(true);
    try {
      // Club owner accounts: clubs they administer. Everyone else: clubs they belong to.
      const endpoint = usesOwnedClubs ? '/api/clubs/my-clubs' : '/api/athletes/my-clubs';
      const res = await fetch(endpoint, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const raw = (data.clubs || []) as Array<{
          id: string;
          name: string;
          adminId?: string | null;
          admin?: MemberClubForAdminChat['admin'];
        }>;
        setMemberClubs(
          raw.map((c) => ({
            id: c.id,
            name: c.name,
            adminId: c.adminId ?? null,
            admin: c.admin ?? null,
          }))
        );
      } else {
        setMemberClubs([]);
      }
    } catch (e) {
      console.error('Load member clubs:', e);
      setMemberClubs([]);
    } finally {
      setLoadingMemberClubs(false);
    }
  }, [getAuthHeaders, usesOwnedClubs]);

  useEffect(() => {
    loadConversations();
    if (!isClubAdminAudience && !needsAudienceClubPick) {
      loadUsers();
    }
  }, [loadConversations, loadUsers, isClubAdminAudience, needsAudienceClubPick]);

  // Load clubs when club picker step opens
  useEffect(() => {
    if (!showUserList) return;
    if (isClubAdminAudience || (needsAudienceClubPick && !audienceClubPick)) {
      loadMemberClubs();
    }
  }, [
    showUserList,
    isClubAdminAudience,
    needsAudienceClubPick,
    audienceClubPick,
    loadMemberClubs,
  ]);

  // Load staff/members of selected club for club-staff / club-member audiences
  useEffect(() => {
    if (!showUserList || !needsAudienceClubPick || !audienceClubPick) return;
    setLoadingAudienceUsers(true);
    const t = setTimeout(() => {
      loadUsers(searchQuery, audienceClubPick.id).finally(() =>
        setLoadingAudienceUsers(false)
      );
    }, 300);
    return () => clearTimeout(t);
  }, [
    showUserList,
    needsAudienceClubPick,
    audienceClubPick,
    searchQuery,
    loadUsers,
  ]);

  // Debounced user search when user list is visible (non club-picker audiences)
  useEffect(() => {
    if (!showUserList || isClubAdminAudience || needsAudienceClubPick) return;
    const t = setTimeout(() => {
      loadUsers(searchQuery);
    }, 300);
    return () => clearTimeout(t);
  }, [showUserList, searchQuery, loadUsers, isClubAdminAudience, needsAudienceClubPick]);

  // Reset audience club pick when closing the start-chat list or leaving pick flow
  useEffect(() => {
    if (!showUserList || !needsAudienceClubPick) {
      setAudienceClubPick(null);
      if (needsAudienceClubPick || !showUserList) {
        setUsers([]);
      }
    }
  }, [showUserList, needsAudienceClubPick]);

  const filteredMemberClubs = (() => {
    if (!usesClubPicker && !isClubAdminAudience) return memberClubs;
    const q = searchQuery.trim().toLowerCase().replace(/^@+/, '');
    if (!q) return memberClubs;
    return memberClubs.filter((c) => {
      const clubName = (c.name || '').toLowerCase();
      const adminName = (c.admin?.name || '').toLowerCase();
      const adminUser = (c.admin?.username || '').toLowerCase();
      const adminTg = (c.admin?.telegramAccount || '').toLowerCase();
      return (
        clubName.includes(q) ||
        adminName.includes(q) ||
        adminUser.includes(q) ||
        adminTg.includes(q)
      );
    });
  })();

  const filteredConversations = (() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@+/, '');
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = (c.otherUser.name || '').toLowerCase();
      const tg = (c.otherUser.telegramAccount || '').toLowerCase();
      return name.includes(q) || tg.includes(q);
    });
  })();

  useEffect(() => {
    const ping = () => {
      fetch('/api/chat/presence', { method: 'POST', headers: getAuthHeaders() }).catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 30 * 1000);
    return () => clearInterval(interval);
  }, [getAuthHeaders]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
          loadConversations();
          // Opening a conversation marks it read — refresh Chat panel button badge
          notifyChatUnreadCountChanged();
        } else {
          setMessages([]);
        }
      } catch (e) {
        console.error('Load messages:', e);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [getAuthHeaders, loadConversations]
  );

  useEffect(() => {
    if (selectedConversationId) {
      loadMessages(selectedConversationId);
    } else {
      setMessages([]);
    }
    setReplyingTo(null);
    setContextMenu(null);
    setForwardingMessage(null);
    setDeleteTarget(null);
    setPinnedId(loadPinnedId(selectedConversationId));
    setHighlightMessageId(null);
  }, [selectedConversationId, loadMessages]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    return () => {
      if (highlightClearTimerRef.current) clearTimeout(highlightClearTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pinnedId || loadingMessages || messages.length === 0) return;
    if (messages.some((m) => m.id === pinnedId)) return;
    setPinnedId(null);
    savePinnedId(selectedConversationId, null);
  }, [pinnedId, messages, loadingMessages, selectedConversationId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = messagesScrollRef.current;
    if (el) {
      const target = el.scrollHeight - el.clientHeight;
      if (behavior === 'smooth') {
        el.scrollTo({ top: target, behavior: 'smooth' });
      } else {
        el.scrollTop = target;
      }
    }
    setShowScrollToBottom(false);
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const container = messagesScrollRef.current;
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
    setShowScrollToBottom(true);

    setHighlightMessageId(messageId);
    if (highlightClearTimerRef.current) clearTimeout(highlightClearTimerRef.current);
    highlightClearTimerRef.current = setTimeout(() => {
      setHighlightMessageId((cur) => (cur === messageId ? null : cur));
    }, 1600);
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const threshold = 80;
    const atBottom = scrollHeight - scrollTop - clientHeight < threshold;
    setShowScrollToBottom(!atBottom);
  }, []);

  useEffect(() => {
    if (!selectedConversationId || !messages.length) return;
    scrollToBottom('auto');
  }, [selectedConversationId, messages.length, scrollToBottom]);

  const handleStartChat = async (
    otherUser: Pick<ChatUser, 'id' | 'name'>,
    options?: { clubId?: string | null }
  ) => {
    try {
      const scopedClubId = options?.clubId ?? clubId;
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          participantId: otherUser.id,
          ...(effectiveAudience ? { audience: effectiveAudience } : {}),
          ...(scopedClubId ? { clubId: scopedClubId } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setChannelSelected(false);
        setSelectedConversationId(data.id);
        setSelectedOtherUser({
          id: data.otherUser.id,
          name: data.otherUser.name,
          telegramAccount: data.otherUser.telegramAccount ?? null,
          lastSeenAt: data.otherUser.lastSeenAt ?? null,
          isOnline: data.otherUser.isOnline ?? false,
        });
        setShowUserList(false);
        loadConversations();
      } else {
        const err = await res.json().catch(() => null);
        console.error('Start chat failed:', err?.error || res.statusText);
      }
    } catch (e) {
      console.error('Start chat:', e);
    }
  };

  const handleStartChatWithClubAdmin = async (club: MemberClubForAdminChat) => {
    const adminId = club.admin?.id ?? club.adminId;
    if (!adminId || !club.admin) return;
    if (!club.admin.telegramAccount) return;
    await handleStartChat(
      { id: adminId, name: club.admin.name || club.name },
      { clubId: club.id }
    );
  };

  const handlePickAudienceClub = (club: MemberClubForAdminChat) => {
    setSearchQuery('');
    setUsers([]);
    setAudienceClubPick({ id: club.id, name: club.name?.trim() || 'Club' });
  };

  const handleStartChatWithAudienceUser = async (u: ChatUser) => {
    await handleStartChat(u, { clubId: audienceClubPick?.id ?? clubId });
  };

  const sendContent = useCallback(
    async (content: string) => {
      if (!selectedConversationId || sending) return false;
      const res = await fetch(`/api/chat/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data]);
        loadConversations();
        return true;
      }
      return false;
    },
    [selectedConversationId, sending, getAuthHeaders, loadConversations]
  );

  const buildContentWithReply = useCallback(
    (content: string) => {
      if (!replyingTo) return content;
      const excerpt = messagePreview(replyingTo.content, 80);
      return `> ${replyingTo.senderName}: ${excerpt}\n\n${content}`;
    },
    [replyingTo]
  );

  const handleSendMessage = async () => {
    const textContent = message.trim();
    if (pendingImage) {
      if (!selectedConversationId || sending) return;
      setSending(true);
      try {
        const contentToSend = buildContentWithReply(
          buildImageContent(pendingImage, textContent)
        );
        await sendContent(contentToSend);
        setPendingImage(null);
        setMessage('');
        setReplyingTo(null);
      } catch (e) {
        console.error('Send image:', e);
      } finally {
        setSending(false);
      }
      return;
    }
    if (!textContent || !selectedConversationId || sending) return;

    setSending(true);
    try {
      const contentToSend = buildContentWithReply(textContent);
      await sendContent(contentToSend);
      setMessage('');
      setReplyingTo(null);
    } catch (e) {
      console.error('Send message:', e);
    } finally {
      setSending(false);
    }
  };

  const handleContextDelete = () => {
    if (!contextMenu?.message.isOwn) return;
    setDeleteTarget(contextMenu.message);
    setContextMenu(null);
  };

  const handleContextPin = () => {
    if (!contextMenu || !selectedConversationId) return;
    const id = contextMenu.message.id;
    setContextMenu(null);
    const next = pinnedId === id ? null : id;
    setPinnedId(next);
    savePinnedId(selectedConversationId, next);
  };

  const confirmDeleteMessage = async () => {
    if (!deleteTarget || !selectedConversationId || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/chat/conversations/${selectedConversationId}/messages/${deleteTarget.id}`,
        { method: 'DELETE', headers: getAuthHeaders() }
      );
      if (res.ok) {
        if (pinnedId === deleteTarget.id) {
          setPinnedId(null);
          savePinnedId(selectedConversationId, null);
        }
        setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
        setDeleteTarget(null);
        loadConversations();
      }
    } catch (e) {
      console.error('Delete message:', e);
    } finally {
      setDeleting(false);
    }
  };

  const pinnedMessage = pinnedId
    ? messages.find((m) => m.id === pinnedId) ?? null
    : null;

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          if (dataUrl.startsWith('data:image/')) {
            // Keep as pending so the user can add a caption, then Send posts both.
            setPendingImage(dataUrl);
          }
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, []);

  const stopRecordingTracks = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (result.startsWith('data:audio/')) resolve(result);
        else reject(new Error('Invalid audio data'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read audio'));
      reader.readAsDataURL(blob);
    });

  const finishVoiceRecording = useCallback(
    async (blob: Blob) => {
      if (!blob.size) {
        setVoiceError('Recording was empty. Try again.');
        return;
      }
      try {
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl.length > MAX_VOICE_DATA_URL_CHARS) {
          setVoiceError('Voice message is too long. Keep it under ~45 seconds.');
          return;
        }
        if (!selectedConversationId || sending) return;
        setSending(true);
        setVoiceError(null);
        try {
          const contentToSend = buildContentWithReply(buildAudioContent(dataUrl));
          await sendContent(contentToSend);
          setReplyingTo(null);
        } finally {
          setSending(false);
        }
      } catch (e) {
        console.error('Send voice:', e);
        setVoiceError('Could not send voice message.');
      }
    },
    [selectedConversationId, sending, buildContentWithReply, sendContent]
  );

  const cancelVoiceRecording = useCallback(() => {
    recordingSendOnStopRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    audioChunksRef.current = [];
    stopRecordingTracks();
    setIsRecording(false);
    setRecordingSeconds(0);
    setVoiceError(null);
  }, [stopRecordingTracks]);

  const stopAndSendVoiceRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      return;
    }
    recordingSendOnStopRef.current = true;
    try {
      recorder.stop();
    } catch {
      recordingSendOnStopRef.current = false;
      setIsRecording(false);
      stopRecordingTracks();
    }
  }, [stopRecordingTracks]);

  const startVoiceRecording = useCallback(async () => {
    if (!selectedConversationId || sending || isRecording || pendingImage) return;
    setVoiceError(null);
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Voice messages are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24_000 })
        : new MediaRecorder(stream, { audioBitsPerSecond: 24_000 });
      mediaRecorderRef.current = recorder;
      recordingSendOnStopRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const shouldSend = recordingSendOnStopRef.current;
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        stopRecordingTracks();
        setIsRecording(false);
        setRecordingSeconds(0);
        if (!shouldSend || chunks.length === 0) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        void finishVoiceRecording(blob);
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_VOICE_SECONDS) {
            recordingSendOnStopRef.current = true;
            try {
              mediaRecorderRef.current?.stop();
            } catch {
              /* ignore */
            }
          }
          return next;
        });
      }, 1000);
    } catch (e) {
      console.error('Start voice recording:', e);
      stopRecordingTracks();
      setIsRecording(false);
      setVoiceError('Microphone permission is required to send voice messages.');
    }
  }, [
    selectedConversationId,
    sending,
    isRecording,
    pendingImage,
    stopRecordingTracks,
    finishVoiceRecording,
  ]);

  useEffect(() => {
    return () => {
      recordingSendOnStopRef.current = false;
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatRecordingTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const canSendText = Boolean(message.trim() || pendingImage);
  const showVoiceButton = !canSendText && !isRecording;

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMessageContextMenu = (e: React.MouseEvent, msg: MessageItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, message: msg });
  };

  const handleReply = () => {
    if (contextMenu) {
      setReplyingTo(contextMenu.message);
      setContextMenu(null);
    }
  };

  const handleCopy = async () => {
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
      await navigator.clipboard.writeText(image?.caption || msg.content);
    }
  };

  const handleForwardClick = () => {
    if (contextMenu) {
      setForwardingMessage(contextMenu.message);
      setContextMenu(null);
    }
  };

  const handleForwardToConversation = async (targetConversationId: string) => {
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
        if (targetConversationId === selectedConversationId) {
          const data = await res.json();
          setMessages((prev) => [...prev, data]);
        }
        loadConversations();
      }
    } catch (e) {
      console.error('Forward message:', e);
    } finally {
      setForwarding(false);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatConversationTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const currentConversation = conversations.find((c) => c.id === selectedConversationId);
  const peerTelegram =
    selectedOtherUser?.telegramAccount ?? currentConversation?.otherUser.telegramAccount ?? null;
  const peerName = selectedOtherUser?.name ?? currentConversation?.otherUser.name ?? 'Chat';
  const displayName = peerTelegram
    ? peerTelegram.startsWith('@')
      ? peerTelegram
      : `@${peerTelegram}`
    : peerName;
  const peerIsOnline =
    selectedOtherUser?.isOnline ?? currentConversation?.otherUser.isOnline ?? false;
  const peerLastSeenAt =
    selectedOtherUser?.lastSeenAt ?? currentConversation?.otherUser.lastSeenAt ?? null;
  const peerStatusLabel = peerIsOnline
    ? 'online'
    : peerLastSeenAt
      ? (() => {
          try {
            const d = new Date(peerLastSeenAt);
            const mins = Math.floor((Date.now() - d.getTime()) / 60000);
            if (mins < 1) return 'last seen just now';
            if (mins < 60) return `last seen ${mins} min ago`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `last seen ${hours}h ago`;
            return `last seen ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
          } catch {
            return 'last seen recently';
          }
        })()
      : 'last seen a long time ago';
  const peerId = selectedOtherUser?.id ?? currentConversation?.otherUser.id ?? null;

  const containerClass = embedded
    ? 'flex-1 flex min-h-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'
    : 'flex-1 flex min-h-0 overflow-hidden';

  return (
    <div className={containerClass}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1">
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col min-h-0 flex-shrink-0">
        {showMovesbookChannel && !channelLeft && (
          <MovesbookChannel
            variant="header"
            getAuthHeaders={getAuthHeaders}
            selected={channelSelected}
            onSelect={selectChannel}
            clubId={clubId}
          />
        )}
        {showMovesbookChannel && channelLeft && (
          <button
            type="button"
            onClick={() => rejoinMovesbookChannel(clubId)}
            className="flex w-full shrink-0 items-center gap-2.5 border-b border-[#15202b] bg-[#1a2332] px-3 py-2.5 text-left transition hover:bg-[#222b38]"
          >
            <ChannelAvatar size={36} className="shadow-sm" alt={channelTitle} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-white">
                Rejoin {channelTitle}
              </span>
              <span className="mt-0.5 block text-[11px] text-[#8ab4d9]">
                Tap to see broadcasts again
              </span>
            </span>
          </button>
        )}

        <div className="p-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Menu className="w-5 h-5 text-gray-400 cursor-pointer" />
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={
                  isClubAdminAudience || (needsAudienceClubPick && !audienceClubPick)
                    ? 'Search clubs'
                    : isClubStaffAudience && audienceClubPick
                      ? 'Search staff'
                      : isClubMemberAudience && (audienceClubPick || clubId)
                        ? 'Search username'
                        : effectiveAudience === 'club-member'
                          ? 'Search username'
                          : 'Search'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setShowUserList((prev) => {
                  if (prev) setAudienceClubPick(null);
                  return !prev;
                });
              }}
              className="flex-1 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <UserPlus className="w-4 h-4" />
              {showUserList
                ? isClubAdminAudience || needsAudienceClubPick
                  ? 'Hide clubs'
                  : 'Hide users'
                : isClubAdminAudience
                  ? 'Start chat with club admin'
                  : isClubStaffAudience
                    ? 'Start chat with club staff'
                    : isClubMemberAudience
                      ? 'Start chat with club member'
                      : 'Start chat with user'}
            </button>
            <button
              type="button"
              onClick={() => setShowChatSettings(true)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="Chat appearance settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {showUserList ? (
            isClubAdminAudience ? (
              <div className="p-2">
                {loadingMemberClubs ? (
                  <p className="text-sm text-gray-500 p-2">Loading clubs…</p>
                ) : filteredMemberClubs.length === 0 ? (
                  <p className="text-sm text-gray-500 p-2">
                    {searchQuery.trim()
                      ? 'No matching clubs.'
                      : usesOwnedClubs
                        ? 'You have not created any clubs yet.'
                        : 'You do not belong to any clubs yet.'}
                  </p>
                ) : (
                  filteredMemberClubs.map((club) => {
                    const admin = club.admin;
                    const canChat = Boolean(admin?.telegramAccount && (admin.id || club.adminId));
                    const adminLabel =
                      admin?.name || admin?.username || 'Club Admin';
                    return (
                      <button
                        key={club.id}
                        type="button"
                        disabled={!canChat}
                        onClick={() => handleStartChatWithClubAdmin(club)}
                        title={
                          canChat
                            ? `Chat with ${adminLabel}`
                            : 'Club Admin has no Telegram account yet'
                        }
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left ${
                          canChat
                            ? 'hover:bg-gray-50'
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold">
                            {(club.name || 'C').charAt(0).toUpperCase()}
                          </div>
                          {admin && (
                            <span
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                                admin.isOnline ? 'bg-green-500' : 'bg-gray-400'
                              }`}
                              title={admin.isOnline ? 'Admin online' : 'Admin offline'}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {club.name?.trim() || 'Club'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {canChat
                              ? `Admin: ${adminLabel}${
                                  admin?.telegramAccount ? ` · ${admin.telegramAccount}` : ''
                                }`
                              : 'Admin Telegram required'}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : needsAudienceClubPick && !audienceClubPick ? (
              <div className="p-2">
                <p className="px-2 pb-2 text-xs text-gray-500">
                  {isClubStaffAudience
                    ? usesOwnedClubs
                      ? 'Select a club you own to see its staff'
                      : 'Select a club to see its staff'
                    : usesOwnedClubs
                      ? 'Select a club you own to see its members'
                      : 'Select a club to see its members'}
                </p>
                {loadingMemberClubs ? (
                  <p className="text-sm text-gray-500 p-2">Loading clubs…</p>
                ) : filteredMemberClubs.length === 0 ? (
                  <p className="text-sm text-gray-500 p-2">
                    {searchQuery.trim()
                      ? 'No matching clubs.'
                      : usesOwnedClubs
                        ? 'You have not created any clubs yet.'
                        : 'You do not belong to any clubs yet.'}
                  </p>
                ) : (
                  filteredMemberClubs.map((club) => (
                    <button
                      key={club.id}
                      type="button"
                      onClick={() => handlePickAudienceClub(club)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-gray-50"
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold ${
                            isClubStaffAudience ? 'bg-indigo-600' : 'bg-emerald-600'
                          }`}
                        >
                          {(club.name || 'C').charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {club.name?.trim() || 'Club'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {isClubStaffAudience
                            ? usesOwnedClubs
                              ? 'View staff of this club'
                              : 'View club staff'
                            : usesOwnedClubs
                              ? 'View members of this club'
                              : 'View club members'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : needsAudienceClubPick && audienceClubPick ? (
              <div className="p-2">
                <button
                  type="button"
                  onClick={() => {
                    setAudienceClubPick(null);
                    setUsers([]);
                    setSearchQuery('');
                  }}
                  className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
                >
                  ← Back to clubs
                  <span className="mt-0.5 block truncate text-xs text-gray-500">
                    {audienceClubPick.name}
                  </span>
                </button>
                {loadingAudienceUsers ? (
                  <p className="text-sm text-gray-500 p-2">
                    {isClubStaffAudience ? 'Loading staff…' : 'Loading members…'}
                  </p>
                ) : users.length === 0 ? (
                  <p className="text-sm text-gray-500 p-2">
                    {searchQuery.trim()
                      ? isClubStaffAudience
                        ? 'No matching staff.'
                        : 'No matching members.'
                      : isClubStaffAudience
                        ? 'No other staff with Telegram in this club yet.'
                        : 'No other members with Telegram in this club yet.'}
                  </p>
                ) : (
                  users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleStartChatWithAudienceUser(u)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left"
                    >
                      <div className="relative flex-shrink-0">
                        <div
                          className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold ${
                            isClubStaffAudience ? 'bg-indigo-500' : 'bg-emerald-500'
                          }`}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                            u.isOnline ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                          title={u.isOnline ? 'Online' : 'Offline'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {u.nameHidden
                            ? u.username
                              ? `@${u.username.replace(/^@+/, '')}`
                              : u.telegramAccount
                            : u.telegramAccount || u.username}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="p-2">
                {users.length === 0 ? (
                  <p className="text-sm text-gray-500 p-2">No users with Telegram yet.</p>
                ) : (
                  users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleStartChat(u)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left"
                    >
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                            u.isOnline ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                          title={u.isOnline ? 'Online' : 'Offline'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {u.nameHidden
                            ? u.username
                              ? `@${u.username.replace(/^@+/, '')}`
                              : u.telegramAccount
                            : u.telegramAccount || u.username}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )
          ) : (
            <>
              {loadingConversations ? (
                <div className="p-4 text-center text-gray-500 text-sm">Loading…</div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  {isClubAdminAudience
                    ? 'No conversations yet. Start a chat with a club admin above.'
                    : isClubStaffAudience
                      ? 'No conversations yet. Start a chat with club staff above.'
                      : isClubMemberAudience
                        ? 'No conversations yet. Start a chat with a club member above.'
                        : 'No conversations yet. Start a chat with a user above.'}
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No matching conversations.</div>
              ) : (
                filteredConversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectConversation(c)}
                    className={`w-full p-4 border-b border-gray-100 text-left hover:bg-gray-50 transition-colors ${
                      selectedConversationId === c.id && !channelSelected ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold">
                          {c.otherUser.name.charAt(0).toUpperCase()}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            c.otherUser.isOnline ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                          title={c.otherUser.isOnline ? 'Online' : 'Offline'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3
                            className={`font-medium truncate ${c.unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-900'}`}
                          >
                            {c.otherUser.name}
                          </h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {c.lastMessage && (
                              <span className="text-xs text-gray-400">
                                {formatConversationTime(c.lastMessage.createdAt)}
                              </span>
                            )}
                            {c.unreadCount > 0 && (
                              <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[#8774e1] text-white text-xs font-medium flex items-center justify-center">
                                {c.unreadCount > 99 ? '99+' : c.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                        {c.lastMessage && (
                          <p
                            className={`text-sm truncate mt-0.5 ${
                              c.unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-600'
                            }`}
                          >
                            {messagePreview(c.lastMessage.content, 60)}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </>
          )}
        </div>
      </div>

      <div
        className="flex-1 flex flex-col min-h-0 bg-white relative"
        style={{
          color: chatTheme.textColor,
          backgroundColor:
            chatTheme.backgroundType === 'color' ? chatTheme.backgroundColor : undefined,
          backgroundImage:
            chatTheme.backgroundType === 'image' && chatTheme.backgroundImage
              ? `url(${chatTheme.backgroundImage})`
              : undefined,
          backgroundSize: chatTheme.backgroundType === 'image' ? 'cover' : undefined,
          backgroundPosition: 'center',
        }}
      >
        {chatTheme.watermark && (
          <div
            className="absolute inset-0 pointer-events-none opacity-20 bg-center bg-no-repeat bg-contain z-0"
            style={{ backgroundImage: `url(${chatTheme.watermark})` }}
          />
        )}
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
        {channelSelected && showMovesbookChannel && !channelLeft ? (
          <MovesbookChannel
            variant="pane"
            getAuthHeaders={getAuthHeaders}
            selected={channelSelected}
            onSelect={selectChannel}
            onCloseEmbedded={embedded ? onClose : undefined}
            clubId={clubId}
          />
        ) : selectedConversationId ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  if (peerId) onPeerInfoSelect?.(peerId);
                }}
                className={`min-w-0 flex-1 text-left rounded-lg px-1 -mx-1 py-0.5 transition-colors ${
                  peerId && onPeerInfoSelect
                    ? 'hover:bg-gray-200/80 cursor-pointer'
                    : 'cursor-default'
                }`}
                title={peerId && onPeerInfoSelect ? 'Show user info' : undefined}
                disabled={!peerId || !onPeerInfoSelect}
              >
                <h2 className="text-lg font-semibold text-gray-900 truncate">{displayName}</h2>
                <p className="text-xs text-gray-500 truncate">{peerStatusLabel}</p>
              </button>
              {embedded && onClose && (
                <button
                  type="button"
                  onClick={() => {
                    onPeerInfoSelect?.(null);
                    onClose();
                  }}
                  className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
                  title="Close chat"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

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
                    <div className="font-semibold">
                      Pinned · {pinnedMessage.senderName}
                    </div>
                    <div className="truncate">
                      {messagePreview(pinnedMessage.content, 100)}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  className="shrink-0 text-amber-700 hover:underline"
                  title="Unpin"
                  onClick={() => {
                    setPinnedId(null);
                    savePinnedId(selectedConversationId, null);
                  }}
                >
                  Unpin
                </button>
              </div>
            )}

            <div className="flex-1 min-h-0 relative">
              <div
                ref={messagesScrollRef}
                className="absolute inset-0 overflow-y-auto overflow-x-hidden p-4 space-y-4"
                onScroll={handleMessagesScroll}
              >
                {loadingMessages ? (
                  <div className="text-center text-gray-500 text-sm">Loading messages…</div>
                ) : (
                  <>
                    {messages.map((msg) => {
                      const replyQuote = parseReplyQuote(msg.content);
                      const image = parseImageContent(msg.content);
                      const audio = parseAudioContent(msg.content);
                      const textBody = image
                        ? image.caption
                        : audio
                          ? ''
                          : replyQuote
                            ? replyQuote.body
                            : msg.content;
                      const linkedMessageId = replyQuote
                        ? findRepliedMessageId(messages, replyQuote.senderName, replyQuote.excerpt)
                        : null;
                      return (
                        <div
                          key={msg.id}
                          data-message-id={msg.id}
                          className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              msg.isOwn ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'
                            } ${
                              highlightMessageId === msg.id || pinnedId === msg.id
                                ? 'ring-2 ring-offset-2 ring-amber-400'
                                : ''
                            }`}
                          >
                            {replyQuote ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (linkedMessageId) scrollToMessage(linkedMessageId);
                                }}
                                className={`mb-1 text-left w-full rounded px-1 -mx-1 py-0.5 border-l-2 text-sm ${
                                  msg.isOwn
                                    ? 'border-blue-300 text-blue-100 hover:bg-blue-600'
                                    : 'border-gray-400 text-gray-600 hover:bg-gray-300'
                                } ${linkedMessageId ? 'cursor-pointer' : 'cursor-default'}`}
                                title={linkedMessageId ? 'Jump to linked message' : undefined}
                              >
                                {replyQuote.replyLine}
                              </button>
                            ) : null}
                            {image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={image.src}
                                alt="Shared"
                                className="max-w-full max-h-48 rounded object-contain"
                              />
                            ) : null}
                            {audio ? (
                              <audio
                                controls
                                preload="metadata"
                                src={audio.src}
                                className="mt-0.5 max-w-full"
                                style={{ width: '240px' }}
                              >
                                Your browser does not support audio playback.
                              </audio>
                            ) : null}
                            {textBody ? (
                              <p className={`text-sm whitespace-pre-wrap break-words ${image ? 'mt-2' : ''}`}>
                                {linkify(textBody, msg.isOwn).map((part, i) => (
                                  <span key={i}>{part}</span>
                                ))}
                              </p>
                            ) : null}
                            <div
                              className={`mt-1 flex items-center justify-end gap-1 text-xs ${
                                msg.isOwn ? 'text-blue-100' : 'text-gray-500'
                              }`}
                            >
                              {pinnedId === msg.id && (
                                <Pin className="h-3 w-3 text-amber-300" />
                              )}
                              <span>{formatTime(msg.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              {showScrollToBottom && !loadingMessages && messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => scrollToBottom('smooth')}
                  className="absolute bottom-4 right-4 w-11 h-11 rounded-full bg-gray-700 hover:bg-gray-800 text-white shadow-lg flex items-center justify-center z-20 transition-opacity"
                  title="Jump to latest messages"
                >
                  <ChevronDown className="w-6 h-6" />
                </button>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              {replyingTo && (
                <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-200/80 text-gray-700 text-sm">
                  <Reply className="w-4 h-4 flex-shrink-0 text-gray-500" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800">Replying to {replyingTo.senderName}</p>
                    <p className="truncate text-gray-600">
                      {messagePreview(replyingTo.content, 60)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="p-1 rounded hover:bg-gray-300 text-gray-500 hover:text-gray-700"
                    aria-label="Cancel reply"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {pendingImage && (
                <div className="mb-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingImage}
                    alt="Paste preview"
                    className="h-16 w-16 object-cover rounded border border-gray-300"
                  />
                  <span className="text-sm text-gray-600">
                    Image ready — add a caption below, then Send (both post together)
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Remove
                  </button>
                </div>
              )}
              {voiceError && (
                <p className="mb-2 text-sm text-red-600" role="alert">
                  {voiceError}
                </p>
              )}
              {isRecording ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={cancelVoiceRecording}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                    title="Cancel recording"
                    aria-label="Cancel recording"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <span className="text-sm font-medium text-red-600 tabular-nums">
                      {formatRecordingTime(recordingSeconds)}
                    </span>
                    <span className="text-sm text-gray-500 truncate">Recording…</span>
                  </div>
                  <button
                    type="button"
                    onClick={stopAndSendVoiceRecording}
                    disabled={sending || recordingSeconds < 1}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send voice message"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Send
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (voiceError) setVoiceError(null);
                    }}
                    onKeyDown={handleKeyPress}
                    onPaste={handlePaste}
                    placeholder={pendingImage ? 'Add a caption…' : 'Message (paste image to send)'}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {showVoiceButton ? (
                    <button
                      type="button"
                      onClick={() => void startVoiceRecording()}
                      disabled={sending || !selectedConversationId}
                      className="p-2.5 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Record voice message"
                      aria-label="Record voice message"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={sending || !canSendText}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">
                {isClubAdminAudience
                  ? 'Select a chat or start a new one with a club admin'
                  : isClubStaffAudience
                    ? 'Select a chat or start a new one with club staff'
                    : isClubMemberAudience
                      ? 'Select a chat or start a new one with a club member'
                      : 'Select a chat or start a new one with a user'}
              </p>
            </div>
          </div>
        )}
        </div>
      </div>
        </div>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 min-w-[180px] py-1 rounded-xl bg-gray-800 text-white shadow-xl border border-gray-700"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={handleReply}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-700 transition-colors"
          >
            <Reply className="w-4 h-4 flex-shrink-0" />
            Reply
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-700 transition-colors"
          >
            <Copy className="w-4 h-4 flex-shrink-0" />
            Copy
          </button>
          <button
            type="button"
            onClick={handleForwardClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-700 transition-colors"
          >
            <Forward className="w-4 h-4 flex-shrink-0" />
            Forward
          </button>
          <button
            type="button"
            onClick={handleContextPin}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-700 transition-colors"
          >
            <Pin className="w-4 h-4 flex-shrink-0" />
            {pinnedId === contextMenu.message.id ? 'Unpin' : 'Pin'}
          </button>
          {contextMenu.message.isOwn && (
            <button
              type="button"
              onClick={handleContextDelete}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-300 hover:bg-gray-700 transition-colors"
            >
              <Trash2 className="w-4 h-4 flex-shrink-0" />
              Delete
            </button>
          )}
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-900 mb-2">Delete message</h3>
            <p className="text-sm text-gray-600 mb-4">
              Delete this message? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDeleteMessage()}
                className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {forwardingMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !forwarding && setForwardingMessage(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[70vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Forward to</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {messagePreview(forwardingMessage.content, 40)}
                {forwardingMessage.content.length > 40 ? '…' : ''}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations
                .filter((c) => c.id !== selectedConversationId)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleForwardToConversation(c.id)}
                    disabled={forwarding}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold flex-shrink-0">
                      {c.otherUser.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900 truncate">{c.otherUser.name}</span>
                  </button>
                ))}
              {conversations.filter((c) => c.id !== selectedConversationId).length === 0 && (
                <p className="text-sm text-gray-500 p-4 text-center">No other conversations. Start a chat first.</p>
              )}
            </div>
            <div className="p-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setForwardingMessage(null)}
                className="w-full py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatSettingsModal
        open={showChatSettings}
        onClose={() => setShowChatSettings(false)}
        initialTheme={chatTheme}
        onSave={(theme) => {
          setChatTheme(theme);
          saveChatTheme(theme);
        }}
      />
    </div>
  );
}
