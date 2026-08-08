/**
 * Preview-only classic TTS self-check (no user JWT).
 * Gated by VERCEL_ENV !== production. Never returns secrets.
 *
 * Distinguishes:
 *  A) OpenAI request never sent (missing/invalid key shape)
 *  B) OpenAI rejects request
 *  C) OpenAI returns non-audio / empty
 *  D) network/timeout
 */

import { readServerOpenAiApiKey } from '../_lib/edgeGuard.js'
import {
  classifyOpenAiKey,
  extractUpstreamSafeErrorCode,
  isAudioContentType,
  looksLikeJsonBytes,
  mapUpstreamStatusToSafeCode,
  sanitizeUpstreamDetail,
} from '../_lib/openaiTts.js'

export const config = {
  runtime: 'edge',
  maxDuration: 30,
}

export default async function handler(req: Request): Promise<Response> {
  const vercelEnv = (process.env.VERCEL_ENV || '').trim().toLowerCase()
  if (vercelEnv === 'production') {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const stages: string[] = ['TTS_ROUTE_ENTERED']
  const keyInfo = classifyOpenAiKey(readServerOpenAiApiKey())
  const model = process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts'
  const voice = 'marin'
  const format = 'mp3'

  if (!keyInfo.present) {
    stages.push('TTS_ENV_KEY_MISSING')
    return Response.json({
      KEY_PRESENT: 'no',
      firstFailedStage: 'TTS_ENV_KEY_MISSING',
      code: 'TTS_CONFIG_MISSING',
      model,
      voice,
      format,
      stages,
    }, { status: 503 })
  }
  stages.push('TTS_ENV_KEY_PRESENT')
  if (!keyInfo.plausible) {
    return Response.json({
      KEY_PRESENT: 'yes',
      KEY_PLAUSIBLE: 'no',
      firstFailedStage: 'TTS_ENV_KEY_PRESENT',
      code: 'TTS_CONFIG_MISSING',
      model,
      voice,
      format,
      stages,
      reason: 'key_shape_invalid',
    }, { status: 503 })
  }

  stages.push(`TTS_MODEL_${model}`, `TTS_VOICE_${voice}`, `TTS_FORMAT_${format}`, 'TTS_UPSTREAM_REQUEST_STARTED')

  let upstream: Response
  try {
    upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${readServerOpenAiApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        input: 'مرحباً، أنا بيلامو.',
        instructions: 'Speak naturally in clear Arabic as Bilamo. Warm, confident, concise.',
        response_format: format,
        speed: 1,
      }),
    })
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error'
    const code = name === 'AbortError' || name === 'TimeoutError'
      ? 'TTS_UPSTREAM_TIMEOUT'
      : 'TTS_UPSTREAM_NETWORK'
    stages.push('TTS_UPSTREAM_STATUS_0', `TTS_UPSTREAM_ERROR_CODE_${code}`)
    return Response.json({
      KEY_PRESENT: 'yes',
      KEY_PLAUSIBLE: 'yes',
      firstFailedStage: 'TTS_UPSTREAM_REQUEST_STARTED',
      code,
      upstreamStatus: 0,
      model,
      voice,
      format,
      stages,
    }, { status: 502 })
  }

  stages.push(`TTS_UPSTREAM_STATUS_${upstream.status}`)
  const ct = upstream.headers.get('content-type') || ''
  stages.push(`TTS_UPSTREAM_CONTENT_TYPE_${ct.split(';')[0]?.trim() || 'none'}`)

  const buf = new Uint8Array(await upstream.arrayBuffer().catch(() => new ArrayBuffer(0)))
  stages.push(`TTS_UPSTREAM_BYTES_${buf.byteLength}`)

  if (!upstream.ok) {
    const detail = new TextDecoder().decode(buf)
    const upstreamErrorCode = extractUpstreamSafeErrorCode(detail)
    const code = mapUpstreamStatusToSafeCode(upstream.status)
    if (upstreamErrorCode) stages.push(`TTS_UPSTREAM_ERROR_CODE_${upstreamErrorCode}`)
    return Response.json({
      KEY_PRESENT: 'yes',
      KEY_PLAUSIBLE: 'yes',
      firstFailedStage: `TTS_UPSTREAM_STATUS_${upstream.status}`,
      code,
      upstreamStatus: upstream.status,
      upstreamErrorCode,
      detail: sanitizeUpstreamDetail(detail),
      contentType: ct.split(';')[0]?.trim() || null,
      bytes: buf.byteLength,
      model,
      voice,
      format,
      stages,
    }, { status: 502 })
  }

  if (buf.byteLength < 64) {
    return Response.json({
      KEY_PRESENT: 'yes',
      firstFailedStage: 'TTS_EMPTY_RESPONSE',
      code: 'TTS_EMPTY_RESPONSE',
      upstreamStatus: upstream.status,
      bytes: buf.byteLength,
      model,
      voice,
      format,
      stages,
    }, { status: 502 })
  }

  if (looksLikeJsonBytes(buf) || (ct.includes('json') && !isAudioContentType(ct))) {
    return Response.json({
      KEY_PRESENT: 'yes',
      firstFailedStage: 'TTS_INVALID_CONTENT_TYPE',
      code: 'TTS_INVALID_CONTENT_TYPE',
      upstreamStatus: upstream.status,
      detail: sanitizeUpstreamDetail(new TextDecoder().decode(buf)),
      contentType: ct.split(';')[0]?.trim() || null,
      bytes: buf.byteLength,
      model,
      voice,
      format,
      stages,
    }, { status: 502 })
  }

  stages.push('TTS_RESPONSE_READY')
  return Response.json({
    KEY_PRESENT: 'yes',
    KEY_PLAUSIBLE: 'yes',
    firstFailedStage: null,
    code: 'TTS_RESPONSE_READY',
    upstreamStatus: upstream.status,
    contentType: ct.split(';')[0]?.trim() || contentTypeForMp3(),
    bytes: buf.byteLength,
    model,
    voice,
    format,
    stages,
  }, { status: 200 })
}

function contentTypeForMp3(): string {
  return 'audio/mpeg'
}
