'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  normalizePaymentTypeValue,
  OTHERS_PAYMENT_OPTION,
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
}: Props) {
  const normalizedValue = normalizePaymentTypeValue(value) || value;
  const { defaults, others } = useMemo(
    () => splitPaymentMethodsForForm(defaultPaymentMethods),
    [defaultPaymentMethods],
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
      {defaults.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
      {others.length > 0 ? <option value={OTHERS_PAYMENT_OPTION}>Others</option> : null}
      {showOthers
        ? others.map((m) => (
            <option key={`other-${m.value}`} value={m.value}>
              {m.label}
            </option>
          ))
        : null}
    </select>
  );
}
