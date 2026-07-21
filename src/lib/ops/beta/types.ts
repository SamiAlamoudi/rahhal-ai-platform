/**
 * Sprint 67 — Beta Launch Environment contracts.
 * Configuration / activation only — no architecture rewrite.
 */

export type BetaEnvironment = 'development' | 'staging' | 'beta' | 'production'

export type BetaProviderId = 'amadeus' | 'booking' | 'duffel' | 'mock' | string

export type BetaPaymentGatewayId = 'mock' | 'stripe' | 'hyperpay' | 'apple_pay' | 'moyasar'

export type BetaNotificationChannel = 'email' | 'whatsapp' | 'push' | 'sms'

export type BetaCheckStatus = 'pass' | 'fail' | 'warn' | 'skip'

export interface BetaCheckResult {
  id: string
  area: string
  status: BetaCheckStatus
  summary: string
  details?: Record<string, unknown>
}

export interface BetaEnvironmentProfile {
  environment: BetaEnvironment
  deployTarget: 'development' | 'staging' | 'production' | 'preview'
  liveProvidersAllowed: boolean
  livePaymentsAllowed: boolean
  mockPaymentsRequired: boolean
  mockFallbackEnabled: boolean
  requireSupabase: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export interface BetaProviderSlot {
  providerId: BetaProviderId
  featureFlag: string | null
  configured: boolean
  flagEnabled: boolean
  envEnabled: boolean
  secretsPresent: boolean
  mode: 'live' | 'simulated' | 'unavailable'
  notes: string
}

export interface BetaPaymentSlot {
  gatewayId: BetaPaymentGatewayId
  registered: boolean
  mode: 'mock' | 'sandbox' | 'live' | 'future'
  available: boolean
  notes: string
}

export interface BetaNotificationSlot {
  channel: BetaNotificationChannel
  providerId: string
  available: boolean
  mocked: boolean
  supportsRetry: boolean
  supportsDeliveryTracking: boolean
  notes: string
}

export interface BetaSecretsReport {
  ok: boolean
  missing: string[]
  present: string[]
  exposedRisks: string[]
}

export interface BetaReadinessReport {
  generatedAt: string
  version: string
  environment: BetaEnvironment
  betaReady: boolean
  profile: BetaEnvironmentProfile
  secrets: BetaSecretsReport
  providers: BetaProviderSlot[]
  payments: BetaPaymentSlot[]
  notifications: BetaNotificationSlot[]
  checks: BetaCheckResult[]
  diagnostics: Record<string, string | boolean | number>
  smoke?: {
    ok: boolean
    flowsPassed: number
    flowsFailed: number
  }
}

export const BETA_LAUNCH_VERSION = '1.0.0-beta'
