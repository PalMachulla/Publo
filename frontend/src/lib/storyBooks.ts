import { StoryBook } from '@/types/nodes'

const OPEN_LIBRARY_API = 'https://openlibrary.org/search.json'
const OPEN_LIBRARY_COVERS = 'https://covers.openlibrary.org/b/id'

// Convert Open Library response to our StoryBook format
function parseOpenLibraryBook(doc: any): StoryBook {
  return {
    id: doc.key || `ol-${doc.edition_key?.[0]}`, // Use work key or first edition key
    title: doc.title || 'Unknown Title',
    author: doc.author_name?.[0] || 'Unknown Author',
    year: doc.first_publish_year || undefined,
    description: doc.first_sentence?.[0] || undefined,
    cover_url: doc.cover_i ? `${OPEN_LIBRARY_COVERS}/${doc.cover_i}-M.jpg` : undefined,
    gutenberg_id: undefined,
    full_text_url: doc.ia?.[0] ? `https://archive.org/details/${doc.ia[0]}` : undefined,
  }
}

export async function getStoryBooks(): Promise<StoryBook[]> {
  try {
    // Get popular public domain classics
    const response = await fetch(
      `${OPEN_LIBRARY_API}?q=subject:fiction&has_fulltext=true&public_scan_b=true&sort=editions&limit=20`
    )
    
    if (!response.ok) {
      throw new Error('Failed to fetch books from Open Library')
    }
    
    const data = await response.json()
    return data.docs?.map(parseOpenLibraryBook) || []
  } catch (error) {
    console.error('Error fetching story books:', error)
    // Return fallback classics if API fails
    return []
  }
}

export async function searchStoryBooks(query: string): Promise<StoryBook[]> {
  if (!query.trim()) {
    return getStoryBooks()
  }
  
  try {
    // Search for books with public domain preference
    const response = await fetch(
      `${OPEN_LIBRARY_API}?q=${encodeURIComponent(query)}&has_fulltext=true&limit=30`
    )
    
    if (!response.ok) {
      throw new Error('Failed to search books from Open Library')
    }
    
    const data = await response.json()
    return data.docs?.map(parseOpenLibraryBook) || []
  } catch (error) {
    console.error('Error searching story books:', error)
    return []
  }
}

