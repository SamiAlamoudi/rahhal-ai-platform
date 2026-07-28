/**
 * POST /api/openai/tts — OpenAI gpt-4o-mini-tts (ChatGPT-like speech).
 * Falls back to 503 when OPENAI_API_KEY is missing so the client can try Edge.
 *
 * Body: { text: string, locale?: 'ar' | 'en', voice?: string }
 */

export const config = {
  runtime: 'edge',
  maxDuration: 30,
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  let body: { text?: unknown; locale?: unknown; voice?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return new Response(JSON.stringify({ error: 'text required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const locale = body.locale === 'en' ? 'en' : 'ar'
  const voice = typeof body.voice === 'string' && body.voice.trim()
    ? body.voice.trim()
    : (locale === 'ar' ? 'coral' : 'nova')

  const instructions = locale === 'ar'
    ? [
      'Speak warm, natural Gulf/Saudi Arabic as a senior travel consultant.',
      'Sound human and conversational — never robotic, never like a translated script.',
      'Calm pace, clear diction, friendly confidence. No English words.',
    ].join(' ')
    : 'Speak as a calm, premium travel consultant. Natural conversational English.'

  const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.VITE_OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts',
      voice,
      input: text.slice(0, 2000),
      instructions,
      response_format: 'mp3',
    }),
  })

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '')
    return new Response(JSON.stringify({
      error: 'upstream_tts_error',
      status: upstream.status,
      detail: detail.slice(0, 300),
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
