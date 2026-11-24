'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { getSubscriptionEditData } from '@/lib/admin/subscriptionSettingsMock';
import RegistrationVersionSloganBlock from '@/components/register/RegistrationVersionSloganBlock';
import RegistrationSubscriptionPricingBlock from '@/components/register/RegistrationSubscriptionPricingBlock';
import RegistrationVersionLastNewsBlock from '@/components/register/RegistrationVersionLastNewsBlock';
import RegistrationPackageEntityDetailPanel from '@/components/register/RegistrationPackageEntityDetailPanel';
import { SubscriptionSharingSummary } from '@/components/admin/subscriptions/SubscriptionMembershipSharingDisplay';
import {
  formatRegistrationPrice,
  getEntityDisplayTitle,
  getPackageReviewRowsForCategory,
  getUserTypeReviewLabel,
  type RegistrationPackageCategory,
  type RegistrationUserType,
} from '@/lib/registration/waysToGetStarted';
import type { MemberRegistrationInfoPayload } from '@/lib/registration/memberRegistrationInfo';

type MemberRegistrationInfoPanelProps = {
  embedded?: boolean;
  onClose?: () => void;
};

type LoadedInfo = MemberRegistrationInfoPayload & { language: string };

export default function MemberRegistrationInfoPanel({
  embedded = true,
  onClose,
}: MemberRegistrationInfoPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<LoadedInfo | null>(null);
  const [category, setCategory] = useState<RegistrationPackageCategory>('social_training');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/user/member-registration-info', {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load registration info');
        }
        if (!cancelled) setInfo(data as LoadedInfo);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load registration info');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const editData = useMemo(
    () => (info ? getSubscriptionEditData(info.subscriptionSettingId, false) : null),
    [info],
  );

  const packages = useMemo(() => {
    if (!info) return [];
    return getPackageReviewRowsForCategory(info.registrationUserType, info.language, category);
  }, [info, category]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border bg-white p-12">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-teal-600" />
          <p className="text-sm text-gray-600">Loading registration info…</p>
        </div>
      </div>
    );
  }

  if (error || !info || !editData) {
    return (
      <div className="flex flex-1 flex-col rounded-lg border bg-white p-8">
        {embedded && onClose ? (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Close
            </button>
          </div>
        ) : null}
        <p className="text-center text-gray-600">
          {error ?? 'Subscription details are not available for your account.'}
        </p>
      </div>
    );
  }

  const userTypeLabel = getUserTypeReviewLabel(info.registrationUserType);
  const versionTitle = getEntityDisplayTitle(
    info.registrationUserType,
    info.versionColumn.label,
  );
  const purchasedTierKey = info.entity.tierKey;

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-[#7a1f2e] px-4 py-4 text-white">
        <div className="min-w-0">
          <h2 className="text-xl font-bold uppercase tracking-wide">Registration info</h2>
          <p className="mt-1 text-sm text-white/90">
            Your purchased version — {versionTitle}
            {info.versionCode ? ` (${info.versionCode})` : ''}
          </p>
        </div>
        {embedded && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-white/10 p-2 hover:bg-white/20"
            aria-label="Close registration info"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <dt className="text-gray-500 font-medium">Account type</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{userTypeLabel}</dd>
          </div>
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
            <dt className="text-gray-500 font-medium">Version</dt>
            <dd className="mt-0.5 font-semibold text-gray-900">{info.versionColumn.label}</dd>
          </div>
          {info.subscriptionStartDate ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <dt className="text-gray-500 font-medium">Subscription start</dt>
              <dd className="mt-0.5 font-semibold text-gray-900">{info.subscriptionStartDate}</dd>
            </div>
          ) : null}
          {info.subscriptionEndDate ? (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <dt className="text-gray-500 font-medium">Subscription end</dt>
              <dd className="mt-0.5 font-semibold text-gray-900">{info.subscriptionEndDate}</dd>
            </div>
          ) : null}
        </dl>

        <RegistrationVersionSloganBlock
          general={editData.general}
          lang={info.language}
          versionName={info.versionColumn.label}
        />

        <RegistrationSubscriptionPricingBlock
          general={editData.general}
          scenario="first"
          showTripleOption={
            editData.general.tripleDurationPrice > 0 || editData.general.tripleDurationDiscount > 0
          }
        />

        <SubscriptionSharingSummary
          settings={editData.settings}
          userType={info.registrationUserType}
        />

        <RegistrationVersionLastNewsBlock
          lastNewsByLang={editData.settings.lastNewsByLang}
          lang={info.language}
          versionName={info.versionColumn.label}
          variant="registration"
        />

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-gray-900">Included packages</h3>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setCategory('social_training')}
                className={`px-2 py-1 text-xs font-bold rounded ${
                  category === 'social_training'
                    ? 'bg-[#337ab7] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Social &amp; Training
              </button>
              <button
                type="button"
                onClick={() => setCategory('management')}
                className={`px-2 py-1 text-xs font-bold rounded ${
                  category === 'management'
                    ? 'bg-[#337ab7] text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Management
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded border border-[#286090]">
            <table className="w-full min-w-[480px] border-collapse text-white">
              <thead>
                <tr className="border-b border-[#286090] bg-[#337ab7]">
                  <th className="border-r border-[#286090] px-3 py-3 text-left text-sm font-bold uppercase">
                    Package
                  </th>
                  <th className="px-3 py-3 text-center text-sm font-bold uppercase min-w-[140px]">
                    {info.versionColumn.label}
                  </th>
                </tr>
                <tr className="border-b border-[#286090] bg-[#2a6496]">
                  <td className="border-r border-[#286090] px-3 py-2 text-xs font-semibold italic">
                    Price
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-semibold text-[#dbeafe]">
                    {formatRegistrationPrice(info.versionColumn.price)}
                  </td>
                </tr>
                <tr className="border-b border-[#286090] bg-[#2a6496]">
                  <td className="border-r border-[#286090] px-3 py-2 text-xs font-semibold italic">
                    Duration
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-semibold text-[#dbeafe]">
                    {info.versionColumn.durationDays} days
                  </td>
                </tr>
              </thead>
              <tbody>
                {packages.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="bg-[#337ab7] px-4 py-8 text-center text-sm">
                      No published packages available for this version.
                    </td>
                  </tr>
                ) : (
                  packages.map((pkg, index) => {
                    const enabled = pkg.tiers[purchasedTierKey] ?? false;
                    return (
                      <tr
                        key={pkg.id}
                        className={`border-b border-[#286090] ${
                          index % 2 === 0 ? 'bg-[#337ab7]' : 'bg-[#2e6da4]'
                        }`}
                      >
                        <td className="border-r border-[#286090] px-3 py-3 align-top">
                          <div className="font-bold text-sm uppercase leading-snug mb-1">
                            {pkg.title}
                          </div>
                          <p className="text-xs text-white/90 leading-relaxed">
                            {pkg.description || '—'}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          {enabled ? (
                            <Check className="mx-auto h-5 w-5 text-[#5cb85c] stroke-[3]" />
                          ) : (
                            <X className="mx-auto h-5 w-5 text-white/40 stroke-[3]" />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-base font-bold text-gray-900">Version details</h3>
          <div className="relative min-h-[420px] overflow-hidden rounded-md border-2 border-gray-300">
            <RegistrationPackageEntityDetailPanel
              entity={info.entity}
              userType={info.registrationUserType as RegistrationUserType}
              lang={info.language}
              category={category}
              embedded
            />
          </div>
        </div>
      </div>
    </div>
  );
}
