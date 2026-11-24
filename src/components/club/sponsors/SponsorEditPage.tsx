'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ContractStatusBadge,
  PaymentsStatusBadge,
  dangerButton,
  formatYmd,
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
} from '@/components/club/sponsors/sponsorUi';
import {
  SPONSOR_SECTIONS,
  addDaysYmd,
  contractStatusOf,
  formatSponsorEuro,
  todayYmd,
  type Sponsor,
  type SponsorContract,
  type SponsorMediaKind,
  type SponsorPlacements,
  type SponsorProfile,
  type SponsorStats,
} from '@/lib/club/sponsors/sponsorConstants';
import { sponsorApi, sponsorReportPath } from '@/lib/club/sponsors/sponsorClient';

type Tab = 'profile' | 'contract' | 'payments' | 'media' | 'visibility' | 'stats';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'contract', label: 'Contract' },
  { key: 'payments', label: 'Payments' },
  { key: 'media', label: 'Banner & logo' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'stats', label: 'Statistics' },
];

const EMPTY_PROFILE: SponsorProfile = {
  name: '',
  visible: true,
  landingUrl: '',
  businessName: '',
  vatCode: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
};

type SponsorResponse = { sponsor: Sponsor };

export default function SponsorEditPage({ id }: { id: string }) {
  const isNew = id === 'new';
  const router = useRouter();
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [tab, setTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    sponsorApi<SponsorResponse>(`/${encodeURIComponent(id)}`)
      .then((d) => !cancelled && setSponsor(d.sponsor))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load the sponsor'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  /** Runs a sponsor request, stores the returned sponsor and shows the outcome. */
  const run = useCallback(
    async (path: string, init: RequestInit, done?: string): Promise<Sponsor | null> => {
      setError('');
      setNotice('');
      try {
        const data = await sponsorApi<SponsorResponse>(`/${encodeURIComponent(id)}${path}`, init);
        setSponsor(data.sponsor);
        if (done) setNotice(done);
        return data.sponsor;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Request failed');
        return null;
      }
    },
    [id],
  );

  const createSponsor = async (profile: SponsorProfile) => {
    setError('');
    try {
      const data = await sponsorApi<SponsorResponse>('', { method: 'POST', body: JSON.stringify({ profile }) });
      router.replace(`/clubs/marketing/sponsors/${data.sponsor.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the sponsor');
    }
  };

  const removeSponsor = async () => {
    if (!sponsor || !window.confirm(`Delete sponsor "${sponsor.name}" with its contracts, payments and statistics?`)) {
      return;
    }
    try {
      await sponsorApi(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
      router.push('/clubs/marketing/sponsors');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the sponsor');
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/clubs/marketing/sponsors" className="text-sm text-blue-700 hover:underline">
            ← All sponsors
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {isNew ? 'New sponsor' : sponsor?.name || 'Sponsor'}
          </h1>
          {sponsor ? (
            <div className="mt-1 flex flex-wrap gap-2">
              <ContractStatusBadge status={sponsor.contractStatus} />
              <PaymentsStatusBadge status={sponsor.paymentsStatus} />
              {!sponsor.visible ? (
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">Hidden</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {sponsor ? (
          <button type="button" className={dangerButton} onClick={removeSponsor}>
            Delete sponsor
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const disabled = isNew && t.key !== 'profile';
          return (
            <button
              key={t.key}
              type="button"
              disabled={disabled}
              onClick={() => {
                setTab(t.key);
                setNotice('');
                setError('');
              }}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
                tab === t.key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{notice}</div> : null}

      {loading ? (
        <div className="py-10 text-center text-gray-500">Loading…</div>
      ) : isNew ? (
        <ProfileTab initial={EMPTY_PROFILE} submitLabel="Create sponsor" onSubmit={createSponsor} />
      ) : !sponsor ? null : tab === 'profile' ? (
        <ProfileTab
          key={sponsor.updatedAt}
          initial={sponsor}
          submitLabel="Save profile"
          onSubmit={async (profile) => {
            await run('', { method: 'PATCH', body: JSON.stringify({ profile }) }, 'Profile saved');
          }}
        />
      ) : tab === 'contract' ? (
        <ContractTab sponsor={sponsor} run={run} />
      ) : tab === 'payments' ? (
        <PaymentsTab sponsor={sponsor} run={run} />
      ) : tab === 'media' ? (
        <MediaTab sponsor={sponsor} run={run} />
      ) : tab === 'visibility' ? (
        <VisibilityTab sponsor={sponsor} run={run} />
      ) : (
        <StatsTab sponsorId={sponsor.id} />
      )}
    </div>
  );
}

type RunFn = (path: string, init: RequestInit, done?: string) => Promise<Sponsor | null>;

function Card({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

// ---------- profile ----------

function ProfileTab({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: SponsorProfile;
  submitLabel: string;
  onSubmit: (profile: SponsorProfile) => Promise<void>;
}) {
  const [form, setForm] = useState<SponsorProfile>(() => ({
    name: initial.name,
    visible: initial.visible,
    landingUrl: initial.landingUrl,
    businessName: initial.businessName,
    vatCode: initial.vatCode,
    contactName: initial.contactName,
    email: initial.email,
    phone: initial.phone,
    address: initial.address,
  }));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SponsorProfile>(key: K, value: SponsorProfile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSubmit(form);
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card title="Sponsor">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Sponsor name *">
            <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </Field>
          <Field label="Visibility">
            <select
              className={inputClass}
              value={form.visible ? '1' : '0'}
              onChange={(e) => set('visible', e.target.value === '1')}
            >
              <option value="1">Visible</option>
              <option value="0">Hidden</option>
            </select>
          </Field>
          <Field label="Banner landing URL" className="md:col-span-2">
            <input
              className={inputClass}
              placeholder="https://www.sponsor-website.com"
              value={form.landingUrl}
              onChange={(e) => set('landingUrl', e.target.value)}
            />
            <span className="mt-1 block text-xs text-gray-500">Page opened when people click the logo or banner.</span>
          </Field>
        </div>
      </Card>

      <Card title="Company details">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Business name">
            <input className={inputClass} value={form.businessName} onChange={(e) => set('businessName', e.target.value)} />
          </Field>
          <Field label="VAT number / tax code">
            <input className={inputClass} value={form.vatCode} onChange={(e) => set('vatCode', e.target.value)} />
          </Field>
          <Field label="Contact person">
            <input className={inputClass} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputClass} value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={inputClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={form.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <button type="submit" className={primaryButton} disabled={saving || !form.name.trim()}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ---------- contracts ----------

type ContractForm = { startDate: string; endDate: string; value: string; reminderDays: string; notes: string };

function emptyContractForm(sponsor: Sponsor): ContractForm {
  const last = sponsor.contracts[0];
  const start = last && last.endDate >= todayYmd() ? addDaysYmd(last.endDate, 1) : todayYmd();
  return {
    startDate: start,
    endDate: addDaysYmd(addDaysYmd(start, 365), -1),
    value: last ? String(last.value) : '',
    reminderDays: last ? String(last.reminderDays) : '30',
    notes: '',
  };
}

function ContractTab({ sponsor, run }: { sponsor: Sponsor; run: RunFn }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContractForm>(() => emptyContractForm(sponsor));
  const [pdf, setPdf] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const rowPdfInput = useRef<HTMLInputElement>(null);
  const [pdfTarget, setPdfTarget] = useState<string | null>(null);

  const resetForm = (s: Sponsor) => {
    setEditingId(null);
    setForm(emptyContractForm(s));
    setPdf(null);
    if (pdfInput.current) pdfInput.current.value = '';
  };

  const uploadPdf = (contractId: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return run(`/contracts/${contractId}/pdf`, { method: 'POST', body }, 'Signed PDF uploaded');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = JSON.stringify({ ...form, value: Number(form.value) || 0, reminderDays: Number(form.reminderDays) || 0 });
    const before = new Set(sponsor.contracts.map((c) => c.id));
    const updated = editingId
      ? await run(`/contracts/${editingId}`, { method: 'PATCH', body: payload }, 'Contract saved')
      : await run('/contracts', { method: 'POST', body: payload }, 'Contract added');
    if (updated && pdf) {
      const targetId = editingId ?? updated.contracts.find((c) => !before.has(c.id))?.id;
      if (targetId) await uploadPdf(targetId, pdf);
    }
    if (updated) resetForm(updated);
    setSaving(false);
  };

  const edit = (c: SponsorContract) => {
    setEditingId(c.id);
    setForm({
      startDate: c.startDate,
      endDate: c.endDate,
      value: String(c.value),
      reminderDays: String(c.reminderDays),
      notes: c.notes,
    });
  };

  const current = sponsor.currentContract;

  return (
    <div className="space-y-4">
      {current ? (
        <Card title="Current contract" actions={<ContractStatusBadge status={sponsor.contractStatus} />}>
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <Info label="Start" value={formatYmd(current.startDate)} />
            <Info label="End" value={formatYmd(current.endDate)} />
            <Info label="Value" value={formatSponsorEuro(current.value)} />
            <Info
              label="Expiry reminder"
              value={current.reminderDays > 0 ? `${current.reminderDays} days before` : 'Off'}
            />
          </div>
        </Card>
      ) : null}

      <form onSubmit={submit}>
        <Card
          title={editingId ? 'Edit contract' : sponsor.contracts.length ? 'Renew contract' : 'New contract'}
          actions={
            editingId ? (
              <button type="button" className={secondaryButton} onClick={() => resetForm(sponsor)}>
                Cancel editing
              </button>
            ) : null
          }
        >
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Start date *">
              <input
                type="date"
                className={inputClass}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </Field>
            <Field label="End date *">
              <input
                type="date"
                className={inputClass}
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
            </Field>
            <Field label="Value (€)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </Field>
            <Field label="Expiry reminder (days before)">
              <input
                type="number"
                min="0"
                max="365"
                className={inputClass}
                value={form.reminderDays}
                onChange={(e) => setForm({ ...form, reminderDays: e.target.value })}
              />
            </Field>
            <Field label="Notes" className="md:col-span-3">
              <input className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Field label="Signed contract (PDF)">
              <input
                ref={pdfInput}
                type="file"
                accept="application/pdf,.pdf"
                className="block w-full text-sm"
                onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
              />
            </Field>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            The club admin receives an email when the reminder date is reached.
          </p>
          <div className="mt-4 flex justify-end">
            <button type="submit" className={primaryButton} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save contract' : 'Add contract'}
            </button>
          </div>
        </Card>
      </form>

      <Card title="Contract history">
        <input
          ref={rowPdfInput}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file && pdfTarget) await uploadPdf(pdfTarget, file);
            e.target.value = '';
            setPdfTarget(null);
          }}
        />
        {sponsor.contracts.length === 0 ? (
          <p className="text-sm text-gray-500">No contracts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Period</th>
                  <th className="py-2 pr-3">Value</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Signed PDF</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sponsor.contracts.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-3">
                      {formatYmd(c.startDate)} – {formatYmd(c.endDate)}
                      {c.notes ? <div className="text-xs text-gray-500">{c.notes}</div> : null}
                    </td>
                    <td className="py-2 pr-3">{formatSponsorEuro(c.value)}</td>
                    <td className="py-2 pr-3">
                      <ContractStatusBadge status={contractStatusOf(c)} />
                    </td>
                    <td className="py-2 pr-3">
                      {c.pdfUrl ? (
                        <div className="flex items-center gap-2">
                          <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                            {c.pdfName || 'contract.pdf'}
                          </a>
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline"
                            onClick={() =>
                              window.confirm('Remove the signed PDF?') &&
                              run(`/contracts/${c.id}/pdf`, { method: 'DELETE' }, 'PDF removed')
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="text-blue-700 hover:underline"
                          onClick={() => {
                            setPdfTarget(c.id);
                            rowPdfInput.current?.click();
                          }}
                        >
                          Upload PDF
                        </button>
                      )}
                    </td>
                    <td className="space-x-2 whitespace-nowrap py-2 text-right">
                      <button type="button" className={secondaryButton} onClick={() => edit(c)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={dangerButton}
                        onClick={() =>
                          window.confirm('Delete this contract?') &&
                          run(`/contracts/${c.id}`, { method: 'DELETE' }, 'Contract deleted')
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  );
}

// ---------- payments ----------

function PaymentsTab({ sponsor, run }: { sponsor: Sponsor; run: RunFn }) {
  const [form, setForm] = useState({ amount: '', dueDate: todayYmd(), reminderDays: '7', note: '' });
  const [saving, setSaving] = useState(false);
  const today = todayYmd();
  const paid = sponsor.payments.filter((p) => p.paidAt).reduce((s, p) => s + p.amount, 0);
  const due = sponsor.payments.filter((p) => !p.paidAt).reduce((s, p) => s + p.amount, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await run(
      '/payments',
      {
        method: 'POST',
        body: JSON.stringify({ ...form, amount: Number(form.amount) || 0, reminderDays: Number(form.reminderDays) || 0 }),
      },
      'Payment added',
    );
    if (ok) setForm({ amount: '', dueDate: form.dueDate, reminderDays: form.reminderDays, note: '' });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SmallStat label="Contract value" value={formatSponsorEuro(sponsor.currentContract?.value ?? 0)} />
        <SmallStat label="Collected" value={formatSponsorEuro(paid)} tone="text-green-700" />
        <SmallStat label="To collect" value={formatSponsorEuro(due)} tone={due > 0 ? 'text-amber-600' : undefined} />
      </div>

      <form onSubmit={submit}>
        <Card title="New payment tranche">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Amount (€) *">
              <input
                type="number"
                min="0.01"
                step="0.01"
                className={inputClass}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </Field>
            <Field label="Due date *">
              <input
                type="date"
                className={inputClass}
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                required
              />
            </Field>
            <Field label="Reminder (days before)">
              <input
                type="number"
                min="0"
                max="365"
                className={inputClass}
                value={form.reminderDays}
                onChange={(e) => setForm({ ...form, reminderDays: e.target.value })}
              />
            </Field>
            <Field label="Note">
              <input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" className={primaryButton} disabled={saving}>
              {saving ? 'Saving…' : 'Add payment'}
            </button>
          </div>
        </Card>
      </form>

      <Card title="Payment tranches">
        {sponsor.payments.length === 0 ? (
          <p className="text-sm text-gray-500">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Due date</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Note</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sponsor.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3">
                      {formatYmd(p.dueDate)}
                      {p.reminderDays > 0 && !p.paidAt ? (
                        <div className="text-xs text-gray-500">Reminder {p.reminderDays} days before</div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 font-semibold">{formatSponsorEuro(p.amount)}</td>
                    <td className="py-2 pr-3 text-gray-600">{p.note || '—'}</td>
                    <td className="py-2 pr-3">
                      {p.paidAt ? (
                        <span className="font-semibold text-green-700">Paid on {formatYmd(p.paidAt)}</span>
                      ) : p.dueDate < today ? (
                        <span className="font-semibold text-red-700">Overdue</span>
                      ) : (
                        <span className="font-semibold text-blue-700">Pending</span>
                      )}
                    </td>
                    <td className="space-x-2 whitespace-nowrap py-2 text-right">
                      <button
                        type="button"
                        className={secondaryButton}
                        onClick={() =>
                          run(
                            `/payments/${p.id}`,
                            { method: 'PATCH', body: JSON.stringify({ paid: !p.paidAt }) },
                            p.paidAt ? 'Payment marked as not paid' : 'Payment marked as paid',
                          )
                        }
                      >
                        {p.paidAt ? 'Mark as not paid' : 'Mark as paid'}
                      </button>
                      <button
                        type="button"
                        className={dangerButton}
                        onClick={() =>
                          window.confirm('Delete this payment?') &&
                          run(`/payments/${p.id}`, { method: 'DELETE' }, 'Payment deleted')
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SmallStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tone ?? 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

// ---------- media ----------

function MediaTab({ sponsor, run }: { sponsor: Sponsor; run: RunFn }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MediaCard
        sponsor={sponsor}
        run={run}
        kind="banner"
        title="Dedicated banner"
        hint="Wide image (recommended 1200 × 300 px). JPG, PNG, WEBP or GIF, max 5MB."
        url={sponsor.bannerUrl}
      />
      <MediaCard
        sponsor={sponsor}
        run={run}
        kind="logo"
        title="Logo"
        hint="Square image (recommended 400 × 400 px). JPG, PNG, WEBP or GIF, max 5MB."
        url={sponsor.logoUrl}
      />
    </div>
  );
}

function MediaCard({
  run,
  kind,
  title,
  hint,
  url,
}: {
  sponsor: Sponsor;
  run: RunFn;
  kind: SponsorMediaKind;
  title: string;
  hint: string;
  url: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    const body = new FormData();
    body.append('kind', kind);
    body.append('file', file);
    await run('/media', { method: 'POST', body }, `${title} uploaded`);
    setBusy(false);
  };

  return (
    <Card title={title}>
      <div
        className={`flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 ${
          kind === 'banner' ? 'aspect-[4/1]' : 'mx-auto aspect-square w-40'
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className="h-full w-full object-contain" />
        ) : (
          <span className="text-sm text-gray-400">No image</span>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">{hint}</p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = '';
        }}
      />
      <div className="mt-3 flex gap-2">
        <button type="button" className={primaryButton} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
        </button>
        {url ? (
          <button
            type="button"
            className={dangerButton}
            disabled={busy}
            onClick={() =>
              window.confirm(`Remove the ${kind}?`) && run(`/media?kind=${kind}`, { method: 'DELETE' }, `${title} removed`)
            }
          >
            Remove
          </button>
        ) : null}
      </div>
    </Card>
  );
}

// ---------- visibility ----------

function VisibilityTab({ sponsor, run }: { sponsor: Sponsor; run: RunFn }) {
  const [placements, setPlacements] = useState<SponsorPlacements>(sponsor.placements);
  const [saving, setSaving] = useState(false);
  const missing = (['logo', 'banner'] as const).filter(
    (k) => Object.values(placements).includes(k) && !(k === 'logo' ? sponsor.logoUrl : sponsor.bannerUrl),
  );

  const save = async () => {
    setSaving(true);
    await run('', { method: 'PATCH', body: JSON.stringify({ placements }) }, 'Visibility saved');
    setSaving(false);
  };

  return (
    <Card
      title="Where the sponsor is shown"
      actions={
        <button type="button" className={primaryButton} disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save visibility'}
        </button>
      }
    >
      <p className="mb-3 text-sm text-gray-600">
        For each section choose whether to show the sponsor logo, the banner, or nothing.
      </p>
      {missing.length ? (
        <div className="mb-3 rounded-md bg-amber-50 p-2 text-sm text-amber-800">
          Upload the {missing.join(' and ')} in the &quot;Banner &amp; logo&quot; tab, otherwise it can&apos;t be shown.
        </div>
      ) : null}
      {!sponsor.visible ? (
        <div className="mb-3 rounded-md bg-gray-100 p-2 text-sm text-gray-700">
          This sponsor is hidden: it won&apos;t be shown anywhere until you set it to visible in the Profile tab.
        </div>
      ) : null}
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {SPONSOR_SECTIONS.map((s) => {
          const value = placements[s.key] ?? 'off';
          return (
            <div key={s.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="text-sm font-medium text-gray-800">{s.label}</span>
              <div className="flex gap-4 text-sm">
                {(['off', 'logo', 'banner'] as const).map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name={`placement-${s.key}`}
                      checked={value === opt}
                      onChange={() =>
                        setPlacements((prev) => {
                          const next = { ...prev };
                          if (opt === 'off') delete next[s.key];
                          else next[s.key] = opt;
                          return next;
                        })
                      }
                    />
                    {opt === 'off' ? 'Off' : opt === 'logo' ? 'Logo' : 'Banner'}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------- statistics ----------

const SECTION_LABEL = new Map<string, string>(SPONSOR_SECTIONS.map((s) => [s.key, s.label]));

function StatsTab({ sponsorId }: { sponsorId: string }) {
  const [to, setTo] = useState(todayYmd());
  const [from, setFrom] = useState(addDaysYmd(todayYmd(), -30));
  const [stats, setStats] = useState<SponsorStats | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await sponsorApi<{ stats: SponsorStats; reportToken: string }>(
        `/${encodeURIComponent(sponsorId)}/stats?from=${from}&to=${to}`,
      );
      setStats(data.stats);
      setToken(data.reportToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the statistics');
    }
  }, [sponsorId, from, to]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sponsorId]);

  const reportUrl = () =>
    token ? `${window.location.origin}${sponsorReportPath(token)}?from=${from}&to=${to}` : '';

  const copy = async () => {
    const url = reportUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy the link', url);
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Banner performance"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButton}
              disabled={!token}
              onClick={() => window.open(reportUrl(), '_blank', 'noopener')}
            >
              Generate report
            </button>
            <button type="button" className={secondaryButton} disabled={!token} onClick={copy}>
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <button type="button" className={secondaryButton} onClick={() => void load()}>
            Update
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          The report link can be shared with the sponsor: it shows the numbers for the selected period without logging in.
        </p>
      </Card>

      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {stats ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <SmallStat label="Views" value={stats.views.toLocaleString()} />
            <SmallStat label="Clicks" value={stats.clicks.toLocaleString()} />
            <SmallStat label="CTR" value={`${stats.ctr.toFixed(2)}%`} />
            <SmallStat label="Active sources" value={String(stats.activeSources)} />
          </div>
          <Card title="By section">
            {stats.bySection.length === 0 ? (
              <p className="text-sm text-gray-500">No views or clicks in this period.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Section</th>
                    <th className="py-2 pr-3 text-right">Views</th>
                    <th className="py-2 pr-3 text-right">Clicks</th>
                    <th className="py-2 text-right">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.bySection.map((r) => (
                    <tr key={r.section}>
                      <td className="py-2 pr-3">{SECTION_LABEL.get(r.section) ?? (r.section || 'Club presentation')}</td>
                      <td className="py-2 pr-3 text-right">{r.views.toLocaleString()}</td>
                      <td className="py-2 pr-3 text-right">{r.clicks.toLocaleString()}</td>
                      <td className="py-2 text-right">
                        {r.views > 0 ? `${((r.clicks / r.views) * 100).toFixed(2)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
