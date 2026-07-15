/**
 * Phase AG — Trip Planner API client.
 *
 * Default: in-process thin HTTP handler → TripPlannerService.
 * Optional: Supabase Edge Function transport when baseUrl is provided.
 */

import {
  createTripPlannerHttpHandler,
  createDevTokenAuthResolver,
  createSupabaseJwtAuthResolver,
  type TripPlannerHttpHandlerOptions,
} from '../../lib/ai/tripPlanner/http'
import type { TripPlannerRequest, TripPlannerResult } from '../../lib/ai/tripPlanner/models'
import { supabase } from '../../lib/supabaseClient'

export type TripPlannerApiTransport = 'in_process' | 'edge'

export interface TripPlannerApiClientOptions {
  transport?: TripPlannerApiTransport
  /** Edge Function base, e.g. `${VITE_SUPABASE_URL}/functions/v1/trip-planner` */
  edgeBaseUrl?: string
  /** Supabase anon/session access token getter for Edge calls. */
  getAccessToken?: () => Promise<string | null>
  handlerOptions?: TripPlannerHttpHandlerOptions
}

export interface TripPlannerApiClient {
  health(): Promise<{ ok: boolean; status: number; body: unknown }>
  plan(request: TripPlannerRequest): Promise<{
    ok: boolean
    status: number
    result: TripPlannerResult | null
    error: { code: string; error: string } | null
  }>
  getResult(query: {
    idempotencyKey?: string
    requestId?: string
    /** Required for in-process auth when using the dev token resolver. */
    userId?: string
  }): Promise<{
    ok: boolean
    status: number
    result: TripPlannerResult | null
    error: { code: string; error: string } | null
  }>
}

function createDefaultSupabaseAuthResolver() {
  return createSupabaseJwtAuthResolver(async (jwt) => {
    const { data, error } = await supabase.auth.getUser(jwt)
    if (error || !data.user) return null
    const role =
      typeof data.user.app_metadata?.role === 'string'
        ? data.user.app_metadata.role
        : null
    return { id: data.user.id, email: data.user.email ?? null, role }
  })
}

export function createTripPlannerApiClient(
  options: TripPlannerApiClientOptions = {},
): TripPlannerApiClient {
  const transport = options.transport ?? 'in_process'
  const handler = createTripPlannerHttpHandler({
    authResolver: createDevTokenAuthResolver(),
    ...options.handlerOptions,
  })

  async function edgeFetch(path: string, init: RequestInit): Promise<Response> {
    const base = (options.edgeBaseUrl ?? '').replace(/\/$/, '')
    if (!base) {
      throw new Error('edgeBaseUrl is required for edge transport')
    }
    const token =
      (await options.getAccessToken?.()) ??
      (await supabase.auth.getSession()).data.session?.access_token ??
      null
    const headers = new Headers(init.headers)
    headers.set('Content-Type', 'application/json')
    headers.set('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY ?? '')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(`${base}${path}`, { ...init, headers })
  }

  async function inProcess(
    path: string,
    init: RequestInit & { tokenUserId?: string },
  ): Promise<Response> {
    const headers = new Headers(init.headers)
    if (init.tokenUserId) {
      headers.set('Authorization', `Bearer user:${init.tokenUserId}`)
    }
    return handler(
      new Request(`https://trip-planner.local${path}`, {
        method: init.method,
        headers,
        body: init.body,
        signal: init.signal,
      }),
    )
  }

  return {
    async health() {
      const res =
        transport === 'edge'
          ? await edgeFetch('/health', { method: 'GET' })
          : await inProcess('/health', { method: 'GET' })
      const body = await res.json().catch(() => ({}))
      return { ok: res.ok, status: res.status, body }
    },

    async plan(request) {
      const res =
        transport === 'edge'
          ? await edgeFetch('', {
              method: 'POST',
              body: JSON.stringify({ action: 'plan', request }),
            })
          : await inProcess('', {
              method: 'POST',
              tokenUserId: request.userId,
              body: JSON.stringify({ action: 'plan', request }),
            })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: TripPlannerResult
        error?: string
        code?: string
      }
      if (!res.ok || !body.result) {
        return {
          ok: false,
          status: res.status,
          result: null,
          error: {
            code: body.code ?? 'api_error',
            error: body.error ?? 'Trip planner API request failed.',
          },
        }
      }
      return { ok: true, status: res.status, result: body.result, error: null }
    },

    async getResult(query) {
      const params = new URLSearchParams()
      if (query.idempotencyKey) params.set('idempotencyKey', query.idempotencyKey)
      if (query.requestId) params.set('requestId', query.requestId)
      const path = `/result?${params.toString()}`
      const res =
        transport === 'edge'
          ? await edgeFetch(path, { method: 'GET' })
          : await inProcess(path, {
              method: 'GET',
              tokenUserId: query.userId,
            })
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        result?: TripPlannerResult
        error?: string
        code?: string
      }
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          result: null,
          error: {
            code: body.code ?? 'api_error',
            error: body.error ?? 'Trip planner result not found.',
          },
        }
      }
      return { ok: true, status: res.status, result: body.result ?? null, error: null }
    },
  }
}

/** Convenience: SPA client with Supabase JWT auth resolver for in-process host. */
export function createAuthenticatedTripPlannerApiClient(
  options: TripPlannerApiClientOptions = {},
): TripPlannerApiClient {
  return createTripPlannerApiClient({
    ...options,
    handlerOptions: {
      authResolver: createDefaultSupabaseAuthResolver(),
      ...options.handlerOptions,
    },
  })
}
