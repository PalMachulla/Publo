/**
 * Encryption utilities for securely storing API keys
 * Uses AES-256-GCM for authenticated encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

// Encryption key must be 32 bytes for AES-256
// In production, this should be stored in environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.NEXT_PUBLIC_ENCRYPTION_KEY

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is not set')
}

// Ensure the key is exactly 32 bytes (256 bits)
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex')

if (KEY_BUFFER.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)')
}

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // AES block size
const AUTH_TAG_LENGTH = 16 // GCM authentication tag length

/**
 * Encrypt an API key using AES-256-GCM
 * 
 * Returns format: iv:authTag:encryptedData (all hex-encoded)
 * 
 * @param plaintext - The API key to encrypt
 * @returns Encrypted string in format "iv:authTag:encrypted"
 */
export function encryptAPIKey(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Invalid plaintext: must be a non-empty string')
  }

  // Generate random initialization vector
  const iv = randomBytes(IV_LENGTH)
  
  // Create cipher
  const cipher = createCipheriv(ALGORITHM, KEY_BUFFER, iv)
  
  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // Get authentication tag (GCM mode)
  const authTag = cipher.getAuthTag()
  
  // Return as iv:authTag:encrypted (all hex-encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt an API key encrypted with encryptAPIKey()
 * 
 * @param ciphertext - Encrypted string in format "iv:authTag:encrypted"
 * @returns Decrypted API key
 */
export function decryptAPIKey(ciphertext: string): string {
  if (!ciphertext || typeof ciphertext !== 'string') {
    throw new Error('Invalid ciphertext: must be a non-empty string')
  }

  // Split the ciphertext into components
  const parts = ciphertext.split(':')
  
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format: expected "iv:authTag:encrypted"')
  }

  const [ivHex, authTagHex, encrypted] = parts
  
  // Convert from hex
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  
  // Validate lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`)
  }
  
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`)
  }
  
  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, KEY_BUFFER, iv)
  
  // Set authentication tag
  decipher.setAuthTag(authTag)
  
  // Decrypt
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Hash an API key using SHA-256
 * Used for deduplication checks without needing to decrypt
 * 
 * @param plaintext - The API key to hash
 * @returns SHA-256 hash (hex-encoded)
 */
export function hashAPIKey(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Invalid plaintext: must be a non-empty string')
  }

  return createHash('sha256').update(plaintext).digest('hex')
}

/**
 * Generate a secure random encryption key
 * Use this to generate the ENCRYPTION_KEY for your .env file
 * 
 * @returns 32-byte (256-bit) key as hex string
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Mask an API key for display purposes
 * Shows first 8 and last 4 characters, masks the rest
 * 
 * @param apiKey - The API key to mask
 * @returns Masked string like "sk-proj-••••••••••••3xYz"
 */
export function maskAPIKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) {
    return '••••••••••••••••'
  }

  const start = apiKey.substring(0, 8)
  const end = apiKey.substring(apiKey.length - 4)
  const maskedLength = Math.max(0, apiKey.length - 12)
  const masked = '•'.repeat(Math.min(maskedLength, 16))

  return `${start}${masked}${end}`
}

