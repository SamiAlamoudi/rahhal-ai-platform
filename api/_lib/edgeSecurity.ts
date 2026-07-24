/**
 * Shared security helpers for Vercel Edge API routes.
 * Mirrors supabase/functions/_shared/edgeSecurity.ts.
 * Allowlist resolution matches src/lib/ops/security/edgeCorsAllowlist.ts.
 */

export type CorsMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

export interface EdgeCorsOptions {
  methods?: CorsMethod[]
  extraHeaders?: string[]
}

type EdgeDeployTarget = 'local' | 'development' | 'preview' | 'staging' | 'production'

function resolveDeployTarget(env: NodeJS.ProcessEnv): EdgeDeployTarget {
  const raw = (
    env.EDGE_DEPLOY_TARGET
    ?? env.DEPLOY_TARGET
    ?? env.VITE_DEPLOY_TARGET
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

function resolveAllowlist(env: NodeJS.ProcessEnv): {
  origins: string[]
  permissiveEmpty: boolean
} {
  const target = resolveDeployTarget(env)
  const targetKey =
    target === 'production'
      ? 'EDGE_ALLOWED_ORIGINS_PRODUCTION'
      : target === 'staging' || target === 'preview'
        ? 'EDGE_ALLOWED_ORIGINS_STAGING'
        : 'EDGE_ALLOWED_ORIGINS_LOCAL'

  const raw = env[targetKey]
    ?? env.EDGE_ALLOWED_ORIGINS
    ?? env.OPS_ALLOWED_ORIGINS
    ?? ''
  const origins = parseList(raw)
  const permissiveFlag = ['1', 'true', 'yes', 'on'].includes(
    (env.EDGE_CORS_PERMISSIVE ?? '').trim().toLowerCase(),
  )
  const permissiveEmpty = permissiveFlag
    || target === 'local'
    || target === 'development'
  return { origins, permissiveEmpty }
}

export function buildCorsHeaders(
  req: Request,
  options: EdgeCorsOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const { origins, permissiveEmpty } = resolveAllowlist(env)
  const origin = req.headers.get('Origin')
  let allowOrigin: string
  if (origins.length === 0) {
    allowOrigin = permissiveEmpty ? '*' : 'null'
  } else if (origin && origins.includes(origin)) {
    allowOrigin = origin
  } else {
    allowOrigin = origins[0] ?? 'null'
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
  if (allowOrigin !== '*') headers.Vary = 'Origin'
  return headers
}

export function corsPreflightResponse(
  req: Request,
  options?: EdgeCorsOptions,
  env?: NodeJS.ProcessEnv,
): Response {
  return new Response('ok', { headers: buildCorsHeaders(req, options, env) })
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

export function requireEdgeInvokeAuth(
  req: Request,
  cors: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env,
  options: { allowMissingWhenNoOrigin?: boolean } = {},
): Response | null {
  const credential = extractInvokeCredential(req)
  const accepted = [
    env.SUPABASE_ANON_KEY,
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.VITE_SUPABASE_ANON_KEY,
    env.ANON_KEY,
    env.SERVICE_ROLE_KEY,
  ].filter((v): v is string => Boolean(v && String(v).trim()))

  if (credential) {
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

  if (options.allowMissingWhenNoOrigin !== false && !req.headers.get('Origin')) {
    return null
  }

  return new Response(JSON.stringify({
    error: 'Missing Authorization Bearer or apikey',
    code: 'EDGE_AUTH_REQUIRED',
  }), { status: 401, headers: cors })
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
