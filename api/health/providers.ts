/**
 * Vercel Edge Function — provider health for Admin + ops.
 *
 * GET /api/health/providers
 *
 * {
 *   "amadeus": "connected" | "missing_credentials" | ...,
 *   "fallback": boolean
 * }
 */

import { probeAmadeusConnection } from '../_lib/amadeusEnv.js'

export const config = {
  runtime: 'edge',
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const health = await probeAmadeusConnection(process.env)
  return new Response(JSON.stringify(health), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
