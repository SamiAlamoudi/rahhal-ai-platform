import type { User } from '@supabase/supabase-js'

function adminUserIdsFromEnv(): string[] {
  const raw = import.meta.env.VITE_ADMIN_USER_IDS as string | undefined
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

/**
 * Admin if `user.app_metadata.role === 'admin'` or user.id is listed in
 * comma-separated `VITE_ADMIN_USER_IDS`.
 */
export function isAdminUser(user: User | null): boolean {
  if (!user) return false
  const role = (user.app_metadata as { role?: unknown } | undefined)?.role
  if (role === 'admin') return true
  return adminUserIdsFromEnv().includes(user.id)
}
