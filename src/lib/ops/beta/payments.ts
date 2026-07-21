/**
 * Sprint 67 — payment abstraction wiring for beta.
 * Keeps mock available; Stripe / HyperPay / Apple Pay are sandbox/future-ready.
 */

import {
  createPaymentProviderRegistry,
  createStripePaymentAdapter,
  createHyperPayPaymentAdapter,
  createMockPaymentProvider,
} from '../../payments'
import type { BetaEnvironmentProfile, BetaPaymentSlot } from './types'
import { readBetaEnv } from './config'

export function buildBetaPaymentMatrix(
  profile: BetaEnvironmentProfile,
): BetaPaymentSlot[] {
  const paymentProvider = (readBetaEnv('VITE_PAYMENT_PROVIDER') ?? 'mock').toLowerCase()
  const slots: BetaPaymentSlot[] = [
    {
      gatewayId: 'mock',
      registered: true,
      mode: 'mock',
      available: true,
      notes: 'Default safe path for beta — always available',
    },
    {
      gatewayId: 'stripe',
      registered: true,
      mode: readBetaEnv('STRIPE_SECRET_KEY') ? 'sandbox' : 'future',
      available: true,
      notes: 'Sandbox adapter wired via payments platform; live capture frozen',
    },
    {
      gatewayId: 'hyperpay',
      registered: true,
      mode: readBetaEnv('HYPERPAY_ACCESS_TOKEN') ? 'sandbox' : 'future',
      available: true,
      notes: 'Sandbox adapter wired via payments platform; live capture frozen',
    },
    {
      gatewayId: 'apple_pay',
      registered: true,
      mode: 'future',
      available: true,
      notes: 'Future-ready via agent paymentsPlatform mock_apple_pay',
    },
    {
      gatewayId: 'moyasar',
      registered: true,
      mode: paymentProvider === 'moyasar' ? 'sandbox' : 'future',
      available: true,
      notes: 'Hosted Moyasar path exists; beta keeps VITE_PAYMENT_PROVIDER=mock',
    },
  ]

  if (profile.mockPaymentsRequired && paymentProvider !== 'mock') {
    slots.push({
      gatewayId: 'mock',
      registered: true,
      mode: 'mock',
      available: false,
      notes: `CONFIGURATION ERROR: payment provider is ${paymentProvider}; beta requires mock`,
    })
  }

  return slots
}

/** Wire Sprint 34 payment registry with Stripe / HyperPay / mock for beta. */
export function createBetaPaymentRegistry() {
  return createPaymentProviderRegistry([
    createMockPaymentProvider(),
    createStripePaymentAdapter({}),
    createHyperPayPaymentAdapter({}),
  ])
}

export function assertBetaPaymentsSafe(profile: BetaEnvironmentProfile): {
  ok: boolean
  paymentProvider: string
  error?: string
} {
  const paymentProvider = (readBetaEnv('VITE_PAYMENT_PROVIDER') ?? 'mock').toLowerCase()
  if (profile.mockPaymentsRequired && paymentProvider !== 'mock') {
    return {
      ok: false,
      paymentProvider,
      error: 'Beta requires VITE_PAYMENT_PROVIDER=mock until live payments freeze is lifted',
    }
  }
  return { ok: true, paymentProvider }
}
