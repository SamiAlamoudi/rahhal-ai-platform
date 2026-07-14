import type {
  PaymentProviderId,
  PaymentRequest,
  PaymentResult,
  PaymentRefundRequest,
  PaymentRefundResult,
  PaymentSessionStatus,
} from './paymentTypes'
import type { PaymentProvider, PaymentProviderConfig } from './paymentProvider'

interface MoyasarEdgeResponse {
  paymentSessionId?: string
  providerId?: string
  status?: PaymentSessionStatus | string
  providerReference?: string | null
  redirectUrl?: string | null
  message?: string
  error?: string
  code?: string
}

function env(name: string): string | undefined {
  if (typeof import.meta === 'undefined') return undefined
  return (import.meta as { env?: Record<string, string> }).env?.[name]
}

function edgeFunctionUrl(): string {
  const base = env('VITE_SUPABASE_URL')?.replace(/\/+$/, '')
  if (!base) {
    throw new Error('VITE_SUPABASE_URL is required for Moyasar payment provider')
  }
  return `${base}/functions/v1/moyasar-payment`
}

function anonKey(): string {
  const key = env('VITE_SUPABASE_ANON_KEY')
  if (!key) {
    throw new Error('VITE_SUPABASE_ANON_KEY is required for Moyasar payment provider')
  }
  return key
}

function mapStatus(status: string | undefined): PaymentSessionStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'created':
      return 'created'
    case 'pending':
      return 'pending'
    case 'authorized':
      return 'authorized'
    case 'paid':
      return 'paid'
    case 'failed':
      return 'failed'
    case 'expired':
      return 'expired'
    case 'cancelled':
    case 'canceled':
      return 'cancelled'
    case 'refunded':
      return 'refunded'
    default:
      return 'pending'
  }
}

export class MoyasarPaymentProvider implements PaymentProvider {
  readonly providerId: PaymentProviderId = 'moyasar'
  readonly displayName: string = 'Moyasar'

  constructor(config: PaymentProviderConfig | null = null) {
    // Secrets stay on the Edge Function — never read MOYASAR_SECRET_KEY here.
    void config
  }

  private async callEdge(body: Record<string, unknown>): Promise<MoyasarEdgeResponse> {
    const response = await fetch(edgeFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey()}`,
        apikey: anonKey(),
      },
      body: JSON.stringify(body),
    })

    let data: MoyasarEdgeResponse = {}
    try {
      data = await response.json() as MoyasarEdgeResponse
    } catch {
      data = { error: 'Invalid response from moyasar-payment', code: 'MOYASAR_BAD_RESPONSE' }
    }

    if (!response.ok) {
      return {
        ...data,
        error: data.error ?? `Moyasar edge error (${response.status})`,
        code: data.code,
      }
    }
    return data
  }

  private toResult(
    data: MoyasarEdgeResponse,
    fallbackSessionId: string,
    fallbackMessage: string,
  ): PaymentResult {
    const paymentSessionId = data.paymentSessionId ?? fallbackSessionId
    const ok = !data.error && !!data.paymentSessionId
    const status = mapStatus(typeof data.status === 'string' ? data.status : undefined)
    return {
      success: ok && status !== 'failed',
      providerId: 'moyasar',
      paymentSessionId,
      status: data.error ? 'failed' : status,
      providerReference: data.providerReference ?? paymentSessionId,
      authorizationCode: null,
      transactionId: data.providerReference ?? null,
      message: data.message ?? data.error ?? fallbackMessage,
      redirectUrl: data.redirectUrl ?? null,
      paidAt: status === 'paid' ? new Date().toISOString() : null,
      metadata: {
        provider: 'moyasar',
        code: data.code ?? null,
      },
    }
  }

  async createPaymentSession(request: PaymentRequest): Promise<PaymentResult> {
    const data = await this.callEdge({
      action: 'create_session',
      amount: request.amount,
      currency: request.currency,
      description: request.description,
      callbackUrl: request.returnUrl,
      orderId: request.orderId,
      orderNumber: request.orderNumber,
      metadata: {
        ...request.metadata,
        customerEmail: request.customerEmail,
        customerName: request.customerName,
      },
    })
    return this.toResult(data, '', 'Moyasar payment session created')
  }

  async authorizePayment(paymentSessionId: string): Promise<PaymentResult> {
    const data = await this.callEdge({
      action: 'authorize',
      paymentSessionId,
    })
    return this.toResult(data, paymentSessionId, 'Payment authorized')
  }

  async capturePayment(paymentSessionId: string): Promise<PaymentResult> {
    const data = await this.callEdge({
      action: 'capture',
      paymentSessionId,
    })
    return this.toResult(data, paymentSessionId, 'Payment captured')
  }

  async refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    return {
      success: false,
      refundId: null,
      refundedAmount: 0,
      message: `Moyasar refunds must be processed server-side (payment ${request.paymentId})`,
    }
  }

  async getPaymentStatus(paymentSessionId: string): Promise<PaymentSessionStatus | null> {
    const data = await this.callEdge({
      action: 'status',
      paymentSessionId,
    })
    if (data.error || !data.status) return null
    return mapStatus(String(data.status))
  }
}
