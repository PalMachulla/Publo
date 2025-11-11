'use client'

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import { useEffect, forwardRef, useImperativeHandle } from 'react'
import { getDefaultExtensions, editorProseClasses } from '@/lib/editorConfig'

export interface ProseMirrorEditorProps {
  content: string
  onChange?: (content: string, editor: Editor) => void
  onUpdate?: (editor: Editor) => void
  onEditorReady?: (editor: Editor | null) => void
  editable?: boolean
  placeholder?: string
  autofocus?: boolean
  className?: string
}

export interface ProseMirrorEditorRef {
  getEditor: () => Editor | null
  getHTML: () => string
  getText: () => string
  getWordCount: () => number
  focus: () => void
  scrollToSection: (sectionId: string) => void
}

const ProseMirrorEditor = forwardRef<ProseMirrorEditorRef, ProseMirrorEditorProps>(
  (
    {
      content,
      onChange,
      onUpdate,
      onEditorReady,
      editable = true,
      placeholder = 'Start writing...',
      autofocus = false,
      className = '',
    },
    ref
  ) => {
    const editor = useEditor({
      extensions: getDefaultExtensions(placeholder),
      content,
      editable,
      autofocus,
      immediatelyRender: false, // Disable immediate render for SSR compatibility
      editorProps: {
        attributes: {
          class: editorProseClasses,
        },
      },
      onUpdate: ({ editor }) => {
        if (onChange) {
          onChange(editor.getHTML(), editor)
        }
        if (onUpdate) {
          onUpdate(editor)
        }
      },
    })

    // Update content when prop changes
    useEffect(() => {
      if (editor && content !== editor.getHTML()) {
        editor.commands.setContent(content)
      }
    }, [content, editor])

    // Notify parent when editor is ready
    useEffect(() => {
      if (onEditorReady) {
        onEditorReady(editor)
      }
    }, [editor, onEditorReady])

    // Update editable state
    useEffect(() => {
      if (editor) {
        editor.setEditable(editable)
      }
    }, [editable, editor])

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getEditor: () => editor,
      getHTML: () => editor?.getHTML() || '',
      getText: () => editor?.getText() || '',
      getWordCount: () => editor?.storage.characterCount?.words() || 0,
      focus: () => editor?.commands.focus(),
      scrollToSection: (sectionId: string) => {
        const element = document.getElementById(`section-${sectionId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
          // Focus the editor after scrolling
          setTimeout(() => editor?.commands.focus(), 100)
        }
      },
    }))

    if (!editor) {
      return (
        <div className={`flex items-center justify-center h-full ${className}`}>
          <div className="text-gray-400">Loading editor...</div>
        </div>
      )
    }

    return (
      <div className={`h-full overflow-y-auto ${className}`}>
        <div className="max-w-3xl mx-auto px-12 py-8">
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  }
)

ProseMirrorEditor.displayName = 'ProseMirrorEditor'

export default ProseMirrorEditor

