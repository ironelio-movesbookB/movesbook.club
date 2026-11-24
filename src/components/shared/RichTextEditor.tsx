'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo,
  Strikethrough,
  Underline,
  Undo
} from 'lucide-react';

const EDITOR_STYLES = `
  .rich-text-editor {
    font-family: Arial, sans-serif;
  }
  .rich-text-editor b,
  .rich-text-editor strong {
    font-weight: bold !important;
  }
  .rich-text-editor i,
  .rich-text-editor em {
    font-style: italic !important;
  }
  .rich-text-editor u {
    text-decoration: underline !important;
  }
  .rich-text-editor strike,
  .rich-text-editor s {
    text-decoration: line-through !important;
  }
  .rich-text-editor ul {
    list-style-type: disc !important;
    margin-left: 20px;
    margin-top: 10px;
    margin-bottom: 10px;
    padding-left: 20px;
  }
  .rich-text-editor ol {
    list-style-type: decimal !important;
    margin-left: 20px;
    margin-top: 10px;
    margin-bottom: 10px;
    padding-left: 20px;
  }
  .rich-text-editor li {
    margin: 5px 0;
    display: list-item !important;
  }
  .rich-text-editor a {
    color: #2563eb;
    text-decoration: underline;
  }
  .rich-text-editor img {
    max-width: 100%;
    height: auto;
  }
  .rich-text-editor hr {
    border: none;
    border-top: 1px solid #ccc;
    margin: 10px 0;
  }
  .rich-text-editor p {
    margin: 5px 0;
  }
`;

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  minHeight?: string;
  maxHeight?: string;
  showTestButton?: boolean;
  showClearButton?: boolean;
  focusRingClass?: string;
};

export default function RichTextEditor({
  value,
  onChange,
  minHeight = '300px',
  maxHeight = '400px',
  showTestButton = true,
  showClearButton = true,
  focusRingClass = 'focus:ring-2 focus:ring-pink-500'
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (
      document.activeElement === editorRef.current ||
      editorRef.current.contains(document.activeElement)
    ) {
      return;
    }
    if (editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const syncContent = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, commandValue?: string) => {
    if (!editorRef.current) return;

    editorRef.current.focus();

    if (command.startsWith('justify')) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      let textAlign = 'left';
      if (command === 'justifyCenter') textAlign = 'center';
      else if (command === 'justifyRight') textAlign = 'right';
      else if (command === 'justifyFull') textAlign = 'justify';

      let node = selection.anchorNode;
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          if (
            ['P', 'DIV', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI'].includes(element.tagName)
          ) {
            element.style.textAlign = textAlign;
            syncContent();
            return;
          }
        }
        node = node.parentNode;
      }

      try {
        const range = selection.getRangeAt(0);
        const wrapper = document.createElement('div');
        wrapper.style.textAlign = textAlign;
        range.surroundContents(wrapper);
        syncContent();
      } catch {
        // ignore
      }
      return;
    }

    document.execCommand(command, false, commandValue);
    syncContent();
    editorRef.current.focus();
  };

  const handleClear = () => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = '';
    onChange('');
    editorRef.current.focus();
  };

  const handleTest = () => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML +=
      '<p><strong>Bold text</strong>, <em>italic text</em>, <u>underlined text</u></p>';
    syncContent();
  };

  return (
    <div className="space-y-0">
      <style>{EDITOR_STYLES}</style>
      <div className="flex flex-wrap items-center gap-1 rounded-t border border-b-0 border-gray-300 bg-gray-100 p-2">
        <select
          onChange={(event) => execCommand('fontName', event.target.value)}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          defaultValue="Arial"
        >
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
        </select>

        <select
          onChange={(event) => execCommand('fontSize', event.target.value)}
          className="ml-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          defaultValue="3"
        >
          <option value="1">Small</option>
          <option value="3">Normal</option>
          <option value="5">Large</option>
          <option value="7">Huge</option>
        </select>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <ToolbarIconButton title="Bold" onClick={() => execCommand('bold')}>
          <Bold size={18} />
        </ToolbarIconButton>
        <ToolbarIconButton title="Italic" onClick={() => execCommand('italic')}>
          <Italic size={18} />
        </ToolbarIconButton>
        <ToolbarIconButton title="Underline" onClick={() => execCommand('underline')}>
          <Underline size={18} />
        </ToolbarIconButton>
        <ToolbarIconButton title="Strikethrough" onClick={() => execCommand('strikeThrough')}>
          <Strikethrough size={18} />
        </ToolbarIconButton>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <input
          type="color"
          onChange={(event) => execCommand('foreColor', event.target.value)}
          className="h-8 w-8 cursor-pointer rounded border border-gray-300"
          title="Text Color"
        />
        <input
          type="color"
          onChange={(event) => execCommand('backColor', event.target.value)}
          className="h-8 w-8 cursor-pointer rounded border border-gray-300"
          title="Background Color"
        />

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <ToolbarIconButton title="Align Left" onClick={() => execCommand('justifyLeft')}>
          <AlignLeft size={18} />
        </ToolbarIconButton>
        <ToolbarIconButton title="Align Center" onClick={() => execCommand('justifyCenter')}>
          <AlignCenter size={18} />
        </ToolbarIconButton>
        <ToolbarIconButton title="Align Right" onClick={() => execCommand('justifyRight')}>
          <AlignRight size={18} />
        </ToolbarIconButton>
        <ToolbarIconButton title="Justify" onClick={() => execCommand('justifyFull')}>
          <AlignJustify size={18} />
        </ToolbarIconButton>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <ToolbarIconButton title="Bullet List" onClick={() => execCommand('insertUnorderedList')}>
          <List size={18} />
        </ToolbarIconButton>
        <ToolbarIconButton title="Numbered List" onClick={() => execCommand('insertOrderedList')}>
          <ListOrdered size={18} />
        </ToolbarIconButton>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <button
          type="button"
          onClick={() => execCommand('indent')}
          className="rounded px-2 py-1 text-sm hover:bg-gray-200"
          title="Increase Indent"
        >
          →
        </button>
        <button
          type="button"
          onClick={() => execCommand('outdent')}
          className="rounded px-2 py-1 text-sm hover:bg-gray-200"
          title="Decrease Indent"
        >
          ←
        </button>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <ToolbarIconButton
          title="Insert Link"
          onClick={() => {
            const url = window.prompt('Enter URL:');
            if (url) execCommand('createLink', url);
          }}
        >
          <LinkIcon size={18} />
        </ToolbarIconButton>
        <ToolbarIconButton
          title="Insert Image"
          onClick={() => {
            const url = window.prompt('Enter image URL:');
            if (url) execCommand('insertImage', url);
          }}
        >
          <ImageIcon size={18} />
        </ToolbarIconButton>
        <button
          type="button"
          onClick={() => execCommand('insertHorizontalRule')}
          className="rounded px-2 py-1 text-sm hover:bg-gray-200"
          title="Insert Horizontal Line"
        >
          ━
        </button>

        <div className="mx-1 h-6 w-px bg-gray-300" />

        <ToolbarIconButton title="Undo" onClick={() => execCommand('undo')}>
          <Undo size={18} />
        </ToolbarIconButton>
        <ToolbarIconButton title="Redo" onClick={() => execCommand('redo')}>
          <Redo size={18} />
        </ToolbarIconButton>

        {(showTestButton || showClearButton) && <div className="flex-1" />}

        {showTestButton && (
          <button
            type="button"
            onClick={handleTest}
            className="rounded bg-purple-500 px-3 py-1 text-sm text-white hover:bg-purple-600"
            title="Test formatting"
          >
            Test
          </button>
        )}
        {showClearButton && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
            title="Clear All"
          >
            Clear
          </button>
        )}
      </div>

      <div
        ref={editorRef}
        contentEditable
        spellCheck={false}
        className={`rich-text-editor overflow-y-auto rounded-b border border-gray-300 bg-white p-4 focus:outline-none ${focusRingClass}`}
        style={{
          minHeight,
          maxHeight,
          fontSize: '14px',
          lineHeight: '1.6',
          wordWrap: 'break-word',
          whiteSpace: 'normal'
        }}
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
      />
    </div>
  );
}

function ToolbarIconButton({
  title,
  onClick,
  children
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded p-1.5 hover:bg-gray-200"
      title={title}
    >
      {children}
    </button>
  );
}
