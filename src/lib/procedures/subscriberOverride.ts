/**
 * Deadlines of non-member event subscribers are stored under the club owner's account; their
 * metadata keeps the real subscriber, shown and mailed instead of the owner.
 */
export type ProcedureSubscriber = { name: string; email: string; currency: string };

export function procedureSubscriber(metadata: unknown): ProcedureSubscriber | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const meta = metadata as Record<string, unknown>;
  const name = String(meta.subscriberName ?? '').trim();
  if (!name) return null;
  return {
    name,
    email: String(meta.subscriberEmail ?? '').trim(),
    currency: String(meta.currency ?? '').trim().toUpperCase(),
  };
}
