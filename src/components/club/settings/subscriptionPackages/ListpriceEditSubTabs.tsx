'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';

export const PRICELIST_PATH = '/club/settings/typology_subscription/pricelist';
export const ALL_PACKAGES_PATH = '/club/settings/typology_subscription/subscription_packages';

/** Tabs of a single list price: Type of subscription / Subscription package / Package features. */
export default function ListpriceEditSubTabs({
  listpriceId,
  showAllPackagesLink = false
}: {
  listpriceId: string;
  showAllPackagesLink?: boolean;
}) {
  const pathname = usePathname() ?? '';
  const id = encodeURIComponent(listpriceId);
  const tabs = [
    { label: 'Type of subscription', href: `${PRICELIST_PATH}/edit/${id}`, match: '/pricelist/edit/' },
    { label: 'Subscription package', href: `${PRICELIST_PATH}/package/${id}`, match: '/pricelist/package/' },
    { label: 'Package features', href: `${PRICELIST_PATH}/features/${id}`, match: '/pricelist/features/' }
  ];

  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-gray-900 px-4 pt-3">
      <div className="flex flex-wrap items-end gap-1">
        {tabs.map((tab) => {
          const active = pathname.includes(tab.match);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`rounded-t-md px-3 py-2 text-xs font-semibold transition ${
                active ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {showAllPackagesLink && (
        <Link
          href={`${ALL_PACKAGES_PATH}?from_pricelist=${id}`}
          className="mb-2 inline-flex items-center gap-2 rounded-md bg-gray-200 px-3 py-2 text-xs font-bold text-gray-900 hover:text-blue-800 hover:underline"
        >
          <LayoutGrid className="h-4 w-4" />
          All subscription packages
        </Link>
      )}
    </div>
  );
}
