'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Script from 'next/script';
import {
  destroyCke4Instance,
  getCke4Window,
  type Cke4Instance,
} from '@/lib/ckeditor4Legacy';

type PromocodeInviteCKEditor4Props = {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  minHeightPx?: number;
};

/** Legacy CKEditor 4 — matches PHP send-invite popup (manual init, not auto-replace). */
export default function PromocodeInviteCKEditor4({
  id,
  value,
  onChange,
  minHeightPx = 330,
}: PromocodeInviteCKEditor4Props) {
  const reactId = useId().replace(/:/g, '');
  const editorId = id?.trim() || `promocode_invite_editor_${reactId}`;
  const [scriptReady, setScriptReady] = useState(
    () => typeof window !== 'undefined' && !!getCke4Window().CKEDITOR
  );
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const suppressChangeRef = useRef(false);
  const editorRef = useRef<Cke4Instance | null>(null);
  onChangeRef.current = onChange;
  valueRef.current = value;

  useEffect(() => {
    if (!scriptReady || typeof window === 'undefined') return;

    const CKEDITOR = getCke4Window().CKEDITOR;
    if (!CKEDITOR) return;

    const element = document.getElementById(editorId);
    if (!element) return;

    destroyCke4Instance(editorId);

    const editor = CKEDITOR.replace(editorId, {
      height: minHeightPx,
      allowedContent: true,
    });
    editorRef.current = editor;

    editor.on('instanceReady', () => {
      suppressChangeRef.current = true;
      editor.setData(valueRef.current || '');
      suppressChangeRef.current = false;

      editor.on('change', () => {
        if (suppressChangeRef.current) return;
        onChangeRef.current(editor.getData());
      });
    });

    return () => {
      editorRef.current = null;
      destroyCke4Instance(editorId);
    };
  }, [editorId, minHeightPx, scriptReady]);

  useEffect(() => {
    const editor =
      editorRef.current ??
      (typeof window !== 'undefined' ? getCke4Window().CKEDITOR?.instances[editorId] : undefined);
    if (!editor) return;
    const next = value || '';
    if (editor.getData() !== next) {
      suppressChangeRef.current = true;
      editor.setData(next);
      suppressChangeRef.current = false;
    }
  }, [editorId, value]);

  return (
    <>
      <Script
        src="/js/ckeditor/ckeditor.js"
        strategy="afterInteractive"
        onLoad={() => {
          const win = getCke4Window();
          win.RootURL = '/';
          if (win.CKEDITOR) {
            // CKEditor auto-replaces textareas with class "ckeditor" on domReady.
            // We initialize manually to avoid editor-element-conflict.
            win.CKEDITOR.replaceClass = '';
          }
          setScriptReady(true);
        }}
      />
      {/* Do not use className="ckeditor" — triggers CKEDITOR.replaceAll() */}
      <textarea id={editorId} name="content" />
    </>
  );
}
