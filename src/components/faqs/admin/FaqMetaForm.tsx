'use client';

import { useEffect, useState } from 'react';
import {
  FAQ_DOC_TYPES,
  FAQ_SECTION_PAIRS,
  faqPairKey,
  faqPairLabel,
  type FaqDocType,
  type FaqPairDto,
} from '@/lib/faqs/faqConstants';
import { faqIconSrc, uploadFaqIcon } from '@/lib/faqs/faqClient';

export type FaqMetaValues = {
  code: string;
  pairs: FaqPairDto[];
  iconPath: string | null;
  docType: FaqDocType;
  url: string;
  title: string;
  subtitle: string;
};

export const EMPTY_FAQ_META: FaqMetaValues = {
  code: '',
  pairs: [],
  iconPath: null,
  docType: 'document',
  url: '',
  title: '',
  subtitle: '',
};

type Props = {
  initial?: FaqMetaValues;
  /** Receives the values with the icon already uploaded. Throw to show an error. */
  onSubmit: (values: FaqMetaValues) => Promise<void>;
  onCancel: () => void;
  compact?: boolean;
};

const labelCls = 'pt-1.5 text-right text-[15px] text-gray-700';
const inputCls =
  'w-full rounded-sm border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none';

/** Create a New FAQ / Edit Faq form. Section - SubSection is a single dropdown, as in PHP. */
export default function FaqMetaForm({ initial = EMPTY_FAQ_META, onSubmit, onCancel, compact }: Props) {
  const [values, setValues] = useState<FaqMetaValues>(() => ({ ...initial, pairs: initial.pairs.slice(0, 1) }));
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(faqIconSrc(initial.iconPath));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!iconFile) return;
    const objectUrl = URL.createObjectURL(iconFile);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [iconFile]);

  const set = <K extends keyof FaqMetaValues>(key: K, value: FaqMetaValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  /** Single Section - SubSection (dropdown, as in PHP); stored as a one-item `pairs` list. */
  const selectPair = (key: string) => {
    const pair = FAQ_SECTION_PAIRS.find((p) => faqPairKey(p.section, p.subsection) === key);
    setValues((v) => ({ ...v, pairs: pair ? [pair] : [] }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!values.code.trim()) return setError('Code is required');
    if (!values.pairs.length) return setError('Select a Section - SubSection');
    setSaving(true);
    try {
      const iconPath = iconFile ? await uploadFaqIcon(iconFile) : values.iconPath;
      await onSubmit({ ...values, iconPath });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  const selectedKey = values.pairs[0] ? faqPairKey(values.pairs[0].section, values.pairs[0].subsection) : '';

  return (
    <form onSubmit={submit}>
      <div className={`grid grid-cols-[150px_minmax(0,1fr)] gap-x-6 gap-y-3 ${compact ? '' : 'max-w-3xl'}`}>
        <label htmlFor="faq-code" className={labelCls}>Code</label>
        <input
          id="faq-code"
          className={`${inputCls} bg-[#e8f0fe]`}
          value={values.code}
          maxLength={100}
          onChange={(e) => set('code', e.target.value)}
        />

        <label htmlFor="faq-pair" className={labelCls}>Section - SubSection</label>
        <select
          id="faq-pair"
          className={inputCls}
          value={selectedKey}
          onChange={(e) => selectPair(e.target.value)}
        >
          <option value="">--Select option--</option>
          {FAQ_SECTION_PAIRS.map((p) => {
            const key = faqPairKey(p.section, p.subsection);
            return (
              <option key={key} value={key}>
                {faqPairLabel(p.section, p.subsection)}
              </option>
            );
          })}
        </select>

        <label htmlFor="faq-icon" className={labelCls}>Icon</label>
        <div className="flex flex-wrap items-start gap-4">
          <input
            id="faq-icon"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="text-sm"
            onChange={(e) => setIconFile(e.target.files?.[0] ?? null)}
          />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Icon preview" className="h-24 w-24 rounded border border-gray-200 object-contain" />
          ) : null}
        </div>

        <label htmlFor="faq-doctype" className={labelCls}>Doc Type</label>
        <select
          id="faq-doctype"
          className={inputCls}
          value={values.docType}
          onChange={(e) => set('docType', e.target.value as FaqDocType)}
        >
          {FAQ_DOC_TYPES.map((d) => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>

        <label htmlFor="faq-url" className={labelCls}>Enter Url</label>
        <input
          id="faq-url"
          className={inputCls}
          value={values.url}
          placeholder="https://movesbook.com"
          maxLength={1000}
          onChange={(e) => set('url', e.target.value)}
        />

        <label htmlFor="faq-title" className={labelCls}>Variable Title</label>
        <input
          id="faq-title"
          className={inputCls}
          value={values.title}
          placeholder="Mypagetitle"
          maxLength={500}
          onChange={(e) => set('title', e.target.value)}
        />

        <label htmlFor="faq-subtitle" className={labelCls}>Variable Subtitle</label>
        <input
          id="faq-subtitle"
          className={inputCls}
          value={values.subtitle}
          placeholder="Mypagesubtitle"
          maxLength={500}
          onChange={(e) => set('subtitle', e.target.value)}
        />
      </div>

      {error ? <p className="mt-3 text-center text-sm text-red-700">{error}</p> : null}

      <div className="mt-6 flex justify-center gap-5">
        <button
          type="submit"
          disabled={saving}
          className="rounded border border-red-800 bg-[#e53935] px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-red-800 bg-[#e53935] px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
