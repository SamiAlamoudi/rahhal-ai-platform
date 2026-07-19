import { createSandboxPaymentProvider } from './baseSandboxProvider'
import type { PlatformPaymentProvider } from '../types'

/** Sandbox HyperPay adapter — no live HyperPay credentials. */
export function createHyperPayPaymentAdapter(options?: {
  unhealthy?: boolean
  delayMs?: number
}): PlatformPaymentProvider {
  return createSandboxPaymentProvider({
    id: 'hyperpay',
    displayName: 'HyperPay',
    priority: 40,
    unhealthy: options?.unhealthy,
    delayMs: options?.delayMs,
  })
}
