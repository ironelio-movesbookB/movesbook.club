'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Share2, Globe, Calendar, User, Facebook, Twitter, Linkedin, MessageCircle, Send, Link2, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { deserializeMultiLanguageContent, getContentForLanguage } from '@/lib/news/contentParser';
import { resolveIsSuperAdminFromStorage } from '@/lib/panelSession';
import SocialShareModal from './SocialShareModal';
import PostToMovesbookModal from './PostToMovesbookModal';
import NewsComments from './NewsComments';
import '@/app/news-content.css';

interface NewsDetailProps {
  newsId: string;
}

interface NewsData {
  id: string;
  title: string | null;
  content: string;
  image: string | null;
  bannerImage: string | null;
  createdAt: string;
  date: string;
  author: string | null;
  originalAuthor: string | null;
  mode: string | null;
  internetLink: string | null;
  internetLinkEditor: string | null;
  pageOption: string | null;
  searchingKeywords: string | null;
  visualizeInReadingPageAuthorName: string;
  visualizeInReadingPageActualAuthorName: string;
  checkedBanner: string;
  showWriterImage: boolean;
  writerImage: string | null;
  reshareDisabled: boolean;
  category: {
    id: string;
    categoryName: string;
  } | null;
  originalLanguage: {
    id: string;
    code: string;
    name: string;
  } | null;
  languageTitles: Array<{
    title: string;
    language: {
      id: string;
      code: string;
      name: string;
    };
  }>;
  settings: Array<{
    reshare: boolean;
    sports: Array<{
      sport: string;
    }>;
    functions?: {
      commentOption?: string;
      [key: string]: any;
    };
  }>;
  relatedArticles: Array<{
    id: string;
    title: string | null;
    image: string | null;
    createdAt: string;
    section: string | null;
  }>;
}

export default function NewsDetail({ newsId }: NewsDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [news, setNews] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [availableLanguages, setAvailableLanguages] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [allLanguages, setAllLanguages] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [postToMovesbookModalOpen, setPostToMovesbookModalOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const hasFetchedLanguagesRef = useRef(false);
  const hasFetchedNewsRef = useRef(false);
  const fetchingNewsRef = useRef(false);
  const currentNewsIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      setIsSuperAdmin(resolveIsSuperAdminFromStorage());
    } catch {
      setIsSuperAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetchedLanguagesRef.current) return;
    hasFetchedLanguagesRef.current = true;

    const fetchLanguages = async () => {
      try {
        const res = await fetch('/api/public/news/languages');
        if (res.ok) {
          const languages = await res.json();
          setAllLanguages(languages);
        }
      } catch (error) {
        console.error('Error fetching languages:', error);
      }
    };
    fetchLanguages();
  }, []);

  useEffect(() => {
    const langParam = searchParams?.get('lang');
    if (langParam) {
      const language = allLanguages.find(l => l.code === langParam || l.id === langParam);
      if (language) {
        setSelectedLanguage(language.code);
      }
    }
  }, [searchParams, allLanguages]);

  useEffect(() => {
    if (currentNewsIdRef.current !== newsId) {
      hasFetchedNewsRef.current = false;
      currentNewsIdRef.current = newsId;
    }

    if (hasFetchedNewsRef.current || fetchingNewsRef.current) return;
    if (!newsId) return;

    const fetchNews = async () => {
      fetchingNewsRef.current = true;
      hasFetchedNewsRef.current = true;
      setLoading(true);
      try {
        const res = await fetch(`/api/public/news/${newsId}`);
        if (res.ok) {
          const data = await res.json();
          setNews(data);
          
          if (allLanguages.length > 0) {
            const langs: Array<{ id: string; code: string; name: string }> = [];
            const addedCodes = new Set<string>();
            
            if (data.languageTitles && data.languageTitles.length > 0) {
              data.languageTitles.forEach((lt: any) => {
                if (lt.language && lt.language.code && !addedCodes.has(lt.language.code)) {
                  const language = allLanguages.find(l => l.code === lt.language.code);
                  if (language) {
                    langs.push({ id: language.id, code: language.code, name: language.name });
                    addedCodes.add(lt.language.code);
                  }
                }
              });
            }
            
            if (data.content) {
              const contentObj = deserializeMultiLanguageContent(data.content);
              Object.keys(contentObj).forEach(code => {
                if (contentObj[code] && contentObj[code].trim() !== '' && !addedCodes.has(code)) {
                  const language = allLanguages.find(l => l.code === code);
                  if (language) {
                    langs.push({ id: language.id, code: language.code, name: language.name });
                    addedCodes.add(code);
                  }
                }
              });
            }
            
            if (langs.length === 0 && allLanguages.length > 0) {
              const defaultLang = allLanguages.find(l => (l as any).isDefault) || allLanguages[0];
              if (defaultLang) {
                langs.push({ id: defaultLang.id, code: defaultLang.code, name: defaultLang.name });
              }
            }
            
            setAvailableLanguages(langs);
            
            if (langs.length > 0 && !selectedLanguage) {
              setSelectedLanguage(langs[0].code);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching news:', error);
      } finally {
        setLoading(false);
        fetchingNewsRef.current = false;
      }
    };

    fetchNews();
  }, [newsId, allLanguages, selectedLanguage]);

  const handleLanguageChange = (langCode: string) => {
    setSelectedLanguage(langCode);
    
    const params = new URLSearchParams(window.location.search);
    params.set('lang', langCode);
    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
  };

  const getDisplayContent = () => {
    if (!news) return '';
    
    if (news.mode === 'url') {
      return news.internetLinkEditor || '';
    }
    
    if (!news.content) return '';
    return getContentForLanguage(news.content, selectedLanguage);
  };

  const getNewsTitle = () => {
    if (!news) return '';
    
    if (news.languageTitles && news.languageTitles.length > 0) {
      const langTitle = news.languageTitles.find(
        (lt) => lt.language.code === selectedLanguage
      );
      if (langTitle && langTitle.title && langTitle.title.trim() !== '') {
        return langTitle.title;
      }
    }
    return news.title || '';
  };


  const getSportName = () => {
    if (!news || !news.settings || news.settings.length === 0) return null;
    const firstSetting = news.settings[0];
    if (firstSetting.sports && firstSetting.sports.length > 0) {
      return firstSetting.sports[0].sport;
    }
    return null;
  };

  const getAuthorName = () => {
    if (!news) return 'private';
    
    if (news.visualizeInReadingPageAuthorName === 'Y') {
      return news.author || 'private';
    } else if (news.visualizeInReadingPageActualAuthorName === 'Y') {
      return news.originalAuthor || 'private';
    }
    return 'private';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
    return `${day}${suffix} ${date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
          <p className="text-gray-600">{t('news_loading')}</p>
        </div>
      </div>
    );
  }

  if (!news) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 text-center">
          <p className="text-gray-600">{t('news_no_news_found')}</p>
        </div>
      </div>
    );
  }

  const sportName = getSportName();
  const authorName = getAuthorName();
  const displayContent = getDisplayContent();
  const newsTitle = getNewsTitle();

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 md:mb-6">
          <Link
            href="/news-by-movesbook"
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('news_back_to_news')}</span>
          </Link>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            {availableLanguages.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Globe className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <select
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  value={selectedLanguage || availableLanguages[0]?.code || 'en'}
                  className="flex-1 sm:flex-none px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  {availableLanguages.map((lang) => (
                    <option key={lang.id} value={lang.code} className="text-gray-900">
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isSuperAdmin && (
              <Link
                href={`/news-by-movesbook/edit/${news.id}`}
                className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors w-full sm:w-auto"
                aria-label={t('news_edit_article_btn')}
              >
                {t('news_edit_article_btn')}
              </Link>
            )}

            {news.settings[0]?.reshare && !news.reshareDisabled && (
              <button
                onClick={() => setShareModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors w-full sm:w-auto"
                aria-label="Share this article"
              >
                <Share2 className="w-4 h-4" />
                <span>{t('news_share_article')}</span>
              </button>
            )}
          </div>
        </div>

        <div className="border-b border-gray-200 pb-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            {news.category && (
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
                {news.category.categoryName}
              </span>
            )}
            {sportName && (
              <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-lg">
                {sportName}
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">
            {news.mode === 'url' ? (
              <a
                href={news.internetLink || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (news.pageOption === '1') {
                    e.preventDefault();
                    window.open(news.internetLink || '', '_blank');
                  }
                }}
                className="text-blue-600 hover:text-blue-700 hover:underline"
              >
                {newsTitle}
              </a>
            ) : (
              newsTitle
            )}
          </h1>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{t('news_posted')}: {formatDate(news.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              {news.showWriterImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={news.writerImage || '/img/placeholder.png'}
                  alt="Writer"
                  className="w-6 h-6 rounded-full object-cover border border-gray-300"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/img/placeholder.png'; }}
                />
              ) : (
                <User className="w-4 h-4" />
              )}
              <span>{t('news_by')} {authorName}</span>
            </div>
            {news.author && (
              <div className="text-gray-500">
                {t('news_author')}: {news.author}
              </div>
            )}
          </div>
        </div>

        {(news.checkedBanner === 'Y' && news.bannerImage) || news.image ? (
          <div className="mb-6 md:mb-8">
            {news.checkedBanner === 'Y' && news.bannerImage ? (
              <div className="relative w-full h-48 sm:h-64 md:h-96 rounded-lg overflow-hidden">
                <Image
                  src={news.bannerImage}
                  alt={newsTitle}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 1200px"
                />
              </div>
            ) : news.image ? (
              <div className="flex justify-center">
                <div className="relative w-full max-w-md h-48 sm:h-56 md:h-64 rounded-lg overflow-hidden">
                  <Image
                    src={news.image}
                    alt={newsTitle}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 500px"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="prose prose-lg max-w-none">
          {displayContent && (
            <div 
              dangerouslySetInnerHTML={{ __html: displayContent }} 
              className="news-content text-gray-800 text-base leading-relaxed"
            />
          )}

          {news.mode === 'url' && news.internetLink && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-600 mb-2">{t('news_external_link')}:</p>
              <a
                href={news.internetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 hover:underline break-all"
              >
                {news.internetLink}
              </a>
            </div>
          )}

          {news.originalAuthor && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">{t('news_original_author')}:</span> {news.originalAuthor}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5">
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1.5">
          {t('news_disclaimer_title')}
        </p>
        <p className="text-xs text-amber-700 leading-relaxed">
          {t('news_disclaimer_body')}
        </p>
      </div>

      {/* Social share bar */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 px-4 sm:px-6 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {t('news_share')}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {/* Facebook */}
          <button
            onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`, '_blank')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1877F2] hover:bg-[#166fe5] text-white text-sm font-medium transition-colors"
            aria-label="Share on Facebook"
          >
            <Facebook className="w-4 h-4" />
            <span>Facebook</span>
          </button>

          {/* X / Twitter */}
          <button
            onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(newsTitle)}`, '_blank')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black hover:bg-gray-800 text-white text-sm font-medium transition-colors"
            aria-label="Share on X"
          >
            <Twitter className="w-4 h-4" />
            <span>X</span>
          </button>

          {/* LinkedIn */}
          <button
            onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`, '_blank')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A66C2] hover:bg-[#0958a8] text-white text-sm font-medium transition-colors"
            aria-label="Share on LinkedIn"
          >
            <Linkedin className="w-4 h-4" />
            <span>LinkedIn</span>
          </button>

          {/* WhatsApp */}
          <button
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(newsTitle + ' ' + (typeof window !== 'undefined' ? window.location.href : ''))}`, '_blank')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium transition-colors"
            aria-label="Share on WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

          {/* Telegram */}
          <button
            onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${encodeURIComponent(newsTitle)}`, '_blank')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#229ED9] hover:bg-[#1a8fbf] text-white text-sm font-medium transition-colors"
            aria-label="Share on Telegram"
          >
            <Send className="w-4 h-4" />
            <span>Telegram</span>
          </button>

          {/* Copy link */}
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              } catch { /* silent */ }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
            aria-label="Copy link"
          >
            {linkCopied ? <Check className="w-4 h-4 text-green-600" /> : <Link2 className="w-4 h-4" />}
            <span>{linkCopied ? 'Copied!' : 'Copy link'}</span>
          </button>
        </div>
      </div>

      <NewsComments newsId={news.id} enabled={news.settings?.[0]?.functions?.commentOption === 'Y'} />

      {news.relatedArticles && news.relatedArticles.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 md:mb-6">Related Articles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {news.relatedArticles.map((article) => (
              <Link
                key={article.id}
                href={`/news/${article.id}`}
                className="block bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
              >
                {article.image && (
                  <div className="relative w-full h-48 overflow-hidden">
                    <Image
                      src={article.image}
                      alt={article.title || 'Article'}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-xs text-gray-500">{formatDate(article.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <SocialShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        articleUrl={typeof window !== 'undefined' ? window.location.href : ''}
        articleTitle={newsTitle}
        articleImage={news?.bannerImage || news?.image || null}
        onPostToMovesbook={() => {
          setShareModalOpen(false);
          setPostToMovesbookModalOpen(true);
        }}
      />

      <PostToMovesbookModal
        isOpen={postToMovesbookModalOpen}
        onClose={() => setPostToMovesbookModalOpen(false)}
        articleId={news.id}
        articleTitle={newsTitle}
        articleImage={news?.bannerImage || news?.image || null}
      />
    </div>
  );
}
