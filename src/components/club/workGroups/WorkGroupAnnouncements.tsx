'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Paperclip, Send } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatSportText, translateSportLabel } from '@/lib/sport/sportI18n';
import {
  MAX_ANNOUNCEMENT_ATTACHMENT_BYTES,
  formatWorkGroupDate,
  type WorkGroupAnnouncement,
} from '@/lib/club/clubWorkGroup.constants';

type Props = { groupId: string; memberCount: number };

type Form = {
  title: string;
  message: string;
  sendMail: boolean;
  postToAccount: boolean;
  showAtLogin: boolean;
  enableFrom: string;
  enableTo: string;
};

const EMPTY: Form = {
  title: '',
  message: '',
  sendMail: true,
  postToAccount: true,
  showAtLogin: false,
  enableFrom: '',
  enableTo: '',
};

const inputClass = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function WorkGroupAnnouncements({ groupId, memberCount }: Props) {
  const { t } = useLanguage();
  const [items, setItems] = useState<WorkGroupAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clubApiFetch<{ items: WorkGroupAnnouncement[] }>(
        `/api/club/work-groups/${encodeURIComponent(groupId)}/announcements`,
      );
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (next: Partial<Form>) => setForm((f) => ({ ...f, ...next }));

  const send = async () => {
    setError('');
    setNotice('');
    if (!form.title.trim() || !form.message.trim()) {
      setError('Enter the title and the message');
      return;
    }
    if (!form.sendMail && !form.postToAccount) {
      setError('Choose to send the announcement by mail, post it in the member account, or both');
      return;
    }
    if (form.postToAccount && form.showAtLogin && (!form.enableFrom || !form.enableTo)) {
      setError('Enter the dates from and to for displaying the announcement at login');
      return;
    }
    if (file && file.size > MAX_ANNOUNCEMENT_ATTACHMENT_BYTES) {
      setError('The attachment cannot be larger than 2MB');
      return;
    }
    setSending(true);
    try {
      const attachment = file && form.sendMail ? { name: file.name, type: file.type, base64: await readBase64(file) } : null;
      const { announcement } = await clubApiFetch<{ announcement: WorkGroupAnnouncement & { mailFailed: number } }>(
        `/api/club/work-groups/${encodeURIComponent(groupId)}/announcements`,
        { method: 'POST', body: JSON.stringify({ ...form, attachment }) },
      );
      const parts: string[] = [];
      if (announcement.sendMail) parts.push(formatSportText(t, 'Emails sent: {0}', String(announcement.mailedCount)));
      if (announcement.postToAccount) parts.push(formatSportText(t, 'Posted in {0} member accounts', String(announcement.postedCount)));
      if (announcement.mailFailed > 0) parts.push(formatSportText(t, 'Emails not delivered: {0}', String(announcement.mailFailed)));
      setNotice(parts.join(' · '));
      setForm(EMPTY);
      setFile(null);
      setFileKey((k) => k + 1);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-600">
          Send an announcement to all the athletes of the group and to their parents by mail, and/or post it in their account.
        </p>
        {memberCount === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Add at least one athlete to the group first.</p>
        ) : null}
        <label className="block text-xs font-semibold text-gray-600">
          Announcement title <span>*</span>
          <input value={form.title} onChange={(e) => patch({ title: e.target.value })} className={inputClass} />
        </label>
        <label className="block text-xs font-semibold text-gray-600">
          Message <span>*</span>
          <textarea rows={6} value={form.message} onChange={(e) => patch({ message: e.target.value })} className={inputClass} />
        </label>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.sendMail}
              onChange={(e) => patch({ sendMail: e.target.checked })}
              className="h-4 w-4 accent-violet-700"
            />
            Send by mail (athletes and parents)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.postToAccount}
              onChange={(e) => patch({ postToAccount: e.target.checked, showAtLogin: e.target.checked && form.showAtLogin })}
              className="h-4 w-4 accent-violet-700"
            />
            Post in the member account (Alert posted)
          </label>
        </div>

        {form.postToAccount ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.showAtLogin}
                onChange={(e) => patch({ showAtLogin: e.target.checked })}
                className="h-4 w-4 accent-violet-700"
              />
              Display at login
            </label>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block text-xs font-semibold text-gray-600">
                Display from
                <input type="date" value={form.enableFrom} onChange={(e) => patch({ enableFrom: e.target.value })} className={inputClass} />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Display to
                <input type="date" value={form.enableTo} onChange={(e) => patch({ enableTo: e.target.value })} className={inputClass} />
              </label>
            </div>
          </div>
        ) : null}

        {form.sendMail ? (
          <label className="block text-xs font-semibold text-gray-600">
            Attachment (max 2MB)
            <input
              key={fileKey}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block text-sm text-gray-700"
            />
          </label>
        ) : null}

        {error ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{translateSportLabel(t, error)}</p> : null}
        {notice ? <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p> : null}

        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || memberCount === 0}
          className="inline-flex items-center gap-2 rounded-md bg-violet-700 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send the announcement
        </button>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Announcements sent</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">No announcements sent yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-gray-900" translate="no">
                    {a.title}
                  </span>
                  <span className="text-xs text-gray-500">{formatWorkGroupDate(a.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-700" translate="no">
                  {a.message}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  {a.sendMail ? (
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800">
                      {formatSportText(t, 'Emails sent: {0}', String(a.mailedCount))}
                    </span>
                  ) : null}
                  {a.postToAccount ? (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-800">
                      {formatSportText(t, 'Posted in {0} member accounts', String(a.postedCount))}
                    </span>
                  ) : null}
                  {a.showAtLogin ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">
                      {formatSportText(t, 'At login from {0} to {1}', formatWorkGroupDate(a.enableFrom), formatWorkGroupDate(a.enableTo))}
                    </span>
                  ) : null}
                  {a.attachmentName ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                      <Paperclip className="h-3 w-3" />
                      <span translate="no">{a.attachmentName}</span>
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
