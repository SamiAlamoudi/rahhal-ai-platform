/**
 * Vite middleware that mirrors Vercel Edge routes locally:
 *   GET  /api/health/providers
 *   POST /api/amadeus-token
 *
 * Sprint 14 — Node middleware uses viteNodeEnv (not SPA provider SecretManager).
 * Sprint 79 P0 — Amadeus token requires Authorization Bearer (Supabase user JWT).
 */

import type { Plugin } from 'vite'
import type { IncomingMessage } from 'node:http'
import {
  missingCredentialsResponse,
  normalizeAmadeusHost,
  probeAmadeusConnection,
  readAmadeusCredentials,
} from '../../api/_lib/amadeusEnv.js'
import {
  parseBilamoFlightSearchBody,
  runBilamoFlightSearch,
} from '../../api/_lib/bilamoFlightSearch.js'
import { buildAmadeusEnvBag } from './viteNodeEnv.js'

function sendJson(res: { statusCode?: number; setHeader: (k: string, v: string) => void; end: (b: string) => void }, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function readHeader(req: IncomingMessage, name: string): string | null {
  const raw = req.headers[name.toLowerCase()]
  if (Array.isArray(raw)) return raw[0] ?? null
  return raw ?? null
}

async function requireUserJwt(req: IncomingMessage): Promise<{ ok: true; userId: string } | { ok: false; status: number; body: unknown }> {
  const auth = readHeader(req, 'authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(auth)
  if (!match) {
    return { ok: false, status: 401, body: { error: 'Authentication required', code: 'AUTH_REQUIRED' } }
  }
  const token = match[1].trim()
  if (!token || token === 'demo-access-token' || token.startsWith('demo-')) {
    return { ok: false, status: 401, body: { error: 'Authentication required', code: 'AUTH_INVALID' } }
  }

  const env = buildAmadeusEnvBag() as Record<string, string | undefined>
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !anonKey) {
    return { ok: false, status: 401, body: { error: 'Authentication required', code: 'AUTH_BACKEND_NOT_CONFIGURED' } }
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    })
    if (!res.ok) {
      return { ok: false, status: 401, body: { error: 'Authentication required', code: 'AUTH_INVALID' } }
    }
    const user = await res.json() as { id?: string }
    if (!user?.id) {
      return { ok: false, status: 401, body: { error: 'Authentication required', code: 'AUTH_INVALID' } }
    }
    return { ok: true, userId: user.id }
  } catch {
    return { ok: false, status: 401, body: { error: 'Authentication required', code: 'AUTH_INVALID' } }
  }
}

export function amadeusApiPlugin(): Plugin {
  return {
    name: 'platform-amadeus-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''

        if (url === '/api/health/providers') {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200
            res.end('ok')
            return
          }
          if (req.method !== 'GET') {
            sendJson(res, 405, { error: 'Method not allowed' })
            return
          }
          const health = await probeAmadeusConnection(buildAmadeusEnvBag())
          sendJson(res, 200, health)
          return
        }

        if (url === '/api/amadeus-token') {
          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173')
            res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, x-client-info, apikey')
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            res.end('ok')
            return
          }
          if (req.method !== 'POST' && req.method !== 'GET') {
            sendJson(res, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
            return
          }

          const auth = await requireUserJwt(req)
          if (!auth.ok) {
            sendJson(res, auth.status, auth.body)
            return
          }

          const { clientId, clientSecret, host, hasCredentials } = readAmadeusCredentials(buildAmadeusEnvBag())
          if (!hasCredentials || !clientId || !clientSecret) {
            sendJson(res, 503, {
              ...missingCredentialsResponse(),
              error: 'Amadeus credentials are not configured on the server',
              code: 'AMADEUS_SERVER_NOT_CONFIGURED',
            })
            return
          }

          try {
            const tokenUrl = `${normalizeAmadeusHost(host)}/v1/security/oauth2/token`
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
              sendJson(res, response.status === 401 || response.status === 429 ? response.status : 502, {
                error: 'Amadeus token exchange failed',
                code: response.status === 401
                  ? 'AMADEUS_INVALID_CREDENTIALS'
                  : response.status === 429
                    ? 'AMADEUS_QUOTA_EXCEEDED'
                    : 'AMADEUS_AUTH_ERROR',
                status: response.status,
              })
              return
            }
            const data = JSON.parse(text) as Record<string, unknown>
            sendJson(res, 200, {
              access_token: data.access_token,
              token_type: data.token_type ?? 'Bearer',
              expires_in: data.expires_in,
              scope: data.scope ?? null,
            })
          } catch (err) {
            sendJson(res, 502, {
              error: err instanceof Error ? err.message : 'Token exchange failed',
              code: 'AMADEUS_AUTH_NETWORK',
            })
          }
          return
        }

        if (url === '/api/bilamo-flights-search') {
          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173')
            res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, x-client-info, apikey')
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            res.end('ok')
            return
          }

          const envBag = buildAmadeusEnvBag() as Record<string, string | undefined>

          if (req.method === 'GET') {
            const creds = readAmadeusCredentials(envBag)
            sendJson(res, 200, {
              ok: true,
              provider: creds.hasCredentials ? 'amadeus' : 'demo',
              detail: creds.hasCredentials
                ? 'Amadeus credentials configured'
                : 'Demo mode — Amadeus credentials not configured',
            })
            return
          }

          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
            return
          }

          const rawBody = await new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = []
            req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
            req.on('error', reject)
          })
          let raw: Record<string, unknown> = {}
          try {
            raw = JSON.parse(rawBody || '{}') as Record<string, unknown>
          } catch {
            sendJson(res, 400, { ok: false, error: 'invalid_json', offers: [] })
            return
          }

          const body = parseBilamoFlightSearchBody(raw)
          if (!body) {
            sendJson(res, 400, { ok: false, error: 'invalid_search_request', offers: [] })
            return
          }

          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 12_000)
          try {
            const result = await runBilamoFlightSearch({
              body,
              env: envBag,
              signal: controller.signal,
              clientKey: readHeader(req, 'authorization')?.slice(-24) || 'vite-dev',
              fallbackToDemo: true,
            })
            sendJson(res, 200, result)
          } finally {
            clearTimeout(timer)
          }
          return
        }

        next()
      })
    },
  }
}
