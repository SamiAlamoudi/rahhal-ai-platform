/**
 * POST /api/tts — synthesize short consultant speech to MP3 (Edge neural voices).
 * Body: { text: string, locale?: 'ar' | 'en' }
 */

import { EdgeTTS } from 'edge-tts-universal'

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_CHARS = 480

function pickVoice(locale: string): string {
  return locale === 'en' ? 'en-US-JennyNeural' : 'ar-SA-ZariyahNeural'
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

  let body: { text?: unknown; locale?: unknown }
  try {
    body = (await req.json()) as { text?: unknown; locale?: unknown }
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
  const clipped = text.slice(0, MAX_CHARS)
  const voice = pickVoice(locale)

  try {
    const tts = new EdgeTTS(clipped, voice, { rate: '-5%' })
    const result = await tts.synthesize()
    const bytes = new Uint8Array(await result.audio.arrayBuffer())
    if (bytes.byteLength < 64) {
      return new Response(JSON.stringify({ error: 'empty_audio' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Rahhal-TTS-Voice': voice,
        'X-Rahhal-TTS-Bytes': String(bytes.byteLength),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'tts_failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}
