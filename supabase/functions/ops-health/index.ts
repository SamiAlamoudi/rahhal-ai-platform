/**
 * Phase X ops probes — health / readiness / liveness for staging gateways.
 * Secrets are never returned. CORS allowlist via EDGE_ALLOWED_ORIGINS / OPS_ALLOWED_ORIGINS.
 * Probes remain unauthenticated so load balancers can scrape them; privileged
 * data is never returned.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { buildCorsHeaders, corsPreflightResponse } from '../_shared/edgeSecurity.ts'

type Probe = 'health' | 'ready' | 'live'

function parseProbe(url: URL): Probe {
  const path = url.pathname.toLowerCase()
  if (path.endsWith('/live') || path.endsWith('/liveness')) return 'live'
  if (path.endsWith('/ready') || path.endsWith('/readiness')) return 'ready'
  const q = url.searchParams.get('probe')
  if (q === 'live' || q === 'ready' || q === 'health') return q
  return 'health'
}

serve(async (req) => {
  const headers = buildCorsHeaders(req, { methods: ['GET', 'OPTIONS'] })
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req, { methods: ['GET', 'OPTIONS'] })
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ status: 'fail', error: 'method_not_allowed' }), {
      status: 405,
      headers,
    })
  }

  const url = new URL(req.url)
  const probe = parseProbe(url)
  const paymentProvider = (Deno.env.get('VITE_PAYMENT_PROVIDER') ?? Deno.env.get('PAYMENT_PROVIDER') ?? 'mock').toLowerCase()
  const liveEnabled = ['1', 'true', 'yes'].includes(
    (Deno.env.get('VITE_LIVE_PROVIDERS_ENABLED') ?? Deno.env.get('LIVE_PROVIDERS_ENABLED') ?? 'false').toLowerCase(),
  )

  if (probe === 'live') {
    return new Response(JSON.stringify({
      status: 'ok',
      probe: 'liveness',
      ts: new Date().toISOString(),
      checks: { process: { ok: true } },
    }), { status: 200, headers })
  }

  const paymentOk = paymentProvider === 'mock'
  const forbiddenClientSecrets = [
    'VITE_AMADEUS_CLIENT_SECRET',
    'VITE_GOOGLE_MAPS_API_KEY',
    'VITE_OPENWEATHER_API_KEY',
    'VITE_MOYASAR_SECRET_KEY',
    'VITE_OPENAI_API_KEY',
    'VITE_AGENT_OPENAI_API_KEY',
    'VITE_RAPIDAPI_KEY',
    'VITE_BOOKING_API_KEY',
  ].filter((k) => Boolean(Deno.env.get(k)))

  const checks = {
    payment_provider_safe: {
      ok: paymentOk,
      detail: paymentOk ? 'mock' : 'live_payment_blocked',
    },
    no_client_secrets: {
      ok: forbiddenClientSecrets.length === 0,
      detail: forbiddenClientSecrets.length === 0 ? 'clean' : forbiddenClientSecrets.join(','),
    },
    live_providers: {
      ok: true,
      detail: liveEnabled ? 'enabled' : 'disabled_default',
    },
  }

  const ok = Object.values(checks).every((c) => c.ok)
  const body = {
    status: ok ? 'ok' : 'fail',
    probe: probe === 'ready' ? 'readiness' : 'health',
    ts: new Date().toISOString(),
    checks,
    summary: {
      paymentProvider,
      liveProvidersEnabled: liveEnabled,
    },
  }

  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 503,
    headers,
  })
})
