import { useState, useEffect, useCallback, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { calculateWordCount } from '@/types/document'
import type { SaveStatus } from '@/types/document'

interface UseDocumentEditorOptions {
  initialContent: string
  onSave?: (content: string, wordCount: number) => Promise<void>
  autoSaveDelay?: number
  enabled?: boolean
}

interface UseDocumentEditorReturn {
  content: string
  setContent: (content: string) => void
  wordCount: number
  saveStatus: SaveStatus
  lastSaved: Date | null
  saveError: string | null
  handleEditorUpdate: (editor: Editor) => void
  saveNow: () => Promise<void>
  isDirty: boolean
}

export function useDocumentEditor({
  initialContent,
  onSave,
  autoSaveDelay = 2000,
  enabled = true,
}: UseDocumentEditorOptions): UseDocumentEditorReturn {
  const [content, setContent] = useState(initialContent)
  const [wordCount, setWordCount] = useState(0)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Refs for debouncing
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContentRef = useRef<string>(initialContent)

  // Update content when initialContent changes
  useEffect(() => {
    if (initialContent !== content) {
      setContent(initialContent)
      lastSavedContentRef.current = initialContent
      setWordCount(calculateWordCount(initialContent))
      setIsDirty(false) // Reset dirty state when content is set externally
    }
  }, [initialContent, content])

  // Save function
  const save = useCallback(
    async (contentToSave: string) => {
      if (!onSave || !enabled) return

      try {
        setSaveStatus('saving')
        setSaveError(null)

        const words = calculateWordCount(contentToSave)
        await onSave(contentToSave, words)

        lastSavedContentRef.current = contentToSave
        setSaveStatus('saved')
        setLastSaved(new Date())
        setIsDirty(false)

        // Reset to idle after 2 seconds
        setTimeout(() => {
          setSaveStatus(prev => (prev === 'saved' ? 'idle' : prev))
        }, 2000)
      } catch (error) {
        console.error('Failed to save:', error)
        setSaveStatus('error')
        setSaveError(error instanceof Error ? error.message : 'Failed to save')
      }
    },
    [onSave, enabled]
  )

  // Save now (without debounce)
  const saveNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (isDirty && content !== lastSavedContentRef.current) {
      await save(content)
    }
  }, [content, isDirty, save])

  // Handle editor updates
  const handleEditorUpdate = useCallback(
    (editor: Editor) => {
      const newContent = editor.getHTML()
      setContent(newContent)
      setWordCount(editor.storage.characterCount?.words() || 0)

      // Check if content has changed
      if (newContent !== lastSavedContentRef.current) {
        setIsDirty(true)

        // Clear existing timer
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
        }

        // Set new timer for auto-save
        if (enabled && onSave) {
          saveTimerRef.current = setTimeout(() => {
            save(newContent)
          }, autoSaveDelay)
        }
      }
    },
    [enabled, onSave, autoSaveDelay, save]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (isDirty && content !== lastSavedContentRef.current && onSave) {
        // This is best effort - may not complete if page unloads
        onSave(content, calculateWordCount(content))
      }
    }
  }, [isDirty, content, onSave])

  return {
    content,
    setContent,
    wordCount,
    saveStatus,
    lastSaved,
    saveError,
    handleEditorUpdate,
    saveNow,
    isDirty,
  }
}

