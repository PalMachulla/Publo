'use client'

import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon, PencilSquareIcon, BookOpenIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'

const MobileHome = () => {
  const router = useRouter()
  
  const sections = [
    {
      id: 'research',
      title: 'RESEARCH',
      icon: MagnifyingGlassIcon,
      description: 'Last opp filer, ta bilder og video',
      route: '/mobile/research',
      color: 'from-blue-50 to-blue-100',
      iconColor: 'text-blue-600'
    },
    {
      id: 'write',
      title: 'WRITE',
      icon: PencilSquareIcon,
      description: 'Skriv med maler og inputs',
      route: '/mobile/write',
      color: 'from-yellow-50 to-yellow-100',
      iconColor: 'text-yellow-600'
    },
    {
      id: 'books',
      title: 'MY BOOKS',
      icon: BookOpenIcon,
      description: 'Dine bøker og bokdatabasen',
      route: '/mobile/books',
      color: 'from-green-50 to-green-100',
      iconColor: 'text-green-600'
    },
    {
      id: 'settings',
      title: 'SETTINGS',
      icon: Cog6ToothIcon,
      description: 'Abonnement og innstillinger',
      route: '/mobile/settings',
      color: 'from-gray-50 to-gray-100',
      iconColor: 'text-gray-600'
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
                  bg-gradient-to-br ${section.color}
                  flex flex-col items-center justify-center
                  shadow-md hover:shadow-lg transition-all duration-200
                  active:scale-95
                  border border-gray-200
                  p-6 gap-3
                  backdrop-blur-sm
                `}
              >
                <Icon className={`w-12 h-12 ${section.iconColor}`} strokeWidth={1.5} />
                <h2 className="text-base font-semibold text-gray-900 tracking-wide">
                  {section.title}
                </h2>
                <p className="text-xs text-gray-600 text-center leading-relaxed">
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

