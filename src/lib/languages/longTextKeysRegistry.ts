import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'long-text-keys.json');

function readKeys(): string[] {
  try {
    if (!fs.existsSync(FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
      .map((k) => k.trim());
  } catch {
    return [];
  }
}

function writeKeys(keys: string[]): void {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const unique = Array.from(new Set(keys.map((k) => k.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  fs.writeFileSync(FILE, JSON.stringify(unique, null, 2), 'utf8');
}

export function listRegisteredLongTextKeys(): string[] {
  return readKeys();
}

export function isRegisteredLongTextKey(key: string): boolean {
  const normalized = key.trim();
  if (!normalized) return false;
  return readKeys().includes(normalized);
}

export function registerLongTextKey(key: string): string[] {
  const normalized = key.trim();
  if (!normalized) return readKeys();
  const keys = readKeys();
  if (!keys.includes(normalized)) {
    keys.push(normalized);
    writeKeys(keys);
  }
  return keys;
}

export function unregisterLongTextKey(key: string): string[] {
  const normalized = key.trim();
  const next = readKeys().filter((k) => k !== normalized);
  writeKeys(next);
  return next;
}
