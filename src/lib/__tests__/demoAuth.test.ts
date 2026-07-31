import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  __setDemoAuthEnabledForTests,
  clearDemoSession,
  createDemoSession,
  createDemoUser,
  DEMO_AUTH_STORAGE_KEY,
  DEMO_USER_EMAIL,
  isDemoAuthEnabled,
  readDemoSession,
  writeDemoSession,
} from '../auth/demoAuth'
import { authService } from '../auth/authService'

function installMemoryLocalStorage(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  })
}

describe('demo auth helpers', () => {
  beforeEach(() => {
    installMemoryLocalStorage()
    clearDemoSession()
    __setDemoAuthEnabledForTests(null)
  })

  afterEach(() => {
    clearDemoSession()
    __setDemoAuthEnabledForTests(null)
    vi.unstubAllGlobals()
  })

  it('is disabled unless VITE_DEMO_AUTH=true', () => {
    __setDemoAuthEnabledForTests(false)
    expect(isDemoAuthEnabled()).toBe(false)
    __setDemoAuthEnabledForTests(true)
    expect(isDemoAuthEnabled()).toBe(true)
  })

  it('stays disabled by default in vitest (VITE_DEMO_AUTH=false)', () => {
    __setDemoAuthEnabledForTests(null)
    expect(isDemoAuthEnabled()).toBe(false)
  })

  it('creates a stable demo user/session shape', () => {
    const user = createDemoUser()
    expect(user.email).toBe(DEMO_USER_EMAIL)
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/)
    const session = createDemoSession(user)
    expect(session.access_token).toBe('demo-access-token')
    expect(session.user.id).toBe(user.id)
  })

  it('persists and clears demo session only when enabled', () => {
    __setDemoAuthEnabledForTests(true)
    expect(readDemoSession()).toBeNull()
    writeDemoSession('planner@rahhal.local')
    expect(localStorage.getItem(DEMO_AUTH_STORAGE_KEY)).toContain('planner@rahhal.local')
    const restored = readDemoSession()
    expect(restored?.user.email).toBe('planner@rahhal.local')
    clearDemoSession()
    expect(readDemoSession()).toBeNull()
  })

  it('authService.signInDemo respects the flag', async () => {
    __setDemoAuthEnabledForTests(false)
    expect((await authService.signInDemo()).success).toBe(false)

    __setDemoAuthEnabledForTests(true)
    expect((await authService.signInDemo()).success).toBe(true)
    expect(readDemoSession()?.user.email).toBe(DEMO_USER_EMAIL)

    await authService.signOut()
    expect(readDemoSession()).toBeNull()
  })
})
