'use client';

import type { MouseEvent, ReactNode } from 'react';
import {
  Eye,
  EyeOff,
  Link,
  Pencil,
  Settings,
  Share2,
  ThumbsUp,
  Trash2,
  User,
  Globe,
  Library,
} from 'lucide-react';
import type { ArticlePasted } from './NewsArticlesList';

export type OgpArticleActionBarProps = {
  article: ArticlePasted;
  likes?: { count: number; likedByMe: boolean };
  likeLoading?: boolean;
  likeDisabled?: boolean;
  onLike: () => void;
  onShare: () => void;
  /** How many times this article has been opened/seen. */
  viewCount?: number;
  showGlobalNewsButton?: boolean;
  globalNewsLoading?: boolean;
  onToggleGlobalNews?: () => void;
  /** Tooltip/aria copy for the globe toggle (defaults to Global News). */
  globalFeedLabel?: string;
  /** Club admin creator: Share in Movesbook library toggle. */
  showShareInMovesbookLibraryButton?: boolean;
  shareInMovesbookLibraryLoading?: boolean;
  onToggleShareInMovesbookLibrary?: () => void;
  /** Optional club / extra buttons rendered after Share (e.g. Share in My Clubs). */
  extraSocialButtons?: ReactNode;
  canEditAsCreator: boolean;
  canManage: boolean;
  readOnly?: boolean;
  isExpanded?: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  editDisabled?: boolean;
  editTitle?: string;
  onCopyLink: () => void;
  linkCopied?: boolean;
  onViewCreator: () => void;
  showMbOnUserButton?: boolean;
  onSettings: () => void;
  settingsDisabled?: boolean;
  onDelete: () => void;
  deleteDisabled?: boolean;
  showMbInsteadOfDelete?: boolean;
  /** Tighter spacing for compact News Headlines panel. */
  dense?: boolean;
};

/**
 * Like, Views, Share, Pencil, Eye, Link, User, Settings, Delete — one compact row.
 */
export default function OgpArticleActionBar({
  article,
  likes,
  likeLoading,
  likeDisabled,
  onLike,
  onShare,
  viewCount = 0,
  showGlobalNewsButton,
  globalNewsLoading,
  onToggleGlobalNews,
  globalFeedLabel = 'Global News',
  showShareInMovesbookLibraryButton,
  shareInMovesbookLibraryLoading,
  onToggleShareInMovesbookLibrary,
  extraSocialButtons,
  canEditAsCreator,
  canManage,
  readOnly,
  isExpanded,
  onToggleExpand,
  onEdit,
  editDisabled,
  editTitle,
  onCopyLink,
  linkCopied,
  onViewCreator,
  showMbOnUserButton,
  onSettings,
  settingsDisabled,
  onDelete,
  deleteDisabled,
  showMbInsteadOfDelete,
  dense,
}: OgpArticleActionBarProps) {
  const iconBtn = dense
    ? 'flex items-center justify-center w-5 h-5 min-w-[20px] rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed'
    : 'flex items-center justify-center w-6 h-6 min-w-[24px] rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50';
  const iconSize = dense ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const stop = (e: MouseEvent, fn: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  const viewsLabel = viewCount === 1 ? '1 view' : `${viewCount} views`;

  const mbBadge = (
    <span
      className={`flex items-center justify-center ${dense ? 'w-5 h-5 min-w-[20px]' : 'w-6 h-6 min-w-[24px]'} rounded bg-red-600 text-white border border-yellow-300 shrink-0 select-none`}
      style={{
        fontFamily: "'Comic Sans MS', 'Comic Sans', cursive",
        fontSize: dense ? 9 : 11,
        fontWeight: 700,
        lineHeight: 1,
      }}
      title="Posted by Movesbook (Super Admin)"
      aria-label="Posted by Movesbook (Super Admin)"
    >
      MB
    </span>
  );

  return (
    <div
      className={`relative z-20 pointer-events-auto inline-flex items-center flex-wrap ${dense ? 'gap-1 mt-1' : 'gap-1.5 mt-2'} flex-shrink-0 w-fit max-w-full`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => stop(e, onLike)}
        disabled={readOnly || likeDisabled || !!likeLoading}
        className={`inline-flex items-center gap-1 rounded-md border ${dense ? 'px-1.5 py-0.5' : 'px-2 py-1'} text-xs font-medium transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
          likes?.likedByMe
            ? 'border-cyan-500 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
            : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
        }`}
        title={likes?.likedByMe ? 'Unlike' : 'Like'}
        aria-label={likes?.likedByMe ? 'Unlike' : 'Like'}
      >
        <ThumbsUp className={`${iconSize} ${likes?.likedByMe ? 'fill-current' : ''}`} />
        <span className="min-w-[1.25rem] text-right tabular-nums">{likes?.count ?? 0}</span>
      </button>
      <span
        className={`inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 text-gray-600 ${dense ? 'px-1.5 py-0.5' : 'px-2 py-1'} text-xs font-medium shrink-0 select-none`}
        title={viewsLabel}
        aria-label={viewsLabel}
      >
        <Eye className={iconSize} aria-hidden />
        <span className="min-w-[1.25rem] text-right tabular-nums">{viewCount}</span>
      </span>
      <button
        type="button"
        onClick={(e) => stop(e, onShare)}
        disabled={readOnly}
        className={`inline-flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 ${dense ? 'px-1.5 py-0.5' : 'px-2 py-1'} text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Share"
        aria-label="Share"
      >
        <Share2 className={iconSize} />
      </button>
      {showShareInMovesbookLibraryButton && onToggleShareInMovesbookLibrary ? (
        <button
          type="button"
          onClick={(e) => stop(e, onToggleShareInMovesbookLibrary)}
          disabled={readOnly || shareInMovesbookLibraryLoading}
          className={`inline-flex items-center justify-center rounded-md border ${dense ? 'px-1.5 py-0.5' : 'px-2 py-1'} transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
            article.sharedInMovesbookLibrary
              ? 'border-teal-500 bg-teal-50 text-teal-700 hover:bg-teal-100'
              : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
          }`}
          title={
            article.sharedInMovesbookLibrary
              ? 'Shared in Movesbook library (click to remove)'
              : 'Share in Movesbook library'
          }
          aria-label={
            article.sharedInMovesbookLibrary
              ? 'Remove from Movesbook library'
              : 'Share in Movesbook library'
          }
        >
          <Library className={iconSize} />
        </button>
      ) : null}
      {showGlobalNewsButton && onToggleGlobalNews ? (
        <button
          type="button"
          onClick={(e) => stop(e, onToggleGlobalNews)}
          disabled={readOnly || globalNewsLoading}
          className={`inline-flex items-center justify-center rounded-md border ${dense ? 'px-1.5 py-0.5' : 'px-2 py-1'} transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${
            article.inGlobalNews
              ? 'border-teal-500 bg-teal-50 text-teal-700 hover:bg-teal-100'
              : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 hover:border-gray-300'
          }`}
          title={
            article.inGlobalNews
              ? `Shared in ${globalFeedLabel} (click to remove)`
              : `Share in ${globalFeedLabel}`
          }
          aria-label={
            article.inGlobalNews
              ? `Remove from ${globalFeedLabel}`
              : `Share in ${globalFeedLabel}`
          }
        >
          <Globe className={iconSize} />
        </button>
      ) : null}
      {extraSocialButtons}
      <button
        type="button"
        onClick={(e) => stop(e, onEdit)}
        disabled={readOnly || editDisabled}
        className={iconBtn}
        title={editTitle ?? (canEditAsCreator ? 'Change topic (creator only)' : 'Only the creator can change this')}
        aria-label="Change topic"
      >
        <Pencil className={iconSize} />
      </button>
      <button
        type="button"
        onClick={(e) => stop(e, onToggleExpand)}
        disabled={readOnly}
        className={iconBtn}
        title={isExpanded ? 'Show less' : 'Show full text'}
        aria-label={isExpanded ? 'Collapse text' : 'Expand to full text'}
      >
        {isExpanded ? <EyeOff className={iconSize} /> : <Eye className={iconSize} />}
      </button>
      <button
        type="button"
        onClick={(e) => stop(e, onCopyLink)}
        disabled={readOnly}
        className={iconBtn}
        title={linkCopied ? 'Copied!' : 'Copy OGP URL to clipboard'}
        aria-label={linkCopied ? 'Copied!' : 'Copy link'}
      >
        <Link className={iconSize} />
      </button>
      <button
        type="button"
        onClick={(e) => stop(e, onViewCreator)}
        disabled={readOnly}
        className={`${iconBtn} ${
          !canEditAsCreator
            ? '!border-amber-200 !bg-amber-200 hover:!bg-amber-400 hover:!border-amber-300'
            : ''
        }`}
        title="View creator of this article"
        aria-label="View creator"
      >
        {showMbOnUserButton ? mbBadge : <User className={iconSize} />}
      </button>
      <button
        type="button"
        onClick={(e) => stop(e, onSettings)}
        disabled={readOnly || settingsDisabled}
        className={iconBtn}
        title={
          canManage
            ? 'News settings (visibility)'
            : 'Only creator, admin, or super admin can edit settings'
        }
        aria-label="News settings"
      >
        <Settings className={iconSize} />
      </button>
      {showMbInsteadOfDelete ? (
        mbBadge
      ) : (
        <button
          type="button"
          onClick={(e) => stop(e, onDelete)}
          disabled={readOnly || deleteDisabled}
          className={`flex items-center justify-center ${dense ? 'w-5 h-5 min-w-[20px]' : 'w-6 h-6 min-w-[24px]'} rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`}
          title={canManage ? 'Delete' : 'Only super admin, admin, or creator can delete'}
          aria-label="Delete"
        >
          <Trash2 className={iconSize} />
        </button>
      )}
    </div>
  );
}
