import { prisma } from '@/lib/prisma';
import { getCountryPriceInfo } from '@/lib/countries/countryPricingDb';
import { DEFAULT_CLUB_CURRENCY, normalizeCurrencyCode } from '@/lib/club/clubCurrency';

const cache = new Map<string, { code: string; at: number }>();
const TTL_MS = 5 * 60 * 1000;

/** Owner user id of a club or team workspace (teams use teams_new.adminId). */
export async function workspaceOwnerId(kind: 'club' | 'team', id: string): Promise<string | null> {
  if (kind === 'team') {
    const team = await prisma.team.findUnique({ where: { id }, select: { adminId: true } });
    return team?.adminId ?? null;
  }
  const club = await prisma.club.findUnique({ where: { id }, select: { adminId: true } });
  return club?.adminId ?? null;
}

/** Currency of the club / team: the owner's country in the admin Countries table (EUR by default). */
export async function getWorkspaceCurrency(kind: 'club' | 'team', id: string): Promise<string> {
  const key = `${kind}:${id}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.code;
  let code = DEFAULT_CLUB_CURRENCY;
  try {
    const ownerId = await workspaceOwnerId(kind, id);
    const owner = ownerId
      ? await prisma.user.findUnique({ where: { id: ownerId }, select: { country: true } })
      : null;
    if (owner?.country?.trim()) {
      code = normalizeCurrencyCode((await getCountryPriceInfo(owner.country)).currencyCode);
    }
  } catch (error) {
    console.error('workspace currency', error);
  }
  cache.set(key, { code, at: Date.now() });
  return code;
}
