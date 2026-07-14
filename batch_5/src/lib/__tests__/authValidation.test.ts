import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePassword,
  validateSignUpForm,
  validateSignInForm,
  mapAuthErrorMessage,
} from '../auth/authValidation'

describe('Auth Validation: validateEmail', () => {
  it('rejects empty email', () => {
    expect(validateEmail('')).not.toBeNull()
  })
  it('rejects malformed email', () => {
    expect(validateEmail('notanemail')).not.toBeNull()
    expect(validateEmail('a@b')).not.toBeNull()
    expect(validateEmail('a@.com')).not.toBeNull()
  })
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBeNull()
    expect(validateEmail('test.user@domain.co')).toBeNull()
  })
})

describe('Auth Validation: validatePassword', () => {
  it('rejects empty password', () => {
    expect(validatePassword('')).not.toBeNull()
  })
  it('rejects short password', () => {
    expect(validatePassword('12345')).not.toBeNull()
  })
  it('accepts valid password', () => {
    expect(validatePassword('secret123')).toBeNull()
  })
})

describe('Auth Validation: validateSignUpForm', () => {
  it('returns errors for empty form', () => {
    const errors = validateSignUpForm('', '', '')
    expect(errors.length).toBeGreaterThan(0)
  })
  it('returns error for mismatched passwords', () => {
    const errors = validateSignUpForm('user@test.com', 'password1', 'password2')
    const confirmError = errors.find(e => e.field === 'confirmPassword')
    expect(confirmError).toBeDefined()
  })
  it('returns no errors for valid form', () => {
    const errors = validateSignUpForm('user@test.com', 'password1', 'password1')
    expect(errors.length).toBe(0)
  })
})

describe('Auth Validation: validateSignInForm', () => {
  it('returns errors for empty form', () => {
    const errors = validateSignInForm('', '')
    expect(errors.length).toBe(2)
  })
  it('returns no errors for valid form', () => {
    const errors = validateSignInForm('user@test.com', 'password1')
    expect(errors.length).toBe(0)
  })
})

describe('Auth: mapAuthErrorMessage', () => {
  it('maps invalid login credentials', () => {
    expect(mapAuthErrorMessage({ message: 'Invalid login credentials' })).toContain('غير صحيحة')
  })
  it('maps user already registered', () => {
    expect(mapAuthErrorMessage({ message: 'User already registered' })).toContain('مسجل')
  })
  it('maps rate limit', () => {
    expect(mapAuthErrorMessage({ message: 'rate limit exceeded' })).toContain('لاحقاً')
  })
  it('passes through unknown errors', () => {
    expect(mapAuthErrorMessage({ message: 'something weird' })).toBe('something weird')
  })
  it('handles non-object errors', () => {
    expect(mapAuthErrorMessage(null)).toContain('غير متوقع')
  })
})
