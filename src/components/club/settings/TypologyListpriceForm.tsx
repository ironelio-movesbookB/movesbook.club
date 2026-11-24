'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import ClubSettingsTypologyTabs from '@/components/club/settings/ClubSettingsTypologyTabs';
import {
  createEmptyListpriceForm,
  type TypologyListpriceForm as FormState
} from '@/lib/clubTypologyListprice';
import {
  getRelatedListpriceFields,
  pickListpriceFieldErrors,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
  validateListpriceForm
} from '@/lib/clubTypologyListprice.validation';

const LIST_PATH = '/club/settings/typology_subscription/pricelist';

type Props = {
  mode: 'add' | 'edit';
  listpriceId?: string;
  initialTypologyId?: string;
};

export default function TypologyListpriceForm({ mode, listpriceId, initialTypologyId = '' }: Props) {
  const router = useRouter();
  const [typologies, setTypologies] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<FormState>(() => createEmptyListpriceForm(initialTypologyId));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const formRef = useRef(form);
  const touchedRef = useRef(touched);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    touchedRef.current = touched;
  }, [touched]);

  const syncValidation = useCallback((nextForm: FormState, fields: string[], nextTouched: Record<string, boolean>) => {
    const mergedFields = Array.from(
      new Set(fields.flatMap((field) => getRelatedListpriceFields(field)))
    );
    const picked = pickListpriceFieldErrors(nextForm, mergedFields, nextTouched);
    setFieldErrors((current) => {
      const next = { ...current };
      for (const field of mergedFields) {
        if (picked[field]) next[field] = picked[field];
        else delete next[field];
      }
      return next;
    });
  }, []);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    const field = String(key);
    const nextTouched = { ...touchedRef.current, [field]: true };
    touchedRef.current = nextTouched;
    setTouched(nextTouched);

    setForm((current) => {
      const nextForm = { ...current, [key]: value };
      formRef.current = nextForm;
      syncValidation(nextForm, getRelatedListpriceFields(field), nextTouched);
      return nextForm;
    });
  };

  const touchField = (field: string) => {
    const nextTouched = { ...touchedRef.current, [field]: true };
    touchedRef.current = nextTouched;
    setTouched(nextTouched);
    syncValidation(formRef.current, getRelatedListpriceFields(field), nextTouched);
  };

  const set = updateField;

  const setAccessLimitMode = (mode: 'number' | 'max') => {
    setForm((current) => {
      const nextForm = {
        ...current,
        saleNumberAccessStatus: mode === 'number',
        saleMaxNumberStatus: mode === 'max'
      };
      formRef.current = nextForm;
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (mode === 'number') {
          delete next.saleMaxNumber;
        } else {
          delete next.saleNumberAccess;
          delete next.saleRelatedDays;
        }
        return next;
      });
      if (mode === 'max') {
        syncValidation(nextForm, ['saleMaxNumber'], touchedRef.current);
      } else {
        syncValidation(nextForm, ['saleNumberAccess', 'saleRelatedDays'], touchedRef.current);
      }
      return nextForm;
    });
  };

  const accessLimitMode: 'number' | 'max' = form.saleMaxNumberStatus ? 'max' : 'number';
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const query =
          mode === 'edit' && listpriceId
            ? `?id=${encodeURIComponent(listpriceId)}`
            : '';
        const response = await fetch(`/api/club/settings/typology-listprice${query}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || 'Unable to load.');
        if (cancelled) return;
        setTypologies(Array.isArray(data.typologies) ? data.typologies : []);
        if (mode === 'edit' && data.listprice) {
          setForm({ ...createEmptyListpriceForm(), ...data.listprice });
        } else if (initialTypologyId) {
          setForm((c) => ({ ...c, typologyId: initialTypologyId }));
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Unable to load.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mode, listpriceId, initialTypologyId]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const allTouched = Object.keys(form).reduce<Record<string, boolean>>((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setTouched(allTouched);
    touchedRef.current = allTouched;

    const clientErrors = validateListpriceForm(form);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/club/settings/typology-listprice', {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(mode === 'edit' ? { id: listpriceId, ...form } : form)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (data?.fieldErrors) {
          setFieldErrors(data.fieldErrors);
          return;
        }
        throw new Error(data?.error || 'Save failed');
      }
      const q = form.typologyId ? `?typologyId=${encodeURIComponent(form.typologyId)}` : '';
      router.push(`${LIST_PATH}${q}`);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="p-6">
        <p className="text-red-600">{loadError}</p>
        <button type="button" onClick={() => router.push(LIST_PATH)} className="mt-4 text-sm font-semibold">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <section className="rounded-md border border-gray-200 bg-white shadow-sm">
        <ClubSettingsTypologyTabs listPriceTypologyId={form.typologyId || null} />
        <form onSubmit={onSubmit} className="divide-y divide-gray-200">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-4">
            <h1 className="text-xl font-semibold">
              {mode === 'edit' ? 'Modify list price' : 'Add list price'}
            </h1>
            <button
              type="button"
              onClick={() => router.push(LIST_PATH)}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>

          <div className="space-y-6 p-4">
            <Section title="Typology">
              <Field label="Typology" error={fieldErrors.typologyId}>
                <select
                  value={form.typologyId}
                  onChange={(e) => set('typologyId', e.target.value)}
                  onBlur={() => touchField('typologyId')}
                  className={inputClass(Boolean(fieldErrors.typologyId))}
                >
                  <option value="">Select</option>
                  {typologies.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.activeStatus}
                  onChange={(e) => set('activeStatus', e.target.checked)}
                />
                Active
              </label>
            </Section>

            <Section title="Name and cost">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name of subscription" error={fieldErrors.subscriptionName}>
                  <input
                    value={form.subscriptionName}
                    onChange={(e) => set('subscriptionName', e.target.value)}
                    onBlur={() => touchField('subscriptionName')}
                    className={inputClass(Boolean(fieldErrors.subscriptionName))}
                  />
                </Field>
                <Field label="Code (5 chars)" error={fieldErrors.searchKeyword}>
                  <input
                    maxLength={5}
                    value={form.searchKeyword}
                    onChange={(e) => set('searchKeyword', e.target.value)}
                    onBlur={() => touchField('searchKeyword')}
                    className={inputClass(Boolean(fieldErrors.searchKeyword))}
                  />
                </Field>
                <Field label="Cost" error={fieldErrors.cost}>
                  <input
                    inputMode="decimal"
                    value={form.cost}
                    onChange={(e) => set('cost', sanitizeDecimalInput(e.target.value))}
                    onBlur={() => touchField('cost')}
                    className={inputClass(Boolean(fieldErrors.cost))}
                  />
                </Field>
                <Field label="Discount (%)">
                  <input value={form.discount} onChange={(e) => set('discount', e.target.value)} className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm" />
                </Field>
                <Field label="Expiry date">
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => set('expiryDate', e.target.value)}
                    className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                  />
                </Field>
              </div>
            </Section>

            <Section title="Installments">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Installments" error={fieldErrors.installnment}>
                  <select
                    value={form.installnment}
                    onChange={(e) => set('installnment', e.target.value)}
                    onBlur={() => touchField('installnment')}
                    className={inputClass(Boolean(fieldErrors.installnment))}
                  >
                    {Array.from({ length: 9 }, (_, index) => {
                      const value = String(index + 1);
                      return (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      );
                    })}
                  </select>
                </Field>
                <Field label="1st installment cost" error={fieldErrors.firstCostInstallnment}>
                  <input
                    inputMode="decimal"
                    value={form.firstCostInstallnment}
                    onChange={(e) =>
                      set('firstCostInstallnment', sanitizeDecimalInput(e.target.value))
                    }
                    onBlur={() => touchField('firstCostInstallnment')}
                    className={inputClass(Boolean(fieldErrors.firstCostInstallnment))}
                  />
                </Field>
                <Field label="Days recursion" error={fieldErrors.daysRecursion}>
                  <input
                    inputMode="numeric"
                    value={form.daysRecursion}
                    onChange={(e) => set('daysRecursion', sanitizeIntegerInput(e.target.value))}
                    onBlur={() => touchField('daysRecursion')}
                    className={inputClass(Boolean(fieldErrors.daysRecursion))}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Conditions of sale">
              <div className="space-y-4">
                <Field label="Duration months">
                  <input
                    value={form.saleDurationMonths}
                    onChange={(e) => set('saleDurationMonths', e.target.value)}
                    className={inputClass(false)}
                  />
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <RadioAccessField
                    name="access-limit-mode"
                    label="Number of accesses"
                    checked={accessLimitMode === 'number'}
                    onSelect={() => setAccessLimitMode('number')}
                    error={fieldErrors.saleNumberAccess}
                  >
                    <input
                      inputMode="numeric"
                      value={form.saleNumberAccess}
                      onChange={(e) =>
                        set('saleNumberAccess', sanitizeIntegerInput(e.target.value))
                      }
                      onBlur={() => touchField('saleNumberAccess')}
                      disabled={accessLimitMode !== 'number'}
                      className={inputClass(
                        Boolean(fieldErrors.saleNumberAccess),
                        accessLimitMode !== 'number'
                      )}
                    />
                  </RadioAccessField>
                  <Field label="Related days" error={fieldErrors.saleRelatedDays}>
                    <input
                      inputMode="numeric"
                      value={form.saleRelatedDays}
                      onChange={(e) =>
                        set('saleRelatedDays', sanitizeIntegerInput(e.target.value))
                      }
                      onBlur={() => touchField('saleRelatedDays')}
                      disabled={accessLimitMode !== 'number'}
                      className={inputClass(
                        Boolean(fieldErrors.saleRelatedDays),
                        accessLimitMode !== 'number'
                      )}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <RadioAccessField
                    name="access-limit-mode"
                    label="Max accesses"
                    checked={accessLimitMode === 'max'}
                    onSelect={() => setAccessLimitMode('max')}
                    error={fieldErrors.saleMaxNumber}
                  >
                    <input
                      inputMode="numeric"
                      value={form.saleMaxNumber}
                      onChange={(e) => set('saleMaxNumber', sanitizeIntegerInput(e.target.value))}
                      onBlur={() => touchField('saleMaxNumber')}
                      disabled={accessLimitMode !== 'max'}
                      className={inputClass(Boolean(fieldErrors.saleMaxNumber), accessLimitMode !== 'max')}
                    />
                  </RadioAccessField>
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.conditionRenewalStatus}
                  onChange={(e) => set('conditionRenewalStatus', e.target.checked)}
                />
                Conditions for renewal
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.recursiveExpires}
                  onChange={(e) => set('recursiveExpires', e.target.checked)}
                />
                Recursive subscription
              </label>
            </Section>
          </div>

          <div className="flex justify-end gap-2 bg-gray-50 px-4 py-4">
            <button type="button" onClick={() => router.push(LIST_PATH)} className="rounded-md border px-4 py-2 text-sm font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function inputClass(hasError: boolean, disabled = false): string {
  return `h-10 w-full rounded-md border px-3 text-sm ${
    disabled
      ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500'
      : hasError
        ? 'border-red-500 focus:border-red-500'
        : 'border-gray-300'
  }`;
}

function RadioAccessField({
  name,
  label,
  checked,
  onSelect,
  error,
  children
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={onSelect}
          className="h-4 w-4 accent-gray-900"
        />
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && <Err msg={error} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 p-4">
      <h2 className="text-sm font-semibold uppercase text-gray-600">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <Err msg={error} />}
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return <p className="mt-1 text-sm text-red-600">{msg}</p>;
}
