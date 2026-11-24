/** Desk and online sellings: 00001-yyyy, restarting from 00001 every year. */
export function formatSellingNumber(sequence: number, date: Date | string = new Date()) {
  const seq = String(Math.max(1, Math.floor(Number(sequence) || 1))).padStart(5, '0');
  const raw = typeof date === 'string' ? date.slice(0, 4) : String(date.getUTCFullYear());
  const year = /^\d{4}$/.test(raw) ? raw : String(new Date().getUTCFullYear());
  return `${seq}-${year}`;
}

/** Sequence part of a stored number, for both 00001-yyyy and the older 00001-yyyymmdd. */
export function sellingSequenceOf(value: unknown): number {
  const match = /^(\d+)-\d{4}(\d{4})?$/.exec(String(value ?? '').trim());
  return match ? Number(match[1]) : 0;
}

/** Number + year as listed in the archive; older 00001-yyyymmdd numbers drop the month and day. */
export function displaySellingNumber(value: unknown): string {
  const raw = String(value ?? '').trim();
  const match = /^(\d+)-(\d{4})\d{4}$/.exec(raw);
  return match ? `${match[1]}-${match[2]}` : raw;
}
