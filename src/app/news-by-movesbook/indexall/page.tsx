'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Plus, Edit, Trash2, Globe, ChevronDown, Eye } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { DOCUMENT_TYPES } from '@/lib/news/mappings';
import { resolveIsSuperAdminFromStorage } from '@/lib/panelSession';

interface NewsItem {
  id: string;
  title: string | null;
  section: string | null;
  image: string | null;
  documentType: string | null;
  date: string;
  langValueId: string | null;
  writerUsername: string | null;
  author: string | null;
  originalAuthor: string | null;
  method: string | null;
  category: {
    categoryName: string;
  } | null;
  originalLanguage: {
    name: string;
  } | null;
  inGlobalNews?: boolean;
}

interface Category {
  id: string;
  categoryName: string;
}

interface Language {
  id: string;
  code: string;
  name: string;
}

const getFlagFileName = (code: string): string => {
  const flagMap: Record<string, string> = {
    'en': 'en.png',
    'fr': 'fr.png',
    'de': 'de.png',
    'it': 'it.png',
    'es': 'es.png',
    'pt': 'por.png',
    'ru': 'rus.png',
    'hi': 'ind.png',
    'zh': 'chin.png',
    'ar': 'arab.png',
    'ja': 'jap.png',
    'id': 'id.png',
  };
  return flagMap[code] || 'en.png';
};

function resolveNewsLogoSrc(image: string | null | undefined): string | null {
  if (!image?.trim()) return null;
  const value = image.trim();
  if (value.startsWith('/') || value.startsWith('http')) return value;
  return `/img/news/${value}`;
}

const SHOW_LOGO_STORAGE_KEY = 'newsArchiveShowLogo';

export default function NewsIndexAllPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [globalNewsLoadingId, setGlobalNewsLoadingId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filteredNews, setFilteredNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [paginationData, setPaginationData] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const [showLogo, setShowLogo] = useState(false);

  const getDocumentTypeLabel = (value: string | null): string => {
    if (!value) return '-';
    const type = DOCUMENT_TYPES.find(t => t.value === value);
    return type ? type.label : value;
  };

  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [filters, setFilters] = useState({
    search: '',
    section: '',
    documentType: '',
    fromDate: '',
    toDate: '',
    language: '',
    method: '',
    categoryId: '',
  });

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: value }));
    }, 500);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setShowLangDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(SHOW_LOGO_STORAGE_KEY) === 'true') {
        setShowLogo(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleShowLogoChange = (checked: boolean) => {
    setShowLogo(checked);
    try {
      localStorage.setItem(SHOW_LOGO_STORAGE_KEY, checked ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const checkAdminAuth = () => {
      try {
        const adminData = localStorage.getItem('adminUser');
        if (adminData) {
          const parsed = JSON.parse(adminData);
          setAdminUser(parsed);
        }
        setIsSuperAdmin(resolveIsSuperAdminFromStorage());
      } catch (error) {
        console.error('Error parsing admin user:', error);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAdminAuth();
  }, []);

  useEffect(() => {
    if (!loading && !authLoading) {
      const isAdmin = (user && user.userType === 'ADMIN') || (adminUser && adminUser.userType === 'ADMIN');
      if (!isAdmin) {
        router.push('/');
      }
    }
  }, [user, adminUser, loading, authLoading, router]);

  const fetchData = async () => {
    try {
      const [categoriesRes, languagesRes] = await Promise.all([
        fetch('/api/public/news/categories'),
        fetch('/api/public/news/languages'),
      ]);
      if (categoriesRes.ok) setCategories((await categoriesRes.json()) || []);
      if (languagesRes.ok) setLanguages((await languagesRes.json()) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchNews = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (filters.search) params.append('search', filters.search);
      if (filters.section) params.append('section', filters.section);
      if (filters.documentType) params.append('documentType', filters.documentType);
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);
      if (filters.language) params.append('language', filters.language);
      if (filters.method) params.append('method', filters.method);
      if (filters.categoryId) params.append('categoryId', filters.categoryId);

      const res = await fetch(`/api/news?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch news');

      const data = await res.json();
      setNews(data.news || []);
      setFilteredNews(data.news || []);
      setTotalPages(data.pagination?.totalPages || 1);
      if (data.pagination) setPaginationData(data.pagination);

      const uniqueSections = Array.from(new Set<string>(
        (data.news || []).map((item: NewsItem) => item.section).filter((s: string | null): s is string => s !== null)
      ));
      setSections(uniqueSections);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    const isAdmin = (user && user.userType === 'ADMIN') || (adminUser && adminUser.userType === 'ADMIN');
    if (isAdmin && !authLoading) fetchData();
  }, [user, adminUser, authLoading]);

  useEffect(() => {
    const isAdmin = (user && user.userType === 'ADMIN') || (adminUser && adminUser.userType === 'ADMIN');
    if (isAdmin && !authLoading) setPage(1);
  }, [filters, user, adminUser, authLoading]);

  useEffect(() => {
    const isAdmin = (user && user.userType === 'ADMIN') || (adminUser && adminUser.userType === 'ADMIN');
    if (isAdmin && !authLoading) fetchNews();
  }, [page, filters, user, adminUser, authLoading, fetchNews]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this news article?')) return;
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const res = await fetch(`/api/news/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete news');
      fetchNews();
    } catch (error) {
      console.error('Error deleting news:', error);
      alert('Failed to delete news article');
    }
  };

  const handleToggleGlobalNews = async (id: string, currentlyShared: boolean) => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      alert('Super admin login required');
      return;
    }
    setGlobalNewsLoadingId(id);
    try {
      const res = await fetch(`/api/admin/global-news/news/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inGlobalNews: !currentlyShared }),
      });
      if (!res.ok) throw new Error('Failed to update Global News');
      const next = !currentlyShared;
      setNews((prev) => prev.map((n) => (n.id === id ? { ...n, inGlobalNews: next } : n)));
      setFilteredNews((prev) => prev.map((n) => (n.id === id ? { ...n, inGlobalNews: next } : n)));
    } catch (error) {
      console.error('Error updating global news:', error);
      alert('Failed to update Global News');
    } finally {
      setGlobalNewsLoadingId(null);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-full flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const selectedLang = languages.find(l => l.id === filters.language);

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('news_archive')}</h1>
          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showLogo}
                onChange={(e) => handleShowLogoChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{t('news_display_picture')}</span>
            </label>
            {isSuperAdmin && (
              <Link
                href="/news-by-movesbook"
                className="flex items-center justify-center px-3 sm:px-4 py-2 border border-gray-300 text-blue-600 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base w-full sm:w-auto whitespace-nowrap"
              >
                {t('news_preview_front_end_users')}
              </Link>
            )}
            <Link
              href="/news-by-movesbook/add"
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{t('news_add_article')}</span>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

            {/* Search */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('btn_search')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('news_search_placeholder')}
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('news_section')}</label>
              <select
                value={filters.section}
                onChange={(e) => setFilters(prev => ({ ...prev, section: e.target.value }))}
                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" className="text-gray-900">{t('news_all')} {t('news_section')}s</option>
                {sections.map((section) => (
                  <option key={section} value={section} className="text-gray-900">{section}</option>
                ))}
              </select>
            </div>

            {/* Document Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('news_document_type')}</label>
              <select
                value={filters.documentType}
                onChange={(e) => setFilters(prev => ({ ...prev, documentType: e.target.value }))}
                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" className="text-gray-900">{t('news_all')} {t('news_document_type')}s</option>
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value} className="text-gray-900">{type.label}</option>
                ))}
              </select>
            </div>

            {/* Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('news_method')}</label>
              <select
                value={filters.method}
                onChange={(e) => setFilters(prev => ({ ...prev, method: e.target.value }))}
                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" className="text-gray-900">{t('news_all')} {t('news_method')}s</option>
                <option value="Typed" className="text-gray-900">Typed</option>
                <option value="Pasted" className="text-gray-900">Pasted</option>
                <option value="Shared" className="text-gray-900">Shared</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('news_from_date')}</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('news_to_date')}</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Language — flag picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('news_language')}</label>
              <div className="relative" ref={langDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {selectedLang ? (
                    <>
                      <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0 relative">
                        <Image
                          src={`/flags/${getFlagFileName(selectedLang.code)}`}
                          alt={selectedLang.name}
                          fill
                          sizes="20px"
                          className="object-cover"
                        />
                      </div>
                      <span className="flex-1 text-left text-sm">{selectedLang.name}</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 text-left text-sm text-gray-500">{t('news_all')} {t('news_language')}s</span>
                    </>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>

                {showLangDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => { setFilters(prev => ({ ...prev, language: '' })); setShowLangDropdown(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors ${filters.language === '' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                    >
                      <Globe className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium flex-1 text-left">{t('news_all')} {t('news_language')}s</span>
                      {filters.language === '' && <span className="text-blue-600 text-xs">✓</span>}
                    </button>
                    {languages.map((lang) => (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => { setFilters(prev => ({ ...prev, language: lang.id })); setShowLangDropdown(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors ${filters.language === lang.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                      >
                        <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0 relative">
                          <Image
                            src={`/flags/${getFlagFileName(lang.code)}`}
                            alt={lang.name}
                            fill
                            sizes="20px"
                            className="object-cover"
                          />
                        </div>
                        <span className="text-sm font-medium flex-1 text-left">{lang.name}</span>
                        {filters.language === lang.id && <span className="text-blue-600 text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('news_category')}</label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters(prev => ({ ...prev, categoryId: e.target.value }))}
                className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" className="text-gray-900">{t('news_all_categories')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id} className="text-gray-900">{category.categoryName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Writer Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Options</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : filteredNews.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      No news articles found
                    </td>
                  </tr>
                ) : (
                  filteredNews.map((item) => {
                    const logoSrc = showLogo ? resolveNewsLogoSrc(item.image) : null;
                    return (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onDoubleClick={() => router.push(`/news-by-movesbook/${item.id}`)}
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {showLogo ? (
                          <div className="flex flex-col gap-1.5">
                            {logoSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={logoSrc}
                                alt=""
                                className="h-12 w-16 rounded border border-gray-200 object-cover bg-gray-50"
                              />
                            ) : (
                              <div className="flex h-12 w-16 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-[10px] text-gray-400">
                                No image
                              </div>
                            )}
                            {item.section ? (
                              <span className="text-xs text-gray-600">{item.section}</span>
                            ) : null}
                          </div>
                        ) : (
                          item.section || '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{item.title || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.category?.categoryName || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{getDocumentTypeLabel(item.documentType)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.originalLanguage?.name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.author || item.originalAuthor || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.method || '-'}</td>
                      <td className="px-6 py-4 text-sm" onDoubleClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/news-by-movesbook/${item.id}`}
                            className="text-gray-500 hover:text-gray-800 transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/news-by-movesbook/edit/${item.id}`}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleToggleGlobalNews(item.id, item.inGlobalNews === true)
                              }
                              disabled={globalNewsLoadingId === item.id}
                              className={`transition-colors disabled:opacity-50 ${
                                item.inGlobalNews
                                  ? 'text-teal-950 hover:text-black'
                                  : 'text-gray-500 hover:text-teal-800'
                              }`}
                              title={
                                item.inGlobalNews
                                  ? 'Shared in Global News (click to remove)'
                                  : 'Share in Global News'
                              }
                              aria-label={
                                item.inGlobalNews ? 'Remove from Global News' : 'Share in Global News'
                              }
                            >
                              <Globe
                                className={`w-4 h-4 ${item.inGlobalNews ? 'fill-teal-950/25' : ''}`}
                                strokeWidth={item.inGlobalNews ? 2.5 : 2}
                              />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Showing {news.length > 0 ? ((page - 1) * 20 + 1) : 0} to {Math.min(page * 20, paginationData?.total || 0)} of {paginationData?.total || 0} results
              </div>
              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm"
                    title="First page"
                  >
                    ««
                  </button>
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {(() => {
                      const pages: (number | string)[] = [];
                      const adjacents = 2;
                      if (totalPages <= 7 + (adjacents * 2)) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
                        if (page < 1 + (adjacents * 2)) {
                          for (let i = 1; i < 4 + (adjacents * 2); i++) pages.push(i);
                          pages.push('...');
                          pages.push(totalPages - 1);
                          pages.push(totalPages);
                        } else if (totalPages - (adjacents * 2) > page && page > (adjacents * 2)) {
                          pages.push(1);
                          pages.push(2);
                          pages.push('...');
                          for (let i = page - adjacents; i <= page + adjacents; i++) pages.push(i);
                          pages.push('...');
                          pages.push(totalPages - 1);
                          pages.push(totalPages);
                        } else {
                          pages.push(1);
                          pages.push(2);
                          pages.push('...');
                          for (let i = totalPages - (2 + (adjacents * 2)); i <= totalPages; i++) pages.push(i);
                        }
                      }
                      return pages.map((p, idx) => {
                        if (p === '...') {
                          return <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>;
                        }
                        const pageNum = p as number;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`px-3 py-2 min-w-[40px] border rounded-lg transition-colors text-sm ${
                              page === pageNum
                                ? 'bg-blue-600 text-white border-blue-600 font-medium'
                                : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      });
                    })()}
                  </div>

                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-sm"
                    title="Last page"
                  >
                    »»
                  </button>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
