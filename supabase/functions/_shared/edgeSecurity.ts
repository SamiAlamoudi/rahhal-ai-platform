/**
 * Shared Edge Function security: CORS allowlists + invoke authentication.
 *
 * Deploy secrets (never VITE_*):
 *   EDGE_ALLOWED_ORIGINS / OPS_ALLOWED_ORIGINS — comma-separated browser origins
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

function readAllowlist(): string[] {
  const raw = Deno.env.get('EDGE_ALLOWED_ORIGINS')
    ?? Deno.env.get('OPS_ALLOWED_ORIGINS')
    ?? ''
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Build CORS headers for an Edge response.
 * When an allowlist is configured, only listed Origins are reflected.
 * When empty (local/dev), `*` is used so tooling still works — production
 * MUST set EDGE_ALLOWED_ORIGINS / OPS_ALLOWED_ORIGINS.
 */
export function buildCorsHeaders(
  req: Request,
  options: EdgeCorsOptions = {},
): Record<string, string> {
  const allowlist = readAllowlist()
  const origin = req.headers.get('Origin')
  let allowOrigin: string
  if (allowlist.length === 0) {
    allowOrigin = '*'
  } else if (origin && allowlist.includes(origin)) {
    allowOrigin = origin
  } else {
    // Do not reflect unlisted browser origins.
    allowOrigin = allowlist[0] ?? 'null'
  }

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
    // Local `supabase start` also exposes these aliases in some stacks.
    Deno.env.get('ANON_KEY'),
    Deno.env.get('SERVICE_ROLE_KEY'),
  ].filter((v): v is string => Boolean(v && v.trim()))

  if (accepted.length === 0) {
    // Misconfigured Edge runtime — fail closed for privileged proxies.
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
