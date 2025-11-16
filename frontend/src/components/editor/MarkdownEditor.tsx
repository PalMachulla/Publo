'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import '@/styles/screenplay.css'

interface MarkdownEditorProps {
  content: string
  onUpdate: (content: string) => void
  placeholder?: string
  className?: string
}

export default function MarkdownEditor({
  content,
  onUpdate,
  placeholder = 'Start writing...',
  className = ''
}: MarkdownEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync content when it changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditContent(content)
    }
  }, [content, isEditing])

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isEditing])

  const handleSave = () => {
    onUpdate(editContent)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Save on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
    // Exit edit mode on Escape
    if (e.key === 'Escape') {
      e.preventDefault()
      setEditContent(content) // Revert changes
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <div className={`relative h-full ${className}`}>
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-full p-6 font-mono text-sm resize-none focus:outline-none bg-white border-2 border-yellow-400"
        />
        <div className="absolute bottom-4 right-4 text-xs text-gray-400 bg-white px-2 py-1 rounded border border-gray-200">
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Cmd</kbd> + <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Enter</kbd> to save · <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd> to cancel
        </div>
      </div>
    )
  }

  // Custom components for better semantic HTML structure
  const components = {
    // Wrap paragraphs in divs for better structure
    p: ({ children, ...props }: any) => {
      return (
        <div className="screenplay-paragraph" {...props}>
          {children}
        </div>
      )
    },
    // Ensure headings are properly structured
    h1: ({ children, ...props }: any) => (
      <h1 className="screenplay-act" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="screenplay-sequence" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="screenplay-scene" {...props}>{children}</h3>
    ),
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-text min-h-full ${className}`}
    >
      {content ? (
        <div className="screenplay-document">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={components}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="text-gray-400 italic p-6">{placeholder}</div>
      )}
    </div>
  )
}

