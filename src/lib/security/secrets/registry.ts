/**
 * Sprint 14 — provider → required secret key registry.
 */

import type { SecretProviderId, SecretScope } from './types'

export interface RegisteredSecretKey {
  key: string
  scope: SecretScope
  aliases?: string[]
}

export interface ProviderSecretRegistration {
  providerId: SecretProviderId
  required: RegisteredSecretKey[]
  optional?: RegisteredSecretKey[]
}

export const PROVIDER_SECRET_REGISTRY: ProviderSecretRegistration[] = [
  {
    providerId: 'amadeus',
    required: [
      { key: 'AMADEUS_API_KEY', scope: 'server', aliases: ['AMADEUS_CLIENT_ID'] },
      { key: 'AMADEUS_API_SECRET', scope: 'server', aliases: ['AMADEUS_CLIENT_SECRET'] },
    ],
    optional: [{ key: 'AMADEUS_BASE_URL', scope: 'server' }],
  },
  {
    providerId: 'duffel',
    required: [{ key: 'DUFFEL_API_TOKEN', scope: 'server' }],
  },
  {
    providerId: 'booking',
    required: [
      {
        key: 'BOOKING_API_KEY',
        scope: 'server',
        aliases: ['RAPIDAPI_KEY', 'BOOKING_RAPIDAPI_KEY'],
      },
    ],
    optional: [
      { key: 'VITE_RAPIDAPI_KEY', scope: 'client_public' },
      { key: 'VITE_BOOKING_API_KEY', scope: 'client_public' },
    ],
  },
  {
    providerId: 'google_maps',
    required: [{ key: 'GOOGLE_MAPS_API_KEY', scope: 'server', aliases: ['VITE_GOOGLE_MAPS_API_KEY'] }],
  },
  {
    providerId: 'openweather',
    required: [{ key: 'OPENWEATHER_API_KEY', scope: 'server', aliases: ['VITE_OPENWEATHER_API_KEY'] }],
  },
  {
    providerId: 'moyasar',
    required: [{ key: 'MOYASAR_SECRET_KEY', scope: 'server', aliases: ['VITE_MOYASAR_SECRET_KEY'] }],
  },
  {
    providerId: 'openai',
    required: [
      {
        key: 'OPENAI_API_KEY',
        scope: 'server',
        aliases: ['VITE_OPENAI_API_KEY', 'VITE_AGENT_OPENAI_API_KEY'],
      },
    ],
  },
  {
    providerId: 'supabase',
    required: [
      { key: 'VITE_SUPABASE_URL', scope: 'client_public' },
      { key: 'VITE_SUPABASE_ANON_KEY', scope: 'client_public' },
    ],
  },
]

export function getProviderRegistration(
  providerId: SecretProviderId,
): ProviderSecretRegistration | undefined {
  return PROVIDER_SECRET_REGISTRY.find((r) => r.providerId === providerId)
}

export function expandKeyCandidates(entry: RegisteredSecretKey): string[] {
  return [entry.key, ...(entry.aliases ?? [])]
}
