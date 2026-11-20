'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Keep voice data URLs under MySQL TEXT (~64KB) after base64 overhead. */
export const MAX_VOICE_SECONDS = 45;
export const MAX_VOICE_DATA_URL_CHARS = 58_000;

export function formatVoiceRecordingTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function blobToAudioDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result.startsWith('data:audio/')) resolve(result);
      else reject(new Error('Invalid audio data'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read audio'));
    reader.readAsDataURL(blob);
  });
}

type UseChatVoiceRecordingOptions = {
  /** When false, starting a recording is a no-op. */
  canStart?: boolean;
  /** When true, starting / finishing is blocked (e.g. another send in flight). */
  busy?: boolean;
  onRecorded: (audioDataUrl: string) => void | Promise<void>;
};

/**
 * Telegram-style voice note recording via MediaRecorder.
 * Caller decides how to send the resulting `data:audio/...` URL.
 */
export function useChatVoiceRecording({
  canStart = true,
  busy = false,
  onRecorded,
}: UseChatVoiceRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSendOnStopRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const stopRecordingTracks = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const finishVoiceRecording = useCallback(async (blob: Blob) => {
    if (!blob.size) {
      setVoiceError('Recording was empty. Try again.');
      return;
    }
    try {
      const dataUrl = await blobToAudioDataUrl(blob);
      if (dataUrl.length > MAX_VOICE_DATA_URL_CHARS) {
        setVoiceError('Voice message is too long. Keep it under ~45 seconds.');
        return;
      }
      setVoiceError(null);
      await onRecordedRef.current(dataUrl);
    } catch (e) {
      console.error('Send voice:', e);
      setVoiceError('Could not send voice message.');
    }
  }, []);

  const cancelVoiceRecording = useCallback(() => {
    recordingSendOnStopRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    audioChunksRef.current = [];
    stopRecordingTracks();
    setIsRecording(false);
    setRecordingSeconds(0);
    setVoiceError(null);
  }, [stopRecordingTracks]);

  const stopAndSendVoiceRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      return;
    }
    recordingSendOnStopRef.current = true;
    try {
      recorder.stop();
    } catch {
      recordingSendOnStopRef.current = false;
      setIsRecording(false);
      stopRecordingTracks();
    }
  }, [stopRecordingTracks]);

  const startVoiceRecording = useCallback(async () => {
    if (!canStart || busy || isRecording) return;
    setVoiceError(null);
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Voice messages are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24_000 })
        : new MediaRecorder(stream, { audioBitsPerSecond: 24_000 });
      mediaRecorderRef.current = recorder;
      recordingSendOnStopRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const shouldSend = recordingSendOnStopRef.current;
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        stopRecordingTracks();
        setIsRecording(false);
        setRecordingSeconds(0);
        if (!shouldSend || chunks.length === 0) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        void finishVoiceRecording(blob);
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_VOICE_SECONDS) {
            recordingSendOnStopRef.current = true;
            try {
              mediaRecorderRef.current?.stop();
            } catch {
              /* ignore */
            }
          }
          return next;
        });
      }, 1000);
    } catch (e) {
      console.error('Start voice recording:', e);
      stopRecordingTracks();
      setIsRecording(false);
      setVoiceError('Microphone permission is required to send voice messages.');
    }
  }, [canStart, busy, isRecording, stopRecordingTracks, finishVoiceRecording]);

  useEffect(() => {
    return () => {
      recordingSendOnStopRef.current = false;
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    isRecording,
    recordingSeconds,
    voiceError,
    setVoiceError,
    startVoiceRecording,
    cancelVoiceRecording,
    stopAndSendVoiceRecording,
    formatRecordingTime: formatVoiceRecordingTime,
  };
}
