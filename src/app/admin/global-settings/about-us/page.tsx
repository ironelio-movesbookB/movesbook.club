'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import {
  Pencil,
  X,
  Plus,
} from 'lucide-react';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

// ============================================================
// CKEDITOR
// ============================================================

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

interface LanguageContent {
  [language: string]: string;
}

interface DocumentationTab {
  id: string;
  title: string;
  contents: LanguageContent;
}

interface Section {
  id: string;
  title: string;
}


// ============================================================
// LANGUAGES
// ============================================================

const LANGUAGES = [
  'en',
  'fr',
  'de',
  'it',
  'es',
  'por',
  'rus',
  'ind',
  'chin',
  'arab',
];


// ============================================================
// TABS
// ============================================================

const INITIAL_TABS: DocumentationTab[] = [
  {
    id: 'origins',
    title: 'The origins',
    contents: {
      en: `
        <h2>ENG</h2>

        <div style="text-align:center; margin-top:20px;">
          <h1>🏃 SportTracks</h1>
        </div>

        <p>
          Welcome to The origins section.
        </p>

        <p>
          This is the English content for The origins.
        </p>
      `,

      fr: `
        <h2>FRA</h2>

        <p>
          Bienvenue dans la section The origins.
        </p>
      `,

      de: `
        <h2>DEU</h2>

        <p>
          Willkommen im Bereich The origins.
        </p>
      `,

      it: `
        <h2>ITA</h2>

        <p>
          Benvenuto nella sezione The origins.
        </p>
      `,

      es: `
        <h2>ESP</h2>

        <p>
          Bienvenido a la sección The origins.
        </p>
      `,

      por: `
        <h2>POR</h2>

        <p>
          Bem-vindo à seção The origins.
        </p>
      `,

      rus: `
        <h2>RUS</h2>

        <p>
          Добро пожаловать в раздел The origins.
        </p>
      `,

      ind: `
        <h2>IND</h2>

        <p>
          Selamat datang di bagian The origins.
        </p>
      `,

      chin: `
        <h2>CHIN</h2>

        <p>
          欢迎来到 The origins 部分。
        </p>
      `,

      arab: `
        <h2>ARAB</h2>

        <p>
          مرحبًا بك في قسم The origins.
        </p>
      `,
    },
  },

  {
    id: 'projects',
    title: 'The Projects',
    contents: {
      en: `
        <h2>The Projects</h2>

        <p>
          This is the English content for The Projects.
        </p>

        <p>
          Here you can describe your projects,
          services and activities.
        </p>
      `,

      fr: `
        <h2>Les projets</h2>

        <p>
          Contenu français des projets.
        </p>
      `,

      de: `
        <h2>Die Projekte</h2>

        <p>
          Deutscher Inhalt der Projekte.
        </p>
      `,

      it: `
        <h2>I progetti</h2>

        <p>
          Contenuto italiano dei progetti.
        </p>
      `,

      es: `
        <h2>Los proyectos</h2>

        <p>
          Contenido español de los proyectos.
        </p>
      `,
    },
  },

  {
    id: 'staff',
    title: 'Our Staff',
    contents: {
      en: `
        <h2>Our Staff</h2>

        <p>
          Meet our staff and professional team.
        </p>

        <p>
          Our team works together to provide
          the best possible service.
        </p>
      `,

      fr: `
        <h2>Notre équipe</h2>

        <p>
          Découvrez notre équipe.
        </p>
      `,

      de: `
        <h2>Unser Team</h2>

        <p>
          Lernen Sie unser Team kennen.
        </p>
      `,

      it: `
        <h2>Il nostro staff</h2>

        <p>
          Scopri il nostro staff.
        </p>
      `,

      es: `
        <h2>Nuestro equipo</h2>

        <p>
          Conozca a nuestro equipo.
        </p>
      `,
    },
  },

  {
    id: 'values',
    title: 'Our Values',
    contents: {
      en: `
        <h2>Our Values</h2>

        <p>
          Our values define who we are and
          how we work.
        </p>

        <ul>
          <li>Professionalism</li>
          <li>Innovation</li>
          <li>Teamwork</li>
          <li>Quality</li>
        </ul>
      `,

      fr: `
        <h2>Nos valeurs</h2>

        <p>
          Nos valeurs définissent notre travail.
        </p>
      `,

      de: `
        <h2>Unsere Werte</h2>

        <p>
          Unsere Werte bestimmen unsere Arbeit.
        </p>
      `,

      it: `
        <h2>I nostri valori</h2>

        <p>
          I nostri valori definiscono il nostro lavoro.
        </p>
      `,

      es: `
        <h2>Nuestros valores</h2>

        <p>
          Nuestros valores definen nuestro trabajo.
        </p>
      `,
    },
  },

  {
    id: 'join',
    title: 'Join us',
    contents: {
      en: `
        <h2>Join us</h2>

        <p>
          We are always looking for talented
          and motivated people.
        </p>

        <p>
          Contact us if you would like to
          join our team.
        </p>
      `,

      fr: `
        <h2>Rejoignez-nous</h2>

        <p>
          Nous recherchons toujours des personnes
          talentueuses et motivées.
        </p>
      `,

      de: `
        <h2>Mach mit</h2>

        <p>
          Wir suchen talentierte und motivierte Menschen.
        </p>
      `,

      it: `
        <h2>Unisciti a noi</h2>

        <p>
          Cerchiamo sempre persone talentuose
          e motivate.
        </p>
      `,

      es: `
        <h2>Únete a nosotros</h2>

        <p>
          Siempre buscamos personas talentosas
          y motivadas.
        </p>
      `,
    },
  },
];


// ============================================================
// LEFT SIDE SECTIONS
// ============================================================

const INITIAL_SECTIONS: Section[] = [
  {
    id: 'section-gg',
    title: 'gg',
  },
  {
    id: 'section-doc-en-1',
    title: 'Doc EN 1',
  },
  {
    id: 'section-doc-en-2',
    title: 'Doc EN 2',
  },
];


// ============================================================
// SORTABLE SECTION
// ============================================================

function SortableSection({
  section,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  section: Section;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`
        flex
        h-[39px]
        items-center
        border-b
        border-[#c8c8c8]
        px-[10px]
        cursor-move
        select-none
        text-[16px]
        ${
          selected
            ? 'bg-[#d5f2fa]'
            : 'bg-[#eeeeee] hover:bg-[#e5e5e5]'
        }
      `}
    >

      <div className="flex-1 truncate">
        {section.title}
      </div>

      <div
        className="
          flex
          items-center
          gap-[13px]
        "
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >

        {/* EDIT */}

        <button
          type="button"
          title="Edit"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="
            flex
            h-[16px]
            w-[16px]
            items-center
            justify-center
            rounded-[2px]
            bg-black
            text-white
          "
        >
          <Pencil
            size={10}
            strokeWidth={3}
          />
        </button>


        {/* DELETE */}

        <button
          type="button"
          title="Delete"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="
            flex
            h-[16px]
            w-[16px]
            items-center
            justify-center
            rounded-full
            bg-black
            text-white
          "
        >
          <X
            size={11}
            strokeWidth={3}
          />
        </button>

      </div>

    </div>
  );
}

function DocumentationEditor({
  content,
  onChange,
}: {
  content: string;
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
        console.error(
          'Failed to load CKEditor:',
          error
        );
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!Editor) {
    return (
      <div
        className="
          min-h-[300px]
          border
          border-[#ccc]
          p-3
          text-sm
          text-gray-500
        "
      >
        Loading editor...
      </div>
    );
  }

  return (
    <CKEditor
      editor={Editor}
      data={content}
      onChange={(_event, editor) => {
        onChange(editor.getData());
      }}
      config={{
        toolbar: {
          shouldNotGroupWhenFull: true,
        },
      }}
    />
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

function PageContent() {

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
  // TAB STATE
  // ==========================================================

  const [tabs, setTabs] =
    useState<DocumentationTab[]>(
      INITIAL_TABS
    );


  const [activeTabId, setActiveTabId] =
    useState('origins');


  // ==========================================================
  // LANGUAGE STATE
  // ==========================================================

  const [activeLanguage, setActiveLanguage] =
    useState('en');


  // ==========================================================
  // EDITOR STATE
  // ==========================================================

  const [editorContent, setEditorContent] =
    useState(
      INITIAL_TABS[0].contents.en
    );


  // ==========================================================
  // LEFT SECTIONS
  // ==========================================================

  const [sections, setSections] =
    useState<Section[]>(
      INITIAL_SECTIONS
    );


  const [selectedSectionId, setSelectedSectionId] =
    useState(
      INITIAL_SECTIONS[0].id
    );


  const [saving, setSaving] =
    useState(false);


  // ==========================================================
  // DND
  // ==========================================================

  const sensors = useSensors(

    useSensor(
      PointerSensor,
      {
        activationConstraint: {
          distance: 5,
        },
      }
    )

  );


  // ==========================================================
  // FIND ACTIVE TAB
  // ==========================================================

  const activeTab =
    tabs.find(
      (tab) =>
        tab.id === activeTabId
    );


  // ==========================================================
  // CHANGE TOP TAB
  // ==========================================================

  const handleTabChange = (
    tabId: string
  ) => {

    const tab =
      tabs.find(
        (item) =>
          item.id === tabId
      );

    if (!tab) {
      return;
    }


    setActiveTabId(tabId);


    // Load selected language
    // from this tab.

    const content =
      tab.contents[
        activeLanguage
      ] ?? '';


    setEditorContent(
      content
    );

  };


  // ==========================================================
  // CHANGE LANGUAGE
  // ==========================================================

  const handleLanguageChange = (
    language: string
  ) => {

    setActiveLanguage(
      language
    );


    const content =
      activeTab?.contents[
        language
      ] ?? '';


    setEditorContent(
      content
    );

  };


  // ==========================================================
  // UPDATE EDITOR
  // ==========================================================

  const handleEditorChange = (
    content: string
  ) => {

    setEditorContent(
      content
    );

  };


  // ==========================================================
  // SAVE
  // ==========================================================

  const handleSave = async () => {

    setSaving(true);

    try {

      setTabs((currentTabs) => {

        return currentTabs.map(
          (tab) => {

            if (
              tab.id !==
              activeTabId
            ) {
              return tab;
            }


            return {
              ...tab,

              contents: {
                ...tab.contents,

                [activeLanguage]:
                  editorContent,
              },
            };

          }
        );

      });


      /*
       * API example:
       *
       * await fetch(
       *   '/api/admin/documentation',
       *   {
       *     method: 'POST',
       *     headers: {
       *       'Content-Type':
       *         'application/json',
       *     },
       *     body: JSON.stringify({
       *       tabId: activeTabId,
       *       language: activeLanguage,
       *       content: editorContent,
       *     }),
       *   }
       * );
       */


      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            300
          )
      );


      alert(
        'Saved successfully'
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
  // ADD SECTION
  // ==========================================================

  const handleAddSection = () => {

    const title =
      window.prompt(
        'Enter section name:'
      );


    if (
      !title?.trim()
    ) {
      return;
    }


    const newSection: Section = {
      id:
        `section-${Date.now()}`,

      title:
        title.trim(),
    };


    setSections(
      (current) => [
        ...current,
        newSection,
      ]
    );


    setSelectedSectionId(
      newSection.id
    );

  };


  // ==========================================================
  // EDIT SECTION
  // ==========================================================

  const handleEditSection = (
    section: Section
  ) => {

    const title =
      window.prompt(
        'Edit section name:',
        section.title
      );


    if (
      !title?.trim()
    ) {
      return;
    }


    setSections(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            section.id
              ? {
                  ...item,
                  title:
                    title.trim(),
                }
              : item
        )
    );

  };


  // ==========================================================
  // DELETE SECTION
  // ==========================================================

  const handleDeleteSection = (
    section: Section
  ) => {
    const confirmed = window.confirm(
      `Delete "${section.title}"?`
    );

    if (!confirmed) {
      return;
    }

    setSections((current) => {
      const remaining = current.filter(
        (item) => item.id !== section.id
      );

      if (selectedSectionId === section.id) {
        if (remaining.length > 0) {
          setSelectedSectionId(
            remaining[0].id
          );
        } else {
          setSelectedSectionId('');
        }
      }

      return remaining;
    });
  };


  // ==========================================================
  // DRAG END
  // ==========================================================

  const handleDragEnd = (
    event: DragEndEvent
  ) => {

    const {
      active,
      over,
    } = event;


    if (
      !over ||
      active.id ===
        over.id
    ) {
      return;
    }


    setSections(
      (current) => {

        const oldIndex =
          current.findIndex(
            (item) =>
              item.id ===
              active.id
          );


        const newIndex =
          current.findIndex(
            (item) =>
              item.id ===
              over.id
          );


        if (
          oldIndex === -1 ||
          newIndex === -1
        ) {
          return current;
        }


        return arrayMove(
          current,
          oldIndex,
          newIndex
        );

      }
    );

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

    <div
      className="
        min-h-screen
        bg-white
        px-[10px]
        text-black
      "
    >

      {/* ====================================================
          TOP NAVIGATION
      ==================================================== */}

      <div
        className="
          flex
          justify-center
          border-b
          border-[#333]
          pt-[3px]
        "
      >

        {tabs.map(
          (tab) => {

            const active =
              tab.id ===
              activeTabId;


            return (

              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  handleTabChange(
                    tab.id
                  )
                }
                className={`
                  mx-[2px]
                  h-[37px]
                  rounded-t-[7px]
                  px-[12px]
                  text-[14px]
                  font-bold
                  transition-colors

                  ${
                    active
                      ? `
                        bg-gradient-to-b
                        from-[#444]
                        to-[#222]
                        text-white
                      `
                      : `
                        bg-gradient-to-b
                        from-[#ddd]
                        to-[#aaa]
                        text-[#333]
                        hover:from-[#e5e5e5]
                        hover:to-[#bbb]
                      `
                  }
                `}
              >
                {tab.title}
              </button>

            );

          }
        )}

      </div>


      {/* ====================================================
          MAIN BOX
      ==================================================== */}

      <div
        className="
          mt-[15px]
          border
          border-[#aaa]
          p-[10px]
        "
      >

        {/* ==================================================
            LANGUAGES
        ================================================== */}

        <div
          className="
            flex
            flex-wrap
            items-center
            border-b
            border-[#777]
            pb-[13px]
          "
        >

          {LANGUAGES.map(
            (language) => {

              const active =
                language ===
                activeLanguage;


              return (

                <button
                  key={language}
                  type="button"
                  onClick={() =>
                    handleLanguageChange(
                      language
                    )
                  }
                  className={`
                    mr-[2px]
                    px-[12px]
                    py-[4px]
                    text-[18px]
                    ${
                      active
                        ? `
                          border
                          border-red-500
                          bg-[#fffde8]
                        `
                        : `
                          border
                          border-transparent
                          hover:bg-gray-100
                        `
                    }
                  `}
                >
                  {language}
                </button>

              );

            }
          )}

        </div>

        <div className="mt-[20px]">

          <DocumentationEditor
            content={editorContent}
            onChange={handleEditorChange}
          />

        </div>

        {/* ==================================================
            SAVE / CANCEL
        ================================================== */}

        <div
          className="
            flex
            justify-center
            gap-[15px]
            py-[20px]
          "
        >

          <button
            type="button"
            disabled={
              saving
            }
            onClick={
              handleSave
            }
            className="
              rounded-[4px]
              border
              border-[#a00000]
              bg-gradient-to-b
              from-[#ff5c5c]
              to-[#d00000]
              px-[17px]
              py-[7px]
              text-[14px]
              font-bold
              text-white
              shadow-sm
              hover:from-[#ff7070]
              hover:to-[#b00000]
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
              rounded-[4px]
              border
              border-[#222]
              bg-gradient-to-b
              from-[#666]
              to-[#333]
              px-[17px]
              py-[7px]
              text-[14px]
              font-bold
              text-white
              shadow-sm
              hover:from-[#777]
              hover:to-[#444]
            "
          >
            Cancel
          </button>

        </div>

      </div>


      {/* ====================================================
          CKEDITOR STYLE
      ==================================================== */}

      <style jsx global>{`

        .ck-editor {
          width: 100%;
        }

        .ck-toolbar {
          border-radius: 0 !important;
          border-color: #ccc !important;
        }

        .ck-editor__editable {
          min-height: 300px;
          max-height: 300px;
          overflow-y: auto;
          border-radius: 0 !important;
        }

        .ck-content {
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          font-size: 14px;
        }

        .ck-content h1 {
          font-size: 28px;
        }

        .ck-content h2 {
          font-size: 24px;
        }

        .ck-content h3 {
          font-size: 20px;
        }

        .ck-content p {
          margin-bottom: 12px;
        }

        @media (max-width: 800px) {

          .ck-toolbar {
            overflow-x: auto;
          }

        }

      `}</style>

    </div>

  );
}


// ============================================================
// EXPORT
// ============================================================

export default function Page() {

  return (

    <Suspense
      fallback={null}
    >
      <PageContent />
    </Suspense>

  );

}