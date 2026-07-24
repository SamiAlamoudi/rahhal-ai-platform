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
import {
  buildCorsHeaders,
  corsPreflightResponse,
  jsonEdgeResponse,
} from '../_lib/edgeSecurity.js'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request): Promise<Response> {
  const cors = buildCorsHeaders(req, { methods: ['GET', 'OPTIONS'] })

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req, { methods: ['GET', 'OPTIONS'] })
  }

  if (req.method !== 'GET') {
    return jsonEdgeResponse({ error: 'Method not allowed' }, 405, cors)
  }

  const health = await probeAmadeusConnection(process.env)
  return jsonEdgeResponse(health, 200, cors)
}
