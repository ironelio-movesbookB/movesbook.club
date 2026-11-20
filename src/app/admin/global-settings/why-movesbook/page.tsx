'use client';

import React, {
  Suspense,
  useEffect,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import dynamic from 'next/dynamic';

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

import {
  Pencil,
  X,
  Plus,
} from 'lucide-react';

// ---------------------------------------------------------
// CKEDITOR
// ---------------------------------------------------------

const CKEditor = dynamic(
  () =>
    import('@ckeditor/ckeditor5-react').then(
      (module) => module.CKEditor
    ),
  {
    ssr: false,
  }
);

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

interface DocumentationSection {
  id: string;
  title: string;
  content: string;
}


// ---------------------------------------------------------
// INITIAL DATA
// ---------------------------------------------------------

const INITIAL_SECTIONS: DocumentationSection[] = [
  {
    id: 'section-doc-en-1',
    title: 'Doc EN 1',
    content: '',
  },
  {
    id: 'section-doc-en-2',
    title: 'Doc EN 2',
    content: '',
  },
];


// ---------------------------------------------------------
// SORTABLE SECTION
// ---------------------------------------------------------

interface SortableSectionProps {
  section: DocumentationSection;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableSection({
  section,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: SortableSectionProps) {
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
      className={`
        group
        flex
        h-[39px]
        items-center
        border-b
        border-[#c8c8c8]
        px-[10px]
        text-[16px]
        cursor-move
        select-none
        ${
          selected
            ? 'bg-[#d4f1f9]'
            : 'bg-[#eeeeee] hover:bg-[#e3e3e3]'
        }
      `}
      onClick={onSelect}
    >
      {/* TITLE */}

      <div className="flex-1 truncate">
        {section.title}
      </div>


      {/* ACTIONS */}

      <div
        className="
          flex
          items-center
          gap-[13px]
          pl-2
        "
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >

        {/* EDIT */}

        <button
          type="button"
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
            hover:bg-[#333]
          "
          title="Edit section"
        >
          <Pencil
            size={11}
            strokeWidth={3}
          />
        </button>


        {/* DELETE */}

        <button
          type="button"
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
            hover:bg-[#333]
          "
          title="Delete section"
        >
          <X
            size={12}
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
      <div className="min-h-[325px] p-3 text-sm text-gray-500">
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
  );
}


// ---------------------------------------------------------
// MAIN CONTENT
// ---------------------------------------------------------

function FrameSettingsPageContent() {
  const router = useRouter();

  // -------------------------------------------------------
  // AUTH
  // -------------------------------------------------------

  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const adminData =
      localStorage.getItem('adminUser');

    const adminToken =
      localStorage.getItem('adminToken');

    if (!adminData || !adminToken) {
      router.push('/');
      return;
    }

    try {
      JSON.parse(adminData);
      setLoading(false);
    } catch {
      localStorage.removeItem('adminUser');
      localStorage.removeItem('adminToken');

      router.push('/');
    }
  }, [router]);


  // -------------------------------------------------------
  // STATE
  // -------------------------------------------------------

  const [sections, setSections] =
    useState<DocumentationSection[]>(
      INITIAL_SECTIONS
    );


  const [selectedSectionId, setSelectedSectionId] =
    useState<string>(
      INITIAL_SECTIONS[0].id
    );


  const [editorContent, setEditorContent] =
    useState<string>(
      INITIAL_SECTIONS[0].content
    );


  const [saving, setSaving] =
    useState(false);


  // -------------------------------------------------------
  // DND
  // -------------------------------------------------------

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );


  // -------------------------------------------------------
  // SELECT SECTION
  // -------------------------------------------------------

  const selectSection = (
    section: DocumentationSection
  ) => {
    setSelectedSectionId(section.id);
    setEditorContent(section.content);
  };


  // -------------------------------------------------------
  // DRAG END
  // -------------------------------------------------------

  const handleDragEnd = (
    event: DragEndEvent
  ) => {
    const {
      active,
      over,
    } = event;

    if (
      !over ||
      active.id === over.id
    ) {
      return;
    }

    setSections((current) => {
      const oldIndex =
        current.findIndex(
          (item) =>
            item.id === active.id
        );

      const newIndex =
        current.findIndex(
          (item) =>
            item.id === over.id
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
    });
  };


  // -------------------------------------------------------
  // ADD SECTION
  // -------------------------------------------------------

  const handleAddSection = () => {
    const title =
      window.prompt(
        'Enter section name:'
      );

    if (!title?.trim()) {
      return;
    }

    const newSection: DocumentationSection = {
      id:
        `section-${Date.now()}`,
      title: title.trim(),
      content: '',
    };

    setSections((current) => [
      ...current,
      newSection,
    ]);

    setSelectedSectionId(
      newSection.id
    );

    setEditorContent('');
  };


  // -------------------------------------------------------
  // EDIT SECTION
  // -------------------------------------------------------

  const handleEditSection = (
    section: DocumentationSection
  ) => {
    const newTitle =
      window.prompt(
        'Edit section name:',
        section.title
      );

    if (!newTitle?.trim()) {
      return;
    }

    setSections((current) =>
      current.map((item) =>
        item.id === section.id
          ? {
              ...item,
              title:
                newTitle.trim(),
            }
          : item
      )
    );
  };


  // -------------------------------------------------------
  // DELETE SECTION
  // -------------------------------------------------------

  const handleDeleteSection = (
    section: DocumentationSection
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${section.title}"?`
      );

    if (!confirmed) {
      return;
    }

    setSections((current) => {
      const filtered =
        current.filter(
          (item) =>
            item.id !== section.id
        );

      // If deleting selected section
      if (
        section.id ===
        selectedSectionId
      ) {
        if (filtered.length > 0) {
          setSelectedSectionId(
            filtered[0].id
          );

          setEditorContent(
            filtered[0].content
          );
        } else {
          setSelectedSectionId('');
          setEditorContent('');
        }
      }

      return filtered;
    });
  };


  // -------------------------------------------------------
  // SAVE
  // -------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);

    try {
      setSections((current) =>
        current.map((section) =>
          section.id ===
          selectedSectionId
            ? {
                ...section,
                content:
                  editorContent,
              }
            : section
        )
      );


      /*
       * Connect your API here.
       *
       * Example:
       *
       * await fetch(
       *   '/api/admin/frame-settings',
       *   {
       *     method: 'POST',
       *     headers: {
       *       'Content-Type':
       *         'application/json',
       *     },
       *     body: JSON.stringify({
       *       sections,
       *       selectedSectionId,
       *       editorContent,
       *     }),
       *   }
       * );
       */


      await new Promise(
        (resolve) =>
          setTimeout(resolve, 300)
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


  // -------------------------------------------------------
  // CANCEL
  // -------------------------------------------------------

  const handleCancel = () => {
    router.back();
  };


  // -------------------------------------------------------
  // LOADING
  // -------------------------------------------------------

  if (loading) {
    return null;
  }


  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------

  return (
    <div className="min-h-screen bg-white">

      {/* ==================================================
          TOP TABS
      ================================================== */}

      <div
        className="
          mx-[18px]
          border-b
          border-[#333]
        "
      >

        <div
          className="
            flex
            items-end
            gap-[5px]
            pt-[19px]
          "
        >

          {/* DOCUMENTATION */}

          <button
            type="button"
            className="
              h-[37px]
              rounded-t-[7px]
              bg-gradient-to-b
              from-[#444]
              to-[#222]
              px-[12px]
              text-[14px]
              font-bold
              text-white
              shadow-sm
            "
          >
            Documentation
          </button>


          {/* FEATURES */}

          <button
            type="button"
            className="
              h-[37px]
              rounded-t-[7px]
              bg-gradient-to-b
              from-[#ddd]
              to-[#aaa]
              px-[12px]
              text-[14px]
              font-bold
              text-[#333]
              shadow-sm
              hover:from-[#e5e5e5]
            "
          >
            Features
          </button>


          {/* SCREENSHOTS */}

          <button
            type="button"
            className="
              h-[37px]
              rounded-t-[7px]
              bg-gradient-to-b
              from-[#ddd]
              to-[#aaa]
              px-[12px]
              text-[14px]
              font-bold
              text-[#333]
              shadow-sm
            "
          >
            Screenshots
          </button>


          {/* PRESS AREA */}

          <button
            type="button"
            className="
              h-[37px]
              rounded-t-[7px]
              bg-gradient-to-b
              from-[#ddd]
              to-[#aaa]
              px-[12px]
              text-[14px]
              font-bold
              text-[#333]
              shadow-sm
            "
          >
            Press area
          </button>


          {/* VERSION HISTORY */}

          <button
            type="button"
            className="
              h-[37px]
              rounded-t-[7px]
              bg-gradient-to-b
              from-[#ddd]
              to-[#aaa]
              px-[12px]
              text-[14px]
              font-bold
              text-[#333]
              shadow-sm
            "
          >
            Version history
          </button>

        </div>

      </div>


      {/* ==================================================
          MAIN BOX
      ================================================== */}

      <div
        className="
          mx-[18px]
          mt-[20px]
          border
          border-[#aaa]
          p-[15px]
        "
      >

        <div
          className="
            grid
            grid-cols-[450px_minmax(0,1fr)]
            gap-[43px]
          "
        >

          {/* ==================================================
              LEFT COLUMN
          ================================================== */}

          <div>

            {/* ADD SECTION */}

            <div
              className="
                mb-[20px]
                flex
                justify-center
              "
            >

              <button
                type="button"
                onClick={
                  handleAddSection
                }
                className="
                  inline-flex
                  items-center
                  gap-1
                  rounded-[4px]
                  bg-gradient-to-b
                  from-[#666]
                  to-[#333]
                  px-[13px]
                  py-[7px]
                  text-[14px]
                  font-bold
                  text-white
                  shadow-sm
                  hover:from-[#777]
                  hover:to-[#444]
                "
              >
                <Plus
                  size={14}
                  strokeWidth={3}
                />

                Add a section
              </button>

            </div>


            {/* SECTION HEADER */}

            <div
              className="
                flex
                h-[35px]
                items-center
                justify-center
                border
                border-[#aaa]
                bg-[#eee8b1]
                text-[16px]
                text-[#333]
              "
            >
              Sections of movesbook
            </div>


            {/* SECTION LIST */}

            <div
              className="
                mt-[20px]
                min-h-[300px]
                border
                border-[#aaa]
                bg-[#eee]
              "
            >

              <DndContext
                sensors={sensors}
                collisionDetection={
                  closestCenter
                }
                onDragEnd={
                  handleDragEnd
                }
              >

                <SortableContext
                  items={sections.map(
                    (section) =>
                      section.id
                  )}
                  strategy={
                    verticalListSortingStrategy
                  }
                >

                  {sections.map(
                    (section) => (
                      <SortableSection
                        key={
                          section.id
                        }
                        section={
                          section
                        }
                        selected={
                          selectedSectionId ===
                          section.id
                        }
                        onSelect={() =>
                          selectSection(
                            section
                          )
                        }
                        onEdit={() =>
                          handleEditSection(
                            section
                          )
                        }
                        onDelete={() =>
                          handleDeleteSection(
                            section
                          )
                        }
                      />
                    )
                  )}

                </SortableContext>

              </DndContext>

            </div>

          </div>


          {/* ==================================================
              RIGHT COLUMN
          ================================================== */}

          <div className="min-w-0">

            {/* CKEDITOR */}

            <div
              className="
                overflow-hidden
                border
                border-[#ccc]
              "
            >

              <DocumentationEditor
                content={editorContent}
                onChange={setEditorContent}
              />

            </div>

            {/* ==================================================
                SAVE / CANCEL
            ================================================== */}

            <div
              className="
                flex
                justify-center
                gap-[5px]
                pt-[20px]
              "
            >

              <button
                type="button"
                onClick={
                  handleSave
                }
                disabled={
                  saving
                }
                className="
                  min-w-[80px]
                  rounded-[4px]
                  border
                  border-[#a40000]
                  bg-gradient-to-b
                  from-[#ff5c5c]
                  to-[#d50000]
                  px-[18px]
                  py-[7px]
                  text-[14px]
                  font-bold
                  text-white
                  shadow-sm
                  hover:from-[#ff7070]
                  hover:to-[#c00000]
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
                  min-w-[80px]
                  rounded-[4px]
                  border
                  border-[#222]
                  bg-gradient-to-b
                  from-[#666]
                  to-[#333]
                  px-[18px]
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

        </div>

      </div>


      {/* ==================================================
          RESPONSIVE
      ================================================== */}

      <style jsx global>{`

        .ck-editor {
          width: 100%;
        }

        .ck-toolbar {
          border-radius: 0 !important;
          border-color: #ccc !important;
        }

        .ck-editor__main {
          min-height: 325px;
        }

        .ck-editor__editable {
          min-height: 325px;
          max-height: 325px;
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

        @media (max-width: 1000px) {

          .grid {
            grid-template-columns:
              1fr !important;
          }

        }

      `}</style>

    </div>
  );
}


// ---------------------------------------------------------
// EXPORT
// ---------------------------------------------------------

export default function FrameSettingsPage() {
  return (
    <Suspense
      fallback={null}
    >
      <FrameSettingsPageContent />
    </Suspense>
  );
}