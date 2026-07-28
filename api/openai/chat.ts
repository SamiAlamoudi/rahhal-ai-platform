/**
 * POST /api/openai/chat — server-side OpenAI Chat Completions proxy.
 * Keeps OPENAI_API_KEY off the client so Conversation Brain always hits OpenAI in production.
 *
 * Body: {
 *   messages: Array<{ role, content }>,
 *   temperature?: number,
 *   jsonObject?: boolean,
 *   stream?: boolean,
 *   model?: string
 * }
 */

export const config = {
  runtime: 'edge',
  maxDuration: 60,
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
}

function readApiKey(): string | null {
  const raw = (
    process.env.OPENAI_API_KEY
    || process.env.VITE_AGENT_OPENAI_API_KEY
    || process.env.VITE_OPENAI_API_KEY
  )?.trim()
  return raw || null
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ configured: Boolean(readApiKey()) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = readApiKey()
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'missing_api_key' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: {
    messages?: Array<{ role?: string; content?: string }>
    temperature?: number
    jsonObject?: boolean
    stream?: boolean
    model?: string
    max_tokens?: number
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const messages = Array.isArray(body.messages) ? body.messages : []
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const stream = body.stream !== false
  const model = (typeof body.model === 'string' && body.model.trim())
    || process.env.VITE_AGENT_OPENAI_MODEL?.trim()
    || 'gpt-4o'
  const upstreamBody: Record<string, unknown> = {
    model,
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.85,
    messages: messages.map((m) => ({
      role: m.role === 'assistant' || m.role === 'system' ? m.role : 'user',
      content: String(m.content ?? ''),
    })),
    stream,
  }
  // Default: natural prose (ChatGPT Voice). Opt-in JSON via jsonObject: true.
  if (body.jsonObject === true) {
    upstreamBody.response_format = { type: 'json_object' }
  }
  if (typeof body.max_tokens === 'number' && body.max_tokens > 0) {
    upstreamBody.max_tokens = body.max_tokens
  }
  if (stream) {
    upstreamBody.stream_options = { include_usage: true }
  }

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(upstreamBody),
  })

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return new Response(JSON.stringify({
      error: 'upstream_error',
      status: upstream.status,
      detail: detail.slice(0, 400),
    }), {
      status: upstream.status === 401 ? 503 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (stream && upstream.body) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  }

  const json = await upstream.text()
  return new Response(json, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
