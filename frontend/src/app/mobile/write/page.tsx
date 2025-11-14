'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, DocumentTextIcon, FilmIcon, NewspaperIcon, BookOpenIcon } from '@heroicons/react/24/outline'

export default function WritePage() {
  const router = useRouter()

  const templates = [
    { name: 'Novel', icon: BookOpenIcon, description: 'Long-form fiction' },
    { name: 'Screenplay', icon: FilmIcon, description: 'Film and TV scripts' },
    { name: 'Article', icon: NewspaperIcon, description: 'Non-fiction writing' },
    { name: 'Short Story', icon: DocumentTextIcon, description: 'Brief narratives' },
  ]

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
        <h1 className="text-xl font-semibold text-gray-900">Write</h1>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Choose a Template</h2>
          
          <div className="space-y-3">
            {templates.map((template) => {
              const Icon = template.icon
              return (
                <button 
                  key={template.name}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-yellow-400 hover:bg-yellow-50/50 transition-all"
                >
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Icon className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <p className="text-sm text-gray-500">{template.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

