import { createSandboxPaymentProvider } from './baseSandboxProvider'
import type { PlatformPaymentProvider } from '../types'

/** Sandbox Adyen adapter — no live Adyen credentials. */
export function createAdyenPaymentAdapter(options?: {
  unhealthy?: boolean
  delayMs?: number
}): PlatformPaymentProvider {
  return createSandboxPaymentProvider({
    id: 'adyen',
    displayName: 'Adyen',
    priority: 20,
    unhealthy: options?.unhealthy,
    delayMs: options?.delayMs,
  })
}
