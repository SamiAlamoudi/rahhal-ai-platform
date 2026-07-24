/**
 * Moyasar payment Edge Function (server-side only).
 *
 * Holds MOYASAR_SECRET_KEY server-side. The SPA never sees the secret —
 * it calls this function with the Supabase anon key.
 *
 * Hosted checkout uses Moyasar Invoices API so create_session returns a
 * customer-facing payment URL (`url`).
 *
 * Deploy secrets:
 *   MOYASAR_SECRET_KEY
 *   (optional) MOYASAR_BASE_URL=https://api.moyasar.com
 *
 * POST body: { action: 'create_session' | 'authorize' | 'capture' | 'status' | 'cancel', ... }
 */

import {
  buildCorsHeaders,
  corsPreflightResponse,
  jsonEdgeResponse,
  requireEdgeInvokeAuth,
} from '../_shared/edgeSecurity.ts'

const DEFAULT_MOYASAR_HOST = 'https://api.moyasar.com'

/** Per-request CORS + JSON helper (allowlist-aware). */
function jsonResponse(body: unknown, status: number, cors: Record<string, string>): Response {
  return jsonEdgeResponse(body, status, cors)
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
    case 'expired':
      return 'expired'
    case 'voided':
    case 'canceled':
    case 'cancelled':
      return 'cancelled'
    case 'initiated':
    case 'pending':
    default:
      return 'pending'
  }
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) as Record<string, unknown> : {}
  } catch {
    return { raw: text }
  }
}

interface CreateSessionBody {
  action: 'create_session'
  amount: number
  currency?: string
  description?: string
  /** Browser return URL after hosted payment (maps to invoice success_url). */
  callbackUrl?: string
  callback_url?: string
  successUrl?: string
  success_url?: string
  backUrl?: string
  back_url?: string
  orderId?: string
  orderNumber?: string
  metadata?: Record<string, unknown>
  /** When true, skip hosted invoice and create a raw payment (tokenized / advanced). */
  tokenizedCard?: boolean
}

interface SessionActionBody {
  action: 'authorize' | 'capture' | 'status' | 'cancel'
  paymentSessionId?: string
  payment_id?: string
}

type RequestBody = CreateSessionBody | SessionActionBody | { action?: string }

function paymentIdFromBody(body: SessionActionBody): string | null {
  return body.paymentSessionId ?? body.payment_id ?? null
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req, { methods: ['POST', 'OPTIONS'] })

  if (req.method === 'OPTIONS') {
    return corsPreflightResponse(req, { methods: ['POST', 'OPTIONS'] })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, cors)
  }

  const authError = requireEdgeInvokeAuth(req, cors)
  if (authError) return authError

  const secretKey = Deno.env.get('MOYASAR_SECRET_KEY')
  if (!secretKey) {
    return jsonResponse({
      error: 'Moyasar secret key is not configured on the server',
      code: 'MOYASAR_SERVER_NOT_CONFIGURED',
    }, 503, cors)
  }

  const host = (Deno.env.get('MOYASAR_BASE_URL') || DEFAULT_MOYASAR_HOST).replace(/\/+$/, '')
  let body: RequestBody
  try {
    body = await req.json() as RequestBody
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', code: 'MOYASAR_BAD_REQUEST' }, 400, cors)
  }

  const action = body.action
  if (!action) {
    return jsonResponse({ error: 'Missing action', code: 'MOYASAR_BAD_REQUEST' }, 400, cors)
  }

  try {
    if (action === 'create_session') {
      const createBody = body as CreateSessionBody
      const amount = Number(createBody.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonResponse({ error: 'Invalid amount', code: 'MOYASAR_BAD_REQUEST' }, 400, cors)
      }

      const currency = (createBody.currency || 'SAR').toUpperCase()
      const description = createBody.description || 'Rahhal payment'
      // SPA return URL — used as invoice success_url / back_url (browser redirect).
      const successUrl =
        createBody.successUrl
        ?? createBody.success_url
        ?? createBody.callbackUrl
        ?? createBody.callback_url
        ?? ''
      const backUrl =
        createBody.backUrl
        ?? createBody.back_url
        ?? successUrl
      // Server webhook URL (optional) — never send the SPA return URL as callback_url.
      const serverCallbackUrl =
        Deno.env.get('MOYASAR_INVOICE_CALLBACK_URL')
        ?? Deno.env.get('MOYASAR_WEBHOOK_URL')
        ?? ''
      const amountHalalas = Math.round(amount * 100)
      const metadata = {
        ...createBody.metadata,
        orderId: createBody.orderId ?? null,
        orderNumber: createBody.orderNumber ?? null,
      }

      // Default path: Moyasar Invoice → hosted payment URL for customer redirect.
      if (!createBody.tokenizedCard) {
        const invoicePayload: Record<string, unknown> = {
          amount: amountHalalas,
          currency,
          description,
          metadata,
        }
        if (successUrl) {
          invoicePayload.success_url = successUrl
        }
        if (backUrl) {
          invoicePayload.back_url = backUrl
        }
        if (serverCallbackUrl) {
          invoicePayload.callback_url = serverCallbackUrl
        }

        const response = await fetch(`${host}/v1/invoices`, {
          method: 'POST',
          headers: {
            Authorization: basicAuthHeader(secretKey),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoicePayload),
        })

        const data = await parseJson(response)
        if (!response.ok) {
          return jsonResponse({
            error: 'Moyasar create invoice failed',
            code: 'MOYASAR_CREATE_FAILED',
            status: response.status,
            details: data,
          }, response.status >= 400 && response.status < 500 ? response.status : 502, cors)
        }

        const invoiceId = String(data.id ?? '')
        const redirectUrl =
          (typeof data.url === 'string' && data.url)
          || (typeof data.invoice_url === 'string' && data.invoice_url)
          || null

        if (!redirectUrl) {
          return jsonResponse({
            error: 'Moyasar invoice created without a hosted payment URL',
            code: 'MOYASAR_MISSING_PAYMENT_URL',
            paymentSessionId: invoiceId,
            details: data,
          }, 502, cors)
        }

        return jsonResponse({
          paymentSessionId: invoiceId,
          providerId: 'moyasar',
          status: mapMoyasarStatus(typeof data.status === 'string' ? data.status : 'pending'),
          providerReference: invoiceId,
          redirectUrl,
          message: 'Moyasar hosted payment session created',
          kind: 'invoice',
        }, 200, cors)
      }

      // Optional tokenized / advanced payment create (no hosted URL required).
      const payload: Record<string, unknown> = {
        amount: amountHalalas,
        currency,
        description,
        metadata,
      }
      if (serverCallbackUrl) payload.callback_url = serverCallbackUrl
      else if (successUrl) payload.callback_url = successUrl

      const response = await fetch(`${host}/v1/payments`, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(secretKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await parseJson(response)
      if (!response.ok) {
        return jsonResponse({
          error: 'Moyasar create payment failed',
          code: 'MOYASAR_CREATE_FAILED',
          status: response.status,
          details: data,
        }, response.status >= 400 && response.status < 500 ? response.status : 502, cors)
      }

      const paymentId = String(data.id ?? '')
      const source = (data.source ?? {}) as Record<string, unknown>
      const redirectUrl =
        (typeof source.transaction_url === 'string' && source.transaction_url)
        || (typeof data.transaction_url === 'string' && data.transaction_url)
        || null

      return jsonResponse({
        paymentSessionId: paymentId,
        providerId: 'moyasar',
        status: mapMoyasarStatus(typeof data.status === 'string' ? data.status : undefined),
        providerReference: paymentId,
        redirectUrl,
        message: 'Moyasar payment session created',
        kind: 'payment',
      }, 200, cors)
    }

    if (action === 'authorize' || action === 'capture' || action === 'status' || action === 'cancel') {
      const sessionBody = body as SessionActionBody
      const paymentId = paymentIdFromBody(sessionBody)
      if (!paymentId) {
        return jsonResponse({ error: 'Missing paymentSessionId', code: 'MOYASAR_BAD_REQUEST' }, 400, cors)
      }

      // Prefer invoice lookup (hosted checkout), then fall back to payment.
      async function fetchEntity(kind: 'invoices' | 'payments'): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
        const res = await fetch(`${host}/v1/${kind}/${paymentId}`, {
          method: 'GET',
          headers: { Authorization: basicAuthHeader(secretKey) },
        })
        return { ok: res.ok, status: res.status, data: await parseJson(res) }
      }

      if (action === 'status' || action === 'authorize' || action === 'cancel') {
        let entity = await fetchEntity('invoices')
        let kind: 'invoice' | 'payment' = 'invoice'
        if (!entity.ok) {
          entity = await fetchEntity('payments')
          kind = 'payment'
        }
        if (!entity.ok) {
          return jsonResponse({
            error: 'Moyasar payment lookup failed',
            code: 'MOYASAR_STATUS_FAILED',
            status: entity.status,
            details: entity.data,
          }, entity.status === 404 ? 404 : 502, cors)
        }

        let status = mapMoyasarStatus(
          typeof entity.data.status === 'string' ? entity.data.status : undefined,
        )
        if (action === 'authorize' && status === 'pending') {
          status = 'authorized'
        }

        // Cancel / void only applies to payments; invoices expire/cancel via status.
        if (action === 'cancel' && kind === 'payment') {
          const voidRes = await fetch(`${host}/v1/payments/${paymentId}/void`, {
            method: 'POST',
            headers: {
              Authorization: basicAuthHeader(secretKey),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          })
          if (voidRes.ok) {
            const voidData = await parseJson(voidRes)
            status = mapMoyasarStatus(
              typeof voidData.status === 'string' ? voidData.status : 'cancelled',
            )
          }
        }

        return jsonResponse({
          paymentSessionId: String(entity.data.id ?? paymentId),
          providerId: 'moyasar',
          status,
          providerReference: String(entity.data.id ?? paymentId),
          redirectUrl: typeof entity.data.url === 'string' ? entity.data.url : null,
          message:
            action === 'authorize'
              ? 'Payment authorized'
              : action === 'cancel'
                ? 'Payment cancel reconciled'
                : 'Payment status fetched',
          kind,
        }, 200, cors)
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
        const captureData = await parseJson(captureRes)
        if (captureRes.ok) {
          return jsonResponse({
            paymentSessionId: paymentId,
            providerId: 'moyasar',
            status: mapMoyasarStatus(
              typeof captureData.status === 'string' ? captureData.status : 'paid',
            ),
            providerReference: paymentId,
            redirectUrl: null,
            message: 'Payment captured',
          }, 200, cors)
        }
        // Fall through to status if already captured
        const entity = await fetchEntity('payments')
        if (!entity.ok) {
          return jsonResponse({
            error: 'Moyasar capture failed',
            code: 'MOYASAR_CAPTURE_FAILED',
            status: captureRes.status,
            details: captureData,
          }, 502, cors)
        }
        return jsonResponse({
          paymentSessionId: paymentId,
          providerId: 'moyasar',
          status: mapMoyasarStatus(
            typeof entity.data.status === 'string' ? entity.data.status : undefined,
          ),
          providerReference: paymentId,
          redirectUrl: null,
          message: 'Payment capture reconciled',
        }, 200, cors)
      }
    }

    return jsonResponse({ error: `Unknown action: ${action}`, code: 'MOYASAR_BAD_REQUEST' }, 400, cors)
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : 'Moyasar request failed',
      code: 'MOYASAR_NETWORK',
    }, 502, cors)
  }
})
