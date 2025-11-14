'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, UserIcon, CreditCardIcon, BellIcon, GlobeAltIcon, ShieldCheckIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline'

export default function SettingsPage() {
  const router = useRouter()

  const settingsSections = [
    {
      title: 'Account',
      items: [
        { name: 'Profile', icon: UserIcon, description: 'Manage your profile' },
        { name: 'Subscription', icon: CreditCardIcon, description: 'Upgrade or manage plan', highlight: true },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { name: 'Notifications', icon: BellIcon, description: 'Push and email settings' },
        { name: 'Language', icon: GlobeAltIcon, description: 'Norwegian' },
      ]
    },
    {
      title: 'Support',
      items: [
        { name: 'Privacy & Security', icon: ShieldCheckIcon, description: 'Manage data and privacy' },
        { name: 'Help Center', icon: QuestionMarkCircleIcon, description: 'FAQs and support' },
      ]
    }
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
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {settingsSections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
                {section.title}
              </h2>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.name}
                      className={`
                        w-full flex items-center gap-3 p-4 rounded-xl 
                        hover:bg-gray-50 transition-all
                        ${item.highlight ? 'bg-yellow-50 border border-yellow-200' : ''}
                      `}
                    >
                      <Icon className={`w-5 h-5 ${item.highlight ? 'text-yellow-600' : 'text-gray-400'}`} />
                      <div className="flex-1 text-left">
                        <div className={`font-medium ${item.highlight ? 'text-yellow-900' : 'text-gray-900'}`}>
                          {item.name}
                        </div>
                        <div className="text-xs text-gray-500">{item.description}</div>
                      </div>
                      <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

