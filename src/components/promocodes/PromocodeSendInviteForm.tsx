'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { promocodesFetch, usePromocodesAdminAuth } from '@/components/promocodes/usePromocodesAdminAuth';
import { usePromocodeDialogs } from '@/components/promocodes/usePromocodeDialogs';
import PromocodeInviteCKEditor4 from '@/components/promocodes/PromocodeInviteCKEditor4';
import { notifyPromocodeInviteSentOpener } from '@/lib/promocodes/promocodeInviteEvents';
import { getCke4Window } from '@/lib/ckeditor4Legacy';
import type { SendInvitePreview } from '@/lib/promocodes/sendInviteService';
import { promocodeLanguageFlagUrl, PROMOCODE_NO_FLAG_IMAGE } from '@/components/promocodes/promocodeImageUrls';
import PromocodeAssetImage from '@/components/promocodes/PromocodeAssetImage';
import './send-invite.css';

export default function PromocodeSendInviteForm() {
  const ready = usePromocodesAdminAuth();
  const searchParams = useSearchParams();
  const { showAlert, dialogs } = usePromocodeDialogs();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SendInvitePreview | null>(null);
  const [emailContent, setEmailContent] = useState('');
  const [otherInfo, setOtherInfo] = useState('');
  const [advPage, setAdvPage] = useState('');
  const [sending, setSending] = useState(false);

  const queryString = searchParams?.toString() ?? '';

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await promocodesFetch(`/api/admin/promocodes/send-invite?${queryString}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load invitation preview');
      const loaded = data as SendInvitePreview;
      setPreview(loaded);
      setEmailContent(loaded.emailBodyHtml);
      setOtherInfo(loaded.otherInfo);
      setAdvPage(loaded.advPage);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load invitation preview');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    if (!ready) return;
    void loadPreview();
  }, [loadPreview, ready]);

  const sendMail = async () => {
    if (!preview?.emailAddress.trim()) {
      showAlert('Please enter email');
      return;
    }

    setSending(true);
    try {
      const latestHtml =
        typeof window !== 'undefined' && getCke4Window().CKEDITOR?.instances.email_content
          ? getCke4Window().CKEDITOR!.instances.email_content.getData()
          : emailContent;

      const res = await promocodesFetch('/api/admin/promocodes/send-invite', {
        method: 'POST',
        body: JSON.stringify({
          emailAddress: preview.emailAddress.trim(),
          promocode: preview.promocode,
          otherInfo,
          advPage,
          htmlPageId: preview.htmlPageId,
          languageId: preview.languageId,
          emailContent: latestHtml,
          inviterUsername: preview.inviteSenderUsername,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to send invitation');
      }
      notifyPromocodeInviteSentOpener();
      showAlert(data.message || 'Invitation(s) sent successfully.');
      window.close();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  if (!ready) {
    return <div className="send-invite-loading">Loading…</div>;
  }

  if (loading) {
    return <div className="send-invite-loading">Loading invitation preview…</div>;
  }

  if (loadError || !preview) {
    return <div className="send-invite-error">{loadError ?? 'Invitation preview unavailable.'}</div>;
  }

  const registerUrl =
    preview.registerUrl ||
    `/users/quickRegister?user_email=${encodeURIComponent(preview.emailAddress)}&promocode=${encodeURIComponent(preview.promocode)}&lang=${encodeURIComponent(preview.languageName)}`;

  const flagSrc = preview.flagImageUrl || promocodeLanguageFlagUrl(preview.languageName);

  const promocodeInputWidth = (value: string) => {
    const len = Math.max(12, String(value ?? '').length + 3);
    return { width: `${len}ch`, minWidth: `${len}ch` } as const;
  };

  return (
    <>
      <div>
        <div className="sd-legend-content">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <PromocodeAssetImage
            className="al_left"
            src={flagSrc}
            fallbackSrc={PROMOCODE_NO_FLAG_IMAGE}
            alt=""
          />
          <div className="lang_input_container">
            <label htmlFor="email_content">Content</label>
            <PromocodeInviteCKEditor4
              id="email_content"
              value={emailContent}
              onChange={setEmailContent}
              minHeightPx={330}
            />
          </div>
          <div className="clear" />
        </div>

        <div className="si-fields-block">
          <div className="si-field-row si-field-row-promo">
            <label className="si-label" htmlFor="url_1">
              Promocode
            </label>
            <input
              type="text"
              name="url_1"
              id="url_1"
              className="si-input si-input-compact"
              value={preview.promocode}
              readOnly
              style={promocodeInputWidth(preview.promocode)}
            />
            <a
              href={registerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="si-register-link"
            >
              Click here to register
            </a>
          </div>

          <div className="si-field-row">
            <label className="si-label" htmlFor="other_info">
              Other info
            </label>
            <input
              type="text"
              name="other_info"
              id="other_info"
              className="si-input si-input-url"
              value={otherInfo}
              onChange={(e) => setOtherInfo(e.target.value)}
            />
          </div>

          <div className="si-field-row si-field-row-last">
            <label className="si-label" htmlFor="visit_also">
              Visit also
            </label>
            <input
              type="text"
              name="visit_also"
              id="visit_also"
              className="si-input si-input-url"
              value={advPage}
              onChange={(e) => setAdvPage(e.target.value)}
            />
          </div>
        </div>

        <div className="si-actions">
          <a
            href="#"
            className="btn-red btn-send-invite-lg"
            onClick={(e) => {
              e.preventDefault();
              if (!sending) void sendMail();
            }}
          >
            {sending ? 'Sending…' : 'Send mail'}
          </a>
          <a
            href="#"
            className="btn-gray btn-send-invite-lg"
            onClick={(e) => {
              e.preventDefault();
              window.close();
            }}
          >
            Cancel
          </a>
        </div>
      </div>
      {dialogs}
    </>
  );
}
