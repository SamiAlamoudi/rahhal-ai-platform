/**
 * Vercel Edge — OpenAI chat completions proxy.
 * Mirrors supabase/functions/openai-proxy. Holds OPENAI_API_KEY server-side.
 */

import {
  buildCorsHeaders,
  corsPreflightResponse,
  jsonEdgeResponse,
  requireEdgeInvokeAuth,
} from './_lib/edgeSecurity.js'

export const config = {
  runtime: 'edge',
}

const DEFAULT_BASE = 'https://api.openai.com/v1'

export default async function handler(req: Request): Promise<Response> {
  const cors = buildCorsHeaders(req, { methods: ['POST', 'OPTIONS'] })

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req, { methods: ['POST', 'OPTIONS'] })
  }
  if (req.method !== 'POST') {
    return jsonEdgeResponse({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405, cors)
  }

  const authError = requireEdgeInvokeAuth(req, cors, process.env, {
    allowMissingWhenNoOrigin: false,
  })
  if (authError) return authError

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return jsonEdgeResponse({
      error: 'OpenAI API key is not configured on the server',
      code: 'OPENAI_SERVER_NOT_CONFIGURED',
    }, 503, cors)
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json() as Record<string, unknown>
  } catch {
    return jsonEdgeResponse({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, 400, cors)
  }

  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.messages)) {
    return jsonEdgeResponse({
      error: 'Body must include messages[]',
      code: 'INVALID_BODY',
    }, 400, cors)
  }

  const base = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })
    const text = await response.text()
    return new Response(text, {
      status: response.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return jsonEdgeResponse({
      error: error instanceof Error ? error.message : 'Upstream request failed',
      code: 'OPENAI_UPSTREAM_ERROR',
    }, 502, cors)
  }
}
