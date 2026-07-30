/**
 * POST /api/openai/realtime-call — Unified WebRTC Realtime session (GA).
 * Browser posts SDP offer; server authenticates with OPENAI_API_KEY and returns SDP answer.
 *
 * This is speech-to-speech (gpt-realtime-*), NOT gpt-4o-mini-tts.
 *
 * GET  → capability probe (configured + preferred model)
 * POST → multipart/raw SDP → OpenAI /v1/realtime/calls
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

/** Highest-quality public Realtime voice-agent model per OpenAI docs (2026). */
export const REALTIME_VOICE_MODEL = 'gpt-realtime-2.1'

function readApiKey(): string | null {
  const raw = (
    process.env.OPENAI_API_KEY
    || process.env.VITE_AGENT_OPENAI_API_KEY
    || process.env.VITE_OPENAI_API_KEY
  )?.trim()
  return raw || null
}

function defaultInstructions(dialectHint?: string): string {
  return [
    'You are Rahhal (رحّال) — a live BOOKING AGENT for flights and hotels.',
    'NOT a travel consultant, blogger, or advice engine.',
    'Workflow only: Collect missing booking fields → Search → Show options → Compare → Book.',
    'Never tell the traveler to use Booking.com, Kayak, Google Flights, or any other website.',
    'Never give destination lectures or unsought advice.',
    'Speak Arabic only unless the traveler explicitly switches language.',
    'Short replies (20–40 words). At most ONE question.',
    'When asked to speak a DIALOGUE block, speak it verbatim — do not expand or add advice.',
    'Do not mention OpenAI/ChatGPT/AI unless asked.',
    dialectHint
      ? `Speaking style: ${dialectHint}`
      : 'Prefer natural educated Saudi/Gulf conversational Arabic; otherwise clear natural Arabic.',
  ].join(' ')
}

function buildSessionConfig(input: {
  voice?: string
  instructions?: string
  dialectHint?: string
}): string {
  const voice = (input.voice || 'marin').trim() || 'marin'
  const instructions = (input.instructions || defaultInstructions(input.dialectHint)).trim()
  return JSON.stringify({
    type: 'realtime',
    model: process.env.VITE_OPENAI_REALTIME_MODEL?.trim() || REALTIME_VOICE_MODEL,
    instructions,
    audio: {
      input: {
        // Explicit Arabic transcription — do not leave language auto-detect unconstrained.
        transcription: {
          model: 'gpt-4o-mini-transcribe',
          language: 'ar',
        },
        turn_detection: {
          type: 'semantic_vad',
          eagerness: 'low',
          create_response: false,
          interrupt_response: false,
        },
      },
      output: {
        voice,
      },
    },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = readApiKey()

  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      configured: Boolean(apiKey),
      architecture: 'realtime_speech_to_speech',
      model: process.env.VITE_OPENAI_REALTIME_MODEL?.trim() || REALTIME_VOICE_MODEL,
      note: 'ChatGPT GPT-Live models are not on the public API; gpt-realtime-2.1 is the highest-quality public voice-agent stack.',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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

  const contentType = req.headers.get('content-type') || ''
  let sdpOffer = ''
  let voice: string | undefined
  let instructions: string | undefined
  let dialectHint: string | undefined

  if (contentType.includes('application/json')) {
    try {
      const body = await req.json() as {
        sdp?: unknown
        voice?: unknown
        instructions?: unknown
        dialectHint?: unknown
      }
      sdpOffer = typeof body.sdp === 'string' ? body.sdp : ''
      voice = typeof body.voice === 'string' ? body.voice : undefined
      instructions = typeof body.instructions === 'string' ? body.instructions : undefined
      dialectHint = typeof body.dialectHint === 'string' ? body.dialectHint : undefined
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } else {
    // Unified interface: raw SDP body
    sdpOffer = await req.text()
  }

  if (!sdpOffer.trim()) {
    return new Response(JSON.stringify({ error: 'sdp required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sessionConfig = buildSessionConfig({ voice, instructions, dialectHint })
  // OpenAI unified interface expects multipart *string* fields (not file Blobs).
  // Blob+filename uploads are rejected: "field \"sdp\" is required but not found".
  const fd = new FormData()
  fd.set('sdp', sdpOffer)
  fd.set('session', sessionConfig)

  const safety = req.headers.get('openai-safety-identifier') || undefined
  const upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(safety ? { 'OpenAI-Safety-Identifier': safety } : {}),
    },
    body: fd,
  })

  const answer = await upstream.text()
  if (!upstream.ok) {
    return new Response(JSON.stringify({
      error: 'upstream_realtime_error',
      status: upstream.status,
      detail: answer.slice(0, 800),
      model: process.env.VITE_OPENAI_REALTIME_MODEL?.trim() || REALTIME_VOICE_MODEL,
    }), {
      // Preserve upstream 4xx as 502 for client contract, but surface detail for logs.
      status: 502,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Rahhal-Upstream-Status': String(upstream.status),
      },
    })
  }

  // Successful unified-interface calls return SDP answer text.
  const okStatus = upstream.status === 200 || upstream.status === 201 ? upstream.status : 201
  return new Response(answer, {
    status: okStatus,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/sdp',
      'Cache-Control': 'no-store',
      'X-Rahhal-Voice-Architecture': 'realtime_speech_to_speech',
      'X-Rahhal-Realtime-Model': process.env.VITE_OPENAI_REALTIME_MODEL?.trim() || REALTIME_VOICE_MODEL,
    },
  })
}
