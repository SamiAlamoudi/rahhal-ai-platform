/**
 * Phase AB — FeatureRegistry for v1.1 product capabilities.
 * Does not replace Phase W ProviderFeatureFlags.
 */

import type { FeatureDefinition, FeatureId, FeatureLifecycle, FeatureRegistrySnapshot } from './types'

const DEFAULT_FEATURES: FeatureDefinition[] = [
  {
    id: 'ai.multi_destination',
    name: 'Multi-destination trip support',
    description: 'Plan trips spanning multiple cities / hubs.',
    lifecycle: 'beta',
    enabled: true,
  },
  {
    id: 'ai.alternative_itineraries',
    name: 'Alternative itinerary generation',
    description: 'Generate ranked alternative itineraries for the same requirements.',
    lifecycle: 'experimental',
    enabled: true,
    dependsOn: ['ai.recommendation_engine'],
  },
  {
    id: 'ai.confidence_scoring',
    name: 'Confidence scoring',
    description: 'Attach confidence scores to recommendations and plans.',
    lifecycle: 'beta',
    enabled: true,
  },
  {
    id: 'ai.explainable_recommendations',
    name: 'Explainable recommendations',
    description: 'Human-readable whySelected / whyRejected rationales.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.confidence_scoring'],
  },
  {
    id: 'ai.preference_weighting',
    name: 'User preference weighting',
    description: 'Weight ranking by personalization profiles.',
    lifecycle: 'experimental',
    enabled: true,
    dependsOn: ['ai.personalization'],
  },
  {
    id: 'ai.personalization',
    name: 'Personalization foundation',
    description: 'Traveler / hotel / airline / budget / travel-style profiles.',
    lifecycle: 'experimental',
    enabled: true,
  },
  {
    id: 'ai.recommendation_engine',
    name: 'Recommendation engine',
    description: 'Interfaces for RecommendationEngine / PreferenceEngine / RankingEngine.',
    lifecycle: 'experimental',
    enabled: true,
  },
  {
    id: 'ai.analytics',
    name: 'Anonymous usage analytics',
    description: 'Privacy-gated product analytics foundation.',
    lifecycle: 'experimental',
    enabled: true,
  },
  {
    id: 'ai.concierge',
    name: 'AI Concierge conversation intelligence',
    description:
      'Provider-agnostic consultant dialogue above the travel agent. Never selects suppliers.',
    lifecycle: 'experimental',
    enabled: true,
  },
  {
    id: 'ui.flight_results_experience',
    name: 'Flight Results Experience',
    description:
      'Sprint 11 premium flight cards, sort/filter, details, concierge summary, and select→booking session.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ai.concierge'],
  },
  {
    id: 'ui.passenger_booking_flow',
    name: 'Passenger Management & Booking Flow',
    description:
      'Sprint 12 passenger forms, validation, booking summary, and session persistence before review.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.flight_results_experience'],
  },
  {
    id: 'ui.my_trips',
    name: 'My Trips',
    description:
      'Sprint 13 production My Trips experience (upcoming/completed/cancelled) over booking sessions.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.passenger_booking_flow'],
    notes: 'Product alias: myTrips',
  },
  {
    id: 'ui.booking_history',
    name: 'Booking History',
    description:
      'Sprint 13 booking records, details, timeline, and concierge booking-history intents.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.my_trips'],
    notes: 'Product alias: bookingHistory',
  },
  {
    id: 'ui.booking_confirmation',
    name: 'Booking Confirmation Engine',
    description:
      'Sprint 14 confirmation lifecycle (pending→confirming→confirmed/failed) and confirmation UI.',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.booking_history'],
    notes: 'Product alias: booking_confirmation',
  },
  {
    id: 'ui.supplier_adapter',
    name: 'Supplier Adapter Layer',
    description:
      'Sprint 14 provider-independent supplier booking ports (Amadeus active; Duffel/Travelport/Sabre stubs).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.booking_confirmation'],
    notes: 'Product alias: supplier_adapter',
  },
  {
    id: 'ui.booking_timeline',
    name: 'Booking Timeline',
    description:
      'Sprint 14 confirmation timeline UI (created → supplier → ticket pending → completed).',
    lifecycle: 'beta',
    enabled: true,
    dependsOn: ['ui.booking_confirmation'],
    notes: 'Product alias: booking_timeline',
  },
  {
    id: 'payments.live',
    name: 'Live payment providers',
    description: 'Enable live payment rails (Moyasar etc.). Remains OFF in v1.1 planning.',
    lifecycle: 'deprecated',
    enabled: false,
    notes: 'Keep VITE_PAYMENT_PROVIDER=mock until payment production freeze lifts.',
  },
  {
    id: 'providers.live_master',
    name: 'Live travel providers master switch',
    description: 'Master flag for Amadeus / Booking / Maps / Weather live calls.',
    lifecycle: 'stable',
    enabled: false,
    notes: 'Defaults OFF; Phase W provider flags still authoritative at runtime.',
  },
]

export class FeatureRegistry {
  private readonly byId = new Map<FeatureId, FeatureDefinition>()

  constructor(definitions: FeatureDefinition[] = DEFAULT_FEATURES) {
    for (const def of definitions) {
      this.byId.set(def.id, { ...def, dependsOn: def.dependsOn ? [...def.dependsOn] : undefined })
    }
  }

  list(): FeatureDefinition[] {
    return [...this.byId.values()].map((d) => ({ ...d, dependsOn: d.dependsOn ? [...d.dependsOn] : undefined }))
  }

  get(id: FeatureId): FeatureDefinition | null {
    const row = this.byId.get(id)
    return row ? { ...row, dependsOn: row.dependsOn ? [...row.dependsOn] : undefined } : null
  }

  isEnabled(id: FeatureId): boolean {
    const feature = this.byId.get(id)
    if (!feature || !feature.enabled) return false
    for (const dep of feature.dependsOn ?? []) {
      if (!this.isEnabled(dep)) return false
    }
    return true
  }

  setEnabled(id: FeatureId, enabled: boolean): FeatureDefinition {
    const current = this.byId.get(id)
    if (!current) throw new Error(`Unknown feature: ${id}`)
    const next = { ...current, enabled }
    this.byId.set(id, next)
    return { ...next }
  }

  setLifecycle(id: FeatureId, lifecycle: FeatureLifecycle): FeatureDefinition {
    const current = this.byId.get(id)
    if (!current) throw new Error(`Unknown feature: ${id}`)
    const next = { ...current, lifecycle }
    this.byId.set(id, next)
    return { ...next }
  }

  listByLifecycle(lifecycle: FeatureLifecycle): FeatureDefinition[] {
    return this.list().filter((f) => f.lifecycle === lifecycle)
  }

  snapshot(): FeatureRegistrySnapshot {
    const features = this.list()
    return {
      features,
      enabledIds: features.filter((f) => this.isEnabled(f.id)).map((f) => f.id),
    }
  }
}

let defaultRegistry: FeatureRegistry | null = null

export function getFeatureRegistry(): FeatureRegistry {
  if (!defaultRegistry) defaultRegistry = new FeatureRegistry()
  return defaultRegistry
}

export function resetFeatureRegistry(): void {
  defaultRegistry = null
}

export function createDefaultFeatureRegistry(): FeatureRegistry {
  return new FeatureRegistry()
}
