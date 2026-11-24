/**
 * WhatsApp / Telegram / Facebook / SMS share URL builders.
 */

/** sms: body for invite sharing (iOS/Android browsers). */
export function buildSmsShareUrl(phone: string | undefined, text: string): string {
  const params = new URLSearchParams();
  params.set('body', truncateForShareUrl(text, 600));
  const digits = phone?.replace(/\D/g, '') ?? '';
  const query = params.toString();
  return digits ? `sms:${digits}?${query}` : `sms:?${query}`;
}

const TELEGRAM_RESERVED_PATHS = new Set([
  'share',
  'join',
  'addstickers',
  'addtheme',
  'iv',
  'socks',
  'login',
  'proxy',
  'setlanguage',
  'bg',
  'msg',
  'confirmphone',
]);

const MAX_TELEGRAM_URL_TEXT = 1500;

/** Ensure the public share URL is always included in the outgoing message. */
export function ensureShareLinkInMessage(message: string, shareLink: string): string {
  const trimmed = message.trim();
  if (!shareLink.trim()) return trimmed;
  if (trimmed.includes(shareLink)) return trimmed;
  return trimmed ? `${trimmed}\n\n${shareLink}` : shareLink;
}

function truncateForShareUrl(text: string, max = MAX_TELEGRAM_URL_TEXT): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Parse @username, t.me/username, or plain username.
 * Returns null if not a valid public Telegram username.
 */
export function parseTelegramUsername(input: string): string | null {
  let raw = input.trim();
  if (!raw) return null;

  raw = raw.replace(/^@/, '');

  const linkMatch = raw.match(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]+)/i);
  if (linkMatch) {
    raw = linkMatch[1];
  } else {
    raw = raw.split(/[\s/?#]+/)[0];
  }

  if (!/^[A-Za-z0-9_]{5,32}$/.test(raw)) return null;
  if (TELEGRAM_RESERVED_PATHS.has(raw.toLowerCase())) return null;
  return raw;
}

export function looksLikeTelegramPhone(input: string): boolean {
  const stripped = input.replace(/[\s+()-]/g, '');
  if (!/^\d{8,15}$/.test(stripped)) return false;
  const digitRatio = stripped.length / Math.max(input.trim().length, 1);
  return digitRatio >= 0.85;
}

/**
 * Open WhatsApp with optional recipient (digits only, country code, no +).
 * @see https://faq.whatsapp.com/general/chats/how-to-use-click-to-chat
 */
export function buildWhatsAppShareUrl(phone: string | undefined, text: string): string {
  const params = new URLSearchParams();
  const digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.length > 0) {
    params.set('phone', digits);
  }
  params.set('text', truncateForShareUrl(text));
  return `https://api.whatsapp.com/send?${params.toString()}`;
}

/** Direct chat with @username and pre-filled message (do not encode username in path). */
export function buildTelegramDirectChatUrl(username: string, message: string): string {
  return `https://t.me/${username}?text=${encodeURIComponent(truncateForShareUrl(message))}`;
}

/**
 * Telegram share dialog — user picks a chat; url is inserted first, then text.
 * @see https://core.telegram.org/api/links#share-links
 */
export function buildTelegramSharePickerUrl(shareLink: string, fullMessage: string): string {
  const params = new URLSearchParams();
  params.set('url', shareLink);
  const caption = fullMessage.replace(shareLink, '').trim();
  if (caption) {
    params.set('text', truncateForShareUrl(caption));
  }
  return `https://t.me/share/url?${params.toString()}`;
}

export type TelegramShareResult = {
  url: string;
  /** Shown when we fall back to the share picker */
  notice?: string;
};

/**
 * Build Telegram share URL.
 * - Empty recipient → share picker (choose any chat)
 * - Valid @username → open that user's chat with message
 * - Phone / invalid → share picker + notice
 */
export function buildTelegramShareUrl(
  recipient: string | undefined,
  shareLink: string,
  fullMessage: string
): TelegramShareResult {
  const message = truncateForShareUrl(ensureShareLinkInMessage(fullMessage, shareLink));
  const trimmed = recipient?.trim() ?? '';

  if (!trimmed) {
    return { url: buildTelegramSharePickerUrl(shareLink, message) };
  }

  if (looksLikeTelegramPhone(trimmed)) {
    return {
      url: buildTelegramSharePickerUrl(shareLink, message),
      notice:
        'Telegram cannot open a chat from a phone number in the browser. Use a @username, or leave Recipient empty to choose a contact.',
    };
  }

  const username = parseTelegramUsername(trimmed);
  if (!username) {
    return {
      url: buildTelegramSharePickerUrl(shareLink, message),
      notice:
        'Enter a valid Telegram @username (5–32 letters, numbers, underscore), or leave Recipient empty to pick a chat.',
    };
  }

  return { url: buildTelegramDirectChatUrl(username, message) };
}

/**
 * Facebook Web Share — only the URL can be passed; post text cannot be pre-filled
 * (Facebook removed quote/hashtag params). Copy message to clipboard for the user.
 * @see https://developers.facebook.com/docs/sharing/reference/share-dialog
 */
export function buildFacebookShareUrl(url: string): string {
  const params = new URLSearchParams();
  params.set('u', url);
  params.set('display', 'popup');
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
}

export type FacebookShareResult = {
  copiedToClipboard: boolean;
};

export async function shareViaFacebook(
  shareLink: string,
  messageText: string
): Promise<FacebookShareResult> {
  let copiedToClipboard = false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(messageText);
      copiedToClipboard = true;
    } catch {
      copiedToClipboard = false;
    }
  }
  openExternalShareUrl(buildFacebookShareUrl(shareLink));
  return { copiedToClipboard };
}

export const FACEBOOK_SHARE_NOTICE =
  'Facebook does not allow pre-filled post text. Your message was copied to the clipboard — paste it (Ctrl+V) into the post. The link preview comes from the shared Movesbook page.';

/** Prefer anchor navigation — more reliable for tg:// and t.me on desktop. */
export function openExternalShareUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
