/**
 * Input validation and sanitization utilities
 * Provides type guards and validation functions for user inputs
 */

/**
 * Validates that a string is non-empty after trimming
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Validates that a string is within length constraints
 */
export function isValidLength(
  value: string,
  min: number = 0,
  max: number = Infinity
): boolean {
  const length = value.trim().length
  return length >= min && length <= max
}

/**
 * Sanitizes a string by trimming and limiting length
 */
export function sanitizeString(
  value: string,
  maxLength: number = 10000
): string {
  return value.trim().slice(0, maxLength)
}

/**
 * Validates email format (basic check)
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validates that value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && !isNaN(value)
}

/**
 * Validates that value is a non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && !isNaN(value)
}

/**
 * Type guard for string arrays
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

/**
 * Type guard for objects (non-null, non-array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validates and sanitizes a node label
 */
export function validateNodeLabel(label: unknown): string {
  if (!isNonEmptyString(label)) {
    throw new Error('Label must be a non-empty string')
  }
  
  const sanitized = sanitizeString(label, 200)
  
  if (!isValidLength(sanitized, 1, 200)) {
    throw new Error('Label must be between 1 and 200 characters')
  }
  
  return sanitized
}

/**
 * Validates and sanitizes a description
 */
export function validateDescription(description: unknown): string {
  if (typeof description !== 'string') {
    return ''
  }
  
  return sanitizeString(description, 2000)
}

/**
 * Validates user input to prevent XSS attempts
 * Rejects inputs containing script tags or javascript: protocols
 */
export function containsDangerousContent(input: string): boolean {
  const dangerous = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // event handlers like onclick=
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ]
  
  return dangerous.some(pattern => pattern.test(input))
}

/**
 * Validates user input is safe before processing
 */
export function validateSafeInput(input: string): string {
  if (containsDangerousContent(input)) {
    throw new Error('Input contains potentially dangerous content')
  }
  
  return input
}

/**
 * Validates a UUID format
 */
export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

/**
 * Validates an array has at least one element
 */
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0
}

