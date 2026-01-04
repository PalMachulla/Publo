'use client'

import { useState, useMemo } from 'react'
import { Button, Badge, Switch, Card, CardContent, Input, VendorFilterDropdown } from '@/components/ui'

export interface ModelMetadata {
  id?: string
  model_id: string
  provider: 'openai' | 'anthropic' | 'groq' | 'google' | 'deepseek'
  is_active?: boolean
  supports_structured_output?: 'full' | 'json-mode' | 'none' | null
  supports_reasoning?: boolean
  supports_streaming?: boolean
  supports_function_calling?: boolean
  supports_vision?: boolean
  tier?: 'frontier' | 'premium' | 'standard' | 'fast' | null
  speed?: 'instant' | 'fast' | 'medium' | 'slow' | null
  cost?: 'cheap' | 'moderate' | 'expensive' | null
  context_window?: number | null
  max_output_tokens?: number | null
  best_for?: string[]
  notes?: string | null
  admin_verified?: boolean
  created_at?: string
  updated_at?: string
  // Vendor-synced fields
  cost_per_1k_tokens_input?: number | null
  cost_per_1k_tokens_output?: number | null
  speed_tokens_per_sec?: number | null
  vendor_category?: 'production' | 'preview' | 'deprecated' | null
  vendor_name?: string | null
  vendor_description?: string | null
  vendor_synced_at?: string | null
}

interface ModelMetadataManagerProps {
  models: ModelMetadata[]
  onRefresh: () => void
  onEdit: (model: ModelMetadata) => void
}

interface DiscoveredModel {
  model_id: string
  provider: 'openai' | 'anthropic' | 'groq' | 'google' | 'deepseek'
  name: string
  context_window: number | null
  max_output_tokens: number | null
  supports_chat: boolean
  supports_system_prompt: boolean
  category: 'production' | 'preview' | 'deprecated'
  already_configured: boolean
}

export default function ModelMetadataManager({ 
  models, 
  onRefresh, 
  onEdit 
}: ModelMetadataManagerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(true) // Toggle to show/hide inactive models
  // Initialize with all vendors selected (empty set = show all)
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set())
  const [savingModelId, setSavingModelId] = useState<string | null>(null)
  const [fetchingFromVendors, setFetchingFromVendors] = useState(false)
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([])
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false)
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [importingModels, setImportingModels] = useState(false)
  const [syncingVendorData, setSyncingVendorData] = useState(false)

  // Get unique vendors and counts
  const { uniqueVendors, vendorCounts } = useMemo(() => {
    const vendors = new Set<string>()
    const counts: Record<string, number> = {}
    
    models.forEach(m => {
      vendors.add(m.provider)
      counts[m.provider] = (counts[m.provider] || 0) + 1
    })
    
    return {
      uniqueVendors: Array.from(vendors).sort(),
      vendorCounts: counts
    }
  }, [models])

  const filteredModels = models
    .filter(m => {
      const matchesSearch = 
        m.model_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.provider.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Apply inactive toggle filter
      const matchesInactiveToggle = showInactive || m.is_active !== false
      
      // Apply vendor filter (empty set = all vendors)
      const matchesVendor = selectedVendors.size === 0 || selectedVendors.has(m.provider)
      
      return matchesSearch && matchesInactiveToggle && matchesVendor
    })
    .sort((a, b) => {
      // Sort: admin-verified/manually created first, auto-created at bottom
      const aIsAutoCreated = !a.admin_verified || (a.notes?.includes('Auto-created') ?? false)
      const bIsAutoCreated = !b.admin_verified || (b.notes?.includes('Auto-created') ?? false)
      
      if (aIsAutoCreated !== bIsAutoCreated) {
        return aIsAutoCreated ? 1 : -1 // Auto-created goes to bottom
      }
      
      // Within each group, sort by provider then model_id
      if (a.provider !== b.provider) {
        return a.provider.localeCompare(b.provider)
      }
      
      return a.model_id.localeCompare(b.model_id)
    })

  const handleToggleActive = async (model: ModelMetadata) => {
    if (!model.id) return

    setSavingModelId(model.id)
    try {
      const response = await fetch(`/api/admin/models/${model.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: !model.is_active
        })
      })

      const data = await response.json()
      if (data.success) {
        onRefresh()
      } else {
        alert('Failed to update model: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Failed to toggle model active status:', error)
      alert('Failed to update model')
    } finally {
      setSavingModelId(null)
    }
  }

  const getStructuredOutputBadge = (value?: string | null) => {
    if (!value || value === 'none') {
      return <Badge variant="default" size="sm" className="text-[10px] px-1.5 py-0.5">none</Badge>
    }
    if (value === 'full') {
      return <Badge variant="success" size="sm" className="text-[10px] px-1.5 py-0.5">full</Badge>
    }
    return <Badge variant="warning" size="sm" className="text-[10px] px-1.5 py-0.5">json</Badge>
  }

  const getTierBadge = (tier?: string | null) => {
    if (!tier) return <span className="text-gray-400 text-xs">-</span>
    const variantMap: Record<string, 'purple' | 'primary' | 'success' | 'warning'> = {
      frontier: 'purple',
      premium: 'primary',
      standard: 'success',
      fast: 'warning'
    }
    return (
      <Badge variant={variantMap[tier] || 'default'} size="sm" className="text-[10px] px-1.5 py-0.5">
        {tier}
      </Badge>
    )
  }

  const handleRefresh = async () => {
    setSyncingVendorData(true)
    try {
      // First sync vendor data (pricing, context window, etc.)
      const syncResponse = await fetch('/api/admin/models/sync-vendor-data', {
        method: 'POST'
      })
      const syncData = await syncResponse.json()
      
      if (syncData.success) {
        console.log('✅ Synced vendor data:', syncData.updates)
        // Show success message if there were updates
        if (syncData.updates.totalProcessed > 0) {
          const message = `Synced ${syncData.updates.totalProcessed} model(s): ` +
            `${syncData.updates.created} created, ${syncData.updates.updated} updated, ` +
            `${syncData.updates.pricing} pricing updated`
          console.log(message)
        }
      } else {
        console.warn('⚠️ Vendor sync had issues:', syncData.errors)
      }
    } catch (error) {
      console.error('Failed to sync vendor data:', error)
      // Don't block refresh if sync fails
    } finally {
      setSyncingVendorData(false)
      // Always refresh the list after sync attempt
      onRefresh()
    }
  }

  const handleFetchFromVendors = async () => {
    setFetchingFromVendors(true)
    try {
      const response = await fetch('/api/admin/models/fetch-vendors', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setDiscoveredModels(data.models || [])
        setShowDiscoveryModal(true)
      } else {
        alert(data.message || data.error || 'Failed to fetch models from vendors')
      }
    } catch (error) {
      console.error('Failed to fetch from vendors:', error)
      alert('Failed to fetch models from vendors')
    } finally {
      setFetchingFromVendors(false)
    }
  }

  const handleToggleModelSelection = (modelKey: string) => {
    const newSelected = new Set(selectedModels)
    if (newSelected.has(modelKey)) {
      newSelected.delete(modelKey)
    } else {
      newSelected.add(modelKey)
    }
    setSelectedModels(newSelected)
  }

  const handleSelectAll = () => {
    const newModels = discoveredModels.filter(m => !m.already_configured)
    if (selectedModels.size === newModels.length) {
      setSelectedModels(new Set())
    } else {
      setSelectedModels(new Set(newModels.map(m => `${m.provider}:${m.model_id}`)))
    }
  }

  const handleImportModel = async (discoveredModel: DiscoveredModel) => {
    try {
      // Create a basic model metadata entry
      const newModel: ModelMetadata = {
        model_id: discoveredModel.model_id,
        provider: discoveredModel.provider,
        is_active: true,
        supports_structured_output: null, // Admin can configure later
        supports_reasoning: false,
        supports_streaming: true,
        supports_function_calling: false,
        supports_vision: false,
        tier: null,
        speed: null,
        cost: null,
        context_window: discoveredModel.context_window,
        max_output_tokens: discoveredModel.max_output_tokens,
        best_for: [],
        notes: `Imported from vendor API. Category: ${discoveredModel.category}`,
        admin_verified: false
      }
      
      onEdit(newModel)
      setShowDiscoveryModal(false)
    } catch (error) {
      console.error('Failed to import model:', error)
      alert('Failed to import model')
    }
  }

  const handleBulkImport = async () => {
    if (selectedModels.size === 0) {
      alert('Please select at least one model to import')
      return
    }

    setImportingModels(true)
    try {
      const modelsToImport = discoveredModels.filter(m => 
        selectedModels.has(`${m.provider}:${m.model_id}`) && !m.already_configured
      )

      // Import each model sequentially
      for (const model of modelsToImport) {
        const newModel: ModelMetadata = {
          model_id: model.model_id,
          provider: model.provider,
          is_active: true,
          supports_structured_output: null,
          supports_reasoning: false,
          supports_streaming: true,
          supports_function_calling: false,
          supports_vision: false,
          tier: null,
          speed: null,
          cost: null,
          context_window: model.context_window,
          max_output_tokens: model.max_output_tokens,
          best_for: [],
          notes: `Bulk imported from vendor API. Category: ${model.category}`,
          admin_verified: false
        }

        // Save to database
        const response = await fetch('/api/admin/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newModel)
        })

        if (!response.ok) {
          const data = await response.json()
          console.error(`Failed to import ${model.model_id}:`, data.error)
        }
      }

      // Refresh the models list
      onRefresh()
      setSelectedModels(new Set())
      setShowDiscoveryModal(false)
      alert(`Successfully imported ${modelsToImport.length} model(s)`)
    } catch (error) {
      console.error('Failed to bulk import models:', error)
      alert('Failed to import some models. Check console for details.')
    } finally {
      setImportingModels(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by model ID or provider..."
                className="w-full pl-11"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filters and Actions Row */}
            <div className="flex flex-wrap items-center gap-4">
              {/* Vendor Filter Dropdown */}
              <VendorFilterDropdown
                vendors={uniqueVendors}
                selectedVendors={selectedVendors}
                onVendorsChange={setSelectedVendors}
                vendorCounts={vendorCounts}
              />

              {/* Show Inactive Toggle */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50">
                <Switch
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                  id="show-inactive"
                />
                <label htmlFor="show-inactive" className="text-sm text-gray-700 cursor-pointer">
                  Show Inactive
                </label>
              </div>

              <div className="flex-1" /> {/* Spacer */}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleRefresh}
                  disabled={syncingVendorData}
                  loading={syncingVendorData}
                  variant="outline"
                  size="sm"
                >
                  {syncingVendorData ? 'Syncing...' : 'Refresh'}
                </Button>
                <Button
                  onClick={handleFetchFromVendors}
                  disabled={fetchingFromVendors}
                  loading={fetchingFromVendors}
                  variant="primary"
                  size="sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Fetch from Vendors
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-2">Total Models</div>
            <div className="text-3xl font-bold text-gray-900">{models.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-2">Active</div>
            <div className="text-3xl font-bold text-green-600">{models.filter(m => m.is_active !== false).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-2">Inactive</div>
            <div className="text-3xl font-bold text-red-600">{models.filter(m => m.is_active === false).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-gray-600 mb-2">With Structured Output</div>
            <div className="text-3xl font-bold text-blue-600">{models.filter(m => m.supports_structured_output === 'full').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Models Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50/50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-20">Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">Model ID</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-24">Provider</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-32">Pricing</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-28">Context</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-28">Output</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-20">Reasoning</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-20">Tier</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredModels.map((model) => (
                <tr 
                  key={model.id || `${model.provider}-${model.model_id}`} 
                  className={`hover:bg-gray-50/30 transition-colors ${model.is_active === false ? 'opacity-60' : ''}`}
                >
                  <td className="px-3 py-3">
                    <button
                      onClick={() => handleToggleActive(model)}
                      disabled={!model.id || savingModelId === model.id}
                      className="disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Badge
                        variant={model.is_active !== false ? 'success' : 'danger'}
                        size="sm"
                        className="text-[10px] px-1.5 py-0.5"
                      >
                        {savingModelId === model.id ? '...' : model.is_active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs font-medium text-gray-900 leading-tight">{model.model_id}</div>
                    {model.notes && (
                      <div className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[180px]" title={model.notes}>
                        {model.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" size="sm" className="text-[10px] px-1.5 py-0.5">
                      {model.provider}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    {model.cost_per_1k_tokens_input !== null || model.cost_per_1k_tokens_output !== null ? (
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-gray-900 leading-tight">
                          ${model.cost_per_1k_tokens_input?.toFixed(4) || 'N/A'} / ${model.cost_per_1k_tokens_output?.toFixed(4) || 'N/A'}
                        </div>
                        {model.vendor_synced_at && (
                          <div className="text-[10px] text-gray-400">
                            {new Date(model.vendor_synced_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {model.context_window ? (
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-gray-900 leading-tight">
                          {model.context_window.toLocaleString()}
                        </div>
                        {model.vendor_synced_at && (
                          <div className="text-[10px] text-gray-400">
                            {new Date(model.vendor_synced_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {getStructuredOutputBadge(model.supports_structured_output)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm">{model.supports_reasoning ? '✅' : '❌'}</span>
                  </td>
                  <td className="px-3 py-3">
                    {getTierBadge(model.tier)}
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      onClick={() => onEdit(model)}
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                    >
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredModels.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-xs">No models found matching your search.</p>
          </div>
        )}
      </Card>

      {/* Discovery Modal */}
      {showDiscoveryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <CardContent className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Discovered Models from Vendors
                  </h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Found {discoveredModels.length} models ({discoveredModels.filter(m => !m.already_configured).length} new, {discoveredModels.filter(m => m.already_configured).length} already configured)
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setShowDiscoveryModal(false)
                    setSelectedModels(new Set())
                  }}
                  variant="ghost"
                  size="icon"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>

              {/* Bulk Actions */}
              <Card variant="default" className="mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={discoveredModels.filter(m => !m.already_configured).length > 0 && 
                                   selectedModels.size === discoveredModels.filter(m => !m.already_configured).length}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Select All New Models ({selectedModels.size} selected)
                        </span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      {selectedModels.size > 0 && (
                        <Button
                          onClick={handleBulkImport}
                          disabled={importingModels}
                          loading={importingModels}
                          variant="primary"
                          size="sm"
                        >
                          Import Selected ({selectedModels.size})
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600 w-12">
                        <input
                          type="checkbox"
                          checked={discoveredModels.filter(m => !m.already_configured).length > 0 && 
                                   selectedModels.size === discoveredModels.filter(m => !m.already_configured).length}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600">Status</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600">Model ID</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600">Provider</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600">Name</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600">Category</th>
                      <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {discoveredModels.map((model, idx) => {
                      const modelKey = `${model.provider}:${model.model_id}`
                      const isSelected = selectedModels.has(modelKey)
                      const isConfigured = model.already_configured
                      
                      return (
                        <tr 
                          key={`${model.provider}-${model.model_id}-${idx}`} 
                          className={`hover:bg-gray-50/50 transition-colors ${
                            isConfigured ? 'bg-green-50/30' : ''
                          } ${isSelected ? 'bg-blue-50/50' : ''}`}
                        >
                          <td className="px-5 py-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleModelSelection(modelKey)}
                              disabled={isConfigured}
                              className="rounded border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-5 py-4">
                            {isConfigured ? (
                              <Badge variant="success" size="sm">✓ Configured</Badge>
                            ) : (
                              <Badge variant="primary" size="sm">New</Badge>
                            )}
                          </td>
                          <td className="px-5 py-4 font-mono text-xs">{model.model_id}</td>
                          <td className="px-5 py-4">
                            <Badge variant="outline" size="sm">{model.provider}</Badge>
                          </td>
                          <td className="px-5 py-4 text-sm">{model.name}</td>
                          <td className="px-5 py-4">
                            <Badge
                              variant={
                                model.category === 'production' ? 'success' :
                                model.category === 'preview' ? 'warning' :
                                'default'
                              }
                              size="sm"
                            >
                              {model.category}
                            </Badge>
                          </td>
                          <td className="px-5 py-4">
                            {isConfigured ? (
                              <span className="text-xs text-gray-400">Already configured</span>
                            ) : (
                              <Button
                                onClick={() => handleImportModel(model)}
                                variant="ghost"
                                size="sm"
                              >
                                Import
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {discoveredModels.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No models discovered. Make sure you have API keys configured.</p>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setShowDiscoveryModal(false)
                    setSelectedModels(new Set())
                  }}
                  variant="outline"
                  size="sm"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

