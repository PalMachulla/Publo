/**
 * CanvasHeader - Canvas page header component
 * 
 * Displays the canvas header with:
 * - Logo and title input
 * - Save button with status indicator
 * - Sharing dropdown (visibility and email management)
 * - Menu dropdown (New Canvas, My Canvases, Delete Canvas)
 * - Profile menu (Profile, Admin Panel, Logout)
 * 
 * Architecture Notes:
 * - Pure presentation component
 * - Receives all state and handlers via props
 * - Handles dropdown state internally
 * 
 * @see canvas/page.tsx for original implementation
 */

import React from 'react'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'

export interface CanvasHeaderProps {
  // Title
  storyTitle: string
  setStoryTitle: (title: string) => void
  titleInputRef: React.RefObject<HTMLInputElement>
  onTitleBlur: () => void
  
  // Save state
  saving: boolean
  hasUnsavedChanges: boolean
  onSave: () => void
  
  // Sharing
  canvasVisibility: 'private' | 'shared' | 'public'
  onVisibilityChange: (visibility: 'private' | 'shared' | 'public') => Promise<void>
  sharedEmails: string[]
  emailInput: string
  setEmailInput: (email: string) => void
  sendingInvite: boolean
  onAddSharedEmail: () => Promise<void>
  onRemoveSharedEmail: (email: string) => Promise<void>
  
  // Menu
  onNewCanvas: () => void
  onDeleteCanvas?: () => void
  storyId: string | null
  
  // Profile
  userAvatar: string | null
  userEmail: string | undefined
  userRole: 'prospect' | 'admin' | 'user' | null
  isForceAdmin: boolean
  onLogout: () => void
}

/**
 * Canvas header component
 */
export default function CanvasHeader(props: CanvasHeaderProps) {
  const {
    storyTitle,
    setStoryTitle,
    titleInputRef,
    onTitleBlur,
    saving,
    hasUnsavedChanges,
    onSave,
    canvasVisibility,
    onVisibilityChange,
    sharedEmails,
    emailInput,
    setEmailInput,
    sendingInvite,
    onAddSharedEmail,
    onRemoveSharedEmail,
    onNewCanvas,
    onDeleteCanvas,
    storyId,
    userAvatar,
    userEmail,
    userRole,
    isForceAdmin,
    onLogout
  } = props
  
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = React.useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = React.useState(false)
  const [sharingDropdownOpen, setSharingDropdownOpen] = React.useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const sharingDropdownRef = useRef<HTMLDivElement>(null)
  
  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
      if (sharingDropdownRef.current && !sharingDropdownRef.current.contains(event.target as Node)) {
        setSharingDropdownOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  return (
    <header className="border-b border-gray-200 bg-white z-[60] shadow-sm relative">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <img src="/publo_logo.svg" alt="PUBLO" className="h-6" />
          <input
            ref={titleInputRef}
            type="text"
            value={storyTitle}
            onChange={(e) => setStoryTitle(e.target.value)}
            onBlur={onTitleBlur}
            className="text-sm text-gray-600 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-gray-50 rounded px-2 py-1 transition-all"
            placeholder="Untitled Story"
          />
        </div>
        
        {/* Center Save Button + Sharing Dropdown */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
          {/* Save Button - expands left */}
          {saving ? (
            <div className="flex items-center gap-2 px-5 py-2 h-[38px] bg-gray-100 rounded-l-full transition-all">
              <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm text-gray-600">Saving...</span>
            </div>
          ) : hasUnsavedChanges ? (
            <button
              onClick={onSave}
              className="flex items-center gap-2 px-5 py-2 h-[38px] bg-gray-100 hover:bg-gray-200 rounded-l-full transition-all"
              title="Save changes"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm text-gray-600">Save Changes</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-5 py-2 h-[38px] bg-gray-100 rounded-l-full transition-all">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-gray-600">All changes saved</span>
            </div>
          )}

          {/* Sharing Dropdown Button - fixed to right of Save */}
          <div className="relative" ref={sharingDropdownRef}>
            <button
              onClick={() => setSharingDropdownOpen(!sharingDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-2 h-[38px] bg-gray-100 hover:bg-gray-200 rounded-r-full border-l border-gray-200 transition-all"
              title="Canvas visibility"
            >
              {canvasVisibility === 'public' ? (
                <>
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-600 font-medium">Public</span>
                </>
              ) : canvasVisibility === 'shared' ? (
                <>
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  <span className="text-sm text-gray-600 font-medium">Shared</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-sm text-gray-600 font-medium">Private</span>
                </>
              )}
              <svg className={`w-3 h-3 text-gray-600 transition-transform ${sharingDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Sharing Dropdown Menu */}
            {sharingDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[100]">
                <div className="px-4 py-2 border-b border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Canvas Visibility</h3>
                </div>
                
                {/* Visibility Options */}
                <div className="p-2">
                  <button
                    onClick={() => onVisibilityChange('private')}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors ${canvasVisibility === 'private' ? 'bg-gray-100' : ''}`}
                  >
                    <svg className="w-5 h-5 text-gray-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm text-gray-900">Private</div>
                      <div className="text-xs text-gray-500">Only you can access this canvas</div>
                    </div>
                    {canvasVisibility === 'private' && (
                      <svg className="w-4 h-4 text-blue-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  
                  <button
                    onClick={() => onVisibilityChange('shared')}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors ${canvasVisibility === 'shared' ? 'bg-gray-100' : ''}`}
                  >
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm text-gray-900">Shared</div>
                      <div className="text-xs text-gray-500">Share with specific people</div>
                    </div>
                    {canvasVisibility === 'shared' && (
                      <svg className="w-4 h-4 text-blue-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  
                  <button
                    onClick={() => onVisibilityChange('public')}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-gray-50 transition-colors ${canvasVisibility === 'public' ? 'bg-gray-100' : ''}`}
                  >
                    <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm text-gray-900">Public</div>
                      <div className="text-xs text-gray-500">Anyone with the link can view</div>
                    </div>
                    {canvasVisibility === 'public' && (
                      <svg className="w-4 h-4 text-blue-600 mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Email Input for Shared */}
                {canvasVisibility === 'shared' && (
                  <>
                    <div className="border-t border-gray-100 px-4 py-3">
                      <label className="text-xs font-medium text-gray-700 mb-2 block">Share with email</label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && onAddSharedEmail()}
                          placeholder="email@example.com"
                          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={sendingInvite}
                        />
                        <button
                          onClick={onAddSharedEmail}
                          disabled={sendingInvite || !emailInput.trim()}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {sendingInvite ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                    </div>

                    {/* Shared Emails List */}
                    {sharedEmails.length > 0 && (
                      <div className="border-t border-gray-100 px-4 py-2 max-h-40 overflow-y-auto">
                        <div className="text-xs font-medium text-gray-700 mb-2">Shared with ({sharedEmails.length})</div>
                        {sharedEmails.map((email) => (
                          <div key={email} className="flex items-center justify-between py-1.5 group">
                            <span className="text-sm text-gray-700">{email}</span>
                            <button
                              onClick={() => onRemoveSharedEmail(email)}
                              className="text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove access"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Burger Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Menu"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-[100]">
                {/* New Canvas */}
                <button
                  onClick={onNewCanvas}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Canvas
                </button>

                {/* My Canvases */}
                <button
                  onClick={() => {
                    router.push('/stories')
                    setIsMenuOpen(false)
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  My Canvases
                </button>

                {/* My Characters */}
                <button
                  onClick={() => {
                    router.push('/characters')
                    setIsMenuOpen(false)
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  My Characters
                </button>

                <div className="border-t border-gray-200 my-2"></div>

                {/* Delete Canvas */}
                {storyId && onDeleteCanvas && (
                  <button
                    onClick={onDeleteCanvas}
                    className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Canvas
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Profile Picture Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold hover:shadow-lg transition-shadow overflow-hidden"
              title="Profile"
            >
              {userAvatar ? (
                <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                userEmail?.[0].toUpperCase() || 'U'
              )}
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                {/* Profile */}
                <button
                  onClick={() => {
                    router.push('/profile')
                    setIsProfileMenuOpen(false)
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>

                {/* Admin Panel - Only show for admins */}
                {(userRole === 'admin' || isForceAdmin) && (
                  <button
                    onClick={() => {
                      router.push('/admin')
                      setIsProfileMenuOpen(false)
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Admin Panel
                  </button>
                )}

                <div className="border-t border-gray-200 my-2"></div>

                {/* Logout */}
                <button
                  onClick={onLogout}
                  className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

