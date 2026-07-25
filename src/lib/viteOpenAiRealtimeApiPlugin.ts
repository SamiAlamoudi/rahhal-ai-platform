/**
 * Vite middleware mirroring Vercel Edge:
 *   POST /api/openai-realtime-session
 *
 * Reads OPENAI_API_KEY from process.env (never VITE_*).
 */

import type { Plugin } from 'vite'
import {
  buildTravelConsultantInstructions,
  missingOpenAiRealtimeCredentialsResponse,
  readOpenAiRealtimeCredentials,
} from '../../api/_lib/openaiRealtimeEnv.js'

function sendJson(
  res: { statusCode?: number; setHeader: (k: string, v: string) => void; end: (b: string) => void },
  status: number,
  body: unknown,
) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readJsonBody(req: { on: (e: string, cb: (chunk?: Buffer) => void) => void }): Promise<unknown> {
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk))
    })
    req.on('end', () => resolve())
    req.on('error', reject)
  })
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

export function openAiRealtimeApiPlugin(): Plugin {
  return {
    name: 'rahhal-openai-realtime-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (url !== '/api/openai-realtime-session') {
          next()
          return
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 200
          res.end('ok')
          return
        }
        if (req.method !== 'POST' && req.method !== 'GET') {
          sendJson(res, 405, { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' })
          return
        }

        const { apiKey, model, voice, hasCredentials } = readOpenAiRealtimeCredentials(process.env)
        if (!hasCredentials || !apiKey) {
          sendJson(res, 503, {
            ...missingOpenAiRealtimeCredentialsResponse(),
            error: 'OpenAI Realtime credentials are not configured on the server',
          })
          return
        }

        let locale: 'ar' | 'en' = 'ar'
        if (req.method === 'POST') {
          const body = (await readJsonBody(req as never)) as { locale?: string }
          if (body.locale === 'en' || body.locale === 'ar') locale = body.locale
        }

        try {
          const instructions = buildTravelConsultantInstructions(locale)
          const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              expires_after: { anchor: 'created_at', seconds: 600 },
              session: {
                type: 'realtime',
                model,
                instructions,
                audio: { output: { voice } },
              },
            }),
          })
          const text = await response.text()
          if (!response.ok) {
            sendJson(res, response.status === 401 || response.status === 429 ? response.status : 502, {
              error: 'OpenAI realtime client_secret mint failed',
              code: response.status === 401
                ? 'OPENAI_INVALID_CREDENTIALS'
                : response.status === 429
                  ? 'OPENAI_QUOTA_EXCEEDED'
                  : 'OPENAI_REALTIME_AUTH_ERROR',
              status: response.status,
            })
            return
          }
          const data = JSON.parse(text) as Record<string, unknown>
          const value = typeof data.value === 'string'
            ? data.value
            : (data.client_secret as { value?: string } | undefined)?.value
          const expiresAt = typeof data.expires_at === 'number'
            ? data.expires_at
            : (data.client_secret as { expires_at?: number } | undefined)?.expires_at
          if (!value) {
            sendJson(res, 502, {
              error: 'OpenAI response missing ephemeral client secret value',
              code: 'OPENAI_REALTIME_BAD_RESPONSE',
            })
            return
          }
          sendJson(res, 200, {
            client_secret: value,
            expires_at: expiresAt ?? null,
            model,
            voice,
            locale,
            ws_url: `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
          })
        } catch (err) {
          sendJson(res, 502, {
            error: err instanceof Error ? err.message : 'Realtime session mint failed',
            code: 'OPENAI_REALTIME_NETWORK',
          })
        }
      })
    },
  }
}
