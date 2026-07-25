/**
 * Vercel Edge Function — mint OpenAI Realtime ephemeral client secrets.
 *
 * Reads OPENAI_API_KEY from server env (never VITE_*).
 * SPA calls POST /api/openai-realtime-session for short-lived credentials.
 */

import {
  buildTravelConsultantInstructions,
  missingOpenAiRealtimeCredentialsResponse,
  readOpenAiRealtimeCredentials,
} from './_lib/openaiRealtimeEnv.js'

export const config = {
  runtime: 'edge',
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type SessionBody = {
  locale?: 'ar' | 'en'
  conversationId?: string
}

async function mintClientSecret(input: {
  apiKey: string
  model: string
  voice: string
  locale: 'ar' | 'en'
}): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number; error: string; code: string }> {
  const instructions = buildTravelConsultantInstructions(input.locale)
  const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expires_after: { anchor: 'created_at', seconds: 600 },
      session: {
        type: 'realtime',
        model: input.model,
        instructions,
        audio: {
          output: { voice: input.voice },
        },
      },
    }),
  })

  const text = await response.text()
  if (!response.ok) {
    return {
      ok: false,
      status: response.status === 401 || response.status === 429 ? response.status : 502,
      error: 'OpenAI realtime client_secret mint failed',
      code: response.status === 401
        ? 'OPENAI_INVALID_CREDENTIALS'
        : response.status === 429
          ? 'OPENAI_QUOTA_EXCEEDED'
          : 'OPENAI_REALTIME_AUTH_ERROR',
    }
  }

  try {
    return { ok: true, data: JSON.parse(text) as Record<string, unknown> }
  } catch {
    return {
      ok: false,
      status: 502,
      error: 'Invalid JSON from OpenAI client_secrets',
      code: 'OPENAI_REALTIME_BAD_RESPONSE',
    }
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405)
  }

  const { apiKey, model, voice, hasCredentials } = readOpenAiRealtimeCredentials(process.env)
  if (!hasCredentials || !apiKey) {
    return json({
      ...missingOpenAiRealtimeCredentialsResponse(),
      error: 'OpenAI Realtime credentials are not configured on the server',
    }, 503)
  }

  let locale: 'ar' | 'en' = 'ar'
  if (req.method === 'POST') {
    try {
      const body = (await req.json()) as SessionBody
      if (body.locale === 'en' || body.locale === 'ar') locale = body.locale
    } catch {
      /* empty body ok */
    }
  }

  try {
    const minted = await mintClientSecret({ apiKey, model, voice, locale })
    if (!minted.ok) {
      return json({
        error: minted.error,
        code: minted.code,
      }, minted.status)
    }

    const data = minted.data
    const value = typeof data.value === 'string'
      ? data.value
      : (data.client_secret as { value?: string } | undefined)?.value
    const expiresAt = typeof data.expires_at === 'number'
      ? data.expires_at
      : (data.client_secret as { expires_at?: number } | undefined)?.expires_at

    if (!value) {
      return json({
        error: 'OpenAI response missing ephemeral client secret value',
        code: 'OPENAI_REALTIME_BAD_RESPONSE',
      }, 502)
    }

    // Never echo the long-lived OPENAI_API_KEY — only the ephemeral value.
    return json({
      client_secret: value,
      expires_at: expiresAt ?? null,
      model,
      voice,
      locale,
      ws_url: `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
    })
  } catch (err) {
    return json({
      error: err instanceof Error ? err.message : 'Realtime session mint failed',
      code: 'OPENAI_REALTIME_NETWORK',
    }, 502)
  }
}
