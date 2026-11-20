/**
 * Build YouTube embed URL.
 * Legacy PHP clubs/show_video always uses videoseries?list= for playlist ids.
 * Single video ids fall back to a looped embed.
 */
export function moodMusicEmbedUrl(playlistOrVideoId: string): string {
  const id = playlistOrVideoId.trim();
  if (!id) return '';
  const isPlaylist = /^(PL|UU|LL|FL|OL|RD)/i.test(id) || id.length > 20;
  if (isPlaylist) {
    // Exact legacy PHP embed query.
    return `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(id)}&autoplay=1&loop=1&controls=0`;
  }
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&loop=1&playlist=${encodeURIComponent(id)}&controls=0`;
}
