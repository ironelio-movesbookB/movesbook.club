'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Copy, Loader2, MoveHorizontal, X } from 'lucide-react';
import { authFetch, type PackageService, type PackageTableRow } from './types';
import StatusToast, { type Toast } from './StatusToast';

type TableResponse = { services: PackageService[]; packages: PackageTableRow[] };

type Props = {
  /** Authenticated club view (editable column order + Get link) or public shared view. */
  mode: 'club' | 'shared';
  fromPricelistId?: string | null;
  shareData?: string;
  shareToken?: string;
};

/** "All subscription packages" table. Legacy: clubsetting_subscription_packages.ctp */
export default function SubscriptionPackagesTable({ mode, fromPricelistId, shareData, shareToken }: Props) {
  const editable = mode === 'club';
  const [services, setServices] = useState<PackageService[]>([]);
  const [packages, setPackages] = useState<PackageTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePackageId, setActivePackageId] = useState<string | null>(null);
  const [popupService, setPopupService] = useState<{ service: PackageService; top: number; left: number } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    let cancelled = false;
    const request =
      mode === 'shared'
        ? fetch(
            `/api/public/shared-subscription-packages?data=${encodeURIComponent(shareData ?? '')}&token=${encodeURIComponent(shareToken ?? '')}`
          ).then(async (r) => {
            const body = await r.json().catch(() => null);
            if (!r.ok) throw new Error(body?.error || 'Invalid or expired link.');
            return body as TableResponse;
          })
        : authFetch<TableResponse>('/api/club/settings/subscription-packages');
    request
      .then((data) => {
        if (cancelled) return;
        setServices(data.services ?? []);
        setPackages(data.packages ?? []);
      })
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : 'Unable to load.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mode, shareData, shareToken]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPopupService(null);
      setImageUrl(null);
      setVideoUrl(null);
      setShareLink(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const currency = services.find((s) => s.currencyCode)?.currencyCode || 'EUR';
  const activePackage = packages.find((p) => p.id === activePackageId) ?? null;

  const handleColumnDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const previous = services;
    const oldIndex = services.findIndex((s) => s.id === active.id);
    const newIndex = services.findIndex((s) => s.id === over.id);
    const next = arrayMove(services, oldIndex, newIndex);
    setServices(next);
    setReordering(true);
    try {
      const response = await authFetch<{ count?: number }>('/api/club/settings/subscription-packages', {
        method: 'PUT',
        body: JSON.stringify({ serviceOrders: next.map((s, index) => ({ id: s.id, orderPosition: index + 1 })) })
      });
      const count = response.count ?? 0;
      setToast({
        type: 'success',
        message: `Service order updated successfully (${count} ${count === 1 ? 'service' : 'services'})`
      });
    } catch {
      setServices(previous);
      setToast({ type: 'error', message: 'Failed to update order. Changes reverted.' });
    } finally {
      setReordering(false);
    }
  };

  const generateLink = async () => {
    setToast({ type: 'info', message: 'Generating shareable link...' });
    try {
      const response = await authFetch<{ link: string }>('/api/club/settings/subscription-packages', {
        method: 'POST',
        body: JSON.stringify({ action: 'share-link' })
      });
      setShareLink(response.link);
      setToast({ type: 'success', message: 'Shareable link generated' });
    } catch (e) {
      setToast({ type: 'error', message: e instanceof Error ? `Error generating link: ${e.message}` : 'Error generating link' });
    }
  };

  const openServicePopup = (event: React.MouseEvent<HTMLElement>, service: PackageService) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const panelWidth = 320;
    let left = rect.right + 10;
    if (left + panelWidth > window.innerWidth) left = Math.max(8, rect.left - panelWidth - 10);
    setPopupService({ service, top: Math.max(8, rect.top - 80), left });
  };

  return (
    <div className="p-4 lg:p-6">
      <StatusToast toast={toast} onClose={() => setToast(null)} />
      <section className="rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-md bg-[#0060c0] px-4 py-2 text-sm font-bold text-white">
          <span>Subscription Packages</span>
          {editable && (
            <span className="flex items-center gap-5">
              <button type="button" onClick={generateLink} className="hover:underline">
                Get link
              </button>
              {fromPricelistId && (
                <Link
                  href={`/club/settings/typology_subscription/pricelist/package/${encodeURIComponent(fromPricelistId)}`}
                  className="hover:underline"
                >
                  Return
                </Link>
              )}
            </span>
          )}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            </div>
          ) : loadError ? (
            <p className="py-10 text-center text-red-600">{loadError}</p>
          ) : services.length === 0 ? (
            <p className="py-10 text-center text-gray-500">No special services available.</p>
          ) : (
            <div className={`overflow-x-auto ${reordering ? 'pointer-events-none opacity-70' : ''}`}>
              <div className="max-h-[700px] overflow-y-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
                      <SortableContext items={services.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
                        <tr className="bg-gray-100">
                          <th className="min-w-[150px] border border-gray-300 px-3 py-3 text-center font-bold text-red-600">
                            Services
                          </th>
                          <th className="min-w-[110px] border border-gray-300 px-3 py-3 text-center font-bold text-red-600">
                            Total cost
                          </th>
                          {services.map((service) => (
                            <ServiceHeader
                              key={service.id}
                              service={service}
                              editable={editable && !reordering}
                              onImageClick={openServicePopup}
                            />
                          ))}
                        </tr>
                      </SortableContext>
                    </DndContext>
                  </thead>
                  <tbody>
                    {packages.length === 0 ? (
                      <tr>
                        <td colSpan={services.length + 2} className="px-4 py-8 text-center text-gray-500">
                          No subscription packages found with &quot;put_table&quot; enabled.
                        </td>
                      </tr>
                    ) : (
                      packages.map((pkg) => {
                        const selected = new Set(pkg.serviceIds);
                        const active = pkg.id === activePackageId;
                        return (
                          <tr key={pkg.id} className="hover:bg-gray-50">
                            <td
                              onClick={() => setActivePackageId(pkg.id)}
                              className={`cursor-pointer border border-gray-300 px-3 py-5 text-center text-base font-bold transition ${
                                active ? 'bg-blue-50 text-blue-600' : 'hover:bg-blue-50 hover:text-blue-600'
                              }`}
                            >
                              {pkg.packageName || pkg.subscriptionName}
                            </td>
                            <td className="border border-gray-300 px-3 py-5 text-center text-lg font-bold text-[#52a962]">
                              {pkg.totalCost.toFixed(2)} {currency}
                            </td>
                            {services.map((service) => (
                              <td key={service.id} className="border border-gray-300 bg-white px-3 py-4 text-center">
                                {selected.has(service.id) ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2ebd6b] text-white">
                                      <Check className="h-5 w-5" strokeWidth={3} />
                                    </span>
                                    <span className="text-xs text-gray-800">{service.serviceName}</span>
                                  </div>
                                ) : (
                                  <span
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f2474b] text-white"
                                    aria-label={`${service.serviceName} not included`}
                                  >
                                    <X className="h-5 w-5" strokeWidth={3} />
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-8 rounded-md border border-gray-200 bg-gray-50 p-5">
            <h3 className="border-b-2 border-blue-600 pb-2 font-semibold text-gray-800">
              Package Features{activePackage ? ` - ${activePackage.packageName || activePackage.subscriptionName}` : ''}
            </h3>
            {activePackage?.packageFeature ? (
              <div
                className="package-feature-html mt-3 p-2 text-sm text-gray-800 [&_a]:text-blue-600 [&_a]:underline [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: activePackage.packageFeature }}
              />
            ) : (
              <p className="py-10 text-center italic text-gray-400">
                {activePackage
                  ? 'No features available for this package'
                  : 'Please click a package name to show its features'}
              </p>
            )}
          </div>
        </div>
      </section>

      {popupService && (
        <ServicePopup
          {...popupService}
          onClose={() => setPopupService(null)}
          onImage={(url) => {
            setPopupService(null);
            setImageUrl(url);
          }}
          onVideo={(url) => {
            setPopupService(null);
            setVideoUrl(url);
          }}
        />
      )}

      {imageUrl && (
        <Overlay onClose={() => setImageUrl(null)} dark>
          <div className="relative max-h-[90vh] max-w-[90vw] bg-white p-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setImageUrl(null)}
              className="absolute -top-10 right-0 text-3xl font-bold text-white hover:text-red-500"
              aria-label="Close"
            >
              &times;
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Service" className="max-h-[85vh] min-w-[150px] rounded-md object-contain" />
          </div>
        </Overlay>
      )}

      {videoUrl && (
        <Overlay onClose={() => setVideoUrl(null)}>
          <div
            className="relative w-[90vw] max-w-3xl rounded-lg bg-black p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setVideoUrl(null)}
              className="absolute right-2 top-2 rounded bg-black/40 px-2 text-2xl font-bold text-white hover:bg-red-600"
              aria-label="Close"
            >
              &times;
            </button>
            <VideoPlayer url={videoUrl} />
          </div>
        </Overlay>
      )}

      {shareLink && <ShareLinkModal link={shareLink} onClose={() => setShareLink(null)} />}
    </div>
  );
}

function ServiceHeader({
  service,
  editable,
  onImageClick
}: {
  service: PackageService;
  editable: boolean;
  onImageClick: (event: React.MouseEvent<HTMLElement>, service: PackageService) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: service.id,
    disabled: !editable
  });

  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative min-w-[150px] border border-gray-300 px-3 py-3 text-center align-middle ${
        isDragging ? 'z-20 border-2 border-dashed border-blue-500 bg-blue-50 opacity-80' : 'hover:bg-gray-200'
      }`}
    >
      {editable && (
        <button
          type="button"
          className="absolute right-1 top-1 flex h-6 w-6 cursor-grab items-center justify-center rounded-full bg-white/90 text-blue-600 opacity-70 shadow-sm hover:opacity-100 active:cursor-grabbing"
          aria-label={`Drag to reorder ${service.serviceName}`}
          {...attributes}
          {...listeners}
        >
          <MoveHorizontal className="h-4 w-4" />
        </button>
      )}
      {service.imageUrl && (
        <button type="button" onClick={(e) => onImageClick(e, service)} className="inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={service.imageUrl}
            alt={service.serviceName}
            className="mx-auto mt-1 h-12 w-[60px] object-contain transition hover:scale-110 hover:shadow-md"
          />
        </button>
      )}
      {service.showCost && service.actualCost && (
        <div className="mt-1 text-[13px] font-bold text-red-600">
          Cost <span className="line-through">{service.actualCost} {service.currencyCode}</span>
        </div>
      )}
    </th>
  );
}

function ServicePopup({
  service,
  top,
  left,
  onClose,
  onImage,
  onVideo
}: {
  service: PackageService;
  top: number;
  left: number;
  onClose: () => void;
  onImage: (url: string) => void;
  onVideo: (url: string) => void;
}) {
  useEffect(() => {
    const onClick = () => onClose();
    const timer = window.setTimeout(() => document.addEventListener('click', onClick), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', onClick);
    };
  }, [onClose]);

  const images = [service.image1Url, service.image2Url].filter(Boolean) as string[];

  return (
    <div
      className="fixed z-[9999] min-w-[200px] rounded-md border-2 border-gray-300 bg-white p-4 shadow-xl"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-4 border-b border-gray-200 pb-2">
        <span className="text-sm font-bold text-gray-800">{service.serviceName || 'Service Details'}</span>
        <button type="button" onClick={onClose} className="text-xl font-bold leading-none text-gray-400 hover:text-red-600" aria-label="Close">
          &times;
        </button>
      </div>
      <div className="flex items-center gap-3">
        {images.length > 0 && (
          <div className="flex items-center gap-2">
            {images.map((src) => (
              <button key={src} type="button" onClick={() => onImage(src)} title="Click to view larger image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={service.serviceName} className="h-16 w-[75px] rounded border border-gray-300 object-cover transition hover:scale-105" />
              </button>
            ))}
          </div>
        )}
        <div className={images.length > 0 ? 'border-l border-gray-300 pl-3' : ''}>
          {service.videoUrl ? (
            <button
              type="button"
              onClick={() => onVideo(service.videoUrl)}
              className="whitespace-nowrap rounded bg-blue-600 px-4 py-2 text-xs text-white hover:bg-blue-700"
            >
              View Video
            </button>
          ) : (
            <span className="whitespace-nowrap text-xs italic text-gray-400">No link</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Overlay({ children, onClose, dark = false }: { children: React.ReactNode; onClose: () => void; dark?: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-[10001] flex items-center justify-center p-5 ${dark ? 'bg-black/90' : 'bg-black/70'}`}
      onClick={onClose}
    >
      {children}
    </div>
  );
}

/** YouTube links become embeds; direct mp4/webm/ogg play natively; other http(s) links load in an iframe. */
function VideoPlayer({ url }: { url: string }) {
  const trimmed = url.trim();
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(trimmed)) {
    return <video src={trimmed} controls autoPlay className="max-h-[70vh] w-full rounded-md" />;
  }
  const src = toYouTubeEmbed(trimmed) ?? (/^https?:\/\//i.test(trimmed) ? trimmed : null);
  if (!src) return <p className="text-center text-white">Invalid video link.</p>;
  return (
    <div className="relative w-full overflow-hidden rounded-md pb-[56.25%]">
      <iframe
        src={src}
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function toYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(/^www\./i.test(url) ? `https://${url}` : url);
    const host = u.hostname.toLowerCase();
    if (u.pathname.startsWith('/embed/') && host.includes('youtube.com')) return u.toString();
    let videoId = '';
    if (host.includes('youtube.com')) videoId = u.searchParams.get('v') ?? '';
    else if (host.includes('youtu.be')) videoId = u.pathname.split('/')[1] ?? '';
    if (!videoId) return null;
    const params = new URLSearchParams();
    const list = u.searchParams.get('list');
    if (list) params.set('list', list);
    let start = u.searchParams.get('start');
    const t = u.searchParams.get('t');
    if (!start && t) {
      const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
      const seconds = /^\d+$/.test(t)
        ? Number(t)
        : m
          ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
          : 0;
      if (seconds > 0) start = String(seconds);
    }
    if (start) params.set('start', start);
    const qs = params.toString();
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}${qs ? `?${qs}` : ''}`;
  } catch {
    return null;
  }
}

function ShareLinkModal({ link, onClose }: { link: string; onClose: () => void }) {
  const [message, setMessage] = useState('');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Link copied to clipboard!');
    } catch {
      setMessage('Failed to copy. Please select and copy manually.');
    }
    window.setTimeout(() => setMessage(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-800">Shareable Link</h3>
          <button type="button" onClick={onClose} className="text-2xl font-bold text-gray-400 hover:text-red-600" aria-label="Close">
            &times;
          </button>
        </div>
        <div className="space-y-3 p-5 text-sm">
          <p>Share this link with anyone to let them view this subscription packages table:</p>
          <div className="flex">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              autoFocus
              className="min-w-0 flex-1 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-gray-700"
            />
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-r-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
          </div>
          <p className="h-5 text-right text-green-600">{message}</p>
          <p className="text-gray-500">This link will expire in 30 days.</p>
        </div>
      </div>
    </div>
  );
}
