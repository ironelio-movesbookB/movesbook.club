'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Headphones,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
  ExternalLink,
} from 'lucide-react';
import { extractYouTubeVideoId } from '@/constants/tools.constants';
import MusicPlayerSponsorsBanner from '@/components/music/MusicPlayerSponsorsBanner';

export type MusicPlayerTrack = {
  id: string;
  title: string | null;
  artist?: string | null;
  image: string | null;
  url: string;
  siteName: string | null;
  description: string | null;
  creatorUsername: string | null;
};

type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'stopped';

type MediaKind = 'youtube' | 'audio' | 'tiktok' | 'vimeo' | 'external';

function extractTikTokVideoId(url: string): string | null {
  const u = (url || '').trim();
  const m = u.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
  if (m?.[1]) return m[1];
  const short = u.match(/vm\.tiktok\.com\/([A-Za-z0-9]+)/i);
  return short?.[1] ?? null;
}

function extractVimeoVideoId(url: string): string | null {
  const m = (url || '').trim().match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m?.[1] ?? null;
}

function detectMediaKind(url: string): MediaKind {
  const u = (url || '').trim();
  if (extractYouTubeVideoId(u)) return 'youtube';
  if (extractTikTokVideoId(u)) return 'tiktok';
  if (extractVimeoVideoId(u)) return 'vimeo';
  if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(u)) return 'audio';
  return 'external';
}

function youtubeEmbedSrc(videoId: string, autoplay: boolean): string {
  const origin =
    typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    playsinline: '1',
    modestbranding: '1',
    ...(origin ? { origin } : {}),
    ...(autoplay ? { autoplay: '1' } : {}),
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function tiktokPlayerSrc(videoId: string, autoplay: boolean): string {
  const params = new URLSearchParams({
    controls: '1',
    progress_bar: '1',
    play_button: '1',
    volume_control: '1',
    loop: '0',
    autoplay: autoplay ? '1' : '0',
    music_info: '1',
  });
  return `https://www.tiktok.com/player/v1/${videoId}?${params.toString()}`;
}

function postYouTubeCommand(
  iframe: HTMLIFrameElement | null,
  func: 'playVideo' | 'pauseVideo' | 'stopVideo' | 'seekTo',
  args: unknown[] = []
) {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(
    JSON.stringify({ event: 'command', func, args }),
    '*'
  );
}

function postTikTokCommand(
  iframe: HTMLIFrameElement | null,
  type: 'play' | 'pause' | 'seekTo' | 'mute' | 'unMute',
  value?: number
) {
  if (!iframe?.contentWindow) return;
  const message: Record<string, unknown> = {
    type,
    'x-tiktok-player': true,
  };
  if (value !== undefined) message.value = value;
  iframe.contentWindow.postMessage(message, '*');
}

function postVimeoCommand(
  iframe: HTMLIFrameElement | null,
  method: 'play' | 'pause' | 'setCurrentTime',
  value?: number
) {
  if (!iframe?.contentWindow) return;
  const message: Record<string, unknown> = { method };
  if (value !== undefined) message.value = value;
  iframe.contentWindow.postMessage(JSON.stringify(message), '*');
}

interface MusicPlayerWindowProps {
  tracks: MusicPlayerTrack[];
  initialTrackId: string;
  onClose: () => void;
  /** Fired when the current track changes (open / next / prev) so callers can record listens. */
  onTrackListen?: (trackId: string) => void;
}

export default function MusicPlayerWindow({
  tracks,
  initialTrackId,
  onClose,
  onTrackListen,
}: MusicPlayerWindowProps) {
  const initialIndex = Math.max(
    0,
    tracks.findIndex((t) => t.id === initialTrackId)
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [embedKey, setEmbedKey] = useState(0);
  const [autoplayEmbed, setAutoplayEmbed] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingPlayRef = useRef(false);
  const mediaKindRef = useRef<MediaKind>('external');
  const lastReportedTrackIdRef = useRef<string | null>(null);
  const onTrackListenRef = useRef(onTrackListen);
  onTrackListenRef.current = onTrackListen;

  const playlist = tracks.length > 0 ? tracks : [];
  const current = playlist[currentIndex] ?? null;
  const mediaKind = current ? detectMediaKind(current.url) : 'external';
  mediaKindRef.current = mediaKind;

  // Report once per track id while this player instance is open (next/prev only).
  useEffect(() => {
    if (!current?.id || !onTrackListenRef.current) return;
    if (lastReportedTrackIdRef.current === current.id) return;
    lastReportedTrackIdRef.current = current.id;
    onTrackListenRef.current(current.id);
  }, [current?.id]);

  const displayTitle = current?.title || current?.url || 'Unknown track';
  const displaySubtitle =
    current?.artist || current?.siteName || current?.creatorUsername || current?.description || '';

  const ytId = current ? extractYouTubeVideoId(current.url) : null;
  const tiktokId = current ? extractTikTokVideoId(current.url) : null;
  const vimeoId = current ? extractVimeoVideoId(current.url) : null;

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const sendPlay = useCallback(() => {
    const kind = mediaKindRef.current;
    const iframe = iframeRef.current;
    if (kind === 'youtube') {
      postYouTubeCommand(iframe, 'playVideo');
      return;
    }
    if (kind === 'tiktok') {
      postTikTokCommand(iframe, 'play');
      return;
    }
    if (kind === 'vimeo') {
      postVimeoCommand(iframe, 'play');
      return;
    }
  }, []);

  const sendPause = useCallback(() => {
    const kind = mediaKindRef.current;
    const iframe = iframeRef.current;
    if (kind === 'youtube') {
      postYouTubeCommand(iframe, 'pauseVideo');
      return;
    }
    if (kind === 'tiktok') {
      postTikTokCommand(iframe, 'pause');
      return;
    }
    if (kind === 'vimeo') {
      postVimeoCommand(iframe, 'pause');
      return;
    }
  }, []);

  const sendStop = useCallback(() => {
    const kind = mediaKindRef.current;
    const iframe = iframeRef.current;
    if (kind === 'youtube') {
      postYouTubeCommand(iframe, 'stopVideo');
      return;
    }
    if (kind === 'tiktok') {
      postTikTokCommand(iframe, 'pause');
      postTikTokCommand(iframe, 'seekTo', 0);
      return;
    }
    if (kind === 'vimeo') {
      postVimeoCommand(iframe, 'pause');
      postVimeoCommand(iframe, 'setCurrentTime', 0);
      return;
    }
  }, []);

  const loadTrackAt = useCallback(
    (index: number, shouldPlay: boolean) => {
      if (playlist.length === 0) return;
      const next = ((index % playlist.length) + playlist.length) % playlist.length;
      stopAudio();
      sendStop();
      pendingPlayRef.current = shouldPlay;
      setPlayerReady(false);
      setCurrentIndex(next);
      setEmbedKey((k) => k + 1);
      setAutoplayEmbed(shouldPlay);
      setStatus(shouldPlay ? 'playing' : 'stopped');
    },
    [playlist.length, stopAudio, sendStop]
  );

  // HTML5 audio tracks
  useEffect(() => {
    if (!current || mediaKind !== 'audio') {
      stopAudio();
      return;
    }
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.src = current.url;
    audio.load();

    const onEnded = () => {
      if (playlist.length > 1) {
        loadTrackAt(currentIndex + 1, true);
      } else {
        setStatus('stopped');
      }
    };
    const onError = () => setStatus('stopped');
    const onPlay = () => setStatus('playing');
    const onPause = () => {
      if (audio.currentTime > 0 && !audio.ended) setStatus('paused');
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    if (autoplayEmbed || pendingPlayRef.current) {
      pendingPlayRef.current = false;
      void audio.play().then(() => setStatus('playing')).catch(() => setStatus('paused'));
    }

    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, mediaKind, current?.url, embedKey]);

  // Listen for TikTok / YouTube player events to sync UI status
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;

      // TikTok player kit
      if (data && typeof data === 'object' && data['x-tiktok-player'] === true) {
        if (data.type === 'onPlayerReady') {
          setPlayerReady(true);
          if (pendingPlayRef.current) {
            pendingPlayRef.current = false;
            postTikTokCommand(iframeRef.current, 'play');
            setStatus('playing');
          }
        }
        if (data.type === 'onStateChange') {
          const state = Number(data.value);
          // -1 init, 0 ended, 1 playing, 2 paused, 3 buffering
          if (state === 1) setStatus('playing');
          else if (state === 2) setStatus('paused');
          else if (state === 0) {
            if (playlist.length > 1) {
              loadTrackAt(currentIndex + 1, true);
            } else {
              setStatus('stopped');
            }
          }
        }
        return;
      }

      // YouTube iframe API
      let ytData = data;
      if (typeof data === 'string') {
        try {
          ytData = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (ytData && typeof ytData === 'object' && ytData.event === 'onReady') {
        setPlayerReady(true);
        if (pendingPlayRef.current) {
          pendingPlayRef.current = false;
          postYouTubeCommand(iframeRef.current, 'playVideo');
          setStatus('playing');
        }
      }
      if (ytData && typeof ytData === 'object' && ytData.event === 'infoDelivery') {
        const playerState = ytData.info?.playerState;
        // 1 playing, 2 paused, 0 ended, 5 cued
        if (playerState === 1) setStatus('playing');
        else if (playerState === 2) setStatus('paused');
        else if (playerState === 0) setStatus('stopped');
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [playlist.length, currentIndex, loadTrackAt]);

  // Notify YouTube iframe we want API events after load
  const handleIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    if (mediaKindRef.current === 'youtube') {
      // Handshake so YouTube starts sending events / accepting commands
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'listening', id: embedKey }),
        '*'
      );
      setPlayerReady(true);
      if (pendingPlayRef.current || autoplayEmbed) {
        // Small delay so the player accepts commands after load
        window.setTimeout(() => {
          postYouTubeCommand(iframeRef.current, 'playVideo');
          pendingPlayRef.current = false;
          setStatus('playing');
        }, 300);
      }
    }

    if (mediaKindRef.current === 'tiktok') {
      // TikTok emits onPlayerReady; also retry play if we already asked for it
      if (pendingPlayRef.current || autoplayEmbed) {
        window.setTimeout(() => {
          postTikTokCommand(iframeRef.current, 'play');
        }, 400);
      }
    }

    if (mediaKindRef.current === 'vimeo') {
      setPlayerReady(true);
      if (pendingPlayRef.current || autoplayEmbed) {
        window.setTimeout(() => {
          postVimeoCommand(iframeRef.current, 'play');
          pendingPlayRef.current = false;
          setStatus('playing');
        }, 300);
      }
    }
  }, [embedKey, autoplayEmbed]);

  useEffect(() => {
    return () => {
      stopAudio();
      sendStop();
    };
  }, [stopAudio, sendStop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePlay = useCallback(() => {
    if (!current) return;

    if (mediaKind === 'audio') {
      const audio = audioRef.current ?? new Audio(current.url);
      audioRef.current = audio;
      if (!audio.src) audio.src = current.url;
      void audio.play().then(() => setStatus('playing')).catch(() => setStatus('paused'));
      return;
    }

    if (mediaKind === 'external') {
      // No controllable embed — open original in a new tab as fallback
      window.open(current.url, '_blank', 'noopener,noreferrer');
      setStatus('playing');
      return;
    }

    // Controllable embeds (YouTube / TikTok / Vimeo)
    pendingPlayRef.current = true;
    setStatus('playing');

    if (playerReady && iframeRef.current) {
      sendPlay();
      pendingPlayRef.current = false;
      return;
    }

    // Player not ready yet: remount with autoplay and play on ready/load
    setAutoplayEmbed(true);
    setEmbedKey((k) => k + 1);
    setPlayerReady(false);
  }, [current, mediaKind, playerReady, sendPlay]);

  const handlePause = useCallback(() => {
    if (mediaKind === 'audio') {
      audioRef.current?.pause();
      setStatus('paused');
      return;
    }
    pendingPlayRef.current = false;
    sendPause();
    setStatus('paused');
  }, [mediaKind, sendPause]);

  const handleStop = useCallback(() => {
    pendingPlayRef.current = false;
    if (mediaKind === 'audio') {
      stopAudio();
      setStatus('stopped');
      return;
    }
    sendStop();
    setAutoplayEmbed(false);
    setStatus('stopped');
    // Remount without autoplay so the preview returns to a stopped frame
    setEmbedKey((k) => k + 1);
    setPlayerReady(false);
  }, [mediaKind, stopAudio, sendStop]);

  const handlePrev = useCallback(() => {
    if (playlist.length === 0) return;
    if (mediaKind === 'audio' && audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (mediaKind === 'tiktok') {
      postTikTokCommand(iframeRef.current, 'seekTo', 0);
    }
    if (mediaKind === 'youtube' && status === 'playing') {
      postYouTubeCommand(iframeRef.current, 'seekTo', [0, true]);
    }
    loadTrackAt(currentIndex - 1, status === 'playing');
  }, [playlist.length, mediaKind, status, currentIndex, loadTrackAt]);

  const handleNext = useCallback(() => {
    if (playlist.length === 0) return;
    loadTrackAt(currentIndex + 1, status === 'playing');
  }, [playlist.length, currentIndex, status, loadTrackAt]);

  const controls: {
    key: string;
    label: string;
    Icon?: typeof Play;
    onClick: () => void;
    active: boolean;
    stopSquare?: boolean;
  }[] = [
    {
      key: 'play',
      label: 'Play',
      Icon: Play,
      onClick: handlePlay,
      active: status === 'playing',
    },
    {
      key: 'prev',
      label: 'Previous',
      Icon: SkipBack,
      onClick: handlePrev,
      active: false,
    },
    {
      key: 'next',
      label: 'Next',
      Icon: SkipForward,
      onClick: handleNext,
      active: false,
    },
    {
      key: 'pause',
      label: 'Pause',
      Icon: Pause,
      onClick: handlePause,
      active: status === 'paused',
    },
    {
      key: 'stop',
      label: 'Stop',
      onClick: handleStop,
      active: status === 'stopped',
      stopSquare: true,
    },
  ];

  const embedSrc = (() => {
    if (!current) return null;
    if (mediaKind === 'youtube' && ytId) {
      return youtubeEmbedSrc(ytId, autoplayEmbed);
    }
    if (mediaKind === 'tiktok' && tiktokId && /^\d+$/.test(tiktokId)) {
      return tiktokPlayerSrc(tiktokId, autoplayEmbed);
    }
    if (mediaKind === 'vimeo' && vimeoId) {
      const params = new URLSearchParams({
        api: '1',
        ...(autoplayEmbed ? { autoplay: '1' } : {}),
      });
      return `https://player.vimeo.com/video/${vimeoId}?${params.toString()}`;
    }
    return null;
  })();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="music-player-title"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-5xl max-h-[92vh] flex-col overflow-hidden rounded-sm border border-white/40 bg-[#152038] text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/25 px-4 py-3">
          <Headphones className="h-6 w-6 shrink-0" strokeWidth={1.75} aria-hidden />
          <h2 id="music-player-title" className="text-lg font-bold tracking-wide shrink-0">
            My Music
          </h2>
          <MusicPlayerSponsorsBanner />
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close player"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[88px] shrink-0 flex-col items-center gap-3 border-r border-white/25 px-2 py-4">
            <div className="flex w-full flex-col gap-2">
              <div className="aspect-square w-full overflow-hidden rounded-sm border border-amber-500/50 bg-black">
                {current?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Music2 className="h-5 w-5 text-white/30" aria-hidden />
                  </div>
                )}
              </div>
              <div className="aspect-square w-full overflow-hidden rounded-sm border border-amber-500/30 bg-[#0d1528]">
                <div className="flex h-full w-full items-center justify-center p-1">
                  <span className="text-[9px] leading-tight text-white/50 text-center line-clamp-3">
                    {status === 'playing'
                      ? 'Playing'
                      : status === 'paused'
                        ? 'Paused'
                        : status === 'stopped'
                          ? 'Stopped'
                          : 'Ready'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-col items-center gap-3">
              {controls.map(({ key, label, Icon, onClick, active, stopSquare }) => (
                <button
                  key={key}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClick();
                  }}
                  disabled={!current}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-40 ${
                    active
                      ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                      : 'border-white/80 text-white hover:border-white hover:bg-white/10'
                  }`}
                  aria-label={label}
                  title={label}
                >
                  {stopSquare ? (
                    <span className="block h-3.5 w-3.5 bg-current" aria-hidden />
                  ) : Icon ? (
                    <Icon
                      className={`h-5 w-5 ${key === 'play' ? 'ml-0.5 fill-current' : ''}`}
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="border-b border-white/25 px-4 py-2">
              <h3 className="text-sm font-semibold tracking-wide">My Playlist</h3>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-3 flex flex-col gap-1 border border-white/30 bg-[#1a2744] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={displayTitle}>
                    {displayTitle}
                  </p>
                  {displaySubtitle ? (
                    <p className="truncate text-xs text-white/60" title={displaySubtitle}>
                      {displaySubtitle}
                    </p>
                  ) : null}
                </div>
                {current?.url ? (
                  <a
                    href={current.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open original
                  </a>
                ) : null}
              </div>

              <div className="mb-3 aspect-video w-full overflow-hidden rounded-sm border border-white/30 bg-black">
                {mediaKind === 'audio' ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
                    {current?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={current.image}
                        alt=""
                        className="h-28 w-28 rounded object-cover"
                      />
                    ) : (
                      <Music2 className="h-16 w-16 text-white/25" aria-hidden />
                    )}
                    <p className="text-xs text-white/60">
                      {status === 'playing' ? 'Audio playing…' : 'Direct audio track'}
                    </p>
                  </div>
                ) : embedSrc ? (
                  <iframe
                    key={`${current?.id}-${embedKey}`}
                    ref={iframeRef}
                    src={embedSrc}
                    title={displayTitle}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    onLoad={handleIframeLoad}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                    {current?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={current.image}
                        alt=""
                        className="mb-2 h-32 w-32 rounded object-cover"
                      />
                    ) : (
                      <Music2 className="h-16 w-16 text-white/25" aria-hidden />
                    )}
                    <p className="text-sm text-white/70">Preview not available for this link</p>
                    <p className="text-xs text-white/45">
                      Press Play to open the original link
                    </p>
                  </div>
                )}
              </div>

              <ul className="divide-y divide-white/10 border border-white/30">
                {playlist.map((track, i) => {
                  const isCurrent = i === currentIndex;
                  const label = track.title || track.url;
                  return (
                    <li key={track.id}>
                      <button
                        type="button"
                        onClick={() => loadTrackAt(i, true)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          isCurrent
                            ? 'bg-amber-400/15 text-amber-100'
                            : 'hover:bg-white/5 text-white/90'
                        }`}
                      >
                        <span className="w-5 shrink-0 text-xs tabular-nums text-white/50">
                          {i + 1}
                        </span>
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-sm bg-black">
                          {track.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={track.image}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Music2 className="h-4 w-4 text-white/30" aria-hidden />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{label}</p>
                          <p className="truncate text-[11px] text-white/50">
                            {track.siteName || track.creatorUsername || ''}
                          </p>
                        </div>
                        {isCurrent && status === 'playing' ? (
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-amber-300">
                            Playing
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
                {playlist.length === 0 ? (
                  <li className="px-3 py-8 text-center text-sm text-white/45">
                    No tracks in playlist
                  </li>
                ) : null}
              </ul>
            </div>
          </div>

          <div className="hidden w-10 shrink-0 border-l border-white/25 bg-[#1a2744] sm:block" aria-hidden />
        </div>
      </div>
    </div>
  );
}
