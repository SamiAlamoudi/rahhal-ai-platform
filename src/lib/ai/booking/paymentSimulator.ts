/**
 * Phase AE — mock payment only (live providers OFF).
 */

export interface SimulatedPaymentRequest {
  bookingId: string
  amount: number
  currency: string
  forceFail?: boolean
}

export interface SimulatedPaymentResult {
  ok: boolean
  reference: string | null
  error: string | null
  simulated: true
}

export function simulatePayment(request: SimulatedPaymentRequest): SimulatedPaymentResult {
  if (request.forceFail) {
    return {
      ok: false,
      reference: null,
      error: 'Simulated payment declined',
      simulated: true,
    }
  }
  if (!Number.isFinite(request.amount) || request.amount < 0) {
    return {
      ok: false,
      reference: null,
      error: 'Invalid payment amount',
      simulated: true,
    }
  }
  const reference = `mockpay_${request.bookingId}_${Math.round(request.amount * 100)}`
  return {
    ok: true,
    reference,
    error: null,
    simulated: true,
  }
}
