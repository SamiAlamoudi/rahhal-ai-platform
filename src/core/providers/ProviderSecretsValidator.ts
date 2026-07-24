/**
 * Sprint 90 — secrets / API key readiness validation (no secret values logged).
 */

export type SecretPresence = 'present' | 'missing' | 'empty'

export interface SecretCheck {
  name: string
  presence: SecretPresence
  required: boolean
}

export interface ProviderSecretsReport {
  providerId: string
  ok: boolean
  checks: SecretCheck[]
  missingRequired: string[]
}

export interface SecretsValidatorInput {
  providerId: string
  /** Map of env key → value (undefined/null/'' = missing). */
  env: Record<string, string | undefined | null>
  requiredKeys: string[]
  optionalKeys?: string[]
}

function presenceOf(value: string | undefined | null): SecretPresence {
  if (value == null) return 'missing'
  if (!String(value).trim()) return 'empty'
  return 'present'
}

export function validateProviderSecrets(
  input: SecretsValidatorInput,
): ProviderSecretsReport {
  const checks: SecretCheck[] = []

  for (const key of input.requiredKeys) {
    checks.push({
      name: key,
      presence: presenceOf(input.env[key]),
      required: true,
    })
  }
  for (const key of input.optionalKeys ?? []) {
    checks.push({
      name: key,
      presence: presenceOf(input.env[key]),
      required: false,
    })
  }

  const missingRequired = checks
    .filter((c) => c.required && c.presence !== 'present')
    .map((c) => c.name)

  return {
    providerId: input.providerId,
    ok: missingRequired.length === 0,
    checks,
    missingRequired,
  }
}

/** Well-known key sets for common suppliers (readiness checklist only). */
export const PROVIDER_SECRET_KEYS = {
  amadeus: {
    required: ['AMADEUS_CLIENT_ID', 'AMADEUS_CLIENT_SECRET'],
    optional: ['AMADEUS_HOSTNAME', 'VITE_AMADEUS_ENABLED'],
  },
  duffel: {
    required: ['DUFFEL_API_TOKEN'],
    optional: ['DUFFEL_API_URL'],
  },
  booking: {
    required: ['BOOKING_API_KEY'],
    optional: ['BOOKING_API_HOST', 'RAPIDAPI_KEY', 'BOOKING_PROXY_URL'],
  },
  mock: {
    required: [] as string[],
    optional: [] as string[],
  },
} as const

export function apiKeyExists(env: Record<string, string | undefined | null>, key: string): boolean {
  return presenceOf(env[key]) === 'present'
}
