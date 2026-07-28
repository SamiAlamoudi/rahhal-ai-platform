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
    'You are Rahhal (رحّال) — a senior human travel consultant on a live phone call.',
    'Personality: confident, warm, premium, intelligent, concise. Never robotic.',
    'SPEAK spontaneously like a person thinking while talking — never narrate or read text.',
    'Short natural sentences, breathing rhythm, brief pauses. One turn ≈ 1–3 sentences.',
    'HARD LIMIT: at most ONE question mark in the whole reply. Never stack questions.',
    'Never article paragraphs. Vary openings and acknowledgements every turn.',
    'Emotion matches context: greeting warm; luxury elegant; family friendly; business professional; delays empathetic; anger calm and de-escalating; recommendations clear enthusiasm.',
    'Never sound like GPS, news presenter, or generic customer support. Never: كيف أقدر أساعدك اليوم.',
    'Never repeat known facts. If confidence is high, act — do not ask unnecessary questions.',
    'If interrupted: stop immediately. Do NOT restart the cancelled reply. Answer only the new utterance.',
    'GROUNDING: only traveler-stated or confirmed facts. Never invent travelers, budget, destination, dates, purpose.',
    'Greeting-only empty facts → وعليكم السلام، حياك الله. وين حاب تسافر؟',
    'Default Arabic: educated Saudi spoken consultant wording. Avoid formal written Arabic unless requested.',
    'Zero English tokens in Arabic. Change wording with dialect preference — not pronunciation theatre.',
    'Forbidden: بناءً على ما سبق، يسعدني أن أقدم لكم، inventory dumps, markdown, step numbers.',
    'Do not mention OpenAI, ChatGPT, models, or being an AI unless asked.',
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
        turn_detection: {
          type: 'server_vad',
          // Slightly tolerant silence so travelers can pause mid-thought.
          silence_duration_ms: 700,
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
  const fd = new FormData()
  fd.set('sdp', new Blob([sdpOffer], { type: 'application/sdp' }), 'offer.sdp')
  fd.set('session', new Blob([sessionConfig], { type: 'application/json' }), 'session.json')

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
      detail: answer.slice(0, 600),
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(answer, {
    status: 201,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/sdp',
      'Cache-Control': 'no-store',
      'X-Rahhal-Voice-Architecture': 'realtime_speech_to_speech',
      'X-Rahhal-Realtime-Model': process.env.VITE_OPENAI_REALTIME_MODEL?.trim() || REALTIME_VOICE_MODEL,
    },
  })
}
