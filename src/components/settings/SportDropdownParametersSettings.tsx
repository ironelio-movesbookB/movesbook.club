'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Plus, Trash2, Loader2, Save, Pencil, X, ArrowUpAZ, ArrowDownZA } from 'lucide-react';
import {
  DEFAULT_ENTITY_SPORT,
  ENTITY_SPORT_OPTIONS,
} from '@/lib/sport/entitySportOptions';
import {
  emptySportDropdownCatalog,
  ensureSportParameters,
  nextItemColor,
  normalizeSportDropdownCatalog,
  pickLocalizedName,
  sportDropdownFlagSrc,
  sportDropdownLocaleLabel,
  SPORT_DROPDOWN_LOCALES,
  type SportDropdownCatalog,
  type SportDropdownItem,
  type SportDropdownParameter,
} from '@/lib/sport/sportDropdownParameters';

function adminAuthHeaders(): HeadersInit {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('adminToken') || localStorage.getItem('token')
      : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function cuid() {
  return `sdp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyNamesByLocale(): Record<string, string> {
  return Object.fromEntries(SPORT_DROPDOWN_LOCALES.map((l) => [l.code, '']));
}

/**
 * Super Admin → Sport settings → Tools Settings → Dropdown parameters for sport.
 * Per sport + language-country: options for TEAM / Team profile ** dropdowns.
 */
export default function SportDropdownParametersSettings() {
  const [catalog, setCatalog] = useState<SportDropdownCatalog>(emptySportDropdownCatalog());
  const [sport, setSport] = useState<string>(DEFAULT_ENTITY_SPORT);
  const [locale, setLocale] = useState<string>('eng');
  const [selectedParamKey, setSelectedParamKey] = useState<string>('federations');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SportDropdownItem | null>(null);
  const [modalNames, setModalNames] = useState<Record<string, string>>(emptyNamesByLocale);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/sport-dropdown-parameters', {
        headers: adminAuthHeaders(),
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === 'string' ? json.error : 'Failed to load catalog',
        );
      }
      setCatalog(normalizeSportDropdownCatalog(json.catalog));
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to load');
      setCatalog(emptySportDropdownCatalog());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const workingCatalog = useMemo(
    () => ensureSportParameters(catalog, sport),
    [catalog, sport],
  );

  const parameters = workingCatalog.bySport[sport]?.parameters ?? [];

  useEffect(() => {
    if (!parameters.some((p) => p.key === selectedParamKey) && parameters[0]) {
      setSelectedParamKey(parameters[0].key);
    }
  }, [parameters, selectedParamKey]);

  const selectedParam: SportDropdownParameter | undefined = parameters.find(
    (p) => p.key === selectedParamKey,
  );

  const sortedItems = useMemo(() => {
    if (!selectedParam) return [];
    return [...selectedParam.items].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [selectedParam]);

  const openAddModal = () => {
    setEditingItem(null);
    setModalNames(emptyNamesByLocale());
    setModalOpen(true);
  };

  const openEditModal = (item: SportDropdownItem) => {
    const names = emptyNamesByLocale();
    for (const loc of SPORT_DROPDOWN_LOCALES) {
      names[loc.code] = pickLocalizedName(item.nameByLanguage, loc.code);
    }
    setEditingItem(item);
    setModalNames(names);
    setModalOpen(true);
  };

  const persistCatalog = useCallback(
    async (nextCatalog: SportDropdownCatalog, okMessage = 'Saved.') => {
      setSaving(true);
      setMessage('');
      try {
        const toSave = ensureSportParameters(nextCatalog, sport);
        const patchRes = await fetch('/api/admin/sport-dropdown-parameters', {
          method: 'PUT',
          headers: {
            ...adminAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ catalog: toSave }),
        });
        const err = await patchRes.json().catch(() => ({}));
        if (!patchRes.ok) {
          throw new Error(
            typeof err.error === 'string' ? err.error : 'Failed to save dropdown catalog',
          );
        }
        setCatalog(normalizeSportDropdownCatalog(err.catalog ?? toSave));
        setMessage(okMessage);
      } catch (e: unknown) {
        setMessage(e instanceof Error ? e.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    },
    [sport],
  );

  const saveModalItem = () => {
    if (!selectedParam) return;
    const hasAny = Object.values(modalNames).some((v) => v.trim());
    if (!hasAny) {
      setMessage('Enter at least one language name before saving the option.');
      return;
    }

    const nameByLanguage: Record<string, string> = {};
    for (const [code, value] of Object.entries(modalNames)) {
      const trimmed = value.trim();
      if (trimmed) nameByLanguage[code] = trimmed;
    }
    for (const loc of SPORT_DROPDOWN_LOCALES) {
      const primary = nameByLanguage[loc.code];
      if (primary) {
        for (const alias of loc.aliases) {
          nameByLanguage[alias] = primary;
        }
      }
    }

    const base = ensureSportParameters(catalog, sport);
    const params = base.bySport[sport]?.parameters ?? [];
    let nextParams: SportDropdownParameter[];

    if (editingItem) {
      nextParams = params.map((p) =>
        p.id !== selectedParam.id
          ? p
          : {
              ...p,
              items: p.items.map((it) =>
                it.id === editingItem.id ? { ...it, nameByLanguage } : it,
              ),
            },
      );
    } else {
      const item: SportDropdownItem = {
        id: cuid(),
        nameByLanguage,
        sortOrder: selectedParam.items.length + 1,
        color: nextItemColor(selectedParam.items.length),
      };
      nextParams = params.map((p) =>
        p.id === selectedParam.id ? { ...p, items: [...p.items, item] } : p,
      );
    }

    const nextCatalog: SportDropdownCatalog = {
      ...base,
      bySport: {
        ...base.bySport,
        [sport]: { parameters: nextParams },
      },
    };
    setCatalog(nextCatalog);
    setModalOpen(false);
    setEditingItem(null);
    void persistCatalog(nextCatalog, 'Option saved.');
  };

  const removeItem = (itemId: string) => {
    if (!selectedParam) return;
    const base = ensureSportParameters(catalog, sport);
    const nextParams = (base.bySport[sport]?.parameters ?? []).map((p) =>
      p.id !== selectedParam.id
        ? p
        : { ...p, items: p.items.filter((it) => it.id !== itemId) },
    );
    const nextCatalog: SportDropdownCatalog = {
      ...base,
      bySport: {
        ...base.bySport,
        [sport]: { parameters: nextParams },
      },
    };
    setCatalog(nextCatalog);
    void persistCatalog(nextCatalog, 'Option removed.');
  };

  const handleSaveCatalog = async () => {
    await persistCatalog(catalog, 'Saved.');
  };

  const applySortedItems = (direction: 'asc' | 'desc') => {
    if (!selectedParam) return;
    const base = ensureSportParameters(catalog, sport);
    const params = base.bySport[sport]?.parameters ?? [];
    const sorted = [...selectedParam.items].sort((a, b) => {
      const la = pickLocalizedName(a.nameByLanguage, locale).toLocaleLowerCase();
      const lb = pickLocalizedName(b.nameByLanguage, locale).toLocaleLowerCase();
      const cmp = la.localeCompare(lb, undefined, { sensitivity: 'base', numeric: true });
      return direction === 'asc' ? cmp : -cmp;
    });
    const withOrder = sorted.map((it, index) => ({ ...it, sortOrder: index + 1 }));
    const nextParams = params.map((p) =>
      p.id === selectedParam.id ? { ...p, items: withOrder } : p,
    );
    const nextCatalog: SportDropdownCatalog = {
      ...base,
      bySport: {
        ...base.bySport,
        [sport]: { parameters: nextParams },
      },
    };
    setCatalog(nextCatalog);
    void persistCatalog(
      nextCatalog,
      direction === 'asc' ? 'Sorted A-Z.' : 'Sorted Z-A.',
    );
  };

  const paramTitle = selectedParam
    ? pickLocalizedName(selectedParam.labelByLanguage, locale, selectedParam.key)
    : '';

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading dropdown parameters…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-5">
        <h3 className="text-lg font-semibold text-gray-900">
          Dropdown parameters for sport
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Select a sport, then set each parameter&apos;s options for every language-country.
          Swim federation names can differ from Rugby; English (Great Britain) names can differ
          from French or Italian. These feed ** dropdowns by sport and language-country.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-gray-800">Sport</span>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="min-w-[14rem] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {ENTITY_SPORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-gray-800">
              Display in this language
            </span>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="min-w-[16rem] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              {SPORT_DROPDOWN_LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.displayCode} - {l.country}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveCatalog()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-gray-700">{message}</p> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
        {/* Left: parameters for selected sport */}
        <aside className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Parameters — {sport}
          </div>
          <ul className="max-h-[28rem] overflow-y-auto p-2">
            {parameters.map((param) => {
              const label = pickLocalizedName(
                param.labelByLanguage,
                locale,
                param.key,
              );
              const active = param.key === selectedParamKey;
              return (
                <li key={param.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedParamKey(param.key)}
                    className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      active
                        ? 'bg-amber-100 text-amber-950 ring-1 ring-amber-300'
                        : 'text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                    <span className="mt-0.5 block text-[11px] font-normal text-gray-500">
                      {param.items.length} option{param.items.length === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Right: options for selected parameter */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
            <h4 className="text-base font-semibold text-gray-900">
              {paramTitle ? `— ${paramTitle}` : 'Select a parameter'}
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!selectedParam || sortedItems.length < 2}
                onClick={() => applySortedItems('asc')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              >
                <ArrowUpAZ className="h-4 w-4" />
                A-Z
              </button>
              <button
                type="button"
                disabled={!selectedParam || sortedItems.length < 2}
                onClick={() => applySortedItems('desc')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              >
                <ArrowDownZA className="h-4 w-4" />
                Z-A
              </button>
              <button
                type="button"
                disabled={!selectedParam}
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add New
              </button>
            </div>
          </div>
          <div className="p-4">
            {!selectedParam ? (
              <p className="text-sm text-gray-500">Select a parameter on the left.</p>
            ) : sortedItems.length === 0 ? (
              <p className="text-sm text-gray-500">
                No options yet for <strong>{sport}</strong> / {paramTitle}. Click Add New to
                enter names for each language-country.
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedItems.map((item) => {
                  const label = pickLocalizedName(item.nameByLanguage, locale) || '—';
                  return (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color || '#3b82f6' }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="rounded p-1.5 text-gray-600 hover:bg-gray-100"
                        aria-label="Edit option"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="rounded p-1.5 text-red-600 hover:bg-red-50"
                        aria-label="Delete option"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {modalOpen && selectedParam ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sport-dropdown-item-modal-title"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h4
                id="sport-dropdown-item-modal-title"
                className="text-lg font-semibold text-gray-900"
              >
                Setting of &apos;{paramTitle}&apos;
              </h4>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2 pr-3 font-semibold">Lang</th>
                    <th className="pb-2 font-semibold">Name</th>
                  </tr>
                </thead>
                <tbody>
                  {SPORT_DROPDOWN_LOCALES.map((loc) => (
                    <tr key={loc.code} className="border-t border-gray-100">
                      <td className="py-2 pr-3 align-middle">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap font-medium text-gray-800">
                          <span className="relative h-5 w-7 overflow-hidden rounded-sm border border-gray-200">
                            <Image
                              src={sportDropdownFlagSrc(loc.code)}
                              alt=""
                              fill
                              sizes="28px"
                              className="object-cover"
                            />
                          </span>
                          {loc.displayCode} - {loc.country}
                        </span>
                      </td>
                      <td className="py-2 align-middle">
                        <input
                          type="text"
                          value={modalNames[loc.code] || ''}
                          onChange={(e) =>
                            setModalNames((prev) => ({
                              ...prev,
                              [loc.code]: e.target.value,
                            }))
                          }
                          placeholder={`Name (${sportDropdownLocaleLabel(loc.code)})`}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveModalItem}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
