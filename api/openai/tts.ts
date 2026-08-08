/**
 * POST /api/openai/tts — OpenAI gpt-4o-mini-tts (ChatGPT-like speech).
 *
 * Safe diagnostics: never leak API keys / bearer tokens.
 * Upstream failures map to stable TTS_* codes (not a generic opaque 502).
 */

import { guardEdgeRequest, readServerOpenAiApiKey } from '../_lib/edgeGuard.js'
import {
  classifyOpenAiKey,
  contentTypeForFormat,
  defaultArabicInstructions,
  defaultEnglishInstructions,
  extractUpstreamSafeErrorCode,
  httpStatusForSafeCode,
  isAudioContentType,
  looksLikeJsonBytes,
  mapUpstreamStatusToSafeCode,
  resolveTtsFormat,
  resolveTtsVoice,
  sanitizeUpstreamDetail,
  type TtsDiagStage,
  type TtsSafeCode,
} from '../_lib/openaiTts.js'

export const config = {
  runtime: 'edge',
  maxDuration: 30,
}

function jsonError(
  corsHeaders: Record<string, string>,
  status: number,
  code: TtsSafeCode | string,
  stages: string[],
  extra?: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify({
    error: code,
    code,
    stages,
    ...extra,
  }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Rahhal-TTS-Safe-Code': code,
      'X-Rahhal-TTS-Stages': stages.slice(-12).join(','),
    },
  })
}

export default async function handler(req: Request): Promise<Response> {
  const stages: TtsDiagStage[] = ['TTS_ROUTE_ENTERED']

  const gate = await guardEdgeRequest(req, { bucket: 'openai.tts', limit: 40 })
  if (!gate.ok) return gate.response
  const corsHeaders = gate.corsHeaders
  stages.push('TTS_AUTH_OK')

  if (req.method === 'GET') {
    const keyInfo = classifyOpenAiKey(readServerOpenAiApiKey())
    if (keyInfo.present) stages.push('TTS_ENV_KEY_PRESENT')
    else stages.push('TTS_ENV_KEY_MISSING')
    const model = process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts'
    return new Response(JSON.stringify({
      KEY_PRESENT: keyInfo.present ? 'yes' : 'no',
      KEY_PLAUSIBLE: keyInfo.plausible ? 'yes' : 'no',
      model,
      stages,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED', stages }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = readServerOpenAiApiKey()
  const keyInfo = classifyOpenAiKey(apiKey)
  if (!keyInfo.present) {
    stages.push('TTS_ENV_KEY_MISSING')
    return jsonError(corsHeaders, 503, 'TTS_CONFIG_MISSING', stages)
  }
  stages.push('TTS_ENV_KEY_PRESENT')
  if (!keyInfo.plausible) {
    // Non-empty but not a usable OpenAI secret (placeholder / truncated).
    return jsonError(corsHeaders, 503, 'TTS_CONFIG_MISSING', stages, {
      reason: 'key_shape_invalid',
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
    return jsonError(corsHeaders, 400, 'TTS_UPSTREAM_400', stages, { reason: 'invalid_json' })
  }

  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) {
    return jsonError(corsHeaders, 400, 'TTS_UPSTREAM_400', stages, { reason: 'text_required' })
  }

  const locale = body.locale === 'en' ? 'en' : 'ar'
  const voice = resolveTtsVoice({
    requestedVoice: typeof body.voice === 'string' ? body.voice : undefined,
    envVoice: process.env.OPENAI_TTS_VOICE,
    locale,
  })
  const dialect = typeof body.dialect === 'string' ? body.dialect.trim().toLowerCase() : undefined
  const clientInstructions = typeof body.instructions === 'string' ? body.instructions.trim() : ''
  const instructions = clientInstructions
    || (locale === 'ar' ? defaultArabicInstructions(dialect) : defaultEnglishInstructions())

  const rawSpeed = typeof body.speed === 'number' ? body.speed : Number(body.speed)
  const speed = Number.isFinite(rawSpeed)
    ? Math.min(4, Math.max(0.25, rawSpeed))
    : 1.0

  const responseFormat = resolveTtsFormat(
    typeof body.format === 'string' ? body.format : undefined,
  )
  const model = process.env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts'

  stages.push(`TTS_MODEL_${model}`)
  stages.push(`TTS_VOICE_${voice}`)
  stages.push(`TTS_FORMAT_${responseFormat}`)
  stages.push('TTS_UPSTREAM_REQUEST_STARTED')

  let upstream: Response
  try {
    upstream = await fetch('https://api.openai.com/v1/audio/speech', {
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
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error'
    const code: TtsSafeCode =
      name === 'AbortError' || name === 'TimeoutError'
        ? 'TTS_UPSTREAM_TIMEOUT'
        : 'TTS_UPSTREAM_NETWORK'
    stages.push(`TTS_UPSTREAM_STATUS_0`)
    stages.push(`TTS_UPSTREAM_ERROR_CODE_${code}`)
    return jsonError(corsHeaders, httpStatusForSafeCode(code), code, stages, {
      firstFailedStage: 'TTS_UPSTREAM_REQUEST_STARTED',
    })
  }

  stages.push(`TTS_UPSTREAM_STATUS_${upstream.status}`)
  const upstreamCt = upstream.headers.get('content-type') || ''
  stages.push(`TTS_UPSTREAM_CONTENT_TYPE_${upstreamCt.split(';')[0]?.trim() || 'none'}`)

  if (!upstream.ok) {
    const detailRaw = await upstream.text().catch(() => '')
    const upstreamCode = extractUpstreamSafeErrorCode(detailRaw)
    const code = mapUpstreamStatusToSafeCode(upstream.status)
    if (upstreamCode) stages.push(`TTS_UPSTREAM_ERROR_CODE_${upstreamCode}`)
    else stages.push(`TTS_UPSTREAM_ERROR_CODE_${code}`)
    return jsonError(corsHeaders, httpStatusForSafeCode(code), code, stages, {
      upstreamStatus: upstream.status,
      upstreamErrorCode: upstreamCode,
      detail: sanitizeUpstreamDetail(detailRaw),
      model,
      voice,
      format: responseFormat,
      firstFailedStage: `TTS_UPSTREAM_STATUS_${upstream.status}`,
    })
  }

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await upstream.arrayBuffer())
  } catch {
    const code: TtsSafeCode = 'TTS_RESPONSE_CONVERSION_FAILED'
    stages.push(`TTS_UPSTREAM_ERROR_CODE_${code}`)
    return jsonError(corsHeaders, httpStatusForSafeCode(code), code, stages, {
      firstFailedStage: 'TTS_RESPONSE_CONVERSION_FAILED',
    })
  }

  stages.push(`TTS_UPSTREAM_BYTES_${bytes.byteLength}`)

  // Never convert an upstream JSON error body into an audio response.
  if (looksLikeJsonBytes(bytes) || (upstreamCt.includes('application/json') && !isAudioContentType(upstreamCt))) {
    const detail = sanitizeUpstreamDetail(new TextDecoder().decode(bytes))
    const code: TtsSafeCode = 'TTS_INVALID_CONTENT_TYPE'
    stages.push(`TTS_UPSTREAM_ERROR_CODE_${code}`)
    return jsonError(corsHeaders, httpStatusForSafeCode(code), code, stages, {
      firstFailedStage: 'TTS_INVALID_CONTENT_TYPE',
      detail,
    })
  }

  if (upstreamCt && !isAudioContentType(upstreamCt) && !upstreamCt.includes('octet-stream')) {
    const code: TtsSafeCode = 'TTS_INVALID_CONTENT_TYPE'
    stages.push(`TTS_UPSTREAM_ERROR_CODE_${code}`)
    return jsonError(corsHeaders, httpStatusForSafeCode(code), code, stages, {
      firstFailedStage: 'TTS_INVALID_CONTENT_TYPE',
      contentType: upstreamCt.split(';')[0]?.trim() || null,
    })
  }

  if (bytes.byteLength < 64) {
    const code: TtsSafeCode = 'TTS_EMPTY_RESPONSE'
    stages.push(`TTS_UPSTREAM_ERROR_CODE_${code}`)
    return jsonError(corsHeaders, httpStatusForSafeCode(code), code, stages, {
      firstFailedStage: 'TTS_EMPTY_RESPONSE',
      bytes: bytes.byteLength,
    })
  }

  stages.push('TTS_RESPONSE_READY')
  const contentType = contentTypeForFormat(responseFormat)

  return new Response(bytes, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Rahhal-TTS-Model': model,
      'X-Rahhal-TTS-Voice': voice,
      'X-Rahhal-TTS-Format': responseFormat,
      'X-Rahhal-TTS-Safe-Code': 'TTS_RESPONSE_READY',
      'X-Rahhal-TTS-Stages': stages.slice(-12).join(','),
      'X-Rahhal-TTS-Bytes': String(bytes.byteLength),
    },
  })
}
