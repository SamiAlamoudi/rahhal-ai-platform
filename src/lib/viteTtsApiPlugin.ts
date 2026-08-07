/**
 * Dev middleware mirroring production POST /api/tts.
 */
import type { Plugin } from 'vite'

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

async function synthesizeChunk(text: string, locale: string): Promise<Buffer> {
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
  if (!response.ok) throw new Error(`upstream_tts_${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

export function ttsApiPlugin(): Plugin {
  return {
    name: 'platform-tts-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/tts')) {
          next()
          return
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 200
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
          res.end('ok')
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          }
          const raw = Buffer.concat(chunks).toString('utf8')
          const body = JSON.parse(raw || '{}') as { text?: unknown; locale?: unknown }
          const text = typeof body.text === 'string' ? body.text.trim() : ''
          if (!text) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'text required' }))
            return
          }
          const locale = body.locale === 'en' ? 'en' : 'ar'
          const parts = chunkText(text).slice(0, 4)
          const buffers: Buffer[] = []
          for (const part of parts) {
            buffers.push(await synthesizeChunk(part, locale))
          }
          const bytes = Buffer.concat(buffers)
          res.statusCode = 200
          res.setHeader('Content-Type', 'audio/mpeg')
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('X-Rahhal-TTS-Provider', 'gtts')
          res.end(bytes)
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : 'tts_failed',
          }))
        }
      })
    },
  }
}
