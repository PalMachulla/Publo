'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { MagnifyingGlassIcon, Pencil2Icon, ReaderIcon, GearIcon } from '@radix-ui/react-icons'

const MobileHome = () => {
  const router = useRouter()
  const { user, loading } = useAuth()

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center relative">
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}></div>
        <div className="relative z-10 text-gray-500">Loading...</div>
      </div>
    )
  }

  // Don't render if no user (will redirect)
  if (!user) {
    return null
  }
  
  const sections = [
    {
      id: 'research',
      title: 'Research',
      icon: MagnifyingGlassIcon,
      description: 'Upload files, photos, and recordings',
      route: '/mobile/research',
      gradient: 'from-gray-50 to-gray-100'
    },
    {
      id: 'write',
      title: 'Write',
      icon: Pencil2Icon,
      description: 'Create with templates and guides',
      route: '/mobile/write',
      gradient: 'from-gray-100 to-gray-200'
    },
    {
      id: 'books',
      title: 'My Books',
      icon: ReaderIcon,
      description: 'Browse your library and discover',
      route: '/mobile/books',
      gradient: 'from-gray-50 to-gray-100'
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: GearIcon,
      description: 'Manage account and preferences',
      route: '/mobile/settings',
      gradient: 'from-gray-100 to-gray-200'
    }
  ]
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.08) 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}></div>

      {/* Header with Publo Logo */}
      <header className="px-6 py-8 border-b border-gray-100 bg-white/80 backdrop-blur-sm relative z-10">
        <div className="flex items-center justify-center">
          <img 
            src="/publo_logo.svg" 
            alt="Publo" 
            className="h-10"
          />
        </div>
      </header>

      {/* Main Content - 4 Cards */}
      <main className="flex-1 px-4 py-8 relative z-10">
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                onClick={() => router.push(section.route)}
                className={`
                  aspect-square rounded-2xl 
                  bg-gradient-to-br ${section.gradient}
                  flex flex-col items-center justify-center
                  shadow-sm hover:shadow-md transition-all duration-300
                  hover:scale-[1.02] active:scale-[0.98]
                  border border-gray-200/50
                  p-6 gap-3
                  group
                `}
              >
                <div className="w-14 h-14 rounded-full bg-white/80 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
                  <Icon className="w-7 h-7 text-gray-700" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900 tracking-wide">
                  {section.title}
                </h2>
                <p className="text-xs text-gray-500 text-center leading-relaxed">
                  {section.description}
                </p>
              </button>
            )
          })}
        </div>
      </main>

      {/* Footer - Intelligence Engineered by aiakaki */}
      <footer className="px-6 py-4 border-t border-gray-100 bg-white/80 backdrop-blur-sm relative z-10">
        <div className="flex flex-col items-center justify-center gap-2">
          <span className="text-xs text-gray-500">Intelligence Engineered by</span>
          <img 
            src="/aiakaki_logo.svg" 
            alt="aiakaki" 
            className="h-3"
          />
        </div>
      </footer>
    </div>
  )
}

export default MobileHome

