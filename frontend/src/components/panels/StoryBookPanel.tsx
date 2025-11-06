'use client'

import { useState, useEffect } from 'react'
import { Node } from 'reactflow'
import { StoryNodeData, StoryBook } from '@/types/nodes'
import { getStoryBooks, searchStoryBooks } from '@/lib/storyBooks'

interface StoryBookPanelProps {
  node: Node<StoryNodeData>
  onUpdate: (nodeId: string, newData: StoryNodeData) => void
  onDelete: (nodeId: string) => void
}

export default function StoryBookPanel({ node, onUpdate, onDelete }: StoryBookPanelProps) {
  const [books, setBooks] = useState<StoryBook[]>([])
  const [filteredBooks, setFilteredBooks] = useState<StoryBook[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBook, setSelectedBook] = useState<StoryBook | null>(null)
  const [title, setTitle] = useState(node.data.label || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBooks()
  }, [])

  // Reset all state when node changes
  useEffect(() => {
    setTitle(node.data.label || '')
    setSearchQuery('')
    
    // Reset or set selected book based on node data
    if (node.data.bookId && node.data.bookTitle && node.data.bookAuthor) {
      // Reconstruct book object from stored node data
      const book: StoryBook = {
        id: node.data.bookId,
        title: node.data.bookTitle,
        author: node.data.bookAuthor,
        year: node.data.year,
        description: node.data.description,
        cover_url: node.data.image,
        gutenberg_id: undefined,
        full_text_url: undefined,
      }
      setSelectedBook(book)
    } else {
      setSelectedBook(null)
    }
  }, [node.id])

  const loadBooks = async () => {
    try {
      const data = await getStoryBooks()
      setBooks(data)
      setFilteredBooks(data)
    } catch (error) {
      console.error('Failed to load books:', error)
    } finally {
      setLoading(false)
    }
  }

  // Debounced search effect
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredBooks(books)
      return
    }
    
    setLoading(true)
    
    const timer = setTimeout(async () => {
      try {
        const results = await searchStoryBooks(searchQuery)
        setFilteredBooks(results)
      } catch (error) {
        console.error('Search failed:', error)
        setFilteredBooks([])
      } finally {
        setLoading(false)
      }
    }, 500)
    
    return () => {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [searchQuery, books])

  const handleSelectBook = (book: StoryBook) => {
    setSelectedBook(book)
    setSearchQuery('')
    
    // Always update title to the new book's title
    const newTitle = book.title.toUpperCase()
    setTitle(newTitle)
    
    // Update node data including cover image and all book details
    onUpdate(node.id, {
      ...node.data,
      label: newTitle,
      bookId: book.id,
      bookTitle: book.title,
      bookAuthor: book.author,
      year: book.year,
      description: book.description || `${book.title} by ${book.author}`,
      image: book.cover_url || undefined, // Set cover as node image
    })
  }

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    onUpdate(node.id, {
      ...node.data,
      label: newTitle,
    })
  }

  const handleClearSelection = () => {
    setSelectedBook(null)
    setSearchQuery('')
    onUpdate(node.id, {
      ...node.data,
      bookId: undefined,
      bookTitle: undefined,
      bookAuthor: undefined,
      image: undefined, // Clear the cover image
      description: 'Select a book',
    })
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this node?')) {
      onDelete(node.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editable Title */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white rounded-t-3xl">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="text-xl font-semibold text-gray-900 w-full bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded px-2 py-1"
          placeholder="Node Title"
        />
        <div className="text-xs text-gray-500 uppercase tracking-wide mt-1 px-2">Story Book Node</div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {selectedBook ? (
          /* Selected Book Display */
          <div>
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Selected Book</h3>
              <button
                onClick={handleClearSelection}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Change book
              </button>
            </div>

            {/* Book Cover */}
            <div className="mb-4">
              {selectedBook.cover_url ? (
                <img
                  src={selectedBook.cover_url}
                  alt={selectedBook.title}
                  className="w-full h-48 object-cover rounded-lg shadow-md"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg shadow-md flex items-center justify-center">
                  <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              )}
            </div>

            {/* Book Info */}
            <div className="mb-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-1">{selectedBook.title}</h4>
              <p className="text-sm text-gray-600 mb-2">by {selectedBook.author}</p>
              {selectedBook.year && (
                <p className="text-xs text-gray-500 mb-3">Published: {selectedBook.year}</p>
              )}
              {selectedBook.description && (
                <p className="text-sm text-gray-700 leading-relaxed">{selectedBook.description}</p>
              )}
            </div>

            {/* Settings Placeholder */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Settings</h4>
              <p className="text-xs text-gray-500 italic">Additional settings coming soon...</p>
            </div>
          </div>
        ) : (
          /* Book Search and List */
          <div>
            {/* Search Field */}
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search books by title or author..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm"
              />
            </div>

            {/* Book List */}
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading books...</div>
            ) : filteredBooks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No books found</div>
            ) : (
              <div className="space-y-2">
                {filteredBooks.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => handleSelectBook(book)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-yellow-400 hover:bg-yellow-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900 text-sm">{book.title}</div>
                    <div className="text-xs text-gray-600 mt-1">by {book.author}</div>
                    {book.year && (
                      <div className="text-xs text-gray-500 mt-1">{book.year}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Button */}
      <div className="px-6 py-4 border-t border-gray-200 mt-auto bg-white rounded-b-3xl">
        <button
          onClick={handleDelete}
          className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Node
        </button>
      </div>
    </div>
  )
}

