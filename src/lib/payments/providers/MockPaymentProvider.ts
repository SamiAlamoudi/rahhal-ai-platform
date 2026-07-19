import { createSandboxPaymentProvider } from './baseSandboxProvider'
import type { PlatformPaymentProvider } from '../types'

export function createMockPaymentProvider(options?: {
  unhealthy?: boolean
  delayMs?: number
}): PlatformPaymentProvider {
  return createSandboxPaymentProvider({
    id: 'mock',
    displayName: 'Mock Payment Provider',
    priority: 100,
    unhealthy: options?.unhealthy,
    delayMs: options?.delayMs,
  })
}
