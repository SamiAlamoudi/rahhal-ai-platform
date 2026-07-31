/**
 * Sprint 79 — production validation matrix for P0 security + product spines.
 * Complements suite coverage; keeps Edge auth/CORS/rate-limit contracts explicit.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  __resetEdgeRateLimitsForTests,
  buildCorsHeaders,
  checkEdgeRateLimit,
  guardEdgeRequest,
  readServerOpenAiApiKey,
  resolveCorsAllowlist,
  verifySupabaseAccessToken,
} from '../../../api/_lib/edgeGuard'

const PROD_ORIGIN = 'https://rahhal-ai-platform.vercel.app'
const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  OPENAI_API_KEY: 'sk-server-only',
}

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://rahhal-ai-platform.vercel.app${path}`, init)
}

describe('Sprint 79 production validation — auth matrix', () => {
  beforeEach(() => {
    __resetEdgeRateLimitsForTests()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    __resetEdgeRateLimitsForTests()
  })

  it('rejects anonymous requests (no Authorization)', async () => {
    const gate = await guardEdgeRequest(
      req('/api/openai/chat', { method: 'POST', headers: { Origin: PROD_ORIGIN } }),
      { bucket: 'val.anon', limit: 30, env: ENV },
    )
    expect(gate.ok).toBe(false)
    if (!gate.ok) {
      expect(gate.response.status).toBe(401)
      const body = await gate.response.json() as { code?: string }
      expect(body.code).toBe('AUTH_REQUIRED')
    }
  })

  it('rejects invalid JWT (Auth API 401)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"msg":"invalid"}', { status: 401 })))
    const gate = await guardEdgeRequest(
      req('/api/openai/tts', {
        method: 'POST',
        headers: { Origin: PROD_ORIGIN, Authorization: 'Bearer invalid.jwt.token' },
      }),
      { bucket: 'val.invalid', limit: 30, env: ENV },
    )
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.response.status).toBe(401)
  })

  it('rejects expired JWT (Auth API 401/403)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"msg":"expired"}', { status: 403 })))
    const verified = await verifySupabaseAccessToken('expired.jwt', ENV)
    expect(verified).toEqual({ error: 'invalid_token' })
  })

  it('rejects demo JWT tokens', async () => {
    const verified = await verifySupabaseAccessToken('demo-access-token', ENV)
    expect(verified).toEqual({ error: 'anonymous_or_demo_token' })
  })

  it('accepts logged-in request with valid Supabase user JWT', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }), { status: 200 }),
    ))
    const gate = await guardEdgeRequest(
      req('/api/amadeus-token', {
        method: 'POST',
        headers: { Origin: PROD_ORIGIN, Authorization: 'Bearer valid.user.jwt' },
      }),
      { bucket: 'val.ok', limit: 10, env: ENV },
    )
    expect(gate.ok).toBe(true)
    if (gate.ok) expect(gate.userId).toBe('11111111-1111-4111-8111-111111111111')
  })
})

describe('Sprint 79 production validation — rate limiting', () => {
  beforeEach(() => __resetEdgeRateLimitsForTests())
  afterEach(() => {
    vi.unstubAllGlobals()
    __resetEdgeRateLimitsForTests()
  })

  it('rate-limits after N requests in the window', () => {
    expect(checkEdgeRateLimit('val.rl', 3)).toBe(true)
    expect(checkEdgeRateLimit('val.rl', 3)).toBe(true)
    expect(checkEdgeRateLimit('val.rl', 3)).toBe(true)
    expect(checkEdgeRateLimit('val.rl', 3)).toBe(false)
  })

  it('returns HTTP 429 from guard when over limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ id: 'user-rl' }), { status: 200 }),
    ))
    const make = () => guardEdgeRequest(
      req('/api/openai/chat', {
        method: 'POST',
        headers: { Origin: PROD_ORIGIN, Authorization: 'Bearer jwt' },
      }),
      { bucket: 'val.rl.guard', limit: 2, env: ENV },
    )
    expect((await make()).ok).toBe(true)
    expect((await make()).ok).toBe(true)
    const blocked = await make()
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) {
      expect(blocked.response.status).toBe(429)
      expect(blocked.response.headers.get('Retry-After')).toBe('60')
    }
  })
})

describe('Sprint 79 production validation — CORS', () => {
  it('allowlists the production domain', () => {
    const list = resolveCorsAllowlist({})
    expect(list).toContain(PROD_ORIGIN)
  })

  it('allows requests from production Origin', () => {
    const { allowed, headers } = buildCorsHeaders(
      req('/api/openai/chat', { headers: { Origin: PROD_ORIGIN } }),
      {},
    )
    expect(allowed).toBe(true)
    expect(headers['Access-Control-Allow-Origin']).toBe(PROD_ORIGIN)
    expect(headers['Access-Control-Allow-Origin']).not.toBe('*')
  })

  it('rejects foreign Origin', () => {
    const { allowed, headers } = buildCorsHeaders(
      req('/api/openai/chat', { headers: { Origin: 'https://evil.example' } }),
      {},
    )
    expect(allowed).toBe(false)
    expect(headers['Access-Control-Allow-Origin']).toBe('null')
  })

  it('keeps localhost for development', () => {
    const { allowed, headers } = buildCorsHeaders(
      req('/api/openai/chat', { headers: { Origin: 'http://localhost:5173' } }),
      {},
    )
    expect(allowed).toBe(true)
    expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173')
  })
})

describe('Sprint 79 production validation — secret posture', () => {
  it('never prefers VITE_ OpenAI keys on the server', () => {
    expect(readServerOpenAiApiKey({
      OPENAI_API_KEY: 'sk-server',
      VITE_OPENAI_API_KEY: 'sk-vite',
      VITE_AGENT_OPENAI_API_KEY: 'sk-agent',
    })).toBe('sk-server')
    expect(readServerOpenAiApiKey({
      VITE_OPENAI_API_KEY: 'sk-vite',
    })).toBeNull()
  })
})
