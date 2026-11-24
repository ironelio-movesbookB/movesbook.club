import type { MubCategory } from '@/lib/mub/types';

/** PHP path segments: /users/mub_page/club|workout|social */
export const MUB_CATEGORY_PATH: Record<MubCategory, string> = {
  CLUB_MANAGEMENT: 'club',
  WORKOUT: 'workout',
  SOCIAL: 'social',
};

const PATH_TO_CATEGORY = Object.fromEntries(
  Object.entries(MUB_CATEGORY_PATH).map(([category, path]) => [path, category]),
) as Record<string, MubCategory>;

export function mubCategoryFromPath(segment: string | undefined | null): MubCategory | null {
  if (!segment) return null;
  return PATH_TO_CATEGORY[segment] ?? null;
}

export function mubPagePath(category?: MubCategory | null): string {
  if (!category) return '/users/mub_page';
  return `/users/mub_page/${MUB_CATEGORY_PATH[category]}`;
}

export type MubPageUrlOptions = {
  category?: MubCategory | null;
  setting?: boolean;
  panel?: 'background';
  edit?: boolean;
};

export function mubPageUrl(opts: MubPageUrlOptions = {}): string {
  const base = mubPagePath(opts.category ?? null);
  const params = new URLSearchParams();
  if (opts.setting) params.set('setting', 'true');
  if (opts.panel === 'background') params.set('panel', 'background');
  if (opts.edit) params.set('edit', '1');
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** Super Admin / staff template builder — stays on STAFF scope (never user MUB URLs). */
export function mubStaffPageUrl(opts: {
  role: string;
  category?: MubCategory | null;
}): string {
  const params = new URLSearchParams({ role: opts.role });
  if (opts.category) params.set('category', MUB_CATEGORY_PATH[opts.category]);
  return `/users/mub_staff_page?${params.toString()}`;
}
