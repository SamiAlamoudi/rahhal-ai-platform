import type {
  PaymentGatewayAdapter,
  PaymentGatewayCapabilities,
  PaymentPrepareRequest,
  PaymentPrepareResult,
} from './types'

export class MockPaymentGatewayAdapter implements PaymentGatewayAdapter {
  readonly gatewayId = 'mock' as const
  readonly displayName = 'Mock Payment'

  getCapabilities(): PaymentGatewayCapabilities {
    return {
      gatewayId: 'mock',
      displayName: 'Mock Payment',
      supportsRedirect: true,
      supportsApplePay: false,
      supportsBnpl: false,
      mocked: true,
    }
  }

  async preparePayment(request: PaymentPrepareRequest): Promise<PaymentPrepareResult> {
    const providerSessionId = `mock_pay_${request.orderId.slice(0, 8)}`
    return {
      success: true,
      gatewayId: 'mock',
      providerSessionId,
      redirectUrl: `${request.returnUrl}?orderId=${encodeURIComponent(request.orderId)}&mock=1`,
      message: 'Mock payment session prepared.',
    }
  }
}

export function createMockPaymentGateway(): PaymentGatewayAdapter {
  return new MockPaymentGatewayAdapter()
}
