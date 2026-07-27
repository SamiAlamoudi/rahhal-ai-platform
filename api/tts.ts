/**
 * POST /api/tts — synthesize short consultant speech to MP3.
 * Uses Google Translate TTS HTTP (serverless-friendly; no WebSockets).
 * Body: { text: string, locale?: 'ar' | 'en' }
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

const MAX_CHARS = 180

function chunkText(text: string, max = MAX_CHARS): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= max) return [cleaned]
  const parts: string[] = []
  let remaining = cleaned
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf(' ', max)
    if (cut < max * 0.4) cut = max
    parts.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trim()
  }
  if (remaining) parts.push(remaining)
  return parts.filter(Boolean)
}

async function synthesizeChunk(text: string, locale: string): Promise<Uint8Array> {
  const tl = locale === 'en' ? 'en' : 'ar'
  const url =
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}`
    + `&q=${encodeURIComponent(text)}`
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: '*/*',
      Referer: 'https://translate.google.com/',
    },
  })
  if (!response.ok) {
    throw new Error(`upstream_tts_${response.status}`)
  }
  return new Uint8Array(await response.arrayBuffer())
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
  const chunks = chunkText(text).slice(0, 4)

  try {
    const parts: Uint8Array[] = []
    for (const chunk of chunks) {
      parts.push(await synthesizeChunk(chunk, locale))
    }
    const total = parts.reduce((n, p) => n + p.byteLength, 0)
    const merged = new Uint8Array(total)
    let offset = 0
    for (const part of parts) {
      merged.set(part, offset)
      offset += part.byteLength
    }
    if (merged.byteLength < 64) {
      return new Response(JSON.stringify({ error: 'empty_audio' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(merged, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Rahhal-TTS-Provider': 'gtts',
        'X-Rahhal-TTS-Bytes': String(merged.byteLength),
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
