/**
 * Sanitizes and validates URLs to prevent XSS and malicious redirects
 * Only allows safe protocols: https, http, mailto, tel
 */

const ALLOWED_PROTOCOLS = ['https:', 'http:', 'mailto:', 'tel:']

/**
 * Validates and sanitizes a URL string
 * @param url - The URL to validate
 * @param allowedProtocols - Optional override for allowed protocols
 * @returns Sanitized URL or null if invalid
 */
export function sanitizeUrl(
  url: string,
  allowedProtocols: string[] = ALLOWED_PROTOCOLS
): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  // Trim whitespace
  const trimmedUrl = url.trim()

  // Reject empty strings
  if (trimmedUrl.length === 0) {
    return null
  }

  // Reject javascript: and data: protocols explicitly
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:']
  const lowerUrl = trimmedUrl.toLowerCase()
  
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      console.warn(`Blocked dangerous protocol in URL: ${protocol}`)
      return null
    }
  }

  try {
    const parsed = new URL(trimmedUrl)
    
    // Check if protocol is allowed
    if (!allowedProtocols.includes(parsed.protocol)) {
      console.warn(`Blocked disallowed protocol: ${parsed.protocol}`)
      return null
    }

    // Return the sanitized URL
    return parsed.href
  } catch (error) {
    // If URL parsing fails, try adding https:// prefix
    try {
      const withProtocol = `https://${trimmedUrl}`
      const parsed = new URL(withProtocol)
      
      if (allowedProtocols.includes(parsed.protocol)) {
        return parsed.href
      }
    } catch {
      // If still fails, return null
    }
    
    console.warn(`Invalid URL format: ${trimmedUrl}`)
    return null
  }
}

/**
 * Validates and sanitizes an array of URLs
 * @param urls - Array of URLs to validate
 * @returns Array of sanitized URLs (filtered to remove nulls)
 */
export function sanitizeUrls(urls: string[]): string[] {
  if (!Array.isArray(urls)) {
    return []
  }

  return urls
    .map(url => sanitizeUrl(url))
    .filter((url): url is string => url !== null)
}

/**
 * Checks if a URL is safe without sanitizing
 * @param url - The URL to check
 * @returns true if URL is safe, false otherwise
 */
export function isUrlSafe(url: string): boolean {
  return sanitizeUrl(url) !== null
}

/**
 * Sanitizes a URL for external links (only allows https)
 * More restrictive than general sanitizeUrl
 * @param url - The URL to validate
 * @returns Sanitized HTTPS URL or null
 */
export function sanitizeExternalUrl(url: string): string | null {
  return sanitizeUrl(url, ['https:'])
}

