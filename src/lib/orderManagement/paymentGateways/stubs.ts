/** Future gateway stubs — same port, not active by default. */

import type {
  PaymentGatewayAdapter,
  PaymentGatewayCapabilities,
  PaymentGatewayId,
  PaymentPrepareRequest,
  PaymentPrepareResult,
} from './types'

function stub(gatewayId: PaymentGatewayId, displayName: string, bnpl = false): PaymentGatewayAdapter {
  return {
    gatewayId,
    displayName,
    getCapabilities(): PaymentGatewayCapabilities {
      return {
        gatewayId,
        displayName,
        supportsRedirect: true,
        supportsApplePay: gatewayId === 'stripe' || gatewayId === 'moyasar',
        supportsBnpl: bnpl,
        mocked: true,
      }
    },
    async preparePayment(_request: PaymentPrepareRequest): Promise<PaymentPrepareResult> {
      return {
        success: false,
        gatewayId,
        providerSessionId: null,
        redirectUrl: null,
        message: `${displayName} gateway is not wired yet (Sprint 15 preparation only).`,
      }
    },
  }
}

export const stripeGatewayStub = stub('stripe', 'Stripe')
export const hyperpayGatewayStub = stub('hyperpay', 'HyperPay')
export const moyasarGatewayStub = stub('moyasar', 'Moyasar')
export const tabbyGatewayStub = stub('tabby', 'Tabby', true)
export const tamaraGatewayStub = stub('tamara', 'Tamara', true)
