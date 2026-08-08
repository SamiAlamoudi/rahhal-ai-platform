/**
 * Classic TTS route — safe error mapping + secret hygiene.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../../../api/openai/tts'
import {
  classifyOpenAiKey,
  extractUpstreamSafeErrorCode,
  looksLikeJsonBytes,
  mapUpstreamStatusToSafeCode,
  resolveTtsFormat,
  resolveTtsVoice,
  sanitizeUpstreamDetail,
} from '../../../api/_lib/openaiTts'

const ENV = {
  OPENAI_API_KEY: 'sk-test-abcdefghijklmnopqrstuvwxyz012345',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
}

function authFetchStub() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
    }
    // Default: treat as OpenAI upstream unless overridden per-test.
    return new Response('upstream-not-mocked', { status: 500 })
  })
}

async function postTts(
  body: Record<string, unknown>,
  opts?: { key?: string | null },
): Promise<Response> {
  if (opts?.key === null) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = opts?.key ?? ENV.OPENAI_API_KEY
  process.env.SUPABASE_URL = ENV.SUPABASE_URL
  process.env.SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY

  return handler(new Request('https://rahhal-ai-platform.vercel.app/api/openai/tts', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer real-jwt',
      Origin: 'https://rahhal-ai-platform.vercel.app',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }))
}

describe('openaiTts helpers', () => {
  it('classifies missing / placeholder / plausible keys', () => {
    expect(classifyOpenAiKey(null)).toEqual({ present: false, plausible: false })
    expect(classifyOpenAiKey('[SENSITIVE]')).toEqual({ present: true, plausible: false })
    expect(classifyOpenAiKey('sk-abc')).toEqual({ present: true, plausible: false })
    expect(classifyOpenAiKey('sk-test-abcdefghijklmnopqrstuvwxyz012345').plausible).toBe(true)
  })

  it('resolves mp3 format and marin voice for diagnostics payload', () => {
    expect(resolveTtsFormat('mp3')).toBe('mp3')
    expect(resolveTtsVoice({ requestedVoice: 'marin', locale: 'ar' })).toBe('marin')
  })

  it('maps upstream statuses to stable safe codes', () => {
    expect(mapUpstreamStatusToSafeCode(400)).toBe('TTS_UPSTREAM_400')
    expect(mapUpstreamStatusToSafeCode(401)).toBe('TTS_UPSTREAM_401')
    expect(mapUpstreamStatusToSafeCode(403)).toBe('TTS_UPSTREAM_403')
    expect(mapUpstreamStatusToSafeCode(429)).toBe('TTS_UPSTREAM_429')
    expect(mapUpstreamStatusToSafeCode(500)).toBe('TTS_UPSTREAM_5XX')
    expect(mapUpstreamStatusToSafeCode(502)).toBe('TTS_UPSTREAM_5XX')
  })

  it('extracts upstream error codes and sanitizes secrets', () => {
    expect(extractUpstreamSafeErrorCode(JSON.stringify({
      error: { code: 'invalid_api_key', type: 'invalid_request_error', message: 'bad sk-secretVALUE' },
    }))).toBe('invalid_api_key')
    const sanitized = sanitizeUpstreamDetail('Bearer sk-abcdefghijklmnopqrst and more')
    expect(sanitized).not.toMatch(/sk-[A-Za-z0-9]/)
    expect(sanitized).toContain('[redacted]')
  })

  it('detects JSON bytes so they are never treated as audio', () => {
    expect(looksLikeJsonBytes(new TextEncoder().encode('{"error":true}'))).toBe(true)
    expect(looksLikeJsonBytes(new Uint8Array([0xff, 0xfb, 0x10, 0x00]))).toBe(false)
  })
})

describe('POST /api/openai/tts', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = authFetchStub()
    vi.stubGlobal('fetch', fetchMock)
    process.env.OPENAI_API_KEY = ENV.OPENAI_API_KEY
    process.env.SUPABASE_URL = ENV.SUPABASE_URL
    process.env.SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY
  })

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch)
    vi.unstubAllGlobals()
    delete process.env.OPENAI_API_KEY
  })

  it('returns TTS_CONFIG_MISSING when API key absent', async () => {
    const res = await postTts({ text: 'hi', format: 'mp3', voice: 'marin' }, { key: null })
    expect(res.status).toBe(503)
    const body = await res.json() as { code: string; stages: string[] }
    expect(body.code).toBe('TTS_CONFIG_MISSING')
    expect(body.stages).toContain('TTS_ENV_KEY_MISSING')
    expect(JSON.stringify(body)).not.toMatch(/sk-/)
  })

  it('returns TTS_CONFIG_MISSING for placeholder key shape', async () => {
    const res = await postTts({ text: 'hi', format: 'mp3' }, { key: '[SENSITIVE]' })
    expect(res.status).toBe(503)
    const body = await res.json() as { code: string }
    expect(body.code).toBe('TTS_CONFIG_MISSING')
  })

  it('maps upstream 401 to TTS_UPSTREAM_401 (not opaque 502)', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
      }
      return new Response(JSON.stringify({
        error: { message: 'Incorrect API key provided: sk-leaked', code: 'invalid_api_key', type: 'invalid_request_error' },
      }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    })
    const res = await postTts({
      text: 'مرحباً، أنا بيلامو',
      locale: 'ar',
      voice: 'marin',
      format: 'mp3',
      speed: 1,
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('X-Rahhal-TTS-Safe-Code')).toBe('TTS_UPSTREAM_401')
    const body = await res.json() as { code: string; detail?: string; stages: string[] }
    expect(body.code).toBe('TTS_UPSTREAM_401')
    expect(body.stages).toContain('TTS_UPSTREAM_REQUEST_STARTED')
    expect(body.stages).toContain('TTS_UPSTREAM_STATUS_401')
    expect(JSON.stringify(body)).not.toMatch(/sk-[A-Za-z0-9]/)
    expect(body.detail || '').not.toMatch(/sk-[A-Za-z0-9]/)
  })

  it('maps upstream 400 / 429 / 5xx', async () => {
    for (const [status, code] of [
      [400, 'TTS_UPSTREAM_400'],
      [429, 'TTS_UPSTREAM_429'],
      [500, 'TTS_UPSTREAM_5XX'],
    ] as const) {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/auth/v1/user')) {
          return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
        }
        return new Response(JSON.stringify({ error: { code: 'x', message: 'nope' } }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      })
      const res = await postTts({ text: 'hi', format: 'mp3', voice: 'marin' })
      const body = await res.json() as { code: string }
      expect(body.code).toBe(code)
      expect(res.headers.get('X-Rahhal-TTS-Safe-Code')).toBe(code)
    }
  })

  it('maps upstream timeout / network throw', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
      }
      const err = new Error('network down')
      err.name = 'TimeoutError'
      throw err
    })
    const res = await postTts({ text: 'hi', format: 'mp3', voice: 'marin' })
    const body = await res.json() as { code: string }
    expect(body.code).toBe('TTS_UPSTREAM_TIMEOUT')
  })

  it('rejects JSON success-shaped bodies as TTS_INVALID_CONTENT_TYPE', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: 'not audio but 200' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    const res = await postTts({ text: 'hi', format: 'mp3', voice: 'marin' })
    const body = await res.json() as { code: string }
    expect(body.code).toBe('TTS_INVALID_CONTENT_TYPE')
  })

  it('rejects empty audio as TTS_EMPTY_RESPONSE', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      })
    })
    const res = await postTts({ text: 'hi', format: 'mp3', voice: 'marin' })
    const body = await res.json() as { code: string }
    expect(body.code).toBe('TTS_EMPTY_RESPONSE')
  })

  it('returns audio/mpeg for valid MP3 upstream', async () => {
    const mp3 = new Uint8Array(128)
    mp3[0] = 0xff
    mp3[1] = 0xfb
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 })
      }
      if (url.includes('/v1/audio/speech')) {
        const parsed = JSON.parse(String(init?.body || '{}')) as {
          model?: string
          voice?: string
          response_format?: string
        }
        expect(parsed.model).toBe('gpt-4o-mini-tts')
        expect(parsed.voice).toBe('marin')
        expect(parsed.response_format).toBe('mp3')
        return new Response(mp3, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        })
      }
      return new Response('nope', { status: 500 })
    })
    const res = await postTts({
      text: 'مرحباً، أنا بيلامو. إذا كنت تسمعني فاختبار الصوت يعمل بنجاح.',
      locale: 'ar',
      voice: 'marin',
      format: 'mp3',
      speed: 1,
      instructions: 'Speak naturally in clear Arabic as Bilamo. Warm, confident, concise.',
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    expect(res.headers.get('X-Rahhal-TTS-Format')).toBe('mp3')
    expect(res.headers.get('X-Rahhal-TTS-Safe-Code')).toBe('TTS_RESPONSE_READY')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(bytes.byteLength).toBe(128)
  })

  it('OPTIONS preflight returns 204 with empty body', async () => {
    const { guardEdgeRequest } = await import('../../../api/_lib/edgeGuard')
    const gate = await guardEdgeRequest(
      new Request('https://rahhal-ai-platform.vercel.app/api/openai/tts', { method: 'OPTIONS' }),
      { bucket: 'test.opt', limit: 10, env: ENV },
    )
    expect(gate.ok).toBe(false)
    if (!gate.ok) {
      expect(gate.response.status).toBe(204)
      const text = await gate.response.text()
      expect(text).toBe('')
    }
  })
})
