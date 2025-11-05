'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/canvas')
      } else {
        router.push('/auth')
      }
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Publo</h1>
          <p className="text-gray-400 font-mono text-sm">Engineering Intelligence</p>
          <div className="mt-8 text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  return null
}

