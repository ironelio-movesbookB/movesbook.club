'use client';

import { useState, useEffect } from 'react';
import { X, Link2, MessageCircle, Send, Facebook, Mail } from 'lucide-react';
import {
  buildTelegramSharePickerUrl,
  buildWhatsAppShareUrl,
  ensureShareLinkInMessage,
  FACEBOOK_SHARE_NOTICE,
  openExternalShareUrl,
  shareViaFacebook,
} from '@/utils/socialShareUrls';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  articleUrl: string;
  articleTitle: string;
  articleImage?: string | null;
  /** Modal heading (default: Share this article) */
  heading?: string;
  /** Raise z-index above workout plan overlays */
  elevated?: boolean;
  onPostToMovesbook?: () => void;
  /** Hide the Facebook tile (e.g. invitation links). */
  showFacebook?: boolean;
  /** Show a Mail tile that opens the mail client with this subject. */
  mailSubject?: string;
}

export default function SocialShareModal({
  isOpen,
  onClose,
  articleUrl,
  articleTitle,
  articleImage,
  heading = 'Share this article',
  elevated = false,
  onPostToMovesbook,
  showFacebook = true,
  mailSubject,
}: SocialShareModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const overlayZ = elevated ? 'z-[10000000]' : 'z-[9999]';
  const panelZ = elevated ? 'z-[10000001]' : 'z-[10000]';

  const shareText = ensureShareLinkInMessage(
    articleTitle.trim() || 'Check this out on Movesbook',
    articleUrl
  );

  const handleWhatsApp = () => {
    if (!articleUrl) return;
    openExternalShareUrl(buildWhatsAppShareUrl(undefined, shareText));
  };

  const handleTelegram = () => {
    if (!articleUrl) return;
    openExternalShareUrl(buildTelegramSharePickerUrl(articleUrl, shareText));
  };

  const handleFacebook = async () => {
    if (!articleUrl) return;
    const fb = await shareViaFacebook(articleUrl, shareText);
    if (fb.copiedToClipboard) {
      alert(FACEBOOK_SHARE_NOTICE);
    }
  };

  const handleMail = () => {
    if (!articleUrl) return;
    window.location.href = `mailto:?subject=${encodeURIComponent(mailSubject ?? articleTitle)}&body=${encodeURIComponent(shareText)}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(articleUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 ${overlayZ} transition-opacity`}
        onClick={onClose}
      />
      <div className={`fixed inset-0 ${panelZ} flex items-center justify-center p-4 pointer-events-none`}>
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 relative pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {heading}
              </h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <button
                onClick={handleWhatsApp}
                className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
              >
                <MessageCircle className="w-8 h-8 text-green-600 mb-2" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">
                  WhatsApp
                </span>
              </button>

              <button
                onClick={handleTelegram}
                className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <Send className="w-8 h-8 text-blue-600 mb-2" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                  Telegram
                </span>
              </button>

              {mailSubject !== undefined && (
                <button
                  onClick={handleMail}
                  className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-all group"
                >
                  <Mail className="w-8 h-8 text-amber-600 mb-2" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-amber-700">
                    Mail
                  </span>
                </button>
              )}

              {showFacebook && (
                <button
                  onClick={handleFacebook}
                  className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-lg hover:border-blue-700 hover:bg-blue-50 transition-all group"
                >
                  <Facebook className="w-8 h-8 text-blue-700 mb-2" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-800">
                    Facebook
                  </span>
                </button>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Link2 className="w-5 h-5 text-gray-600" />
                <span className="font-medium">
                  {copied ? 'Link copied!' : 'Get link'}
                </span>
              </button>

              {onPostToMovesbook && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onPostToMovesbook();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="text-xl">📝</span>
                  <span className="font-medium">Post on Movesbook</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
