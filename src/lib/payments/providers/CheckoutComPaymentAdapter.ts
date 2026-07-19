import { createSandboxPaymentProvider } from './baseSandboxProvider'
import type { PlatformPaymentProvider } from '../types'

/** Sandbox Checkout.com adapter — no live Checkout.com credentials. */
export function createCheckoutComPaymentAdapter(options?: {
  unhealthy?: boolean
  delayMs?: number
}): PlatformPaymentProvider {
  return createSandboxPaymentProvider({
    id: 'checkout_com',
    displayName: 'Checkout.com',
    priority: 30,
    unhealthy: options?.unhealthy,
    delayMs: options?.delayMs,
  })
}
