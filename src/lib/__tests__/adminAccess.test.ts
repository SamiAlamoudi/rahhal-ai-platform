import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { isAdminUser } from '../auth/adminAccess'

function user(partial: Partial<User> & { id: string }): User {
  return {
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  } as User
}

describe('isAdminUser', () => {
  const originalEnv = { ...import.meta.env }

  beforeEach(() => {
    vi.stubEnv('VITE_ADMIN_USER_IDS', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    Object.assign(import.meta.env, originalEnv)
  })

  it('returns false for null user', () => {
    expect(isAdminUser(null)).toBe(false)
  })

  it('returns true when app_metadata.role is admin', () => {
    expect(isAdminUser(user({
      id: 'u-1',
      app_metadata: { role: 'admin' },
    }))).toBe(true)
  })

  it('returns true when user id is in VITE_ADMIN_USER_IDS', () => {
    vi.stubEnv('VITE_ADMIN_USER_IDS', 'aaa, bbb ,ccc')
    expect(isAdminUser(user({ id: 'bbb', app_metadata: {} }))).toBe(true)
    expect(isAdminUser(user({ id: 'zzz', app_metadata: {} }))).toBe(false)
  })

  it('returns false for regular users without allowlist', () => {
    expect(isAdminUser(user({ id: 'u-2', app_metadata: { role: 'user' } }))).toBe(false)
  })
})
