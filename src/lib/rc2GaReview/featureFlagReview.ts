/**
 * RC2 — Feature flag status review (defaults, ownership, rollback).
 */

import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import type { ChecklistItem, FeatureFlagStatusRow } from './types'

/** Critical flags that must remain OFF in default GA artifacts. */
export const RC2_MUST_STAY_OFF = [
  'security.secret_manager',
  'observability.platform',
  'load_testing.platform',
  'production_audit.platform',
  'rc1.validation',
  'soak.staging',
  'rc2.ga_review',
  'ai.integration_journey',
  'ai.integration_trip_orchestrator',
  'ai.integration_action_execution',
  'ai.integration_destination_intelligence',
  'ai.integration_trip_companion',
  'ai.integration_maps_mobility',
  'ai.integration_budget_pricing',
  'ai.integration_disruption_recovery',
  'ai.live_providers',
  'ai.live_flight_search',
  'ai.live_hotel_search',
  'ai.live_provider_gateway',
  'provider.amadeus',
  'provider.duffel',
  'provider.booking',
  'payments.live',
  'providers.live_master',
  'ai.realtime_voice',
  'voice.realtime',
] as const

function ownershipFor(id: string): string {
  if (id.startsWith('security.')) return 'Security / Platform'
  if (id.startsWith('observability.')) return 'Platform / Ops'
  if (id.startsWith('load_testing.') || id.startsWith('production_audit.') || id.startsWith('rc1.') || id.startsWith('rc2.') || id.startsWith('soak.')) {
    return 'Release Engineering'
  }
  if (id.startsWith('provider.') || id.startsWith('providers.')) return 'Providers'
  if (id.startsWith('payments.')) return 'Payments'
  if (id.startsWith('voice.') || id.includes('realtime_voice')) return 'Voice'
  if (id.startsWith('brain.')) return 'Brain (frozen)'
  if (id.startsWith('ui.')) return 'UI / Product'
  if (id.startsWith('ai.integration_')) return 'Integration'
  if (id.startsWith('ai.')) return 'AI Product'
  if (id.startsWith('booking.')) return 'Booking'
  return 'Platform'
}

export function reviewFeatureFlags(): {
  rows: FeatureFlagStatusRow[]
  checks: ChecklistItem[]
} {
  resetFeatureRegistry()
  const registry = getFeatureRegistry()
  const features = registry.list()

  const rows: FeatureFlagStatusRow[] = features.map((f) => {
    const mustStayOff = (RC2_MUST_STAY_OFF as readonly string[]).includes(f.id)
    return {
      id: f.id,
      defaultEnabled: f.enabled,
      lifecycle: f.lifecycle,
      mustStayOff,
      ownership: ownershipFor(f.id),
      rollback: mustStayOff
        ? 'Keep OFF / disable via FeatureRegistry + redeploy defaults'
        : 'Disable via FeatureRegistry; mock providers remain default',
      notes: f.notes ?? f.description,
    }
  })

  const criticalOn = rows.filter((r) => r.mustStayOff && r.defaultEnabled)
  const rc2Present = rows.some((r) => r.id === 'rc2.ga_review' && !r.defaultEnabled)

  const checks: ChecklistItem[] = [
    {
      id: 'flags_critical_off',
      area: 'feature_flags',
      status: criticalOn.length === 0 ? 'PASS' : 'BLOCKER',
      summary:
        criticalOn.length === 0
          ? 'All critical GA flags default OFF'
          : `Critical flags default ON: ${criticalOn.map((r) => r.id).join(', ')}`,
    },
    {
      id: 'flags_rc2_registered',
      area: 'feature_flags',
      status: rc2Present ? 'PASS' : 'BLOCKER',
      summary: rc2Present ? 'rc2.ga_review registered and OFF' : 'rc2.ga_review missing or enabled',
    },
    {
      id: 'flags_amadeus_alias',
      area: 'feature_flags',
      status: 'WARNING',
      summary: 'providers.amadeus.enabled registry default is true; production helper gates live URLs',
      detail:
        'Safe when deploy target / live URL guards remain. Prefer leaving provider.amadeus and ai.live_* OFF for GA default.',
    },
    {
      id: 'flags_rollback_path',
      area: 'feature_flags',
      status: 'PASS',
      summary: 'Rollback path documented: disable experimental flags + mock provider defaults',
    },
  ]

  return { rows, checks }
}
