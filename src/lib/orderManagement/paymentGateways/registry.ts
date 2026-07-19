import type { PaymentGatewayAdapter, PaymentGatewayId } from './types'
import { createMockPaymentGateway } from './mockGateway'
import {
  hyperpayGatewayStub,
  moyasarGatewayStub,
  stripeGatewayStub,
  tabbyGatewayStub,
  tamaraGatewayStub,
} from './stubs'

const gateways = new Map<PaymentGatewayId, PaymentGatewayAdapter>()

function ensureDefaults(): void {
  if (gateways.size > 0) return
  gateways.set('mock', createMockPaymentGateway())
  gateways.set('stripe', stripeGatewayStub)
  gateways.set('hyperpay', hyperpayGatewayStub)
  gateways.set('moyasar', moyasarGatewayStub)
  gateways.set('tabby', tabbyGatewayStub)
  gateways.set('tamara', tamaraGatewayStub)
}

export function registerPaymentGateway(adapter: PaymentGatewayAdapter): void {
  ensureDefaults()
  gateways.set(adapter.gatewayId, adapter)
}

export function getPaymentGateway(gatewayId: PaymentGatewayId = 'mock'): PaymentGatewayAdapter {
  ensureDefaults()
  return gateways.get(gatewayId) ?? gateways.get('mock')!
}

export function listPaymentGateways(): PaymentGatewayAdapter[] {
  ensureDefaults()
  return Array.from(gateways.values())
}

export function resetPaymentGatewayRegistry(): void {
  gateways.clear()
}
