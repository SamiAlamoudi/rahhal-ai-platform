/**
 * Sprint 14 — Production Secret Management contracts.
 * Central configuration layer; providers must not read env directly.
 */

export const SECURITY_SECRET_MANAGER_VERSION = '1.0.0-security-secret-manager'

export type SecretScope = 'server' | 'client_public' | 'provider'

export type SecretProviderId =
  | 'amadeus'
  | 'duffel'
  | 'booking'
  | 'google_maps'
  | 'openweather'
  | 'moyasar'
  | 'openai'
  | 'supabase'
  | 'generic'

export interface SecretRecord {
  key: string
  /** Present only inside SecretManager — never log this value. */
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
  /** Always redacted — never the raw secret. */
  redactedPreview: string | null
}

/** Pluggable backend for secret material. */
export interface SecretProvider {
  readonly providerId: string
  readonly live: boolean
  get(key: string): Promise<string | null> | string | null
  has(key: string): Promise<boolean> | boolean
  listKeys?(): Promise<string[]> | string[]
}

export interface ProviderCredentialSet {
  providerId: SecretProviderId
  keys: string[]
  values: Record<string, string | null>
  complete: boolean
  missing: string[]
}

export interface SecretManagerDiagnostics {
  version: string
  enabled: boolean
  backend: string
  liveBackend: boolean
  accessCount: number
  knownProviderIds: SecretProviderId[]
}
