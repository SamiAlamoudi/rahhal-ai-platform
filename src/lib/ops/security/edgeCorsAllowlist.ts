/**
 * Edge CORS allowlist resolution for Production / Staging / Local.
 *
 * Env vars (first match wins for the allowlist string):
 *   EDGE_ALLOWED_ORIGINS          — primary (all environments)
 *   OPS_ALLOWED_ORIGINS           — legacy alias (ops-health / staging gateways)
 *   EDGE_ALLOWED_ORIGINS_PRODUCTION / _STAGING / _LOCAL — optional target overrides
 *   EDGE_DEPLOY_TARGET | DEPLOY_TARGET | VITE_DEPLOY_TARGET — select override
 *
 * Semantics:
 *   - Local / development with empty allowlist → `*` (tooling / supabase start)
 *   - Staging / production with empty allowlist → fail closed (`null` origin)
 *     unless EDGE_CORS_PERMISSIVE=true (explicit escape hatch for misconfigured deploys)
 */

export type EdgeDeployTarget = 'local' | 'development' | 'preview' | 'staging' | 'production'

export interface ResolveEdgeAllowlistInput {
  env?: Record<string, string | undefined>
  /** Override detected target. */
  target?: EdgeDeployTarget
}

function read(env: Record<string, string | undefined>, key: string): string {
  return (env[key] ?? '').trim()
}

function parseList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function resolveEdgeDeployTarget(
  env: Record<string, string | undefined> = {},
): EdgeDeployTarget {
  const raw = (
    read(env, 'EDGE_DEPLOY_TARGET')
    || read(env, 'DEPLOY_TARGET')
    || read(env, 'VITE_DEPLOY_TARGET')
    || 'local'
  ).toLowerCase()

  if (raw === 'production' || raw === 'prod') return 'production'
  if (raw === 'staging' || raw === 'stage') return 'staging'
  if (raw === 'preview') return 'preview'
  if (raw === 'development' || raw === 'dev') return 'development'
  return 'local'
}

/**
 * Resolve the active CORS origin allowlist for the current deploy target.
 */
export function resolveEdgeAllowedOrigins(
  input: ResolveEdgeAllowlistInput = {},
): {
  target: EdgeDeployTarget
  origins: string[]
  /** When true, empty allowlist may use `*`. */
  permissiveEmpty: boolean
  source: string
} {
  const env = input.env ?? {}
  const target = input.target ?? resolveEdgeDeployTarget(env)

  const targetKey =
    target === 'production'
      ? 'EDGE_ALLOWED_ORIGINS_PRODUCTION'
      : target === 'staging' || target === 'preview'
        ? 'EDGE_ALLOWED_ORIGINS_STAGING'
        : 'EDGE_ALLOWED_ORIGINS_LOCAL'

  const fromTarget = read(env, targetKey)
  const fromPrimary = read(env, 'EDGE_ALLOWED_ORIGINS')
  const fromOps = read(env, 'OPS_ALLOWED_ORIGINS')

  let source = 'empty'
  let raw = ''
  if (fromTarget) {
    raw = fromTarget
    source = targetKey
  } else if (fromPrimary) {
    raw = fromPrimary
    source = 'EDGE_ALLOWED_ORIGINS'
  } else if (fromOps) {
    raw = fromOps
    source = 'OPS_ALLOWED_ORIGINS'
  }

  const origins = parseList(raw)
  const permissiveFlag = ['1', 'true', 'yes', 'on'].includes(
    read(env, 'EDGE_CORS_PERMISSIVE').toLowerCase(),
  )
  const permissiveEmpty = permissiveFlag
    || target === 'local'
    || target === 'development'

  return { target, origins, permissiveEmpty, source }
}

/**
 * Pick Access-Control-Allow-Origin for a request given the resolved allowlist.
 */
export function pickCorsAllowOrigin(
  requestOrigin: string | null,
  resolved: ReturnType<typeof resolveEdgeAllowedOrigins>,
): string {
  const { origins, permissiveEmpty } = resolved
  if (origins.length === 0) {
    return permissiveEmpty ? '*' : 'null'
  }
  if (requestOrigin && origins.includes(requestOrigin)) {
    return requestOrigin
  }
  // Do not reflect unlisted browser origins.
  return origins[0] ?? 'null'
}
