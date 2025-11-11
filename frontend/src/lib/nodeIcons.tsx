import { NodeType } from '@/types/nodes'

export function getNodeIcon(nodeType: NodeType): JSX.Element {
  switch (nodeType) {
    case 'story':
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    case 'docs':
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'character':
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    case 'location':
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    case 'research':
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
      )
    case 'context':
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )
    case 'create-story':
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )
    case 'story-draft':
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'cluster':
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2" strokeWidth={2} fill="currentColor" />
          <circle cx="5" cy="12" r="2" strokeWidth={2} fill="currentColor" />
          <circle cx="19" cy="12" r="2" strokeWidth={2} fill="currentColor" />
          <circle cx="9" cy="19" r="2" strokeWidth={2} fill="currentColor" />
          <circle cx="15" cy="19" r="2" strokeWidth={2} fill="currentColor" />
          <line x1="12" y1="7" x2="10" y2="10" strokeWidth={2} strokeLinecap="round" />
          <line x1="12" y1="7" x2="14" y2="10" strokeWidth={2} strokeLinecap="round" />
          <line x1="7" y1="12" x2="17" y2="12" strokeWidth={2} strokeLinecap="round" />
          <line x1="7" y1="13" x2="9.5" y2="17.5" strokeWidth={2} strokeLinecap="round" />
          <line x1="17" y1="13" x2="14.5" y2="17.5" strokeWidth={2} strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )
  }
}

export function getNodeColor(nodeType: NodeType): string {
  switch (nodeType) {
    case 'story':
      return 'text-blue-500'
    case 'docs':
      return 'text-green-500'
    case 'character':
      return 'text-purple-500'
    case 'location':
      return 'text-red-500'
    case 'research':
      return 'text-cyan-500'
    case 'context':
      return 'text-gray-500'
    case 'create-story':
      return 'text-yellow-500'
    case 'story-draft':
      return 'text-gray-600'
    case 'cluster':
      return 'text-gray-500'
    default:
      return 'text-gray-400'
  }
}

