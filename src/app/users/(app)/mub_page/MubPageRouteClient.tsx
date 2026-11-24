'use client';

import { useSearchParams } from 'next/navigation';
import MubPageClient from '@/components/mub/MubPageClient';
import { mubCategoryFromPath } from '@/lib/mub/routes';
import type { MubCategory } from '@/lib/mub/types';

/**
 * MUB page routing (aligned with PHP movesbook.net):
 *
 * | Action                         | URL                                      |
 * |--------------------------------|------------------------------------------|
 * | Red bar — first load           | /users/mub_page                          |
 * | User settings                  | /users/mub_page?setting=true             |
 * | Background Setting             | /users/mub_page?panel=background         |
 * | Club management tab            | /users/mub_page/club?setting=true        |
 * | Workout section tab            | /users/mub_page/workout?setting=true     |
 * | Social section tab             | /users/mub_page/social?setting=true      |
 * | Sidebar gear (password gate)   | /users/mub_page?edit=1                   |
 */
type MubPageRouteClientProps = {
  categorySlug?: string;
};

export default function MubPageRouteClient({ categorySlug }: MubPageRouteClientProps) {
  const searchParams = useSearchParams();
  const edit = searchParams?.get('edit') === '1';
  const setting = searchParams?.get('setting') === 'true';
  const panel = searchParams?.get('panel') === 'background' ? 'background' : setting ? 'user' : null;
  const categoryFromPath = mubCategoryFromPath(categorySlug);
  const initialCategory: MubCategory = categoryFromPath ?? 'CLUB_MANAGEMENT';
  const loadParam = searchParams?.get('load');
  const initialLoadSource =
    loadParam === 'movesbook' || loadParam === 'user' ? loadParam : null;

  return (
    <div className="px-4 py-6">
      <MubPageClient
        mode={edit ? 'edit' : 'view'}
        initialPanel={panel}
        initialCategory={initialCategory}
        hasCategoryInPath={Boolean(categoryFromPath)}
        initialLoadSource={initialLoadSource}
      />
    </div>
  );
}
