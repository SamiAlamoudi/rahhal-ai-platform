/**
 * POST /api/openai/realtime-session — mint ephemeral Realtime client secret (probe + optional client use).
 * GET — capability probe without minting.
 */

export const config = {
  runtime: 'edge',
  maxDuration: 30,
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, openai-safety-identifier',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
}

const REALTIME_VOICE_MODEL = 'gpt-realtime-2.1'

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

  const apiKey = readApiKey()
  const model = process.env.VITE_OPENAI_REALTIME_MODEL?.trim() || REALTIME_VOICE_MODEL

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
          'You are Rahhal, a concise Arabic travel consultant on a live call.',
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
