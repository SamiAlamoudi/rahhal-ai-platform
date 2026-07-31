/**
 * Local-only demo auth for development / RC verification without Supabase.
 * Enabled only when VITE_DEMO_AUTH=true in non-production builds.
 * Sprint 79 P0: hard-disabled in production bundles (import.meta.env.PROD).
 */
import type { Session, User } from '@supabase/supabase-js'

export const DEMO_AUTH_STORAGE_KEY = 'rahhal_demo_auth_v1'
export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'
export const DEMO_USER_EMAIL = 'demo@rahhal.local'

/** Test-only override; null means read env. */
let demoAuthOverride: boolean | null = null

/** @internal Vitest helper — do not use in app code. */
export function __setDemoAuthEnabledForTests(value: boolean | null): void {
  demoAuthOverride = value
}

export function isDemoAuthEnabled(): boolean {
  if (demoAuthOverride !== null) return demoAuthOverride
  // Production builds never honor demo auth — even if VITE_DEMO_AUTH leaked into env.
  if (import.meta.env.PROD) return false
  return import.meta.env.VITE_DEMO_AUTH === 'true'
}

export function createDemoUser(email = DEMO_USER_EMAIL): User {
  const now = new Date().toISOString()
  return {
    id: DEMO_USER_ID,
    app_metadata: { provider: 'demo', providers: ['demo'] },
    user_metadata: { full_name: 'مستخدم تجريبي', fullName: 'مستخدم تجريبي' },
    aud: 'authenticated',
    created_at: now,
    email,
    email_confirmed_at: now,
    phone: '',
    confirmed_at: now,
    last_sign_in_at: now,
    role: 'authenticated',
    updated_at: now,
    identities: [],
    is_anonymous: false,
    factors: [],
  } as User
}

export function createDemoSession(user: User = createDemoUser()): Session {
  const now = Math.floor(Date.now() / 1000)
  return {
    access_token: 'demo-access-token',
    refresh_token: 'demo-refresh-token',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24,
    expires_at: now + 60 * 60 * 24,
    user,
  } as Session
}

export function readDemoSession(): Session | null {
  if (!isDemoAuthEnabled() || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(DEMO_AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { email?: string }
    return createDemoSession(createDemoUser(parsed.email || DEMO_USER_EMAIL))
  } catch {
    return null
  }
}

export function writeDemoSession(email = DEMO_USER_EMAIL): Session {
  const session = createDemoSession(createDemoUser(email))
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DEMO_AUTH_STORAGE_KEY, JSON.stringify({ email }))
  }
  return session
}

export function clearDemoSession(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(DEMO_AUTH_STORAGE_KEY)
  }
}
