'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useDeviceType } from '@/hooks/useDeviceType'

export default function Home() {
  const { user, loading } = useAuth()
  const { isMobile, isLoading: deviceLoading } = useDeviceType()
  const router = useRouter()

  useEffect(() => {
    // Wait for both auth and device detection to complete
    if (!loading && !deviceLoading) {
      // Mobile users always go to mobile view
      if (isMobile) {
        router.push('/mobile')
      } 
      // Desktop users follow auth flow
      else {
        if (user) {
          router.push('/stories')
        } else {
          router.push('/auth')
        }
      }
    }
  }, [user, loading, isMobile, deviceLoading, router])

  if (loading || deviceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 z-0" style={{
          backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} />
        
        <div className="text-center relative z-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Publo</h1>
          <p className="text-gray-600 font-mono text-sm">Engineering Intelligence</p>
          <div className="mt-8 text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  return null
}

