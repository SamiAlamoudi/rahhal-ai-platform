/**
 * Moyasar webhook handler.
 *
 * Verifies MOYASAR_WEBHOOK_SECRET via:
 *   - Header X-Moyasar-Signature, or
 *   - Shared secret header/query: x-rahhal-webhook-secret / ?webhook_secret=
 *
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to update payment_sessions
 * and orders when a payment is paid. Updates are idempotent.
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-moyasar-signature, x-rahhal-webhook-secret',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function mapMoyasarStatus(status: string | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'paid':
    case 'captured':
      return 'paid'
    case 'authorized':
      return 'authorized'
    case 'failed':
      return 'failed'
    case 'refunded':
      return 'refunded'
    case 'expired':
      return 'expired'
    case 'voided':
    case 'canceled':
    case 'cancelled':
      return 'cancelled'
    default:
      return 'pending'
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return out === 0
}

function verifyWebhookSecret(req: Request, url: URL): boolean {
  const expected = Deno.env.get('MOYASAR_WEBHOOK_SECRET')
  if (!expected) {
    return false
  }

  const signature = req.headers.get('X-Moyasar-Signature')
    ?? req.headers.get('x-moyasar-signature')
  const sharedHeader = req.headers.get('x-rahhal-webhook-secret')
  const sharedQuery = url.searchParams.get('webhook_secret')

  const candidates = [signature, sharedHeader, sharedQuery].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  )

  return candidates.some((c) => timingSafeEqual(c, expected))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const url = new URL(req.url)
  if (!verifyWebhookSecret(req, url)) {
    return jsonResponse({ error: 'Unauthorized webhook', code: 'MOYASAR_WEBHOOK_UNAUTHORIZED' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({
      error: 'Supabase service credentials not configured',
      code: 'MOYASAR_WEBHOOK_MISCONFIGURED',
    }, 503)
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json() as Record<string, unknown>
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const data = (payload.data ?? payload.payment ?? payload) as Record<string, unknown>
  const paymentId = String(data.id ?? payload.id ?? '')
  if (!paymentId) {
    return jsonResponse({ error: 'Missing payment id', code: 'MOYASAR_WEBHOOK_BAD_PAYLOAD' }, 400)
  }

  const mappedStatus = mapMoyasarStatus(
    typeof data.status === 'string' ? data.status : typeof payload.status === 'string' ? payload.status : undefined,
  )
  const paidAt = mappedStatus === 'paid' ? new Date().toISOString() : null

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }

  try {
    // Look up payment_sessions by provider_reference or id
    const lookupUrl =
      `${supabaseUrl}/rest/v1/payment_sessions?or=(provider_reference.eq.${encodeURIComponent(paymentId)},id.eq.${encodeURIComponent(paymentId)})&select=*&limit=1`
    const lookupRes = await fetch(lookupUrl, { headers })
    const sessions = await lookupRes.json() as Array<Record<string, unknown>>
    if (!lookupRes.ok || !Array.isArray(sessions) || sessions.length === 0) {
      // Acknowledge webhook even if session not found (idempotent / out-of-order)
      return jsonResponse({
        ok: true,
        updated: false,
        reason: 'payment_session_not_found',
        paymentId,
        status: mappedStatus,
      })
    }

    const session = sessions[0]
    const sessionId = String(session.id)
    const orderId = String(session.order_id)
    const previousStatus = String(session.status ?? '')

    // Idempotent: skip if already in target / paid terminal state
    if (previousStatus === mappedStatus || (previousStatus === 'paid' && mappedStatus === 'paid')) {
      return jsonResponse({
        ok: true,
        updated: false,
        reason: 'already_applied',
        paymentSessionId: sessionId,
        status: previousStatus,
      })
    }

    const sessionPatch: Record<string, unknown> = {
      status: mappedStatus,
      provider_reference: paymentId,
      updated_at: new Date().toISOString(),
    }
    if (paidAt) {
      sessionPatch.paid_at = paidAt
    }

    const sessionUpdateRes = await fetch(
      `${supabaseUrl}/rest/v1/payment_sessions?id=eq.${encodeURIComponent(sessionId)}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(sessionPatch),
      },
    )
    if (!sessionUpdateRes.ok) {
      const errText = await sessionUpdateRes.text()
      return jsonResponse({
        error: 'Failed to update payment_sessions',
        details: errText,
      }, 502)
    }

    if (mappedStatus === 'paid' && orderId) {
      const orderLookup = await fetch(
        `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,status&limit=1`,
        { headers },
      )
      const orders = await orderLookup.json() as Array<{ id: string; status: string }>
      const order = Array.isArray(orders) ? orders[0] : null
      if (order && order.status !== 'paid' && order.status !== 'confirmed') {
        await fetch(
          `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              status: 'paid',
              payment_provider: 'moyasar',
              payment_session_id: sessionId,
              paid_at: paidAt,
              updated_at: new Date().toISOString(),
            }),
          },
        )
      }
    }

    if ((mappedStatus === 'failed' || mappedStatus === 'cancelled' || mappedStatus === 'expired') && orderId) {
      const orderLookup = await fetch(
        `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,status&limit=1`,
        { headers },
      )
      const orders = await orderLookup.json() as Array<{ id: string; status: string }>
      const order = Array.isArray(orders) ? orders[0] : null
      const terminal = order && (order.status === 'paid' || order.status === 'confirmed')
      if (order && !terminal) {
        const nextStatus = mappedStatus === 'cancelled' ? 'cancelled' : 'failed'
        await fetch(
          `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              status: nextStatus,
              payment_provider: 'moyasar',
              payment_session_id: sessionId,
              updated_at: new Date().toISOString(),
            }),
          },
        )
      }
    }

    // Best-effort payment event (idempotent insert by unique not guaranteed — ignore errors)
    await fetch(`${supabaseUrl}/rest/v1/payment_events`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        payment_session_id: sessionId,
        event_type: 'webhook',
        from_status: previousStatus,
        to_status: mappedStatus,
        details: { provider: 'moyasar', paymentId, source: 'moyasar-webhook' },
      }),
    }).catch(() => undefined)

    return jsonResponse({
      ok: true,
      updated: true,
      paymentSessionId: sessionId,
      orderId,
      status: mappedStatus,
    })
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Webhook processing failed',
      code: 'MOYASAR_WEBHOOK_ERROR',
    }, 502)
  }
})
