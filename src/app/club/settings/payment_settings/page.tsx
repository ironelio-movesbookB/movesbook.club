'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import {
  PAYMENT_LABEL_MAX,
  type PaymentFrequentSettings,
  type PaymentLabelItem,
  type PaymentVatRule,
} from '@/lib/club/paymentFrequentSettings';

const API_PATH = '/api/club/settings/payment-settings';

const EMPTY: PaymentFrequentSettings = {
  progressiveNumber: 1,
  objects: [],
  causals: [],
  defaultObjectId: null,
  defaultCausalId: null,
  vatRules: [],
};

function newId(): string {
  return crypto.randomUUID();
}

export default function PaymentSettingsPage() {
  const [settings, setSettings] = useState<PaymentFrequentSettings>(EMPTY);
  const [saved, setSaved] = useState<PaymentFrequentSettings>(EMPTY);
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objectDraft, setObjectDraft] = useState('');
  const [causalDraft, setCausalDraft] = useState('');
  const [percentDraft, setPercentDraft] = useState('0');
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await clubApiFetch<{ settings: PaymentFrequentSettings; clubName?: string }>(API_PATH, {
          signal: controller.signal,
        });
        const loaded = data.settings ?? EMPTY;
        setSettings(loaded);
        setSaved(loaded);
        setClubName(data.clubName ?? '');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unable to load payment settings.');
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const persist = async (next: PaymentFrequentSettings) => {
    setSaving(true);
    setError(null);
    setFieldError(null);
    try {
      const data = await clubApiFetch<{ settings: PaymentFrequentSettings }>(API_PATH, {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      setSettings(data.settings);
      setSaved(data.settings);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save payment settings.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveProgressive = (raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      setFieldError('Enter a progressive payment number.');
      return;
    }
    void persist({ ...settings, progressiveNumber: value });
  };

  const addLabel = (
    kind: 'objects' | 'causals',
    draft: string,
    clear: () => void,
  ) => {
    const name = draft.trim();
    if (!name) {
      setFieldError(kind === 'objects' ? 'Write the object name.' : 'Write the causal name.');
      return;
    }
    if (name.length > PAYMENT_LABEL_MAX) {
      setFieldError(`Use ${PAYMENT_LABEL_MAX} characters or fewer.`);
      return;
    }
    const list = settings[kind];
    if (list.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setFieldError(kind === 'objects' ? 'This object is already in the list.' : 'This causal is already in the list.');
      return;
    }
    const item: PaymentLabelItem = { id: newId(), name };
    const nextList = [...list, item];
    const next: PaymentFrequentSettings =
      kind === 'objects'
        ? {
            ...settings,
            objects: nextList,
            defaultObjectId: settings.defaultObjectId ?? item.id,
          }
        : {
            ...settings,
            causals: nextList,
            defaultCausalId: settings.defaultCausalId ?? item.id,
          };
    void persist(next).then((ok) => {
      if (ok) clear();
    });
  };

  const renameLabel = (kind: 'objects' | 'causals', id: string, name: string, commit: boolean) => {
    const list = settings[kind];
    const current = list.find((item) => item.id === id);
    if (!current) return;
    const typed = name.slice(0, PAYMENT_LABEL_MAX);
    const nextList = list.map((item) => (item.id === id ? { ...item, name: typed } : item));
    const draft = kind === 'objects' ? { ...settings, objects: nextList } : { ...settings, causals: nextList };
    if (!commit) {
      setSettings(draft);
      return;
    }
    const trimmed = typed.trim();
    const original = saved[kind].find((item) => item.id === id)?.name ?? current.name;
    if (!trimmed) {
      setFieldError(kind === 'objects' ? 'Write the object name.' : 'Write the causal name.');
      const restored = list.map((item) => (item.id === id ? { ...item, name: original } : item));
      setSettings(kind === 'objects' ? { ...settings, objects: restored } : { ...settings, causals: restored });
      return;
    }
    if (list.some((item) => item.id !== id && item.name.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setFieldError(kind === 'objects' ? 'This object is already in the list.' : 'This causal is already in the list.');
      const restored = list.map((item) => (item.id === id ? { ...item, name: original } : item));
      setSettings(kind === 'objects' ? { ...settings, objects: restored } : { ...settings, causals: restored });
      return;
    }
    if (trimmed === original) {
      const cleaned = nextList.map((item) => (item.id === id ? { ...item, name: trimmed } : item));
      setSettings(kind === 'objects' ? { ...settings, objects: cleaned } : { ...settings, causals: cleaned });
      return;
    }
    const committed = nextList.map((item) => (item.id === id ? { ...item, name: trimmed } : item));
    void persist(kind === 'objects' ? { ...settings, objects: committed } : { ...settings, causals: committed });
  };

  const removeLabel = (kind: 'objects' | 'causals', id: string) => {
    if (kind === 'objects') {
      const objects = settings.objects.filter((item) => item.id !== id);
      void persist({
        ...settings,
        objects,
        defaultObjectId: settings.defaultObjectId === id ? objects[0]?.id ?? null : settings.defaultObjectId,
      });
      return;
    }
    const causals = settings.causals.filter((item) => item.id !== id);
    void persist({
      ...settings,
      causals,
      defaultCausalId: settings.defaultCausalId === id ? causals[0]?.id ?? null : settings.defaultCausalId,
    });
  };

  const setDefault = (kind: 'objects' | 'causals', id: string) => {
    void persist(
      kind === 'objects' ? { ...settings, defaultObjectId: id } : { ...settings, defaultCausalId: id },
    );
  };

  const addVatRule = (event: FormEvent) => {
    event.preventDefault();
    const percent = Number(percentDraft);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setFieldError('Enter a percent from 0 to 100.');
      return;
    }
    const rule: PaymentVatRule = { id: newId(), percent };
    void persist({ ...settings, vatRules: [...settings.vatRules, rule] }).then((ok) => {
      if (ok) setPercentDraft('0');
    });
  };

  const updateVatRule = (id: string, raw: string) => {
    const percent = Number(raw);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setFieldError('Enter a percent from 0 to 100.');
      return;
    }
    void persist({
      ...settings,
      vatRules: settings.vatRules.map((rule) => (rule.id === id ? { ...rule, percent } : rule)),
    });
  };

  return (
    <div className="min-h-full bg-[#f7f7f8] p-4 lg:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">Payment settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Club Management / General settings{clubName ? ` · ${clubName}` : ''}
          </p>
        </div>

        {(error || fieldError) && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || fieldError}
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading payment settings
          </div>
        ) : (
          <>
            <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">Reserved for payments</h2>
              <label className="mt-4 block text-sm font-medium text-gray-800" htmlFor="progressive-number">
                Progressive payment number
              </label>
              <input
                id="progressive-number"
                type="number"
                min={0}
                value={settings.progressiveNumber}
                disabled={saving}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    progressiveNumber: Number(event.target.value),
                  }))
                }
                onBlur={(event) => saveProgressive(event.target.value)}
                className="mt-2 w-28 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-600"
              />
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                The progressive number is increased automatically every time a payment is generated.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                You can also create a list of customized objects and causals to preselect during the
                creation of payments and the related receipts.
              </p>
            </section>

            <LabelCard
              title="Objects management"
              listTitle="Custom objects list"
              addTitle="Add customized objects"
              placeholder="Write your customized object here (max 30 characters)"
              remember="Remember that the first customized object will be the default."
              createLabel="Create object"
              emptyLabel="No objects yet."
              items={settings.objects}
              defaultId={settings.defaultObjectId}
              draft={objectDraft}
              saving={saving}
              onDraft={setObjectDraft}
              onCreate={() => addLabel('objects', objectDraft, () => setObjectDraft(''))}
              onRename={(id, name, commit) => renameLabel('objects', id, name, commit)}
              onRemove={(id) => removeLabel('objects', id)}
              onDefault={(id) => setDefault('objects', id)}
            />

            <LabelCard
              title="Causals management"
              listTitle="Custom causals list"
              addTitle="Add customized causals"
              placeholder="Write your customized causal here (max 30 characters)"
              remember="Remember that the first customized causal will be the default."
              createLabel="Create causal"
              emptyLabel="No causals yet."
              items={settings.causals}
              defaultId={settings.defaultCausalId}
              draft={causalDraft}
              saving={saving}
              onDraft={setCausalDraft}
              onCreate={() => addLabel('causals', causalDraft, () => setCausalDraft(''))}
              onRename={(id, name, commit) => renameLabel('causals', id, name, commit)}
              onRemove={(id) => removeLabel('causals', id)}
              onDefault={(id) => setDefault('causals', id)}
            />

            <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-[11rem_1fr]">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Rules</h2>
                <p className="mt-1 text-sm text-gray-500">for payments with VAT</p>
              </div>
              <div>
                <p className="text-sm leading-relaxed text-gray-700">
                  All operations with the different methods and applied bands (the different VAT rates,
                  tax deductions, etc.).
                </p>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  You can set exemption rules that apply to payments made with VAT. Each rule defines the
                  discount percent based on the amount paid in the same transaction.
                </p>
                <form onSubmit={addVatRule} className="mt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
                  >
                    Add VAT exemption rule
                  </button>
                  <label className="mt-4 block text-sm font-medium text-gray-800" htmlFor="vat-percent">
                    Percent
                  </label>
                  <input
                    id="vat-percent"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={percentDraft}
                    disabled={saving}
                    onChange={(event) => setPercentDraft(event.target.value)}
                    className="mt-2 w-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-700"
                  />
                </form>
                <ul className="mt-4 space-y-2">
                  {settings.vatRules.map((rule) => (
                    <li key={rule.id} className="flex flex-wrap items-center gap-3">
                      <span className="text-sm text-gray-600">Percent</span>
                      <input
                        key={`${rule.id}-${rule.percent}`}
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        defaultValue={rule.percent}
                        disabled={saving}
                        aria-label={`VAT exemption ${rule.percent}%`}
                        onBlur={(event) => {
                          if (Number(event.target.value) !== rule.percent) {
                            updateVatRule(rule.id, event.target.value);
                          }
                        }}
                        className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-violet-700"
                      />
                      <span className="text-sm font-medium text-gray-800">{rule.percent}%</span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void persist({
                            ...settings,
                            vatRules: settings.vatRules.filter((item) => item.id !== rule.id),
                          })
                        }
                        className="ml-auto rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        )}
        {saving && (
          <p className="text-xs text-gray-500">Saving…</p>
        )}
      </div>
    </div>
  );
}

function LabelCard({
  title,
  listTitle,
  addTitle,
  placeholder,
  remember,
  createLabel,
  emptyLabel,
  items,
  defaultId,
  draft,
  saving,
  onDraft,
  onCreate,
  onRename,
  onRemove,
  onDefault,
}: {
  title: string;
  listTitle: string;
  addTitle: string;
  placeholder: string;
  remember: string;
  createLabel: string;
  emptyLabel: string;
  items: PaymentLabelItem[];
  defaultId: string | null;
  draft: string;
  saving: boolean;
  onDraft: (value: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string, commit: boolean) => void;
  onRemove: (id: string) => void;
  onDefault: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="mt-4 text-sm font-medium text-gray-800">{listTitle}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => {
            const selected = (defaultId ?? items[0]?.id) === item.id;
            return (
              <li key={item.id} className="flex items-center gap-3">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Use ${item.name || `item ${index + 1}`} as the default`}
                  disabled={saving}
                  onClick={() => onDefault(item.id)}
                  className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                    selected ? 'border-rose-500 bg-rose-500' : 'border-rose-300 bg-white'
                  }`}
                />
                <input
                  value={item.name}
                  maxLength={PAYMENT_LABEL_MAX}
                  disabled={saving}
                  aria-label={`${listTitle} ${index + 1}`}
                  onChange={(event) => onRename(item.id, event.target.value, false)}
                  onBlur={(event) => onRename(item.id, event.target.value, true)}
                  className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-emerald-600"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onRemove(item.id)}
                  className="shrink-0 text-sm text-gray-500 hover:text-red-600 disabled:opacity-60"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate();
        }}
      >
        <p className="text-sm font-medium text-gray-800">{addTitle}</p>
        <input
          value={draft}
          maxLength={PAYMENT_LABEL_MAX}
          disabled={saving}
          onChange={(event) => onDraft(event.target.value)}
          placeholder={placeholder}
          aria-label={addTitle}
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-emerald-600"
        />
        <p className="mt-2 text-xs text-gray-500">{remember}</p>
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {createLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
