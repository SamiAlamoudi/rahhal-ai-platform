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

export interface MoyasarPaymentProviderOptions {
  /** Override Edge Function URL (tests / custom deploy paths). */
  paymentUrl?: string | null
  /** Supabase anon key used to invoke the Edge Function. */
  invokeApiKey?: string | null
  /** Supabase project URL used to derive the default Edge Function path. */
  supabaseUrl?: string | null
}

function readViteEnv(name: string): string | null {
  const value = import.meta.env[name] as string | undefined
  if (value === undefined || value === null || value === '') return null
  return String(value)
}

/**
 * SPA calls a Supabase Edge Function which holds MOYASAR_SECRET_KEY.
 * Never load the Moyasar secret into VITE_* browser env.
 */
export function resolveMoyasarPaymentUrl(options: MoyasarPaymentProviderOptions = {}): string {
  const explicit = (options.paymentUrl ?? readViteEnv('VITE_MOYASAR_PAYMENT_URL'))?.replace(/\/+$/, '')
  if (explicit) return explicit

  const base = (options.supabaseUrl ?? readViteEnv('VITE_SUPABASE_URL'))?.replace(/\/+$/, '')
  if (!base) {
    throw new Error('VITE_SUPABASE_URL (or VITE_MOYASAR_PAYMENT_URL) is required for Moyasar')
  }
  return `${base}/functions/v1/moyasar-payment`
}

export function mapMoyasarStatus(status: string | undefined): PaymentSessionStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'created':
      return 'created'
    case 'pending':
    case 'initiated':
      return 'pending'
    case 'authorized':
      return 'authorized'
    case 'paid':
    case 'captured':
      return 'paid'
    case 'failed':
      return 'failed'
    case 'expired':
      return 'expired'
    case 'cancelled':
    case 'canceled':
    case 'voided':
      return 'cancelled'
    case 'refunded':
      return 'refunded'
    default:
      return 'pending'
  }
}

function validateCreateRequest(request: PaymentRequest): string | null {
  if (!request.orderId?.trim()) return 'orderId is required'
  if (!request.orderNumber?.trim()) return 'orderNumber is required'
  if (!Number.isFinite(request.amount) || request.amount <= 0) {
    return 'amount must be greater than zero'
  }
  if (!request.currency?.trim()) return 'currency is required'
  if (!request.returnUrl?.trim()) return 'returnUrl (callback) is required'
  return null
}

export class MoyasarPaymentProvider implements PaymentProvider {
  readonly providerId: PaymentProviderId = 'moyasar'
  readonly displayName: string = 'Moyasar'

  private readonly options: MoyasarPaymentProviderOptions

  constructor(
    config: PaymentProviderConfig | null = null,
    options: MoyasarPaymentProviderOptions = {},
  ) {
    // Secrets stay on the Edge Function — never read MOYASAR_SECRET_KEY here.
    void config
    this.options = options
  }

  private resolveInvokeApiKey(): string {
    const key = this.options.invokeApiKey ?? readViteEnv('VITE_SUPABASE_ANON_KEY')
    if (!key) {
      throw new Error('VITE_SUPABASE_ANON_KEY is required for Moyasar payment provider')
    }
    return key
  }

  private async callEdge(body: Record<string, unknown>): Promise<MoyasarEdgeResponse> {
    const invokeKey = this.resolveInvokeApiKey()
    let response: Response
    try {
      response = await fetch(resolveMoyasarPaymentUrl(this.options), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${invokeKey}`,
          apikey: invokeKey,
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Network failure calling Moyasar edge',
        code: 'MOYASAR_NETWORK',
      }
    }

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
        code: data.code ?? 'MOYASAR_HTTP_ERROR',
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
    const status = mapMoyasarStatus(typeof data.status === 'string' ? data.status : undefined)
    const failedStatuses: PaymentSessionStatus[] = ['failed', 'cancelled', 'expired']
    const ok = !data.error && !!paymentSessionId && !failedStatuses.includes(status)

    return {
      success: ok,
      providerId: 'moyasar',
      paymentSessionId,
      status: data.error ? 'failed' : status,
      providerReference: data.providerReference ?? (paymentSessionId || null),
      authorizationCode: null,
      transactionId: data.providerReference ?? paymentSessionId ?? null,
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
    const validationError = validateCreateRequest(request)
    if (validationError) {
      return {
        success: false,
        providerId: 'moyasar',
        paymentSessionId: '',
        status: 'failed',
        providerReference: null,
        authorizationCode: null,
        transactionId: null,
        message: validationError,
        redirectUrl: null,
        paidAt: null,
        metadata: { provider: 'moyasar', code: 'MOYASAR_VALIDATION' },
      }
    }

    const data = await this.callEdge({
      action: 'create_session',
      amount: request.amount,
      currency: request.currency.toUpperCase(),
      description: request.description,
      // Browser return after hosted invoice (success_url / back_url on Edge).
      successUrl: request.returnUrl,
      backUrl: request.returnUrl,
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
    if (!paymentSessionId?.trim()) {
      return this.toResult(
        { error: 'paymentSessionId is required', code: 'MOYASAR_VALIDATION' },
        '',
        'Validation failed',
      )
    }
    const data = await this.callEdge({
      action: 'authorize',
      paymentSessionId,
    })
    return this.toResult(data, paymentSessionId, 'Payment authorized')
  }

  async capturePayment(paymentSessionId: string): Promise<PaymentResult> {
    if (!paymentSessionId?.trim()) {
      return this.toResult(
        { error: 'paymentSessionId is required', code: 'MOYASAR_VALIDATION' },
        '',
        'Validation failed',
      )
    }
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
    if (!paymentSessionId?.trim()) return null
    const data = await this.callEdge({
      action: 'status',
      paymentSessionId,
    })
    if (data.error || !data.status) return null
    return mapMoyasarStatus(String(data.status))
  }
}
