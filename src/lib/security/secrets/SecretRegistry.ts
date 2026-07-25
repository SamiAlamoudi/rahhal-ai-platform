/**
 * Sprint 14 — SecretRegistry with typed definitions + duplicate detection.
 */

import type {
  ProviderSecretRegistration,
  SecretDefinition,
  SecretProviderId,
  SecretValidationIssue,
} from './types'

const DEFAULT_REGISTRATIONS: ProviderSecretRegistration[] = [
  {
    providerId: 'openai',
    required: [],
    optional: [
      {
        key: 'OPENAI_API_KEY',
        scope: 'server_only',
        criticality: 'optional',
        format: 'openai_sk',
        description: 'OpenAI / agent LLM (server preferred)',
      },
      {
        key: 'VITE_AGENT_OPENAI_API_KEY',
        scope: 'ephemeral_client',
        criticality: 'optional',
        aliases: ['VITE_OPENAI_API_KEY'],
        format: 'openai_sk',
        description: 'Legacy SPA OpenAI key — discouraged; prefer server proxy',
      },
    ],
  },
  {
    providerId: 'amadeus',
    required: [
      {
        key: 'AMADEUS_API_KEY',
        scope: 'server_only',
        criticality: 'optional',
        aliases: ['AMADEUS_CLIENT_ID'],
        format: 'amadeus_id',
      },
      {
        key: 'AMADEUS_API_SECRET',
        scope: 'server_only',
        criticality: 'optional',
        aliases: ['AMADEUS_CLIENT_SECRET'],
      },
    ],
    optional: [{ key: 'AMADEUS_BASE_URL', scope: 'public_config', criticality: 'optional' }],
  },
  {
    providerId: 'duffel',
    required: [
      {
        key: 'DUFFEL_API_TOKEN',
        scope: 'server_only',
        criticality: 'optional',
      },
    ],
  },
  {
    providerId: 'booking',
    required: [
      {
        key: 'BOOKING_API_KEY',
        scope: 'server_only',
        criticality: 'optional',
        aliases: ['RAPIDAPI_KEY', 'BOOKING_RAPIDAPI_KEY'],
      },
    ],
    optional: [
      {
        key: 'VITE_RAPIDAPI_KEY',
        scope: 'ephemeral_client',
        criticality: 'optional',
        aliases: ['VITE_BOOKING_API_KEY'],
        description: 'Legacy SPA RapidAPI key — prefer server RAPIDAPI_KEY',
      },
    ],
  },
  {
    providerId: 'google_maps',
    required: [],
    optional: [
      {
        key: 'GOOGLE_MAPS_API_KEY',
        scope: 'server_only',
        criticality: 'optional',
        description: 'Server-side Maps; never commit. Prefer proxy over VITE_* key.',
      },
    ],
  },
  {
    providerId: 'weather',
    required: [],
    optional: [
      {
        key: 'OPENWEATHER_API_KEY',
        scope: 'server_only',
        criticality: 'optional',
      },
    ],
  },
  {
    providerId: 'currency',
    required: [],
    optional: [
      {
        key: 'CURRENCY_API_KEY',
        scope: 'server_only',
        criticality: 'optional',
        aliases: ['EXCHANGE_RATE_API_KEY'],
      },
    ],
  },
  {
    providerId: 'email',
    required: [],
    optional: [
      {
        key: 'EMAIL_API_KEY',
        scope: 'server_only',
        criticality: 'optional',
        aliases: ['RESEND_API_KEY', 'SENDGRID_API_KEY'],
      },
    ],
  },
  {
    providerId: 'notifications',
    required: [],
    optional: [
      {
        key: 'NOTIFICATIONS_API_KEY',
        scope: 'server_only',
        criticality: 'optional',
        aliases: ['FCM_SERVER_KEY', 'ONESIGNAL_API_KEY'],
      },
    ],
  },
  {
    providerId: 'payment_future',
    required: [],
    optional: [
      {
        key: 'PAYMENT_SECRET_KEY',
        scope: 'server_only',
        criticality: 'optional',
        aliases: ['STRIPE_SECRET_KEY', 'HYPERPAY_SECRET'],
        description: 'Future payment providers — not enabled',
      },
    ],
  },
  {
    providerId: 'moyasar',
    required: [],
    optional: [
      {
        key: 'MOYASAR_SECRET_KEY',
        scope: 'server_only',
        criticality: 'optional',
        description: 'Edge-only — never expose via VITE_*',
      },
      {
        key: 'VITE_MOYASAR_PAYMENT_URL',
        scope: 'public_config',
        criticality: 'optional',
        description: 'Optional SPA Edge Function URL override',
      },
    ],
  },
  {
    providerId: 'supabase',
    required: [
      {
        key: 'VITE_SUPABASE_URL',
        scope: 'client_safe',
        criticality: 'critical',
        format: 'url',
      },
      {
        key: 'VITE_SUPABASE_ANON_KEY',
        scope: 'client_safe',
        criticality: 'critical',
        format: 'jwt_like',
      },
    ],
  },
]

export class SecretRegistry {
  private readonly byProvider = new Map<SecretProviderId, ProviderSecretRegistration>()
  private readonly keyOwners = new Map<string, SecretProviderId>()

  constructor(seed: ProviderSecretRegistration[] = DEFAULT_REGISTRATIONS) {
    for (const reg of seed) {
      this.register(reg)
    }
  }

  register(reg: ProviderSecretRegistration): SecretValidationIssue[] {
    const issues: SecretValidationIssue[] = []
    if (this.byProvider.has(reg.providerId)) {
      issues.push({
        code: 'duplicate_registration',
        key: reg.providerId,
        providerId: reg.providerId,
        detail: `Provider ${reg.providerId} already registered`,
        critical: true,
      })
      return issues
    }

    const all = [...reg.required, ...(reg.optional ?? [])]
    for (const def of all) {
      for (const name of expandKeyCandidates(def)) {
        const owner = this.keyOwners.get(name)
        if (owner && owner !== reg.providerId) {
          issues.push({
            code: 'duplicate_alias',
            key: name,
            providerId: reg.providerId,
            detail: `Secret key/alias ${name} already owned by ${owner}`,
            critical: true,
          })
        } else {
          this.keyOwners.set(name, reg.providerId)
        }
      }
    }

    if (issues.length === 0) {
      this.byProvider.set(reg.providerId, reg)
    }
    return issues
  }

  get(providerId: SecretProviderId): ProviderSecretRegistration | undefined {
    return this.byProvider.get(providerId)
  }

  list(): ProviderSecretRegistration[] {
    return [...this.byProvider.values()]
  }

  ownerOf(key: string): SecretProviderId | undefined {
    return this.keyOwners.get(key)
  }

  allKeys(): string[] {
    return [...this.keyOwners.keys()]
  }

  providerIds(): SecretProviderId[] {
    return [...this.byProvider.keys()]
  }
}

export function expandKeyCandidates(entry: SecretDefinition): string[] {
  return [entry.key, ...(entry.aliases ?? [])]
}

let defaultRegistry: SecretRegistry | null = null

export function getSecretRegistry(): SecretRegistry {
  if (!defaultRegistry) defaultRegistry = new SecretRegistry()
  return defaultRegistry
}

export function resetSecretRegistryForTests(): void {
  defaultRegistry = null
}

/** Compatibility export — static snapshot from default registry. */
export function getProviderRegistration(
  providerId: SecretProviderId,
): ProviderSecretRegistration | undefined {
  return getSecretRegistry().get(providerId)
}

export const PROVIDER_SECRET_REGISTRY: ProviderSecretRegistration[] = DEFAULT_REGISTRATIONS
