/**
 * Moyasar payment Edge Function (server-side only).
 *
 * Holds MOYASAR_SECRET_KEY server-side. The SPA never sees the secret —
 * it calls this function with the Supabase anon key.
 *
 * Deploy secrets:
 *   MOYASAR_SECRET_KEY
 *   (optional) MOYASAR_BASE_URL=https://api.moyasar.com
 *
 * POST body: { action: 'create_session' | 'authorize' | 'capture' | 'status', ... }
 */

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_MOYASAR_HOST = 'https://api.moyasar.com'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function basicAuthHeader(secretKey: string): string {
  return `Basic ${btoa(`${secretKey}:`)}`
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
    case 'voided':
    case 'canceled':
    case 'cancelled':
      return 'cancelled'
    case 'initiated':
    default:
      return 'pending'
  }
}

interface CreateSessionBody {
  action: 'create_session'
  amount: number
  currency?: string
  description?: string
  callbackUrl?: string
  callback_url?: string
  orderId?: string
  orderNumber?: string
  metadata?: Record<string, unknown>
}

interface SessionActionBody {
  action: 'authorize' | 'capture' | 'status'
  paymentSessionId?: string
  payment_id?: string
}

type RequestBody = CreateSessionBody | SessionActionBody | { action?: string }

function paymentIdFromBody(body: SessionActionBody): string | null {
  return body.paymentSessionId ?? body.payment_id ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const secretKey = Deno.env.get('MOYASAR_SECRET_KEY')
  if (!secretKey) {
    return jsonResponse({
      error: 'Moyasar secret key is not configured on the server',
      code: 'MOYASAR_SERVER_NOT_CONFIGURED',
    }, 503)
  }

  const host = (Deno.env.get('MOYASAR_BASE_URL') || DEFAULT_MOYASAR_HOST).replace(/\/+$/, '')
  let body: RequestBody
  try {
    body = await req.json() as RequestBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', code: 'MOYASAR_BAD_REQUEST' }, 400)
  }

  const action = body.action
  if (!action) {
    return jsonResponse({ error: 'Missing action', code: 'MOYASAR_BAD_REQUEST' }, 400)
  }

  try {
    if (action === 'create_session') {
      const createBody = body as CreateSessionBody
      const amount = Number(createBody.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonResponse({ error: 'Invalid amount', code: 'MOYASAR_BAD_REQUEST' }, 400)
      }

      const currency = (createBody.currency || 'SAR').toUpperCase()
      const description = createBody.description || 'Rahhal payment'
      const callbackUrl = createBody.callbackUrl ?? createBody.callback_url ?? ''
      const amountHalalas = Math.round(amount * 100)

      const payload: Record<string, unknown> = {
        amount: amountHalalas,
        currency,
        description,
        metadata: {
          ...createBody.metadata,
          orderId: createBody.orderId ?? null,
          orderNumber: createBody.orderNumber ?? null,
        },
      }
      if (callbackUrl) {
        payload.callback_url = callbackUrl
      }

      const response = await fetch(`${host}/v1/payments`, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(secretKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const text = await response.text()
      let data: Record<string, unknown> = {}
      try {
        data = text ? JSON.parse(text) as Record<string, unknown> : {}
      } catch {
        data = { raw: text }
      }

      if (!response.ok) {
        return jsonResponse({
          error: 'Moyasar create payment failed',
          code: 'MOYASAR_CREATE_FAILED',
          status: response.status,
          details: data,
        }, response.status >= 400 && response.status < 500 ? response.status : 502)
      }

      const paymentId = String(data.id ?? '')
      const status = mapMoyasarStatus(typeof data.status === 'string' ? data.status : undefined)
      const source = (data.source ?? {}) as Record<string, unknown>
      const redirectUrl =
        (typeof source.transaction_url === 'string' && source.transaction_url)
        || (typeof data.transaction_url === 'string' && data.transaction_url)
        || null

      return jsonResponse({
        paymentSessionId: paymentId,
        providerId: 'moyasar',
        status,
        providerReference: paymentId,
        redirectUrl,
        message: 'Moyasar payment session created',
      })
    }

    if (action === 'authorize' || action === 'capture' || action === 'status') {
      const sessionBody = body as SessionActionBody
      const paymentId = paymentIdFromBody(sessionBody)
      if (!paymentId) {
        return jsonResponse({ error: 'Missing paymentSessionId', code: 'MOYASAR_BAD_REQUEST' }, 400)
      }

      if (action === 'capture') {
        const captureRes = await fetch(`${host}/v1/payments/${paymentId}/capture`, {
          method: 'POST',
          headers: {
            Authorization: basicAuthHeader(secretKey),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
        const captureText = await captureRes.text()
        let captureData: Record<string, unknown> = {}
        try {
          captureData = captureText ? JSON.parse(captureText) as Record<string, unknown> : {}
        } catch {
          captureData = { raw: captureText }
        }
        if (!captureRes.ok) {
          // Fall through to status fetch if already captured / not captureable
          if (captureRes.status !== 400 && captureRes.status !== 422) {
            return jsonResponse({
              error: 'Moyasar capture failed',
              code: 'MOYASAR_CAPTURE_FAILED',
              status: captureRes.status,
              details: captureData,
            }, 502)
          }
        } else {
          const status = mapMoyasarStatus(
            typeof captureData.status === 'string' ? captureData.status : 'paid',
          )
          return jsonResponse({
            paymentSessionId: paymentId,
            providerId: 'moyasar',
            status,
            providerReference: paymentId,
            redirectUrl: null,
            message: 'Payment captured',
          })
        }
      }

      const response = await fetch(`${host}/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: basicAuthHeader(secretKey),
        },
      })

      const text = await response.text()
      let data: Record<string, unknown> = {}
      try {
        data = text ? JSON.parse(text) as Record<string, unknown> : {}
      } catch {
        data = { raw: text }
      }

      if (!response.ok) {
        return jsonResponse({
          error: 'Moyasar payment lookup failed',
          code: 'MOYASAR_STATUS_FAILED',
          status: response.status,
          details: data,
        }, response.status === 404 ? 404 : 502)
      }

      let status = mapMoyasarStatus(typeof data.status === 'string' ? data.status : undefined)
      if (action === 'authorize' && status === 'pending') {
        status = 'authorized'
      }

      const message =
        action === 'authorize'
          ? 'Payment authorized'
          : action === 'capture'
            ? 'Payment capture reconciled'
            : 'Payment status fetched'

      return jsonResponse({
        paymentSessionId: String(data.id ?? paymentId),
        providerId: 'moyasar',
        status,
        providerReference: String(data.id ?? paymentId),
        redirectUrl: null,
        message,
      })
    }

    return jsonResponse({ error: `Unknown action: ${action}`, code: 'MOYASAR_BAD_REQUEST' }, 400)
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Moyasar request failed',
      code: 'MOYASAR_NETWORK',
    }, 502)
  }
})
