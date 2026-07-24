/**
 * Shared Edge Function security: CORS allowlists + invoke authentication.
 *
 * Deploy secrets (never VITE_*):
 *   EDGE_ALLOWED_ORIGINS / OPS_ALLOWED_ORIGINS — comma-separated browser origins
 *   EDGE_ALLOWED_ORIGINS_PRODUCTION / _STAGING / _LOCAL — per-target overrides
 *   EDGE_DEPLOY_TARGET | DEPLOY_TARGET | VITE_DEPLOY_TARGET — select target
 *   EDGE_CORS_PERMISSIVE=true — allow `*` when allowlist empty on staging/prod
 *   SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — accepted invoke credentials
 *
 * Every privileged Edge endpoint must:
 *   1. Reflect only allowlisted Origins (or omit CORS when Origin is absent)
 *   2. Require Authorization Bearer or apikey matching anon/service role
 */

export type CorsMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export interface EdgeCorsOptions {
  methods?: CorsMethod[]
  /** Extra Access-Control-Allow-Headers (lower-case). */
  extraHeaders?: string[]
}

type EdgeDeployTarget = 'local' | 'development' | 'preview' | 'staging' | 'production'

function resolveDeployTarget(): EdgeDeployTarget {
  const raw = (
    Deno.env.get('EDGE_DEPLOY_TARGET')
    ?? Deno.env.get('DEPLOY_TARGET')
    ?? Deno.env.get('VITE_DEPLOY_TARGET')
    ?? 'local'
  ).trim().toLowerCase()
  if (raw === 'production' || raw === 'prod') return 'production'
  if (raw === 'staging' || raw === 'stage') return 'staging'
  if (raw === 'preview') return 'preview'
  if (raw === 'development' || raw === 'dev') return 'development'
  return 'local'
}

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Fully configurable allowlist for Production / Staging / Local. */
export function resolveEdgeAllowlist(): {
  origins: string[]
  permissiveEmpty: boolean
  target: EdgeDeployTarget
} {
  const target = resolveDeployTarget()
  const targetKey =
    target === 'production'
      ? 'EDGE_ALLOWED_ORIGINS_PRODUCTION'
      : target === 'staging' || target === 'preview'
        ? 'EDGE_ALLOWED_ORIGINS_STAGING'
        : 'EDGE_ALLOWED_ORIGINS_LOCAL'

  const raw = Deno.env.get(targetKey)
    ?? Deno.env.get('EDGE_ALLOWED_ORIGINS')
    ?? Deno.env.get('OPS_ALLOWED_ORIGINS')
    ?? ''
  const origins = parseList(raw)
  const permissiveFlag = ['1', 'true', 'yes', 'on'].includes(
    (Deno.env.get('EDGE_CORS_PERMISSIVE') ?? '').trim().toLowerCase(),
  )
  const permissiveEmpty = permissiveFlag
    || target === 'local'
    || target === 'development'
  return { origins, permissiveEmpty, target }
}

function pickAllowOrigin(req: Request): string {
  const { origins, permissiveEmpty } = resolveEdgeAllowlist()
  const origin = req.headers.get('Origin')
  if (origins.length === 0) {
    return permissiveEmpty ? '*' : 'null'
  }
  if (origin && origins.includes(origin)) return origin
  return origins[0] ?? 'null'
}

/**
 * Build CORS headers for an Edge response.
 * Local/development: empty allowlist → `*`.
 * Staging/production: empty allowlist → `null` (fail closed) unless EDGE_CORS_PERMISSIVE.
 */
export function buildCorsHeaders(
  req: Request,
  options: EdgeCorsOptions = {},
): Record<string, string> {
  const allowOrigin = pickAllowOrigin(req)

  const methods = (options.methods ?? ['GET', 'POST', 'OPTIONS']).join(', ')
  const baseHeaders = [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
    'x-correlation-id',
    ...(options.extraHeaders ?? []),
  ]

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': baseHeaders.join(', '),
    'Access-Control-Allow-Methods': methods,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }

  if (allowOrigin !== '*') {
    headers.Vary = 'Origin'
  }

  return headers
}

export function corsPreflightResponse(
  req: Request,
  options?: EdgeCorsOptions,
): Response {
  return new Response('ok', { headers: buildCorsHeaders(req, options) })
}

function extractInvokeCredential(req: Request): string | null {
  const apikey = req.headers.get('apikey')?.trim()
  if (apikey) return apikey

  const auth = req.headers.get('Authorization') ?? req.headers.get('authorization')
  if (!auth) return null
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim())
  return match?.[1]?.trim() || null
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return out === 0
}

/**
 * Require Supabase anon or service-role key on the request.
 * Returns an error Response when unauthorized; null when OK.
 */
export function requireEdgeInvokeAuth(
  req: Request,
  cors: Record<string, string>,
): Response | null {
  const credential = extractInvokeCredential(req)
  if (!credential) {
    return new Response(JSON.stringify({
      error: 'Missing Authorization Bearer or apikey',
      code: 'EDGE_AUTH_REQUIRED',
    }), { status: 401, headers: cors })
  }

  const accepted = [
    Deno.env.get('SUPABASE_ANON_KEY'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    Deno.env.get('ANON_KEY'),
    Deno.env.get('SERVICE_ROLE_KEY'),
  ].filter((v): v is string => Boolean(v && v.trim()))

  if (accepted.length === 0) {
    return new Response(JSON.stringify({
      error: 'Edge invoke keys are not configured on the server',
      code: 'EDGE_AUTH_NOT_CONFIGURED',
    }), { status: 503, headers: cors })
  }

  const ok = accepted.some((key) => timingSafeEqual(credential, key))
  if (!ok) {
    return new Response(JSON.stringify({
      error: 'Invalid invoke credential',
      code: 'EDGE_AUTH_INVALID',
    }), { status: 401, headers: cors })
  }

  return null
}

export function jsonEdgeResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
