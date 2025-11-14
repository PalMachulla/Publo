'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, PhotoIcon, CameraIcon, MicrophoneIcon, DocumentIcon } from '@heroicons/react/24/outline'

export default function ResearchPage() {
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
        <h1 className="text-xl font-semibold text-gray-900">Research</h1>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Upload Options */}
          <div className="grid grid-cols-2 gap-3">
            <button className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-yellow-400 transition-colors">
              <PhotoIcon className="w-8 h-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Upload Files</span>
            </button>
            
            <button className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-yellow-400 transition-colors">
              <CameraIcon className="w-8 h-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Take Photo</span>
            </button>
            
            <button className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-yellow-400 transition-colors">
              <MicrophoneIcon className="w-8 h-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Record Audio</span>
            </button>
            
            <button className="flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-yellow-400 transition-colors">
              <DocumentIcon className="w-8 h-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Scan Document</span>
            </button>
          </div>

          {/* Recent Items */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Items</h2>
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No items yet</p>
              <p className="text-xs mt-1">Upload files to get started</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

