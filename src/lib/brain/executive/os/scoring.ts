/**
 * Sprint 52 — Decision + multi-objective scoring (shared, cached).
 */

import type { PersonalizationProfile } from '../../../ai/preferences/types'
import type { AgentMemory } from '../../../agent/types'
import type { TravelReasoningResult } from '../../../agent/reasoning/types'
import { cacheWrap } from './computationCache'
import { getAllDestinationIntelligence } from './globalKnowledge'
import { detectTravelGoal, goalAxisBoosts } from './goalDetection'
import type {
  DestinationIntelligence,
  ObjectiveAxis,
  ScoredOption,
  TravelGoal,
} from './types'

const ALL_AXES: ObjectiveAxis[] = [
  'price',
  'comfort',
  'luxury',
  'time',
  'weather',
  'activities',
  'visa',
  'family',
  'business',
  'safety',
]

export interface ScoreContext {
  memory: AgentMemory
  profile: PersonalizationProfile
  reasoningResult: TravelReasoningResult | null
  goal: TravelGoal
  month?: number | null
  userText?: string
}

export function scoreDestinations(ctx: ScoreContext): ScoredOption[] {
  const month = ctx.month ?? null
  const key = [
    'score',
    ctx.goal,
    month ?? 'now',
    ctx.memory.requirements.budgetAmount ?? 'nb',
    ctx.profile.travelStyle.style,
    (ctx.profile.travelStyle.rejectedDestinations ?? []).join(','),
    ctx.reasoningResult?.primary?.id ?? 'np',
  ].join(':')

  return cacheWrap(key, 30_000, () => {
    const intel = getAllDestinationIntelligence(month)
    const budget = ctx.memory.requirements.budgetAmount
    const rejected = new Set(
      (ctx.profile.travelStyle.rejectedDestinations ?? []).map((d) => d.toLowerCase()),
    )
    const favorites = new Set(
      (ctx.profile.travelStyle.favoriteDestinations ?? []).map((d) => d.toLowerCase()),
    )
    const boosts = goalAxisBoosts(ctx.goal)
    const interests = new Set(ctx.profile.travelStyle.interests.map((i) => i.toLowerCase()))

    const scored = intel.map((row) => {
      const objectives = scoreObjectives(row, ctx, budget)
      let score = ALL_AXES.reduce((sum, axis) => {
        const weight = 0.1 + (boosts[axis] ?? 0)
        return sum + (objectives[axis] ?? 0.5) * weight
      }, 0)

      // Preference / memory boosts
      if (favorites.has(row.nameEn.toLowerCase()) || favorites.has(row.id)) {
        score += 0.12
      }
      if (interests.has('food')) score += row.food * 0.05
      if (interests.has('nature')) score += row.nature * 0.05
      if (interests.has('shopping')) score += row.shopping * 0.05
      if (ctx.profile.budget.style === 'luxury') score += row.luxuryScore * 0.08
      if (ctx.profile.budget.style === 'budget') score += objectives.price! * 0.08

      // Reasoning alignment
      if (ctx.reasoningResult?.primary?.id === row.id) score += 0.1
      if (ctx.reasoningResult?.alternatives.some((a) => a.id === row.id)) score += 0.05

      const isRejected = rejected.has(row.nameEn.toLowerCase())
        || rejected.has(row.id)
        || rejected.has(row.nameAr)
      const rejectReason = isRejected
        ? 'Traveler previously rejected this destination'
        : score < 0.35
          ? 'Weak overall fit'
          : null

      return {
        id: row.id,
        name: row.nameEn,
        score: clamp01(score / 1.6),
        objectives,
        rejected: Boolean(rejectReason),
        rejectReason,
        confidence: clamp01(0.55 + score * 0.25),
      } satisfies ScoredOption
    })

    return scored.sort((a, b) => b.score - a.score)
  })
}

export function optimizeDecisions(ctx: ScoreContext, keepTop = 3): {
  ranked: ScoredOption[]
  rejected: ScoredOption[]
  strongest: ScoredOption[]
} {
  const all = scoreDestinations(ctx)
  const rejected = all.filter((row) => row.rejected)
  const viable = all.filter((row) => !row.rejected)
  const strongest = viable.slice(0, keepTop)
  return { ranked: viable, rejected, strongest }
}

export function paretoOptimal(options: ScoredOption[], axes: ObjectiveAxis[] = ALL_AXES): ScoredOption[] {
  const viable = options.filter((row) => !row.rejected)
  return viable.filter((candidate) =>
    !viable.some((other) =>
      other.id !== candidate.id
      && dominates(other, candidate, axes),
    ))
}

function dominates(a: ScoredOption, b: ScoredOption, axes: ObjectiveAxis[]): boolean {
  let betterOrEqual = true
  let strictlyBetter = false
  for (const axis of axes) {
    const av = a.objectives[axis] ?? 0
    const bv = b.objectives[axis] ?? 0
    if (av < bv) betterOrEqual = false
    if (av > bv) strictlyBetter = true
  }
  return betterOrEqual && strictlyBetter
}

function scoreObjectives(
  row: DestinationIntelligence,
  ctx: ScoreContext,
  budget: number | null | undefined,
): Partial<Record<ObjectiveAxis, number>> {
  const priceFit = budget
    ? clamp01(1 - Math.abs(row.averageDailyCostSar * 5 - budget) / Math.max(budget, 1))
    : clamp01(1 - row.averageDailyCostSar / 2500)

  const weatherPref = ctx.profile.travelStyle.weatherPreference?.toLowerCase() ?? null
  const weather = weatherPref
    ? (row.weather.includes(weatherPref) || weatherPref.includes(row.weather) ? 0.9 : 0.45)
    : climateComfort(row.weather)

  const visaEase =
    row.visa === 'visa_free' ? 0.95
      : row.visa === 'visa_on_arrival' ? 0.85
        : row.visa === 'evisa' ? 0.7
          : 0.35

  return {
    price: priceFit,
    comfort: clamp01((row.transportation + row.internet + row.airportQuality) / 3),
    luxury: row.luxuryScore,
    time: row.flightAccessibility,
    weather,
    activities: clamp01((row.nature + row.adventure + row.nightlife + row.shopping + row.food) / 5),
    visa: visaEase,
    family: row.familyFriendliness,
    business: row.businessScore,
    safety: clamp01(row.safety * (1 - row.riskScore * 0.4)),
  }
}

function climateComfort(band: string): number {
  if (band === 'mild' || band === 'warm') return 0.85
  if (band === 'cool') return 0.7
  if (band === 'hot') return 0.55
  return 0.45
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
