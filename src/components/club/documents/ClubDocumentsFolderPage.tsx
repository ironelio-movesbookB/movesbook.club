'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Copy,
  Eye,
  FilePlus2,
  FileText,
  Link2,
  Mail,
  Pencil,
  Share2,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import ShareModal from '@/components/ShareModal';
import PromocodeConfirmModal from '@/components/promocodes/PromocodeConfirmModal';
import { useClubWorkspace } from '@/contexts/ClubWorkspaceContext';
import { getAuthHeaders } from '@/lib/club/servicePurchasesClient';
import type { DocumentSourceKey } from '@/lib/club/clubDocumentsFolder';

type GenerateSource = {
  key: DocumentSourceKey;
  label: string;
  ready: boolean;
};

type FolderItem = {
  id: string;
  title: string;
  type: string;
  visible: boolean;
  editable: boolean;
  deletable: boolean;
  duplicatable: boolean;
  publicUrl: string;
  filePath?: string;
  fileName?: string;
  updatedAt?: string;
};

type AddMode = 'menu' | 'html' | 'pdf' | 'generate' | null;

export default function ClubDocumentsFolderPage() {
  const { selectedClubId } = useClubWorkspace();
  const [clubId, setClubId] = useState(selectedClubId || '');
  const [clubName, setClubName] = useState('');
  const [workspaceKind, setWorkspaceKind] = useState<'club' | 'team'>('club');
  const [canEdit, setCanEdit] = useState(false);
  const [pageShared, setPageShared] = useState(false);
  const [sharedPageUrl, setSharedPageUrl] = useState('');
  const [items, setItems] = useState<FolderItem[]>([]);
  const [generateSources, setGenerateSources] = useState<GenerateSource[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [newTitle, setNewTitle] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [selectedSources, setSelectedSources] = useState<DocumentSourceKey[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareTitle, setShareTitle] = useState('Share document');
  const [mailDoc, setMailDoc] = useState<FolderItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FolderItem | null>(null);
  const [linkTarget, setLinkTarget] = useState<{ title: string; url: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setClubId(selectedClubId || localStorage.getItem('selectedClub') || '');
  }, [selectedClubId]);

  const load = useCallback(async () => {
    if (!clubId) {
      setLoading(false);
      setError('Select a club first.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(clubId)}/documents-folder${qs}`,
        { headers: getAuthHeaders() },
      );
      const data = (await res.json()) as {
        error?: string;
        clubName?: string;
        workspaceKind?: 'club' | 'team';
        canEdit?: boolean;
        pageShared?: boolean;
        sharedPageUrl?: string;
        items?: FolderItem[];
        generateSources?: GenerateSource[];
      };
      if (!res.ok) throw new Error(data.error || 'Failed to load documents');
      setClubName(data.clubName || '');
      setWorkspaceKind(data.workspaceKind === 'team' ? 'team' : 'club');
      setCanEdit(Boolean(data.canEdit));
      setPageShared(Boolean(data.pageShared));
      setSharedPageUrl(data.sharedPageUrl || '');
      setItems(data.items || []);
      setGenerateSources(data.generateSources || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [clubId, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const entityWord = workspaceKind === 'team' ? 'Team' : 'Club';

  const absoluteUrl = useCallback((path: string) => {
    if (typeof window === 'undefined') return path;
    try {
      return new URL(path, window.location.origin).toString();
    } catch {
      return path;
    }
  }, []);

  const togglePageShared = async () => {
    if (!canEdit || !clubId) return;
    try {
      setBusy(true);
      setMessage('');
      const next = !pageShared;
      const res = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/documents-folder`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pageShared: next }),
      });
      const data = (await res.json()) as { error?: string; sharedPageUrl?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to update share');
      setPageShared(next);
      if (data.sharedPageUrl) setSharedPageUrl(data.sharedPageUrl);
      setMessage(
        next
          ? 'Shared ON — public page lists Visible documents only. Use “Open shared page” to verify.'
          : 'Shared OFF — public Documents page returns unavailable. Single-document Get links still work.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update share');
    } finally {
      setBusy(false);
    }
  };

  const toggleVisible = async (item: FolderItem) => {
    if (!canEdit || !clubId) return;
    try {
      setBusy(true);
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(clubId)}/documents-folder/${encodeURIComponent(item.id)}`,
        {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({ visible: !item.visible }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, visible: !row.visible } : row)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const duplicateDoc = async (item: FolderItem) => {
    if (!canEdit || !clubId) return;
    try {
      setBusy(true);
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(clubId)}/documents-folder/${encodeURIComponent(item.id)}?action=duplicate`,
        { method: 'PATCH', headers: getAuthHeaders() },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Duplicate failed');
      setMessage(`Duplicated “${item.title}”.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Duplicate failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteDoc = async (item: FolderItem) => {
    if (!canEdit || !clubId || !item.deletable) return;
    try {
      setBusy(true);
      const res = await fetch(
        `/api/clubs/${encodeURIComponent(clubId)}/documents-folder/${encodeURIComponent(item.id)}`,
        { method: 'DELETE', headers: getAuthHeaders() },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setMessage(`Deleted “${item.title}”.`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const openGetLink = (item: FolderItem) => {
    setLinkCopied(false);
    setLinkTarget({ title: item.title, url: absoluteUrl(item.publicUrl) });
  };

  const copyGetLink = async () => {
    if (!linkTarget) return;
    try {
      await navigator.clipboard.writeText(linkTarget.url);
      setLinkCopied(true);
      setMessage('Link copied to clipboard.');
    } catch {
      try {
        const input = document.getElementById(
          'documents-get-link-input',
        ) as HTMLInputElement | null;
        input?.select();
        document.execCommand('copy');
        setLinkCopied(true);
        setMessage('Link copied to clipboard.');
      } catch {
        setError('Could not copy. Select the link and copy manually.');
      }
    }
  };

  const openShare = (item: FolderItem) => {
    setShareTitle(item.title);
    setShareUrl(absoluteUrl(item.publicUrl));
    setShareOpen(true);
  };

  const createHtml = async () => {
    if (!canEdit || !clubId) return;
    const title = newTitle.trim();
    if (!title) {
      setError('Enter a document title.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      const res = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/documents-folder`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ mode: 'html', title }),
      });
      const data = (await res.json()) as { error?: string; document?: { id: string } };
      if (!res.ok) throw new Error(data.error || 'Create failed');
      setAddMode(null);
      setNewTitle('');
      setMessage('Document created. Opening editor…');
      if (data.document?.id) {
        window.location.href = `/club/documents-editor?clubId=${encodeURIComponent(clubId)}&docId=${encodeURIComponent(data.document.id)}`;
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const createPdf = async () => {
    if (!canEdit || !clubId || !pdfFile) {
      setError('Choose a PDF file.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      const form = new FormData();
      form.set('mode', 'pdf');
      form.set('file', pdfFile);
      if (newTitle.trim()) form.set('title', newTitle.trim());
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/documents-folder`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setAddMode(null);
      setNewTitle('');
      setPdfFile(null);
      setMessage('PDF uploaded.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const createGenerated = async () => {
    if (!canEdit || !clubId) return;
    if (selectedSources.length === 0) {
      setError('Select at least one section.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      const res = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/documents-folder`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          mode: 'generate',
          sourceKeys: selectedSources,
          title: newTitle.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; document?: { id: string } };
      if (!res.ok) throw new Error(data.error || 'Generate failed');
      setAddMode(null);
      setNewTitle('');
      setSelectedSources([]);
      setMessage('PDF generated and saved in the Documents folder.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setBusy(false);
    }
  };

  const editHref = useCallback(
    (item: FolderItem) => {
      if (!clubId) return '#';
      if (item.type === 'builtin-rules') {
        return `/club/documents-editor?clubId=${encodeURIComponent(clubId)}&tab=rules`;
      }
      if (item.type === 'builtin-privacy') {
        return `/club/documents-editor?clubId=${encodeURIComponent(clubId)}&tab=privacy-policy`;
      }
      return `/club/documents-editor?clubId=${encodeURIComponent(clubId)}&docId=${encodeURIComponent(item.id)}`;
    },
    [clubId],
  );

  const typeLabel = useMemo(
    () =>
      ({
        'builtin-rules': 'Rules',
        'builtin-privacy': 'Privacy',
        html: 'Document',
        pdf: 'PDF',
        generated: 'Generated',
      }) as Record<string, string>,
    [],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
      <section className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-gray-500">
                Club&apos;s management / General settings
              </p>
              <h1 className="mt-0.5 text-xl font-semibold text-gray-950">
                Documents useful
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Folder of documents useful for the {entityWord.toLowerCase()} and for users —
                Rules, Privacy Policy, PDFs, and generated reports
                {clubName ? (
                  <>
                    {' '}
                    · <span className="font-medium text-gray-800">{clubName}</span>
                  </>
                ) : null}
              </p>
            </div>
            {canEdit ? (
              <button
                type="button"
                onClick={() => {
                  setAddMode('menu');
                  setError('');
                  setNewTitle('');
                  setPdfFile(null);
                  setSelectedSources([]);
                }}
                className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-md bg-red-700 px-3 text-sm font-semibold uppercase tracking-wide text-white hover:bg-red-800"
              >
                <FilePlus2 className="h-4 w-4" />
                + Add document
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-0 border-b border-gray-200 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="text-sm font-medium text-gray-700">Public page</span>
            <button
              type="button"
              role="switch"
              aria-checked={pageShared}
              disabled={!canEdit || busy}
              onClick={() => void togglePageShared()}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                pageShared ? 'bg-teal-700' : 'bg-gray-300'
              }`}
              title="Turn the public Documents page on or off"
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                  pageShared ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span
              className={`text-sm font-semibold ${
                pageShared ? 'text-teal-800' : 'text-gray-500'
              }`}
            >
              {pageShared ? 'Shared' : 'Not shared'}
            </span>
            <span className="hidden text-sm text-gray-500 sm:inline">
              · Visible docs only on the public list
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-3 md:border-t-0 md:justify-end">
            {sharedPageUrl ? (
              <>
                <a
                  href={absoluteUrl(sharedPageUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Open page
                </a>
                <button
                  type="button"
                  disabled={!pageShared}
                  onClick={() => {
                    setShareTitle('Documents useful');
                    setShareUrl(absoluteUrl(sharedPageUrl));
                    setShareOpen(true);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title={
                    pageShared
                      ? 'Share the public Documents page'
                      : 'Turn Shared on before sharing the page'
                  }
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-3">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(searchInput.trim());
            }}
            placeholder="Search documents…"
            className="min-w-[200px] h-9 flex-1 rounded-md border border-gray-300 px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => setSearch(searchInput.trim())}
            className="inline-flex h-9 items-center rounded-md bg-gray-900 px-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Search
          </button>
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSearchInput('');
              }}
              className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="px-4 py-3">
          {message ? <p className="mb-3 text-sm text-teal-700">{message}</p> : null}
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          {loading ? (
            <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-gray-300">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-teal-800 text-white">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left">Title</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Type</th>
                <th className="border border-gray-300 px-3 py-2 text-center">Visible</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Options</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-gray-300 px-3 py-8 text-center text-gray-500">
                    No documents found.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="bg-white hover:bg-teal-50">
                    <td className="border border-gray-300 px-3 py-2 font-medium text-gray-900">
                      {item.title}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-gray-700">
                      {typeLabel[item.type] || item.type}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={item.visible}
                        disabled={!canEdit || busy}
                        onChange={() => void toggleVisible(item)}
                        title="Visible on the shared Documents page"
                        aria-label={`Visible: ${item.title}`}
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-1 text-gray-600">
                        <Link
                          href={item.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Preview"
                          className="rounded p-1.5 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {item.editable && canEdit ? (
                          <Link
                            href={editHref(item)}
                            title="Edit"
                            className="rounded p-1.5 hover:bg-teal-50 hover:text-teal-800"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        ) : null}
                        {item.filePath ? (
                          <a
                            href={item.filePath}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={item.fileName || undefined}
                            title={item.fileName ? `Download PDF: ${item.fileName}` : 'Download PDF'}
                            className="rounded p-1.5 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <FileText className="h-4 w-4" />
                          </a>
                        ) : null}
                        {canEdit && item.duplicatable ? (
                          <button
                            type="button"
                            title="Duplicate"
                            disabled={busy}
                            onClick={() => void duplicateDoc(item)}
                            className="rounded p-1.5 hover:bg-gray-100 disabled:opacity-40"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="Get link"
                          onClick={() => openGetLink(item)}
                          className="rounded p-1.5 hover:bg-gray-100"
                        >
                          <Link2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Share"
                          onClick={() => openShare(item)}
                          className="rounded p-1.5 hover:bg-gray-100"
                        >
                          <Share2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Send by mail"
                          onClick={() => {
                            setMailDoc(item);
                            setShareTitle(item.title);
                            setShareUrl(absoluteUrl(item.publicUrl));
                            setShareOpen(true);
                          }}
                          className="rounded p-1.5 hover:bg-gray-100"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                        {canEdit && item.deletable ? (
                          <button
                            type="button"
                            title="Delete"
                            disabled={busy}
                            onClick={() => setDeleteTarget(item)}
                            className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
              </tbody>
              </table>
            </div>
          )}

          {!canEdit ? (
            <p className="mt-3 text-sm text-amber-700">
              Only the {entityWord.toLowerCase()} admin can add or edit documents in this folder.
            </p>
          ) : null}
        </div>
      </section>

      {addMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {addMode === 'menu'
                  ? 'Add document'
                  : addMode === 'html'
                    ? 'New document'
                    : addMode === 'pdf'
                      ? 'Load a PDF'
                      : 'Generate a PDF automatically'}
              </h2>
              <button
                type="button"
                onClick={() => setAddMode(null)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {addMode === 'menu' ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setAddMode('html')}
                  className="flex w-full items-center gap-3 rounded border border-gray-300 px-3 py-3 text-left hover:bg-gray-50"
                >
                  <FileText className="h-5 w-5 text-red-700" />
                  <span>
                    <span className="block font-semibold text-gray-900">A — New document</span>
                    <span className="text-xs text-gray-600">
                      Type a title and edit content like Privacy Policy
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('pdf')}
                  className="flex w-full items-center gap-3 rounded border border-gray-300 px-3 py-3 text-left hover:bg-gray-50"
                >
                  <Upload className="h-5 w-5 text-red-700" />
                  <span>
                    <span className="block font-semibold text-gray-900">B — Load a PDF</span>
                    <span className="text-xs text-gray-600">Upload an existing PDF file</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('generate')}
                  className="flex w-full items-center gap-3 rounded border border-gray-300 px-3 py-3 text-left hover:bg-gray-50"
                >
                  <Wand2 className="h-5 w-5 text-red-700" />
                  <span>
                    <span className="block font-semibold text-gray-900">
                      C — Generate a PDF automatically
                    </span>
                    <span className="text-xs text-gray-600">
                      Build a downloadable PDF from Courses, services, staff, members, and more
                    </span>
                  </span>
                </button>
              </div>
            ) : null}

            {addMode === 'html' ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Title
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Document title"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddMode('menu')}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void createHtml()}
                    className="rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Create &amp; edit
                  </button>
                </div>
              </div>
            ) : null}

            {addMode === 'pdf' ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Title (optional)
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Defaults to file name"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  PDF file
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="mt-1 block w-full text-sm"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddMode('menu')}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={busy || !pdfFile}
                    onClick={() => void createPdf()}
                    className="rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Upload PDF
                  </button>
                </div>
              </div>
            ) : null}

            {addMode === 'generate' ? (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Title (optional)
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Defaults from selected sections"
                  />
                </label>
                <p className="text-xs text-gray-600">
                  Select one or more sections. The PDF is built from the related settings data (for
                  example Courses from typology subscription + list prices). An HTML preview is kept
                  for editing. Generated files stay in this Documents folder for sharing and future AI
                  use.
                </p>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded border border-gray-200 p-2">
                  {generateSources.map((src) => {
                    const checked = selectedSources.includes(src.key);
                    const disabled = !src.ready;
                    return (
                      <label
                        key={src.key}
                        className={`flex items-start gap-2 rounded px-2 py-1.5 ${
                          disabled
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          disabled={disabled || busy}
                          onChange={() =>
                            setSelectedSources((prev) =>
                              checked ? prev.filter((k) => k !== src.key) : [...prev, src.key],
                            )
                          }
                        />
                        <span className="text-sm text-gray-800">
                          {src.label}
                          {disabled ? ' (coming soon)' : ''}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddMode('menu')}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={busy || selectedSources.length === 0}
                    onClick={() => void createGenerated()}
                    className="rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Generate
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ShareModal
        open={shareOpen}
        onClose={() => {
          setShareOpen(false);
          setMailDoc(null);
        }}
        title={shareTitle}
        url={shareUrl}
        description={
          mailDoc
            ? `Document: ${mailDoc.title}`
            : 'Documents useful for the club and for users.'
        }
        hidePost
        showEmail
      />

      <PromocodeConfirmModal
        open={deleteTarget !== null}
        title="Delete document"
        message={
          deleteTarget
            ? `Delete “${deleteTarget.title}”? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        loading={busy}
        onClose={() => {
          if (!busy) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) void deleteDoc(deleteTarget);
        }}
      />

      {linkTarget ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="documents-get-link-title"
          onClick={() => setLinkTarget(null)}
        >
          <div
            className="w-full max-w-lg border border-gray-400 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-300 bg-[#7b0a26] px-4 py-3 text-lg font-semibold text-white">
              <h2 id="documents-get-link-title">Get link</h2>
            </div>
            <div className="space-y-3 px-4 py-5">
              <p className="text-sm text-gray-700">
                Share this link to open only{' '}
                <span className="font-semibold">{linkTarget.title}</span> (works in a private
                window, no login).
              </p>
              <input
                id="documents-get-link-input"
                readOnly
                value={linkTarget.url}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900"
              />
              {linkCopied ? (
                <p className="text-sm text-teal-700">Copied to clipboard.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setLinkTarget(null)}
                className="rounded border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-gray-200"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => void copyGetLink()}
                className="inline-flex items-center gap-2 rounded border border-gray-400 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
              <a
                href={linkTarget.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded border border-[#7b0a26] bg-[#7b0a26] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5c081d]"
              >
                <Eye className="h-4 w-4" />
                Open
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
