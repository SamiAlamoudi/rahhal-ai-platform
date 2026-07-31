/**
 * Client helper — attach Supabase user JWT to same-origin / Edge proxy calls.
 * Demo sessions are rejected (they are not real JWTs).
 */

import { supabase } from '../supabaseClient'

/** @internal Vitest helper — do not use in app code. */
let proxyTokenOverride: string | null | undefined

/** @internal Vitest helper — do not use in app code. */
export function __setProxyAccessTokenForTests(token: string | null | undefined): void {
  proxyTokenOverride = token
}

export async function getProxyAccessToken(): Promise<string | null> {
  if (proxyTokenOverride !== undefined) return proxyTokenOverride
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) return null
    const token = data.session?.access_token ?? null
    if (!token || token === 'demo-access-token' || token.startsWith('demo-')) return null
    return token
  } catch {
    return null
  }
}

/** Build headers with Authorization Bearer user JWT. Throws if unsigned-in / demo. */
export async function requireProxyAuthHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const token = await getProxyAccessToken()
  if (!token) {
    throw new Error('auth_required')
  }
  return {
    ...extra,
    Authorization: `Bearer ${token}`,
  }
}
