/**
 * Sprint 82 — Tool registry (Brain v1).
 * Tool selection is registry-driven — never a hardcoded switch-only map.
 */

import type { BrainV1Intent, BrainV1ToolId } from './types'

export interface BrainV1ToolDefinition {
  id: BrainV1ToolId
  label: string
  description: string
  /** Intents that may select this tool when entities are complete. */
  intents: BrainV1Intent[]
  /** Soft intents that also allow this tool as a secondary helper. */
  secondaryIntents?: BrainV1Intent[]
  requiresCompleteTrip: boolean
  /** Future external API placeholder. */
  external?: boolean
}

const DEFAULT_TOOLS: BrainV1ToolDefinition[] = [
  {
    id: 'flights',
    label: 'Flight search',
    description: 'Search and compare flight offers',
    intents: [
      'flight_search',
      'package_search',
      'multi_city_trip',
      'business_travel',
      'family_vacation',
      'weekend_trip',
      'price_comparison',
      'price_prediction',
    ],
    requiresCompleteTrip: true,
  },
  {
    id: 'hotels',
    label: 'Hotel search',
    description: 'Search and compare hotel offers',
    intents: [
      'hotel_search',
      'package_search',
      'multi_city_trip',
      'business_travel',
      'family_vacation',
      'weekend_trip',
    ],
    requiresCompleteTrip: true,
  },
  {
    id: 'packages',
    label: 'Package search',
    description: 'Bundled flight + hotel packages',
    intents: ['package_search', 'family_vacation', 'weekend_trip', 'business_travel'],
    requiresCompleteTrip: true,
  },
  {
    id: 'maps',
    label: 'Maps',
    description: 'Destination geography and routing context',
    intents: ['travel_advice', 'multi_city_trip', 'weekend_trip'],
    secondaryIntents: ['flight_search', 'hotel_search', 'package_search'],
    requiresCompleteTrip: false,
  },
  {
    id: 'weather',
    label: 'Weather',
    description: 'Destination weather outlook',
    intents: ['travel_advice', 'weekend_trip', 'family_vacation'],
    secondaryIntents: ['package_search'],
    requiresCompleteTrip: false,
  },
  {
    id: 'visa',
    label: 'Visa',
    description: 'Visa requirements guidance',
    intents: ['visa_question'],
    secondaryIntents: ['travel_advice', 'business_travel'],
    requiresCompleteTrip: false,
  },
  {
    id: 'payments',
    label: 'Payments',
    description: 'Payment readiness / method hints (no live capture)',
    intents: ['booking_modification'],
    secondaryIntents: ['cancellation', 'flight_search', 'hotel_search', 'package_search'],
    requiresCompleteTrip: false,
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    description: 'Travel advice and destination knowledge',
    intents: ['travel_advice', 'budget_planning', 'general_conversation'],
    requiresCompleteTrip: false,
  },
  {
    id: 'budget',
    label: 'Budget planner',
    description: 'Budget planning helper (alias of knowledge domain)',
    intents: ['budget_planning'],
    requiresCompleteTrip: false,
  },
  {
    id: 'advice',
    label: 'Travel advice',
    description: 'Advice helper (alias of knowledge domain)',
    intents: ['travel_advice'],
    requiresCompleteTrip: false,
  },
  {
    id: 'external_api',
    label: 'Future external API',
    description: 'Placeholder for future third-party APIs',
    intents: [],
    requiresCompleteTrip: false,
    external: true,
  },
]

export class ToolRegistry {
  private readonly byId = new Map<BrainV1ToolId, BrainV1ToolDefinition>()

  constructor(defs: BrainV1ToolDefinition[] = DEFAULT_TOOLS) {
    for (const def of defs) {
      if (def.id === 'none') continue
      this.byId.set(def.id, def)
    }
  }

  register(def: BrainV1ToolDefinition): void {
    if (def.id === 'none') return
    this.byId.set(def.id, def)
  }

  get(id: BrainV1ToolId): BrainV1ToolDefinition | undefined {
    return this.byId.get(id)
  }

  list(): BrainV1ToolDefinition[] {
    return [...this.byId.values()]
  }

  /**
   * Resolve tools for an intent from the registry.
   * Never hardcodes the mapping outside registry membership.
   */
  resolveForIntent(
    intent: BrainV1Intent,
    options?: { complete: boolean, includeSecondary?: boolean },
  ): BrainV1ToolId[] {
    const complete = options?.complete ?? false
    const includeSecondary = options?.includeSecondary ?? false
    const selected: BrainV1ToolId[] = []

    for (const def of this.byId.values()) {
      if (def.external && def.intents.length === 0) continue
      const primary = def.intents.includes(intent)
      const secondary = includeSecondary && (def.secondaryIntents?.includes(intent) ?? false)
      if (!primary && !secondary) continue
      if (def.requiresCompleteTrip && !complete) continue
      selected.push(def.id)
    }

    return selected.length ? selected : ['none']
  }
}

export function createToolRegistry(defs?: BrainV1ToolDefinition[]): ToolRegistry {
  return new ToolRegistry(defs)
}
