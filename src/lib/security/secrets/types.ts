/**
 * Sprint 14 — Production Secret Management contracts (expanded).
 */

export const SECURITY_SECRET_MANAGER_VERSION = '1.0.0-security-secret-manager'

export type SecretScope =
  | 'server_only'
  | 'client_safe'
  | 'ephemeral_client'
  | 'public_config'

/** @deprecated use SecretScope — kept for compatibility */
export type LegacySecretScope = 'server' | 'client_public' | 'provider'

export type SecretProviderId =
  | 'openai'
  | 'amadeus'
  | 'duffel'
  | 'booking'
  | 'google_maps'
  | 'weather'
  | 'currency'
  | 'email'
  | 'notifications'
  | 'payment_future'
  | 'moyasar'
  | 'supabase'
  | 'generic'

export type SecretCriticality = 'critical' | 'optional'

export interface SecretDefinition {
  key: string
  scope: SecretScope
  criticality: SecretCriticality
  /** Allowed alternate env names — registered once, no duplicates across providers. */
  aliases?: string[]
  /** Optional format hint (prefix / pattern name). */
  format?: 'openai_sk' | 'jwt_like' | 'url' | 'non_empty' | 'amadeus_id'
  description?: string
}

export interface ProviderSecretRegistration {
  providerId: SecretProviderId
  required: SecretDefinition[]
  optional?: SecretDefinition[]
}

export interface SecretRecord {
  key: string
  value: string
  scope: SecretScope
  source: string
}

export interface SecretPresence {
  key: string
  present: boolean
  scope: SecretScope
  source: string | null
}

export interface SecretAccessEvent {
  at: string
  key: string
  present: boolean
  caller: string
  providerId: SecretProviderId | null
  authorized: boolean
  redactedPreview: string | null
}

export interface SecretProvider {
  readonly providerId: string
  readonly live: boolean
  get(key: string): Promise<string | null> | string | null
  has(key: string): Promise<boolean> | boolean
  listKeys?(): Promise<string[]> | string[]
  /** Rotation abstraction — optional backends. */
  refresh?(): Promise<void> | void
  reload?(): Promise<void> | void
  getVersion?(): string
  getLastUpdatedAt?(): string | null
  invalidateCache?(): void
}

export interface ProviderCredentialSet {
  providerId: SecretProviderId
  keys: string[]
  values: Record<string, string | null>
  complete: boolean
  missing: string[]
  invalid: string[]
  disabledGracefully: boolean
}

export interface SecretValidationIssue {
  code:
    | 'missing'
    | 'empty'
    | 'malformed'
    | 'invalid_prefix'
    | 'unexpected_whitespace'
    | 'duplicate_alias'
    | 'unauthorized'
    | 'duplicate_registration'
  key: string
  providerId?: SecretProviderId
  detail: string
  critical: boolean
}

export interface SecretValidationReport {
  ok: boolean
  issues: SecretValidationIssue[]
  criticalFailures: SecretValidationIssue[]
  optionalDisabled: SecretProviderId[]
}

export interface SecretManagerDiagnostics {
  version: string
  enabled: boolean
  backend: string
  liveBackend: boolean
  accessCount: number
  knownProviderIds: SecretProviderId[]
  rotationVersion: string
  lastUpdatedAt: string | null
}

export interface SecretMetricsSnapshot {
  validationFailureCount: number
  missingConfigurationCount: number
  providerAuthFailureCount: number
  unauthorizedAccessCount: number
  rotationAttemptCount: number
  rotationFailureCount: number
  sanitizationCount: number
}

export const REDACTED_PLACEHOLDER = '[REDACTED]'
