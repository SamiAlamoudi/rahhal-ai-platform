/**
 * Sprint 79 P0 — shared auth, CORS allow-list, and rate limiting for Edge proxies.
 * Used by /api/openai/* and /api/amadeus-token.
 */

export type EdgeGuardOk = {
  ok: true
  corsHeaders: Record<string, string>
  userId: string
}

export type EdgeGuardBlocked = {
  ok: false
  response: Response
}

export type EdgeGuardResult = EdgeGuardOk | EdgeGuardBlocked

const DEFAULT_ALLOW_HEADERS =
  'authorization, content-type, x-client-info, apikey, x-correlation-id, openai-safety-identifier'

const PRODUCTION_ORIGINS = [
  'https://rahhal-ai-platform.vercel.app',
]

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

/** @internal test helper */
export function __resetEdgeRateLimitsForTests(): void {
  rateBuckets.clear()
}

export function checkEdgeRateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): boolean {
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

/**
 * Vercel Preview git-alias URLs differ from VERCEL_URL (unique deployment host).
 * Without this, same-origin SPA → /api on Preview aliases are rejected as CORS_ORIGIN_DENIED
 * (P0 iPhone fail). Hostnames are derived from PRODUCTION_ORIGINS (no extra brand literals).
 */
export function isAllowedVercelPreviewOrigin(origin: string): boolean {
  try {
    const u = new URL(origin)
    if (u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    const vercelSuffix = '.vercel.app'
    if (!host.endsWith(vercelSuffix)) return false

    for (const entry of PRODUCTION_ORIGINS) {
      const prodHost = new URL(entry).hostname.toLowerCase()
      if (host === prodHost) return true
      if (!prodHost.endsWith(vercelSuffix)) continue
      const prodBase = prodHost.slice(0, -vercelSuffix.length)
      // Unique deployment hosts: <prodBase>-*.vercel.app
      if (host.startsWith(`${prodBase}-`)) return true
      // Git-branch aliases: *-<prodBase with trailing platform→project>.vercel.app
      const projectBase = prodBase.endsWith('-platform')
        ? `${prodBase.slice(0, -'platform'.length)}project`
        : `${prodBase}-project`
      if (host === projectBase || host.endsWith(`-${projectBase}`)) return true
    }

    // Cursor / workspace Preview hosts for this team.
    if (host.startsWith('workspace') && /^workspace[a-z0-9-]*\.vercel\.app$/.test(host)) {
      return true
    }
    return false
  } catch {
    return false
  }
}

/** Resolve CORS allow-list: production domains + localhost + env + this Vercel deployment. */
export function resolveCorsAllowlist(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): string[] {
  const fromEnv = (env.CORS_ALLOWED_ORIGINS ?? env.OPS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const vercelUrl = (env.VERCEL_URL ?? '').trim()
  const vercelOrigin = vercelUrl
    ? (vercelUrl.startsWith('http') ? vercelUrl.replace(/\/+$/, '') : `https://${vercelUrl.replace(/\/+$/, '')}`)
    : null

  const vercelBranch = (env.VERCEL_BRANCH_URL ?? '').trim()
  const vercelBranchOrigin = vercelBranch
    ? (vercelBranch.startsWith('http')
      ? vercelBranch.replace(/\/+$/, '')
      : `https://${vercelBranch.replace(/\/+$/, '')}`)
    : null

  return Array.from(new Set([
    ...PRODUCTION_ORIGINS,
    ...DEV_ORIGINS,
    ...fromEnv,
    ...(vercelOrigin ? [vercelOrigin] : []),
    ...(vercelBranchOrigin ? [vercelBranchOrigin] : []),
  ]))
}

export function buildCorsHeaders(
  req: Request,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): { headers: Record<string, string>; allowed: boolean } {
  const allowlist = resolveCorsAllowlist(env)
  const origin = req.headers.get('Origin')
  // Same-origin / non-browser callers often omit Origin — allow those.
  let allowOrigin: string
  let allowed: boolean
  if (!origin) {
    allowOrigin = allowlist[0] ?? 'null'
    allowed = true
  } else if (allowlist.includes(origin) || isAllowedVercelPreviewOrigin(origin)) {
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
    },
  }
}

function isDemoToken(token: string): boolean {
  return token === 'demo-access-token' || token.startsWith('demo-')
}

function unauthorized(corsHeaders: Record<string, string>, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function forbidden(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'origin_not_allowed', code: 'CORS_ORIGIN_DENIED' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function tooMany(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: 'rate_limited', code: 'RATE_LIMITED' }), {
    status: 429,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Retry-After': '60',
    },
  })
}

/**
 * Verify Supabase user JWT via Auth API. Rejects missing, demo, and invalid tokens.
 */
export async function verifySupabaseAccessToken(
  token: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Promise<{ userId: string } | { error: string }> {
  if (!token || isDemoToken(token)) {
    return { error: 'anonymous_or_demo_token' }
  }

  const supabaseUrl = (
    env.SUPABASE_URL
    || env.VITE_SUPABASE_URL
    || ''
  ).replace(/\/+$/, '')
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !anonKey) {
    return { error: 'auth_backend_not_configured' }
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    })
    if (!res.ok) {
      return { error: 'invalid_token' }
    }
    const user = await res.json() as { id?: string }
    if (!user?.id || typeof user.id !== 'string') {
      return { error: 'invalid_user' }
    }
    return { userId: user.id }
  } catch {
    return { error: 'auth_network_error' }
  }
}

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  )
}

export type EdgeGuardOptions = {
  /** Rate-limit bucket name (e.g. openai.chat, amadeus.token). */
  bucket: string
  /** Max requests per window per authenticated user. */
  limit: number
  /** Window length in ms (default 60s). */
  windowMs?: number
  /** When true, OPTIONS is answered immediately (no auth). */
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
}

/**
 * Gate an Edge/API request: CORS allow-list → auth → rate limit.
 * Callers should return `result.response` when `ok` is false.
 */
export async function guardEdgeRequest(
  req: Request,
  options: EdgeGuardOptions,
): Promise<EdgeGuardResult> {
  const env = options.env ?? process.env
  const { headers: corsHeaders, allowed } = buildCorsHeaders(req, env)

  if (req.method === 'OPTIONS') {
    // 204 must not carry a body — Edge/Runtime throws otherwise (P0 CORS preflight 500).
    return {
      ok: false,
      response: new Response(null, { status: 204, headers: corsHeaders }),
    }
  }

  if (!allowed) {
    return { ok: false, response: forbidden(corsHeaders) }
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(authHeader)
  if (!match) {
    return {
      ok: false,
      response: unauthorized(corsHeaders, 'AUTH_REQUIRED', 'Authentication required'),
    }
  }

  const verified = await verifySupabaseAccessToken(match[1].trim(), env)
  if ('error' in verified) {
    const code = verified.error === 'auth_backend_not_configured'
      ? 'AUTH_BACKEND_NOT_CONFIGURED'
      : 'AUTH_INVALID'
    return {
      ok: false,
      response: unauthorized(corsHeaders, code, 'Authentication required'),
    }
  }

  const windowMs = options.windowMs ?? 60_000
  const rateKey = `${options.bucket}:user:${verified.userId}`
  const ipKey = `${options.bucket}:ip:${clientIp(req)}`
  if (!checkEdgeRateLimit(rateKey, options.limit, windowMs)
    || !checkEdgeRateLimit(ipKey, options.limit * 2, windowMs)) {
    return { ok: false, response: tooMany(corsHeaders) }
  }

  return { ok: true, corsHeaders, userId: verified.userId }
}

/** Server-only OpenAI key — never prefer VITE_* client keys. */
export function readServerOpenAiApiKey(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string | null {
  const raw = (env.OPENAI_API_KEY ?? '').trim()
  return raw || null
}
