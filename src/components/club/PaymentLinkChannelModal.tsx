'use client';

import { useEffect, useState } from 'react';
import { Facebook, Mail, MessageCircle, Send, Smartphone, X } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  buildFacebookShareUrl,
  buildSmsShareUrl,
  buildTelegramSharePickerUrl,
  buildWhatsAppShareUrl,
  FACEBOOK_SHARE_NOTICE,
  openExternalShareUrl,
} from '@/utils/socialShareUrls';

export type PaymentLinkChannel = 'whatsapp' | 'telegram' | 'facebook' | 'mail' | 'sms';

export type PaymentLinkResult = {
  payUrl: string;
  emailed?: boolean;
  entityName?: string;
};

type Props = {
  open: boolean;
  memberUserId: string;
  memberName?: string;
  amountEur: number;
  onClose: () => void;
  /** Creates the link (and the purchase when needed). Mail is sent by the server to `email`. */
  sendLink: (channel: PaymentLinkChannel, email: string) => Promise<PaymentLinkResult>;
  onSent: (notice: string) => void;
};

const CHANNEL_LABEL: Record<PaymentLinkChannel, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  facebook: 'Facebook',
  mail: 'Mail',
  sms: 'SMS',
};

function euro(amount: number): string {
  return `€ ${amount.toFixed(2)}`;
}

/** "How should the member receive the payment link?" — same tiles as the Share dialogs. */
export default function PaymentLinkChannelModal({
  open,
  memberUserId,
  memberName,
  amountEur,
  onClose,
  sendLink,
  onSent,
}: Props) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<PaymentLinkChannel | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !memberUserId) return;
    setError('');
    setBusy(null);
    let active = true;
    clubApiFetch<{ email?: string; phone?: string }>(
      `/api/club/member-online-payments?memberUserId=${encodeURIComponent(memberUserId)}`,
    )
      .then((data) => {
        if (!active) return;
        setEmail(data.email ?? '');
        setPhone(data.phone ?? '');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open, memberUserId]);

  if (!open) return null;

  const choose = async (channel: PaymentLinkChannel) => {
    if (busy) return;
    setError('');
    if (channel === 'mail' && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.trim())) {
      setError('Enter a valid email address for Mail.');
      return;
    }
    // Open the share tab now: browsers block windows opened after an await.
    const popup =
      channel === 'whatsapp' || channel === 'telegram' || channel === 'facebook'
        ? window.open('about:blank', '_blank')
        : null;
    setBusy(channel);
    try {
      const result = await sendLink(channel, email.trim());
      const entity = result.entityName?.trim() || 'Your club';
      const message = `${entity}: payment request of ${euro(amountEur)}. Open this link to pay: ${result.payUrl}`;
      const goTo = (url: string) => {
        if (popup && !popup.closed) popup.location.href = url;
        else openExternalShareUrl(url);
      };

      if (channel === 'mail' && !result.emailed) {
        throw new Error('The link was created but the mail could not be sent. Choose another channel.');
      }
      if (channel === 'whatsapp') goTo(buildWhatsAppShareUrl(phone, message));
      if (channel === 'telegram') goTo(buildTelegramSharePickerUrl(result.payUrl, message));
      if (channel === 'facebook') {
        await navigator.clipboard?.writeText(message).catch(() => undefined);
        goTo(buildFacebookShareUrl(result.payUrl));
      }
      if (channel === 'sms') window.location.href = buildSmsShareUrl(phone, message);

      const notice =
        channel === 'mail'
          ? `Payment link mailed to ${email.trim()}. The payment is recorded when the member pays.`
          : `Payment link sent by ${CHANNEL_LABEL[channel]}. The payment is recorded when the member pays.${
              channel === 'facebook' ? ` ${FACEBOOK_SHARE_NOTICE}` : ''
            }`;
      onSent(notice);
    } catch (err) {
      if (popup && !popup.closed) popup.close();
      setError(err instanceof Error ? err.message : 'Could not send the payment link');
    } finally {
      setBusy(null);
    }
  };

  const tile =
    'flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 p-3 transition-all disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={Boolean(busy)}
          className="absolute right-3 top-3 rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h3 className="pr-8 text-lg font-bold text-gray-900">Send the payment link</h3>
        <p className="mt-1 text-sm text-gray-600">
          How does {memberName?.trim() || 'the member'} want to receive the link for {euro(amountEur)}?
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-700">
            Email (Mail)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 px-2 py-1.5 text-sm font-normal text-gray-900"
              placeholder="name@example.com"
            />
          </label>
          <label className="text-xs font-semibold text-gray-700">
            Phone (WhatsApp, SMS)
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded border border-gray-400 px-2 py-1.5 text-sm font-normal text-gray-900"
              placeholder="+39..."
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void choose('whatsapp')}
            className={`${tile} hover:border-green-500 hover:bg-green-50`}
          >
            <MessageCircle className="mb-1 h-7 w-7 text-green-600" />
            <span className="text-xs font-medium text-gray-700">WhatsApp</span>
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void choose('telegram')}
            className={`${tile} hover:border-blue-500 hover:bg-blue-50`}
          >
            <Send className="mb-1 h-7 w-7 text-blue-600" />
            <span className="text-xs font-medium text-gray-700">Telegram</span>
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void choose('facebook')}
            className={`${tile} hover:border-blue-700 hover:bg-blue-50`}
          >
            <Facebook className="mb-1 h-7 w-7 text-blue-700" />
            <span className="text-xs font-medium text-gray-700">Facebook</span>
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void choose('mail')}
            className={`${tile} hover:border-amber-500 hover:bg-amber-50`}
          >
            <Mail className="mb-1 h-7 w-7 text-amber-600" />
            <span className="text-xs font-medium text-gray-700">Mail</span>
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void choose('sms')}
            className={`${tile} hover:border-teal-600 hover:bg-teal-50`}
          >
            <Smartphone className="mb-1 h-7 w-7 text-teal-700" />
            <span className="text-xs font-medium text-gray-700">SMS</span>
          </button>
        </div>

        {busy ? <p className="mt-3 text-sm text-gray-600">Creating the link…</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <p className="mt-4 text-xs text-gray-500">
          After the link is sent this form closes. The purchase and its deadlines stay open until the member pays;
          then the payment, the deadlines and the receipt (when Tax doc is ticked) are updated automatically.
        </p>
      </div>
    </div>
  );
}
