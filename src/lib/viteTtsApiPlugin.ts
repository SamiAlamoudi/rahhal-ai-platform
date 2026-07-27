/**
 * Dev middleware mirroring production POST /api/tts (Edge neural MP3).
 */
import type { Plugin } from 'vite'
import { EdgeTTS } from 'edge-tts-universal'

const MAX_CHARS = 480

function pickVoice(locale: string): string {
  return locale === 'en' ? 'en-US-JennyNeural' : 'ar-SA-ZariyahNeural'
}

export function ttsApiPlugin(): Plugin {
  return {
    name: 'rahhal-tts-api',
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
          const voice = pickVoice(locale)
          const tts = new EdgeTTS(text.slice(0, MAX_CHARS), voice, { rate: '-5%' })
          const result = await tts.synthesize()
          const bytes = Buffer.from(await result.audio.arrayBuffer())
          res.statusCode = 200
          res.setHeader('Content-Type', 'audio/mpeg')
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Access-Control-Allow-Origin', '*')
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
