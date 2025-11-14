'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

export default function BooksPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-4 py-4 border-b border-gray-100 flex items-center gap-3">
        <button 
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">My Books</h1>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        <div className="max-w-2xl mx-auto">
          {/* Search */}
          <div className="relative mb-6">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search books..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 outline-none transition-all"
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-100">
            <button className="px-4 py-2 text-sm font-medium text-yellow-600 border-b-2 border-yellow-400">
              Mine
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
              Bokdatabasen
            </button>
          </div>

          {/* Empty State */}
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium mb-1">No books yet</p>
            <p className="text-sm text-gray-400">Start writing to create your first book</p>
          </div>
        </div>
      </main>
    </div>
  )
}

