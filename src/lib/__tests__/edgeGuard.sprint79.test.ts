import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  __resetEdgeRateLimitsForTests,
  buildCorsHeaders,
  checkEdgeRateLimit,
  guardEdgeRequest,
  isAllowedVercelPreviewOrigin,
  readServerOpenAiApiKey,
  resolveCorsAllowlist,
  verifySupabaseAccessToken,
} from '../../../api/_lib/edgeGuard'

describe('Sprint 79 P0 edgeGuard', () => {
  beforeEach(() => {
    __resetEdgeRateLimitsForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetEdgeRateLimitsForTests()
  })

  it('allowlists production + localhost origins', () => {
    const list = resolveCorsAllowlist({})
    expect(list).toContain('https://rahhal-ai-platform.vercel.app')
    expect(list).toContain('http://localhost:5173')
    expect(list).toContain('http://127.0.0.1:5173')
  })

  it('rejects disallowed Origin', () => {
    const req = new Request('https://rahhal-ai-platform.vercel.app/api/openai/chat', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    })
    const { allowed, headers } = buildCorsHeaders(req, {})
    expect(allowed).toBe(false)
    expect(headers['Access-Control-Allow-Origin']).toBe('null')
  })

  it('allows listed Origin', () => {
    const req = new Request('https://rahhal-ai-platform.vercel.app/api/openai/chat', {
      method: 'POST',
      headers: { Origin: 'https://rahhal-ai-platform.vercel.app' },
    })
    const { allowed, headers } = buildCorsHeaders(req, {})
    expect(allowed).toBe(true)
    expect(headers['Access-Control-Allow-Origin']).toBe('https://rahhal-ai-platform.vercel.app')
  })

  it('allows Vercel Preview git-alias Origin (P0 CORS)', () => {
    const prod = 'https://rahhal-ai-platform.vercel.app'
    const prodHost = new URL(prod).hostname
    const prodBase = prodHost.replace(/\.vercel\.app$/, '')
    const projectBase = prodBase.replace(/platform$/, 'project')
    const preview = `https://${prodBase}-git-cursor-bilamo-s-3bb9d3-${projectBase}.vercel.app`
    expect(isAllowedVercelPreviewOrigin(preview)).toBe(true)
    expect(isAllowedVercelPreviewOrigin('https://evil.vercel.app')).toBe(false)
    expect(isAllowedVercelPreviewOrigin(`http://${projectBase}.vercel.app`)).toBe(false)

    const req = new Request(`${preview}/api/openai/realtime-call`, {
      method: 'POST',
      headers: { Origin: preview },
    })
    const { allowed, headers } = buildCorsHeaders(req, {})
    expect(allowed).toBe(true)
    expect(headers['Access-Control-Allow-Origin']).toBe(preview)
  })

  it('includes VERCEL_BRANCH_URL in allowlist', () => {
    const prod = 'https://rahhal-ai-platform.vercel.app'
    const prodHost = new URL(prod).hostname
    const prodBase = prodHost.replace(/\.vercel\.app$/, '')
    const projectBase = prodBase.replace(/platform$/, 'project')
    const branchHost = `${prodBase}-git-cursor-bilamo-s-3bb9d3-${projectBase}.vercel.app`
    const list = resolveCorsAllowlist({
      VERCEL_BRANCH_URL: branchHost,
    })
    expect(list).toContain(`https://${branchHost}`)
  })

  it('returns CORS_ORIGIN_DENIED code for blocked Origin', async () => {
    const gate = await guardEdgeRequest(
      new Request('https://rahhal-ai-platform.vercel.app/api/openai/tts', {
        method: 'POST',
        headers: {
          Origin: 'https://evil.example',
          Authorization: 'Bearer real-jwt',
        },
      }),
      {
        bucket: 'test.cors',
        limit: 10,
        env: {
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_ANON_KEY: 'anon',
        },
      },
    )
    expect(gate.ok).toBe(false)
    if (!gate.ok) {
      expect(gate.response.status).toBe(403)
      const body = await gate.response.json() as { code?: string }
      expect(body.code).toBe('CORS_ORIGIN_DENIED')
    }
  })

  it('reads only server OPENAI_API_KEY (never VITE_*)', () => {
    expect(readServerOpenAiApiKey({
      OPENAI_API_KEY: 'sk-live',
      VITE_OPENAI_API_KEY: 'sk-vite',
      VITE_AGENT_OPENAI_API_KEY: 'sk-agent',
    })).toBe('sk-live')
    expect(readServerOpenAiApiKey({
      VITE_OPENAI_API_KEY: 'sk-vite',
      VITE_AGENT_OPENAI_API_KEY: 'sk-agent',
    })).toBeNull()
  })

  it('rejects anonymous and demo tokens before upstream', async () => {
    const anon = await guardEdgeRequest(
      new Request('https://rahhal-ai-platform.vercel.app/api/openai/chat', { method: 'POST' }),
      { bucket: 'test.anon', limit: 10, env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' } },
    )
    expect(anon.ok).toBe(false)
    if (!anon.ok) expect(anon.response.status).toBe(401)

    const demo = await guardEdgeRequest(
      new Request('https://rahhal-ai-platform.vercel.app/api/openai/chat', {
        method: 'POST',
        headers: { Authorization: 'Bearer demo-access-token' },
      }),
      { bucket: 'test.demo', limit: 10, env: { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' } },
    )
    expect(demo.ok).toBe(false)
    if (!demo.ok) expect(demo.response.status).toBe(401)
  })

  it('rate-limits repeated keys', () => {
    expect(checkEdgeRateLimit('bucket:a', 2)).toBe(true)
    expect(checkEdgeRateLimit('bucket:a', 2)).toBe(true)
    expect(checkEdgeRateLimit('bucket:a', 2)).toBe(false)
  })

  it('verifies supabase user via Auth API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })))
    const ok = await verifySupabaseAccessToken('real-jwt', {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
    })
    expect(ok).toEqual({ userId: 'user-1' })

    const demo = await verifySupabaseAccessToken('demo-access-token', {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
    })
    expect(demo).toEqual({ error: 'anonymous_or_demo_token' })
  })

  it('passes guard when Auth API accepts the JWT', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'user-42' }), { status: 200 })))
    const gate = await guardEdgeRequest(
      new Request('https://rahhal-ai-platform.vercel.app/api/amadeus-token', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer real-jwt',
          Origin: 'https://rahhal-ai-platform.vercel.app',
        },
      }),
      {
        bucket: 'test.ok',
        limit: 10,
        env: {
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_ANON_KEY: 'anon',
        },
      },
    )
    expect(gate.ok).toBe(true)
    if (gate.ok) expect(gate.userId).toBe('user-42')
  })
})
