'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Link as LinkIcon,
  Send,
  Facebook,
  MessageCircle,
  PenSquare,
  Mail,
} from 'lucide-react';
import { getAuthHeaders } from '@/lib/club/servicePurchasesClient';

type ShareModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Defaults to the current page URL. */
  url?: string;
  description?: string;
  /** Hide the "Post on Movesbook" action. */
  hidePost?: boolean;
  /**
   * Show an Email option. Uses the same `/api/send-email` Send mail flow
   * (To + message via Ionos), not a local mailto: draft.
   */
  showEmail?: boolean;
  /** Open the shared page with its archive grid only, without workspace chrome. */
  gridOnly?: boolean;
  /** Called when the user chooses Post on Movesbook. */
  onPostToMovesbook?: () => void;
};

export default function ShareModal({
  open,
  onClose,
  title = 'Share this page',
  url,
  description,
  hidePost = false,
  showEmail = false,
  gridOnly = false,
  onPostToMovesbook,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailTo, setMailTo] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailMessage, setMailMessage] = useState('');
  const [mailSending, setMailSending] = useState(false);
  const [mailError, setMailError] = useState('');

  const shareUrl =
    url ?? (typeof window !== 'undefined' ? window.location.href : '');
  const gridShareUrl = (() => {
    if (!gridOnly || typeof window === 'undefined' || !shareUrl) return shareUrl;
    const parsed = new URL(shareUrl, window.location.href);
    parsed.searchParams.set('share', 'grid');
    return parsed.toString();
  })();

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setMailOpen(false);
      setMailTo('');
      setMailSubject('');
      setMailMessage('');
      setMailError('');
      setMailSending(false);
    }
  }, [open]);

  if (!open) return null;

  const openSendMail = () => {
    setMailError('');
    setMailTo('');
    setMailSubject(title);
    setMailMessage(
      description
        ? `${description}\n\n${gridShareUrl}`
        : `Here is the link:\n\n${gridShareUrl}`,
    );
    setMailOpen(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(gridShareUrl);
      setCopied(true);
    } catch {
      alert('Failed to copy link');
    }
  };

  const handleSendMail = async () => {
    const to = mailTo.trim();
    const message = mailMessage.trim();
    if (!to || !message) {
      setMailError('Enter email and message.');
      return;
    }
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) {
      setMailError('Enter a valid email address.');
      return;
    }
    setMailSending(true);
    setMailError('');
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: to,
          subject: mailSubject.trim() || title,
          message,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.success === false) {
        throw new Error(
          typeof result.error === 'string' ? result.error : 'Failed to send email',
        );
      }
      setMailOpen(false);
      onClose();
      window.alert('Email sent successfully.');
    } catch (e: unknown) {
      setMailError(e instanceof Error ? e.message : 'Error sending email');
    } finally {
      setMailSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-[90%] max-w-md rounded-xl bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-gray-400 transition hover:text-black"
        >
          <X size={18} />
        </button>

        <h2 className={`text-lg font-semibold ${description ? 'mb-2' : 'mb-5'}`}>{title}</h2>
        {description ? <p className="mb-5 text-sm text-gray-600">{description}</p> : null}

        <div className={`mb-5 grid gap-3 ${showEmail ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(gridShareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center rounded-lg border py-3 text-gray-700 transition hover:bg-gray-100"
          >
            <MessageCircle size={22} className="text-green-500" />
            <span className="mt-1 text-sm">WhatsApp</span>
          </a>

          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(gridShareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center rounded-lg border py-3 text-gray-700 transition hover:bg-gray-100"
          >
            <Send size={22} className="text-blue-500" />
            <span className="mt-1 text-sm">Telegram</span>
          </a>

          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(gridShareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center rounded-lg border py-3 text-gray-700 transition hover:bg-gray-100"
          >
            <Facebook size={22} className="text-blue-600" />
            <span className="mt-1 text-sm">Facebook</span>
          </a>

          {showEmail ? (
            <button
              type="button"
              onClick={openSendMail}
              className="flex flex-col items-center justify-center rounded-lg border py-3 text-gray-700 transition hover:bg-gray-100"
            >
              <Mail size={22} className="text-gray-600" />
              <span className="mt-1 text-sm">Email</span>
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-gray-700 transition hover:bg-gray-100 ${
            hidePost ? '' : 'mb-3'
          }`}
        >
          <LinkIcon size={16} />
          <span>{copied ? 'Link copied!' : 'Get link'}</span>
        </button>

        {hidePost ? null : (
          <button
            type="button"
            onClick={() => {
              onClose();
              onPostToMovesbook?.();
            }}
            className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-gray-700 transition hover:bg-gray-100"
          >
            <PenSquare size={16} />
            <span>Post on Movesbook</span>
          </button>
        )}
      </div>

      {mailOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setMailOpen(false)}
              disabled={mailSending}
              className="absolute right-3 top-3 text-gray-400 hover:text-black disabled:opacity-50"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Send mail</h2>
            <p className="mb-4 text-xs text-gray-500">
              Mail is sent from Movesbook using the configured email service.
            </p>
            <label className="mb-2 block text-sm font-medium text-gray-700">Mail address</label>
            <input
              type="email"
              autoFocus
              value={mailTo}
              onChange={(e) => setMailTo(e.target.value)}
              placeholder="name@example.com"
              className="mb-3 w-full rounded border border-gray-400 px-3 py-2 text-sm text-gray-900"
              autoComplete="email"
            />
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Subject (optional)
            </label>
            <input
              type="text"
              value={mailSubject}
              onChange={(e) => setMailSubject(e.target.value)}
              className="mb-3 w-full rounded border border-gray-400 px-3 py-2 text-sm text-gray-900"
            />
            <label className="mb-2 block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={mailMessage}
              onChange={(e) => setMailMessage(e.target.value)}
              rows={5}
              placeholder="Write your message…"
              className="mb-3 w-full resize-none rounded border border-gray-400 px-3 py-2 text-sm text-gray-900"
            />
            {mailError ? <p className="mb-2 text-sm text-red-600">{mailError}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMailOpen(false)}
                disabled={mailSending}
                className="rounded border border-gray-400 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendMail()}
                disabled={mailSending}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {mailSending ? 'Sending…' : 'Send mail'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
