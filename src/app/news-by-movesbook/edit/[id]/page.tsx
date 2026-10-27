'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Save, Upload, X, CheckCircle, AlertCircle, Settings, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { PROFILE_SPORT_OPTIONS } from '@/lib/profileSports';
import { resolveIsSuperAdminFromStorage } from '@/lib/panelSession';
import { phpUnserialize } from '@/lib/news/phpUnserialize';
import { DOCUMENT_TYPES, PRIORITY_OPTIONS, DISPLAY_MODE_OPTIONS } from '@/lib/news/mappings';
import { COUNTRIES_WITH_CODES } from '@/lib/news/countries';

const CKEditorComponent = dynamic(() => import('@/components/news/CKEditor'), {
  ssr: false,
});

export default function EditNewsPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loadingNews, setLoadingNews] = useState(true);
  const [categories, setCategories] = useState<Array<{ id: string; categoryName: string }>>([]);
  const [languages, setLanguages] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [sports, setSports] = useState<Array<{ id: string; name: string }>>([]);
  const [countries, setCountries] = useState<Array<{ id: string; name: string }>>([]);
  const [writerVerifying, setWriterVerifying] = useState(false);
  const [writerVerified, setWriterVerified] = useState(false);
  const [writerVerificationError, setWriterVerificationError] = useState<string | null>(null);
  const [writerImage, setWriterImage] = useState<string | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [fetchingOG, setFetchingOG] = useState(false);
  const [ogData, setOgData] = useState<{ title?: string; description?: string; image?: string } | null>(null);
  const [ogError, setOgError] = useState<string | null>(null);
  
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [languageContents, setLanguageContents] = useState<Record<string, string>>({});
  const [languageTitles, setLanguageTitles] = useState<Record<string, string>>({});
  const [relatedArticles, setRelatedArticles] = useState<Array<{ id: string; title: string; categoryName: string }>>([]);
  const [availableArticles, setAvailableArticles] = useState<Array<{ id: string; title: string; categoryName: string }>>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'display' | 'related'>('display');
  const [relatedPage, setRelatedPage] = useState(1);
  const [relatedPerPage, setRelatedPerPage] = useState(5);
  const [userTypes, setUserTypes] = useState<Array<{ id: string; name: string }>>([]);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    langValueId: '',
    documentType: 'articles',
    title: '',
    newsCategoryId: '',
    section: '',
    mode: 'content',
    internetLink: '',
    internetLinkEditor: '',
    pageOption: '1',
    displayMode: '1',
    searchingKeywords: '',
    method: 'Typed',
    priority: 'middle',
    feturedNews: false,
    briefDesc: '',
    inLastNews: false,
    checkedBanner: false,
    visualizeInReadingPageAuthorName: false,
    visualizeInReadingPageActualAuthorName: false,
    shareEnable: false,
    shareCommentOption: false,
    editableAdmin: false,
    editableOperators: false,
    editableUsers: false,
    editableTranslators: false,
    enableCheck: false,
    favArticleAuthor: false,
    writerUsername: '',
    writerPassword: '',
    showWriterImage: false,
    image: null as string | null,
    bannerImage: null as string | null,
    settings: {
      duration: '',
      reshare: false,
      sports: [] as string[],
      roles: [] as string[],
      languages: [] as string[],
      countries: [] as string[],
      functions: {
        commentOption: false,
        likeButton: false,
        unlikeButton: false,
        shareTf: false,
        otherSetting: false,
        rankingButton: false,
        sendByEmail: false,
        exportInPdf: false,
        downloadDocument: false,
        printOption: false,
      },
    },
  });

  const newsId = params?.id as string;
  const hasFetchedRef = useRef(false);
  const fetchingRef = useRef(false);
  const currentNewsIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentNewsIdRef.current !== newsId) {
      hasFetchedRef.current = false;
      fetchingRef.current = false;
      currentNewsIdRef.current = newsId;
    }
  }, [newsId]);

  useEffect(() => {
    if (loading) return;
    
    if (typeof window === 'undefined') return;
    
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      if (!token && !user) {
        router.push('/');
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
    }
  }, [user, loading, router]);

  const fetchDataRef = useRef(false);

  useEffect(() => {
    if (loading || fetchDataRef.current) return;
    
    const fetchData = async () => {
      if (typeof window === 'undefined') return;
      
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) return;
        
        fetchDataRef.current = true;
        
        const [categoriesRes, languagesRes, userTypesRes] = await Promise.all([
          fetch('/api/public/news/categories'),
          fetch('/api/public/news/languages'),
          fetch('/api/public/user-types'),
        ]);
        
        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          setCategories(data || []);
        }
        
        if (languagesRes.ok) {
          const data = await languagesRes.json();
          setLanguages(data || []);
        }

        if (userTypesRes.ok) {
          const userTypesData = await userTypesRes.json();
          setUserTypes(userTypesData || []);
        }

        setCountries(COUNTRIES_WITH_CODES);
      } catch (error) {
        console.error('Error fetching data:', error);
        fetchDataRef.current = false;
      }
    };
    
    fetchData();
  }, [loading]);

  useEffect(() => {
    const fetchNews = async () => {
      if (!newsId) {
        setLoadingNews(false);
        return;
      }

      if (typeof window === 'undefined') {
        return;
      }

      if (hasFetchedRef.current || fetchingRef.current) {
        return;
      }

      try {
        let token: string | null = null;
        let currentUserId: string | null = null;
        let canEditAnyArticle = false;
        try {
          token = localStorage.getItem('token') || localStorage.getItem('adminToken');
          const adminUserData = localStorage.getItem('adminUser');
          if (adminUserData) {
            const adminUser = JSON.parse(adminUserData);
            currentUserId = adminUser.id;
            canEditAnyArticle =
              resolveIsSuperAdminFromStorage(adminUser) || adminUser.userType === 'ADMIN';
          } else if (user) {
            currentUserId = user.id;
            canEditAnyArticle = user.userType === 'ADMIN';
          }
          if (!canEditAnyArticle) {
            canEditAnyArticle = resolveIsSuperAdminFromStorage();
          }
        } catch (error) {
          console.error('Error accessing localStorage:', error);
        }

        if (!token) {
          setLoadingNews(false);
          return;
        }

        fetchingRef.current = true;
        setLoadingNews(true);
        
        const res = await fetch(`/api/news/${newsId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          setLoadingNews(false);
          if (res.status === 404) {
            router.push('/news-by-movesbook/indexall');
            return;
          }
          throw new Error('Failed to fetch news');
        }

        const newsData = await res.json();
        
        // Super Admin / Admin can edit any article from News Archive
        if (
          !canEditAnyArticle &&
          currentUserId &&
          newsData.userId &&
          newsData.userId !== currentUserId
        ) {
          setLoadingNews(false);
          router.push('/news-by-movesbook/indexall');
          return;
        }

        let deserializedContent: Record<string, string> = {};
        if (newsData.content) {
          try {
            const decoded = atob(newsData.content);
            deserializedContent = phpUnserialize(decoded) || {};
          } catch (error) {
            console.error('Error deserializing content:', error);
          }
        }

        const langTitlesMap: Record<string, string> = {};
        if (newsData.languageTitles && Array.isArray(newsData.languageTitles)) {
          newsData.languageTitles.forEach((lt: any) => {
            if (lt.language && lt.language.id) {
              langTitlesMap[lt.language.id] = lt.title || '';
            }
          });
        }

        const relatedArticlesList: Array<{ id: string; title: string; categoryName: string }> = [];
        if (newsData.relatedArticles && Array.isArray(newsData.relatedArticles)) {
          newsData.relatedArticles.forEach((ra: any) => {
            if (ra.article) {
              relatedArticlesList.push({
                id: ra.article.id,
                title: ra.article.title || '',
                categoryName: ''
              });
            }
          });
        }

        const settingsData = newsData.settings && Array.isArray(newsData.settings) && newsData.settings.length > 0 ? newsData.settings[0] : {};
        const functionsData = settingsData.functions ? (typeof settingsData.functions === 'string' ? JSON.parse(settingsData.functions) : settingsData.functions) : {};

        const durationDate = settingsData.duration ? (() => {
          const durationDays = settingsData.duration;
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + durationDays);
          return targetDate.toISOString().split('T')[0];
        })() : '';

        const langValueId = newsData.langValueId || newsData.originalLanguage?.id || '';

        setFormData({
            date: newsData.date ? new Date(newsData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            langValueId: langValueId,
            documentType: newsData.documentType || 'articles',
            title: newsData.title || '',
            newsCategoryId: newsData.newsCategoryId || '',
            section: newsData.section || '',
            mode: newsData.mode || 'content',
            internetLink: newsData.internetLink || '',
            internetLinkEditor: newsData.internetLinkEditor || '',
            pageOption: newsData.pageOption || '1',
            displayMode: newsData.displayMode || '1',
            searchingKeywords: newsData.searchingKeywords || '',
            method: newsData.method || 'Typed',
            priority: newsData.priority || 'middle',
            feturedNews: newsData.feturedNews === 'Y',
            briefDesc: newsData.briefDesc || '',
            inLastNews: newsData.inLastNews === 'Y',
            checkedBanner: newsData.checkedBanner === 'Y',
            visualizeInReadingPageAuthorName: newsData.visualizeInReadingPageAuthorName === 'Y',
            visualizeInReadingPageActualAuthorName: newsData.visualizeInReadingPageActualAuthorName === 'Y',
            shareEnable: newsData.shareEnable === 'Y',
            shareCommentOption: newsData.shareCommentOption === 'Y',
            editableAdmin: newsData.editableAdmin === 'Y',
            editableOperators: newsData.editableOperators === 'Y',
            editableUsers: newsData.editableUsers === 'Y',
            editableTranslators: newsData.editableTranslators === 'Y',
            enableCheck: newsData.enableCheck === 'Y',
            favArticleAuthor: newsData.favArticleAuthor === 'Y',
            writerUsername: newsData.writerUsername || newsData.author || '',
            writerPassword: '',
            showWriterImage: newsData.showWriterImage === true,
            image: newsData.image || null,
            bannerImage: newsData.bannerImage || null,
            settings: {
              duration: durationDate,
              reshare: settingsData.reshare === 'Y',
              sports: settingsData.sports?.map((s: any) => s.sport || s) || [],
              roles: settingsData.roles?.map((r: any) => r.role || r) || [],
              languages: settingsData.languages?.map((l: any) => l.language?.id || l.languageId || l) || [],
              countries: settingsData.countries?.map((c: any) => c.countryCode || c) || [],
              functions: {
                commentOption: functionsData.commentOption === 'Y',
                likeButton: functionsData.likeButton === 'Y',
                unlikeButton: functionsData.unlikeButton === 'Y',
                shareTf: functionsData.shareTf === 'Y',
                otherSetting: functionsData.otherSetting === 'Y',
                rankingButton: functionsData.rankingButton === 'Y',
                sendByEmail: functionsData.sendByEmail === 'Y',
                exportInPdf: functionsData.exportInPdf === 'Y',
                downloadDocument: functionsData.downloadDocument === 'Y',
                printOption: functionsData.printOption === 'Y',
              },
            },
          });

        const mappedLanguageContents: Record<string, string> = {};
        if (Object.keys(deserializedContent).length > 0) {
          Object.keys(deserializedContent).forEach((key) => {
            const lang = languages.find(l => l.code === key);
            if (lang) {
              mappedLanguageContents[lang.id] = deserializedContent[key];
            } else {
              mappedLanguageContents[key] = deserializedContent[key];
            }
          });
        }
        setLanguageContents(mappedLanguageContents);
        setLanguageTitles(langTitlesMap);
        setRelatedArticles(relatedArticlesList);

        if (langValueId) {
          setSelectedLanguage(langValueId);
        }

        if (newsData.image) {
          setPicturePreview(newsData.image);
          setFormData(prev => ({ ...prev, image: newsData.image }));
          setPictureFile(null);
        }
        if (newsData.bannerImage) {
          setBannerPreview(newsData.bannerImage);
          setFormData(prev => ({ ...prev, bannerImage: newsData.bannerImage }));
          setBannerFile(null);
        }

        setWriterVerified(false);

        hasFetchedRef.current = true;
      } catch (error) {
        console.error('Error fetching news:', error);
        router.push('/news-by-movesbook/indexall');
      } finally {
        fetchingRef.current = false;
        setLoadingNews(false);
      }
    };

    if (!newsId) {
      setLoadingNews(false);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    fetchNews();
  }, [newsId, router, languages, user]);


  useEffect(() => {
    if (languages.length > 0 && formData.langValueId) {
      const langExists = languages.some(lang => lang.id === formData.langValueId);
      if (langExists && !selectedLanguage) {
        setSelectedLanguage(formData.langValueId);
      } else if (langExists && selectedLanguage !== formData.langValueId) {
        setSelectedLanguage(formData.langValueId);
      }
    }
  }, [languages, formData.langValueId, selectedLanguage]);

  useEffect(() => {
    if (ogData?.title) {
      const newTitle = ogData.title.trim();
      setFormData(prev => {
        if (prev.title !== newTitle) {
          return { ...prev, title: newTitle };
        }
        return prev;
      });
    }
  }, [ogData]);

  const handleFetchOGTags = async (
    e?: React.MouseEvent | React.FormEvent,
    urlOverride?: string,
  ) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if ('nativeEvent' in e && e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }

    // Prefer explicit URL (e.g. from paste) — formData can be stale in setTimeout closures
    const url = (urlOverride ?? formData.internetLink).trim();
    if (!url) {
      setOgError('Please enter a URL first');
      return;
    }

    setFetchingOG(true);
    setOgError(null);
    setOgData(null);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const res = await fetch('/api/news/fetch-og-tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          errorData = { message: `HTTP ${res.status}: ${res.statusText}` };
        }
        throw new Error(
          errorData.message || errorData.error || `HTTP ${res.status}: ${res.statusText}`,
        );
      }

      const data = await res.json();

      if (data.success && data.og_data) {
        setOgData(data.og_data);
        setOgError(null);
        
        setFormData(prev => {
          const updates: any = {
            method: 'Pasted',
            mode: 'url',
          };
          
          if (data.og_data.description) {
            updates.internetLinkEditor = data.og_data.description;
          }
          
          return { ...prev, ...updates };
        });

        if (data.og_data.description) {
          const currentMode = formData.mode;
          if (currentMode !== 'url') {
            const targetLang = selectedLanguage || formData.langValueId || (languages.length > 0 ? languages[0].id : '');
            if (targetLang) {
              setLanguageContents(prev => {
                const currentContent = prev[targetLang] || '';
                return {
                  ...prev,
                  [targetLang]: currentContent ? `${currentContent}\n\n${data.og_data.description}` : data.og_data.description,
                };
              });
              if (!selectedLanguage && targetLang) {
                setSelectedLanguage(targetLang);
              }
            } else if (languages.length > 0) {
              const firstLang = languages[0].id;
              setLanguageContents(prev => {
                const currentContent = prev[firstLang] || '';
                return {
                  ...prev,
                  [firstLang]: currentContent ? `${currentContent}\n\n${data.og_data.description}` : data.og_data.description,
                };
              });
              if (!selectedLanguage) {
                setSelectedLanguage(firstLang);
              }
            }
          }
        }

        if (data.og_data.image && !formData.inLastNews) {
          try {
            const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
            const uploadRes = await fetch('/api/news/upload-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                url: data.og_data.image,
                type: 'picture',
              }),
            });

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              if (uploadData.success && uploadData.path) {
                setPicturePreview(uploadData.path);
                setFormData(prev => ({ ...prev, image: uploadData.path }));
                setPictureFile(null);
              }
            } else {
              setPicturePreview(data.og_data.image);
              setFormData(prev => ({ ...prev, image: data.og_data.image }));
              setPictureFile(null);
            }
          } catch (error) {
            setPicturePreview(data.og_data.image);
            setFormData(prev => ({ ...prev, image: data.og_data.image }));
            setPictureFile(null);
          }
        }
      } else {
        let errorMessage = data.message || 'Failed to fetch OG tags';
        if (errorMessage.includes('blocked') || errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
          errorMessage += ' Some websites block automated requests. You can manually enter the title, description, and image.';
        }
        setOgError(errorMessage);
        setOgData(null);
      }
    } catch (error: any) {
      console.error('Error fetching OG tags:', error);
      let errorMessage = 'Failed to fetch OG tags';
      
      if (error?.message) {
        errorMessage = error.message;
      } else if (error instanceof TypeError && error.message?.includes('fetch')) {
        errorMessage = 'Network error: Unable to connect to the server. Please check your connection and try again.';
      } else {
        errorMessage = 'An unexpected error occurred while fetching OG tags. Please try again.';
      }

      if (errorMessage.includes('blocked') || errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        errorMessage += ' Some websites block automated requests. You can manually enter the title, description, and image.';
      }
      
      setOgError(errorMessage);
      setOgData(null);
    } finally {
      setFetchingOG(false);
    }
  };

  const handleVerifyWriter = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!formData.writerUsername || !formData.writerPassword) {
      setWriterVerificationError('Please enter username and password');
      return;
    }

    if (!formData.writerUsername || !formData.writerPassword) {
      setWriterVerificationError('Please enter username and password');
      return;
    }

    try {
      setWriterVerifying(true);
      setWriterVerificationError(null);
      
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      
      const res = await fetch('/api/news/verify-writer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: formData.writerUsername,
          password: formData.writerPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.verified) {
        setWriterVerificationError(data.error || 'Invalid credentials. Please check username and password.');
        setWriterVerified(false);
        return;
      }

      setWriterVerified(true);
      setWriterVerificationError(null);
      setWriterImage(data.user?.image || null);
    } catch (error) {
      console.error('Error verifying writer:', error);
      setWriterVerificationError('Failed to verify writer. Please try again.');
      setWriterVerified(false);
      setWriterImage(null);
    } finally {
      setWriterVerifying(false);
    }
  };

  const fetchAvailableArticles = async () => {
    if (availableArticles.length > 0 || loadingArticles) {
      return;
    }

    try {
      setLoadingArticles(true);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      if (!token) {
        setLoadingArticles(false);
        return;
      }

      const res = await fetch('/api/news?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        const articles = (data.news || [])
          .filter((n: any) => n.id !== newsId)
          .map((n: any) => ({
            id: n.id,
            title: n.title || '',
            categoryName: n.category?.categoryName || ''
          }));
        setAvailableArticles(articles);
      }
    } catch (error) {
      console.error('Error fetching available articles:', error);
    } finally {
      setLoadingArticles(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'picture' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const previewUrl = reader.result as string;
      if (type === 'picture') {
        setPicturePreview(previewUrl);
        setPictureFile(file);
      } else {
        setBannerPreview(previewUrl);
        setBannerFile(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (!formData.newsCategoryId) {
      alert('Please select a category');
      return;
    }

    if (!formData.langValueId) {
      alert('Please select original language');
      return;
    }

    if (!formData.writerUsername || !formData.writerPassword) {
      alert('Please enter writer credentials to verify');
      return;
    }

    if (!writerVerified) {
      alert('Please verify the writer credentials before submitting');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      
      let imagePath = formData.image || null;
      let bannerImagePath = formData.bannerImage || null;

      if (pictureFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', pictureFile);
        uploadFormData.append('type', 'picture');

        const uploadRes = await fetch('/api/news/upload-image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json();
          setSaving(false);
          alert(`Failed to upload picture: ${errorData.error || 'Unknown error'}`);
          return;
        }

        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.path) {
          imagePath = uploadData.path;
        }
      }

      if (bannerFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', bannerFile);
        uploadFormData.append('type', 'banner');

        const uploadRes = await fetch('/api/news/upload-image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: uploadFormData,
        });

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json();
          setSaving(false);
          alert(`Failed to upload banner: ${errorData.error || 'Unknown error'}`);
          return;
        }

        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.path) {
          bannerImagePath = uploadData.path;
        }
      }
      
      const submitData: any = {
        date: formData.date,
        langValueId: formData.langValueId,
        documentType: formData.documentType,
        title: formData.title,
        newsCategoryId: formData.newsCategoryId,
        section: formData.section || null,
        image: imagePath,
        bannerImage: bannerImagePath,
        content: (() => {
          const contentObj: Record<string, string> = {};
          languages.forEach((lang) => {
            const langId = lang.id;
            const langCode = lang.code;
            if (languageContents[langId]) {
              contentObj[langCode] = languageContents[langId];
            }
          });
          if (Object.keys(contentObj).length === 0) {
            const defaultLang = languages.find(l => l.id === selectedLanguage) || languages[0];
            const defaultCode = defaultLang ? defaultLang.code : 'en';
            contentObj[defaultCode] = '';
          }
          return contentObj;
        })(),
        languageTitles: languages.map((lang) => {
          return {
            languageId: lang.id,
            title: languageTitles[lang.id] || '',
          };
        }).filter(lt => lt.title),
        relatedArticleIds: relatedArticles.map(ra => ra.id),
        mode: formData.mode,
        internetLink: formData.mode === 'url' ? formData.internetLink : null,
        internetLinkEditor: formData.mode === 'url' ? formData.internetLinkEditor : null,
        pageOption: formData.mode === 'url' ? formData.pageOption : null,
        displayMode: formData.mode === 'content' ? formData.displayMode : null,
        searchingKeywords: formData.searchingKeywords || null,
        method: formData.mode === 'url' ? 'Pasted' : (formData.method || 'Typed'),
        author: formData.writerUsername || null,
        originalAuthor: null,
        priority: formData.priority,
        feturedNews: formData.feturedNews ? 'Y' : 'N',
        briefDesc: formData.feturedNews ? formData.briefDesc : null,
        inLastNews: formData.inLastNews ? 'Y' : 'N',
        checkedBanner: formData.checkedBanner ? 'Y' : 'N',
        visualizeInReadingPageAuthorName: 'N',
        visualizeInReadingPageActualAuthorName: 'N',
        shareEnable: formData.shareEnable ? 'Y' : 'N',
        shareCommentOption: formData.shareCommentOption ? 'Y' : 'N',
        editableAdmin: formData.editableAdmin ? 'Y' : 'N',
        editableOperators: formData.editableOperators ? 'Y' : 'N',
        editableUsers: formData.editableUsers ? 'Y' : 'N',
        editableTranslators: formData.editableTranslators ? 'Y' : 'N',
        enableCheck: formData.enableCheck ? 'Y' : 'N',
        favArticleAuthor: formData.favArticleAuthor ? 'Y' : 'N',
        writerUsername: formData.writerUsername || null,
        writerVerified: writerVerified,
        showWriterImage: formData.showWriterImage,
        settings: {
          duration: formData.settings.duration || null,
          reshare: formData.settings.reshare ? 'Y' : 'N',
          sports: formData.settings.sports,
          roles: formData.settings.roles,
          languages: formData.settings.languages,
          countries: formData.settings.countries,
          functions: {
            commentOption: formData.settings.functions.commentOption ? 'Y' : 'N',
            likeButton: formData.settings.functions.likeButton ? 'Y' : 'N',
            unlikeButton: formData.settings.functions.unlikeButton ? 'Y' : 'N',
            shareTf: formData.settings.functions.shareTf ? 'Y' : 'N',
            otherSetting: formData.settings.functions.otherSetting ? 'Y' : 'N',
            rankingButton: formData.settings.functions.rankingButton ? 'Y' : 'N',
            sendByEmail: formData.settings.functions.sendByEmail ? 'Y' : 'N',
            exportInPdf: formData.settings.functions.exportInPdf ? 'Y' : 'N',
            downloadDocument: formData.settings.functions.downloadDocument ? 'Y' : 'N',
            printOption: formData.settings.functions.printOption ? 'Y' : 'N',
          },
        },
      };

      const res = await fetch(`/api/news/${newsId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update news');
      }

      const result = await res.json();
      alert('News article updated successfully!');
      router.push('/news-by-movesbook/indexall');
    } catch (error) {
      console.error('Error updating news:', error);
      alert(error instanceof Error ? error.message : 'Failed to update news article');
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingNews) {
    return (
      <div className="p-6 bg-gray-50 min-h-full flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (typeof window === 'undefined') {
    return (
      <div className="p-6 bg-gray-50 min-h-full flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  let token: string | null = null;
  try {
    token = localStorage.getItem('token') || localStorage.getItem('adminToken');
  } catch (error) {
    console.error('Error accessing localStorage:', error);
  }

  if (!token && !user) {
    return (
      <div className="p-6 bg-gray-50 min-h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please log in to edit news articles</p>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Go to home page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="w-full">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/news-by-movesbook/indexall"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit News Article</h1>
            <p className="text-gray-600 mt-1">Update your news article</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md border border-gray-200 p-6 space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Original Language <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.langValueId}
                  onChange={(e) => setFormData({ ...formData, langValueId: e.target.value })}
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" className="text-gray-900">Select Language</option>
                  {languages.map((lang) => (
                    <option key={lang.id} value={lang.id} className="text-gray-900">
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.newsCategoryId}
                  onChange={(e) => setFormData({ ...formData, newsCategoryId: e.target.value })}
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" className="text-gray-900">Select Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id} className="text-gray-900">
                      {category.categoryName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Type</label>
                <select
                  value={formData.documentType}
                  onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value} className="text-gray-900">
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Original Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => setFormData(prev => ({ ...prev, section: e.target.value }))}
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter section"
                />
              </div>
            </div>
          </div>

          {(
            <div className="space-y-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <h2 className="text-lg font-semibold text-gray-900">Writer Verification Required</h2>
              </div>
              <p className="text-sm text-gray-700">
                Please verify the author credentials by entering username and password.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.writerUsername}
                    onChange={(e) => {
                      setFormData({ ...formData, writerUsername: e.target.value });
                      setWriterVerified(false);
                      setWriterVerificationError(null);
                      setWriterImage(null);
                    }}
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter author username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.writerPassword}
                    onChange={(e) => {
                      setFormData({ ...formData, writerPassword: e.target.value });
                      setWriterVerified(false);
                      setWriterVerificationError(null);
                      setWriterImage(null);
                    }}
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter author password"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleVerifyWriter(e);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  disabled={writerVerifying || writerVerified}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {writerVerifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </>
                  ) : writerVerified ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Verified
                    </>
                  ) : (
                    'Verify Writer'
                  )}
                </button>
                {writerVerified && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Writer verified successfully</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formData.showWriterImage}
                          onChange={(e) => setFormData(prev => ({ ...prev, showWriterImage: e.target.checked }))}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Show writer image on article detail page</span>
                      </label>
                      {/* Preview of the writer image */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          writerImage
                            ? (writerImage.startsWith('http') || writerImage.startsWith('/'))
                              ? writerImage
                              : `/img/profile_images/${writerImage}`
                            : '/img/placeholder.png'
                        }
                        alt="Writer"
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/img/placeholder.png'; }}
                      />
                    </div>
                  </div>
                )}
              </div>
              {writerVerificationError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span>{writerVerificationError}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Images</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Picture Logo</label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'picture')}
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {picturePreview && (
                  <div className="mt-4 relative w-64 h-48">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={picturePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="feturedNews"
                    checked={formData.feturedNews}
                    onChange={(e) => setFormData({ ...formData, feturedNews: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="feturedNews" className="text-sm text-gray-700">Allow in Featured News</label>
                </div>
                {formData.feturedNews && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Brief Description (max 35 chars)</label>
                    <input
                      type="text"
                      maxLength={35}
                      value={formData.briefDesc}
                      onChange={(e) => setFormData({ ...formData, briefDesc: e.target.value })}
                      className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="inLastNews"
                    checked={formData.inLastNews}
                    onChange={(e) => setFormData({ ...formData, inLastNews: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="inLastNews" className="text-sm text-gray-700">
                    Put this picture as default of related Content document in Last News of System Mainpage
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Banner Logo</label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    id="banner-file-input"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, 'banner')}
                    className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {bannerPreview && (
                  <div className="mt-4 relative w-full h-48">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bannerPreview} alt="Banner Preview" className="w-full h-full object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setBannerPreview(null);
                        setBannerFile(null);
                        setFormData(prev => ({ ...prev, bannerImage: null }));
                        const fileInput = document.getElementById('banner-file-input') as HTMLInputElement;
                        if (fileInput) {
                          fileInput.value = '';
                        }
                      }}
                      className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <span>Delete Banner</span>
                    </button>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="checkedBanner"
                    checked={formData.checkedBanner}
                    onChange={(e) => setFormData({ ...formData, checkedBanner: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="checkedBanner" className="text-sm text-gray-700">Display this banner</label>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Article Properties</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="text-gray-900">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="favArticleAuthor"
                  checked={formData.favArticleAuthor}
                  onChange={(e) => setFormData({ ...formData, favArticleAuthor: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="favArticleAuthor" className="text-sm text-gray-700">This is favourite article by the author</label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 border-b pb-2">Content</h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="mode"
                    value="content"
                    checked={formData.mode === 'content'}
                    onChange={(e) => {
                      const newMode = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        mode: newMode,
                        method: newMode === 'url' ? 'Pasted' : (prev.method === 'Pasted' && newMode === 'content' ? 'Typed' : prev.method),
                      }));
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-900">Content</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="mode"
                    value="url"
                    checked={formData.mode === 'url'}
                    onChange={(e) => {
                      const newMode = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        mode: newMode,
                        method: newMode === 'url' ? 'Pasted' : (prev.method === 'Pasted' && newMode === 'content' ? 'Typed' : prev.method),
                      }));
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-900">Internet Link</span>
                </label>
              </div>

              {formData.mode === 'url' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Internet Link</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="url"
                        value={formData.internetLink}
                        onChange={(e) => {
                          setFormData((prev) => ({ ...prev, internetLink: e.target.value }));
                          setOgError(null);
                          setOgData(null);
                        }}
                        onPaste={(e) => {
                          const pastedText = e.clipboardData.getData('text').trim();
                          if (pastedText && (pastedText.startsWith('http://') || pastedText.startsWith('https://'))) {
                            // Prevent browser append (avoids duplicated URL when field already has a value)
                            e.preventDefault();
                            setFormData((prev) => ({ ...prev, internetLink: pastedText }));
                            setOgError(null);
                            setOgData(null);
                            // Pass pasted URL directly — avoid stale formData from the delayed auto-fetch
                            setTimeout(() => {
                              void handleFetchOGTags(undefined, pastedText);
                            }, 200);
                          }
                        }}
                        className="flex-1 w-full sm:w-auto px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                        placeholder="https://example.com"
                      />
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className="w-full sm:w-auto"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.nativeEvent) {
                              e.nativeEvent.stopImmediatePropagation();
                            }
                            const url = formData.internetLink.trim();
                            if (!url) {
                              setOgError('Please enter a URL first');
                              return;
                            }
                            handleFetchOGTags(e, url).catch((err) => {
                              console.error('Error in handleFetchOGTags:', err);
                              setOgError('An error occurred while fetching OG tags. Please try again.');
                            });
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              if (e.nativeEvent) {
                                e.nativeEvent.stopImmediatePropagation();
                              }
                            }
                          }}
                          disabled={fetchingOG || !formData.internetLink.trim()}
                          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap text-sm sm:text-base"
                        >
                        {fetchingOG ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Fetching...</span>
                          </>
                        ) : (
                          <>
                            <LinkIcon className="w-4 h-4 flex-shrink-0" />
                            <span>Fetch OG Tags</span>
                          </>
                        )}
                      </button>
                      </div>
                    </div>
                    {ogError && (
                      <div className="mt-2 flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{ogError}</span>
                      </div>
                    )}
                    {ogData && (
                      <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">OG Tags Fetched Successfully</span>
                        </div>
                        {ogData.title && (
                          <div className="mb-1">
                            <span className="text-xs font-medium text-gray-700">Title: </span>
                            <span className="text-sm text-gray-900">{ogData.title}</span>
                          </div>
                        )}
                        {ogData.description && (
                          <div className="mb-1">
                            <span className="text-xs font-medium text-gray-700">Description: </span>
                            <div className="text-sm text-gray-900 max-h-20 overflow-y-auto mt-1">{ogData.description}</div>
                          </div>
                        )}
                        {ogData.image && (
                          <div className="mt-2">
                            <span className="text-xs font-medium text-gray-700">Image: </span>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ogData.image} alt="OG Preview" className="mt-1 max-w-xs h-24 object-cover rounded" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Page Option</label>
                    <select
                      value={formData.pageOption}
                      onChange={(e) => setFormData({ ...formData, pageOption: e.target.value })}
                      className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {DISPLAY_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} className="text-gray-900">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Internet Link Editor Content</label>
                    <CKEditorComponent
                      value={formData.internetLinkEditor}
                      onChange={(value) => setFormData({ ...formData, internetLinkEditor: value })}
                      placeholder="Enter editor content for the link..."
                      id="internet-link-editor"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Display Mode</label>
                    <select
                      value={formData.displayMode}
                      onChange={(e) => setFormData({ ...formData, displayMode: e.target.value })}
                      className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {DISPLAY_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} className="text-gray-900">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    {languages.length > 0 && (
                      <>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Title of the article in other languages</label>
                          <div className="flex gap-2 mb-2 border-b border-gray-300">
                            {languages.map((lang) => {
                              return (
                                <button
                                  key={lang.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedLanguage(lang.id);
                                    setFormData(prev => ({ ...prev, langValueId: lang.id }));
                                  }}
                                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    selectedLanguage === lang.id
                                      ? 'border-blue-500 text-blue-600'
                                      : 'border-transparent text-gray-500 hover:text-gray-700'
                                  }`}
                                >
                                  {lang.name}
                                </button>
                              );
                            })}
                          </div>
                          {languages.map((lang) => {
                            return (
                              <div
                                key={lang.id}
                                className={`mb-2 ${selectedLanguage === lang.id ? '' : 'hidden'}`}
                              >
                                <input
                                  type="text"
                                  value={languageTitles[lang.id] || ''}
                                  onChange={(e) => setLanguageTitles(prev => ({ ...prev, [lang.id]: e.target.value }))}
                                  className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder={`Title in ${lang.name}...`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                          <div className="flex gap-2 mb-2 border-b border-gray-300">
                            {languages.map((lang) => {
                              return (
                                <button
                                  key={lang.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedLanguage(lang.id);
                                    setFormData(prev => ({ ...prev, langValueId: lang.id }));
                                  }}
                                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                    selectedLanguage === lang.id
                                      ? 'border-blue-500 text-blue-600'
                                      : 'border-transparent text-gray-500 hover:text-gray-700'
                                  }`}
                                >
                                  {lang.name}
                                </button>
                              );
                            })}
                          </div>
                          {languages.map((lang) => {
                            return (
                              <div
                                key={lang.id}
                                className={`${selectedLanguage === lang.id ? '' : 'hidden'}`}
                              >
                                <CKEditorComponent
                                  value={languageContents[lang.id] || ''}
                                  onChange={(value) => setLanguageContents(prev => ({ ...prev, [lang.id]: value }))}
                                  placeholder={`Enter content in ${lang.name}...`}
                                  id={`content-editor-${lang.id}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Keywords</label>
            <input
              type="text"
              value={formData.searchingKeywords}
              onChange={(e) => setFormData({ ...formData, searchingKeywords: e.target.value })}
              className="w-full px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter keywords separated by spaces"
            />
          </div>

          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900">Editable Options</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.editableAdmin}
                  onChange={(e) => setFormData({ ...formData, editableAdmin: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Editable by the Movesbook admins</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.editableOperators}
                  onChange={(e) => setFormData({ ...formData, editableOperators: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Editable by the Movesbook operators</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.editableUsers}
                  onChange={(e) => setFormData({ ...formData, editableUsers: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Editable by other registered users</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.editableTranslators}
                  onChange={(e) => setFormData({ ...formData, editableTranslators: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Permit to Movesbook translators to edit in the other languages</span>
              </label>
            </div>
          </div>

          <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Article Settings</h2>
            </div>
            
            <div className="flex gap-2 border-b border-gray-300 mb-4">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveSettingsTab('display');
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeSettingsTab === 'display'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Settings className="w-4 h-4 inline mr-2" />
                Display settings
              </button>
              <button
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveSettingsTab('related');
                  await fetchAvailableArticles();
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeSettingsTab === 'related'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <LinkIcon className="w-4 h-4 inline mr-2" />
                Related articles
              </button>
            </div>

            {activeSettingsTab === 'display' && (
              <div className="space-y-6">
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Resharing of the article and enable comments</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.settings.reshare}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          settings: { ...prev.settings, reshare: e.target.checked }
                        }))}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">Allow users to reshare the article</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.shareCommentOption}
                        onChange={(e) => setFormData({ ...formData, shareCommentOption: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">Allow users who are enabled to make comments</span>
                    </label>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">What are the functions enabled in the page of displaying of the article?</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.functions.commentOption}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              functions: { ...prev.settings.functions, commentOption: e.target.checked }
                            }
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Comments to the article</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.functions.likeButton}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              functions: { ...prev.settings.functions, likeButton: e.target.checked }
                            }
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Button 'I like'</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.functions.unlikeButton}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              functions: { ...prev.settings.functions, unlikeButton: e.target.checked }
                            }
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Button 'I don't like'</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.functions.shareTf}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              functions: { ...prev.settings.functions, shareTf: e.target.checked }
                            }
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Share on Twitter and Facebook</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.functions.otherSetting}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              functions: { ...prev.settings.functions, otherSetting: e.target.checked }
                            }
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Other sharings</span>
                      </label>
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.functions.rankingButton}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              functions: { ...prev.settings.functions, rankingButton: e.target.checked }
                            }
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Ranking button</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.functions.sendByEmail}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              functions: { ...prev.settings.functions, sendByEmail: e.target.checked }
                            }
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Send by mail</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.functions.exportInPdf}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              functions: { ...prev.settings.functions, exportInPdf: e.target.checked }
                            }
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Export in PDF</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.functions.downloadDocument}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              functions: { ...prev.settings.functions, downloadDocument: e.target.checked }
                            }
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Download document</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.functions.printOption}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              functions: { ...prev.settings.functions, printOption: e.target.checked }
                            }
                          }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">Print option</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Who can see it?</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration until to this date
                    </label>
                    <input
                      type="date"
                      value={formData.settings.duration || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        settings: { ...prev.settings, duration: e.target.value }
                      }))}
                      className="px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.sports.length === PROFILE_SPORT_OPTIONS.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                settings: { ...prev.settings, sports: [...PROFILE_SPORT_OPTIONS] }
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                settings: { ...prev.settings, sports: [] }
                              }));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Users Sports</span>
                      </label>
                      <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto bg-white">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {PROFILE_SPORT_OPTIONS.map((sport) => {
                            const isChecked = formData.settings.sports.includes(sport);
                            return (
                              <label key={sport} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    if (e.target.checked) {
                                      if (!formData.settings.sports.includes(sport)) {
                                        setFormData(prev => ({
                                          ...prev,
                                          settings: {
                                            ...prev.settings,
                                            sports: [...prev.settings.sports, sport]
                                          }
                                        }));
                                      }
                                    } else {
                                      setFormData(prev => ({
                                        ...prev,
                                        settings: {
                                          ...prev.settings,
                                          sports: prev.settings.sports.filter(s => s !== sport)
                                        }
                                      }));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4"
                                />
                                <span className="text-gray-700">{sport.replace(/_/g, ' ')}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.roles.length === userTypes.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                settings: { ...prev.settings, roles: userTypes.map(ut => ut.id) }
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                settings: { ...prev.settings, roles: [] }
                              }));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Users Type</span>
                      </label>
                      <div className="border border-gray-300 rounded-lg p-4 bg-white">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {userTypes.map((userType) => (
                            <label key={userType.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={formData.settings.roles.includes(userType.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData(prev => ({
                                      ...prev,
                                      settings: {
                                        ...prev.settings,
                                        roles: [...prev.settings.roles, userType.id]
                                      }
                                    }));
                                  } else {
                                    setFormData(prev => ({
                                      ...prev,
                                      settings: {
                                        ...prev.settings,
                                        roles: prev.settings.roles.filter(r => r !== userType.id)
                                      }
                                    }));
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-gray-700">{userType.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.languages.length === languages.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                settings: { ...prev.settings, languages: languages.map(l => l.id) }
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                settings: { ...prev.settings, languages: [] }
                              }));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Language</span>
                      </label>
                      <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto bg-white">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {languages.map((lang) => (
                            <label key={lang.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={formData.settings.languages.includes(lang.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData(prev => ({
                                      ...prev,
                                      settings: {
                                        ...prev.settings,
                                        languages: [...prev.settings.languages, lang.id]
                                      }
                                    }));
                                  } else {
                                    setFormData(prev => ({
                                      ...prev,
                                      settings: {
                                        ...prev.settings,
                                        languages: prev.settings.languages.filter(l => l !== lang.id)
                                      }
                                    }));
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-gray-700">{lang.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={formData.settings.countries.length > 0 && formData.settings.countries.length === countries.length}
                          onChange={(e) => {
                            if (e.target.checked && countries.length > 0) {
                              setFormData(prev => ({
                                ...prev,
                                settings: { ...prev.settings, countries: countries.map(c => c.id) }
                              }));
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                settings: { ...prev.settings, countries: [] }
                              }));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Country</span>
                      </label>
                      <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto bg-white">
                        {countries.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {countries.map((country, index) => {
                              const countryId = country.id;
                              const countryName = country.name;
                              const isChecked = formData.settings.countries.includes(countryId);
                              return (
                                <label key={`country-${index}-${countryName}`} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      if (e.target.checked) {
                                        if (!formData.settings.countries.includes(countryId)) {
                                          setFormData(prev => ({
                                            ...prev,
                                            settings: {
                                              ...prev.settings,
                                              countries: [...prev.settings.countries, countryId]
                                            }
                                          }));
                                        }
                                      } else {
                                        setFormData(prev => ({
                                          ...prev,
                                          settings: {
                                            ...prev.settings,
                                            countries: prev.settings.countries.filter(c => c !== countryId)
                                          }
                                        }));
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-gray-700">{countryName}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No countries available</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSettingsTab === 'related' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Related Articles</h3>
                {loadingArticles ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2 text-gray-600">Loading articles...</span>
                  </div>
                ) : availableArticles.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Show</span>
                        <select
                          value={relatedPerPage}
                          onChange={(e) => {
                            setRelatedPerPage(Number(e.target.value));
                            setRelatedPage(1);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                        >
                          {[5, 10, 15, 20].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <span className="text-sm text-gray-600">per page</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {availableArticles.length} total · {relatedArticles.length} selected
                      </span>
                    </div>

                    <div className="border border-gray-300 rounded-lg overflow-hidden overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left">
                              <input
                                type="checkbox"
                                checked={availableArticles.every(a => relatedArticles.some(ra => ra.id === a.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setRelatedArticles([...availableArticles]);
                                  } else {
                                    setRelatedArticles([]);
                                  }
                                }}
                                className="w-4 h-4"
                              />
                            </th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Title</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Category</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availableArticles
                            .slice((relatedPage - 1) * relatedPerPage, relatedPage * relatedPerPage)
                            .map((article) => {
                              const isSelected = relatedArticles.some(ra => ra.id === article.id);
                              return (
                                <tr
                                  key={article.id}
                                  className={`border-t border-gray-200 hover:bg-gray-50 ${isSelected ? 'bg-yellow-50' : ''}`}
                                >
                                  <td className="px-4 py-2">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        if (e.target.checked) {
                                          if (!relatedArticles.some(ra => ra.id === article.id)) {
                                            setRelatedArticles(prev => [...prev, article]);
                                          }
                                        } else {
                                          setRelatedArticles(prev => prev.filter(a => a.id !== article.id));
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-4 h-4"
                                    />
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-900">{article.title}</td>
                                  <td className="px-4 py-2 text-sm text-gray-700">{article.categoryName}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    {(() => {
                      const totalPages = Math.ceil(availableArticles.length / relatedPerPage);
                      if (totalPages <= 1) return null;
                      const pages: (number | '…')[] = [];
                      for (let i = 1; i <= totalPages; i++) {
                        if (i === 1 || i === totalPages || (i >= relatedPage - 1 && i <= relatedPage + 1)) {
                          pages.push(i);
                        } else if (pages[pages.length - 1] !== '…') {
                          pages.push('…');
                        }
                      }
                      return (
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <button
                            type="button"
                            disabled={relatedPage === 1}
                            onClick={() => setRelatedPage(p => p - 1)}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            ‹
                          </button>
                          {pages.map((p, idx) =>
                            p === '…' ? (
                              <span key={`ellipsis-${idx}`} className="px-2 py-1 text-sm text-gray-400">…</span>
                            ) : (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setRelatedPage(p)}
                                className={`px-3 py-1 text-sm border rounded ${
                                  p === relatedPage
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'border-gray-300 hover:bg-gray-100 text-gray-700'
                                }`}
                              >
                                {p}
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            disabled={relatedPage === totalPages}
                            onClick={() => setRelatedPage(p => p + 1)}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            ›
                          </button>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">No articles available</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
            <Link
              href="/news-by-movesbook/indexall"
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Update Article'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
