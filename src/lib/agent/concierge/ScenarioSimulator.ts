/**
 * Sprint 111 — ScenarioSimulator
 * "What if?" simulations using already-available recommendations only (no re-search).
 */

import type {
  ConciergeRecommendationOption,
  ConciergeScenario,
  ConciergeScenarioKind,
} from './types'

const SCENARIO_DEFS: Array<{ kind: ConciergeScenarioKind; label: string }> = [
  { kind: 'travel_one_day_earlier', label: 'Travel one day earlier' },
  { kind: 'increase_budget', label: 'Increase budget' },
  { kind: 'reduce_budget', label: 'Reduce budget' },
  { kind: 'upgrade_hotel', label: 'Upgrade hotel' },
  { kind: 'direct_flight_only', label: 'Direct flight only' },
  { kind: 'family_travelers', label: 'Family travelers' },
  { kind: 'business_travelers', label: 'Business travelers' },
]

function isDirect(o: ConciergeRecommendationOption): boolean {
  return o.stops === 0
}

function isFamily(o: ConciergeRecommendationOption): boolean {
  const blob = `${o.kind ?? ''} ${o.labels.join(' ')} ${o.reason ?? ''}`.toLowerCase()
  return blob.includes('family') || (o.hotelStars ?? 0) >= 3
}

function isBusiness(o: ConciergeRecommendationOption): boolean {
  const cabin = (o.cabin ?? '').toLowerCase()
  const blob = `${o.kind ?? ''} ${o.labels.join(' ')}`.toLowerCase()
  return (
    cabin.includes('business')
    || cabin.includes('first')
    || blob.includes('business')
  )
}

function hotelStars(o: ConciergeRecommendationOption): number {
  return o.hotelStars ?? 0
}

export function simulateScenarios(input: {
  selected: ConciergeRecommendationOption | null
  recommendations: ConciergeRecommendationOption[]
  budget?: number | null
  currency?: string
}): ConciergeScenario[] {
  const currency =
    input.currency
    || input.selected?.currency
    || input.recommendations[0]?.currency
    || 'SAR'
  const pool = input.recommendations
  const selected = input.selected

  return SCENARIO_DEFS.map(({ kind, label }) => {
    switch (kind) {
      case 'travel_one_day_earlier': {
        // No date-shifted offers without re-search — report simulation limit from facts.
        return {
          kind,
          label,
          applicable: false,
          summary:
            'No alternate-date options are present in the current result set; re-search would be required to travel one day earlier.',
          matchingOptionIds: [],
          estimatedPrice: null,
          currency,
          notes: ['Simulation only — did not call providers'],
        }
      }
      case 'increase_budget': {
        const budget = input.budget
        const premium = [...pool]
          .filter((o) => o.price != null)
          .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0] ?? null
        if (!premium || premium.price == null) {
          return {
            kind,
            label,
            applicable: false,
            summary: 'No priced premium option available to simulate a higher budget.',
            matchingOptionIds: [],
            estimatedPrice: null,
            currency,
            notes: [],
          }
        }
        const overBudget =
          budget != null && premium.price > budget
        return {
          kind,
          label,
          applicable: true,
          summary: overBudget
            ? `Raising budget toward ${premium.price} ${currency} unlocks ${premium.title ?? premium.id}.`
            : `${premium.title ?? premium.id} is already within or near the stated budget at ${premium.price} ${currency}.`,
          matchingOptionIds: [premium.id],
          estimatedPrice: premium.price,
          currency,
          notes: selected && selected.id !== premium.id
            ? [`Selected today: ${selected.title ?? selected.id}`]
            : [],
        }
      }
      case 'reduce_budget': {
        const cheapest = [...pool]
          .filter((o) => o.price != null)
          .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0] ?? null
        if (!cheapest || cheapest.price == null) {
          return {
            kind,
            label,
            applicable: false,
            summary: 'No priced options available to simulate a lower budget.',
            matchingOptionIds: [],
            estimatedPrice: null,
            currency,
            notes: [],
          }
        }
        return {
          kind,
          label,
          applicable: true,
          summary:
            `Reducing spend points to ${cheapest.title ?? cheapest.id} at ${cheapest.price} ${currency}.`,
          matchingOptionIds: [cheapest.id],
          estimatedPrice: cheapest.price,
          currency,
          notes:
            selected?.price != null && cheapest.price < selected.price
              ? [
                `Potential reduction vs selected: ${Math.round((selected.price - cheapest.price) * 100) / 100} ${currency}`,
              ]
              : [],
        }
      }
      case 'upgrade_hotel': {
        const selectedStars = selected ? hotelStars(selected) : 0
        const better = [...pool]
          .filter((o) => hotelStars(o) > selectedStars)
          .sort((a, b) => hotelStars(b) - hotelStars(a))[0] ?? null
        if (!better) {
          return {
            kind,
            label,
            applicable: false,
            summary: 'No higher-rated hotel option exists in the current recommendations.',
            matchingOptionIds: [],
            estimatedPrice: selected?.price ?? null,
            currency,
            notes: [],
          }
        }
        return {
          kind,
          label,
          applicable: true,
          summary:
            `Upgrading hotel quality points to ${better.title ?? better.id}`
            + (better.hotelStars != null ? ` (${better.hotelStars}★)` : '')
            + (better.hotelName ? ` — ${better.hotelName}` : '')
            + (better.price != null ? ` at ${better.price} ${currency}` : '')
            + '.',
          matchingOptionIds: [better.id],
          estimatedPrice: better.price,
          currency,
          notes: [],
        }
      }
      case 'direct_flight_only': {
        const directs = pool.filter(isDirect)
        return {
          kind,
          label,
          applicable: directs.length > 0,
          summary:
            directs.length > 0
              ? `Direct-flight filter keeps ${directs.length} option(s); top match ${directs[0]?.title ?? directs[0]?.id}.`
              : 'No nonstop options are present in the current recommendations.',
          matchingOptionIds: directs.map((d) => d.id),
          estimatedPrice: directs[0]?.price ?? null,
          currency,
          notes: [],
        }
      }
      case 'family_travelers': {
        const family = pool.filter(isFamily)
        return {
          kind,
          label,
          applicable: family.length > 0,
          summary:
            family.length > 0
              ? `Family-oriented matches: ${family.map((f) => f.title ?? f.id).slice(0, 3).join(', ')}.`
              : 'No explicitly family-labeled options in the current set.',
          matchingOptionIds: family.map((f) => f.id),
          estimatedPrice: family[0]?.price ?? null,
          currency,
          notes: [],
        }
      }
      case 'business_travelers': {
        const biz = pool.filter(isBusiness)
        return {
          kind,
          label,
          applicable: biz.length > 0,
          summary:
            biz.length > 0
              ? `Business-oriented matches: ${biz.map((b) => b.title ?? b.id).slice(0, 3).join(', ')}.`
              : 'No explicitly business/cabin-labeled options in the current set.',
          matchingOptionIds: biz.map((b) => b.id),
          estimatedPrice: biz[0]?.price ?? null,
          currency,
          notes: [],
        }
      }
      default:
        return {
          kind,
          label,
          applicable: false,
          summary: 'Scenario not available from current facts.',
          matchingOptionIds: [],
          estimatedPrice: null,
          currency,
          notes: [],
        }
    }
  })
}

export class ScenarioSimulator {
  simulate(input: Parameters<typeof simulateScenarios>[0]): ConciergeScenario[] {
    return simulateScenarios(input)
  }
}

export function createScenarioSimulator(): ScenarioSimulator {
  return new ScenarioSimulator()
}
