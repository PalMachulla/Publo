'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

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

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-text p-6 hover:bg-gray-50 transition-colors min-h-full ${className}`}
    >
      {content ? (
        <div className="prose prose-lg max-w-none prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-gray-700 prose-strong:text-gray-900 prose-em:text-gray-600">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          >
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="text-gray-400 italic">{placeholder}</div>
      )}
    </div>
  )
}

