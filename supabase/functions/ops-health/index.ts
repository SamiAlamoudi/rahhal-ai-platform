/**
 * Phase X ops probes — health / readiness / liveness for staging gateways.
 * Secrets are never returned. CORS allowlist via OPS_ALLOWED_ORIGINS (comma-separated).
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

type Probe = 'health' | 'ready' | 'live'

function corsHeaders(req: Request): HeadersInit {
  const allowlist = (Deno.env.get('OPS_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const origin = req.headers.get('Origin')
  const allowOrigin = allowlist.length === 0
    ? '*'
    : (origin && allowlist.includes(origin) ? origin : allowlist[0] ?? 'null')

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }
}

function parseProbe(url: URL): Probe {
  const path = url.pathname.toLowerCase()
  if (path.endsWith('/live') || path.endsWith('/liveness')) return 'live'
  if (path.endsWith('/ready') || path.endsWith('/readiness')) return 'ready'
  const q = url.searchParams.get('probe')
  if (q === 'live' || q === 'ready' || q === 'health') return q
  return 'health'
}

serve(async (req) => {
  const headers = corsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
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
    // Never include secret values
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
