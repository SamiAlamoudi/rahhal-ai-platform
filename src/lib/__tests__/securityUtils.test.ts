import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateOwnership,
  sanitizeInput,
  validateDestination,
  validateSessionData,
  checkRateLimit,
  clearRateLimit,
} from '../security/securityUtils'

describe('Security: validateOwnership', () => {
  it('denies when no current user', () => {
    const result = validateOwnership('user-1', undefined)
    expect(result.hasOwnership).toBe(false)
    expect(result.error).not.toBeNull()
  })
  it('denies when user ids differ', () => {
    const result = validateOwnership('user-1', 'user-2')
    expect(result.hasOwnership).toBe(false)
  })
  it('allows when user ids match', () => {
    const result = validateOwnership('user-1', 'user-1')
    expect(result.hasOwnership).toBe(true)
    expect(result.error).toBeNull()
  })
})

describe('Security: sanitizeInput', () => {
  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })
  it('truncates long input', () => {
    const long = 'a'.repeat(2000)
    expect(sanitizeInput(long).length).toBe(1000)
  })
})

describe('Security: validateDestination', () => {
  it('rejects empty destination', () => {
    expect(validateDestination('')).not.toBeNull()
  })
  it('rejects too long destination', () => {
    expect(validateDestination('a'.repeat(201))).not.toBeNull()
  })
  it('accepts valid destination', () => {
    expect(validateDestination('Japan')).toBeNull()
  })
})

describe('Security: validateSessionData', () => {
  it('rejects null', () => {
    expect(validateSessionData(null)).toBe(false)
  })
  it('rejects non-object', () => {
    expect(validateSessionData('string')).toBe(false)
  })
  it('accepts object', () => {
    expect(validateSessionData({ destination: 'Japan' })).toBe(true)
  })
})

describe('Security: checkRateLimit', () => {
  beforeEach(() => {
    clearRateLimit('test-key')
  })

  it('allows first request', () => {
    expect(checkRateLimit('test-key', 5)).toBe(true)
  })
  it('blocks after exceeding limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('test-key', 5)).toBe(true)
    }
    expect(checkRateLimit('test-key', 5)).toBe(false)
  })
  it('uses separate keys independently', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('key-a', 5)
    expect(checkRateLimit('key-a', 5)).toBe(false)
    expect(checkRateLimit('key-b', 5)).toBe(true)
  })
})
