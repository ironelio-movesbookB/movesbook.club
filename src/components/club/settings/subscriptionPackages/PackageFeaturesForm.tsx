'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, RotateCcw, Save } from 'lucide-react';
import ClubSettingsTypologyTabs from '@/components/club/settings/ClubSettingsTypologyTabs';
import ListpriceEditSubTabs, { PRICELIST_PATH } from './ListpriceEditSubTabs';
import { authFetch, type PackageDetailResponse } from './types';
import StatusToast, { type Toast } from './StatusToast';

const MovesbookEditor = dynamic(() => import('@/components/club/Editor'), { ssr: false });

/** "Package features" tab. Legacy: clubsetting_subscription_package_features.ctp */
export default function PackageFeaturesForm({ listpriceId }: { listpriceId: string }) {
  const router = useRouter();
  const [data, setData] = useState<PackageDetailResponse | null>(null);
  const [feature, setFeature] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    authFetch<PackageDetailResponse>(
      `/api/club/settings/subscription-package?listpriceId=${encodeURIComponent(listpriceId)}`
    )
      .then((response) => {
        if (cancelled) return;
        setData(response);
        setFeature(response.package.packageFeature);
      })
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : 'Unable to load.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [listpriceId]);

  const save = async () => {
    setSaving(true);
    try {
      const response = await authFetch<{ message?: string }>('/api/club/settings/subscription-package', {
        method: 'PATCH',
        body: JSON.stringify({ listpriceId, packageFeature: feature })
      });
      setToast({ type: 'success', message: response.message || 'Package features saved successfully.' });
    } catch (e) {
      setToast({ type: 'error', message: e instanceof Error ? e.message : 'Failed to save package features!' });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setFeature(data?.package.packageFeature ?? '');
    setEditorKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      </div>
    );
  }
  if (loadError || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">{loadError ?? 'Unable to load.'}</p>
        <button type="button" onClick={() => router.push(PRICELIST_PATH)} className="mt-4 text-sm font-semibold">
          Back
        </button>
      </div>
    );
  }

  const backHref = `${PRICELIST_PATH}?typologyId=${encodeURIComponent(data.listprice.typologyId)}`;

  return (
    <div className="p-4 lg:p-6">
      <StatusToast toast={toast} onClose={() => setToast(null)} />
      <section className="rounded-md border border-gray-200 bg-white shadow-sm">
        <ClubSettingsTypologyTabs listPriceTypologyId={data.listprice.typologyId || null} />
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-4">
          <h1 className="text-xl font-semibold">Package Features</h1>
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="p-4">
          <div className="rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold uppercase text-gray-600">Subscription Information</h2>
            <div className="mt-3 space-y-3">
              <ReadOnlyRow label="Typology" value={data.listprice.typologyName} />
              <ReadOnlyRow label="Subscription Name" value={data.listprice.subscriptionName} />
              <ReadOnlyRow label="Package Name" value={data.package.packageName} />
            </div>
          </div>
        </div>

        <ListpriceEditSubTabs listpriceId={listpriceId} />

        <div className="p-4">
          <p className="mb-2 text-sm font-bold text-gray-800">Detailed Package Description:</p>
          <MovesbookEditor
            key={editorKey}
            value={feature}
            onChange={setFeature}
            placeholder="Describe the features of this package..."
          />
        </div>

        <div className="flex justify-end gap-2 bg-gray-50 px-4 py-4">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="rounded-md border px-4 py-2 text-sm font-semibold"
          >
            Back
          </button>
          <button
            type="button"
            onClick={cancel}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold"
          >
            <RotateCcw className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </section>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 md:grid-cols-[180px_1fr] md:items-center">
      <span className="text-sm font-medium text-gray-700 md:text-right md:pr-4">{label}</span>
      <input readOnly value={value} className="h-9 w-full rounded-md border border-gray-300 bg-gray-50 px-3 text-sm" />
    </div>
  );
}
