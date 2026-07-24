/**
 * Sprint 67 — secrets management checks (presence only, never log values).
 */

import { readBetaEnv } from './config'
import type { BetaSecretsReport } from './types'

const PROVIDER_SECRET_KEYS = [
  'AMADEUS_API_KEY',
  'AMADEUS_API_SECRET',
  'BOOKING_API_KEY',
  'RAPIDAPI_KEY',
  'BOOKING_RAPIDAPI_KEY',
  'DUFFEL_API_TOKEN',
] as const

const OPTIONAL_PAYMENT_KEYS = [
  'STRIPE_SECRET_KEY',
  'HYPERPAY_ENTITY_ID',
  'HYPERPAY_ACCESS_TOKEN',
] as const

const FORBIDDEN_VITE_SECRETS = [
  'VITE_AMADEUS_CLIENT_SECRET',
  'VITE_AMADEUS_API_SECRET',
  'VITE_DUFFEL_API_TOKEN',
  'VITE_MOYASAR_SECRET_KEY',
  'VITE_STRIPE_SECRET_KEY',
] as const

function isSet(key: string): boolean {
  const v = readBetaEnv(key)
  return Boolean(v && v.trim())
}

export function auditBetaSecrets(input?: {
  requireProviderSecrets?: boolean
}): BetaSecretsReport {
  const present: string[] = []
  const missing: string[] = []
  const exposedRisks: string[] = []

  for (const key of PROVIDER_SECRET_KEYS) {
    if (isSet(key)) present.push(key)
    else missing.push(key)
  }

  for (const key of OPTIONAL_PAYMENT_KEYS) {
    if (isSet(key)) present.push(key)
  }

  if (isSet('VITE_SUPABASE_URL')) present.push('VITE_SUPABASE_URL')
  else missing.push('VITE_SUPABASE_URL')
  if (isSet('VITE_SUPABASE_ANON_KEY')) present.push('VITE_SUPABASE_ANON_KEY')
  else missing.push('VITE_SUPABASE_ANON_KEY')

  for (const key of FORBIDDEN_VITE_SECRETS) {
    if (isSet(key)) exposedRisks.push(`${key} must not be set on the client`)
  }

  // Provider secrets are optional unless live activation requires them.
  const requiredMissing = missing.filter(
    (k) => k === 'VITE_SUPABASE_URL' || k === 'VITE_SUPABASE_ANON_KEY'
      || (input?.requireProviderSecrets && PROVIDER_SECRET_KEYS.includes(k as typeof PROVIDER_SECRET_KEYS[number])),
  )

  return {
    ok: requiredMissing.length === 0 && exposedRisks.length === 0,
    missing,
    present,
    exposedRisks,
  }
}

export function hasProviderCredentials(providerId: string): boolean {
  switch (providerId) {
    case 'amadeus':
      return (isSet('AMADEUS_API_KEY') || isSet('AMADEUS_CLIENT_ID'))
        && (isSet('AMADEUS_API_SECRET') || isSet('AMADEUS_CLIENT_SECRET'))
    case 'booking':
      return isSet('BOOKING_API_KEY') || isSet('RAPIDAPI_KEY') || isSet('BOOKING_RAPIDAPI_KEY')
        || isSet('VITE_BOOKING_PROXY_URL')
    case 'duffel':
      return isSet('DUFFEL_API_TOKEN')
    default:
      return false
  }
}
