/**
 * Phase AG — authentication for Trip Planner API.
 * Reuses existing Supabase auth architecture via injectable resolver.
 */

import type { TripPlannerAuthUser } from './types'

export interface TripPlannerAuthResolver {
  /**
   * Resolve the authenticated user from an Authorization Bearer token.
   * Returns null when unauthenticated / invalid.
   */
  resolveUser(authorizationHeader: string | null): Promise<TripPlannerAuthUser | null>
}

/** Extract Bearer token value from Authorization header. */
export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim())
  if (!match?.[1]) return null
  const token = match[1].trim()
  return token.length > 0 ? token : null
}

/**
 * Default test/dev resolver: accepts tokens of the form `user:<userId>`.
 * Production wiring should inject a Supabase JWT resolver.
 */
export function createDevTokenAuthResolver(): TripPlannerAuthResolver {
  return {
    async resolveUser(authorizationHeader) {
      const token = extractBearerToken(authorizationHeader)
      if (!token) return null
      if (token.startsWith('user:')) {
        const id = token.slice('user:'.length).trim()
        if (!id) return null
        return { id, email: null, role: null }
      }
      return null
    },
  }
}

/**
 * Create a resolver that uses supabase.auth.getUser(jwt).
 * Injected from SPA/Edge when supabase client is available.
 */
export function createSupabaseJwtAuthResolver(getUser: (jwt: string) => Promise<{
  id: string
  email?: string | null
  role?: string | null
} | null>): TripPlannerAuthResolver {
  return {
    async resolveUser(authorizationHeader) {
      const token = extractBearerToken(authorizationHeader)
      if (!token) return null
      try {
        return await getUser(token)
      } catch {
        return null
      }
    },
  }
}

export function assertUserOwnsRequest(
  user: TripPlannerAuthUser,
  requestUserId: string,
): { ok: true } | { ok: false; code: string; error: string } {
  if (!requestUserId?.trim()) {
    return { ok: false, code: 'missing_user_id', error: 'Request userId is required.' }
  }
  if (user.id !== requestUserId) {
    return {
      ok: false,
      code: 'forbidden_user_mismatch',
      error: 'Authenticated user does not match request userId.',
    }
  }
  return { ok: true }
}
