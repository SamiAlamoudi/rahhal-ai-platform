import { createSandboxPaymentProvider } from './baseSandboxProvider'
import type { PlatformPaymentProvider } from '../types'

/** Sandbox Stripe adapter — no live Stripe SDK / credentials. */
export function createStripePaymentAdapter(options?: {
  unhealthy?: boolean
  delayMs?: number
}): PlatformPaymentProvider {
  return createSandboxPaymentProvider({
    id: 'stripe',
    displayName: 'Stripe',
    priority: 10,
    unhealthy: options?.unhealthy,
    delayMs: options?.delayMs,
  })
}
