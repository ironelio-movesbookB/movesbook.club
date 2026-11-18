/** Desk and online sellings: 00001-yyyymmdd */
export function formatSellingNumber(sequence: number, date: Date | string = new Date()) {
  const seq = String(Math.max(1, Math.floor(Number(sequence) || 1))).padStart(5, '0');
  const raw = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  const parts = raw.split('-');
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${seq}-${parts[0]}${parts[1]}${parts[2]}`;
  }
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${seq}-${year}${month}${day}`;
}
