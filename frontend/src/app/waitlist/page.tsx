'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'

export default function WaitlistPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState(user?.email || '')
  const [fullName, setFullName] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(true)

  // Check if user already has granted access and redirect them
  useEffect(() => {
    async function checkUserAccess() {
      if (!user) {
        setCheckingAccess(false)
        return
      }

      const supabase = createClient()
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('access_status, role')
          .eq('id', user.id)
          .single()

        // If user has granted access or is admin, redirect to stories/canvas
        if (data?.access_status === 'granted' || data?.role === 'admin') {
          router.push('/stories')
          return
        }
      } catch (err) {
        console.error('Error checking access:', err)
      }
      setCheckingAccess(false)
    }

    if (!loading) {
      checkUserAccess()
    }
  }, [user, loading, router])

  if (loading || checkingAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()

      // If user is logged in, update their profile
      if (user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({
            id: user.id,
            email: user.email,
            full_name: fullName || user.user_metadata?.name,
            access_status: 'waitlist',
            notes: reason
          })

        if (profileError) throw profileError
      } else {
        // Add to waitlist table for non-authenticated users
        const { error: waitlistError } = await supabase
          .from('waitlist')
          .insert({
            email,
            full_name: fullName,
            reason
          })

        if (waitlistError) {
          if (waitlistError.code === '23505') {
            throw new Error('This email is already on the waitlist')
          }
          throw waitlistError
        }
      }

      setIsSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Failed to join waitlist')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-gray-50" style={{
        backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }} />
      
      <div className="max-w-md w-full relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="/publo_logo.svg" 
            alt="Publo" 
            className="h-12 mx-auto mb-6"
          />
          <div className="flex items-center justify-center gap-2 text-gray-600 text-sm">
            <span>Intelligence Engineered by</span>
            <img 
              src="/aiakaki_logo.svg" 
              alt="AIAKAKI" 
              className="h-3.5"
            />
          </div>
        </div>

        {/* Waitlist Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 p-8">
          {!isSubmitted ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Join the Waitlist
                </h2>
                <p className="text-gray-600">
                  We're currently in private beta. Request access and we'll notify you when you're approved.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!user && (
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                )}

                {user && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600">Signed in as</p>
                    <p className="font-medium text-gray-900">{user.email}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                    How will you use Publo? (Optional)
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all resize-none"
                    placeholder="Tell us about your use case..."
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-yellow-400 text-gray-900 font-semibold rounded-lg hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                >
                  {isSubmitting ? 'Submitting...' : 'Request Access'}
                </button>
              </form>

              {user && (
                <div className="mt-4 text-center">
                  <button
                    onClick={handleSignOut}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Sign out
                  </button>
                </div>
              )}

              {!user && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    Already have an account?{' '}
                    <a href="/auth" className="text-yellow-600 hover:text-yellow-700 font-medium">
                      Sign in
                    </a>
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                You're on the list!
              </h3>
              <p className="text-gray-600 mb-6">
                We'll send you an email when your access is approved.
              </p>
              {user && (
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
                >
                  Sign out
                </button>
              )}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-8 px-6 py-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-gray-600 text-sm mb-4 text-center font-mono">What you can expect:</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-700 text-sm">
              <div className="w-5 h-5 rounded-full bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              Visual canvas for story development
            </div>
            <div className="flex items-center gap-3 text-gray-700 text-sm">
              <div className="w-5 h-5 rounded-full bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              AI-powered research and character profiling
            </div>
            <div className="flex items-center gap-3 text-gray-700 text-sm">
              <div className="w-5 h-5 rounded-full bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              Collaborative storytelling tools
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

