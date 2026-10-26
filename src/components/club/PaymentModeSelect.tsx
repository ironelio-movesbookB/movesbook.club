'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  normalizePaymentTypeValue,
  OTHERS_PAYMENT_OPTION,
  PAYMENT_TYPE_OPTIONS,
  splitPaymentMethodsForForm,
} from '@/lib/procedures/payModes';

type Props = {
  value: string;
  onChange: (value: string) => void;
  defaultPaymentMethods?: string[];
  disabled?: boolean;
  className?: string;
  id?: string;
  /** When true, include an empty "select" option. */
  allowEmpty?: boolean;
  /**
   * When set, the list is only these method values (the ones ticked for members).
   * Null keeps the usual defaults-plus-Others list.
   */
  allowedMethods?: string[] | null;
  extraOptions?: { value: string; label: string }[];
};

/**
 * Shows up to 5 tagged default methods, plus "Others" to reveal the rest.
 */
export default function PaymentModeSelect({
  value,
  onChange,
  defaultPaymentMethods,
  disabled,
  className,
  id,
  allowEmpty = true,
  allowedMethods,
  extraOptions = [],
}: Props) {
  const locked = Array.isArray(allowedMethods);
  const normalizedValue = locked ? value : normalizePaymentTypeValue(value) || value;
  const lockedOptions = useMemo(() => {
    if (!locked) return [];
    const allowed = new Set(allowedMethods);
    const known: { value: string; label: string }[] = PAYMENT_TYPE_OPTIONS.filter((option) =>
      allowed.has(option.value),
    ).map((option) => ({
      value: option.value,
      label: option.label,
    }));
    for (const extra of extraOptions) {
      if (!known.some((option) => option.value === extra.value)) known.push(extra);
    }
    return known;
  }, [locked, allowedMethods, extraOptions]);
  const { defaults, others } = useMemo(
    () => (locked ? { defaults: [], others: [] } : splitPaymentMethodsForForm(defaultPaymentMethods)),
    [defaultPaymentMethods, locked],
  );

  const valueInOthers = Boolean(
    normalizedValue && others.some((o) => o.value === normalizedValue),
  );
  const [showOthers, setShowOthers] = useState(valueInOthers);

  useEffect(() => {
    if (valueInOthers) setShowOthers(true);
  }, [valueInOthers]);

  const handleChange = (next: string) => {
    if (next === OTHERS_PAYMENT_OPTION) {
      setShowOthers(true);
      if (!valueInOthers) onChange('');
      return;
    }
    onChange(next);
  };

  const selectValue = normalizedValue
    ? normalizedValue
    : showOthers && others.length > 0
      ? OTHERS_PAYMENT_OPTION
      : '';

  return (
    <select
      id={id}
      disabled={disabled}
      className={className}
      value={selectValue}
      onChange={(e) => handleChange(e.target.value)}
    >
      {allowEmpty ? <option value="">select</option> : null}
      {locked
        ? lockedOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))
        : null}
      {!locked
        ? defaults.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))
        : null}
      {!locked && others.length > 0 ? <option value={OTHERS_PAYMENT_OPTION}>Others</option> : null}
      {!locked && showOthers
        ? others.map((m) => (
            <option key={`other-${m.value}`} value={m.value}>
              {m.label}
            </option>
          ))
        : null}
    </select>
  );
}
