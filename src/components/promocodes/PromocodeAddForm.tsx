'use client';
import Image from 'next/image';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Eye,
  FileText,
  Languages,
  Mail,
  RefreshCw,
  User,
} from 'lucide-react';
import type { PromocodeMeta, PromocodeSettingRow } from '@/lib/promocodes/types';
import { promocodesFetch } from './usePromocodesAdminAuth';
import { usePromocodeDialogs } from './usePromocodeDialogs';
import {
  mergePromocodeLanguageOptions,
  PROMOCODE_FORM_LANGUAGES,
} from '@/lib/promocodes/promocodeLanguages';
import { fetchGeneratedPromocode } from '@/lib/promocodes/generatePromocode';
import { markPromocodeListForRefresh } from '@/lib/promocodes/promocodeInviteEvents';
import './promocode-add.css';

const MONTHS: Record<string, string> = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
};

/** Same day list as PHP add.ctp (note: day 12 is omitted in legacy form). */
const DAYS: Record<string, string> = {
  '01': '01',
  '02': '02',
  '03': '03',
  '04': '04',
  '05': '05',
  '06': '06',
  '07': '07',
  '08': '08',
  '09': '09',
  '10': '10',
  '11': '11',
  '13': '13',
  '14': '14',
  '15': '15',
  '16': '16',
  '17': '17',
  '18': '18',
  '19': '19',
  '20': '20',
  '21': '21',
  '22': '22',
  '23': '23',
  '24': '24',
  '25': '25',
  '26': '26',
  '27': '27',
  '28': '28',
  '29': '29',
  '30': '30',
  '31': '31',
};

const DEFAULT_LANGUAGES = PROMOCODE_FORM_LANGUAGES;

function capitalizeFirstLetter(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function padDayMonth(value: number): string {
  return String(value).padStart(2, '0');
}

function getValidationError(form: {
  code: string;
  toDay: string;
  usableBy: string;
  discount: string;
  email: string;
  recipient: string;
}): string | null {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;

  if (form.email === '') {
    return 'Please enter email address for inviting';
  }

  const emailArray = form.email.split(',').map((email) => email.trim());
  if (emailArray.length > 1) {
    for (const email of emailArray) {
      if (!emailRegex.test(email)) {
        return 'Please enter valid address for inviting';
      }
    }
  } else if (!emailRegex.test(form.email)) {
    return 'Please enter valid address for inviting';
  }

  if (form.recipient === '') {
    return 'Please enter recipient for inviting';
  }

  if (form.code === '') {
    return 'Please enter promocode';
  }

  if (form.toDay === '') {
    return 'Please enter from date';
  }

  if (form.usableBy === '') {
    return 'Select usable by';
  }

  if (form.discount === '') {
    return 'Please enter disocunt';
  }

  if (parseInt(form.discount, 10) > 100) {
    return 'Please enter untill 100% disocunt';
  }

  return null;
}

function parseValidTo(validTo: string | null | undefined) {
  if (!validTo) return null;
  const [y, m, d] = validTo.split('-');
  return {
    toDay: d?.padStart(2, '0') ?? '01',
    toMonth: m?.padStart(2, '0') ?? '01',
    toYear: y ?? String(new Date().getFullYear()),
  };
}

function socialOptionsFromParsed(
  parsed: Record<string, unknown> | string[] | undefined
): string[] {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed.map(String);
  return Object.values(parsed).map(String).filter(Boolean);
}

function isLegacyCheckboxOn(value: string | null | undefined): boolean {
  return value === '1' || value === 'on' || value === 'Enable';
}

type PromocodeAddFormProps = {
  mode?: 'add' | 'edit';
  settingId?: number;
  initialSetting?: PromocodeSettingRow | null;
  initialSocialOptions?: Record<string, unknown> | string[];
};

export default function PromocodeAddForm({
  mode = 'add',
  settingId,
  initialSetting,
  initialSocialOptions,
}: PromocodeAddFormProps) {
  const isEdit = mode === 'edit';
  const router = useRouter();
  const { showAlert, dialogs } = usePromocodeDialogs();
  const now = useMemo(() => new Date(), []);
  const [meta, setMeta] = useState<PromocodeMeta | null>(null);
  const [code, setCode] = useState('');
  const [enable, setEnable] = useState(false);
  const [toDay, setToDay] = useState(padDayMonth(now.getDate()));
  const [toMonth, setToMonth] = useState(padDayMonth(now.getMonth() + 1));
  const [toYear, setToYear] = useState(String(now.getFullYear()));
  const [versionIds, setVersionIds] = useState<number[]>([]);
  const [discount, setDiscount] = useState('');
  const [usableBy, setUsableBy] = useState('');
  const [allowChildPromocodes, setAllowChildPromocodes] = useState(false);
  const [childPromoLimit, setChildPromoLimit] = useState('');
  const [childPromoUntil, setChildPromoUntil] = useState('');
  const [childVersionIds, setChildVersionIds] = useState<number[]>([]);
  const [childDurationDays, setChildDurationDays] = useState('');
  const [email, setEmail] = useState('');
  const [recipient, setRecipient] = useState('');
  const [helpHtmlPagesId, setHelpHtmlPagesId] = useState<number | ''>('');
  const [languageId, setLanguageId] = useState<number>(1);
  const [languageOptions, setLanguageOptions] = useState(DEFAULT_LANGUAGES);
  const [enableExtension, setEnableExtension] = useState(false);
  const [subscriptionExtends, setSubscriptionExtends] = useState('');
  const [socialOptions, setSocialOptions] = useState<string[]>([]);
  const [managementSection, setManagementSection] = useState('');
  const [enableFreeAccounts, setEnableFreeAccounts] = useState(false);
  const [basicVersion, setBasicVersion] = useState('');
  const [premiumVersion, setPremiumVersion] = useState('');
  const [professionalVersion, setProfessionalVersion] = useState('');
  const [saving, setSaving] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUrl1, setInviteUrl1] = useState('');
  const [inviteUrl2, setInviteUrl2] = useState('');
  const [hydrated, setHydrated] = useState(!isEdit);

  const years = useMemo(() => {
    const latestYear = now.getFullYear();
    const earliestYear = new Date(now.getTime() + 6000 * 24 * 60 * 60 * 1000).getFullYear();
    const list: string[] = [];
    for (let y = latestYear; y <= earliestYear; y++) list.push(String(y));
    return list;
  }, [now]);

  useEffect(() => {
    promocodesFetch('/api/admin/promocodes/meta')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to load form options');
        setMeta(json);
      })
      .catch((err) => {
        console.error(err);
        setMeta({ subscriptions: [], helpHtmlPages: [], languages: DEFAULT_LANGUAGES.map((l) => ({ id: l.id, name: l.value })) });
      });

    if (!isEdit) {
      fetchGeneratedPromocode()
        .then(setCode)
        .catch((err) => console.error('initial promocode:', err));
    }
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit || !initialSetting || hydrated) return;

    const dates = parseValidTo(initialSetting.validTo);
    if (dates) {
      setToDay(dates.toDay);
      setToMonth(dates.toMonth);
      setToYear(dates.toYear);
    }

    setCode(initialSetting.code ?? '');
    setEnable(initialSetting.enable === 'Enable');
    setVersionIds(
      initialSetting.versionId
        ? initialSetting.versionId.split(',').map((v) => Number(v)).filter((v) => Number.isFinite(v))
        : []
    );
    setDiscount(initialSetting.discount ?? '');
    setUsableBy(initialSetting.usableBy ?? '');
    setAllowChildPromocodes(Boolean(initialSetting.allowChildPromocodes));
    setChildPromoLimit(
      initialSetting.childPromoLimit != null ? String(initialSetting.childPromoLimit) : ''
    );
    setChildPromoUntil(initialSetting.childPromoUntil ?? '');
    setChildVersionIds(
      initialSetting.childVersionIds
        ? initialSetting.childVersionIds.split(',').map((v) => Number(v)).filter((n) => Number.isFinite(n))
        : []
    );
    setChildDurationDays(
      initialSetting.childDurationDays != null ? String(initialSetting.childDurationDays) : ''
    );
    setEmail(initialSetting.email ?? '');
    setRecipient(initialSetting.recipient ?? '');
    setHelpHtmlPagesId(initialSetting.helpHtmlPagesId ?? '');
    setLanguageId(initialSetting.languageId ?? 1);
    setEnableExtension(isLegacyCheckboxOn(initialSetting.enableExtension));
    setSubscriptionExtends(initialSetting.subscriptionExtends ?? '');
    setSocialOptions(socialOptionsFromParsed(initialSocialOptions));
    setManagementSection(initialSetting.managementSection ?? '');
    setEnableFreeAccounts(isLegacyCheckboxOn(initialSetting.enableFreeAccounts));
    setBasicVersion(initialSetting.basicVersion ?? '');
    setPremiumVersion(initialSetting.premiumVersion ?? '');
    setProfessionalVersion(initialSetting.professionalVersion ?? '');
    setHydrated(true);
  }, [isEdit, initialSetting, initialSocialOptions, hydrated]);

  const getLanguageList = useCallback(async (pageTitle: string, preferredLanguageId?: number) => {
    const res = await promocodesFetch('/api/admin/promocodes/language-list', {
      method: 'POST',
      body: JSON.stringify({ html_doc_title: pageTitle }),
    });
    const langs = await res.json();
    if (!Array.isArray(langs)) return;

    let options = langs.map((lang: { id: number | string; value?: string }) => ({
      id: Number(lang.id),
      value: capitalizeFirstLetter(String(lang.value ?? '')),
    }));

    if (
      preferredLanguageId != null &&
      Number.isFinite(preferredLanguageId) &&
      !options.some((opt) => opt.id === preferredLanguageId)
    ) {
      const fallback =
        DEFAULT_LANGUAGES.find((l) => l.id === preferredLanguageId)?.value ??
        meta?.languages.find((l) => l.id === preferredLanguageId)?.name ??
        `Lang ${preferredLanguageId}`;
      options = [...options, { id: preferredLanguageId, value: capitalizeFirstLetter(fallback) }].sort(
        (a, b) => a.id - b.id
      );
    }

    setLanguageOptions(options.length > 0 ? options : mergePromocodeLanguageOptions([]));
    if (preferredLanguageId != null && Number.isFinite(preferredLanguageId)) {
      setLanguageId(preferredLanguageId);
    }
  }, [meta]);

  useEffect(() => {
    if (!isEdit || !hydrated || !helpHtmlPagesId || !meta || !initialSetting) return;
    const page = meta.helpHtmlPages.find((p) => p.id === helpHtmlPagesId);
    if (page?.title) {
      void getLanguageList(page.title, initialSetting.languageId ?? undefined);
    }
  }, [isEdit, hydrated, helpHtmlPagesId, meta, initialSetting, getLanguageList]);

  const refreshCode = async () => {
    try {
      const nextCode = await fetchGeneratedPromocode();
      setCode(nextCode);
    } catch (err) {
      console.error('refreshCode:', err);
      showAlert(
        err instanceof Error ? err.message : 'Could not generate a new promocode.',
        'Notice'
      );
    }
  };

  const openPreview = () => {
    const page = meta?.helpHtmlPages.find((p) => p.id === helpHtmlPagesId);
    if (!page?.title) return;
    const lang = Number(languageId) > 0 ? Number(languageId) : 1;
    const params = new URLSearchParams({ language_id: String(lang) });
    window.open(
      `/users/htmlpage/${encodeURIComponent(page.title)}?${params.toString()}`,
      '_blank'
    );
  };

  const openInviteModal = () => {
    setInviteEmail(email);
    setInviteOpen(true);
  };

  const buildSendInvitePreviewUrl = (
    targetEmail: string,
    otherInfo: string,
    advPage: string
  ) => {
    const params = new URLSearchParams({
      email_address: targetEmail.trim(),
      promocode: code.trim(),
      other_info: otherInfo.trim(),
      adv_page: advPage.trim(),
      html_page_id: helpHtmlPagesId ? String(helpHtmlPagesId) : '',
      language_id: String(languageId || 1),
    });
    return `/promocodes/send-invite?${params.toString()}`;
  };

  const sendInviteMail = () => {
    if (!inviteEmail.trim()) {
      showAlert('Please enter an email address.', 'Validation');
      return;
    }
    if (!code.trim()) {
      showAlert('Promocode code is required.', 'Validation');
      return;
    }

    const popup = window.open(
      buildSendInvitePreviewUrl(inviteEmail, inviteUrl1, inviteUrl2),
      '_blank'
    );
    if (!popup) {
      showAlert('Please allow pop-ups for this site to open the invitation window.', 'Notice');
      return;
    }

    setInviteOpen(false);
  };

  const selectedVersionRows =
    meta?.subscriptions.filter((sub) => versionIds.includes(sub.id) && sub.name !== '') ?? [];

  const toggleSocialOption = (value: string, checked: boolean) => {
    setSocialOptions((prev) =>
      checked ? [...prev, value] : prev.filter((v) => v !== value)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationMessage = getValidationError({
      code,
      toDay,
      usableBy,
      discount,
      email,
      recipient,
    });
    if (validationMessage) {
      showAlert(validationMessage, 'Validation');
      return;
    }

    setSaving(true);
    setFlashMessage(null);
    try {
      const payload = {
        code,
        enable,
        toDay,
        toMonth,
        toYear,
        versionIds,
        discount,
        usableBy,
        allowChildPromocodes,
        childPromoLimit,
        childPromoUntil,
        childVersionIds,
        childDurationDays,
        enableExtension,
        subscriptionExtends,
        managementSection,
        socialOptions,
        enableFreeAccounts,
        basicVersion,
        premiumVersion,
        professionalVersion,
        helpHtmlPagesId: helpHtmlPagesId || null,
        languageId,
        email,
        recipient,
        creatorId: 1,
        ...(isEdit ? { id: settingId } : {}),
      };

      const res = await promocodesFetch('/api/admin/promocodes/settings', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      if (isEdit) {
        setFlashMessage('Promocode has been updated.');
        return;
      }

      const createdId = typeof data.id === 'number' ? data.id : Number(data.id);
      markPromocodeListForRefresh(Number.isFinite(createdId) ? createdId : undefined);

      window.setTimeout(() => {
        window.close();
        if (!window.closed) {
          router.push('/promocodes/promoList');
        }
      }, 50);
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'Save failed', 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="promocode-add-page promocode-form-page">
      <form id="filterForm" onSubmit={handleSubmit}>
        {flashMessage && <div className="flash-message">{flashMessage}</div>}

        <div className="clear" />
        <div className="blue_row1">Promocode settings</div>

        <div className="promo-code-content">
          <table>
            <tbody>
              <tr>
                <td>Promo code</td>
                <td colSpan={2}>
                  <input
                    id="promocodeCode"
                    type="text"
                    placeholder="Code"
                    className="code-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={isEdit}
                    readOnly={isEdit}
                  />
                  {!isEdit && (
                    <span
                      id="changeCode"
                      role="button"
                      tabIndex={0}
                      title="Change Code"
                      onClick={(e) => {
                        e.preventDefault();
                        void refreshCode();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void refreshCode();
                        }
                      }}
                      style={{ display: 'inline-block', cursor: 'pointer', verticalAlign: 'middle', marginLeft: 6 }}
                    >
                      <RefreshCw size={24} aria-hidden />
                    </span>
                  )}
                </td>
                <td valign="top">
                  <label>
                    <input
                      type="checkbox"
                      name="data[promocode][enable]"
                      checked={enable}
                      onChange={(e) => setEnable(e.target.checked)}
                    />{' '}
                    Enable
                  </label>
                </td>
              </tr>

              <tr className="promo-field-row">
                <td className="promo-field-label">Promocode will expire in this date</td>
                <td colSpan={3} className="promo-field-region">
                  <div className="promo-date-fields">
                    <div className="custom-select promo-date-select">
                      <select
                        id="from_day"
                        value={toDay}
                        onChange={(e) => setToDay(e.target.value)}
                      >
                        {Object.entries(DAYS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="custom-select promo-date-select">
                      <select
                        id="from_month"
                        value={toMonth}
                        onChange={(e) => setToMonth(e.target.value)}
                      >
                        {Object.entries(MONTHS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="custom-select promo-date-select">
                      <select
                        name="data[promocode][to_year]"
                        value={toYear}
                        onChange={(e) => setToYear(e.target.value)}
                      >
                        {years.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </td>
              </tr>

              <tr>
                <td>Versions</td>
                <td colSpan={3}>
                  <div style={{ background: '#fff' }}>
                    <div className="custom-select versions-scroll">
                      {!meta ? (
                        <div style={{ padding: 8, color: '#666' }}>Loading versions…</div>
                      ) : meta.subscriptions.filter((sub) => sub.name !== '').length === 0 ? (
                        <div style={{ padding: 8, color: '#666' }}>No subscription versions found.</div>
                      ) : isEdit ? (
                        selectedVersionRows.length === 0 ? (
                          <div style={{ padding: 8, color: '#666' }}>No versions selected.</div>
                        ) : (
                          selectedVersionRows.map((sub) => (
                            <div key={sub.id} style={{ height: 25 }}>
                              <label>
                                <input type="checkbox" checked disabled /> {sub.name}
                              </label>
                            </div>
                          ))
                        )
                      ) : (
                        meta.subscriptions
                          .filter((sub) => sub.name !== '')
                          .map((sub) => (
                            <div key={sub.id}>
                              <label>
                                <input
                                  type="checkbox"
                                  name="data[promocode][version_id][]"
                                  value={sub.id}
                                  checked={versionIds.includes(sub.id)}
                                  onChange={(e) => {
                                    setVersionIds((prev) =>
                                      e.target.checked
                                        ? [...prev, sub.id]
                                        : prev.filter((id) => id !== sub.id)
                                    );
                                  }}
                                />{' '}
                                {sub.name}
                              </label>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </td>
              </tr>

              <tr>
                <td>Discount</td>
                <td>
                  <input
                    id="promocodeDiscount"
                    type="text"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </td>
                <td colSpan={2}>%</td>
              </tr>

              <tr className="promo-field-row">
                <td className="promo-field-label">Usable by</td>
                <td colSpan={3} className="promo-field-region">
                  <div className="custom-select promo-field-full">
                    <select
                      id="usable_by"
                      value={usableBy}
                      onChange={(e) => setUsableBy(e.target.value)}
                    >
                      <option value="">--Select--</option>
                      <option value="Once">Once</option>
                      <option value="Always">Always</option>
                    </select>
                  </div>
                </td>
              </tr>

              <tr>
                <td colSpan={4} style={{ padding: '12px 8px' }}>
                  <label style={{ fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={allowChildPromocodes}
                      onChange={(e) => setAllowChildPromocodes(e.target.checked)}
                    />{' '}
                    Enable registered users with this promocode to create other promocodes
                  </label>
                  {allowChildPromocodes ? (
                    <div style={{ marginTop: 10, display: 'grid', gap: 8, maxWidth: 640 }}>
                      <label>
                        How many promocodes can be created
                        <input
                          type="number"
                          min={1}
                          value={childPromoLimit}
                          onChange={(e) => setChildPromoLimit(e.target.value)}
                          style={{ marginLeft: 8, width: 80 }}
                        />
                      </label>
                      <label>
                        Until what date they can create other promocodes
                        <input
                          type="date"
                          value={childPromoUntil}
                          onChange={(e) => setChildPromoUntil(e.target.value)}
                          style={{ marginLeft: 8 }}
                        />
                      </label>
                      <div>
                        Versions selectable by them
                        <div style={{ marginTop: 6 }}>
                          {(meta?.subscriptions ?? []).map((sub) => (
                            <label key={sub.id} style={{ display: 'block' }}>
                              <input
                                type="checkbox"
                                checked={childVersionIds.includes(sub.id)}
                                onChange={(e) => {
                                  setChildVersionIds((prev) =>
                                    e.target.checked
                                      ? [...prev, sub.id]
                                      : prev.filter((id) => id !== sub.id)
                                  );
                                }}
                              />{' '}
                              {sub.name}
                            </label>
                          ))}
                        </div>
                      </div>
                      <label>
                        Days of duration for registration with the created promocode
                        <input
                          type="number"
                          min={1}
                          value={childDurationDays}
                          onChange={(e) => setChildDurationDays(e.target.value)}
                          style={{ marginLeft: 8, width: 80 }}
                        />
                      </label>
                    </div>
                  ) : null}
                </td>
              </tr>

              <tr>
                <td colSpan={4}>
                  <div className="inviteregister">
                    <table>
                      <tbody>
                        <tr>
                          <td className="sr-icon">
                            <Mail size={18} aria-hidden />
                          </td>
                          <td className="invite">Invitation to register by email</td>
                          <td className="email">
                            <input
                              type="text"
                              placeholder="Sunilmeshram@gmail.com"
                              name="email"
                              id="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                            />
                          </td>
                          <td className="end-icon">
                            <Image src="/img/send-smgs.jpg" alt="" width={32} height={32} unoptimized />
                          </td>
                        </tr>
                        <tr>
                          <td className="sr-icon">
                            <User size={18} aria-hidden />
                          </td>
                          <td className="invite red">Expedition name</td>
                          <td className="email">
                            <input
                              type="text"
                              placeholder="Sunil"
                              name="recipient"
                              id="recipient"
                              value={recipient}
                              onChange={(e) => setRecipient(e.target.value)}
                            />
                          </td>
                          <td className="end-icon" />
                        </tr>
                        <tr>
                          <td className="sr-icon">
                            <FileText size={18} aria-hidden />
                          </td>
                          <td className="invite">Html document in attachment</td>
                          <td className="email attach">
                            <select
                              id="help_html_pages"
                              style={{ width: '100%' }}
                              value={helpHtmlPagesId}
                              onChange={(e) => {
                                const id = e.target.value ? Number(e.target.value) : '';
                                setHelpHtmlPagesId(id);
                                const page = meta?.helpHtmlPages.find((p) => p.id === id);
                                if (page?.title) void getLanguageList(page.title, languageId);
                              }}
                            >
                              <option value=""> </option>
                              {!meta ? (
                                <option value="" disabled>
                                  Loading documents…
                                </option>
                              ) : (
                                meta.helpHtmlPages.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.title}
                                  </option>
                                ))
                              )}
                            </select>
                          </td>
                          <td className="end-icon">
                            <button type="button" onClick={openPreview} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                              <Eye size={18} style={{ marginLeft: '30%' }} aria-hidden />
                            </button>
                          </td>
                        </tr>
                        <tr>
                          <td className="sr-icon">
                            <Languages size={18} aria-hidden />
                          </td>
                          <td className="invite">Language available</td>
                          <td className="email attach">
                            <select
                              id="language_section"
                              style={{ width: '100%' }}
                              value={languageId}
                              onChange={(e) => setLanguageId(Number(e.target.value))}
                            >
                              {languageOptions.map((lang) => (
                                <option key={lang.id} value={lang.id}>
                                  {lang.value}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td />
                        </tr>
                        <tr>
                          <td colSpan={4} className="text-xs text-gray-600 px-2 pb-2">
                            Invite opening text comes from{' '}
                            <a href="/settings/language" target="_blank" rel="noopener noreferrer" className="text-red-700 underline">
                              Language → Long text
                            </a>{' '}
                            (variable <code>dim</code>), plus the HTML document selected above. The same language is used in the invitation email.
                          </td>
                        </tr>
                        {isEdit && (
                          <tr>
                            <td colSpan={4}>
                              <div className="invite-send-row">
                                <button type="button" className="btn-red" onClick={openInviteModal}>
                                  <Mail size={16} aria-hidden style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                  Send mail invitation
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="purple_row1 yellow">
          Club settings
          <span className="font12">(Only for club versions)</span>
        </div>

        <div className="club-settings-block">
        <div className="pt-10 pb-5">
          <label>
            <input
              type="checkbox"
              name="data[promocode][enable_extension]"
              checked={enableExtension}
              onChange={(e) => setEnableExtension(e.target.checked)}
            />{' '}
            Enable extension
          </label>
        </div>

        <div className="pt-5 pb-5">
          After the expiration extends the subscription for{' '}
          <span className="inline-input">
            <input
              type="text"
              value={subscriptionExtends}
              onChange={(e) => setSubscriptionExtends(e.target.value)}
            />
          </span>{' '}
          days
        </div>

        <div className="pt-5 pb-10">
          <label>
            <input
              type="checkbox"
              name="data[promocode][social_options][]"
              value="S"
              id="promocodeSocialOptions1"
              checked={socialOptions.includes('S')}
              onChange={(e) => toggleSocialOption('S', e.target.checked)}
            />{' '}
            Social options &nbsp;&nbsp;
          </label>
          <label>
            <input
              type="checkbox"
              name="data[promocode][social_options][]"
              value="M"
              id="promocodeSocialOptions2"
              checked={socialOptions.includes('M')}
              onChange={(e) => toggleSocialOption('M', e.target.checked)}
            />{' '}
            Management &nbsp;&nbsp;
          </label>
          <label>
            <input
              type="checkbox"
              name="data[promocode][social_options][]"
              value="W"
              id="promocodeSocialOptions3"
              checked={socialOptions.includes('W')}
              onChange={(e) => toggleSocialOption('W', e.target.checked)}
            />{' '}
            Workout sections &nbsp;&nbsp;
          </label>
        </div>

        <div className="light_purple_row1"> Management sections</div>
        <div className="pt-5 pb-5">
          Insert members untill this progressive number{' '}
          <span className="inline-input">
            <input
              type="text"
              value={managementSection}
              onChange={(e) => setManagementSection(e.target.value)}
            />
          </span>
        </div>

        <div className="light_purple_row1"> Accounts for the sport section</div>
        <div className="pt-5 pb-5">
          <div className="col-10">
            <input
              type="checkbox"
              name="data[promocode][enable_free_accounts]"
              checked={enableFreeAccounts}
              onChange={(e) => setEnableFreeAccounts(e.target.checked)}
            />
          </div>
          <div className="col-90">
            <span className="red">Enable these free accounts</span>
            <br />
            <span className="font10">(Else free accounts as set in versions settings)</span>
          </div>
          <div className="clear" />
        </div>

        <div className="pt-5 pb-5">
          <div className="col-60">For basic version</div>
          <div className="col-20">
            <input type="text" value={basicVersion} onChange={(e) => setBasicVersion(e.target.value)} />
          </div>
          <div className="clear" />
        </div>

        <div className="pt-5 pb-5">
          <div className="col-60">for premium version</div>
          <div className="col-20">
            <input type="text" value={premiumVersion} onChange={(e) => setPremiumVersion(e.target.value)} />
          </div>
          <div className="clear" />
        </div>

        <div className="pt-5 pb-5">
          <div className="col-60">For professional version</div>
          <div className="col-20">
            <input
              type="text"
              value={professionalVersion}
              onChange={(e) => setProfessionalVersion(e.target.value)}
            />
          </div>
          <div className="clear" />
        </div>
        </div>

        <div className="promocode-form-actions mt-20 text-center">
          <button type="submit" className="btn-red" disabled={saving}>
            {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save' : 'Create promocode'}
          </button>
          <Link href="/promocodes/promoList" className="btn-gray">
            Cancel
          </Link>
        </div>
      </form>

      {inviteOpen && (
        <div className="promo-invite-modal-backdrop promo-invite-modal-backdrop--edit" role="dialog" aria-modal="true">
          <div className="promo-invite-modal">
            <div className="promo-invite-modal-header">
              Invite to become member
              <button
                type="button"
                className="promo-invite-modal-close"
                onClick={() => setInviteOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="promo-invite-modal-body">
              <label className="promo-invite-label">Put here the mail address to which send the code</label>
              <input
                type="text"
                className="promo-invite-input"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <label className="promo-invite-label">Other info you want send</label>
              <input
                type="text"
                className="promo-invite-input"
                placeholder="Paste here the URL"
                value={inviteUrl1}
                onChange={(e) => setInviteUrl1(e.target.value)}
              />
              <label className="promo-invite-label">Adv page</label>
              <input
                type="text"
                className="promo-invite-input"
                placeholder="Paste here the URL"
                value={inviteUrl2}
                onChange={(e) => setInviteUrl2(e.target.value)}
              />
              <div className="promo-invite-actions">
                <button type="button" className="btn-gray" onClick={sendInviteMail}>
                  Send an invite
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {dialogs}
    </div>
  );
}
