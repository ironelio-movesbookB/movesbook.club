'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { clubApiFetch } from '@/lib/club/servicePurchasesClient';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateSportLabel } from '@/lib/sport/sportI18n';
import {
  REGISTER_MEMBER_CATEGORIES,
  REGISTER_NON_MEMBER_CATEGORIES,
  formatYmd,
  registerCategoryLabel,
  type RegisterCategoryId,
  type RegisterSection,
} from '@/lib/club/clubStaffAdmin.constants';

type RegisterResponse = { workspace: { kind: 'club' | 'team'; name: string }; sections: RegisterSection[] };

const MEMBER_IDS = new Set<string>(REGISTER_MEMBER_CATEGORIES.map((c) => c.id));

/** The built-in PDF fonts only cover Latin-1, so non-Latin UI languages print the English headings. */
const LATIN_LANGUAGES = new Set(['en', 'it', 'es', 'fr', 'de', 'pt']);

export default function ClubRegisterMembers() {
  const { t, currentLanguage } = useLanguage();
  const [selected, setSelected] = useState<Set<RegisterCategoryId>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  /** Members and non-members are separate documents: picking one group clears the other. */
  const toggle = (id: RegisterCategoryId, checked: boolean) => {
    setSelected((prev) => {
      const isMemberGroup = MEMBER_IDS.has(id);
      const next = new Set([...prev].filter((value) => MEMBER_IDS.has(value) === isMemberGroup));
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const generate = async () => {
    if (selected.size === 0) {
      setError('Select at least one category.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await clubApiFetch<RegisterResponse>('/api/club/register-members', {
        method: 'POST',
        body: JSON.stringify({ categories: [...selected] }),
      });
      const total = data.sections.reduce((sum, s) => sum + s.people.length, 0);
      await downloadPdf(data, LATIN_LANGUAGES.has(currentLanguage) ? (text) => translateSportLabel(t, text) : (text) => text);
      setMessage(total === 0 ? 'The document was generated, but no person matches the selected categories.' : 'Document generated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate the document');
    } finally {
      setBusy(false);
    }
  };

  const checkbox = (id: RegisterCategoryId, label: string) => (
    <label key={id} className="flex items-center gap-2 text-sm text-gray-800">
      <input
        type="checkbox"
        checked={selected.has(id)}
        onChange={(e) => toggle(id, e.target.checked)}
        className="h-4 w-4 rounded border-gray-400"
      />
      {label}
    </label>
  );

  return (
    <div className="min-h-full bg-gray-50 p-4">
      <div className="mb-4 rounded-lg bg-white px-4 py-3 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Register of members and volunteers</h1>
        <p className="text-xs text-gray-500">Administration</p>
      </div>
      <div className="max-w-3xl rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-gray-900">Generate the register of members</h2>
        <p className="mt-1 text-sm text-gray-600">Select the categories to include in the document.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {REGISTER_MEMBER_CATEGORIES.map((c) => checkbox(c.id, c.label))}
        </div>

        <h2 className="mt-8 text-base font-bold text-gray-900">Or generate the document for</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {REGISTER_NON_MEMBER_CATEGORIES.map((c) => checkbox(c.id, c.label))}
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}

        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => void generate()}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-violet-700 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {busy ? 'Generating…' : 'Generate and download'}
        </button>
      </div>
    </div>
  );
}

async function downloadPdf(data: RegisterResponse, tr: (text: string) => string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const today = new Date().toISOString().slice(0, 10);
  const isMembers = data.sections.some((s) => MEMBER_IDS.has(s.id));
  const title = tr(isMembers ? 'Register of members' : 'Register of non-members and volunteers');

  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(11);
  doc.text(data.workspace.name, 14, 23);
  doc.setFontSize(9);
  doc.text(`${tr('Generated on')} ${formatYmd(today)}`, 14, 29);

  const head = [
    [
      '#',
      tr('Surname'),
      tr('Name'),
      tr('Tax code'),
      tr('Date of birth'),
      tr('Place of birth'),
      tr('Role'),
      tr('Member no.'),
      tr('Since'),
    ],
  ];

  let y = 36;
  for (const section of data.sections) {
    if (y > 180) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(12);
    doc.text(`${tr(registerCategoryLabel(section.id))} (${section.people.length})`, 14, y);
    autoTable(doc, {
      startY: y + 3,
      head,
      body:
        section.people.length > 0
          ? section.people.map((p, i) => [
              String(i + 1),
              p.surname,
              p.name,
              p.taxCode,
              formatYmd(p.birthDate),
              p.birthPlace,
              p.role ? tr(p.role) : '',
              p.memberNumber,
              formatYmd(p.since),
            ])
          : [[{ content: tr('Nobody in this category.'), colSpan: 9 }]],
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [91, 33, 182] },
      margin: { left: 14, right: 14 },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 10;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.text(`${page} / ${pages}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, {
      align: 'right',
    });
  }

  const slug = data.workspace.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'register';
  doc.save(`${isMembers ? 'register-members' : 'register-non-members'}-${slug}-${today}.pdf`);
}
