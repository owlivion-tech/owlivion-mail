// ============================================================================
// Owlivion Mail - Rich Text Editor Component (TipTap)
// ============================================================================

import { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'dompurify';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  onPaste: (files: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export function RichTextEditor({
  content,
  onChange,
  onPaste,
  placeholder = 'E-posta içeriği...',
  disabled = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Underline,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // SECURITY: Sanitize HTML before passing to parent
      const sanitized = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'p',
          'br',
          'b',
          'i',
          'u',
          'strong',
          'em',
          'a',
          'ul',
          'ol',
          'li',
          'h1',
          'h2',
          'h3',
          'blockquote',
          'pre',
          'code',
          'span',
          'div',
          'img',
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class'],
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
      });
      onChange(sanitized);
    },
    editorProps: {
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        const imageFiles: File[] = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];

          // Check if it's an image
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();

            if (file) {
              // Validate file type
              if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                console.warn('Unsupported image type:', file.type);
                continue;
              }

              // Validate file size
              if (file.size > MAX_IMAGE_SIZE) {
                console.warn('Image too large:', file.size);
                continue;
              }

              imageFiles.push(file);
            }
          }
        }

        if (imageFiles.length > 0) {
          // Process images
          imageFiles.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = e.target?.result as string;
              if (base64 && editor) {
                editor.chain().focus().setImage({ src: base64 }).run();
              }
            };
            reader.readAsDataURL(file);
          });

          // Also add to attachments
          onPaste(imageFiles);

          return true; // Prevent default paste
        }

        return false; // Let TipTap handle text paste
      },
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[300px] max-w-none text-owl-text',
      },
    },
  }, [content, disabled, placeholder, onChange, onPaste]);

  // Toolbar button helpers
  const toggleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const toggleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const toggleUnderline = useCallback(() => {
    editor?.chain().focus().toggleUnderline().run();
  }, [editor]);

  const toggleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run();
  }, [editor]);

  const toggleOrderedList = useCallback(() => {
    editor?.chain().focus().toggleOrderedList().run();
  }, [editor]);

  const toggleBlockquote = useCallback(() => {
    editor?.chain().focus().toggleBlockquote().run();
  }, [editor]);

  const setHeading = useCallback(
    (level: 1 | 2 | 3) => {
      editor?.chain().focus().toggleHeading({ level }).run();
    },
    [editor]
  );

  const setParagraph = useCallback(() => {
    editor?.chain().focus().setParagraph().run();
  }, [editor]);

  const setLink = useCallback(() => {
    const previousUrl = editor?.getAttributes('link').href;
    const url = window.prompt('URL:', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="rich-text-editor">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-owl-border bg-owl-surface-2/30">
        {/* Heading Dropdown */}
        <select
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'p') setParagraph();
            else if (value === 'h1') setHeading(1);
            else if (value === 'h2') setHeading(2);
            else if (value === 'h3') setHeading(3);
          }}
          className="px-2 py-1 text-xs bg-owl-surface border border-owl-border rounded text-owl-text hover:bg-owl-surface-2"
          title="Başlık"
        >
          <option value="p">Paragraf</option>
          <option value="h1">Başlık 1</option>
          <option value="h2">Başlık 2</option>
          <option value="h3">Başlık 3</option>
        </select>

        <div className="w-px h-6 bg-owl-border mx-1" />

        {/* Bold */}
        <button
          onClick={toggleBold}
          className={`p-1.5 rounded hover:bg-owl-surface-2 ${
            editor.isActive('bold') ? 'bg-owl-accent/20 text-owl-accent' : 'text-owl-text-secondary'
          }`}
          title="Kalın (Ctrl+B)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
          </svg>
        </button>

        {/* Italic */}
        <button
          onClick={toggleItalic}
          className={`p-1.5 rounded hover:bg-owl-surface-2 ${
            editor.isActive('italic') ? 'bg-owl-accent/20 text-owl-accent' : 'text-owl-text-secondary'
          }`}
          title="İtalik (Ctrl+I)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 4h4M14 20h-4M15 4L9 20" />
          </svg>
        </button>

        {/* Underline */}
        <button
          onClick={toggleUnderline}
          className={`p-1.5 rounded hover:bg-owl-surface-2 ${
            editor.isActive('underline') ? 'bg-owl-accent/20 text-owl-accent' : 'text-owl-text-secondary'
          }`}
          title="Altı Çizili (Ctrl+U)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 5v8a5 5 0 0010 0V5M5 19h14" />
          </svg>
        </button>

        <div className="w-px h-6 bg-owl-border mx-1" />

        {/* Bullet List */}
        <button
          onClick={toggleBulletList}
          className={`p-1.5 rounded hover:bg-owl-surface-2 ${
            editor.isActive('bulletList') ? 'bg-owl-accent/20 text-owl-accent' : 'text-owl-text-secondary'
          }`}
          title="Madde İşaretli Liste"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01" />
          </svg>
        </button>

        {/* Ordered List */}
        <button
          onClick={toggleOrderedList}
          className={`p-1.5 rounded hover:bg-owl-surface-2 ${
            editor.isActive('orderedList') ? 'bg-owl-accent/20 text-owl-accent' : 'text-owl-text-secondary'
          }`}
          title="Numaralı Liste"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01" />
          </svg>
        </button>

        {/* Blockquote */}
        <button
          onClick={toggleBlockquote}
          className={`p-1.5 rounded hover:bg-owl-surface-2 ${
            editor.isActive('blockquote') ? 'bg-owl-accent/20 text-owl-accent' : 'text-owl-text-secondary'
          }`}
          title="Alıntı"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-owl-border mx-1" />

        {/* Link */}
        <button
          onClick={setLink}
          className={`p-1.5 rounded hover:bg-owl-surface-2 ${
            editor.isActive('link') ? 'bg-owl-accent/20 text-owl-accent' : 'text-owl-text-secondary'
          }`}
          title="Link Ekle"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>
      </div>

      {/* Editor Content */}
      <div className="p-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default RichTextEditor;
