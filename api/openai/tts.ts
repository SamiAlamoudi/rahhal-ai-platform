/**
 * POST /api/openai/tts — OpenAI gpt-4o-mini-tts (ChatGPT-like speech).
 * Falls back to 503 when OPENAI_API_KEY is missing so the client can try Edge.
 *
 * Sprint 79 P0: authenticated callers only + rate limit + CORS allow-list.
 */

import { guardEdgeRequest, readServerOpenAiApiKey } from '../_lib/edgeGuard.js'

export const config = {
  runtime: 'edge',
  maxDuration: 30,
}

const ALLOWED_VOICES = new Set([
  'alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'fable',
  'marin', 'nova', 'onyx', 'sage', 'shimmer', 'verse',
])

const ALLOWED_FORMATS = new Set(['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'])

function defaultArabicInstructions(dialect?: string): string {
  const dialectHint = (() => {
    switch (dialect) {
      case 'white':
        return 'Use clear widely understood modern Arabic (العربية البيضاء).'
      case 'saudi':
        return 'Prefer natural Saudi phrasing and rhythm when comfortable; stay clear — never caricature.'
      case 'gulf':
        return 'Prefer natural Gulf phrasing when comfortable; stay clear — never caricature.'
      case 'moroccan':
        return 'Light Moroccan coloring only if clear; otherwise use natural clear Arabic (not heavy Darija imitation).'
      case 'fusha':
        return 'Use clear simplified Modern Standard Arabic — warm and conversational, not classical oratory.'
      default:
        return 'Prefer natural Saudi/Gulf conversational Arabic when comfortable; fall back to clear Arabic if unsure.'
    }
  })()

  return [
    'Speak naturally and conversationally as Rahhal, an experienced travel consultant on a live voice call.',
    'Warm, confident, calm, concise. Avoid announcer-style delivery and exaggerated emotion.',
    'Use natural pauses. Keep volume, tone, and pace consistent throughout.',
    'Do not sound like a navigation system or text reader.',
    dialectHint,
    'If a strong regional accent would sound unnatural, use clear natural Arabic instead of a poor imitation.',
    'Absolutely no English words.',
  ].join(' ')
}

function defaultEnglishInstructions(): string {
  return [
    'Speak naturally and conversationally as an experienced travel consultant.',
    'Warm, confident, calm. Avoid announcer-style delivery and exaggerated emotion.',
    'Use natural pauses. Keep volume, tone, and pace consistent.',
    'Do not sound like a navigation system or text reader.',
  ].join(' ')
}

export default async function handler(req: Request): Promise<Response> {
  const gate = await guardEdgeRequest(req, { bucket: 'openai.tts', limit: 40 })
  if (!gate.ok) return gate.response
  const corsHeaders = gate.corsHeaders

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = readServerOpenAiApiKey()
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'missing_api_key' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: {
    text?: unknown
    locale?: unknown
    voice?: unknown
    speed?: unknown
    dialect?: unknown
    instructions?: unknown
    format?: unknown
  }
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
  const requestedVoice = typeof body.voice === 'string' ? body.voice.trim().toLowerCase() : ''
  const envVoice = process.env.OPENAI_TTS_VOICE?.trim().toLowerCase() || ''
  const voice = ALLOWED_VOICES.has(requestedVoice)
    ? requestedVoice
    : (ALLOWED_VOICES.has(envVoice)
      ? envVoice
      : (locale === 'ar' ? 'coral' : 'nova'))

  const dialect = typeof body.dialect === 'string' ? body.dialect.trim().toLowerCase() : undefined
  const clientInstructions = typeof body.instructions === 'string' ? body.instructions.trim() : ''
  const instructions = clientInstructions
    || (locale === 'ar' ? defaultArabicInstructions(dialect) : defaultEnglishInstructions())

  const rawSpeed = typeof body.speed === 'number' ? body.speed : Number(body.speed)
  const speed = Number.isFinite(rawSpeed)
    ? Math.min(4, Math.max(0.25, rawSpeed))
    : 1.0

  const requestedFormat = typeof body.format === 'string' ? body.format.trim().toLowerCase() : ''
  const responseFormat = ALLOWED_FORMATS.has(requestedFormat) ? requestedFormat : 'wav'

  const model = process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts'

  const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      input: text.slice(0, 2000),
      instructions,
      response_format: responseFormat,
      speed,
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

  const contentType = responseFormat === 'wav'
    ? 'audio/wav'
    : responseFormat === 'opus'
      ? 'audio/ogg'
      : responseFormat === 'aac'
        ? 'audio/aac'
        : responseFormat === 'flac'
          ? 'audio/flac'
          : responseFormat === 'pcm'
            ? 'audio/pcm'
            : 'audio/mpeg'

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Rahhal-TTS-Model': model,
      'X-Rahhal-TTS-Voice': voice,
      'X-Rahhal-TTS-Format': responseFormat,
    },
  })
}
