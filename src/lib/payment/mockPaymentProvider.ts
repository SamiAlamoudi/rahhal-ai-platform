import type {
  PaymentProviderId,
  PaymentRequest,
  PaymentResult,
  PaymentRefundRequest,
  PaymentRefundResult,
  PaymentSessionStatus,
} from './paymentTypes'
import type { PaymentProvider, PaymentProviderConfig } from './paymentProvider'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

export class MockPaymentProvider implements PaymentProvider {
  readonly providerId: PaymentProviderId = 'mock'
  readonly displayName: string = 'Mock Payment Gateway'

  private sessions: Map<string, { status: PaymentSessionStatus; amount: number; currency: string; transactionId: string | null }> = new Map()

  constructor(config: PaymentProviderConfig | null = null) {
    void config
  }

  async createPaymentSession(request: PaymentRequest): Promise<PaymentResult> {
    const sessionId = generateId()
    const status: PaymentSessionStatus = 'pending'
    this.sessions.set(sessionId, {
      status,
      amount: request.amount,
      currency: request.currency,
      transactionId: null,
    })

    return {
      success: true,
      providerId: 'mock',
      paymentSessionId: sessionId,
      status,
      providerReference: `MOCK-REF-${sessionId.slice(0, 8).toUpperCase()}`,
      authorizationCode: null,
      transactionId: null,
      message: 'Mock payment session created',
      // Simulate hosted checkout: SPA redirects here, then refreshPaymentStatus.
      redirectUrl: request.returnUrl || null,
      paidAt: null,
      metadata: { mock: true, requestAmount: request.amount },
    }
  }

  async authorizePayment(paymentSessionId: string): Promise<PaymentResult> {
    const session = this.sessions.get(paymentSessionId)
    if (!session) {
      return this.failureResult(paymentSessionId, 'Payment session not found')
    }
    if (session.status === 'paid') {
      return this.failureResult(paymentSessionId, 'Payment already captured')
    }
    if (session.status === 'cancelled' || session.status === 'expired') {
      return this.failureResult(paymentSessionId, `Cannot authorize in status: ${session.status}`)
    }

    const authCode = `AUTH-${Date.now().toString(36).toUpperCase()}`
    session.status = 'authorized'
    session.transactionId = `TXN-${paymentSessionId.slice(0, 8).toUpperCase()}`

    return {
      success: true,
      providerId: 'mock',
      paymentSessionId,
      status: 'authorized',
      providerReference: `MOCK-REF-${paymentSessionId.slice(0, 8).toUpperCase()}`,
      authorizationCode: authCode,
      transactionId: session.transactionId,
      message: 'Payment authorized (mock)',
      redirectUrl: null,
      paidAt: null,
      metadata: { mock: true, authorized: true },
    }
  }

  async capturePayment(paymentSessionId: string): Promise<PaymentResult> {
    const session = this.sessions.get(paymentSessionId)
    if (!session) {
      return this.failureResult(paymentSessionId, 'Payment session not found')
    }
    if (session.status !== 'authorized' && session.status !== 'pending') {
      return this.failureResult(paymentSessionId, `Cannot capture in status: ${session.status}`)
    }

    session.status = 'paid'
    const paidAt = new Date().toISOString()

    return {
      success: true,
      providerId: 'mock',
      paymentSessionId,
      status: 'paid',
      providerReference: `MOCK-REF-${paymentSessionId.slice(0, 8).toUpperCase()}`,
      authorizationCode: `AUTH-${Date.now().toString(36).toUpperCase()}`,
      transactionId: session.transactionId ?? `TXN-${paymentSessionId.slice(0, 8).toUpperCase()}`,
      message: 'Payment captured successfully (mock)',
      redirectUrl: null,
      paidAt,
      metadata: { mock: true, captured: true },
    }
  }

  async refundPayment(request: PaymentRefundRequest): Promise<PaymentRefundResult> {
    const session = this.sessions.get(request.paymentId)
    if (!session) {
      return {
        success: false,
        refundId: null,
        refundedAmount: 0,
        message: 'Payment session not found',
      }
    }
    if (session.status !== 'paid') {
      return {
        success: false,
        refundId: null,
        refundedAmount: 0,
        message: `Cannot refund in status: ${session.status}`,
      }
    }

    session.status = 'refunded'
    return {
      success: true,
      refundId: `RFD-${Date.now().toString(36).toUpperCase()}`,
      refundedAmount: request.amount,
      message: 'Refund processed (mock)',
    }
  }

  async getPaymentStatus(paymentSessionId: string): Promise<PaymentSessionStatus | null> {
    const session = this.sessions.get(paymentSessionId)
    if (!session) return null
    // Hosted-flow simulation: pending sessions resolve as paid on status refresh
    // (mirrors customer completing Moyasar invoice checkout).
    if (session.status === 'pending' || session.status === 'authorized') {
      session.status = 'paid'
      session.transactionId = session.transactionId ?? `TXN-${paymentSessionId.slice(0, 8).toUpperCase()}`
    }
    return session.status
  }

  private failureResult(paymentSessionId: string, message: string): PaymentResult {
    return {
      success: false,
      providerId: 'mock',
      paymentSessionId,
      status: 'failed',
      providerReference: null,
      authorizationCode: null,
      transactionId: null,
      message,
      redirectUrl: null,
      paidAt: null,
      metadata: { mock: true },
    }
  }
}
