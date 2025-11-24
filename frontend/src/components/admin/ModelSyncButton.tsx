'use client'

import { useState } from 'react'

interface SyncResult {
  success: boolean
  provider: string
  modelsFound: number
  newModels: string[]
  errors?: string[]
}

interface SyncResponse {
  success: boolean
  summary: {
    totalProviders: number
    successfulSyncs: number
    totalNewModels: number
    newModels: string[]
    errors?: any[]
  }
  results: SyncResult[]
  message: string
}

export default function ModelSyncButton() {
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<any>(null)
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check last sync on mount
  useState(() => {
    fetch('/api/models/sync')
      .then(res => res.json())
      .then(data => {
        if (data.lastSync) {
          setLastSync(data.lastSync)
        }
      })
      .catch(err => console.error('Failed to fetch sync status:', err))
  })

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setSyncResult(null)

    try {
      const response = await fetch('/api/models/sync', {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed')
      }

      setSyncResult(data)
      setLastSync({
        synced_at: new Date().toISOString(),
        total_new_models: data.summary.totalNewModels
      })

      // Refresh the page to show new models
      if (data.summary.totalNewModels > 0) {
        setTimeout(() => {
          window.location.reload()
        }, 3000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Model Sync</h3>
          <p className="text-sm text-gray-500 mt-1">
            Sync latest models from vendor APIs
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            syncing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {syncing ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Syncing...
            </span>
          ) : (
            '🔄 Sync Now'
          )}
        </button>
      </div>

      {/* Last Sync Info */}
      {lastSync && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Last synced:</span>
            <span className="font-medium text-gray-900">
              {new Date(lastSync.synced_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          {lastSync.total_new_models > 0 && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-600">New models found:</span>
              <span className="font-medium text-green-600">
                {lastSync.total_new_models}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sync Result */}
      {syncResult && (
        <div className={`p-4 rounded-lg ${
          syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">
              {syncResult.success ? '✅' : '❌'}
            </span>
            <div className="flex-1">
              <p className={`font-medium ${
                syncResult.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {syncResult.message}
              </p>
              
              {syncResult.success && syncResult.summary.totalNewModels > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-green-800">New Models:</p>
                  <ul className="text-sm text-green-700 space-y-1">
                    {syncResult.summary.newModels.map((model, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                        <code className="bg-green-100 px-2 py-0.5 rounded text-xs">
                          {model}
                        </code>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-green-600 mt-2">
                    🔄 Refreshing page in 3 seconds...
                  </p>
                </div>
              )}

              {syncResult.success && syncResult.summary.totalNewModels === 0 && (
                <p className="text-sm text-green-700 mt-1">
                  All your models are up to date!
                </p>
              )}

              {/* Provider Results */}
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-gray-700">Sync Details:</p>
                <div className="grid grid-cols-2 gap-2">
                  {syncResult.results.map((result, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded text-xs ${
                        result.success ? 'bg-white' : 'bg-red-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{result.provider}</span>
                        <span className={result.success ? 'text-green-600' : 'text-red-600'}>
                          {result.success ? '✓' : '✗'}
                        </span>
                      </div>
                      <div className="text-gray-600 mt-1">
                        {result.modelsFound} models found
                      </div>
                      {result.newModels.length > 0 && (
                        <div className="text-green-600 font-medium mt-1">
                          +{result.newModels.length} new
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">❌</span>
            <div>
              <p className="font-medium text-red-900">Sync Failed</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-blue-600">ℹ️</span>
          <div className="text-xs text-blue-800">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Fetches latest models from your configured API providers</li>
              <li>Compares against our catalog to find new models</li>
              <li>Updates your model cache automatically</li>
              <li>Recommended: Sync monthly or when vendors announce new models</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

