/**
 * Chat message content helpers.
 *
 * Image messages are stored as a data URL. An optional caption is appended after
 * a blank line: `data:image/...\n\ncaption text` (Telegram-style image + text).
 * Voice messages are stored as `data:audio/...` data URLs (same reply-prefix rules).
 * Reply quotes use the existing `> Name: excerpt\n\nbody` prefix in front of that.
 */

const REPLY_SEP = '\n\n';

/** True when the message body (after an optional reply quote) is an image data URL. */
export function isImageContent(content: string): boolean {
  const body = getMessageBody(content);
  return body.startsWith('data:image/');
}

/** True when the message body (after an optional reply quote) is an audio data URL. */
export function isAudioContent(content: string): boolean {
  const body = getMessageBody(content);
  return body.startsWith('data:audio/');
}

/** Split an optional `> Name: excerpt\n\nbody` reply prefix. */
export function parseReplyQuote(
  content: string
): { replyLine: string; senderName: string; excerpt: string; body: string } | null {
  if (!content.startsWith('> ') || !content.includes(REPLY_SEP)) return null;
  const firstLine = content.split('\n')[0];
  const colonIdx = firstLine.indexOf(': ', 2);
  if (colonIdx === -1) return null;
  const senderName = firstLine.slice(2, colonIdx).trim();
  const excerpt = firstLine.slice(colonIdx + 2).trim();
  const body = content.slice(firstLine.length + REPLY_SEP.length);
  return { replyLine: firstLine, senderName, excerpt, body };
}

export function getMessageBody(content: string): string {
  return parseReplyQuote(content)?.body ?? content;
}

/** Build stored content for an image, optionally with a caption. */
export function buildImageContent(imageDataUrl: string, caption?: string): string {
  const cap = (caption ?? '').trim();
  return cap ? `${imageDataUrl}${REPLY_SEP}${cap}` : imageDataUrl;
}

export function parseImageContent(
  content: string
): { src: string; caption: string } | null {
  const body = getMessageBody(content);
  if (!body.startsWith('data:image/')) return null;
  const sep = body.indexOf(REPLY_SEP);
  if (sep === -1) return { src: body, caption: '' };
  return {
    src: body.slice(0, sep),
    caption: body.slice(sep + REPLY_SEP.length),
  };
}

/** Build stored content for a voice / audio message. */
export function buildAudioContent(audioDataUrl: string): string {
  return audioDataUrl;
}

export function parseAudioContent(content: string): { src: string } | null {
  const body = getMessageBody(content);
  if (!body.startsWith('data:audio/')) return null;
  const sep = body.indexOf(REPLY_SEP);
  return { src: sep === -1 ? body : body.slice(0, sep) };
}

/** Short preview for conversation lists / reply excerpts. */
export function messagePreview(content: string, maxLen = 80): string {
  const image = parseImageContent(content);
  if (image) {
    const cap = image.caption.trim();
    if (!cap) return '[Image]';
    const clipped = cap.length > maxLen ? `${cap.slice(0, maxLen)}…` : cap;
    return `[Image] ${clipped}`;
  }
  if (isAudioContent(content)) return '[Voice message]';
  const body = getMessageBody(content);
  const firstLine = body.split('\n')[0].trim();
  if (firstLine.length <= maxLen) return firstLine;
  return `${firstLine.slice(0, maxLen)}…`;
}
