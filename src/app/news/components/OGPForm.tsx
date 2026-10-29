'use client';

import { useState, useCallback, useEffect } from 'react';
import { Settings } from 'lucide-react';
import NewsSettingModal, {
  type OgpVisibilitySettings,
  defaultSettings,
} from './NewsSettingModal';
import { ALL_LANGUAGES } from '@/constants/language.constants';
import {
  MUSICAL_GENRES,
  MUSIC_REGISTRATION_TYPES,
} from '@/constants/musicGenres.constants';
import RichTextEditor from '@/components/settings/RichTextEditor';
import { hasRichTextContent } from '@/utils/richTextTranslation';

export interface OGPData {
  title: string | null;
  image: string | null;
  description: string | null;
  url: string;
  siteName?: string | null;
  type?: string | null;
}

export type OgpVisibilitySettingsExport = OgpVisibilitySettings;

export type MusicOgpFormMeta = {
  artist?: string | null;
  musicTitle?: string | null;
  musicalGenre?: string | null;
  registrationType?: string | null;
  isFavourite?: boolean;
};

/** Prefill values when editing an existing OGP (Music pencil → Add Music modal). */
export type OGPFormInitialValues = {
  url?: string;
  description?: string;
  languageCode?: string | null;
  artist?: string | null;
  musicTitle?: string | null;
  musicalGenre?: string | null;
  registrationType?: string | null;
  visibility?: OgpVisibilitySettings;
  /** Existing OGP preview (title/image/description/url) so Save works without re-fetch. */
  og?: OGPData | null;
};

interface OGPFormProps {
  onPastedArticle: (
    data: OGPData & {
      customDescription?: string;
      visibility?: OgpVisibilitySettings;
      languageCode?: string | null;
      musicalGenre?: string | null;
      artist?: string | null;
      musicTitle?: string | null;
      registrationType?: string | null;
      isFavourite?: boolean;
    }
  ) => void;
  onSaveTyped?: (
    description: string,
    musicalGenre?: string | null,
    meta?: MusicOgpFormMeta
  ) => void;
  onCancel?: () => void;
  /** Music modal: Artist / Title / Genre / Registration fields and “Who will see the music”. */
  variant?: 'news' | 'music';
  /** Controlled value: whether "Put in my favourites" is checked (managed by parent). */
  isFavourite?: boolean;
  /** When set, form opens prefilled for editing an existing entry. */
  initialValues?: OGPFormInitialValues | null;
  /**
   * Club OGP News: show audience radios in News Setting
   * (Only me / club members / members + filters).
   */
  showClubAudienceRadios?: boolean;
}

function defaultVisibility(showClubAudienceRadios: boolean): OgpVisibilitySettings {
  return showClubAudienceRadios
    ? { ...defaultSettings, clubAudienceMode: 'me-and-club-members' }
    : defaultSettings;
}

export default function OGPForm({
  onPastedArticle,
  onSaveTyped,
  onCancel,
  variant = 'news',
  isFavourite = false,
  initialValues = null,
  showClubAudienceRadios = false,
}: OGPFormProps) {
  const isMusic = variant === 'music';
  const [url, setUrl] = useState(() => initialValues?.url ?? '');
  const [description, setDescription] = useState(() => initialValues?.description ?? '');
  const [languageCode, setLanguageCode] = useState<string>(() => initialValues?.languageCode ?? '');
  const [artist, setArtist] = useState(() => initialValues?.artist ?? '');
  const [musicTitle, setMusicTitle] = useState(() => initialValues?.musicTitle ?? '');
  const [musicalGenre, setMusicalGenre] = useState(() => initialValues?.musicalGenre ?? '');
  const [registrationType, setRegistrationType] = useState(
    () => initialValues?.registrationType ?? ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedOg, setFetchedOg] = useState<OGPData | null>(() => {
    if (initialValues?.og) return initialValues.og;
    if (initialValues?.url) {
      return {
        title: initialValues.musicTitle ?? null,
        image: null,
        description: null,
        url: initialValues.url,
      };
    }
    return null;
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [visibility, setVisibility] = useState<OgpVisibilitySettings>(
    () => initialValues?.visibility ?? defaultVisibility(showClubAudienceRadios)
  );
  const [settingsOptions, setSettingsOptions] = useState<{
    userTypes: { value: string; label: string }[];
    countries: string[];
    languages: { value: string; label: string }[];
    sports: { value: string; label: string }[];
  } | null>(null);

  useEffect(() => {
    if (showSettingsModal && (!settingsOptions || !Array.isArray(settingsOptions.sports))) {
      const empty = { userTypes: [], countries: [], languages: [], sports: [] };
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('adminToken')
          : null;
      const headers: HeadersInit = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      fetch('/api/news/ogp-settings-options', { headers })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) {
            setSettingsOptions(empty);
            return;
          }
          setSettingsOptions({
            userTypes: data.userTypes ?? [],
            countries: data.countries ?? [],
            languages: data.languages ?? [],
            sports: data.sports ?? [],
          });
        })
        .catch(() => setSettingsOptions(empty));
    }
  }, [showSettingsModal, settingsOptions]);

  const fetchOGP = useCallback(async (urlToFetch: string) => {
    if (!urlToFetch.trim()) return;
    setLoading(true);
    setError(null);
    setFetchedOg(null);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('adminToken')
          : null;
      const res = await fetch(`/api/ogp?url=${encodeURIComponent(urlToFetch.trim())}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to fetch link preview');
        return;
      }
      setFetchedOg({
        title: data.title,
        image: data.image,
        description: data.description,
        url: data.url || urlToFetch,
        siteName: data.siteName,
        type: data.type,
      });
    } catch (e) {
      setError('Failed to fetch link preview');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUrlBlur = () => {
    if (url.trim()) fetchOGP(url);
  };

  const resetMusicFields = () => {
    setArtist('');
    setMusicTitle('');
    setMusicalGenre('');
    setRegistrationType('');
  };

  const handleSave = () => {
    const genreToSave = isMusic && musicalGenre.trim() ? musicalGenre.trim() : null;
    const artistToSave = isMusic && artist.trim() ? artist.trim() : null;
    const musicTitleToSave = isMusic && musicTitle.trim() ? musicTitle.trim() : null;
    const registrationTypeToSave =
      isMusic && registrationType.trim() ? registrationType.trim() : null;
    const descriptionToSave = hasRichTextContent(description) ? description.trim() : '';
    if (fetchedOg) {
      onPastedArticle({
        ...fetchedOg,
        customDescription: descriptionToSave || undefined,
        visibility,
        languageCode: languageCode || undefined,
        musicalGenre: genreToSave,
        artist: artistToSave,
        musicTitle: musicTitleToSave,
        registrationType: registrationTypeToSave,
        isFavourite: isMusic ? isFavourite : undefined,
      });
      setUrl('');
      setDescription('');
      setLanguageCode('');
      setFetchedOg(null);
      setError(null);
      setVisibility(defaultVisibility(showClubAudienceRadios));
      if (isMusic) resetMusicFields();
    } else if (descriptionToSave && onSaveTyped) {
      onSaveTyped(descriptionToSave, genreToSave, {
        artist: artistToSave,
        musicTitle: musicTitleToSave,
        musicalGenre: genreToSave,
        registrationType: registrationTypeToSave,
        isFavourite: isMusic ? isFavourite : undefined,
      });
      setDescription('');
      if (isMusic) resetMusicFields();
    }
  };

  const handleCancel = () => {
    setUrl('');
    setDescription('');
    setFetchedOg(null);
    setError(null);
    if (isMusic) resetMusicFields();
    onCancel?.();
  };

  const visibilityLabel = isMusic ? 'Who will see the music' : 'Who will see the article';

  const fieldSelectClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500';
  const fieldInputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500';

  return (
    <div
      className={
        isMusic
          ? 'bg-white'
          : 'bg-white rounded-xl border border-gray-200 shadow-sm p-6'
      }
    >
      <p className="text-xs text-gray-500 mb-4">
        Once pasted, the Open Graph protocol will show the URL with title, image, and short
        description in the list of articles (column &quot;Pasted&quot;). All other entries will
        appear in the column &quot;Typed&quot;.
      </p>

      {/* URL input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Paste here your URL
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleUrlBlur}
          placeholder="https://..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
        />
        {loading && (
          <p className="mt-1 text-sm text-gray-500">Fetching link preview...</p>
        )}
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
        {fetchedOg && !error && (
          <div className="mt-2 p-4 bg-white rounded-lg border-2 border-gray-200">
            {fetchedOg.title && (
              <p className="font-bold text-gray-900 text-base mb-3">{fetchedOg.title}</p>
            )}
            <div className="flex gap-3 items-start">
              {fetchedOg.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fetchedOg.image}
                  alt=""
                  className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 object-cover rounded border border-gray-200"
                />
              )}
              {fetchedOg.description && (
                <p className="text-sm text-gray-600 flex-1 min-w-0 line-clamp-4">
                  {fetchedOg.description}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {isMusic && (
        <>
          {/* Artist / Title — free-text fields saved with the music entry */}
          <div className="mb-4 rounded-xl bg-gray-100 border border-gray-200 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <label htmlFor="music-artist" className="w-16 shrink-0 text-sm font-medium text-gray-700">
                  Artist
                </label>
                <input
                  id="music-artist"
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  className={fieldInputClass}
                  placeholder="Artist name"
                  aria-label="Artist"
                  autoComplete="off"
                />
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="music-title" className="w-16 shrink-0 text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  id="music-title"
                  type="text"
                  value={musicTitle}
                  onChange={(e) => setMusicTitle(e.target.value)}
                  className={fieldInputClass}
                  placeholder="Song / track title"
                  aria-label="Title"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          {/* Musical genre / Type of registration */}
          <div className="mb-4 rounded-xl bg-gray-100 border border-gray-200 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <label
                  htmlFor="music-genre"
                  className="w-[7.5rem] shrink-0 text-sm font-medium text-gray-700"
                >
                  Musical genre
                </label>
                <select
                  id="music-genre"
                  value={musicalGenre}
                  onChange={(e) => setMusicalGenre(e.target.value)}
                  className={fieldSelectClass}
                  aria-label="Musical genre"
                >
                  <option value=""></option>
                  {MUSICAL_GENRES.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label
                  htmlFor="music-registration-type"
                  className="w-[7.5rem] shrink-0 text-sm font-medium text-gray-700"
                >
                  Type of registration
                </label>
                <select
                  id="music-registration-type"
                  value={registrationType}
                  onChange={(e) => setRegistrationType(e.target.value)}
                  className={fieldSelectClass}
                  aria-label="Type of registration"
                >
                  <option value=""></option>
                  {MUSIC_REGISTRATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Description */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type here a brief description...
        </label>
        <RichTextEditor
          value={description}
          onChange={setDescription}
          placeholder="Brief description..."
          minHeight="120px"
        />
      </div>

      {/* Language + Visibility */}
      <div className="mb-6 rounded-xl bg-gray-50 border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Language used</label>
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              className="w-full min-w-[160px] max-w-sm px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow"
              aria-label="Language used in the article"
            >
              <option value="">Select language</option>
              {ALL_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} ({lang.nativeName})
                </option>
              ))}
            </select>
          </div>
          <div className="shrink-0 pt-0.5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:sr-only">Visibility</label>
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-colors font-medium text-sm"
              title={visibilityLabel}
              aria-label={visibilityLabel}
            >
              <Settings className="w-5 h-5 text-gray-500" />
              <span>{visibilityLabel}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Actions: Save, Cancel */}
      <div className="flex gap-6 mt-6 justify-center items-center">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition-colors"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium transition-colors"
        >
          Cancel
        </button>
      </div>

      <NewsSettingModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        initialSettings={visibility}
        onSave={(s) => setVisibility(s)}
        onDeleteSettings={() => setVisibility(defaultVisibility(showClubAudienceRadios))}
        options={settingsOptions}
        title={isMusic ? 'Music Setting' : 'OGP News Setting'}
        showClubAudienceRadios={showClubAudienceRadios}
      />
    </div>
  );
}
