'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Calendar, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { deserializeMultiLanguageContent } from '@/lib/news/contentParser';
import { LANGUAGE_ID_MAP, LANGUAGE_CODE_TO_ID_MAP } from '@/lib/news/mappings';
import { useLanguage } from '@/contexts/LanguageContext';
import NewsCarousel from './NewsCarousel';
import { ShareInMyClubsButtonIfClub } from '@/components/club/ShareInMyClubsButton';
import ClubGlobalNewsToggleButton from '@/components/club/ClubGlobalNewsToggleButton';
import MovesbookGlobalNewsToggleButton from '@/components/club/MovesbookGlobalNewsToggleButton';

const newsListStyles = `
  .section-slider::-webkit-scrollbar {
    display: none;
  }
  .description {
    color: #000 !important;
    font-size: 14px;
    line-height: 20px;
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
    text-overflow: clip !important;
    white-space: normal !important;
    display: block !important;
  }
  [id^="description-content-"] {
    color: #000 !important;
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
    text-overflow: clip !important;
    white-space: normal !important;
  }
`;

interface NewsItem {
  id: string;
  title: string;
  content?: string | Record<string, string>;
  image?: string | null;
  createdAt: string;
  mode?: string;
  internetLinkEditor?: string;
  inLastNews?: string;
  feturedNews?: string;
  category?: {
    id: string;
    categoryName: string;
  } | null;
  languageTitles?: Array<{
    title: string;
    language: {
      code: string;
      name: string;
    };
  }>;
  settings?: Array<{
    sports?: Array<{
      sport: string;
    }>;
  }>;
  author?: string;
  originalAuthor?: string;
  searchingKeywords?: string;
  briefDesc?: string | null;
  user?: {
    id: string;
    username: string;
    image: string | null;
    firstname?: string | null;
    lastname?: string | null;
  } | null;
  /** Club: promoted into Club Global News for the current club. */
  inClubGlobalNews?: boolean;
  /** Platform Movesbook Global News flag. */
  inGlobalNews?: boolean;
}

interface NewsListProps {
  news: NewsItem[];
  mode?: 'default' | 'list' | 'miniature' | 'section' | 'grid' | 'browser';
  currentLanguage?: string;
  onModeChange?: (mode: 'default' | 'list' | 'miniature' | 'section' | 'grid' | 'browser') => void;
  hideShowStatus?: boolean;
  onHideShowChange?: (status: boolean) => void;
  /** Club admin: show Share in My Clubs on article cards. */
  showShareInMyClubs?: boolean;
  clubUserType?: string | null;
  clubAdminUsername?: string | null;
  /** Club admin: show Club Global News globe (requires clubId). */
  showClubGlobalNews?: boolean;
  clubGlobalNewsClubId?: string | null;
  onToggleClubGlobalNews?: (id: string, inClubGlobalNews: boolean) => void;
  /** When Club Global toggle finds item not shared yet. */
  onRequestClubGlobalShare?: (id: string, title: string) => void;
  /** Club admin: show Share in Movesbook Global News. */
  showMovesbookGlobalNews?: boolean;
  onToggleMovesbookGlobalNews?: (id: string, inGlobalNews: boolean) => void;
  /**
   * When set with showOwnerEditDelete, show Edit/Delete only on articles
   * whose creator (`item.user.id`) matches this logged-in user id.
   */
  currentUserId?: string | null;
  showOwnerEditDelete?: boolean;
  /** Extra query for edit links (e.g. `from=club&clubId=...`). */
  ownerEditQuery?: string | null;
  onDeleteOwnedNews?: (id: string) => void;
}

const overlayActionBtnClass =
  'inline-flex items-center justify-center rounded-md border border-gray-200 bg-white/95 p-1.5 shadow-sm transition-colors hover:bg-gray-100';

function isNewsCreator(item: NewsItem, currentUserId?: string | null): boolean {
  return Boolean(currentUserId && item.user?.id && item.user.id === currentUserId);
}

export default function NewsList({
  news,
  mode = 'default',
  currentLanguage: propCurrentLanguage = 'en',
  onModeChange,
  hideShowStatus = false,
  onHideShowChange,
  showShareInMyClubs = false,
  clubUserType = null,
  clubAdminUsername = null,
  showClubGlobalNews = false,
  clubGlobalNewsClubId = null,
  onToggleClubGlobalNews,
  onRequestClubGlobalShare,
  showMovesbookGlobalNews = false,
  onToggleMovesbookGlobalNews,
  currentUserId = null,
  showOwnerEditDelete = false,
  ownerEditQuery = null,
  onDeleteOwnedNews,
}: NewsListProps) {
  const { t, currentLanguage: contextCurrentLanguage } = useLanguage();
  const [selectedLanguages, setSelectedLanguages] = useState<Record<string, string>>({});
  const sliderRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [sliderCanScroll, setSliderCanScroll] = useState<Record<string, { left: boolean; right: boolean }>>({});

  const currentLanguage = propCurrentLanguage || contextCurrentLanguage || 'en';

  const handleSliderScroll = (categoryId: string) => {
    const el = sliderRefs.current.get(categoryId);
    if (!el) return;
    setSliderCanScroll(prev => ({
      ...prev,
      [categoryId]: {
        left: el.scrollLeft > 4,
        right: el.scrollLeft < el.scrollWidth - el.clientWidth - 4,
      },
    }));
  };

  const scrollSlider = (categoryId: string, dir: 'left' | 'right') => {
    const el = sliderRefs.current.get(categoryId);
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -el.clientWidth : el.clientWidth, behavior: 'smooth' });
  };

  useEffect(() => {
    const styleId = 'news-list-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = newsListStyles;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'section') return;
    const grouped: Record<string, NewsItem[]> = {};
    news.forEach(item => {
      const categoryId = item.category?.id || 'uncategorized';
      if (!grouped[categoryId]) grouped[categoryId] = [];
      grouped[categoryId].push(item);
    });
    Object.keys(grouped).forEach((categoryId) => handleSliderScroll(categoryId));
  }, [mode, news]);

  const getNewsTitle = (item: NewsItem, langCode?: string) => {
    const lang = langCode || currentLanguage || 'en';
    
    if (item.languageTitles && item.languageTitles.length > 0) {
      const langTitle = item.languageTitles.find(
        (lt) => lt.language && lt.language.code === lang
      );
      if (langTitle && langTitle.title && langTitle.title.trim()) {
        return langTitle.title;
      }
    }
    
    return item.title || '';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDatePosted = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const suffix = (day: number) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}${suffix(day)} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  };


  const getAvailableLanguages = (item: NewsItem) => {
    if (!item.content || typeof item.content !== 'object' || Array.isArray(item.content)) {
      return [];
    }
    
    const contentObj = item.content as Record<string, string>;
    const availableLangs: Array<{ id: number; code: string }> = [];
    Object.keys(contentObj).forEach(code => {
      const content = contentObj[code];
      if (content && typeof content === 'string' && content.trim() !== '') {
        const id = LANGUAGE_ID_MAP[code];
        if (id) {
          availableLangs.push({ id, code });
        }
      }
    });
    return availableLangs;
  };

  const getSportName = (item: NewsItem) => {
    if (item.settings && item.settings.length > 0) {
      const firstSetting = item.settings[0];
      if (firstSetting.sports && firstSetting.sports.length > 0) {
        return firstSetting.sports[0].sport;
      }
    }
    return null;
  };

  const getAuthorInitials = (item: NewsItem) => {
    if (item.user?.firstname && item.user?.lastname) {
      return `${item.user.firstname.charAt(0).toUpperCase()}${item.user.lastname.charAt(0).toUpperCase()}`;
    }
    if (item.user?.firstname) {
      return item.user.firstname.charAt(0).toUpperCase();
    }
    if (item.user?.username) {
      return item.user.username.charAt(0).toUpperCase();
    }
    return 'A';
  };

  const getAuthorImageUrl = (item: NewsItem) => {
    if (item.user?.image) {
      return `/img/profile_images/${item.user.image}`;
    }
    return null;
  };

  const AuthorAvatar = ({ item, size = 'md' }: { item: NewsItem; size?: 'sm' | 'md' | 'lg' }) => {
    const imageUrl = getAuthorImageUrl(item);
    const initials = getAuthorInitials(item);
    const sizeClasses = {
      sm: 'w-6 h-6 text-xs',
      md: 'w-8 h-8 text-xs',
      lg: 'w-10 h-10 text-sm'
    };
    const sizeClass = sizeClasses[size];
    
    if (imageUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={item.user?.username || 'Author'}
          className={`${sizeClass} rounded-full object-cover border border-gray-200`}
        />
      );
    }
    
    return (
      <div className={`${sizeClass} rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold border border-gray-200`}>
        {initials}
      </div>
    );
  };

  const getOwnerEditHref = (id: string) => {
    const base = `/news-by-movesbook/edit/${id}`;
    if (!ownerEditQuery) return base;
    const q = ownerEditQuery.startsWith('?') ? ownerEditQuery.slice(1) : ownerEditQuery;
    return q ? `${base}?${q}` : base;
  };

  const CardOverlayActions = ({ item, title }: { item: NewsItem; title: string }) => {
    const isOwner = showOwnerEditDelete && isNewsCreator(item, currentUserId);
    const showShareRow =
      showShareInMyClubs ||
      (showClubGlobalNews && clubGlobalNewsClubId) ||
      showMovesbookGlobalNews ||
      isOwner;

    if (!showShareRow) return null;

    return (
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
        {isOwner ? (
          <>
            <Link
              href={getOwnerEditHref(item.id)}
              onClick={(e) => e.stopPropagation()}
              className={`${overlayActionBtnClass} text-blue-600 hover:text-blue-800`}
              title="Edit"
              aria-label="Edit news article"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteOwnedNews?.(item.id);
              }}
              className={`${overlayActionBtnClass} text-red-600 hover:text-red-800`}
              title="Delete"
              aria-label="Delete news article"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : null}
        {showShareInMyClubs ? (
          <ShareInMyClubsButtonIfClub
            userType={clubUserType}
            kind="news"
            itemId={item.id}
            itemTitle={title}
            adminUsername={clubAdminUsername ?? undefined}
          />
        ) : null}
        {showClubGlobalNews && clubGlobalNewsClubId ? (
          <ClubGlobalNewsToggleButton
            kind="news"
            itemId={item.id}
            clubId={clubGlobalNewsClubId}
            inClubGlobalNews={item.inClubGlobalNews === true}
            variant="overlay"
            onToggled={(next) => onToggleClubGlobalNews?.(item.id, next)}
            onNotShared={() => onRequestClubGlobalShare?.(item.id, title)}
          />
        ) : null}
        {showMovesbookGlobalNews ? (
          <MovesbookGlobalNewsToggleButton
            itemId={item.id}
            inGlobalNews={item.inGlobalNews === true}
            variant="overlay"
            onToggled={(next) => onToggleMovesbookGlobalNews?.(item.id, next)}
          />
        ) : null}
      </div>
    );
  };

  const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  };

  const getContentPreview = (item: NewsItem, langCode?: string, truncate: boolean = true) => {
    if (!item.content || typeof item.content !== 'object' || Array.isArray(item.content)) {
      return '';
    }
    
    const contentObj = item.content as Record<string, string>;
    const lang = langCode || currentLanguage || 'en';
    let content = '';
    
    if (item.mode === 'url' && item.internetLinkEditor) {
      content = item.internetLinkEditor;
    } else {
      content = contentObj[lang] || contentObj['en'] || '';
    }
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return '';
    }
    
    const stripped = stripHtml(content);
    if (!stripped || stripped.trim().length === 0) {
      return '';
    }
    
    if (truncate) {
      const preview = stripped.length > 700 ? stripped.substring(0, 700) : stripped;
      return preview + '...';
    }
    
    return stripped;
  };

  const getKeywords = (item: NewsItem, langCode?: string) => {
    if (item.searchingKeywords && item.searchingKeywords.trim() !== '') {
      const keywords = item.searchingKeywords.trim();
      if (keywords.length > 20) {
        return keywords.substring(0, 20) + '...';
      }
      return keywords;
    }
    
    return '';
  };

  if (mode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {news.map((item) => (
          <Link
            key={item.id}
            href={`/news-by-movesbook/${item.id}`}
            className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group"
          >
            <div className="relative h-48">
              {item.image ? (
                <Image
                  src={item.image || ''}
                  alt={getNewsTitle(item)}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-gray-300"></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <div className="flex items-center justify-between text-xs mb-2">
                  {item.category && (
                    <span className="px-2 py-1 bg-blue-600 rounded text-white font-medium">
                      {item.category.categoryName}
                    </span>
                  )}
                  <span>{formatDate(item.createdAt)}</span>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                {item.user && <AuthorAvatar item={item} size="md" />}
                {item.user && (
                  <span className="text-xs text-gray-500 truncate">{item.user.username}</span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                {getNewsTitle(item)}
              </h3>
              {item.briefDesc && (
                <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                  {item.briefDesc}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  if (mode === 'list') {
    return (
      <div className="space-y-6">
        {news.map((item) => {
          const availableLangs = getAvailableLanguages(item);
          const currentLangId = selectedLanguages[item.id] ? parseInt(selectedLanguages[item.id]) : LANGUAGE_ID_MAP[currentLanguage] || 1;
          const currentLangCode = LANGUAGE_CODE_TO_ID_MAP[currentLangId] || 'en';
          const sportName = getSportName(item);
          const authorName = item.author || item.originalAuthor || 'private';
          const contentPreview = getContentPreview(item, currentLangCode, true);

          return (
            <Link
              key={item.id}
              href={`/news-by-movesbook/${item.id}`}
              className="block bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group"
            >
              <div className="flex flex-col md:flex-row">
                {item.image && (
                  <div className="md:w-64 flex-shrink-0 p-4 md:p-4 md:pr-0">
                    <div className="relative h-48 w-full rounded-lg overflow-hidden">
                      <Image
                        src={item.image}
                        alt={getNewsTitle(item, currentLangCode)}
                        fill
                        className="object-cover rounded-lg"
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex-1 p-4 sm:p-6 md:pl-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {item.user && (
                          <AuthorAvatar item={item} size="lg" />
                        )}
                        {item.category && (
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded whitespace-nowrap">
                            {item.category.categoryName}
                          </span>
                        )}
                        {sportName && (
                          <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded whitespace-nowrap">
                            {sportName}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {getNewsTitle(item, currentLangCode)}
                      </h3>
                    </div>
                    
                    {availableLangs.length > 0 && item.mode !== 'url' && (
                      <select
                        value={currentLangId}
                        onChange={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const newLangId = parseInt(e.target.value);
                          setSelectedLanguages(prev => ({ ...prev, [item.id]: newLangId.toString() }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-4 px-3 py-1.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        {availableLangs.map((lang) => (
                          <option key={lang.id} value={lang.id}>
                            {lang.code.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {contentPreview && (
                    <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-3">
                      {contentPreview}
                    </p>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 text-xs sm:text-sm text-gray-500">
                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                      <span>
                        {t('news_by')} <span className="font-medium text-gray-700">{authorName}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                        {formatDatePosted(item.createdAt)}
                      </span>
                    </div>
                    {getKeywords(item, currentLangCode) && (
                      <div className="text-xs text-gray-400">
                        {t('news_keywords')}: {getKeywords(item, currentLangCode)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  if (mode === 'miniature') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {news.map((item) => (
          <Link
            key={item.id}
            href={`/news-by-movesbook/${item.id}`}
            className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group"
          >
            <div className="relative h-40">
              {item.image ? (
                  <Image
                    src={item.image || ''}
                    alt={getNewsTitle(item)}
                    fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-gray-300"></div>
              )}
              <div className="absolute top-0 left-0 right-0 bg-black/60 text-white p-2 flex justify-between items-center text-xs">
                {item.category && (
                  <span className="font-medium">{item.category.categoryName}</span>
                )}
                <span>{formatDate(item.createdAt)}</span>
              </div>
            </div>
            <div className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                {item.user && <AuthorAvatar item={item} size="md" />}
                {item.user && (
                  <span className="text-xs text-gray-500 truncate">{item.user.username}</span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                {getNewsTitle(item)}
              </h3>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  if (mode === 'default') {
    const featuredNews = news.filter(item => item.feturedNews === 'Y');
    const latestNews = news.filter(item => item.feturedNews !== 'Y');

    return (
      <div className="space-y-8">
        {featuredNews.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{t('news_featured_news')}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {featuredNews.map((item) => {
                const imageUrl = item.image || '/images/preview.jpg';
                const title = getNewsTitle(item);
                const truncatedTitle = title.length > 60 ? title.substring(0, 60) + '...' : title;

                return (
                  <div
                    key={item.id}
                    className="relative bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group"
                  >
                    <CardOverlayActions item={item} title={title} />
                    <Link
                      href={`/news-by-movesbook/${item.id}`}
                      className="block"
                    >
                    <div className="relative h-40">
                      <Image
                        src={imageUrl}
                        alt={title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {item.user && <AuthorAvatar item={item} size="sm" />}
                        <div className="text-xs text-gray-500 truncate">
                          {formatDatePosted(item.createdAt)}
                        </div>
                      </div>
                      <h3 className="text-xs sm:text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {truncatedTitle}
                      </h3>
                    </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {latestNews.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Latest News</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestNews.map((item) => {
                const sportName = getSportName(item);
                const authorName = item.author || item.originalAuthor || 'private';
                const imageUrl = item.image || '/images/preview.jpg';
                const title = getNewsTitle(item);
                const contentPreview = getContentPreview(item, currentLanguage, true);

                return (
                  <div
                    key={item.id}
                    className="relative bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group"
                  >
                    <CardOverlayActions item={item} title={title} />
                    <Link
                      href={`/news-by-movesbook/${item.id}`}
                      className="block"
                    >
                    <div className="relative h-48">
                      <Image
                        src={imageUrl}
                        alt={title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {item.category && (
                        <div className="absolute top-3 left-3">
                          <span className="bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded">
                            {item.category.categoryName}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {title}
                      </h3>
                      {contentPreview && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                          {contentPreview}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-.5">
                          {item.user && (
                            <AuthorAvatar item={item} size="sm" />
                          )}
                          <span className="text-gray-400">By</span>
                          <span className="font-medium text-gray-700">{item.user?.username || authorName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDatePosted(item.createdAt)}</span>
                        </div>
                      </div>
                      {sportName && (
                        <div className="mt-2 text-xs text-gray-500">
                          Sport: <span className="font-medium">{sportName}</span>
                        </div>
                      )}
                    </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'section') {
    const groupedByCategory: Record<string, NewsItem[]> = {};
    news.forEach(item => {
      const categoryId = item.category?.id || 'uncategorized';
      if (!groupedByCategory[categoryId]) {
        groupedByCategory[categoryId] = [];
      }
      groupedByCategory[categoryId].push(item);
    });


        return (
      <div className="space-y-10">
        {Object.entries(groupedByCategory).map(([categoryId, categoryNews]) => {
          
          const canLeft = sliderCanScroll[categoryId]?.left ?? false;
          const canRight = sliderCanScroll[categoryId]?.right ?? categoryNews.length > 3;

          return (
            <div key={categoryId}>
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {categoryNews[0]?.category?.categoryName || 'Uncategorized'}
                </h2>
                <div className="h-1 w-20 bg-blue-600 rounded"></div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollSlider(categoryId, 'left')}
                  className={`flex-shrink-0 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-all ${
                    canLeft ? 'opacity-100 cursor-pointer' : 'opacity-25 cursor-default pointer-events-none'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div
                  ref={(el) => {
                    if (el) sliderRefs.current.set(categoryId, el);
                    else sliderRefs.current.delete(categoryId);
                  }}
                  onScroll={() => handleSliderScroll(categoryId)}
                  className="section-slider flex-1 flex gap-5 overflow-x-auto scroll-smooth pb-2"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {categoryNews.map(item => (
                    <Link
                      key={item.id}
                      href={`/news-by-movesbook/${item.id}`}
                      className="flex-shrink-0 w-72 bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group"
                    >
                      <div className="relative h-48">
                        {item.image ? (
                          <Image
                            src={item.image || ''}
                            alt={getNewsTitle(item)}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-300"></div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {getNewsTitle(item)}
                        </h3>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.user && <AuthorAvatar item={item} size="sm" />}
                            <span className="truncate">{t('news_by')} {item.user?.username || item.author || item.originalAuthor || 'private'}</span>
                          </div>
                          <span className="flex items-center gap-1 flex-shrink-0 ml-2">
                            <Calendar className="w-3 h-3" />
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => scrollSlider(categoryId, 'right')}
                  className={`flex-shrink-0 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-all ${
                    canRight ? 'opacity-100 cursor-pointer' : 'opacity-25 cursor-default pointer-events-none'
                  }`}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (mode === 'browser') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {news.map((item) => {
          const authorName = item.author || item.originalAuthor || 'private';
          const contentPreview = getContentPreview(item, currentLanguage, true);

          return (
            <Link
              key={item.id}
              href={`/news-by-movesbook/${item.id}`}
              className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group"
            >
              {item.image && (
                <div className="relative h-40">
                  <Image
                    src={item.image || ''}
                    alt={getNewsTitle(item)}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  {item.category && (
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      {item.category.categoryName}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {getNewsTitle(item)}
                </h3>
                {contentPreview && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {contentPreview}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    {item.user && <AuthorAvatar item={item} size="sm" />}
                    <span>{t('news_by')} {item.user?.username || authorName}</span>
                  </div>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {news.map((item) => {
        const authorName = item.author || item.originalAuthor || 'private';
        const contentPreview = getContentPreview(item, currentLanguage, true);

        return (
          <Link
            key={item.id}
            href={`/news-by-movesbook/${item.id}`}
            className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group"
          >
            {item.image && (
              <div className="relative h-40">
                  <Image
                    src={item.image || ''}
                    alt={getNewsTitle(item)}
                    fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            )}
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                {item.category && (
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    {item.category.categoryName}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                {getNewsTitle(item)}
              </h3>
              {contentPreview && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {contentPreview}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  {item.user && <AuthorAvatar item={item} size="sm" />}
                  <span>{t('news_by')} {item.user?.username || authorName}</span>
                </div>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(item.createdAt)}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
