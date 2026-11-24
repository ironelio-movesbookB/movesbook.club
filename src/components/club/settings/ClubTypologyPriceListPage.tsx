'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Copy, Loader2, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import ClubSettingsTypologyTabs from '@/components/club/settings/ClubSettingsTypologyTabs';
import type { TypologyListpriceListRow } from '@/lib/clubTypologyListprice';

type TypologyOption = { id: string; name: string };
const LIST_PATH = '/club/settings/typology_subscription/pricelist';

export default function ClubTypologyPriceListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTypologyId = searchParams?.get('typologyId') ?? '';

  const [typologies, setTypologies] = useState<TypologyOption[]>([]);
  const [selectedTypologyId, setSelectedTypologyId] = useState(queryTypologyId);
  const [rows, setRows] = useState<TypologyListpriceListRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;

  const loadRows = useCallback(async (typologyId: string) => {
    if (!typologyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/club/settings/typology-listprice?typologyId=${encodeURIComponent(typologyId)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Unable to load list prices.');
      setTypologies(Array.isArray(data.typologies) ? data.typologies : []);
      setRows(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load list prices.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/club/settings/typology-listprice', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await response.json().catch(() => null);
      if (cancelled || !response.ok) return;
      setTypologies(Array.isArray(data.typologies) ? data.typologies : []);
      const defaultId = queryTypologyId || String(data.defaultTypologyId ?? '');
      if (defaultId) {
        setSelectedTypologyId(defaultId);
      } else {
        setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [queryTypologyId]);

  useEffect(() => {
    if (selectedTypologyId) loadRows(selectedTypologyId);
  }, [selectedTypologyId, loadRows]);

  const handleTypologyChange = (typologyId: string) => {
    setSelectedTypologyId(typologyId);
    setSelectedId(null);
    router.replace(
      typologyId ? `${LIST_PATH}?typologyId=${encodeURIComponent(typologyId)}` : LIST_PATH
    );
  };

  const requireSelection = () => {
    if (!selectedRow) {
      window.alert('Please select a list price first.');
      return null;
    }
    return selectedRow;
  };

  const typologyLabel = useMemo(
    () => typologies.find((t) => t.id === selectedTypologyId)?.name ?? '',
    [typologies, selectedTypologyId]
  );

  return (
    <div className="p-4 lg:p-6 print:p-0">
      <section className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
        <ClubSettingsTypologyTabs listPriceTypologyId={selectedTypologyId || null} />

        <div className="border-b border-gray-200 px-4 py-4">
          <h1 className="text-xl font-semibold text-gray-950">
            Setting typologies of subscription to the club
          </h1>
          <p className="mt-1 text-sm text-gray-500">List prices</p>

          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            <label className="block text-sm font-medium text-gray-700">
              Select typology you want to manage
            </label>
            <select
              value={selectedTypologyId}
              onChange={(e) => handleTypologyChange(e.target.value)}
              className="mt-2 h-10 max-w-md rounded-md border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="">Select</option>
              {typologies.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            {typologyLabel && (
              <p className="mt-2 text-sm text-gray-600">Showing prices for: {typologyLabel}</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 print:hidden">
            <ToolbarButton
              icon={Plus}
              label="Add new"
              onClick={() =>
                router.push(
                  `${LIST_PATH}/add${selectedTypologyId ? `?typologyId=${encodeURIComponent(selectedTypologyId)}` : ''}`
                )
              }
              disabled={!selectedTypologyId}
            />
            <ToolbarButton
              icon={Pencil}
              label="Modify"
              onClick={() => {
                const row = requireSelection();
                if (row) router.push(`${LIST_PATH}/edit/${encodeURIComponent(row.id)}`);
              }}
              disabled={!selectedRow}
            />
            <ToolbarButton
              icon={Copy}
              label={copying ? 'Copying…' : 'Copy'}
              disabled={!selectedRow || copying}
              onClick={async () => {
                const row = requireSelection();
                if (!row) return;
                if (!window.confirm('Do you want to copy this item?')) return;
                setCopying(true);
                try {
                  const token = localStorage.getItem('token');
                  const response = await fetch('/api/club/settings/typology-listprice', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ action: 'copy-listprice', sourceId: row.id })
                  });
                  const data = await response.json().catch(() => null);
                  if (!response.ok) throw new Error(data?.error || 'Copy failed');
                  await loadRows(selectedTypologyId);
                  if (data?.id) setSelectedId(String(data.id));
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : 'Copy failed');
                } finally {
                  setCopying(false);
                }
              }}
            />
            <ToolbarButton
              icon={Printer}
              label="Print"
              onClick={() => {
                if (requireSelection()) window.print();
              }}
              disabled={!selectedRow}
            />
            <ToolbarButton
              icon={Trash2}
              label="Delete"
              danger
              disabled={!selectedRow}
              onClick={async () => {
                const row = requireSelection();
                if (!row || !window.confirm('Delete this list price?')) return;
                const previous = rows;
                setRows((c) => c.filter((r) => r.id !== row.id));
                setSelectedId(null);
                try {
                  const token = localStorage.getItem('token');
                  const response = await fetch(
                    `/api/club/settings/typology-listprice?id=${encodeURIComponent(row.id)}`,
                    { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} }
                  );
                  if (!response.ok) throw new Error();
                } catch {
                  setRows(previous);
                  setSelectedId(row.id);
                  window.alert('Unable to delete.');
                }
              }}
            />
            <ToolbarButton icon={X} label="Remove selection" onClick={() => setSelectedId(null)} disabled={!selectedRow} />
          </div>
        </div>

        <div className="min-h-[280px] overflow-x-auto">
          {!selectedTypologyId ? (
            <p className="px-4 py-12 text-center text-sm text-gray-500">Select a typology to view list prices.</p>
          ) : loading ? (
            <div className="flex h-48 items-center justify-center text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading list prices
            </div>
          ) : error ? (
            <p className="px-4 py-12 text-center text-sm text-red-600">{error}</p>
          ) : (
            <table className="min-w-[960px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-xs uppercase text-gray-600">
                  <th className="w-12 px-3 py-3" />
                  <th className="px-3 py-3 text-center">Active</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Subscription package</th>
                  <th className="px-3 py-3 text-center">Cost</th>
                  <th className="px-3 py-3 text-center">Months</th>
                  <th className="px-3 py-3 text-center">Inst.</th>
                  <th className="px-3 py-3 text-center">Recursivity</th>
                  <th className="px-3 py-3 text-center">Access</th>
                  <th className="px-3 py-3 text-center">1st Inst.</th>
                  <th className="px-3 py-3 text-center">Disc. Ren.</th>
                  <th className="px-3 py-3 text-center">Cond. Renewal</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-gray-500">
                      No list prices for this typology.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={`cursor-pointer border-b border-gray-100 ${
                        row.id === selectedId ? 'bg-yellow-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-3 py-3 text-center">
                        <input type="radio" checked={row.id === selectedId} readOnly className="h-4 w-4" />
                      </td>
                      <td className="px-3 py-3 text-center">{row.activeStatus}</td>
                      <td className="px-4 py-3 font-medium">{row.subscriptionName}</td>
                      <td className="px-4 py-3">{row.packageName || '-'}</td>
                      <td className="px-3 py-3 text-center">{row.cost || '-'}</td>
                      <td className="px-3 py-3 text-center">{row.saleDurationMonths || '-'}</td>
                      <td className="px-3 py-3 text-center">{row.installnment || '-'}</td>
                      <td className="px-3 py-3 text-center">{row.daysRecursion || '-'}</td>
                      <td className="px-3 py-3 text-center">{row.saleMaxNumber || '-'}</td>
                      <td className="px-3 py-3 text-center">{row.firstCostInstallnment || '-'}</td>
                      <td className="px-3 py-3 text-center">{row.renewalNextDiscount || '-'}</td>
                      <td className="px-3 py-3 text-center">
                        <input type="checkbox" checked={row.conditionRenewalStatus} disabled className="h-4 w-4" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold disabled:opacity-45 ${
        danger ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-gray-300 text-gray-800 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
