'use client';
import Image from 'next/image';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { NotificationByPromocodeDashboard, PromocodeOption } from '@/lib/promocodes/notificationByPromocodeService';
import {
  isPromocodeInviteSentMessage,
} from '@/lib/promocodes/promocodeInviteEvents';
import {
  PROMOCODE_NO_FLAG_IMAGE,
  promocodeFlagImageUrl,
  promocodeProfileImageUrl,
} from '@/components/promocodes/promocodeImageUrls';
import { formatChartCredits } from '@/lib/promocodes/formatPromocodeCredits';
import PromocodeAssetImage from '@/components/promocodes/PromocodeAssetImage';
import PromocodeInviteEmailsModal from '@/components/promocodes/PromocodeInviteEmailsModal';
import PromocodePageSizeSelect from '@/components/promocodes/PromocodePageSizeSelect';
import PromocodesPagination from '@/components/promocodes/PromocodeAppliesTable';
import type { PromocodeInviteEntry } from '@/lib/promocodes/types';
import '@/components/promocodes/notification-by-promocode.css';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  fetchSuggestMovesbookIntroText,
  SUGGEST_MOVESBOOK_INTRO_EN,
} from '@/constants/suggestMovesbookLongText';
import { getSuggestMovesbookCopy } from '@/lib/promocodes/suggestMovesbookCopy';
import { PromocodePersonMark } from '@/components/promocodes/PromocodePersonMark';
import {
  buildWhatsAppShareUrl,
  buildTelegramSharePickerUrl,
  buildSmsShareUrl,
  ensureShareLinkInMessage,
  openExternalShareUrl,
} from '@/utils/socialShareUrls';

type TabId = 'suggest' | 'invitations' | 'registered' | 'credits' | 'connections';
type InvitationsSubTab = 'generated' | 'recipients' | 'allRecipients';
type ShareChannel = 'WhatsApp' | 'Telegram' | 'SMS';

function paginateRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

async function userPromocodeFetch(path: string, init?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(path, { ...init, headers });
}

function formatRoleName(roleName: string, roleId?: number | null): string {
  if (roleId === 5) return 'Single User';
  if (!roleName) return '';
  return roleName.charAt(0).toUpperCase() + roleName.slice(1);
}

function validateInviteForm(receiverEmail: string, promocodeId: string): string | null {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!receiverEmail.trim()) {
    return 'Please enter the mail address for recipient.';
  }
  if (!emailPattern.test(receiverEmail.trim())) {
    return 'Please enter valid mail address.';
  }
  if (!promocodeId) {
    return 'Please select a promocode to use for the invite.';
  }
  return null;
}

function buildSendInvitePreviewUrl(
  email: string,
  option: PromocodeOption,
  introMessage?: string
): string {
  const params = new URLSearchParams({
    email_address: email.trim(),
    promocode: option.code,
    other_info: '',
    adv_page: '',
    html_page_id: option.helpHtmlPagesId != null ? String(option.helpHtmlPagesId) : '',
    language_id: String(option.languageId ?? 1),
  });
  if (introMessage?.trim()) params.set('intro_message', introMessage.trim());
  return `/promocodes/send-invite?${params.toString()}`;
}

export default function NotificationByPromocodeDashboardView() {
  const [data, setData] = useState<NotificationByPromocodeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('suggest');
  const [receiverEmail, setReceiverEmail] = useState('');
  const [promocodeId, setPromocodeId] = useState('');
  const [validEndDate, setValidEndDate] = useState('');
  const [highlightedPromoId, setHighlightedPromoId] = useState<number | null>(null);
  const [invitationsSubTab, setInvitationsSubTab] = useState<InvitationsSubTab>('generated');
  const [inviteEmailsOpen, setInviteEmailsOpen] = useState(false);
  const [inviteEmailEntries, setInviteEmailEntries] = useState<PromocodeInviteEntry[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [invitationsPage, setInvitationsPage] = useState(1);
  const [recipientsPage, setRecipientsPage] = useState(1);
  const [registeredPage, setRegisteredPage] = useState(1);
  const [creditsPage, setCreditsPage] = useState(1);
  const [introMessage, setIntroMessage] = useState('');
  const [introSaved, setIntroSaved] = useState(false);
  const [savingIntro, setSavingIntro] = useState(false);
  const [introText, setIntroText] = useState(SUGGEST_MOVESBOOK_INTRO_EN);
  const [shareChannel, setShareChannel] = useState<ShareChannel>('WhatsApp');
  const [smsPhone, setSmsPhone] = useState('');
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const { currentLanguage, setLanguage } = useLanguage();
  const invitePopupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const copy = useMemo(() => getSuggestMovesbookCopy(currentLanguage || 'en'), [currentLanguage]);
  const tabLabels = copy;

  const recordLinkShare = useCallback(async (promoId: number) => {
    if (!promoId) return;
    try {
      await userPromocodeFetch('/api/users/notification-by-promocode/record-link-share', {
        method: 'POST',
        body: JSON.stringify({ promocodeId: promoId }),
      });
    } catch {
      /* non-blocking */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await userPromocodeFetch('/api/users/notification-by-promocode');
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to load dashboard');
        return;
      }
      const dashboard = json as NotificationByPromocodeDashboard;
      setData(dashboard);
      setIntroMessage(dashboard.savedIntro || '');
      setActiveTab(dashboard.defaultTab === 'invitations' ? 'invitations' : 'suggest');
      if (dashboard.promocode.id) {
        setPromocodeId(String(dashboard.promocode.id));
        setValidEndDate(dashboard.promocode.validTo);
      } else if (dashboard.promocodesList[0]) {
        setPromocodeId(String(dashboard.promocodesList[0].id));
        setValidEndDate(dashboard.promocodesList[0].validTo);
      }
    } catch {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const watchInvitePopupUntilClosed = useCallback(
    (popup: Window | null) => {
      if (!popup) return;
      if (invitePopupPollRef.current) {
        clearInterval(invitePopupPollRef.current);
      }
      invitePopupPollRef.current = setInterval(() => {
        if (!popup.closed) return;
        if (invitePopupPollRef.current) {
          clearInterval(invitePopupPollRef.current);
          invitePopupPollRef.current = null;
        }
        void load();
      }, 400);
    },
    [load]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (isPromocodeInviteSentMessage(event.data)) {
        void load();
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (invitePopupPollRef.current) {
        clearInterval(invitePopupPollRef.current);
      }
    };
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { language?: string; preferredLanguage?: string };
      const lang = (parsed.language || parsed.preferredLanguage || '').trim();
      if (lang) setLanguage(lang);
    } catch {
      /* ignore */
    }
  }, [setLanguage]);

  useEffect(() => {
    void fetchSuggestMovesbookIntroText(currentLanguage || 'en').then(setIntroText);
  }, [currentLanguage]);

  const promocodeOptions = useMemo(() => data?.promocodesList ?? [], [data]);

  const selectedPromocode = useMemo(
    () => promocodeOptions.find((p) => String(p.id) === promocodeId) ?? null,
    [promocodeOptions, promocodeId]
  );

  const onPromocodeChange = (value: string) => {
    setPromocodeId(value);
    const selected = promocodeOptions.find((p) => String(p.id) === value);
    setValidEndDate(selected?.validTo ?? '');
  };

  const openInvitePreview = () => {
    const validationError = validateInviteForm(receiverEmail, promocodeId);
    if (validationError) {
      window.alert(validationError);
      return;
    }

    const selected = promocodeOptions.find((p) => String(p.id) === promocodeId);
    if (!selected?.code) {
      window.alert('Please select a promocode to use for the invite.');
      return;
    }

    const popup = window.open(
      buildSendInvitePreviewUrl(receiverEmail, selected, introMessage),
      '_blank',
      'noopener,noreferrer'
    );
    if (!popup) {
      window.alert('Please allow pop-ups for this site to open the invitation preview.');
      return;
    }
    watchInvitePopupUntilClosed(popup);
  };

  const sendInvite = async () => {
    const validationError = validateInviteForm(receiverEmail, promocodeId);
    if (validationError) {
      window.alert(validationError);
      return;
    }

    try {
      const res = await userPromocodeFetch('/api/users/notification-by-promocode/send-invite', {
        method: 'POST',
        body: JSON.stringify({
          receiverEmail: receiverEmail.trim(),
          promocodeId: Number(promocodeId),
          introMessage: introMessage.trim(),
          inviteMode: 'Mail',
        }),
      });
      const json = await res.json();
      window.alert(
        json.message ||
          (json.status === 'success'
            ? 'Your invitation was sent successfully.'
            : 'Requesting member failed.')
      );
      if (json.status === 'success') {
        setReceiverEmail('');
        void load();
      }
    } catch {
      window.alert('An error occurred while sending the invitation. Please try again.');
    }
  };

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  const createChildPromocode = async () => {
    try {
      const res = await userPromocodeFetch('/api/users/notification-by-promocode/create-promocode', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        window.alert(json.error || 'A new Promocode cannot be generated anymore.');
        return;
      }
      window.alert(`Promocode created: ${json.code}`);
      void load();
    } catch {
      window.alert('Could not create promocode.');
    }
  };

  const buildInviteSharePayload = (): { registerUrl: string; text: string; code: string } | null => {
    const selected = promocodeOptions.find((p) => String(p.id) === promocodeId);
    const code = selected?.code || data?.promocode.code || '';
    if (!code) {
      window.alert('Please select a promocode to use for the invite.');
      return null;
    }

    const inviter =
      data?.connectionChart.currentUserUsername?.trim() ||
      '';
    if (!inviter) {
      window.alert('Unable to determine your username for the invite link. Please refresh and try again.');
      return null;
    }
    const params = new URLSearchParams({ promocode: code, inviter });
    if (currentLanguage) params.set('lang', currentLanguage);
    const registerUrl = `${window.location.origin}/users/quickRegister?${params.toString()}`;

    const body = [introMessage.trim(), introText, `Promocode: ${code}`]
      .filter(Boolean)
      .join('\n\n');
    const text = ensureShareLinkInMessage(body, registerUrl);
    return { registerUrl, text, code };
  };

  const shareInvite = (mode: ShareChannel = shareChannel) => {
    const payload = buildInviteSharePayload();
    if (!payload) return;

    const selectedId = Number(promocodeId) || data?.promocode.id || 0;

    if (mode === 'SMS') {
      const phone = smsPhone.trim();
      if (!phone) {
        window.alert('Please enter the phone number to send the SMS invite.');
        return;
      }
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 8) {
        window.alert('Please enter a valid phone number (include country code if needed).');
        return;
      }
      openExternalShareUrl(buildSmsShareUrl(phone, payload.text));
      void recordLinkShare(selectedId);
      return;
    }

    const url =
      mode === 'WhatsApp'
        ? buildWhatsAppShareUrl(undefined, payload.text)
        : buildTelegramSharePickerUrl(payload.registerUrl, payload.text);

    openExternalShareUrl(url);
    void recordLinkShare(selectedId);
  };

  const inviteShareLink = useMemo(() => {
    const selected = promocodeOptions.find((p) => String(p.id) === promocodeId);
    const code = selected?.code || data?.promocode.code || '';
    if (!code || typeof window === 'undefined') return '';
    const inviter =
      data?.connectionChart.currentUserUsername?.trim() ||
      '';
    const params = new URLSearchParams({ promocode: code });
    if (inviter) params.set('inviter', inviter);
    if (currentLanguage) params.set('lang', currentLanguage);
    return `${window.location.origin}/users/quickRegister?${params.toString()}`;
  }, [promocodeOptions, promocodeId, data, currentLanguage]);

  const copyInviteLink = async () => {
    if (!inviteShareLink) {
      window.alert('Please select a promocode to use for the invite.');
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteShareLink);
      setInviteLinkCopied(true);
      window.setTimeout(() => setInviteLinkCopied(false), 2000);
      void recordLinkShare(Number(promocodeId) || data?.promocode.id || 0);
    } catch {
      window.alert(`Copy this link manually:\n\n${inviteShareLink}`);
    }
  };

  if (loading) {
    return <div className="notification-promocode-page p-6">Loading…</div>;
  }

  if (error || !data) {
    return <div className="notification-promocode-page p-6 text-red-700">{error || 'Unable to load page.'}</div>;
  }

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: 'suggest', label: tabLabels.suggest, show: data.showSuggestTab },
    { id: 'invitations', label: tabLabels.invitations, show: true },
    { id: 'registered', label: tabLabels.registered, show: true },
    { id: 'credits', label: tabLabels.credits, show: true },
    { id: 'connections', label: tabLabels.connections, show: true },
  ];

  return (
    <div className="notification-promocode-page">
      <div className="re-tab-bar top-bar-nav mtop20">
        <ul>
          {tabs.filter((t) => t.show).map((tab) => (
            <li key={tab.id}>
              <a
                href="#"
                className={`top-bar-list ${activeTab === tab.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab(tab.id);
                }}
              >
                {tab.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {data.showSuggestTab && activeTab === 'suggest' && (
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16, maxWidth: 900, width: '100%' }}>
            {/* Banner is optional; hide if asset is missing */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/suggest-movesbook-banner.jpg"
              alt=""
              style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <h1 style={{ fontSize: 28, color: '#7b0a26', margin: '0 0 16px', fontWeight: 700 }}>
            {tabLabels.suggest}
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.55, margin: '0 0 20px', maxWidth: 820 }}>
            {introText}
          </p>

          {data.childPromo.parentPromocodeId ? (
            <div
              style={{
                marginBottom: 20,
                padding: 14,
                border: '1px solid #ccc',
                background: '#faf7f2',
                maxWidth: 900,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{copy.youCanCreate}</div>
              <div>{copy.allowed}: {data.childPromo.limit ?? copy.unlimited}</div>
              <div>{copy.alreadyGenerated}: {data.childPromo.generatedCount}</div>
              <div>{copy.createUntil}: {data.childPromo.until || '—'}</div>
              <div>
                {copy.versionsEnabled}:{' '}
                {data.childPromo.versionIds.length > 0
                  ? data.childPromo.versionIds
                      .map((id) => data.subscriptionsData[id] || String(id))
                      .join(', ')
                  : '—'}
              </div>
              <div>
                {copy.daysAfterInvite}:{' '}
                {data.childPromo.durationDays ?? '—'}
              </div>

              <div
                className="invite-row"
                style={{
                  marginTop: 14,
                  background: '#fff',
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  className={
                    data.childPromo.allowed
                      ? 'promo-regen-btn promo-regen-btn--ready'
                      : 'promo-regen-btn promo-regen-btn--locked'
                  }
                  title={
                    data.childPromo.allowed
                      ? copy.canGenerate
                      : data.childPromo.blockedReason || copy.canGenerate
                  }
                  disabled={!data.childPromo.allowed}
                  onClick={createChildPromocode}
                  aria-label="Generate new promocode"
                >
                  <RefreshCw size={22} aria-hidden />
                </button>
                <span>{copy.promocodeForYou}</span>
                <input
                  type="text"
                  readOnly
                  value={
                    data.childPromo.currentGeneratedCode ||
                    selectedPromocode?.code ||
                    data.promocode.code ||
                    '—'
                  }
                  style={{ width: 140, background: '#eee' }}
                />
                <span>{copy.isValidUntil}</span>
                <input
                  type="text"
                  readOnly
                  value={
                    data.childPromo.currentGeneratedValidTo ||
                    selectedPromocode?.validTo ||
                    data.promocode.validTo ||
                    '—'
                  }
                  style={{ width: 110, background: '#eee' }}
                />
                <span>{copy.lastInvite}</span>
                <input
                  type="text"
                  readOnly
                  value={data.lastEmailSentDate || '—'}
                  style={{ width: 110, background: '#eee' }}
                />
              </div>

              <div style={{ marginTop: 10, fontSize: 13, color: '#555' }}>
                {data.childPromo.allowed ? (
                  <span style={{ color: '#116611' }}>
                    {data.childPromo.currentGeneratedExpired ? copy.expiredCanGenerate : copy.canGenerate}
                  </span>
                ) : (
                  <span style={{ color: '#7b0a26', fontWeight: 600 }}>
                    {data.childPromo.blockedReason}
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {data.generatedPromocodes.length > 0 ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{tabLabels.generated}</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.generatedPromocodes.map((p) => (
                  <li key={p.id}>
                    {p.code} — {copy.validUntil} {p.validTo || '—'}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="invite-row" style={{ alignItems: 'flex-start' }}>
            <span>{copy.yourIntro}</span>
            <textarea
              value={introMessage}
              onChange={(e) => {
                setIntroSaved(false);
                setIntroMessage(e.target.value);
              }}
              rows={3}
              style={{ width: '50%', minWidth: 260, padding: 8, border: '1px solid #d1d5db' }}
              placeholder={copy.introPlaceholder}
            />
            <button
              type="button"
              className="button-black-promocode"
              disabled={savingIntro}
              onClick={() => {
                setSavingIntro(true);
                setIntroSaved(false);
                void userPromocodeFetch('/api/users/notification-by-promocode/save-intro', {
                  method: 'POST',
                  body: JSON.stringify({ introMessage }),
                })
                  .then((res) => {
                    if (res.ok) setIntroSaved(true);
                  })
                  .finally(() => setSavingIntro(false));
              }}
            >
              {introSaved ? copy.saved : copy.save}
            </button>
          </div>

          <div className="invite-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <span>{copy.shareVia}</span>
            {(['WhatsApp', 'Telegram', 'SMS'] as const).map((channel) => (
              <button
                key={channel}
                type="button"
                className="button-preview-promocode"
                style={
                  shareChannel === channel
                    ? { background: '#7b0a26', color: '#fff', borderColor: '#7b0a26' }
                    : undefined
                }
                onClick={() => {
                  setShareChannel(channel);
                  if (channel !== 'SMS') shareInvite(channel);
                }}
              >
                {channel}
              </button>
            ))}
          </div>

          {shareChannel === 'SMS' ? (
            <div className="invite-row" style={{ marginTop: 8 }}>
              <span>Number of phone on which to send SMS</span>
              <input
                type="tel"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="+39 333 1234567"
                style={{ width: '30%', minWidth: 200 }}
              />
              <button type="button" className="button-black-promocode" onClick={() => shareInvite('SMS')}>
                Send Invite
              </button>
            </div>
          ) : null}

          <div className="invite-row" style={{ marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Share the invite using this link</span>
            <input
              type="text"
              readOnly
              value={inviteShareLink}
              placeholder="Select a promocode to generate the invite link"
              style={{ width: '45%', minWidth: 260, background: '#f7f7f7' }}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="button-black-promocode" onClick={() => void copyInviteLink()}>
              {inviteLinkCopied ? 'Copied' : 'Copy link'}
            </button>
          </div>

          <div className="invite-row">
            <span>Mail to which you start the invite</span>
            <input
              type="text"
              value={receiverEmail}
              onChange={(e) => setReceiverEmail(e.target.value)}
              style={{ width: '30%', minWidth: 200 }}
            />
            <button type="button" className="button-black-promocode" onClick={sendInvite}>
              Send Invite
            </button>
            <button type="button" className="button-preview-promocode" onClick={openInvitePreview}>
              Preview
            </button>
          </div>

          <div className="invite-row mtop20" style={{ marginTop: 16 }}>
            <span>Select promocode to use for the invite</span>
            <select
              value={promocodeId}
              onChange={(e) => onPromocodeChange(e.target.value)}
              style={{ width: '25%', minWidth: 180 }}
            >
              {promocodeOptions.length === 0 ? (
                <option value="">— No promocode —</option>
              ) : (
                promocodeOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                  </option>
                ))
              )}
            </select>
            <span>is valid until</span>
            <input
              type="text"
              readOnly
              value={validEndDate}
              style={{ width: 120, background: '#eee', cursor: 'not-allowed' }}
            />
          </div>

          <div className="stats-grid" style={{ padding: '0 40px' }}>
            <div>
              <div className="stat-box"><span>Invitations sent until now</span><span>{data.totalInviteCount}</span></div>
              <div className="stat-box" style={{ marginTop: 8 }}><span>Registrations of single users</span><span>{data.regCount['5'] ?? 0}</span></div>
              <div className="stat-box" style={{ marginTop: 8 }}><span>Registrations of coaches</span><span>{data.regCount['6'] ?? 0}</span></div>
              <div className="stat-box" style={{ marginTop: 8 }}><span>Registrations of clubs</span><span>{data.regCount['8'] ?? 0}</span></div>
              <div className="stat-box" style={{ marginTop: 8 }}><span>Registrations of teams</span><span>{data.regCount['7'] ?? 0}</span></div>
            </div>
            <div>
              <div style={{ marginBottom: 16 }}>
                last mail of invites sent on
                <input type="text" readOnly value={data.lastEmailSentDate} style={{ width: 85, marginLeft: 16, height: 35 }} />
              </div>
              <div className="return-index">
                <p style={{ fontWeight: 100 }}>% return index</p>
                <div className="return-index-value">{data.returnIndex}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'invitations' && (
        <div style={{ padding: 20 }}>
          <div className="sub-tab-bar">
            <ul>
              <li>
                <a
                  href="#"
                  className={invitationsSubTab === 'generated' ? 'active' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    setInvitationsSubTab('generated');
                  }}
                >
                  Promocode generated
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className={invitationsSubTab === 'recipients' ? 'active' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!highlightedPromoId) {
                      window.alert('Please select a promocode row first.');
                      return;
                    }
                    setInvitationsSubTab('recipients');
                    setRecipientsPage(1);
                  }}
                >
                  Recipients record selected
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className={invitationsSubTab === 'allRecipients' ? 'active' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    setInvitationsSubTab('allRecipients');
                    setRecipientsPage(1);
                  }}
                >
                  All recipients promocodes used
                </a>
              </li>
            </ul>
          </div>

          {invitationsSubTab === 'generated' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <PromocodePageSizeSelect
                  value={pageSize}
                  onChange={(size) => {
                    setPageSize(size);
                    setInvitationsPage(1);
                  }}
                />
              </div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>&nbsp;</th>
                    <th>Promocode</th>
                    <th>Flag</th>
                    <th>Photo</th>
                    <th>Sender</th>
                    <th>Version</th>
                    <th>Usage</th>
                    <th>Users</th>
                    <th>Expedition name</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Enable</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invitationsData.length === 0 ? (
                    <tr><td colSpan={12} style={{ padding: 20 }}>No invitations received yet.</td></tr>
                  ) : (
                    paginateRows(data.invitationsData, invitationsPage, pageSize).map((row) => (
                      <tr
                        key={row.applyId}
                        className={highlightedPromoId === row.promocodeId ? 'highlighted' : ''}
                        onClick={() => setHighlightedPromoId(row.promocodeId)}
                      >
                        <td><input type="checkbox" readOnly checked={highlightedPromoId === row.promocodeId} /></td>
                        <td>{row.promocodeCode}</td>
                        <td>
                          <PromocodeAssetImage
                            src={promocodeFlagImageUrl(row.senderFlagImg, { countryCode: row.countryCode })}
                            fallbackSrc={PROMOCODE_NO_FLAG_IMAGE}
                            countryCode={row.countryCode}
                            alt=""
                            className="inline-block"
                            style={{ height: 23 }}
                          />
                        </td>
                        <td>
                          <Image src={promocodeProfileImageUrl(row.senderImage)} alt="" style={{ height: 55 }} width={55} height={55} unoptimized />
                        </td>
                        <td>{row.senderUsername}<br />{row.countryCode}</td>
                        <td>{row.version}</td>
                        <td>{row.usableBy}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary-link"
                            style={{ background: 'none', border: 'none' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setInviteEmailEntries(row.inviteEntries ?? []);
                              setInviteEmailsOpen(true);
                            }}
                          >
                            {row.emailCount}
                          </button>
                        </td>
                        <td>{row.recipient}</td>
                        <td>{row.created}</td>
                        <td>{row.status}</td>
                        <td>{row.enable}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <PromocodesPagination
                page={invitationsPage}
                totalPages={Math.max(1, Math.ceil(data.invitationsData.length / pageSize))}
                onPageChange={setInvitationsPage}
              />
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: '#555' }}>
                  {invitationsSubTab === 'allRecipients' ? (
                    <>All recipients across promocodes you used (in your account)</>
                  ) : (
                    <>
                      Recipients for promocode{' '}
                      <strong>
                        {data.invitationsData.find((r) => r.promocodeId === highlightedPromoId)?.promocodeCode ||
                          (data.sentRecipients ?? []).find((r) => r.promocodeId === highlightedPromoId)?.promocodeCode ||
                          highlightedPromoId}
                      </strong>
                      {' '}(invites you sent — stays in your account)
                    </>
                  )}
                </div>
                <PromocodePageSizeSelect
                  value={pageSize}
                  onChange={(size) => {
                    setPageSize(size);
                    setRecipientsPage(1);
                  }}
                />
              </div>
              {(() => {
                const recipients =
                  invitationsSubTab === 'allRecipients'
                    ? data.sentRecipients ?? []
                    : (data.sentRecipients ?? []).filter((r) => r.promocodeId === highlightedPromoId);
                return (
                  <>
                    <table className="print-table">
                      <thead>
                        <tr>
                          <th>Sender</th>
                          <th>Receiver</th>
                          <th>Promocode</th>
                          <th>Date of invite</th>
                          <th>Date of registration</th>
                          <th>Version</th>
                          <th>Status</th>
                          <th>Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipients.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ padding: 20 }}>
                              {invitationsSubTab === 'allRecipients'
                                ? 'No invitations sent yet.'
                                : 'No invitations sent yet with this promocode.'}
                            </td>
                          </tr>
                        ) : (
                          paginateRows(recipients, recipientsPage, pageSize).map((row) => (
                            <tr key={row.applyId}>
                              <td>{row.senderUsername}</td>
                              <td style={{ color: row.registered ? '#0066cc' : '#cc0000' }}>
                                {row.receiverLabel || row.receiverEmail || '--'}
                              </td>
                              <td>{row.promocodeCode}</td>
                              <td>{row.inviteDate || '--'}</td>
                              <td>{row.registrationDate || '--'}</td>
                              <td>{row.version || '--'}</td>
                              <td>{row.status}</td>
                              <td>{row.credits || '--'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                    <PromocodesPagination
                      page={recipientsPage}
                      totalPages={Math.max(1, Math.ceil(recipients.length / pageSize))}
                      onPageChange={setRecipientsPage}
                    />
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {activeTab === 'registered' && (
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <PromocodePageSizeSelect
              value={pageSize}
              onChange={(size) => {
                setPageSize(size);
                setRegisteredPage(1);
              }}
            />
          </div>
          <table className="print-table">
            <thead>
              <tr>
                <th>Sender</th>
                <th>Receiver</th>
                <th>Registration date</th>
                <th>Data Start</th>
                <th>Data end</th>
                <th>Version chosen</th>
                <th>Promocode</th>
                <th>Date of Mail</th>
                <th>Status</th>
                <th>Credit</th>
              </tr>
            </thead>
            <tbody>
              {data.registeredUsers.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: 20 }}>No users have registered using your promocodes yet.</td></tr>
              ) : (
                paginateRows(data.registeredUsers, registeredPage, pageSize).map((row, idx) => (
                  <tr key={`${row.username}-${row.promocodeCode}-${idx}`}>
                    <td>{row.senderUsername || 'N/A'}</td>
                    <td>{row.username || '--'}</td>
                    <td>{row.registrationDate || '--'}</td>
                    <td>{row.subscriptionStartDate || '--'}</td>
                    <td>{row.subscriptionEndDate || '--'}</td>
                    <td>
                      {row.versionChosen && row.versionChosen !== '--'
                        ? row.versionChosen
                        : row.subscriptionSettingId && data.subscriptionsData[row.subscriptionSettingId]
                          ? data.subscriptionsData[row.subscriptionSettingId]
                          : '--'}
                    </td>
                    <td>{row.promocodeCode || '--'}</td>
                    <td>{row.mailDate || '--'}</td>
                    <td>{row.status}</td>
                    <td>{row.credits || '--'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <PromocodesPagination
            page={registeredPage}
            totalPages={Math.max(1, Math.ceil(data.registeredUsers.length / pageSize))}
            onPageChange={setRegisteredPage}
          />
        </div>
      )}

      {activeTab === 'credits' && (
        <div style={{ padding: 20 }}>
          <div className="credits-summary">
            <div><span style={{ fontWeight: 'bold' }}>Total credits</span> <span style={{ fontWeight: 'bold', fontSize: 30, marginLeft: 10 }}>{data.totalCredits}</span></div>
            <div><span style={{ fontWeight: 'bold' }}>Used credits</span> <span style={{ fontWeight: 'bold', fontSize: 30, color: 'red', marginLeft: 10 }}>{data.usedCredits}</span></div>
            <div><span style={{ fontWeight: 'bold' }}>Available credits</span> <span style={{ fontWeight: 'bold', fontSize: 30, color: 'green', marginLeft: 10 }}>{data.availableCredits}</span></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <PromocodePageSizeSelect
              value={pageSize}
              onChange={(size) => {
                setPageSize(size);
                setCreditsPage(1);
              }}
            />
          </div>
          <table className="print-table">
            <thead>
              <tr>
                <th>Sender</th>
                <th>Credits thanks to</th>
                <th>Username</th>
                <th>Data Start</th>
                <th>Data end</th>
                <th>Version</th>
                <th>Credits</th>
              </tr>
            </thead>
            <tbody>
              {data.creditRecords.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 20 }}>No credits earned yet.</td></tr>
              ) : (
                paginateRows(data.creditRecords, creditsPage, pageSize).map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.senderUsername}</td>
                    <td>
                      <PromocodeAssetImage
                        src={promocodeFlagImageUrl(row.secondarySenderFlagImg, {
                          countryCode: row.secondarySenderCountryCode,
                        })}
                        fallbackSrc={PROMOCODE_NO_FLAG_IMAGE}
                        countryCode={row.secondarySenderCountryCode}
                        alt=""
                        className="inline-block mr-1 align-middle"
                        style={{ height: 23 }}
                      />
                      {row.secondarySenderUsername || row.creditsThanksTo}
                    </td>
                    <td>{row.receiverUsername || '--'}</td>
                    <td>{row.subscriptionStartDate || '--'}</td>
                    <td>{row.subscriptionEndDate || '--'}</td>
                    <td>{row.versionName || '--'}</td>
                    <td>{row.credits.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <PromocodesPagination
            page={creditsPage}
            totalPages={Math.max(1, Math.ceil(data.creditRecords.length / pageSize))}
            onPageChange={setCreditsPage}
          />
        </div>
      )}

      {activeTab === 'connections' && (
        <div style={{ border: '1px solid #cac8c9', marginTop: 20 }}>
          <div className="connection-header">
            {data.connectionChart.currentUserUsername || 'User'}
            <span style={{ float: 'right' }}>
              {copy.currentCredits} {formatChartCredits(data.connectionChart.totalCredits)}{' '}
              {copy.used} <span style={{ color: 'red' }}>{formatChartCredits(data.connectionChart.usedCredits)}</span>{' '}
              {copy.available} <span style={{ color: 'green' }}>{formatChartCredits(Math.min(data.connectionChart.totalCredits, data.connectionChart.availableCredits))}</span>
            </span>
          </div>

          {data.connectionChart.allowsCurrentUserToEarn && (
            <div className="connection-earn-banner">
              {data.connectionChart.currentUserUsername}{' '}
              <span style={{ color: 'red' }}>
                {copy.allowsPrefix}{' '}
                {data.connectionChart.allowsCurrentUserToEarn.username}
                {data.connectionChart.allowsCurrentUserToEarn.roleName
                  ? ` (${formatRoleName(data.connectionChart.allowsCurrentUserToEarn.roleName, data.connectionChart.allowsCurrentUserToEarn.roleId)})`
                  : ''}{' '}
                {copy.allowsMiddle}
              </span>
            </div>
          )}

          <div style={{ padding: 10 }}>{copy.personalRegistration}</div>
          <div className="connection-list">
            <div className="connection-columns">
              <div>
                <p>{data.connectionChart.currentUserUsername || 'User'}</p>
              </div>
              <div>
                <p>{formatChartCredits(data.connectionChart.personalRegistrationCredits ?? 0)}</p>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 20, padding: 10 }}>
            {copy.usersThatAllow} <span style={{ color: '#70020b' }}>{data.connectionChart.currentUserUsername || 'User'}</span> {copy.toEarnOther}
          </div>

          <div style={{ padding: 10 }}>{copy.directRecipients}</div>
          <div className="connection-list">
            {data.connectionChart.directRecipients.length === 0 ? (
              <p style={{ padding: 10 }}>{copy.noDirect}</p>
            ) : (
              <div className="connection-columns">
                <div>
                  {data.connectionChart.directRecipients.map((d, i) => (
                    <p key={i}>
                      <PromocodePersonMark
                        label={`${d.username}${d.roleName ? ` (${formatRoleName(d.roleName)})` : ''}`}
                        image={d.image}
                        logoUrl={d.logoUrl}
                        roleId={d.roleId}
                        registered
                      />
                    </p>
                  ))}
                </div>
                <div>
                  {data.connectionChart.directRecipients.map((d, i) => (
                    <p key={i}>{formatChartCredits(d.credits)}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: 10 }}>{copy.indirectRecipients}</div>
          <div className="connection-list">
            {data.connectionChart.indirectRecipients.length === 0 ? (
              <p style={{ padding: 10 }}>{copy.noIndirect}</p>
            ) : (
              <div className="connection-columns three">
                <div>
                  {data.connectionChart.indirectRecipients.map((d, i) => (
                    <p key={i}>
                      <PromocodePersonMark
                        label={`${d.username}${d.roleName ? ` (${formatRoleName(d.roleName)})` : ''}`}
                        image={d.image}
                        logoUrl={d.logoUrl}
                        roleId={d.roleId}
                        registered
                      />
                    </p>
                  ))}
                </div>
                <div>
                  {data.connectionChart.indirectRecipients.map((d, i) => (
                    <p key={i}>{formatChartCredits(d.credits)}</p>
                  ))}
                </div>
                <div style={{ color: '#a7a8a4' }}>
                  {data.connectionChart.indirectRecipients.map((d, i) => (
                    <p key={i}>
                      by {d.senderUsername}
                      {d.senderRoleName ? ` (${formatRoleName(d.senderRoleName)})` : ''}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={onSearchSubmit} style={{ display: 'none' }} aria-hidden />

      <PromocodeInviteEmailsModal
        open={inviteEmailsOpen}
        entries={inviteEmailEntries}
        onClose={() => setInviteEmailsOpen(false)}
      />
    </div>
  );
}
