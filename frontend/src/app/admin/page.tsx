'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'
import ModelMetadataManager, { ModelMetadata } from '@/components/admin/ModelMetadataManager'
import ModelEditForm from '@/components/admin/ModelEditForm'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: 'prospect' | 'admin' | 'user'
  access_tier: 'free' | 'tier1' | 'tier2' | 'tier3'
  access_status: 'waitlist' | 'granted' | 'revoked'
  access_granted_at: string | null
  waitlist_joined_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  
  // Model management state
  const [activeTab, setActiveTab] = useState<'users' | 'models'>('users')
  const [models, setModels] = useState<ModelMetadata[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelMetadata | null>(null)
  
  // TEMPORARY: Force admin for your email while debugging
  const isForceAdmin = user?.email === 'pal.machulla@gmail.com'

  // Check if current user is admin
  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        setCheckingAdmin(false)
        return
      }

      const supabase = createClient()
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error checking admin status:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(data?.role === 'admin')
        }
      } catch (error) {
        console.error('Admin check failed:', error)
        setIsAdmin(false)
      } finally {
        setCheckingAdmin(false)
      }
    }

    if (user?.email === 'pal.machulla@gmail.com') {
      console.log('🔧 OVERRIDE: Force setting admin to true for pal.machulla@gmail.com')
      setIsAdmin(true)
      setCheckingAdmin(false)
    } else {
      checkAdminStatus()
    }
  }, [user])

  // Redirect if not admin
  useEffect(() => {
    if (!loading && !checkingAdmin) {
      if (!user) {
        router.push('/auth')
      } else if (!isAdmin) {
        router.push('/canvas')
      }
    }
  }, [user, loading, isAdmin, checkingAdmin, router])

  // Fetch all users
  useEffect(() => {
    async function fetchUsers() {
      if (!isAdmin) return

      setIsLoading(true)
      const supabase = createClient()

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching users:', error)
        } else {
          setUsers(data || [])
          setFilteredUsers(data || [])
        }
      } catch (error) {
        console.error('Failed to fetch users:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (isAdmin) {
      fetchUsers()
    }
  }, [isAdmin])

  // Fetch models when models tab is active
  const fetchModels = async () => {
    if (!isAdmin) return
    
    setFetchingModels(true)
    try {
      const response = await fetch('/api/admin/models')
      const data = await response.json()
      if (data.success) {
        setModels(data.models || [])
      } else {
        console.error('Failed to fetch models:', data.error)
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
    } finally {
      setFetchingModels(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'models' && isAdmin) {
      fetchModels()
    }
  }, [activeTab, isAdmin])

  const handleSaveModel = async (model: ModelMetadata) => {
    try {
      const response = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model)
      })

      const data = await response.json()
      if (data.success) {
        await fetchModels()
        setEditingModel(null)
      } else {
        throw new Error(data.error || 'Failed to save model')
      }
    } catch (error) {
      console.error('Failed to save model:', error)
      throw error
    }
  }

  // Filter users based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = users.filter(
      (u) =>
        u.email.toLowerCase().includes(query) ||
        u.full_name?.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query) ||
        u.access_status.toLowerCase().includes(query)
    )
    setFilteredUsers(filtered)
  }, [searchQuery, users])

  const handleUpdateUser = async (userId: string, updates: Partial<UserProfile>) => {
    setSavingUserId(userId)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)

      if (error) {
        console.error('Error updating user:', error)
        alert('Failed to update user: ' + error.message)
      } else {
        // Update local state
        setUsers(users.map(u => u.id === userId ? { ...u, ...updates } : u))
        setEditingUser(null)
      }
    } catch (error) {
      console.error('Failed to update user:', error)
      alert('Failed to update user')
    } finally {
      setSavingUserId(null)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'user': return 'bg-green-100 text-green-800 border-green-300'
      case 'prospect': return 'bg-gray-100 text-gray-800 border-gray-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'tier3': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'tier2': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'tier1': return 'bg-cyan-100 text-cyan-800 border-cyan-300'
      case 'free': return 'bg-gray-100 text-gray-800 border-gray-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'granted': return 'bg-green-100 text-green-800 border-green-300'
      case 'waitlist': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'revoked': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  if (loading || checkingAdmin || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 z-0" style={{
          backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} />
        
        <div className="text-gray-900 text-lg font-mono relative z-10">Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-gray-50" style={{
        backgroundImage: `radial-gradient(circle, #e5e7eb 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600 mt-1 font-mono text-sm">User Management & Model Configuration</p>
          </div>
          <button
            onClick={() => router.push('/canvas')}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Canvas
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'users'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('models')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'models'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Model Metadata
            </button>
          </nav>
        </div>

        {/* Stats - Users Tab */}
        {activeTab === 'users' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-600 mb-1">Total Users</div>
                <div className="text-2xl font-bold text-gray-900">{users.length}</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-600 mb-1">Admins</div>
                <div className="text-2xl font-bold text-purple-600">{users.filter(u => u.role === 'admin').length}</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-600 mb-1">Active Users</div>
                <div className="text-2xl font-bold text-green-600">{users.filter(u => u.access_status === 'granted').length}</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="text-sm text-gray-600 mb-1">Waitlist</div>
                <div className="text-2xl font-bold text-orange-600">{users.filter(u => u.access_status === 'waitlist').length}</div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email, name, role, or status..."
                  className="w-full px-4 py-3 pl-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white shadow-sm"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </>
        )}

        {/* Users Table */}
        {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tier</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((userProfile) => (
                  <tr key={userProfile.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm mr-3">
                          {userProfile.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{userProfile.full_name || 'No name'}</div>
                          <div className="text-sm text-gray-500">{userProfile.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={userProfile.role}
                        onChange={(e) => handleUpdateUser(userProfile.id, { role: e.target.value as any })}
                        disabled={savingUserId === userProfile.id}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeColor(userProfile.role)} cursor-pointer hover:opacity-80 transition-opacity`}
                      >
                        <option value="prospect">Prospect</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={userProfile.access_tier}
                        onChange={(e) => handleUpdateUser(userProfile.id, { access_tier: e.target.value as any })}
                        disabled={savingUserId === userProfile.id}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTierBadgeColor(userProfile.access_tier)} cursor-pointer hover:opacity-80 transition-opacity`}
                      >
                        <option value="free">Free</option>
                        <option value="tier1">Tier 1</option>
                        <option value="tier2">Tier 2</option>
                        <option value="tier3">Tier 3</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={userProfile.access_status}
                        onChange={(e) => handleUpdateUser(userProfile.id, { access_status: e.target.value as any })}
                        disabled={savingUserId === userProfile.id}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeColor(userProfile.access_status)} cursor-pointer hover:opacity-80 transition-opacity`}
                      >
                        <option value="waitlist">Waitlist</option>
                        <option value="granted">Granted</option>
                        <option value="revoked">Revoked</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {new Date(userProfile.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setEditingUser(userProfile)}
                        className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                      >
                        Edit Notes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No users found matching your search.</p>
            </div>
          )}
        </div>
        )}

        {/* Model Metadata Manager */}
        {activeTab === 'models' && (
          <ModelMetadataManager
            models={models}
            onRefresh={fetchModels}
            onEdit={setEditingModel}
          />
        )}
      </div>

      {/* Edit User Notes Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit User Notes</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">{editingUser.full_name || editingUser.email}</span>
              </p>
              <textarea
                value={editingUser.notes || ''}
                onChange={(e) => setEditingUser({ ...editingUser, notes: e.target.value })}
                rows={4}
                placeholder="Add notes about this user..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  handleUpdateUser(editingUser.id, { notes: editingUser.notes })
                }}
                disabled={savingUserId === editingUser.id}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors text-sm font-medium disabled:opacity-50"
              >
                {savingUserId === editingUser.id ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Model Modal */}
      {editingModel !== null && (
        <ModelEditForm
          model={editingModel}
          onClose={() => setEditingModel(null)}
          onSave={handleSaveModel}
        />
      )}
    </div>
  )
}

