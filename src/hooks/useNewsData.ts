'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import type { ArticlePasted, ArticleTyped, OgpNewsGroupCard } from '@/app/news/components/NewsArticlesList';
import type { OGPData, OgpVisibilitySettingsExport } from '@/app/news/components/OGPForm';
import { NEWS_TOPICS } from '@/app/news/components/NewsTopicBar';

function getAuthHeaders(adminContext?: boolean): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = adminContext ? localStorage.getItem('adminToken') : localStorage.getItem('token');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export interface CustomTopic {
  id: string;
  name: string;
}

export interface UserInsertedTopic {
  name: string;
  creatorUsername: string | null;
}

export interface UseNewsDataResult {
  topics: string[];
  customTopics: CustomTopic[];
  /** Topic names created by super admin (normal users cannot edit these); empty when admin/super-admin. */
  topicNamesCreatedBySuperAdmin: string[];
  /** Topic names created by normal users (super admin sees these in dropdown only); empty when not super-admin. */
  topicNamesCreatedByNormalUsers: string[];
  /** Super admin: user-inserted topics with creator username (for labels). */
  userInsertedTopics: UserInsertedTopic[];
  pastedArticles: ArticlePasted[];
  ogpNewsGroups: OgpNewsGroupCard[];
  typedArticles: ArticleTyped[];
  /** Set when loading OGP with viewAsUsername (super admin “see as user”). */
  viewAsUserId: string | null;
  /** Country of the view-as user (users_new.country), when viewAsUsername is set. */
  viewAsUserCountry: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Music only: saved genre order per topic name. */
  topicGenreOrder: Record<string, string[]>;
  /** Topic names hidden from the topic menu. */
  hiddenTopics: string[];
  /** Music only: hidden genre names per topic. */
  hiddenGenres: Record<string, string[]>;
  saveTopicOrder: (
    order: string[],
    genreOrder?: Record<string, string[]>,
    hidden?: { topics?: string[]; genres?: Record<string, string[]> }
  ) => Promise<void>;
  addTopic: (name: string) => Promise<void>;
  updateTopic: (id: string, name: string) => Promise<void>;
  deleteTopic: (id: string) => Promise<void>;
  addPastedArticle: (
    data: OGPData & {
      customDescription?: string;
      visibility?: OgpVisibilitySettingsExport;
      languageCode?: string | null;
      musicalGenre?: string | null;
      artist?: string | null;
      musicTitle?: string | null;
      registrationType?: string | null;
      isFavourite?: boolean;
    },
    topic: string,
    options?: { shareToClubId?: string | null }
  ) => Promise<{ id: string; sharedClubIds?: string[] } | void>;
  removePastedArticle: (id: string) => Promise<void>;
  updatePastedArticleSettings: (id: string, settings: OgpVisibilitySettingsExport) => Promise<void>;
  updatePastedArticleTopic: (id: string, topic: string, customDescription?: string) => Promise<void>;
  /** Full update of a pasted OGP (e.g. Music pencil → Add Music edit). */
  updatePastedArticle: (
    id: string,
    data: OGPData & {
      customDescription?: string;
      visibility?: OgpVisibilitySettingsExport;
      languageCode?: string | null;
      musicalGenre?: string | null;
      artist?: string | null;
      musicTitle?: string | null;
      registrationType?: string | null;
      isFavourite?: boolean;
    }
  ) => Promise<void>;
  /** Save or merge an OGP News group. Throws with `exists` on 409 when confirmExisting is false. */
  saveOgpNewsGroup: (payload: {
    name: string;
    topic: string;
    articleIds: string[];
    confirmExisting?: boolean;
    coverImage?: string | null;
  }) => Promise<{ merged: boolean; group: OgpNewsGroupCard; exists?: boolean }>;
  removeOgpNewsGroup: (id: string) => Promise<void>;
  updateOgpNewsGroup: (id: string, topic: string, customDescription?: string) => Promise<void>;
  updateOgpNewsGroupSettings: (id: string, settings: OgpVisibilitySettingsExport) => Promise<void>;
  addTypedArticle: (
    description: string,
    meta?: {
      artist?: string | null;
      musicTitle?: string | null;
      title?: string | null;
      registrationType?: string | null;
      isFavourite?: boolean;
    }
  ) => Promise<void>;
  removeTypedArticle: (id: string) => Promise<void>;
  /** Super admin: toggle OGP article in Global News feed. */
  toggleOgpGlobalNews: (id: string, inGlobalNews: boolean) => Promise<void>;
  /** Super admin: toggle featured News Card flags on an OGP article. */
  toggleOgpFeatured: (
    id: string,
    patch: { isFeatured?: boolean; displayInEvidence?: boolean },
  ) => Promise<void>;
}

export interface UseNewsDataOptions {
  /** When true, use adminToken and adminUser from localStorage (super admin in admin panel). */
  adminContext?: boolean;
  /** Super admin: load OGPs visible to this username (all topics). */
  viewAsUsername?: string | null;
  /** API prefix. Defaults to `/api/news`; Music section uses `/api/music`; My Library uses `/api/exercises`. */
  apiBase?: string;
  /** Fallback default topic names when topics API has not loaded yet. */
  defaultTopics?: readonly string[];
  /** My Library of Exercises: one of the 9 category chips (required for `/api/exercises`). */
  category?: string | null;
}

function supportsOgpGroups(apiBase: string): boolean {
  return apiBase === '/api/news' || apiBase === '/api/music' || apiBase === '/api/exercises';
}

function appendQuery(url: string, params: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') sp.set(k, v);
  }
  const qs = sp.toString();
  if (!qs) return url;
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
}

/** Normalize OGP group API payloads (includes Club OGP audienceMode → clubAudienceMode). */
function mapGroupFromApi(g: any): OgpNewsGroupCard {
  return {
    id: g.id,
    name: g.name,
    topic: g.topic,
    savedAt: g.savedAt,
    memberCount: g.memberCount ?? (g.memberIds?.length ?? 0),
    memberIds: Array.isArray(g.memberIds) ? g.memberIds : [],
    userId: g.userId,
    creatorUsername: g.creatorUsername ?? null,
    creatorName: g.creatorName ?? g.creatorUsername ?? null,
    creatorCountry: g.creatorCountry ?? null,
    createdByCurrentUser: g.createdByCurrentUser === true,
    title: g.title,
    image: g.image,
    coverImage: g.coverImage ?? null,
    description: g.description,
    url: g.url ?? '',
    siteName: g.siteName,
    type: g.type,
    customDescription: g.customDescription,
    deletedAt: g.deletedAt ?? null,
    inGlobalNews: g.inGlobalNews === true,
    visibility: {
      userTypes: g.visibilityUserTypes ?? g.visibility?.userTypes ?? [],
      countries: g.visibilityCountries ?? g.visibility?.countries ?? [],
      languages: g.visibilityLanguages ?? g.visibility?.languages ?? [],
      sports: g.visibilitySports ?? g.visibility?.sports ?? [],
      expiresAt: g.expiresAt ?? g.visibility?.expiresAt ?? null,
    },
    clubAudienceMode: g.audienceMode ?? g.clubAudienceMode ?? 'me-and-club-members',
    previewTopic: g.previewTopic ?? g.topic,
    previewCreatorUsername: g.previewCreatorUsername ?? g.creatorUsername ?? null,
  };
}

export function useNewsData(options?: UseNewsDataOptions): UseNewsDataResult {
  const { user } = useAuth();
  const adminContext = options?.adminContext === true;
  const viewAsUsername = options?.viewAsUsername ?? null;
  const apiBase = options?.apiBase ?? '/api/news';
  const defaultTopics = options?.defaultTopics ?? NEWS_TOPICS;
  const category = options?.category?.trim() || null;
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);
  const [viewAsUserCountry, setViewAsUserCountry] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>(() => [...defaultTopics]);
  const [customTopics, setCustomTopics] = useState<CustomTopic[]>([]);
  const [topicNamesCreatedBySuperAdmin, setTopicNamesCreatedBySuperAdmin] = useState<string[]>([]);
  const [topicNamesCreatedByNormalUsers, setTopicNamesCreatedByNormalUsers] = useState<string[]>([]);
  const [userInsertedTopics, setUserInsertedTopics] = useState<UserInsertedTopic[]>([]);
  const [pastedArticles, setPastedArticles] = useState<ArticlePasted[]>([]);
  const [ogpNewsGroups, setOgpNewsGroups] = useState<OgpNewsGroupCard[]>([]);
  const [typedArticles, setTypedArticles] = useState<ArticleTyped[]>([]);
  const [topicGenreOrder, setTopicGenreOrder] = useState<Record<string, string[]>>({});
  const [hiddenTopics, setHiddenTopics] = useState<string[]>([]);
  const [hiddenGenres, setHiddenGenres] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (adminContext && typeof window !== 'undefined') {
      const raw = localStorage.getItem('adminUser');
      const u = raw ? JSON.parse(raw) : null;
      setAdminUserId(u?.id ?? null);
    } else {
      setAdminUserId(null);
    }
  }, [adminContext]);

  const effectiveUserId = adminContext ? adminUserId : user?.id;
  const getHeaders = useCallback(
    () => getAuthHeaders(adminContext),
    [adminContext]
  );

  const fetchAll = useCallback(async () => {
    if (!effectiveUserId) {
      setTopics([...defaultTopics]);
      setCustomTopics([]);
      setTopicNamesCreatedBySuperAdmin([]);
      setTopicNamesCreatedByNormalUsers([]);
      setUserInsertedTopics([]);
      setPastedArticles([]);
      setOgpNewsGroups([]);
      setTypedArticles([]);
      setTopicGenreOrder({});
      setHiddenTopics([]);
      setHiddenGenres({});
      setViewAsUserId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const headers = getHeaders();
    try {
      const cat = category ? { category } : {};
      const ogpUrl = appendQuery(`${apiBase}/ogp`, {
        ...cat,
        ...(viewAsUsername != null && viewAsUsername.trim() !== ''
          ? { viewAsUsername: viewAsUsername.trim() }
          : {}),
      });
      const fetchGroups = supportsOgpGroups(apiBase);
      const [topicsRes, ogpRes, typedRes, orderRes, groupsRes] = await Promise.all([
        fetch(appendQuery(`${apiBase}/topics`, cat), { headers }),
        fetch(ogpUrl, { headers }),
        fetch(appendQuery(`${apiBase}/typed`, cat), { headers }),
        fetch(appendQuery(`${apiBase}/topic-order`, cat), { headers }),
        fetchGroups
          ? fetch(appendQuery(`${apiBase}/ogp-groups`, cat), { headers })
          : Promise.resolve(null),
      ]);

      if (!topicsRes.ok || !ogpRes.ok || !typedRes.ok) {
        throw new Error('Failed to load news data');
      }

      const [topicsData, ogpJson, typedData, orderData, groupsData] = await Promise.all([
        topicsRes.json(),
        ogpRes.json(),
        typedRes.json(),
        orderRes.ok ? orderRes.json() : Promise.resolve({ order: [] }),
        groupsRes && groupsRes.ok ? groupsRes.json() : Promise.resolve([]),
      ]);

      const ogpData = Array.isArray(ogpJson)
        ? ogpJson
        : Array.isArray(ogpJson?.articles)
          ? ogpJson.articles
          : [];
      if (viewAsUsername != null && viewAsUsername.trim() !== '' && ogpJson && typeof ogpJson === 'object' && !Array.isArray(ogpJson)) {
        setViewAsUserId(typeof ogpJson.viewAsUserId === 'string' ? ogpJson.viewAsUserId : null);
        setViewAsUserCountry(
          typeof ogpJson.viewAsUserCountry === 'string' ? ogpJson.viewAsUserCountry : null
        );
      } else {
        setViewAsUserId(null);
        setViewAsUserCountry(null);
      }

      const custom = topicsData.customTopics ?? [];
      setCustomTopics(custom);
      setTopicNamesCreatedBySuperAdmin(topicsData.topicNamesCreatedBySuperAdmin ?? []);
      const inserted = (topicsData.userInsertedTopics ?? []) as UserInsertedTopic[];
      setUserInsertedTopics(inserted);
      setTopicNamesCreatedByNormalUsers(
        inserted.length > 0 ? inserted.map((x) => x.name) : (topicsData.topicNamesCreatedByNormalUsers ?? [])
      );
      const rawTopics = [...(topicsData.defaultTopicNames ?? defaultTopics), ...custom.map((t: CustomTopic) => t.name)];
      const order: string[] = orderData?.order ?? [];
      const sorted =
        order.length > 0
          ? [
              ...order.filter((t: string) => rawTopics.includes(t)),
              ...rawTopics.filter((t: string) => !order.includes(t)),
            ]
          : rawTopics;
      setTopics(sorted);
      setTopicGenreOrder(
        orderData?.genreOrder && typeof orderData.genreOrder === 'object' && !Array.isArray(orderData.genreOrder)
          ? (orderData.genreOrder as Record<string, string[]>)
          : {}
      );
      setHiddenTopics(
        Array.isArray(orderData?.hiddenTopics)
          ? orderData.hiddenTopics.filter((t: unknown): t is string => typeof t === 'string')
          : []
      );
      setHiddenGenres(
        orderData?.hiddenGenres && typeof orderData.hiddenGenres === 'object' && !Array.isArray(orderData.hiddenGenres)
          ? (orderData.hiddenGenres as Record<string, string[]>)
          : {}
      );

      setPastedArticles(
        (ogpData as any[] ?? []).map((a: any) => ({
          id: a.id,
          userId: a.userId,
          creatorUsername: a.creatorUsername ?? null,
          creatorCountry: a.creatorCountry ?? null,
          createdByCurrentUser: a.createdByCurrentUser === true,
          createdBySuperAdmin: a.createdBySuperAdmin === true,
          title: a.title,
          artist: a.artist ?? null,
          image: a.image,
          description: a.description,
          url: a.url,
          siteName: a.siteName,
          type: a.type,
          customDescription: a.customDescription,
          topic: a.topic,
          genre: a.genre ?? null,
          registrationType: a.registrationType ?? null,
          isFavourite: a.isFavourite === true,
          languageCode: a.languageCode ?? undefined,
          savedAt: a.savedAt,
          viewCount: typeof a.viewCount === 'number' ? a.viewCount : Number(a.viewCount) || 0,
          inGlobalNews: a.inGlobalNews === true,
          isFeatured: a.isFeatured === true,
          displayInEvidence: a.displayInEvidence !== false,
          deletedAt: a.deletedAt,
          deletedByUserId: a.deletedByUserId,
          deletedByName: a.deletedByName,
          visibility: {
            userTypes: a.visibilityUserTypes ?? [],
            countries: a.visibilityCountries ?? [],
            languages: a.visibilityLanguages ?? [],
            sports: a.visibilitySports ?? [],
            expiresAt: a.expiresAt ?? null,
          },
        }))
      );

      setOgpNewsGroups(
        Array.isArray(groupsData) ? (groupsData as any[]).map(mapGroupFromApi) : []
      );

      setTypedArticles(
        (typedData ?? []).map((a: any) => ({
          id: a.id,
          description: a.description,
          artist: a.artist ?? null,
          title: a.title ?? null,
          registrationType: a.registrationType ?? null,
          isFavourite: a.isFavourite === true,
        }))
      );
    } catch (e) {
      console.error('useNewsData fetch', e);
      setError(e instanceof Error ? e.message : 'Failed to load');
      setTopics([...defaultTopics]);
      setCustomTopics([]);
      setTopicNamesCreatedBySuperAdmin([]);
      setTopicNamesCreatedByNormalUsers([]);
      setUserInsertedTopics([]);
      setPastedArticles([]);
      setOgpNewsGroups([]);
      setTypedArticles([]);
      setTopicGenreOrder({});
      setHiddenTopics([]);
      setHiddenGenres({});
      setViewAsUserId(null);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, getHeaders, viewAsUsername, apiBase, defaultTopics, category]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveTopicOrder = useCallback(
    async (
      order: string[],
      genreOrder?: Record<string, string[]>,
      hidden?: { topics?: string[]; genres?: Record<string, string[]> }
    ) => {
      if (!effectiveUserId) return;
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
      const body: {
        order: string[];
        genreOrder?: Record<string, string[]>;
        hiddenTopics?: string[];
        hiddenGenres?: Record<string, string[]>;
        category?: string;
      } = { order };
      if (genreOrder != null) body.genreOrder = genreOrder;
      if (hidden?.topics != null) body.hiddenTopics = hidden.topics;
      if (hidden?.genres != null) body.hiddenGenres = hidden.genres;
      if (category) body.category = category;
      const res = await fetch(`${apiBase}/topic-order`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save topic order');
      await fetchAll();
    },
    [effectiveUserId, fetchAll, getHeaders, apiBase, category]
  );

  const addTopic = useCallback(
    async (name: string) => {
      if (!effectiveUserId) return;
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${apiBase}/topics`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: name.trim(), ...(category ? { category } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add topic');
      }
      const created = await res.json();
      setCustomTopics((prev) => [...prev, { id: created.id, name: created.name }]);
      setTopics((prev) => [...prev, created.name]);
    },
    [effectiveUserId, getHeaders, apiBase, category]
  );

  const updateTopic = useCallback(
    async (id: string, name: string) => {
      if (!effectiveUserId) return;
      const oldName = customTopics.find((c) => c.id === id)?.name ?? '';
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${apiBase}/topics/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update topic');
      }
      const updated = await res.json();
      setCustomTopics((prev) => prev.map((t) => (t.id === id ? { id, name: updated.name } : t)));
      setTopics((prev) => prev.map((t) => (t === oldName ? updated.name : t)));
      setPastedArticles((prev) =>
        prev.map((a) => (a.topic === oldName ? { ...a, topic: updated.name } : a))
      );
    },
    [effectiveUserId, customTopics, getHeaders, apiBase]
  );

  const deleteTopic = useCallback(
    async (id: string) => {
      if (!effectiveUserId) return;
      const headers = getHeaders();
      const res = await fetch(`${apiBase}/topics/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed to delete topic');
      const name = customTopics.find((c) => c.id === id)?.name;
      setCustomTopics((prev) => prev.filter((t) => t.id !== id));
      if (name) setTopics((prev) => prev.filter((t) => t !== name));
    },
    [effectiveUserId, customTopics, getHeaders, apiBase]
  );

  const addPastedArticle = useCallback(
    async (
      data: OGPData & {
        customDescription?: string;
        visibility?: OgpVisibilitySettingsExport;
        languageCode?: string | null;
        musicalGenre?: string | null;
        artist?: string | null;
        musicTitle?: string | null;
        registrationType?: string | null;
        isFavourite?: boolean;
      },
      topic: string,
      options?: { shareToClubId?: string | null }
    ) => {
      if (!effectiveUserId) return;
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
      const vis = data.visibility;
      const shareToClubId = options?.shareToClubId?.trim() || null;
      const res = await fetch(`${apiBase}/ogp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: data.title,
          artist: data.artist ?? null,
          musicTitle: data.musicTitle ?? null,
          image: data.image,
          description: data.description,
          url: data.url,
          siteName: data.siteName,
          type: data.type,
          customDescription: data.customDescription,
          topic: topic || (defaultTopics[0] ?? 'News'),
          genre: data.musicalGenre ?? null,
          registrationType: data.registrationType ?? null,
          isFavourite: data.isFavourite ?? false,
          languageCode: data.languageCode ?? null,
          expiresAt: vis?.expiresAt ?? null,
          visibilityUserTypes: vis?.userTypes ?? [],
          visibilityCountries: vis?.countries ?? [],
          visibilityLanguages: vis?.languages ?? [],
          visibilitySports: vis?.sports ?? [],
          ...(category ? { category } : {}),
          ...(shareToClubId
            ? {
                shareToClubId,
                ...(vis?.clubAudienceMode
                  ? { audienceMode: vis.clubAudienceMode }
                  : {}),
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save article');
      }
      const created = await res.json();
      const sharedClubIds: string[] = Array.isArray(created.sharedClubIds)
        ? created.sharedClubIds
        : shareToClubId
          ? [shareToClubId]
          : [];
      setPastedArticles((prev) => [
        ...prev,
        {
          id: created.id,
          userId: effectiveUserId ?? undefined,
          creatorCountry: user?.country ?? null,
          createdByCurrentUser: true,
          title: created.title,
          artist: created.artist ?? data.artist ?? null,
          image: created.image,
          description: created.description,
          url: created.url,
          siteName: created.siteName,
          type: created.type,
          customDescription: created.customDescription,
          topic: created.topic,
          genre: created.genre ?? data.musicalGenre ?? null,
          registrationType: created.registrationType ?? data.registrationType ?? null,
          isFavourite: created.isFavourite ?? data.isFavourite ?? false,
          languageCode: created.languageCode ?? undefined,
          savedAt: created.savedAt,
          viewCount: typeof created.viewCount === 'number' ? created.viewCount : 0,
          sharedClubIds,
          visibility: {
            userTypes: vis?.userTypes ?? [],
            countries: vis?.countries ?? [],
            languages: vis?.languages ?? [],
            sports: vis?.sports ?? [],
            expiresAt: vis?.expiresAt ?? null,
          },
          ...(vis?.clubAudienceMode
            ? { clubAudienceMode: vis.clubAudienceMode }
            : {}),
        },
      ]);
      return { id: created.id as string, sharedClubIds };
    },
    [effectiveUserId, getHeaders, user?.country, apiBase, defaultTopics, category]
  );

  const removePastedArticle = useCallback(
    async (id: string) => {
      if (!effectiveUserId) return;
      const headers = getHeaders();
      const res = await fetch(`${apiBase}/ogp/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed to remove article');
      setPastedArticles((prev) => prev.filter((a) => a.id !== id));
    },
    [effectiveUserId, getHeaders, apiBase]
  );

  const updatePastedArticleSettings = useCallback(
    async (id: string, settings: OgpVisibilitySettingsExport) => {
      if (!effectiveUserId) return;
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${apiBase}/ogp/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          visibilityUserTypes: settings.userTypes ?? [],
          visibilityCountries: settings.countries ?? [],
          visibilityLanguages: settings.languages ?? [],
          visibilitySports: settings.sports ?? [],
          expiresAt: settings.expiresAt ?? null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update article settings');
      setPastedArticles((prev) =>
        prev.map((a) =>
          a.id !== id
            ? a
            : {
                ...a,
                visibility: {
                  userTypes: settings.userTypes ?? [],
                  countries: settings.countries ?? [],
                  languages: settings.languages ?? [],
                  sports: settings.sports ?? [],
                  expiresAt: settings.expiresAt ?? null,
                },
              }
        )
      );
    },
    [effectiveUserId, getHeaders, apiBase]
  );

  const updatePastedArticleTopic = useCallback(
    async (id: string, topic: string, customDescription?: string) => {
      if (!effectiveUserId) return;
      const trimmed = topic.trim();
      if (!trimmed) return;
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
      const payload: { topic: string; customDescription?: string | null } = { topic: trimmed };
      if (customDescription !== undefined) {
        payload.customDescription = customDescription.trim() || null;
      }
      const res = await fetch(`${apiBase}/ogp/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update article topic');
      setPastedArticles((prev) =>
        prev.map((a) =>
          a.id !== id
            ? a
            : {
                ...a,
                topic: trimmed,
                ...(customDescription !== undefined && { customDescription: customDescription.trim() || undefined }),
              }
        )
      );
    },
    [effectiveUserId, getHeaders, apiBase]
  );

  const updatePastedArticle = useCallback(
    async (
      id: string,
      data: OGPData & {
        customDescription?: string;
        visibility?: OgpVisibilitySettingsExport;
        languageCode?: string | null;
        musicalGenre?: string | null;
        artist?: string | null;
        musicTitle?: string | null;
        registrationType?: string | null;
        isFavourite?: boolean;
      }
    ) => {
      if (!effectiveUserId) return;
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
      const vis = data.visibility;
      const resolvedTitle =
        typeof data.musicTitle === 'string' && data.musicTitle.trim()
          ? data.musicTitle.trim()
          : data.title ?? null;
      const res = await fetch(`${apiBase}/ogp/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          title: resolvedTitle,
          musicTitle: data.musicTitle ?? null,
          artist: data.artist ?? null,
          image: data.image,
          description: data.description,
          url: data.url,
          siteName: data.siteName,
          type: data.type,
          customDescription: data.customDescription ?? null,
          genre: data.musicalGenre ?? null,
          registrationType: data.registrationType ?? null,
          isFavourite: data.isFavourite ?? false,
          languageCode: data.languageCode ?? null,
          expiresAt: vis?.expiresAt ?? null,
          visibilityUserTypes: vis?.userTypes ?? [],
          visibilityCountries: vis?.countries ?? [],
          visibilityLanguages: vis?.languages ?? [],
          visibilitySports: vis?.sports ?? [],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update article');
      }
      setPastedArticles((prev) =>
        prev.map((a) =>
          a.id !== id
            ? a
            : {
                ...a,
                title: resolvedTitle,
                artist: data.artist ?? null,
                image: data.image,
                description: data.description,
                url: data.url,
                siteName: data.siteName,
                type: data.type,
                customDescription: data.customDescription,
                genre: data.musicalGenre ?? null,
                registrationType: data.registrationType ?? null,
                isFavourite: data.isFavourite ?? false,
                languageCode: data.languageCode ?? undefined,
                visibility: {
                  userTypes: vis?.userTypes ?? [],
                  countries: vis?.countries ?? [],
                  languages: vis?.languages ?? [],
                  sports: vis?.sports ?? [],
                  expiresAt: vis?.expiresAt ?? null,
                },
              }
        )
      );
    },
    [effectiveUserId, getHeaders, apiBase]
  );

  const saveOgpNewsGroup = useCallback(
    async (payload: {
      name: string;
      topic: string;
      articleIds: string[];
      confirmExisting?: boolean;
      coverImage?: string | null;
    }) => {
      if (!effectiveUserId) throw new Error('Not authenticated');
      if (!supportsOgpGroups(apiBase)) {
        throw new Error('OGP groups are only available for News, Music, and Exercises');
      }
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${apiBase}/ogp-groups`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: payload.name,
          topic: payload.topic,
          articleIds: payload.articleIds,
          confirmExisting: payload.confirmExisting === true,
          coverImage: payload.coverImage ?? null,
          ...(category ? { category } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.exists) {
        const err = new Error(data.message || 'Group name already exists') as Error & {
          exists: true;
          group?: OgpNewsGroupCard;
        };
        err.exists = true;
        err.group = data.group ? mapGroupFromApi(data.group) : undefined;
        throw err;
      }
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to save group');
      }
      const group = mapGroupFromApi(data.group);
      setOgpNewsGroups((prev) => {
        const without = prev.filter((g) => g.id !== group.id);
        return [group, ...without];
      });
      return { merged: data.merged === true, group };
    },
    [effectiveUserId, getHeaders, apiBase, category]
  );

  const removeOgpNewsGroup = useCallback(
    async (id: string) => {
      if (!effectiveUserId) return;
      if (!supportsOgpGroups(apiBase)) return;
      const headers = getHeaders();
      const res = await fetch(`${apiBase}/ogp-groups/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed to delete group');
      setOgpNewsGroups((prev) => prev.filter((g) => g.id !== id));
    },
    [effectiveUserId, getHeaders, apiBase]
  );

  const updateOgpNewsGroup = useCallback(
    async (id: string, topic: string, customDescription?: string) => {
      if (!effectiveUserId) return;
      if (!supportsOgpGroups(apiBase)) return;
      const trimmed = topic.trim();
      if (!trimmed) return;
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
      const payload: { topic: string; customDescription?: string | null } = { topic: trimmed };
      if (customDescription !== undefined) {
        payload.customDescription = customDescription.trim() || null;
      }
      const res = await fetch(`${apiBase}/ogp-groups/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update group');
      setOgpNewsGroups((prev) =>
        prev.map((g) =>
          g.id !== id
            ? g
            : {
                ...g,
                topic: trimmed,
                ...(customDescription !== undefined && {
                  customDescription: customDescription.trim() || undefined,
                }),
              }
        )
      );
    },
    [effectiveUserId, getHeaders, apiBase]
  );

  const updateOgpNewsGroupSettings = useCallback(
    async (id: string, settings: OgpVisibilitySettingsExport) => {
      if (!effectiveUserId) return;
      if (!supportsOgpGroups(apiBase)) return;
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${apiBase}/ogp-groups/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          visibilityUserTypes: settings.userTypes ?? [],
          visibilityCountries: settings.countries ?? [],
          visibilityLanguages: settings.languages ?? [],
          visibilitySports: settings.sports ?? [],
          expiresAt: settings.expiresAt ?? null,
          ...(settings.clubAudienceMode
            ? { audienceMode: settings.clubAudienceMode }
            : {}),
        }),
      });
      if (!res.ok) throw new Error('Failed to update group settings');
      setOgpNewsGroups((prev) =>
        prev.map((g) =>
          g.id !== id
            ? g
            : {
                ...g,
                visibility: {
                  userTypes: settings.userTypes ?? [],
                  countries: settings.countries ?? [],
                  languages: settings.languages ?? [],
                  sports: settings.sports ?? [],
                  expiresAt: settings.expiresAt ?? null,
                },
                ...(settings.clubAudienceMode
                  ? { clubAudienceMode: settings.clubAudienceMode }
                  : {}),
              }
        )
      );
    },
    [effectiveUserId, getHeaders, apiBase]
  );

  const addTypedArticle = useCallback(
    async (
      description: string,
      meta?: {
        artist?: string | null;
        musicTitle?: string | null;
        title?: string | null;
        registrationType?: string | null;
        isFavourite?: boolean;
      }
    ) => {
      if (!effectiveUserId) return;
      const headers = { ...getHeaders(), 'Content-Type': 'application/json' };
      const res = await fetch(`${apiBase}/typed`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description: description.trim(),
          artist: meta?.artist ?? null,
          title: meta?.musicTitle ?? meta?.title ?? null,
          registrationType: meta?.registrationType ?? null,
          isFavourite: meta?.isFavourite ?? false,
          ...(category ? { category } : {}),
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const created = await res.json();
      setTypedArticles((prev) => [
        ...prev,
        {
          id: created.id,
          description: created.description,
          artist: created.artist ?? meta?.artist ?? null,
          title: created.title ?? meta?.musicTitle ?? meta?.title ?? null,
          registrationType: created.registrationType ?? meta?.registrationType ?? null,
          isFavourite: created.isFavourite ?? meta?.isFavourite ?? false,
        },
      ]);
    },
    [effectiveUserId, getHeaders, apiBase, category]
  );

  const removeTypedArticle = useCallback(
    async (id: string) => {
      if (!effectiveUserId) return;
      const headers = getHeaders();
      const res = await fetch(`${apiBase}/typed/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed to remove');
      setTypedArticles((prev) => prev.filter((a) => a.id !== id));
    },
    [effectiveUserId, getHeaders, apiBase]
  );

  const toggleOgpGlobalNews = useCallback(
    async (id: string, inGlobalNews: boolean) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      if (!token) throw new Error('Not authenticated');
      const isGroup = ogpNewsGroups.some((g) => g.id === id);
      const path = isGroup
        ? `/api/admin/global-news/ogp-group/${encodeURIComponent(id)}`
        : `/api/admin/global-news/ogp/${encodeURIComponent(id)}`;
      const res = await fetch(path, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inGlobalNews }),
      });
      if (!res.ok) throw new Error('Failed to update Global News');
      if (isGroup) {
        setOgpNewsGroups((prev) =>
          prev.map((g) => (g.id === id ? { ...g, inGlobalNews } : g)),
        );
      } else {
        setPastedArticles((prev) =>
          prev.map((a) => (a.id === id ? { ...a, inGlobalNews } : a)),
        );
      }
    },
    [ogpNewsGroups],
  );

  const toggleOgpFeatured = useCallback(
    async (id: string, patch: { isFeatured?: boolean; displayInEvidence?: boolean }) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`/api/admin/ogp-featured/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to update featured flags');
      const updated = await res.json();
      setPastedArticles((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                ...(typeof updated.isFeatured === 'boolean'
                  ? { isFeatured: updated.isFeatured }
                  : patch.isFeatured !== undefined
                    ? { isFeatured: patch.isFeatured }
                    : {}),
                ...(typeof updated.displayInEvidence === 'boolean'
                  ? { displayInEvidence: updated.displayInEvidence }
                  : patch.displayInEvidence !== undefined
                    ? { displayInEvidence: patch.displayInEvidence }
                    : {}),
              }
            : a,
        ),
      );
    },
    [],
  );

  return {
    topics,
    customTopics,
    topicNamesCreatedBySuperAdmin,
    topicNamesCreatedByNormalUsers,
    userInsertedTopics,
    pastedArticles,
    ogpNewsGroups,
    typedArticles,
    viewAsUserId,
    viewAsUserCountry,
    loading,
    error,
    refresh: fetchAll,
    topicGenreOrder,
    hiddenTopics,
    hiddenGenres,
    saveTopicOrder,
    addTopic,
    updateTopic,
    deleteTopic,
    addPastedArticle,
    removePastedArticle,
    updatePastedArticleSettings,
    updatePastedArticleTopic,
    updatePastedArticle,
    saveOgpNewsGroup,
    removeOgpNewsGroup,
    updateOgpNewsGroup,
    updateOgpNewsGroupSettings,
    addTypedArticle,
    removeTypedArticle,
    toggleOgpGlobalNews,
    toggleOgpFeatured,
  };
}
