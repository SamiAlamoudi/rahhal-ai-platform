/**
 * Vite middleware that mirrors Vercel Edge routes locally:
 *   GET  /api/health/providers
 *   POST /api/amadeus-token
 *
 * Reads AMADEUS_* from process.env (or .env.local via Vite env loading).
 */

import type { Plugin } from 'vite'
import {
  missingCredentialsResponse,
  normalizeAmadeusHost,
  probeAmadeusConnection,
  readAmadeusCredentials,
} from '../../api/_lib/amadeusEnv.js'

function sendJson(res: { statusCode?: number; setHeader: (k: string, v: string) => void; end: (b: string) => void }, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export function amadeusApiPlugin(): Plugin {
  return {
    name: 'rahhal-amadeus-api',
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
          const health = await probeAmadeusConnection(process.env)
          sendJson(res, 200, health)
          return
        }

        if (url === '/api/amadeus-token') {
          if (req.method === 'OPTIONS') {
            res.statusCode = 200
            res.end('ok')
            return
          }
          if (req.method !== 'POST' && req.method !== 'GET') {
            sendJson(res, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
            return
          }

          const { clientId, clientSecret, host, hasCredentials } = readAmadeusCredentials(process.env)
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

        next()
      })
    },
  }
}
