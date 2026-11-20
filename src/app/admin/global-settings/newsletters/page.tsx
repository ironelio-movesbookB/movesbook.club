'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// CKEditor must be loaded on client only.
const CKEditor = dynamic(
  () =>
    import('@ckeditor/ckeditor5-react').then(
      (mod) => mod.CKEditor
    ),
  {
    ssr: false,
  }
);


// ============================================================
// TYPES
// ============================================================

interface Language {
  code: string;
  label: string;
}

interface HomepageContent {
  id: number;
  language: string;
  content: string;
  displayMode: string;
}

interface ContentRowProps {
  item: HomepageContent;
  onPreview: (item: HomepageContent) => void;
  onDelete: (id: number) => void;
}


// ============================================================
// LANGUAGES
// ============================================================

const LANGUAGES: Language[] = [
  { code: 'en', label: 'en' },
  { code: 'fr', label: 'fr' },
  { code: 'de', label: 'de' },
  { code: 'it', label: 'it' },
  { code: 'es', label: 'es' },
  { code: 'por', label: 'por' },
  { code: 'rus', label: 'rus' },
  { code: 'ind', label: 'ind' },
  { code: 'chin', label: 'chin' },
  { code: 'arab', label: 'arab' },
];


// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_CONTENT = '';

const DEFAULT_DISPLAY_MODE = 'Popup in Window box';

const DISPLAY_MODES = [
  'Popup in Window box',
  'New window',
  'Same window',
  'Iframe',
];


// ============================================================
// INITIAL CONTENT
// ============================================================

const INITIAL_CONTENT: HomepageContent[] = [
  {
    id: 1,
    language: 'en',
    content: DEFAULT_CONTENT,
    displayMode: DEFAULT_DISPLAY_MODE,
  },
];


// ============================================================
// LANGUAGE TABS
// ============================================================

function LanguageTabs({
  selectedLanguage,
  onChange,
}: {
  selectedLanguage: string;
  onChange: (language: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center">
      {LANGUAGES.map((language) => {
        const selected =
          selectedLanguage === language.code;

        return (
          <button
            key={language.code}
            type="button"
            onClick={() =>
              onChange(language.code)
            }
            className={`
              min-w-[45px]
              border
              px-2
              py-1
              text-left
              text-[16px]
              leading-6
              transition-colors
              ${
                selected
                  ? `
                    border-red-500
                    bg-[#fffdf0]
                    text-black
                  `
                  : `
                    border-transparent
                    bg-white
                    text-black
                    hover:bg-gray-100
                  `
              }
            `}
          >
            {language.label}
          </button>
        );
      })}
    </div>
  );
}


// ============================================================
// TOGGLE SWITCH
// ============================================================

function ToggleSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() =>
        onChange(!enabled)
      }
      className="
        relative
        flex
        h-[28px]
        w-[56px]
        items-center
        rounded-full
        border
        border-[#aaa]
        bg-white
        p-[2px]
      "
    >
      <span
        className={`
          absolute
          top-[3px]
          h-[20px]
          w-[20px]
          rounded-full
          border
          border-[#999]
          bg-white
          transition-all
          ${
            enabled
              ? 'left-[4px] border-blue-500'
              : 'left-[30px]'
          }
        `}
      />

      {enabled && (
        <span
          className="
            absolute
            left-[7px]
            top-[6px]
            h-[14px]
            w-[14px]
            rounded-full
            border
            border-blue-500
            bg-blue-500
          "
        />
      )}
    </button>
  );
}


// ============================================================
// CKEDITOR
// ============================================================

function HomepageContentEditor({
  content,
  language,
  onChange,
}: {
  content: string;
  language: string;
  onChange: (value: string) => void;
}) {
  const [Editor, setEditor] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    import('@ckeditor/ckeditor5-build-classic')
      .then((module) => {
        if (mounted) {
          setEditor(() => module.default);
        }
      })
      .catch((error) => {
        console.error('Failed to load CKEditor:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!Editor) {
    return (
      <div className="ckeditor-wrapper">
        <div className="border border-[#ccc] p-3 text-sm text-gray-500">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div className="ckeditor-wrapper">
      <CKEditor
        key={language}
        editor={Editor}
        data={content}
        onChange={(_, editor) => {
          onChange(editor.getData());
        }}
        config={{
          toolbar: {
            items: [
              'heading',
              '|',
              'bold',
              'italic',
              'underline',
              'strikethrough',
              '|',
              'bulletedList',
              'numberedList',
              '|',
              'alignment',
              '|',
              'link',
              'insertTable',
              'blockQuote',
              '|',
              'undo',
              'redo',
            ],
            shouldNotGroupWhenFull: true,
          },

          heading: {
            options: [
              {
                model: 'paragraph',
                title: 'Paragraph',
                class: 'ck-heading_paragraph',
              },
              {
                model: 'heading1',
                view: 'h1',
                title: 'Heading 1',
                class: 'ck-heading_heading1',
              },
              {
                model: 'heading2',
                view: 'h2',
                title: 'Heading 2',
                class: 'ck-heading_heading2',
              },
              {
                model: 'heading3',
                view: 'h3',
                title: 'Heading 3',
                class: 'ck-heading_heading3',
              },
            ],
          },
        }}
      />
    </div>
  );
}


// ============================================================
// CONTENT ROW
// ============================================================

function ContentRow({
  item,
  selectedLanguage,
  displayMode,
  onSelect,
  onPreview,
  onDelete,
  onDisplayModeChange,
}: ContentRowProps & {
  selectedLanguage: string;
  displayMode: string;
  onSelect: (language: string) => void;
  onDisplayModeChange: (mode: string) => void;
}) {
  const isSelected =
    item.language === selectedLanguage;

  return (
    <div
      className={`
        grid
        grid-cols-[1fr_1fr_1fr]
        items-center
        border-b
        border-[#999]
        py-[10px]
        ${
          isSelected
            ? 'bg-[#fffdf0]'
            : 'bg-white'
        }
      `}
    >
      {/* ACTIONS */}

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onPreview(item)}
          className="
            bg-[#4a4a4a]
            px-2
            py-1
            text-[14px]
            text-white
            hover:bg-[#333]
          "
        >
          Preview
        </button>

        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="
            bg-[#4a4a4a]
            px-2
            py-1
            text-[14px]
            text-white
            hover:bg-[#333]
          "
        >
          Delete
        </button>
      </div>


      {/* LANGUAGE SELECTED */}

      <div
        className="
          flex
          items-center
          justify-center
          gap-2
        "
      >
        <span className="text-[15px]">
          Language Selected
        </span>

        <button
          type="button"
          onClick={() =>
            onSelect(item.language)
          }
          className="
            border
            border-red-500
            bg-[#fffce5]
            px-3
            py-1
            text-[18px]
          "
        >
          {selectedLanguage}
        </button>
      </div>


      {/* DISPLAY MODE */}

      <div
        className="
          flex
          items-center
          justify-end
          gap-3
        "
      >
        <span className="whitespace-nowrap text-[15px]">
          Display mode
        </span>

        <select
          value={
            isSelected
              ? displayMode
              : item.displayMode
          }
          disabled={!isSelected}
          onChange={(event) =>
            onDisplayModeChange(
              event.target.value
            )
          }
          className="
            h-[30px]
            min-w-[220px]
            border
            border-[#bbb]
            bg-white
            px-2
            text-[14px]
            text-[#555]
            disabled:bg-white
            disabled:text-[#777]
          "
        >
          {DISPLAY_MODES.map((mode) => (
            <option
              key={mode}
              value={mode}
            >
              {mode}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}


// ============================================================
// MAIN PAGE
// ============================================================

export default function HTMLHomepageLinkDisplayPage() {
  const router = useRouter();


  // ==========================================================
  // AUTH
  // ==========================================================

  const [loading, setLoading] =
    useState(true);


  useEffect(() => {
    const adminData =
      localStorage.getItem('adminUser');

    const adminToken =
      localStorage.getItem('adminToken');

    if (
      !adminData ||
      !adminToken
    ) {
      router.push('/');
      return;
    }

    try {
      JSON.parse(adminData);

      setLoading(false);
    } catch {
      localStorage.removeItem(
        'adminUser'
      );

      localStorage.removeItem(
        'adminToken'
      );

      router.push('/');
    }
  }, [router]);


  // ==========================================================
  // SELECTED LANGUAGE
  // ==========================================================

  const [
    selectedLanguage,
    setSelectedLanguage,
  ] = useState('en');


  // ==========================================================
  // CONTENT DATA
  // ==========================================================

  const [
    contents,
    setContents,
  ] = useState<HomepageContent[]>(
    INITIAL_CONTENT
  );


  // ==========================================================
  // EDITOR
  // ==========================================================

  const [
    editorContent,
    setEditorContent,
  ] = useState(
    DEFAULT_CONTENT
  );


  // ==========================================================
  // DISPLAY MODE
  // ==========================================================

  const [
    displayMode,
    setDisplayMode,
  ] = useState(
    DEFAULT_DISPLAY_MODE
  );


  // ==========================================================
  // INTERNET ADDRESS
  // ==========================================================

  const [
    openInternetAddress,
    setOpenInternetAddress,
  ] = useState(false);


  const [
    internetAddress,
    setInternetAddress,
  ] = useState('');


  const [
    target,
    setTarget,
  ] = useState('New window');


  // ==========================================================
  // SAVING
  // ==========================================================

  const [
    saving,
    setSaving,
  ] = useState(false);


  // ==========================================================
  // GET SELECTED CONTENT
  // ==========================================================

  const selectedContent =
    contents.find(
      (item) =>
        item.language ===
        selectedLanguage
    );


  // ==========================================================
  // LANGUAGE CHANGE
  // ==========================================================

  const handleLanguageChange = (
    language: string
  ) => {
    /*
     * 1. Change selected language.
     * 2. Find content for that language.
     * 3. Load its editor content.
     * 4. Load its display mode.
     */

    setSelectedLanguage(
      language
    );


    const languageContent =
      contents.find(
        (item) =>
          item.language ===
          language
      );


    if (languageContent) {
      setEditorContent(
        languageContent.content
      );

      setDisplayMode(
        languageContent.displayMode
      );
    } else {
      /*
       * Language doesn't have content yet.
       */

      setEditorContent('');

      setDisplayMode(
        DEFAULT_DISPLAY_MODE
      );
    }
  };


  // ==========================================================
  // EDITOR CHANGE
  // ==========================================================

  const handleEditorChange = (
    content: string
  ) => {
    setEditorContent(
      content
    );
  };


  // ==========================================================
  // DISPLAY MODE CHANGE
  // ==========================================================

  const handleDisplayModeChange = (
    mode: string
  ) => {
    setDisplayMode(mode);
  };


  // ==========================================================
  // SAVE CURRENT LANGUAGE
  // ==========================================================

  const handleSave = async () => {
    setSaving(true);

    try {
      /*
       * Check whether this language
       * already exists.
       */

      const existingIndex =
        contents.findIndex(
          (item) =>
            item.language ===
            selectedLanguage
        );


      /*
       * Existing language:
       * update it.
       */

      if (
        existingIndex >= 0
      ) {
        setContents(
          (previous) =>
            previous.map(
              (item, index) =>
                index ===
                existingIndex
                  ? {
                      ...item,

                      content:
                        editorContent,

                      displayMode:
                        displayMode,
                    }
                  : item
            )
        );
      }

      /*
       * New language:
       * create it.
       */

      else {
        const newItem: HomepageContent = {
          id: Date.now(),

          language:
            selectedLanguage,

          content:
            editorContent,

          displayMode:
            displayMode,
        };


        setContents(
          (previous) => [
            ...previous,
            newItem,
          ]
        );
      }


      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            300
          )
      );


      alert(
        `Saved ${selectedLanguage} content successfully`
      );
    } catch (error) {
      console.error(error);

      alert(
        'Unable to save'
      );
    } finally {
      setSaving(false);
    }
  };


  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDelete = (
    id: number
  ) => {
    const item =
      contents.find(
        (content) =>
          content.id === id
      );


    if (!item) {
      return;
    }


    const confirmed =
      window.confirm(
        `Are you sure you want to delete the ${item.language} content?`
      );


    if (!confirmed) {
      return;
    }


    setContents(
      (previous) =>
        previous.filter(
          (content) =>
            content.id !== id
        )
    );


    /*
     * If the deleted item is the
     * currently selected language,
     * reset the editor.
     */

    if (
      item.language ===
      selectedLanguage
    ) {
      setEditorContent('');

      setDisplayMode(
        DEFAULT_DISPLAY_MODE
      );
    }
  };


  // ==========================================================
  // PREVIEW
  // ==========================================================

  const handlePreview = (
    item: HomepageContent
  ) => {
    const previewWindow =
      window.open(
        '',
        '_blank',
        'width=1000,height=700'
      );


    if (!previewWindow) {
      return;
    }


    previewWindow.document.write(`
      <!DOCTYPE html>

      <html>

        <head>

          <title>
            ${item.language} Preview
          </title>

          <style>

            body {
              font-family:
                Arial,
                sans-serif;

              padding: 30px;

              line-height: 1.6;
            }

            img {
              max-width: 100%;
            }

            a {
              color: #0066cc;
            }

          </style>

        </head>

        <body>

          ${item.content}

        </body>

      </html>
    `);


    previewWindow.document.close();
  };


  // ==========================================================
  // CANCEL
  // ==========================================================

  const handleCancel = () => {
    router.back();
  };


  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return null;
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="px-[10px]">

      {/* ====================================================
          PAGE TITLE
      ==================================================== */}

      <h1
        className="
          border-b
          border-[#888]
          pb-2
          pt-3
          text-[24px]
          font-normal
        "
      >
        Languages
      </h1>


      {/* ====================================================
          LANGUAGES
      ==================================================== */}

      <div className="pt-2">

        <LanguageTabs
          selectedLanguage={
            selectedLanguage
          }
          onChange={
            handleLanguageChange
          }
        />

      </div>


      {/* ====================================================
          OPTIONS
      ==================================================== */}

      <div
        className="
          border-b
          border-[#999]
          py-4
        "
      >

        {/* FIRST ROW */}

        <div
          className="
            grid
            grid-cols-[280px_1fr]
            items-center
          "
        >

          {/* CONTENT TO DISPLAY */}

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <span className="text-[16px]">
              Content to display
            </span>

            <ToggleSwitch
              enabled={
                !openInternetAddress
              }
              onChange={(value) =>
                setOpenInternetAddress(
                  !value
                )
              }
            />

          </div>


          {/* INTERNET ADDRESS */}

          <div className="text-[16px]">
            Open the internet address
          </div>

        </div>


        {/* SECOND ROW */}

        <div
          className="
            mt-3
            grid
            grid-cols-[450px_1fr_360px]
            items-center
            gap-5
          "
        >

          {/* CONTENT OPTION */}

          <div
            className={`
              text-[16px]
              ${
                openInternetAddress
                  ? 'text-[#222]'
                  : 'text-[#b7b7b7]'
              }
            `}
          >
            Open this page for the
            language selected
          </div>


          {/* URL */}

          <input
            type="text"
            disabled={
              !openInternetAddress
            }
            value={
              internetAddress
            }
            onChange={(event) =>
              setInternetAddress(
                event.target.value
              )
            }
            className="
              h-[30px]
              w-full
              border
              border-[#ddd]
              px-2
              text-[14px]
              outline-none
              focus:border-[#aaa]
              disabled:bg-white
            "
          />


          {/* TARGET */}

          <select
            disabled={
              !openInternetAddress
            }
            value={target}
            onChange={(event) =>
              setTarget(
                event.target.value
              )
            }
            className="
              h-[30px]
              w-full
              border
              border-[#ddd]
              bg-white
              px-2
              text-[14px]
              text-[#777]
              disabled:text-[#bbb]
            "
          >

            <option>
              New window
            </option>

            <option>
              Same window
            </option>

            <option>
              Popup
            </option>

          </select>

        </div>

      </div>


      {/* ====================================================
          EXISTING CONTENT
      ==================================================== */}

      <div className="mt-1">
        {contents.map((item) => (
          <ContentRow
            key={item.id}
            item={item}
            selectedLanguage={selectedLanguage}
            displayMode={displayMode}
            onSelect={handleLanguageChange}
            onPreview={handlePreview}
            onDelete={handleDelete}
            onDisplayModeChange={
              handleDisplayModeChange
            }
          />
        ))}
      </div>


      {/* ====================================================
          EDITOR
      ==================================================== */}

      <div className="mt-3">

        <HomepageContentEditor
          key={selectedLanguage}
          language={
            selectedLanguage
          }
          content={
            editorContent
          }
          onChange={
            handleEditorChange
          }
        />

      </div>


      {/* ====================================================
          SAVE / CANCEL
      ==================================================== */}

      <div
        className="
          flex
          justify-center
          gap-3
          py-5
        "
      >

        <button
          type="button"
          onClick={
            handleSave
          }
          disabled={saving}
          className="
            bg-[#555]
            px-2
            py-1
            text-[15px]
            font-bold
            text-white
            shadow-sm
            hover:bg-[#444]
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {saving
            ? 'Saving...'
            : 'Save'}
        </button>


        <button
          type="button"
          onClick={
            handleCancel
          }
          className="
            bg-[#c00000]
            px-2
            py-1
            text-[15px]
            font-bold
            text-white
            shadow-sm
            hover:bg-[#a00000]
          "
        >
          Cancel
        </button>

      </div>


      {/* ====================================================
          CKEDITOR CSS
      ==================================================== */}

      <style jsx global>{`

        .ckeditor-wrapper {
          width: 100%;
        }

        .ckeditor-wrapper
        .ck-editor {
          width: 100%;
        }

        .ckeditor-wrapper
        .ck-toolbar {
          border-radius: 0 !important;
          background: #f7f7f7 !important;
          border-color: #ccc !important;
        }

        .ckeditor-wrapper
        .ck-editor__main {
          height: 325px;
        }

        .ckeditor-wrapper
        .ck-editor__editable {
          min-height: 325px;
          max-height: 325px;
          overflow-y: auto;
          border-radius: 0 !important;
        }

        .ckeditor-wrapper
        .ck-content {
          font-family:
            Arial,
            Helvetica,
            sans-serif;

          font-size: 14px;

          line-height: 1.45;
        }

        .ckeditor-wrapper
        .ck-content h1 {
          font-size: 28px;
        }

        .ckeditor-wrapper
        .ck-content h2 {
          font-size: 24px;
        }

        .ckeditor-wrapper
        .ck-content h3 {
          font-size: 20px;
        }

        .ckeditor-wrapper
        .ck-content p {
          margin: 0 0 12px;
        }

        .ckeditor-wrapper
        .ck-content a {
          color: #0066cc;
        }

        @media (max-width: 1000px) {

          .ckeditor-wrapper
          .ck-toolbar {
            overflow-x: auto;
          }

        }

      `}</style>

    </main>
  );
}