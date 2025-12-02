/**
 * Error Utilities
 * 
 * Extracts human-readable error messages from API errors
 */

/**
 * Extract human-readable error reason from API error
 * 
 * @param error - Error object from API call
 * @returns Human-readable error message
 */
export function extractErrorReason(error: any): string {
  const message = error.message || ''
  
  if (message.includes('insufficient_quota') || message.includes('quota')) {
    return 'Insufficient credits'
  }
  if (message.includes('does not exist') || message.includes('not found')) {
    return 'Model not available'
  }
  if (message.includes('rate_limit') || message.includes('429')) {
    return 'Rate limit exceeded'
  }
  if (message.includes('authentication') || message.includes('401')) {
    return 'Invalid API key'
  }
  if (message.includes('access') || message.includes('permission')) {
    return 'No access to this model'
  }
  if (message.includes('500')) {
    return 'Server error (model might not be available)'
  }
  
  return message.substring(0, 100) // Truncate long messages
}

