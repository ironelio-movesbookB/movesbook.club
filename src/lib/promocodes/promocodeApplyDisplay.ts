import type { LegacyUserSnippet, PromocodeApplyRow } from './types';

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

/** True when the legacy user row existed before (or at) the promocode apply was created. */
export function userExistedAtApplyTime(
  user: LegacyUserSnippet | null | undefined,
  applyCreated: string | null | undefined
): boolean {
  if (!user) return false;
  const applyTs = parseTime(applyCreated);
  const userTs = parseTime(user.created);
  if (applyTs == null || userTs == null) return true;
  // Small tolerance for invite + registration on the same timestamp.
  return userTs <= applyTs + 60_000;
}

export function isApplyRegistrationComplete(row: {
  receiverId?: number | null;
  isRegistered?: string | number | null;
  registrationDate?: string | null;
}): boolean {
  if (row.receiverId != null && row.receiverId > 0) return true;
  if (row.isRegistered === 1 || row.isRegistered === '1') return true;
  return Boolean(row.registrationDate?.trim());
}

export function promocodeSenderLabel(row: PromocodeApplyRow): string {
  if (row.sender?.username) return row.sender.username;
  return row.senderEmail ?? '';
}

export function promocodeSenderEmail(row: PromocodeApplyRow): string {
  return row.sender?.email || row.senderEmail || '';
}

export function promocodeSecondarySenderLabel(row: PromocodeApplyRow): string {
  const stored = row.secondarySenderUsername?.trim();
  if (stored && (!row.secondarySender || userExistedAtApplyTime(row.secondarySender, row.created))) {
    return stored;
  }
  if (row.secondarySender && userExistedAtApplyTime(row.secondarySender, row.created)) {
    return row.secondarySender.username ?? stored ?? '';
  }
  return stored ?? '';
}

export function promocodeRecipientLabel(row: PromocodeApplyRow): {
  text: string;
  className: string;
} {
  const registered = isApplyRegistrationComplete(row);

  if (registered) {
    const text = row.receiver?.username || row.receiverEmail || '';
    if (row.newReceiver === 'N') return { text, className: 'text-blue-600' };
    const receiverEmail = (row.receiverEmail || '').toLowerCase();
    const registeredEmail = (row.receiver?.email || '').toLowerCase();
    if (receiverEmail && registeredEmail && receiverEmail !== registeredEmail) {
      return { text, className: 'text-[#7b0a26] font-bold' };
    }
    return { text, className: 'text-black' };
  }

  const text = row.receiverEmail || '';
  if (row.existReceiverMatch) {
    return { text, className: 'text-blue-600 font-bold text-xs' };
  }
  return { text, className: 'text-black text-xs' };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Best email address for sending a message to this promocode apply row. */
export function promocodeApplyRecipientEmail(row: PromocodeApplyRow): string | null {
  const candidates = [row.receiverEmail, row.receiver?.email];
  for (const raw of candidates) {
    const email = raw?.trim() ?? '';
    if (email && EMAIL_PATTERN.test(email)) return email;
  }
  return null;
}
