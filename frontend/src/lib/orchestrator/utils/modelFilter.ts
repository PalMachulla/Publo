/**
 * Model Filtering Utilities
 * 
 * Filters and validates available models based on metadata (deprecated, inactive, etc.)
 */

import type { TieredModel } from '../core/modelRouter'

/**
 * Filter out deprecated and inactive models
 * 
 * @param models - Array of available models
 * @returns Filtered array with only active, non-deprecated models
 */
export function filterAvailableModels(models: TieredModel[]): TieredModel[] {
  return models.filter(m => {
    // Filter out deprecated models
    const vendorCategory = (m as any).vendor_category
    if (vendorCategory === 'deprecated') {
      console.log(`⚠️ [ModelFilter] Filtering out deprecated model: ${m.id}`)
      return false
    }
    
    // Filter out inactive models
    const isActive = (m as any).available !== false
    if (isActive === false) {
      console.log(`⚠️ [ModelFilter] Filtering out inactive model: ${m.id}`)
      return false
    }
    
    return true
  })
}

