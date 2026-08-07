/**
 * POST /api/openai/realtime-session — mint ephemeral Realtime client secret (probe + optional client use).
 * GET — capability probe without minting.
 *
 * Sprint 79 P0: authenticated callers only + rate limit + CORS allow-list.
 */

import { guardEdgeRequest, readServerOpenAiApiKey } from '../_lib/edgeGuard.js'

export const config = {
  runtime: 'edge',
  maxDuration: 30,
}

const REALTIME_VOICE_MODEL = 'gpt-realtime-2.1'

export default async function handler(req: Request): Promise<Response> {
  const gate = await guardEdgeRequest(req, { bucket: 'openai.realtime_session', limit: 20 })
  if (!gate.ok) return gate.response
  const corsHeaders = gate.corsHeaders

  const apiKey = readServerOpenAiApiKey()
  const model = process.env.OPENAI_REALTIME_MODEL?.trim() || REALTIME_VOICE_MODEL

  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      configured: Boolean(apiKey),
      model,
      architecture: 'realtime_speech_to_speech',
      chatgptVoiceParity: {
        gptLiveOnPublicApi: false,
        evidence: 'OpenAI Introducing GPT-Live (2026-07-08): models rolling out in ChatGPT; "We also plan to bring them to the API soon."',
        highestPublicVoiceAgentModel: model,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'missing_api_key' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let voice = 'marin'
  let instructions: string | undefined
  try {
    const body = await req.json().catch(() => ({})) as { voice?: unknown; instructions?: unknown }
    if (typeof body.voice === 'string' && body.voice.trim()) voice = body.voice.trim()
    if (typeof body.instructions === 'string' && body.instructions.trim()) {
      instructions = body.instructions.trim()
    }
  } catch {
    // ignore
  }

  const safety = req.headers.get('openai-safety-identifier') || undefined
  const upstream = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(safety ? { 'OpenAI-Safety-Identifier': safety } : {}),
    },
    body: JSON.stringify({
      expires_after: { anchor: 'created_at', seconds: 600 },
      session: {
        type: 'realtime',
        model,
        instructions: instructions || [
          'You are Bilamo, a concise Arabic travel consultant on a live call.',
          'SPEAK, do not narrate. Short spoken sentences. One question max.',
          'Never invent trip facts. If interrupted, do not restart the cancelled reply.',
        ].join(' '),
        audio: { output: { voice } },
      },
    }),
  })

  const detail = await upstream.text()
  if (!upstream.ok) {
    return new Response(JSON.stringify({
      error: 'upstream_client_secret_error',
      status: upstream.status,
      detail: detail.slice(0, 800),
      model,
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(detail, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Rahhal-Realtime-Model': model,
    },
  })
}
