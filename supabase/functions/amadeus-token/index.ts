/**
 * Amadeus OAuth token proxy (Supabase Edge).
 *
 * Holds AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET (and AMADEUS_API_* aliases)
 * server-side only. Sprint 79 P0: auth + rate limit + CORS allow-list.
 */

const DEFAULT_AMADEUS_HOST = 'https://test.api.amadeus.com'
const DEFAULT_ALLOW_HEADERS =
  'authorization, content-type, x-client-info, apikey, x-correlation-id'

const PRODUCTION_ORIGINS = ['https://rahhal-ai-platform.vercel.app']
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]

type RateBucket = { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>()

function checkRateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateBuckets.get(key)
  if (!entry || now >= entry.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count += 1
  return true
}

function resolveAllowlist(): string[] {
  const fromEnv = (Deno.env.get('CORS_ALLOWED_ORIGINS') ?? Deno.env.get('OPS_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return Array.from(new Set([...PRODUCTION_ORIGINS, ...DEV_ORIGINS, ...fromEnv]))
}

function corsHeadersFor(req: Request): { headers: Record<string, string>; allowed: boolean } {
  const allowlist = resolveAllowlist()
  const origin = req.headers.get('Origin')
  let allowOrigin: string
  let allowed: boolean
  if (!origin) {
    allowOrigin = allowlist[0] ?? 'null'
    allowed = true
  } else if (allowlist.includes(origin)) {
    allowOrigin = origin
    allowed = true
  } else {
    allowOrigin = 'null'
    allowed = false
  }
  return {
    allowed,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': DEFAULT_ALLOW_HEADERS,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  }
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

function normalizeAmadeusHost(raw: string): string {
  return raw.replace(/\/+$/, '').replace(/\/v1$/i, '')
}

function isDemoToken(token: string): boolean {
  return token === 'demo-access-token' || token.startsWith('demo-')
}

async function verifyUser(token: string): Promise<string | null> {
  if (!token || isDemoToken(token)) return null
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!supabaseUrl || !anonKey) return null
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    })
    if (!res.ok) return null
    const user = await res.json() as { id?: string }
    return typeof user.id === 'string' ? user.id : null
  } catch {
    return null
  }
}

function readCredentials(): { clientId: string | null; clientSecret: string | null } {
  const clientId = Deno.env.get('AMADEUS_CLIENT_ID')
    || Deno.env.get('AMADEUS_API_KEY')
    || null
  const clientSecret = Deno.env.get('AMADEUS_CLIENT_SECRET')
    || Deno.env.get('AMADEUS_API_SECRET')
    || null
  return { clientId, clientSecret }
}

Deno.serve(async (req) => {
  const { headers, allowed } = corsHeadersFor(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers })
  }

  if (!allowed) {
    return jsonResponse({ error: 'origin_not_allowed', code: 'CORS_ORIGIN_DENIED' }, 403, headers)
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, headers)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(authHeader)
  if (!match) {
    return jsonResponse({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, 401, headers)
  }

  const userId = await verifyUser(match[1].trim())
  if (!userId) {
    return jsonResponse({ error: 'Authentication required', code: 'AUTH_INVALID' }, 401, headers)
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(`amadeus.token:user:${userId}`, 10)
    || !checkRateLimit(`amadeus.token:ip:${ip}`, 20)) {
    return jsonResponse({ error: 'rate_limited', code: 'RATE_LIMITED' }, 429, {
      ...headers,
      'Retry-After': '60',
    })
  }

  const { clientId, clientSecret } = readCredentials()
  if (!clientId || !clientSecret) {
    return jsonResponse({
      error: 'Amadeus credentials are not configured on the server',
      code: 'AMADEUS_SERVER_NOT_CONFIGURED',
    }, 503, headers)
  }

  const host = normalizeAmadeusHost(Deno.env.get('AMADEUS_BASE_URL') || DEFAULT_AMADEUS_HOST)
  const tokenUrl = `${host}/v1/security/oauth2/token`

  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const text = await response.text()
    if (!response.ok) {
      return jsonResponse({
        error: 'Amadeus token exchange failed',
        code: response.status === 401
          ? 'AMADEUS_INVALID_CREDENTIALS'
          : response.status === 429
            ? 'AMADEUS_QUOTA_EXCEEDED'
            : 'AMADEUS_AUTH_ERROR',
        status: response.status,
      }, response.status === 401 || response.status === 429 ? response.status : 502, headers)
    }

    const data = JSON.parse(text) as Record<string, unknown>
    return jsonResponse({
      access_token: data.access_token,
      token_type: data.token_type ?? 'Bearer',
      expires_in: data.expires_in,
      scope: data.scope ?? null,
    }, 200, headers)
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Token exchange failed',
      code: 'AMADEUS_AUTH_NETWORK',
    }, 502, headers)
  }
})
