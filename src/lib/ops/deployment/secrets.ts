/**
 * Sprint 68 — Secrets management validation (additive; no secret values logged).
 */

import { validateEnvironment } from '../security/envValidation'
import { getDeployProfile } from './profiles'
import type { DeployProfileName, SecretCheckItem, SecretValidationReport } from './types'

const FORBIDDEN_CLIENT_SECRETS = [
  'VITE_AMADEUS_CLIENT_SECRET',
  'VITE_AMADEUS_CLIENT_ID',
  'VITE_OPENWEATHER_API_KEY',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_MOYASAR_SECRET_KEY',
  'VITE_MOYASAR_SECRET',
  'VITE_STRIPE_SECRET_KEY',
  'VITE_HYPERPAY_SECRET',
  'VITE_DUFFEL_ACCESS_TOKEN',
  'VITE_BOOKING_COM_SECRET',
]

/** Server-side / Edge secret names — presence checked only when explicitly supplied. */
const EDGE_SECRET_CATALOG: Array<{
  id: string
  category: SecretCheckItem['category']
  label: string
  keys: string[]
  requiredInProduction: boolean
}> = [
  {
    id: 'amadeus',
    category: 'amadeus',
    label: 'Amadeus credentials',
    keys: ['AMADEUS_CLIENT_ID', 'AMADEUS_CLIENT_SECRET'],
    requiredInProduction: false,
  },
  {
    id: 'booking_com',
    category: 'booking_com',
    label: 'Booking.com credentials',
    keys: ['BOOKING_COM_API_KEY', 'BOOKING_API_KEY'],
    requiredInProduction: false,
  },
  {
    id: 'duffel',
    category: 'duffel',
    label: 'Duffel access token',
    keys: ['DUFFEL_ACCESS_TOKEN'],
    requiredInProduction: false,
  },
  {
    id: 'stripe',
    category: 'stripe',
    label: 'Stripe secret key',
    keys: ['STRIPE_SECRET_KEY'],
    requiredInProduction: false,
  },
  {
    id: 'hyperpay',
    category: 'hyperpay',
    label: 'HyperPay credentials',
    keys: ['HYPERPAY_ENTITY_ID', 'HYPERPAY_ACCESS_TOKEN'],
    requiredInProduction: false,
  },
  {
    id: 'apple_pay',
    category: 'apple_pay',
    label: 'Apple Pay merchant config',
    keys: ['APPLE_PAY_MERCHANT_ID'],
    requiredInProduction: false,
  },
  {
    id: 'email',
    category: 'email',
    label: 'Email notification provider',
    keys: ['EMAIL_API_KEY', 'RESEND_API_KEY', 'SENDGRID_API_KEY'],
    requiredInProduction: false,
  },
  {
    id: 'whatsapp',
    category: 'whatsapp',
    label: 'WhatsApp notification provider',
    keys: ['WHATSAPP_API_TOKEN', 'TWILIO_AUTH_TOKEN'],
    requiredInProduction: false,
  },
  {
    id: 'push',
    category: 'push',
    label: 'Push notification credentials',
    keys: ['FCM_SERVER_KEY', 'VAPID_PRIVATE_KEY'],
    requiredInProduction: false,
  },
]

function isSet(value: string | undefined | null): boolean {
  return Boolean(value && String(value).trim())
}

function looksInvalid(value: string): boolean {
  const v = value.trim().toLowerCase()
  return v === 'changeme' || v === 'todo' || v === 'xxx' || v.includes('your_') || v.includes('replace')
}

export function validateProductionSecrets(input?: {
  profile?: DeployProfileName
  env?: Record<string, string | undefined>
  /** Explicit Edge/server secret bag (never from VITE_*). */
  edgeSecrets?: Record<string, string | undefined>
  now?: () => number
}): SecretValidationReport {
  const profileName = input?.profile ?? 'production'
  const profile = getDeployProfile(profileName)
  const env = input?.env ?? {}
  const edge = input?.edgeSecrets ?? {}
  const now = input?.now ?? (() => Date.now())
  const items: SecretCheckItem[] = []
  const missing: string[] = []
  const invalid: string[] = []
  const forbidden: string[] = []
  const warnings: string[] = []

  const envResult = validateEnvironment({
    target: profile.envTarget,
    env,
  })

  items.push({
    id: 'env.payment',
    category: 'environment',
    label: 'Payment provider',
    status: envResult.resolved.paymentProvider === 'mock' || !profile.requireMockPayments
      ? 'ok'
      : 'invalid',
    detail: `VITE_PAYMENT_PROVIDER=${envResult.resolved.paymentProvider}`,
    clientExposed: true,
  })

  items.push({
    id: 'env.live_providers',
    category: 'environment',
    label: 'Live providers flag',
    status: !envResult.resolved.liveProvidersEnabled || profile.allowLiveProviders
      ? (envResult.resolved.liveProvidersEnabled ? 'warn' : 'ok')
      : 'invalid',
    detail: `liveProvidersEnabled=${envResult.resolved.liveProvidersEnabled}`,
    clientExposed: true,
  })

  items.push({
    id: 'env.supabase',
    category: 'environment',
    label: 'Supabase URL + anon key',
    status: envResult.resolved.supabaseConfigured
      ? 'ok'
      : profile.requireSupabase
        ? 'missing'
        : 'optional',
    detail: envResult.resolved.supabaseConfigured ? 'configured' : 'not set',
    clientExposed: true,
  })

  if (!envResult.resolved.supabaseConfigured && profile.requireSupabase) {
    missing.push('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  }

  for (const key of FORBIDDEN_CLIENT_SECRETS) {
    const value = env[key]
    if (isSet(value)) {
      forbidden.push(key)
      items.push({
        id: `forbidden.${key}`,
        category: 'api_keys',
        label: key,
        status: 'forbidden',
        detail: 'Must not appear in client VITE_* bundle',
        clientExposed: true,
      })
    }
  }

  for (const catalog of EDGE_SECRET_CATALOG) {
    const presentKey = catalog.keys.find((k) => isSet(edge[k]))
    if (!presentKey) {
      items.push({
        id: `edge.${catalog.id}`,
        category: catalog.category,
        label: catalog.label,
        status: 'optional',
        detail: 'Not supplied — live path remains mock/disabled',
        clientExposed: false,
      })
      if (catalog.requiredInProduction && profileName === 'production') {
        missing.push(catalog.label)
      }
      continue
    }
    const value = edge[presentKey]!
    if (looksInvalid(value)) {
      invalid.push(presentKey)
      items.push({
        id: `edge.${catalog.id}`,
        category: catalog.category,
        label: catalog.label,
        status: 'invalid',
        detail: `${presentKey} looks like a placeholder`,
        clientExposed: false,
      })
    } else {
      items.push({
        id: `edge.${catalog.id}`,
        category: catalog.category,
        label: catalog.label,
        status: 'ok',
        detail: `${presentKey} present (value redacted)`,
        clientExposed: false,
      })
    }
  }

  for (const err of envResult.errors) {
    if (!warnings.includes(err) && !invalid.includes(err)) {
      if (err.includes('must not be set')) {
        // already covered by forbidden scan
      } else {
        warnings.push(err)
      }
    }
  }
  for (const w of envResult.warnings) {
    warnings.push(w)
  }

  if (envResult.resolved.liveProvidersEnabled && profile.allowLiveProviders) {
    warnings.push('Live providers enabled — confirm Edge secrets for Amadeus/Booking/Duffel')
  }

  const ok =
    forbidden.length === 0
    && invalid.length === 0
    && missing.length === 0
    && items.every((i) => i.status !== 'forbidden' && i.status !== 'invalid' && i.status !== 'missing')

  return {
    ok,
    profile: profileName,
    items,
    missing,
    invalid,
    forbidden,
    warnings,
    generatedAt: new Date(now()).toISOString(),
  }
}
